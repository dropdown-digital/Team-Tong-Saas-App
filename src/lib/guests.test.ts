import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextRequest } from "next/server";
import {
  db,
  account,
  loadClub,
  saveClub,
  type Account,
} from "./server/database";
import { register, login, digest } from "./server/auth";
import { roomCommand, roomInfo } from "./server/rooms";
import { command, snapshot, heartbeat, online } from "./server/service";
import { enterGuest, guestView } from "./server/guests";
import { POST as guestPost, GET as guestGet } from "../app/api/guest/route";
import { POST as clubPost } from "../app/api/club/route";
const dir = mkdtempSync(join(tmpdir(), "tong-guests-"));
process.env.TEAM_TONG_DB = join(dir, "test.sqlite");
after(() => {
  db().close();
  rmSync(dir, { recursive: true, force: true });
});
async function user(n: number) {
  await register(
    `guests-${n}@example.test`,
    "test password 12345",
    "Member " + n,
  );
  const a = (await db()
    .prepare("SELECT * FROM accounts WHERE email=?")
    .get(`guests-${n}@example.test`)) as Account;
  await db()
    .prepare("UPDATE accounts SET email_verified=1 WHERE id=?")
    .run(a.id);
  return (await account(a.id))!;
}
async function makeRoom(u: Account) {
  return (
    await roomCommand(u, { type: "roomCreate", name: "Guest access test" })
  ).roomId!;
}
async function approve(u: Account, owner: Account, r: string) {
  await roomCommand(u, {
    type: "roomJoin",
    code: (await roomInfo(owner, r)).code,
  });
  await roomCommand(
    owner,
    { type: "roomDecide", user: u.id, approve: true },
    r,
  );
}
test("organizer-created participants are room scoped; linking is approved, unique and keeps frozen eligibility and ballot identity", async () => {
  const owner = await user(1),
    member = await user(2),
    outside = await user(3),
    r = await makeRoom(owner);
  await approve(member, owner, r);
  let s = await command(
    owner,
    {
      type: "create",
      venue: "Guest turf",
      date: "2026-11-01",
      time: "20:00",
      fee: 3000,
    },
    r,
  );
  const m = s.store.matches[0];
  await assert.rejects(
    async () =>
      await command(
        member,
        { type: "addParticipant", name: "Denied", position: "Forward" },
        r,
      ),
  );
  s = await command(
    owner,
    { type: "addParticipant", name: "Rafi", position: "Forward", match: m.id },
    r,
  );
  const p = s.store.players.find((p) => p.guest)!;
  assert.equal(s.store.matches[0].attendance[p.id], "going");
  assert.equal(
    await db().prepare("SELECT 1 FROM accounts WHERE id=?").get(p.id),
    undefined,
  );
  await assert.rejects(
    async () =>
      await command(
        owner,
        { type: "linkParticipant", player: p.id, account: outside.id },
        r,
      ),
  );
  await command(
    owner,
    { type: "linkParticipant", player: p.id, account: member.id },
    r,
  );
  assert.equal((await snapshot(member, r)).store.viewer, p.id);
  assert.equal(
    (await snapshot(member, r)).store.players.some((p) => p.id === member.id),
    false,
  );
  await assert.rejects(
    async () =>
      await command(
        owner,
        { type: "linkParticipant", player: p.id, account: owner.id },
        r,
      ),
  );
  await command(member, { type: "rsvp", match: m.id, value: "going" }, r);
  assert.equal(
    (await loadClub(r)).store.matches[0].attendance[member.id],
    undefined,
  );
  const data = await loadClub(r);
  const match = data.store.matches[0];
  match.teams = [[p.id], [owner.id]];
  match.played = [p.id, owner.id];
  match.status = "completed";
  match.eligibilityFrozen = true;
  match.playedConfirmed = true;
  match.voting = true;
  match.votingDeadline = new Date(Date.now() + 3600000).toISOString();
  await saveClub(data);
  await assert.rejects(
    async () =>
      await command(
        member,
        { type: "voteDraft", match: m.id, target: p.id, value: 8 },
        r,
      ),
  );
  await command(
    member,
    { type: "voteDraft", match: m.id, target: owner.id, value: 8 },
    r,
  );
  s = await command(member, { type: "submit", match: m.id }, r);
  assert.ok(s.store.matches[0].ballots?.[p.id]);
  assert.equal(s.store.matches[0].ballots?.[member.id], undefined);
  await assert.rejects(
    async () => await command(member, { type: "submit", match: m.id }, r),
  );
  const guest2 = (
    await command(
      owner,
      { type: "addParticipant", name: "Siam", position: "Defender" },
      r,
    )
  ).store.players.find((p) => p.guest && !p.accountId)!;
  const next = await loadClub(r);
  next.store.matches[0].teams[1].push(guest2.id);
  await saveClub(next);
  await approve(outside, owner, r);
  const eligibility = JSON.stringify(
      (await loadClub(r)).store.matches[0].played,
    ),
    ballots = JSON.stringify((await loadClub(r)).store.matches[0].ballots);
  await command(
    owner,
    { type: "linkParticipant", player: guest2.id, account: outside.id },
    r,
  );
  assert.equal(
    JSON.stringify((await loadClub(r)).store.matches[0].played),
    eligibility,
  );
  assert.equal(
    JSON.stringify((await loadClub(r)).store.matches[0].ballots),
    ballots,
  );
  await assert.rejects(
    async () =>
      await command(
        outside,
        { type: "voteDraft", match: m.id, target: owner.id, value: 8 },
        r,
      ),
  ); // Linking alone cannot add actual participation.
});
test("guests receive only football viewing data, cannot cross rooms, and lose access on code rotation or archive", async () => {
  const owner = await user(10),
    r = await makeRoom(owner),
    r2 = await makeRoom(owner);
  let s = await command(
    owner,
    {
      type: "create",
      venue: "Watchable turf",
      date: "2026-11-02",
      time: "20:00",
      fee: 999,
    },
    r,
  );
  const id = s.store.matches[0].id;
  s = await command(
    owner,
    {
      type: "addParticipant",
      name: "Visible player",
      position: "Midfielder",
      match: id,
    },
    r,
  );
  const p = s.store.players.find((p) => p.guest)!;
  const data = await loadClub(r),
    m = data.store.matches[0];
  m.teams = [[p.id], [owner.id]];
  m.votes = [{ voter: owner.id, target: p.id, value: 7 }];
  m.drafts = { [owner.id]: { [p.id]: 8 } };
  m.ballots = { [owner.id]: new Date().toISOString() };
  m.paid = [owner.id];
  await saveClub(data);
  const { token } = await enterGuest((await roomInfo(owner, r)).code);
  const view = await guestView(token, r);
  assert.equal(view.matches[0].venue, "Watchable turf");
  assert.ok(view.players.some((x) => x.name === "Visible player"));
  for (const key of [
    "votes",
    "ballots",
    "drafts",
    "results",
    "submittedBy",
    "paid",
    "fee",
    "email",
    "password",
    "accountId",
    "audit",
    "members",
  ])
    assert.equal(JSON.stringify(view).includes('"' + key + '"'), false, key);
  await assert.rejects(async () => await guestView(undefined, r));
  await assert.rejects(async () => await guestView(token, r2));
  await roomCommand(owner, { type: "roomCode" }, r);
  await assert.rejects(async () => await guestView(token, r));
  const renewed = await enterGuest((await roomInfo(owner, r)).code);
  await roomCommand(owner, { type: "roomArchive", archived: true }, r);
  await assert.rejects(async () => await guestView(renewed.token, r));
});
test("guest HTTP cookie cannot authorize ratings or picks; only invitation entry is writable", async () => {
  const owner = await user(20),
    r = await makeRoom(owner);
  const origin = "http://127.0.0.1:3000";
  const request = (body: unknown, cookie = "") =>
    new NextRequest(origin + "/api/guest", {
      method: "POST",
      headers: {
        origin,
        host: "127.0.0.1:3000",
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify(body),
    });
  const res = await guestPost(
    request({ type: "enter", code: (await roomInfo(owner, r)).code }),
  );
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie")!.split(";")[0];
  assert.match(res.headers.get("set-cookie")!, /HttpOnly/);
  assert.equal(
    (
      await guestGet(
        new NextRequest(origin + "/api/guest?room=" + r, {
          headers: { cookie },
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (await guestPost(request({ type: "pick", player: owner.id }, cookie)))
      .status,
    403,
  );
  const bad = new NextRequest(origin + "/api/club?room=" + r, {
    method: "POST",
    headers: {
      origin,
      host: "127.0.0.1:3000",
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({ type: "submit", match: "guessed" }),
  });
  assert.equal((await clubPost(bad)).status, 401);
});
test("linked captains use account presence and unlinked players cannot be selected as captains", async () => {
  const owner = await user(30),
    captain = await user(31),
    r = await makeRoom(owner);
  await approve(captain, owner, r);
  let s = await command(
    owner,
    {
      type: "create",
      venue: "Draft turf",
      date: "2026-11-03",
      time: "20:00",
      fee: 2000,
    },
    r,
  );
  const id = s.store.matches[0].id;
  for (let i = 0; i < 13; i++)
    s = await command(
      owner,
      {
        type: "addParticipant",
        name: "No-account " + i,
        position: "Midfielder",
        match: id,
      },
      r,
    );
  const guest = s.store.players.find((p) => p.guest)!;
  await command(
    owner,
    { type: "linkParticipant", player: guest.id, account: captain.id },
    r,
  );
  await command(owner, { type: "rsvp", match: id, value: "going" }, r);
  const ids = (await loadClub(r)).store.players.map((p) => p.id);
  await command(owner, { type: "confirmPool", match: id, players: ids }, r);
  await assert.rejects(
    async () =>
      await command(
        owner,
        {
          type: "captains",
          match: id,
          white: owner.id,
          black: ids.find((x) => x.startsWith("guest-") && x !== guest.id),
        },
        r,
      ),
  );
  await command(
    owner,
    { type: "captains", match: id, white: owner.id, black: guest.id },
    r,
  );
  await heartbeat(
    owner,
    digest(await login(owner.email, "test password 12345")),
    id,
    false,
    r,
  );
  await heartbeat(
    captain,
    digest(await login(captain.email, "test password 12345")),
    id,
    false,
    r,
  );
  assert.deepEqual(await online(await loadClub(r), id), [true, true]);
  await command(owner, { type: "ready", match: id, generation: 0 }, r);
  s = await command(captain, { type: "ready", match: id, generation: 0 }, r);
  assert.equal(s.drafts[id].state, "active");
});

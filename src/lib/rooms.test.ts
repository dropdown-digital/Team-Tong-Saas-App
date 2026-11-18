import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, account, loadClub, type Account } from "./server/database";
import { register, login, digest } from "./server/auth";
import {
  roomCommand,
  roomList,
  roomInfo,
  invitation,
  roomActor,
} from "./server/rooms";
import { command, snapshot, heartbeat } from "./server/service";
import { consumeEmail, sendAccountEmail } from "./server/email";
import { score, stats } from "./domain";
import { updateProfile } from "./server/profiles";
import { safeImage } from "./server/images";
const dir = mkdtempSync(join(tmpdir(), "tong-rooms-"));
process.env.TEAM_TONG_DB = join(dir, "test.sqlite");
after(() => {
  db().close();
  rmSync(dir, { recursive: true, force: true });
});
async function user(i: number) {
  await register(`room${i}@example.test`, "test password 12345", `Player ${i}`);
  const u = (await db()
    .prepare("SELECT * FROM accounts WHERE email=?")
    .get(`room${i}@example.test`)) as Account;
  await db()
    .prepare("UPDATE accounts SET email_verified=1 WHERE id=?")
    .run(u.id);
  return (await account(u.id))!;
}
async function create(u: Account) {
  return (await roomCommand(u, { type: "roomCreate", name: "Same name" }))
    .roomId!;
}
async function joinRoom(u: Account, owner: Account, room: string) {
  await roomCommand(u, {
    type: "roomJoin",
    code: (await roomInfo(owner, room)).code,
  });
  await roomCommand(
    owner,
    { type: "roomDecide", user: u.id, approve: true },
    room,
  );
}
test("private rooms isolate roles, requests, matches, presence, ballots, profiles and ownership", async () => {
  const a = await user(0),
    b = await user(1),
    c = await user(2),
    r1 = await create(a),
    r2 = await create(b);
  assert.notEqual(r1, r2);
  assert.equal((await roomList(a)).length, 1);
  assert.match((await roomInfo(a, r1)).code!, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.deepEqual(
    Object.keys(await invitation((await roomInfo(a, r1)).code)).sort(),
    ["logo", "name"],
  );
  await assert.rejects(async () => await snapshot(a, r2));
  await assert.rejects(
    async () =>
      await command(
        a,
        {
          type: "create",
          venue: "No",
          date: "2026-11-01",
          time: "20:00",
          fee: 100,
        },
        r2,
      ),
  );
  const code = (await roomInfo(a, r1)).code!;
  await roomCommand(c, { type: "roomJoin", code });
  await roomCommand(c, { type: "roomJoin", code });
  assert.equal((await roomList(c)).length, 1);
  await assert.rejects(async () => await snapshot(c, r1));
  await roomCommand(a, { type: "roomCode" }, r1);
  await assert.rejects(async () => await invitation(code));
  assert.equal(
    ((await roomList(c))[0] as { status: string }).status,
    "pending",
  );
  await assert.rejects(
    async () =>
      await roomCommand(
        b,
        { type: "roomDecide", user: c.id, approve: true },
        r2,
      ),
  );
  await roomCommand(a, { type: "roomBulk", approve: true, users: [c.id] }, r1);
  assert.equal((await roomActor(c, r1)).role, "member");
  await assert.rejects(
    async () =>
      await command(
        c,
        {
          type: "create",
          venue: "No",
          date: "2026-11-01",
          time: "20:00",
          fee: 10,
        },
        r1,
      ),
  );
  await joinRoom(a, b, r2);
  assert.equal((await roomActor(a, r1)).role, "organizer");
  assert.equal((await roomActor(a, r2)).role, "member");
  const s = await command(
      a,
      {
        type: "create",
        venue: "Private turf",
        date: "2026-11-01",
        time: "20:00",
        fee: 1200,
      },
      r1,
    ),
    m = s.store.matches[0];
  assert.equal((await snapshot(b, r2)).store.matches.length, 0);
  await assert.rejects(
    async () =>
      await command(b, { type: "rsvp", match: m.id, value: "going" }, r2),
  );
  await assert.rejects(
    async () =>
      await heartbeat(
        b,
        digest(await login(b.email, "test password 12345")),
        m.id,
        false,
        r2,
      ),
  );
  await roomCommand(a, { type: "roomRole", user: c.id, organizer: true }, r1);
  await assert.rejects(
    async () =>
      await roomCommand(
        c,
        { type: "roomRole", user: a.id, organizer: false },
        r1,
      ),
  );
  await assert.rejects(
    async () =>
      await roomCommand(
        a,
        { type: "roomRole", user: a.id, organizer: false },
        r1,
      ),
  );
  await roomCommand(a, { type: "roomTransfer", user: c.id }, r1);
  assert.equal((await roomInfo(a, r1)).owner, a.id);
  await assert.rejects(
    async () =>
      await roomCommand(a, { type: "roomTransferReply", accept: true }, r1),
  );
  await roomCommand(c, { type: "roomTransferReply", accept: false }, r1);
  assert.equal((await roomInfo(a, r1)).owner, a.id);
  await roomCommand(a, { type: "roomTransfer", user: c.id }, r1);
  await roomCommand(c, { type: "roomTransferReply", accept: true }, r1);
  assert.equal((await roomInfo(c, r1)).owner, c.id);
  assert.equal((await roomActor(a, r1)).role, "organizer");
  await assert.rejects(
    async () =>
      await roomCommand(a, { type: "roomArchive", archived: true }, r1),
  );
  await roomCommand(c, { type: "roomArchive", archived: true }, r1);
  await assert.rejects(async () => await snapshot(a, r1));
  await roomCommand(c, { type: "roomArchive", archived: false }, r1);
  assert.equal((await snapshot(a, r1)).store.matches[0].id, m.id);
  await updateProfile(a, {
    name: "Updated Player",
    username: "player",
    position: "Forward",
    number: 9,
  });
  assert.equal(
    (await snapshot(c, r1)).store.players.find((p) => p.id === a.id)?.name,
    "Updated Player",
  );
  assert.equal(
    (await snapshot(b, r2)).store.players.find((p) => p.id === a.id)?.name,
    "Updated Player",
  );
});
test("room draft confirmation, repeat rotations, frozen eligibility, private complete ballots and optional own goals", async () => {
  const owner = await user(10),
    r = await create(owner),
    users = [
      owner,
      ...(await Promise.all(
        Array.from({ length: 15 }, async (_, i) => await user(i + 11)),
      )),
    ];
  for (const u of users.slice(1)) await joinRoom(u, owner, r);
  let s = await command(
    owner,
    {
      type: "create",
      venue: "QA Turf",
      date: "2026-11-02",
      time: "21:00",
      fee: 2000,
    },
    r,
  );
  const id = s.store.matches[0].id;
  for (const u of users)
    await command(u, { type: "rsvp", match: id, value: "going" }, r);
  await assert.rejects(
    async () =>
      await command(
        owner,
        { type: "captains", match: id, white: users[0].id, black: users[1].id },
        r,
      ),
  );
  await command(
    owner,
    { type: "confirmPool", match: id, players: users.map((u) => u.id) },
    r,
  );
  s = await command(
    owner,
    { type: "captains", match: id, white: users[0].id, black: users[1].id },
    r,
  );
  const tokens = await Promise.all(
    users
      .slice(0, 2)
      .map(async (u) => digest(await login(u.email, "test password 12345"))),
  );
  for (const [i, u] of users.slice(0, 2).entries())
    await heartbeat(u, tokens[i], id, false, r);
  await command(users[0], { type: "ready", match: id, generation: 0 }, r);
  s = await command(users[1], { type: "ready", match: id, generation: 0 }, r);
  let d = s.drafts[id];
  const picked = users[2].id;
  s = await command(
    users[d.turn],
    { type: "pick", match: id, player: picked, picks: 0 },
    r,
  );
  await assert.rejects(
    async () =>
      await command(
        owner,
        { type: "replace", match: id, side: 0, player: users[3].id },
        r,
      ),
  );
  while (s.drafts[id].state !== "complete") {
    d = s.drafts[id];
    const player = d.pool.find(
      (p) => !s.store.matches[0].teams.flat().includes(p),
    )!;
    s = await command(
      users.find((u) => u.id === d.captains[d.turn])!,
      { type: "pick", match: id, player, picks: d.picks.length },
      r,
    );
  }
  s = await command(owner, { type: "start", match: id }, r);
  let m = s.store.matches[0];
  const off = m.active[0][0],
    on = m.teams[0][7];
  await command(
    owner,
    { type: "rotate", match: id, side: 0, off, on, minute: 5 },
    r,
  );
  await command(
    owner,
    { type: "rotate", match: id, side: 0, off: on, on: off, minute: 10 },
    r,
  );
  await command(
    owner,
    {
      type: "goal",
      match: id,
      scorer: off,
      assist: "",
      minute: null,
      ownGoal: true,
      assistStatus: "unknown",
    },
    r,
  );
  s = await command(owner, { type: "finish", match: id }, r);
  assert.equal(s.store.matches[0].voting, false);
  await command(
    owner,
    { type: "confirmPlayed", match: id, players: users.map((u) => u.id) },
    r,
  );
  await command(
    owner,
    {
      type: "openVoting",
      match: id,
      deadline: new Date(Date.now() + 3600000).toISOString(),
    },
    r,
  );
  await assert.rejects(
    async () =>
      await command(
        owner,
        {
          type: "confirmPlayed",
          match: id,
          players: users.slice(0, 4).map((u) => u.id),
        },
        r,
      ),
  );
  await assert.rejects(
    async () => await command(owner, { type: "submit", match: id }, r),
  );
  await assert.rejects(
    async () =>
      await command(
        owner,
        { type: "voteDraft", match: id, target: owner.id, value: 8 },
        r,
      ),
  );
  for (const voter of users.slice(0, 4)) {
    for (const target of users.filter((u) => u.id !== voter.id))
      await command(
        voter,
        { type: "voteDraft", match: id, target: target.id, value: 8 },
        r,
      );
    await command(voter, { type: "submit", match: id }, r);
  }
  const hidden = (await snapshot(users[4], r)).store.matches[0],
    visible = (await snapshot(owner, r)).store.matches[0];
  assert.equal(hidden.results, undefined);
  assert.deepEqual(hidden.votes, []);
  assert.equal(visible.results?.[owner.id].count, 3);
  assert.equal(visible.results?.[owner.id].average, 8);
  assert.equal(Object.keys(visible.ballots!).length, 1);
  assert.equal(visible.submittedBy?.length, 4);
  await assert.rejects(
    async () => await command(owner, { type: "submit", match: id }, r),
  );
  await command(owner, { type: "closeVoting", match: id }, r);
  await assert.rejects(
    async () =>
      await command(
        users[4],
        { type: "voteDraft", match: id, target: owner.id, value: 7 },
        r,
      ),
  );
  m = (await loadClub(r)).store.matches[0];
  assert.equal(m.goals[0].minute, null);
  assert.equal(score(m, 1), 1);
  assert.equal(stats((await loadClub(r)).store, off).goals, 0);
});
test("email tokens verify once and reset invalidates sessions; image uploads reject unsafe types", async () => {
  const u = await user(50);
  await db()
    .prepare("UPDATE accounts SET email_verified=0 WHERE id=?")
    .run(u.id);
  await assert.rejects(async () => await create(u));
  const token = "a".repeat(64);
  await db()
    .prepare("INSERT INTO email_tokens VALUES(?,?,?,?)")
    .run(digest(token), u.id, "verify", Date.now() + 10000);
  await consumeEmail("verify", token);
  assert.equal((await account(u.id))!.email_verified, 1);
  await assert.rejects(async () => await consumeEmail("verify", token));
  const session = await login(u.email, "test password 12345");
  await db()
    .prepare("INSERT INTO email_tokens VALUES(?,?,?,?)")
    .run(digest(token), u.id, "reset", Date.now() + 10000);
  await consumeEmail("reset", token, "new password 123456");
  assert.equal(
    await db()
      .prepare("SELECT 1 FROM sessions WHERE token=?")
      .get(digest(session)),
    undefined,
  );
  await assert.rejects(async () => await login(u.email, "test password 12345"));
  assert.ok(await login(u.email, "new password 123456"));
  await assert.rejects(() => safeImage("data:image/svg+xml;base64,PHN2Zz4="));
  await assert.rejects(() => safeImage("data:image/png;base64,notanimage"));
  delete process.env.RESEND_API_KEY;
  await assert.rejects(
    () => sendAccountEmail("verify", u.email, u),
    /not configured/,
  );
});

test("room creation retries are idempotent and email delivery uses expiring one-use tokens", async () => {
  const u = await user(60),
    requestId = "8c71abb9-b90f-47bb-ad7b-46c41b046075";
  const a = await roomCommand(u, {
    type: "roomCreate",
    name: "Retry safe",
    requestId,
  });
  const b = await roomCommand(u, {
    type: "roomCreate",
    name: "Retry safe",
    requestId,
  });
  assert.equal(a.roomId, b.roomId);
  assert.equal((await roomList(u)).length, 1);
  const original = global.fetch;
  let sent = "";
  process.env.RESEND_API_KEY = "test-only";
  process.env.TEAM_TONG_MAIL_FROM = "Team Tong <test@example.test>";
  process.env.TEAM_TONG_ORIGIN = "http://127.0.0.1:3000";
  global.fetch = async (_url, options) => {
    sent = String(options?.body);
    return new Response('{"id":"test-email"}', { status: 200 });
  };
  try {
    await sendAccountEmail("verify", u.email, u);
    const body = JSON.parse(sent);
    assert.deepEqual(body.to, [u.email]);
    const token = body.text.match(/#verify=([a-f0-9]{64})/)[1];
    assert.ok(
      await db()
        .prepare("SELECT 1 FROM email_tokens WHERE token=?")
        .get(digest(token)),
    );
    assert.equal(
      await db().prepare("SELECT 1 FROM email_tokens WHERE token=?").get(token),
      undefined,
    );
    await consumeEmail("verify", token);
    await assert.rejects(async () => await consumeEmail("verify", token));
  } finally {
    global.fetch = original;
    delete process.env.RESEND_API_KEY;
    delete process.env.TEAM_TONG_MAIL_FROM;
    delete process.env.TEAM_TONG_ORIGIN;
  }
});

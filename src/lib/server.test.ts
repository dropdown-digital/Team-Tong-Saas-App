import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { db, loadClub, saveClub, type Account } from "./server/database";
import {
  register,
  login,
  checkPassword,
  hashPassword,
  digest,
} from "./server/auth";
import { command, heartbeat, snapshot } from "./server/service";
const folder = mkdtempSync(path.join(tmpdir(), "team-tong-test-"));
process.env.TEAM_TONG_DB = path.join(folder, "test.sqlite");
after(() => {
  db().close();
  rmSync(folder, { recursive: true, force: true });
});
test("real accounts, approval, live synchronization, server permissions and private ballots", async () => {
  const hash = hashPassword("test-password-123");
  assert.equal(checkPassword("test-password-123", hash), true);
  assert.equal(checkPassword("wrong", hash), false);
  await register("organizer@example.test", "test-password-123", "Organizer");
  const organizer = (await db()
    .prepare("SELECT * FROM accounts WHERE email=?")
    .get("organizer@example.test")) as Account;
  assert.equal(organizer.status, "pending");
  await assert.rejects(
    async () =>
      await command(organizer, {
        type: "create",
        venue: "Turf",
        date: "2026-11-01",
        time: "20:30",
        fee: 6000,
      }),
  );
  await db()
    .prepare(
      "UPDATE accounts SET status='approved',role='organizer' WHERE id=?",
    )
    .run(organizer.id);
  organizer.status = "approved";
  organizer.role = "organizer";
  const data = await loadClub();
  data.store.players.push({
    id: organizer.id,
    name: organizer.name,
    number: 1,
    position: "Midfielder",
  });
  await saveClub(data);
  const members: Account[] = [];
  for (let i = 0; i < 18; i++) {
    await register(
      `player${i}@example.test`,
      "test-password-123",
      `Player ${i}`,
    );
    const member = (await db()
      .prepare("SELECT * FROM accounts WHERE email=?")
      .get(`player${i}@example.test`)) as Account;
    assert.equal(member.status, "pending");
    await command(organizer, { type: "approve", user: member.id });
    member.status = "approved";
    members.push(member);
  }
  await assert.rejects(
    async () =>
      await command(members[0], { type: "approve", user: members[1].id }),
  );
  await command(organizer, {
    type: "create",
    venue: "Test turf",
    date: "2026-11-01",
    time: "20:30",
    fee: 6000,
  });
  const id = (await loadClub()).store.matches[0].id;
  for (const member of members)
    await command(member, { type: "rsvp", match: id, value: "going" });
  await command(organizer, {
    type: "captains",
    match: id,
    white: members[0].id,
    black: members[1].id,
  });
  await assert.rejects(
    async () =>
      await command(members[0], { type: "ready", match: id, generation: 0 }),
  );
  const a = digest(await login(members[0].email, "test-password-123")),
    b = digest(await login(members[1].email, "test-password-123"));
  await heartbeat(members[0], a, id);
  await heartbeat(members[1], b, id);
  await command(members[0], { type: "ready", match: id, generation: 0 });
  await command(members[1], { type: "ready", match: id, generation: 0 });
  let state = await loadClub(),
    draft = state.drafts[id],
    m = state.store.matches[0];
  const first = draft.first;
  const captain = members.find((p) => p.id === draft.captains[draft.turn])!;
  await command(captain, {
    type: "pick",
    match: id,
    player: members[2].id,
    picks: 0,
  });
  await assert.rejects(
    async () =>
      await command(captain, {
        type: "pick",
        match: id,
        player: members[3].id,
        picks: 0,
      }),
  );
  await heartbeat(members[0], a, id, true);
  state = await loadClub();
  assert.equal(state.drafts[id].state, "paused");
  await assert.rejects(
    async () =>
      await command(members[1], {
        type: "pick",
        match: id,
        player: members[3].id,
        picks: 1,
      }),
  );
  await heartbeat(members[0], a, id);
  const generation = (await loadClub()).drafts[id].generation;
  await command(members[0], { type: "ready", match: id, generation });
  await command(members[1], { type: "ready", match: id, generation });
  assert.equal((await loadClub()).drafts[id].first, first);
  while ((await loadClub()).drafts[id].state !== "complete") {
    state = await loadClub();
    draft = state.drafts[id];
    m = state.store.matches[0];
    await command(
      members.find((p) => p.id === draft.captains[draft.turn])!,
      {
        type: "pick",
        match: id,
        player: draft.pool.find((p) => !m.teams.flat().includes(p)),
        picks: draft.picks.length,
      },
    );
  }
  const spectator = await snapshot(members[5]);
  assert.deepEqual(
    spectator.store.matches[0].teams,
    (await loadClub()).store.matches[0].teams,
  );
  await assert.rejects(
    async () =>
      await command(members[0], {
        type: "score",
        match: id,
        white: 3,
        black: 2,
      }),
  );
  await command(organizer, { type: "start", match: id });
  await command(organizer, { type: "minutes", match: id, minutes: 10 });
  state = await loadClub();
  m = state.store.matches[0];
  const off = m.active[0][0],
    on = m.teams[0].find((id) => !m.active[0].includes(id))!;
  await command(organizer, {
    type: "rotate",
    match: id,
    side: 0,
    off,
    on,
    minute: 10,
  });
  await command(organizer, { type: "minutes", match: id, minutes: 5 });
  await command(organizer, {
    type: "rotate",
    match: id,
    side: 0,
    off: on,
    on: off,
    minute: 15,
  });
  await command(organizer, { type: "finish", match: id });
  await command(organizer, {
    type: "goal",
    match: id,
    scorer: off,
    assist: "",
    minute: 5,
  });
  const g = (await loadClub()).store.matches[0].goals[0];
  await command(organizer, {
    type: "goal",
    match: id,
    id: g.id,
    scorer: off,
    assist: "",
    minute: 6,
  });
  assert.equal((await loadClub()).store.matches[0].goals[0].minute, 6);
  await command(organizer, { type: "score", match: id, white: 3, black: 2 });
  const before = (await loadClub()).store.matches[0];
  const voters = members
    .filter((p) => before.played!.includes(p.id))
    .slice(0, 4);
  for (const voter of voters) {
    for (const target of before.played!.filter((id) => id !== voter.id))
      await command(voter, { type: "voteDraft", match: id, target, value: 8 });
    await command(voter, { type: "submit", match: id });
    await assert.rejects(
      async () =>
        await command(voter, {
          type: "voteDraft",
          match: id,
          target: before.played!.find((id) => id !== voter.id),
          value: 7,
        }),
    );
  }
  const visible = (await snapshot(voters[0])).store.matches[0];
  assert.deepEqual(visible.votes, []);
  assert.ok(visible.results);
  assert.equal(Object.keys(visible.ballots!).length, 1);
  assert.ok(Object.values(visible.results!).every((r) => r.average === 8));
  const hidden = (await snapshot(organizer)).store.matches[0];
  assert.equal(hidden.results, undefined);
  assert.deepEqual(hidden.votes, []);
  assert.deepEqual(hidden.drafts, {});
  assert.deepEqual(hidden.ballots, {});
  const ballots = JSON.stringify((await loadClub()).store.matches[0].votes);
  await command(organizer, { type: "score", match: id, white: 5, black: 4 });
  assert.equal(
    JSON.stringify((await loadClub()).store.matches[0].votes),
    ballots,
  );
});

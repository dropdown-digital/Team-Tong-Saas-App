import { test } from "node:test";
import assert from "node:assert/strict";
import {
  seed,
  balance,
  rotate,
  addGoal,
  vote,
  rating,
  stats,
  score,
  storeSchema,
} from "./domain";
test("18 attendees form unique 9-person teams with 7 active each", () => {
  const s = seed(),
    m = s.matches[0];
  balance(m, s);
  assert.deepEqual(
    m.teams.map((t) => t.length),
    [9, 9],
  );
  assert.deepEqual(
    m.active.map((t) => t.length),
    [7, 7],
  );
  assert.equal(new Set(m.teams.flat()).size, 18);
});
test("rotations preserve total minutes and stop at duration", () => {
  const m = seed().matches[0];
  m.duration = 65;
  m.status = "live";
  for (let i = 0; i < 20; i++) rotate(m);
  assert.equal(m.elapsed, 65);
  assert.equal(
    Object.values(m.minutes).reduce((a, b) => a + b, 0),
    65 * 14,
  );
  assert.ok(m.teams.flat().every((id) => m.minutes[id] > 0));
  assert.deepEqual(
    m.active.map((t) => t.length),
    [7, 7],
  );
});
test("goals validate assister and drive profile totals", () => {
  const s = seed(),
    m = s.matches[0];
  m.status = "live";
  const [a, b] = m.teams[0];
  assert.throws(() => addGoal(m, a, a, 1));
  assert.throws(() => addGoal(m, a, m.teams[1][0], 1));
  assert.throws(() => addGoal(m, a, "", 71));
  const old = stats(s, a).goals;
  addGoal(m, a, b, 5);
  assert.equal(score(m, 0), 1);
  m.status = "completed";
  m.played = [a, b];
  assert.equal(stats(s, a).goals, old + 1);
});
test("votes enforce participation, uniqueness and privacy threshold", () => {
  const m = seed().matches[0];
  m.status = "completed";
  m.played = m.teams.flat();
  m.voting = true;
  const [target, ...voters] = m.teams.flat();
  assert.throws(() => vote(m, target, target, 8));
  assert.throws(() => vote(m, "outsider", target, 8));
  assert.throws(() => vote(m, voters[0], target, 8.2));
  voters.slice(0, 3).forEach((v) => vote(m, v, target, 8));
  vote(m, voters[0], target, 9);
  assert.equal(m.votes.length, 3);
  assert.equal(rating(m, target), null);
  m.voting = false;
  assert.equal(rating(m, target), 25 / 3);
  assert.throws(() => vote(m, voters[0], target, 7));
});
test("seed is schema valid and completed minutes reconcile", () => {
  const s = storeSchema.parse(seed());
  for (const m of s.matches.filter((m) => m.status === "completed"))
    assert.equal(
      Object.values(m.minutes).reduce((a, b) => a + b, 0),
      m.duration * 14,
    );
});

test("all supported formations contain seven separated positions including a goalkeeper", async () => {
  const { FORMATIONS } = await import("./lineup");
  for (const slots of Object.values(FORMATIONS)) {
    assert.equal(slots.length, 7);
    assert.equal(slots[0].label, "GK");
    assert.equal(new Set(slots.map((s) => `${s.x}:${s.y}`)).size, 7);
    assert.ok(
      slots.every((s) => s.x >= 15 && s.x <= 85 && s.y >= 10 && s.y <= 90),
    );
  }
});
test("kickoff snapshot stays unchanged and an outgoing player can return", async () => {
  const { startMatch, substitute, logMinutes, participants } =
    await import("./domain");
  const m = seed().matches[0];
  startMatch(m);
  const kickoff = structuredClone(m.kickoff);
  const off = m.active[0][1],
    on = m.teams[0].find((id) => !m.active[0].includes(id))!;
  logMinutes(m, 10);
  substitute(m, 0, off, on);
  logMinutes(m, 10);
  substitute(m, 0, on, off);
  assert.deepEqual(m.kickoff, kickoff);
  assert.ok(m.active[0].includes(off));
  assert.equal(m.rotations?.length, 2);
  assert.deepEqual(
    m.rotations?.map((r) => r.minute),
    [10, 20],
  );
  assert.equal(m.minutes[off], 10);
  assert.equal(m.minutes[on], 10);
  assert.ok(participants(m).includes(on));
  assert.equal(m.teams.flat().length, 18);
  assert.throws(() => substitute(m, 0, off, m.active[0][0]));
});
test("deadline closes votes automatically and preserves the public arithmetic mean", async () => {
  const { startMatch, finishMatch, votingIsOpen } = await import("./domain");
  const m = seed().matches[0];
  startMatch(m);
  finishMatch(m, 1000);
  const [target, ...voters] = m.played!;
  for (const v of voters.slice(0, 3)) vote(m, v, target, 8, 2000);
  assert.equal(rating(m, target, 2000), null);
  const deadline = Date.parse(m.votingDeadline!);
  assert.equal(votingIsOpen(m, deadline), false);
  assert.equal(rating(m, target, deadline), 8);
  assert.throws(() => vote(m, voters[0], target, 9, deadline));
});
test("self, outsider, unplayed, NaN and duplicate votes are handled", async () => {
  const { startMatch, finishMatch } = await import("./domain");
  const m = seed().matches[0];
  startMatch(m);
  finishMatch(m);
  const [target, voter] = m.played!;
  const unplayed = m.teams.flat().find((id) => !m.played!.includes(id))!;
  assert.throws(() => vote(m, target, target, 7));
  assert.throws(() => vote(m, "p22", target, 7));
  assert.throws(() => vote(m, unplayed, target, 7));
  assert.throws(() => vote(m, voter, unplayed, 7));
  assert.throws(() => vote(m, voter, target, NaN));
  vote(m, voter, target, 7);
  vote(m, voter, target, 8.5);
  assert.equal(m.votes.length, 1);
  assert.equal(m.votes[0].value, 8.5);
});
test("exact tied means share Player of the Match and two votes never qualify", async () => {
  const { playerOfMatch } = await import("./domain");
  const m = seed().matches[0];
  m.status = "completed";
  m.played = m.teams.flat();
  for (const target of m.teams[0].slice(0, 2))
    for (const voter of m.teams[1].slice(0, 3))
      m.votes.push({ voter, target, value: 8 });
  assert.deepEqual(playerOfMatch(m), m.teams[0].slice(0, 2));
  const target = m.teams[0][2];
  m.votes.push(
    ...m.teams[1].slice(0, 2).map((voter) => ({ voter, target, value: 10 })),
  );
  assert.equal(rating(m, target), null);
  assert.equal(playerOfMatch(m).length, 2);
});
test("scheduled and live matches never expose rating badges", () => {
  const m = seed().matches[1];
  const id = m.teams[0][0];
  m.status = "scheduled";
  assert.equal(rating(m, id), null);
  m.status = "live";
  assert.equal(rating(m, id), null);
});
test("position selection swaps rather than duplicates players", async () => {
  const { setSlot } = await import("./lineup");
  const m = seed().matches[0],
    before = [...m.active[0]];
  setSlot(m, 0, 1, before[2]);
  assert.equal(m.active[0][2], before[1]);
  assert.equal(new Set(m.active[0]).size, 7);
  m.status = "live";
  assert.throws(() => setSlot(m, 0, 1, before[2]));
});
test("cards and assists appear in chronological event data", async () => {
  const { addCard, startMatch } = await import("./domain");
  const { matchEvents, contributions } = await import("./lineup");
  const m = seed().matches[0];
  startMatch(m);
  addCard(m, m.active[0][0], "yellow", 20);
  addGoal(m, m.active[0][1], m.active[0][2], 5);
  const events = matchEvents(m);
  assert.deepEqual(
    events.map((e) => e.minute),
    [5, 20],
  );
  assert.equal(contributions(m, m.active[0][2]).assists, 1);
  assert.equal(contributions(m, m.active[0][0]).cards.length, 1);
  assert.throws(() => addCard(m, "outsider", "red", 3));
});
test("older backups remain readable without invented kickoff or rotation history", () => {
  const s = seed();
  for (const m of s.matches) {
    delete m.kickoff;
    delete m.rotations;
    delete m.formations;
    delete m.played;
    delete m.cards;
  }
  const restored = storeSchema.parse(s);
  assert.equal(restored.matches[1].kickoff, undefined);
  assert.equal(restored.matches[1].rotations, undefined);
});

test("new backup fields reject invalid kickoff and rotation participants", () => {
  const s = seed();
  s.matches[1].kickoff![0][0] = "outsider";
  assert.equal(storeSchema.safeParse(s).success, false);
  const valid = seed();
  valid.matches[1].rotations![0].on = "outsider";
  assert.equal(storeSchema.safeParse(valid).success, false);
});
test("legacy live minutes survive participation tracking upgrade", async () => {
  const { logMinutes, participants } = await import("./domain");
  const m = seed().matches[0];
  m.status = "live";
  const resting = m.teams[0].find((id) => !m.active[0].includes(id))!;
  m.minutes[resting] = 10;
  m.elapsed = 10;
  delete m.played;
  logMinutes(m, 5);
  assert.ok(participants(m).includes(resting));
});

import {
  ratingSample,
  ballotTargets,
  submitBallot,
  saveDraft,
  canSeeResults,
  communityRating,
  participants,
  validVotes,
} from "./domain";
test("complete ballots require all actual peers and lock permanently on submission", () => {
  const m = ratingSample(),
    viewer = "p1",
    targets = ballotTargets(m, viewer);
  assert.equal(targets.length, 17);
  assert.equal(canSeeResults(m, viewer), false);
  assert.equal(communityRating(m, targets[0], viewer), null);
  assert.throws(() => submitBallot(m, viewer));
  assert.throws(() => saveDraft(m, viewer, viewer, 8));
  assert.throws(() => saveDraft(m, "outsider", targets[0], 8));
  assert.throws(() => saveDraft(m, viewer, targets[0], 8.1));
  for (const id of targets) saveDraft(m, viewer, id, 7.5);
  saveDraft(m, viewer, targets[0], 9);
  const before = m.votes.length;
  submitBallot(m, viewer);
  assert.equal(m.votes.length, before + 17);
  assert.equal(canSeeResults(m, viewer), true);
  assert.equal(m.drafts?.[viewer], undefined);
  assert.throws(() => submitBallot(m, viewer));
  assert.throws(() => saveDraft(m, viewer, targets[0], 4));
  assert.throws(() => vote(m, viewer, targets[0], 4));
  m.voting = false;
  m.voting = true;
  assert.throws(() => saveDraft(m, viewer, targets[0], 4));
});
test("results reveal counts and means only after submission with three-vote minimum", () => {
  const m = ratingSample();
  m.votes = [];
  m.ballots = {};
  m.drafts = {};
  const pool = participants(m);
  for (const voter of pool.slice(0, 3)) {
    for (const id of ballotTargets(m, voter)) saveDraft(m, voter, id, 8);
    submitBallot(m, voter);
  }
  assert.equal(validVotes(m, pool[0]).length, 2);
  assert.equal(communityRating(m, pool[0], pool[0]), null);
  assert.equal(validVotes(m, pool[4]).length, 3);
  assert.equal(communityRating(m, pool[4], pool[0]), 8);
  assert.equal(communityRating(m, pool[4], pool[5]), null);
  m.voting = false;
  assert.equal(communityRating(m, pool[4], pool[0]), 8);
  assert.equal(communityRating(m, pool[4], pool[5]), null);
});
test("deadline expiry rejects whole ballot without partial writes", () => {
  const m = ratingSample();
  for (const id of ballotTargets(m, "p1")) saveDraft(m, "p1", id, 8);
  const before = JSON.stringify(m.votes);
  assert.throws(() => submitBallot(m, "p1", Date.parse(m.votingDeadline!)));
  assert.equal(JSON.stringify(m.votes), before);
  assert.equal(canSeeResults(m, "p1"), false);
});
test("legacy actual participation uses recorded minutes and complete ballots survive backup", () => {
  const m = ratingSample();
  const s = seed();
  s.matches = [m];
  assert.equal(
    storeSchema.safeParse(JSON.parse(JSON.stringify(s))).success,
    true,
  );
  const voter = Object.keys(m.ballots!)[0];
  m.votes = m.votes.filter((v) => v.voter !== voter);
  assert.equal(storeSchema.safeParse(s).success, false);
  const legacy = seed().matches[1];
  delete legacy.played;
  legacy.minutes[legacy.teams[0][0]] = 0;
  assert.equal(participants(legacy).includes(legacy.teams[0][0]), false);
});

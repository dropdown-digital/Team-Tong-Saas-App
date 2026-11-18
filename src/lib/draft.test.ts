import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./domain";
import {
  createDraft,
  pickPlayer,
  readyCaptain,
  reconcilePresence,
  replaceCaptain,
} from "./draft";
for (const count of [16, 18, 20])
  test(`${count} participants draft equally, including captains, with 7 active`, () => {
    const m = fixture("draft");
    for (let i = 0; i < count; i++) m.attendance["p" + i] = "going";
    const d = createDraft(m, ["p0", "p1"]);
    let tosses = 0;
    readyCaptain(d, "p0", [true, true], 0, () => {
      tosses++;
      return 1;
    });
    assert.equal(d.first, null);
    readyCaptain(d, "p1", [true, true], 0, () => {
      tosses++;
      return 1;
    });
    assert.equal(d.turn, 1);
    assert.throws(() => pickPlayer(m, d, "p0", "p2", [true, true], 0));
    while (d.state !== "complete") {
      const id = d.pool.find((id) => !m.teams.flat().includes(id))!;
      pickPlayer(m, d, d.captains[d.turn], id, [true, true], d.picks.length);
    }
    assert.equal(tosses, 1);
    assert.deepEqual(
      m.teams.map((t) => t.length),
      [count / 2, count / 2],
    );
    assert.deepEqual(
      m.active.map((t) => t.length),
      [7, 7],
    );
    assert.equal(new Set(m.teams.flat()).size, count);
  });
test("disconnect pauses both sides and readiness never rerolls original toss", () => {
  const m = fixture("draft");
  for (let i = 0; i < 18; i++) m.attendance["p" + i] = "going";
  const d = createDraft(m, ["p0", "p1"]);
  readyCaptain(d, "p0", [true, true], 0, () => 0);
  readyCaptain(d, "p1", [true, true], 0, () => 0);
  pickPlayer(m, d, "p0", "p2", [true, true], 0);
  const saved = JSON.stringify(d.picks),
    turn = d.turn;
  reconcilePresence(d, [true, false]);
  assert.equal(d.state, "paused");
  assert.deepEqual(d.ready, [false, false]);
  assert.throws(() => pickPlayer(m, d, "p1", "p3", [true, true], 1));
  assert.throws(() => readyCaptain(d, "p1", [true, true], 0, () => 1));
  readyCaptain(d, "p0", [true, true], d.generation, () => {
    throw Error("Must not toss twice");
  });
  readyCaptain(d, "p1", [true, true], d.generation, () => {
    throw Error("Must not toss twice");
  });
  assert.equal(d.first, 0);
  assert.equal(d.turn, turn);
  assert.equal(JSON.stringify(d.picks), saved);
  replaceCaptain(m, d, 1, "p3");
  assert.equal(d.captains[1], "p3");
  assert.equal(d.turn, turn);
  assert.equal(d.tossCaptain, "p0");
  assert.equal(JSON.stringify(d.picks), saved);
  assert.equal(m.teams[1][0], "p3");
  assert.equal(m.teams.flat().includes("p1"), false);
  assert.throws(() =>
    readyCaptain(d, "p1", [true, true], d.generation, () => 0),
  );
});

test("replacement cannot move a drafted opponent or erase previous picks", () => {
  const m = fixture("draft");
  for (let i = 0; i < 16; i++) m.attendance["p" + i] = "going";
  const d = createDraft(m, ["p0", "p1"]);
  readyCaptain(d, "p0", [true, true], 0, () => 0);
  readyCaptain(d, "p1", [true, true], 0, () => 0);
  pickPlayer(m, d, "p0", "p2", [true, true], 0);
  pickPlayer(m, d, "p1", "p3", [true, true], 1);
  assert.throws(() => replaceCaptain(m, d, 0, "p3"));
  const picks = JSON.stringify(d.picks);
  replaceCaptain(m, d, 0, "p2");
  assert.equal(JSON.stringify(d.picks), picks);
  assert.equal(d.turn, 0);
  assert.equal(d.first, 0);
  assert.equal(d.tossCaptain, "p0");
  assert.deepEqual(m.teams[0], ["p0", "p2"]);
});

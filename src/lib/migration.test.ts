import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { db, loadClub } from "./server/sqlite";
import { fixture } from "./domain";
test("additive migration preserves the exact legacy payload, accounts, locked ballots and snapshot backup", () => {
  const dir = mkdtempSync(join(tmpdir(), "tong-migration-"));
  process.env.TEAM_TONG_DB = join(dir, "old.sqlite");
  const old = new DatabaseSync(process.env.TEAM_TONG_DB);
  old.exec(
    "CREATE TABLE accounts(id TEXT PRIMARY KEY,email TEXT UNIQUE,name TEXT,password TEXT,role TEXT,status TEXT);CREATE TABLE club(id INTEGER PRIMARY KEY,payload TEXT);",
  );
  old
    .prepare("INSERT INTO accounts VALUES(?,?,?,?,?,?)")
    .run(
      "owner",
      "owner@example.test",
      "Owner",
      "unchanged-password-hash",
      "organizer",
      "approved",
    );
  const m = fixture("old-match");
  m.ballots = { owner: "2026-01-01T00:00:00.000Z" };
  const payload = JSON.stringify({
    store: {
      version: 1,
      club: "Team Tong",
      viewer: "owner",
      players: [],
      matches: [m],
    },
    drafts: {},
    revision: 9,
  });
  old.prepare("INSERT INTO club VALUES(1,?)").run(payload);
  old.close();
  const sql = db(),
    r = sql.prepare("SELECT * FROM rooms").get() as {
      id: string;
      owner: string;
      payload: string;
    };
  assert.equal(r.owner, "owner");
  assert.equal(r.payload, payload);
  assert.equal(
    (sql.prepare("SELECT payload FROM club").get() as { payload: string })
      .payload,
    payload,
  );
  assert.equal(loadClub(r.id).store.matches[0].ballots?.owner, m.ballots.owner);
  assert.equal(
    (sql.prepare("SELECT password FROM accounts").get() as { password: string })
      .password,
    "unchanged-password-hash",
  );
  assert.equal(
    (sql.prepare("SELECT count(*) n FROM rooms").get() as { n: number }).n,
    1,
  );
  assert.equal(
    readdirSync(dir).filter((f) => f.includes("before-rooms")).length,
    1,
  );
  sql.close();
  rmSync(dir, { recursive: true, force: true });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import {
  setPostgresPoolForTests,
  db,
  loadClub,
  postgresSql,
} from "./server/database";
import { register, hashPassword } from "./server/auth";
import { bindIdentity } from "./server/supabase-auth";
import { roomCommand, roomInfo } from "./server/rooms";
import { command, snapshot, heartbeat } from "./server/service";
import { enterGuest, guestView } from "./server/guests";
import { randomUUID } from "node:crypto";

test("PostgreSQL migration, room RLS, verified account claims, concurrent draft turns and locked anonymous ballots", async () => {
  Object.assign(process.env, {
    NODE_ENV: "test",
    TEAM_TONG_BACKEND: "supabase",
  });
  const pg = new PGlite();
  await pg.exec(
    `CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`,
  );
  const migration = readFileSync(
    "supabase/migrations/001_team_tong.sql",
    "utf8",
  );
  await pg.exec(migration);
  await pg.exec(migration); // additive, repeatable installation
  let queue = Promise.resolve();
  const locks: string[] = [];
  setPostgresPoolForTests({
    connect: async () => {
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((r) => (release = r));
      await previous;
      return {
        query: async (sql: string, args: unknown[] = []) => {
          if (sql.includes("pg_advisory_xact_lock")) {
            locks.push(sql);
            return { rows: [], rowCount: 1 };
          }
          const r = await pg.query(sql, args);
          return { rows: r.rows, rowCount: r.affectedRows };
        },
        release,
      };
    },
  } as unknown as Pool);
  try {
    assert.equal(
      postgresSql("SELECT '?' WHERE id=? AND name='what?'"),
      "SELECT '?' WHERE id=$1 AND name='what?'",
    );
    const oldId = randomUUID(),
      authId = randomUUID();
    await pg.query("INSERT INTO auth.users VALUES($1)", [authId]);
    await db()
      .prepare("INSERT INTO accounts VALUES(?,?,?,?,'organizer','approved',0)")
      .run(
        oldId,
        "old@example.test",
        "Old Captain",
        hashPassword("previous password 123"),
      );
    const identity = {
      id: authId,
      email: "old@example.test",
      email_confirmed_at: new Date().toISOString(),
      user_metadata: { name: "New name" },
    };
    await assert.rejects(
      () =>
        bindIdentity(
          { ...identity, email_confirmed_at: undefined },
          "previous password 123",
        ),
      /Confirm/,
    );
    await assert.rejects(
      () => bindIdentity(identity, "wrong password"),
      /previous Team Tong password/,
    );
    const owner = await bindIdentity(identity, "previous password 123");
    assert.equal(owner.id, oldId);
    assert.equal(owner.name, "Old Captain");
    assert.equal((await bindIdentity(identity)).id, oldId);
    const r = (
      await roomCommand(owner, { type: "roomCreate", name: "Postgres room" })
    ).roomId!;
    const users = [owner];
    for (let i = 1; i < 16; i++) {
      await register(
        `pg${i}@example.test`,
        "test password 12345",
        `Player ${i}`,
      );
      const u = (await db()
        .prepare("SELECT * FROM accounts WHERE email=?")
        .get(`pg${i}@example.test`)) as typeof owner;
      await db()
        .prepare("UPDATE accounts SET email_verified=1 WHERE id=?")
        .run(u.id);
      await roomCommand(u, {
        type: "roomJoin",
        code: (await roomInfo(owner, r)).code,
      });
      await roomCommand(
        owner,
        { type: "roomDecide", user: u.id, approve: true },
        r,
      );
      users.push(u);
    }
    const outsiderId = randomUUID();
    await pg.query("INSERT INTO auth.users VALUES($1)", [outsiderId]);
    const outsider = await bindIdentity({
      id: outsiderId,
      email: "outside@example.test",
      email_confirmed_at: new Date().toISOString(),
      user_metadata: {},
    });
    await assert.rejects(() => snapshot(outsider, r), /unavailable/);
    // Browser SELECT returns only its approved room's safe revision. Private data is inaccessible.
    await pg.exec("SET ROLE authenticated");
    await pg.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
      authId,
    ]);
    assert.equal(
      (await pg.query("SELECT * FROM public.team_tong_room_activity")).rows
        .length,
      1,
    );
    await assert.rejects(
      () => pg.query("SELECT payload FROM team_tong.rooms"),
      /permission denied/,
    );
    await assert.rejects(
      () => pg.query("UPDATE public.team_tong_room_activity SET revision=9"),
      /permission denied/,
    );
    await pg.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
      outsiderId,
    ]);
    assert.equal(
      (await pg.query("SELECT * FROM public.team_tong_room_activity")).rows
        .length,
      0,
    );
    await pg.exec("RESET ROLE; SET ROLE anon");
    await assert.rejects(
      () => pg.query("SELECT * FROM public.team_tong_room_activity"),
      /permission denied/,
    );
    await pg.exec("RESET ROLE");
    let s = await command(
      owner,
      {
        type: "create",
        venue: "PG Turf",
        date: "2026-11-01",
        time: "20:00",
        fee: 2000,
      },
      r,
    );
    const m = s.store.matches[0].id;
    for (const u of users)
      await command(u, { type: "rsvp", match: m, value: "going" }, r);
    await command(
      owner,
      { type: "confirmPool", match: m, players: users.map((u) => u.id) },
      r,
    );
    await command(
      owner,
      { type: "captains", match: m, white: owner.id, black: users[1].id },
      r,
    );
    for (const [i, u] of users.slice(0, 2).entries()) {
      await db()
        .prepare("INSERT INTO sessions VALUES(?,?,?)")
        .run("pg-token-" + i, u.id, Date.now() + 3600000);
      await heartbeat(u, "pg-token-" + i, m, false, r);
    }
    await command(owner, { type: "ready", match: m, generation: 0 }, r);
    s = await command(users[1], { type: "ready", match: m, generation: 0 }, r);
    let d = s.drafts[m];
    const toss = d.first;
    const picker = users.find((u) => u.id === d.captains[d.turn])!;
    const attempts = await Promise.allSettled([
      command(
        picker,
        { type: "pick", match: m, player: users[2].id, picks: d.picks.length },
        r,
      ),
      command(
        picker,
        { type: "pick", match: m, player: users[3].id, picks: d.picks.length },
        r,
      ),
    ]);
    assert.equal(attempts.filter((a) => a.status === "fulfilled").length, 1);
    d = (await loadClub(r)).drafts[m];
    assert.equal(d.first, toss);
    while (d.state !== "complete") {
      const player = d.pool.find(
        (id) =>
          !d.captains.includes(id) && !d.picks.some((p) => p.player === id),
      )!;
      await command(
        users.find((u) => u.id === d.captains[d.turn])!,
        { type: "pick", match: m, player, picks: d.picks.length },
        r,
      );
      d = (await loadClub(r)).drafts[m];
    }
    const access = await enterGuest((await roomInfo(owner, r)).code);
    const g = await guestView(access.token, r);
    assert.equal(g.matches[0].teams[0].length, 8);
    assert.equal(JSON.stringify(g).includes("password"), false);
    assert.equal(JSON.stringify(g).includes("ballots"), false);
    await assert.rejects(
      () => command(users[2], { type: "start", match: m }, r),
      /organizer/i,
    );
    await command(owner, { type: "start", match: m }, r);
    let match = (await loadClub(r)).store.matches[0];
    const off = match.active[0][0],
      on = match.teams[0].find((id) => !match.active[0].includes(id))!;
    await command(
      owner,
      { type: "rotate", match: m, side: 0, off, on, minute: 10 },
      r,
    );
    await command(
      owner,
      { type: "rotate", match: m, side: 0, off: on, on: off, minute: 20 },
      r,
    );
    await command(owner, { type: "finish", match: m }, r);
    await command(
      owner,
      { type: "confirmPlayed", match: m, players: users.map((u) => u.id) },
      r,
    );
    await command(
      owner,
      {
        type: "openVoting",
        match: m,
        deadline: new Date(Date.now() + 3600000).toISOString(),
      },
      r,
    );
    await assert.rejects(() => command(owner, { type: "submit", match: m }, r));
    await assert.rejects(() =>
      command(
        owner,
        { type: "voteDraft", match: m, target: owner.id, value: 8 },
        r,
      ),
    );
    for (const voter of users.slice(0, 4)) {
      for (const target of users.filter((u) => u.id !== voter.id))
        await command(
          voter,
          { type: "voteDraft", match: m, target: target.id, value: 8 },
          r,
        );
      await command(voter, { type: "submit", match: m }, r);
    }
    const visible = (await snapshot(owner, r)).store.matches[0];
    assert.equal(visible.results?.[owner.id].count, 3);
    assert.equal(visible.results?.[owner.id].average, 8);
    assert.deepEqual(visible.votes, []);
    assert.equal(Object.keys(visible.ballots!).length, 1);
    assert.equal(
      (await snapshot(users[4], r)).store.matches[0].results,
      undefined,
    );
    await assert.rejects(() => command(owner, { type: "submit", match: m }, r));
    await command(owner, { type: "closeVoting", match: m }, r);
    await assert.rejects(() =>
      command(
        users[4],
        { type: "voteDraft", match: m, target: owner.id, value: 7 },
        r,
      ),
    );
    match = (await loadClub(r)).store.matches[0];
    assert.equal(match.rotations?.length, 2);
    const afterGuest = await guestView(access.token, r);
    assert.equal(JSON.stringify(afterGuest).includes("results"), false);
    assert.ok(locks.length > 20);
  } finally {
    delete process.env.TEAM_TONG_BACKEND;
    await pg.close();
  }
});

test("PostgreSQL import preserves exact records, is idempotent and refuses conflicting data", async () => {
  const { importRecords, importTables } =
    await import("./server/import-records");
  const pg = new PGlite();
  try {
    await pg.exec(
      `CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;`,
    );
    await pg.exec(
      readFileSync("supabase/migrations/001_team_tong.sql", "utf8"),
    );
    await pg.exec("SET search_path TO team_tong,public");
    const rows = Object.fromEntries(importTables.map((t) => [t, []])) as Record<
      string,
      Record<string, unknown>[]
    >;
    rows.accounts = [
      {
        id: "legacy-owner",
        email: "import@example.test",
        name: "Original owner",
        password: hashPassword("previous password 123"),
        role: "organizer",
        status: "approved",
        email_verified: 0,
      },
    ];
    const payload = JSON.stringify({
      store: {
        players: [{ id: "legacy-owner", name: "Original owner" }],
        matches: [
          {
            id: "legacy-match",
            ballots: { "legacy-owner": 123 },
            votes: [{ voter: "legacy-owner", target: "peer", value: 8 }],
          },
        ],
      },
      drafts: {
        "legacy-match": { first: 1, picks: [{ side: 1, player: "peer" }] },
      },
    });
    rows.rooms = [
      {
        id: "legacy-room",
        name: "Original room",
        logo: null,
        code: "ABCDEFGH",
        owner: "legacy-owner",
        archived: 0,
        payload,
        created: 12345,
      },
    ];
    rows.room_memberships = [
      {
        room_id: "legacy-room",
        account_id: "legacy-owner",
        role: "owner",
        status: "approved",
      },
    ];
    await pg.exec("BEGIN");
    const first = await importRecords(pg, rows);
    await pg.exec("COMMIT");
    assert.equal(first.alreadyImported, false);
    const saved = await pg.query<{ payload: string }>(
      "SELECT payload FROM rooms",
    );
    assert.equal(saved.rows[0].payload, payload);
    assert.equal(
      (await pg.query<{ password: string }>("SELECT password FROM accounts"))
        .rows[0].password,
      rows.accounts[0].password,
    );
    assert.equal((await importRecords(pg, rows)).alreadyImported, true);
    const changed = structuredClone(rows);
    changed.accounts[0].name = "Changed";
    await assert.rejects(() => importRecords(pg, changed), /not empty/);
    assert.equal(
      (await pg.query<{ name: string }>("SELECT name FROM accounts")).rows[0]
        .name,
      "Original owner",
    );
    assert.equal((await pg.query("SELECT * FROM auth_links")).rows.length, 0);
    assert.equal((await pg.query("SELECT * FROM sessions")).rows.length, 0);
  } finally {
    await pg.close();
  }
});

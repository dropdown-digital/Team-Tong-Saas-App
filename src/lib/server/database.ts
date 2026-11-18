import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, type PoolClient } from "pg";
import { db as sqlite, type Account, type ClubData } from "./sqlite";
export type { Account, ClubData } from "./sqlite";
export { newRoomCode } from "./sqlite";
export const supabaseMode = () => {
  const mode = process.env.TEAM_TONG_BACKEND || "sqlite";
  if (mode !== "sqlite" && mode !== "supabase")
    throw Error(
      "TEAM_TONG_BACKEND must be sqlite or supabase. No fallback was selected.",
    );
  return mode === "supabase";
};
let pool: Pool | undefined;
const context = new AsyncLocalStorage<{
  client?: PoolClient;
  local?: boolean;
}>();
let localQueue = Promise.resolve();
export function setPostgresPoolForTests(value: Pool) {
  if (process.env.NODE_ENV !== "test")
    throw Error("Test database override is disabled.");
  pool = value;
}
export function postgresPool() {
  if (pool) return pool;
  if (!process.env.SUPABASE_DB_URL)
    throw Error(
      "Supabase database setup is incomplete. Follow SUPABASE_SETUP.md before switching backends.",
    );
  let uri: URL;
  try {
    uri = new URL(process.env.SUPABASE_DB_URL);
    if (!["postgres:", "postgresql:"].includes(uri.protocol)) throw Error();
  } catch {
    throw Error("Invalid server database connection URI. Check .env.local.");
  }
  // pg connection-string SSL parameters can override its TLS object. Enforce validation.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    uri.searchParams.delete(key);
  return (pool ||= new Pool({
    connectionString: uri.toString(),
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: true },
  }));
}
export function postgresSql(sql: string) {
  let i = 0;
  // Parameters never substitute inside quoted SQL literals.
  return sql.replace(/'(?:''|[^'])*'|\?/g, (token) =>
    token === "?" ? `$${++i}` : token,
  );
}
export async function transaction<T>(fn: () => T | Promise<T>): Promise<T> {
  if (context.getStore()) return await fn();
  if (supabaseMode()) {
    const client = await postgresPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL search_path TO team_tong, public");
      // Small private clubs: serialize mutations to preserve aggregate draft/ballot invariants.
      // This is a database lock, so independent Next.js processes cannot lose each other's picks.
      await client.query("SELECT pg_advisory_xact_lock(741963225)");
      const result = await context.run({ client }, fn);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  const previous = localQueue;
  let release!: () => void;
  localQueue = new Promise<void>((r) => {
    release = r;
  });
  await previous;
  const sql = sqlite();
  try {
    sql.exec("BEGIN IMMEDIATE");
    const result = await context.run({ local: true }, fn);
    sql.exec("COMMIT");
    return result;
  } catch (e) {
    sql.exec("ROLLBACK");
    throw e;
  } finally {
    release();
  }
}
export function db() {
  return {
    close() {
      sqlite().close();
    },
    prepare(sql: string) {
      async function execute(
        kind: "get" | "all" | "run",
        args: unknown[],
      ): Promise<unknown> {
        if (!context.getStore()) return transaction(() => execute(kind, args));
        const client = context.getStore()?.client;
        if (client) {
          const result = await client.query(postgresSql(sql), args);
          return kind === "get"
            ? result.rows[0]
            : kind === "all"
              ? result.rows
              : { changes: result.rowCount };
        }
        const statement = sqlite().prepare(sql);
        return statement[kind](...(args as Parameters<typeof statement.run>));
      }
      return {
        get: (...args: unknown[]): Promise<unknown> => execute("get", args),
        all: (...args: unknown[]): Promise<unknown[]> =>
          execute("all", args) as Promise<unknown[]>,
        run: (...args: unknown[]): Promise<unknown> => execute("run", args),
      };
    },
  };
}
export async function loadClub(roomId?: string): Promise<ClubData> {
  const row = (await db()
    .prepare(
      roomId
        ? "SELECT payload FROM rooms WHERE id=?"
        : "SELECT payload FROM club WHERE id=1",
    )
    .get(...(roomId ? [roomId] : []))) as { payload: string } | undefined;
  if (!row && roomId) throw Error("Room unavailable.");
  const data: ClubData = row
    ? JSON.parse(row.payload)
    : {
        store: {
          version: 1,
          club: "Team Tong",
          viewer: "",
          players: [],
          matches: [],
        },
        drafts: {},
        revision: 0,
      };
  if (roomId) data.roomId = roomId;
  for (const m of data.store.matches)
    if (
      m.eligibilityFrozen === undefined &&
      m.status === "completed" &&
      (m.voting ||
        m.votingDeadline ||
        Object.keys(m.ballots || {}).length ||
        m.votes.length)
    ) {
      m.eligibilityFrozen = true;
      m.playedConfirmed = true;
    }
  return data;
}
export async function saveClub(data: ClubData) {
  if (data.roomId)
    await db()
      .prepare("UPDATE rooms SET payload=? WHERE id=?")
      .run(JSON.stringify(data), data.roomId);
  else
    await db()
      .prepare(
        "INSERT INTO club VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      )
      .run(JSON.stringify(data));
}
export async function account(id: string) {
  return (await db().prepare("SELECT * FROM accounts WHERE id=?").get(id)) as
    Account | undefined;
}

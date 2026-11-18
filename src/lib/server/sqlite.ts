import { DatabaseSync } from "node:sqlite";
import { randomUUID, randomInt } from "node:crypto";
import { mkdirSync, chmodSync } from "node:fs";
import path from "node:path";
import type { Store } from "../domain";
import type { CaptainDraft } from "../draft";
export type Account = {
  id: string;
  email: string;
  name: string;
  password: string;
  role: "member" | "organizer";
  status: "pending" | "approved" | "suspended";
  email_verified?: number;
};
export type ClubData = {
  roomId?: string;
  store: Store;
  drafts: Record<string, CaptainDraft>;
  revision: number;
};
let connection: DatabaseSync | undefined;
export function db() {
  if (connection) return connection;
  const file =
    process.env.TEAM_TONG_DB ||
    path.join(process.cwd(), ".data", "team-tong.sqlite");
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  connection = new DatabaseSync(file);
  try {
    chmodSync(file, 0o600);
    connection.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'member',status TEXT NOT NULL DEFAULT 'pending');
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS presence(session TEXT NOT NULL,match_id TEXT NOT NULL,seen INTEGER NOT NULL,PRIMARY KEY(session,match_id));
 CREATE TABLE IF NOT EXISTS club(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,until INTEGER NOT NULL);`);
    migrateRooms(connection, file);
    if (
      !connection
        .prepare("SELECT 1 FROM schema_migrations WHERE version=3")
        .get()
    ) {
      connection.exec(
        "BEGIN IMMEDIATE; CREATE TABLE IF NOT EXISTS profiles(account_id TEXT PRIMARY KEY REFERENCES accounts(id),username TEXT NOT NULL,position TEXT NOT NULL,number INTEGER NOT NULL,portrait TEXT); INSERT INTO schema_migrations VALUES(3,unixepoch()*1000); COMMIT;",
      );
    }
    if (
      !connection
        .prepare("SELECT 1 FROM schema_migrations WHERE version=4")
        .get()
    )
      connection.exec(
        "BEGIN IMMEDIATE; CREATE TABLE IF NOT EXISTS room_creation_requests(account_id TEXT REFERENCES accounts(id),request_id TEXT NOT NULL,room_id TEXT NOT NULL REFERENCES rooms(id),PRIMARY KEY(account_id,request_id)); INSERT INTO schema_migrations VALUES(4,unixepoch()*1000); COMMIT;",
      );
    if (
      !connection
        .prepare("SELECT 1 FROM schema_migrations WHERE version=5")
        .get()
    )
      connection.exec(
        "BEGIN IMMEDIATE; CREATE TABLE guest_sessions(token TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id),code_hash TEXT NOT NULL,expires INTEGER NOT NULL); INSERT INTO schema_migrations VALUES(5,unixepoch()*1000); COMMIT;",
      );
    if (
      !connection
        .prepare("SELECT 1 FROM schema_migrations WHERE version=6")
        .get()
    )
      connection.exec(
        "BEGIN IMMEDIATE; CREATE TABLE IF NOT EXISTS auth_links(auth_id TEXT PRIMARY KEY,account_id TEXT UNIQUE NOT NULL REFERENCES accounts(id)); INSERT INTO schema_migrations VALUES(6,unixepoch()*1000); COMMIT;",
      );
    return connection;
  } catch (e) {
    connection.close();
    connection = undefined;
    throw e;
  }
}
function migrateRooms(sql: DatabaseSync, file: string) {
  sql.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,created INTEGER NOT NULL)",
  );
  if (sql.prepare("SELECT 1 FROM schema_migrations WHERE version=2").get())
    return;
  const legacy = sql.prepare("SELECT payload FROM club WHERE id=1").get() as
    { payload: string } | undefined;
  const users = sql.prepare("SELECT id,role,status FROM accounts").all() as {
    id: string;
    role: string;
    status: string;
  }[];
  // SQLite's backup snapshot includes committed WAL pages. Never copy only the main file.
  if (legacy || users.length) {
    const backup = file + ".before-rooms-" + Date.now() + ".sqlite";
    sql.prepare("VACUUM INTO ?").run(backup);
    chmodSync(backup, 0o600);
  }
  sql.exec("BEGIN IMMEDIATE");
  try {
    sql.exec(`ALTER TABLE accounts ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE rooms(id TEXT PRIMARY KEY,name TEXT NOT NULL,logo TEXT,code TEXT NOT NULL UNIQUE,owner TEXT REFERENCES accounts(id),archived INTEGER NOT NULL DEFAULT 0,payload TEXT NOT NULL,created INTEGER NOT NULL);
      CREATE TABLE room_memberships(room_id TEXT REFERENCES rooms(id),account_id TEXT REFERENCES accounts(id),role TEXT NOT NULL CHECK(role IN ('owner','organizer','member')),status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),PRIMARY KEY(room_id,account_id));
      CREATE TABLE room_transfers(room_id TEXT PRIMARY KEY REFERENCES rooms(id),target TEXT NOT NULL REFERENCES accounts(id),requested_by TEXT NOT NULL REFERENCES accounts(id));
      CREATE TABLE room_audit(id INTEGER PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id),actor TEXT NOT NULL,action TEXT NOT NULL,created INTEGER NOT NULL);
      CREATE TABLE email_tokens(token TEXT PRIMARY KEY,account_id TEXT REFERENCES accounts(id),kind TEXT NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE room_presence(room_id TEXT NOT NULL REFERENCES rooms(id),session TEXT NOT NULL,match_id TEXT NOT NULL,seen INTEGER NOT NULL,PRIMARY KEY(room_id,session,match_id));`);
    if (legacy || users.length) {
      const owners = users.filter(
        (u) => u.role === "organizer" && u.status === "approved",
      );
      if (owners.length !== 1)
        throw Error(
          "Founding room ownership is ambiguous. Migration stopped without changing club data. Confirm the intended owner before retrying.",
        );
      const owner = owners[0].id;
      const id = randomUUID();
      const payload = legacy?.payload || JSON.stringify(emptyClub());
      sql
        .prepare("INSERT INTO rooms VALUES(?,?,?,?,?,0,?,?)")
        .run(id, "Team Tong", null, newRoomCode(), owner, payload, Date.now());
      sql
        .prepare(
          "INSERT INTO room_audit(room_id,actor,action,created) SELECT ?,actor,action,created FROM audit",
        )
        .run(id);
      for (const u of users)
        sql
          .prepare("INSERT INTO room_memberships VALUES(?,?,?,?)")
          .run(
            id,
            u.id,
            u.id === owner ? "owner" : u.role,
            u.status === "approved"
              ? "approved"
              : u.status === "pending"
                ? "pending"
                : "rejected",
          );
    }
    sql.prepare("INSERT INTO schema_migrations VALUES(2,?)").run(Date.now());
    sql.exec("COMMIT");
  } catch (e) {
    sql.exec("ROLLBACK");
    throw e;
  }
}
export function newRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 8 },
    () => alphabet[randomInt(alphabet.length)],
  ).join("");
}
function emptyClub(): ClubData {
  return {
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
}

export function loadClub(roomId?: string): ClubData {
  if (roomId) {
    const row = db()
      .prepare("SELECT payload FROM rooms WHERE id=?")
      .get(roomId) as { payload: string } | undefined;
    if (!row) throw Error("Room unavailable.");
    const data: ClubData = { ...JSON.parse(row.payload), roomId };
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
  const row = db().prepare("SELECT payload FROM club WHERE id=1").get() as
    { payload: string } | undefined;
  return row
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
}
export function saveClub(data: ClubData) {
  if (data.roomId) {
    db()
      .prepare("UPDATE rooms SET payload=? WHERE id=?")
      .run(JSON.stringify(data), data.roomId);
    return;
  }
  db()
    .prepare(
      "INSERT INTO club VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
    )
    .run(JSON.stringify(data));
}
export function transaction<T>(fn: () => T): T {
  const sql = db();
  sql.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    sql.exec("COMMIT");
    return value;
  } catch (e) {
    sql.exec("ROLLBACK");
    throw e;
  }
}
export function account(id: string) {
  return db().prepare("SELECT * FROM accounts WHERE id=?").get(id) as
    Account | undefined;
}

import { DatabaseSync } from "node:sqlite";
import { chmodSync, existsSync } from "node:fs";
import {
  importRecords,
  importTables,
  canonicalRows,
} from "../src/lib/server/import-records";
import path from "node:path";
import { postgresPool } from "../src/lib/server/database";

// Deliberately excludes sessions, presence, email tokens, guest tokens and login limits.
// Password hashes remain private legacy identity proofs; never import them into auth.users.
const tables = importTables;
const canonical = canonicalRows;
const source =
  process.env.TEAM_TONG_DB ||
  path.join(process.cwd(), ".data", "team-tong.sqlite");
if (!existsSync(source))
  throw Error(
    "Existing SQLite database not found; import stopped. No empty database was created.",
  );
if (!process.env.SUPABASE_DB_URL)
  throw Error(
    "Paste the database connection URI into SUPABASE_DB_URL in .env.local first. Do not send it in chat.",
  );
if (!process.argv.includes("--confirm-stopped"))
  throw Error(
    "Stop the local app first, then run npm run supabase:import -- --confirm-stopped. This prevents new local records during cutover.",
  );
const sql = new DatabaseSync(source);
const backup = source + ".before-supabase-import-" + Date.now() + ".sqlite";
sql.prepare("VACUUM INTO ?").run(backup);
chmodSync(backup, 0o600);
const saved = new DatabaseSync(backup, { readOnly: true });
const rows = Object.fromEntries(
  tables.map((t) => [t, saved.prepare(`SELECT * FROM ${t}`).all()]),
);
console.log("Private backup saved:", backup);
const pool = postgresPool(),
  client = await pool.connect().catch(() => {
    throw Error(
      "Could not connect to the target database. Check the server-only URI and SQL setup; the local backup is safe.",
    );
  });
try {
  sql.exec("BEGIN IMMEDIATE");
  for (const t of tables)
    if (
      canonical(sql.prepare(`SELECT * FROM ${t}`).all()) !== canonical(rows[t])
    )
      throw Error(
        "Local records changed while taking the backup. Stop the app and retry; nothing was imported.",
      );
  await client.query("BEGIN");
  await client.query("SET LOCAL search_path TO team_tong,public");
  await client.query("SELECT pg_advisory_xact_lock(741963225)");
  const result = await importRecords(client, rows);
  console.log(
    result.alreadyImported
      ? "This exact snapshot was already imported; no records overwritten."
      : "Every imported row was verified.",
  );
  console.log(
    "Counts:",
    Object.fromEntries(tables.map((t) => [t, rows[t].length])),
  );
  await client.query("COMMIT");
  sql.exec("ROLLBACK");
  console.log(
    "Import complete. SQLite is unchanged. Now set TEAM_TONG_BACKEND=supabase in .env.local, then npm run dev.",
  );
} catch (e) {
  await client.query("ROLLBACK");
  try {
    sql.exec("ROLLBACK");
  } catch {}
  // Avoid printing a connection URI/password in driver errors.
  console.error(
    e instanceof Error && !("code" in e)
      ? e.message
      : "Database import failed. Check the URI, certificate and SQL migration; no source records were changed.",
  );
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
  saved.close();
  sql.close();
}

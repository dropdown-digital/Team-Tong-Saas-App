import { postgresPool } from "../src/lib/server/database";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key)
  throw Error("Add Supabase URL and publishable key to .env.local.");
const r = await fetch(url + "/auth/v1/settings", { headers: { apikey: key } });
console.log(
  "Supabase Auth:",
  r.status === 200 ? "reachable" : "HTTP " + r.status,
);
if (!process.env.SUPABASE_DB_URL) {
  console.log(
    "Database: setup pending. Follow SUPABASE_SETUP.md; the publishable key cannot install or import database records.",
  );
  process.exitCode = 1;
} else {
  const p = postgresPool();
  try {
    const c = await p.query("SELECT version FROM team_tong.migrations");
    const n = await p.query("SELECT count(*) FROM team_tong.accounts");
    console.log(
      "Schema versions:",
      c.rows.map((r) => r.version),
    );
    console.log("Imported account count:", n.rows[0].count);
  } catch {
    console.log(
      "Database check failed. Verify the SQL migration, connection URI and certificate.",
    );
    process.exitCode = 1;
  } finally {
    await p.end();
  }
}

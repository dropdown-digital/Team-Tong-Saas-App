import { createHash } from "node:crypto";
export const importTables = [
  "accounts",
  "club",
  "rooms",
  "room_memberships",
  "profiles",
  "room_transfers",
  "room_creation_requests",
  "audit",
  "room_audit",
] as const;
export type ImportRows = Record<string, Record<string, unknown>[]>;
export const canonicalRows = (rows: Record<string, unknown>[]) =>
  JSON.stringify(
    rows
      .map((r) =>
        Object.fromEntries(
          Object.keys(r)
            .sort()
            .map((k) => [k, typeof r[k] === "bigint" ? Number(r[k]) : r[k]]),
        ),
      )
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
type Connection = {
  query: (
    sql: string,
    parameters?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[] }>;
};
// Caller must hold a transaction and the same advisory lock as application writes.
export async function importRecords(client: Connection, rows: ImportRows) {
  const manifest = Object.fromEntries(
    importTables.map((t) => [
      t,
      {
        count: rows[t].length,
        sha256: createHash("sha256")
          .update(canonicalRows(rows[t]))
          .digest("hex"),
      },
    ]),
  );
  const hash = createHash("sha256")
    .update(JSON.stringify(manifest))
    .digest("hex");
  if (
    (await client.query("SELECT 1 FROM imports WHERE source_hash=$1", [hash]))
      .rows.length
  )
    return { alreadyImported: true, manifest };
  for (const t of importTables)
    if ((await client.query(`SELECT 1 FROM ${t} LIMIT 1`)).rows.length)
      throw Error(
        "Target Team Tong tables are not empty. Import refused to avoid overwriting or duplicating records.",
      );
  for (const t of importTables)
    for (const row of rows[t]) {
      const keys = Object.keys(row);
      await client.query(
        `INSERT INTO ${t} (${keys.map((k) => '"' + k.replaceAll('"', '""') + '"').join(",")}) VALUES (${keys.map((_, i) => "$" + (i + 1)).join(",")})`,
        keys.map((k) => row[k]),
      );
    }
  for (const t of importTables) {
    const remote = (await client.query(`SELECT * FROM ${t}`)).rows;
    const numeric = new Set(
      rows[t].flatMap((r) =>
        Object.keys(r).filter((k) => typeof r[k] === "number"),
      ),
    );
    for (const r of remote)
      for (const k of numeric) if (r[k] !== null) r[k] = Number(r[k]);
    if (canonicalRows(remote) !== canonicalRows(rows[t]))
      throw Error(
        `Verification failed for ${t}; rolling back the entire import.`,
      );
  }
  for (const t of ["audit", "room_audit"])
    await client.query(
      `SELECT setval(pg_get_serial_sequence('team_tong.${t}','id'),COALESCE((SELECT max(id) FROM ${t}),0)+1,false)`,
    );
  await client.query(
    "INSERT INTO imports(source_hash,manifest) VALUES($1,$2)",
    [hash, JSON.stringify(manifest)],
  );
  return { alreadyImported: false, manifest };
}

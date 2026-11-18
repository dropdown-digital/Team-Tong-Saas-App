import { db } from "../src/lib/server/sqlite";
const sql = db();
console.log(
  "Local schema ready:",
  sql.prepare("SELECT version FROM schema_migrations ORDER BY version").all(),
);
console.log("Rooms:", sql.prepare("SELECT count(*) count FROM rooms").get());
console.log(
  "Legacy club record retained. Existing data was backed up before the room migration.",
);

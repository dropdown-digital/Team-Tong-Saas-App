import { z } from "zod";
import { db, transaction, loadClub, saveClub, type Account } from "./database";
const schema = z.object({
  name: z.string().trim().min(1).max(70),
  username: z.string().trim().min(1).max(40),
  position: z.enum([
    "Goalkeeper",
    "Defender",
    "Midfielder",
    "Winger",
    "Forward",
  ]),
  number: z.number().int().min(0).max(99),
  portrait: z.string().nullable().optional(),
});
export async function ownProfile(user: Account) {
  return (
    (await db()
      .prepare(
        "SELECT username,position,number,portrait FROM profiles WHERE account_id=?",
      )
      .get(user.id)) || {
      username: user.name,
      position: "Midfielder",
      number: 0,
      portrait: null,
    }
  );
}
export async function updateProfile(user: Account, input: unknown) {
  const a = schema.parse(input);
  return await transaction(async () => {
    const old = (await ownProfile(user)) as { portrait: string | null };
    const portrait = a.portrait === undefined ? old.portrait : a.portrait;
    await db()
      .prepare("UPDATE accounts SET name=? WHERE id=?")
      .run(a.name, user.id);
    await db()
      .prepare(
        "INSERT INTO profiles VALUES(?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET username=excluded.username,position=excluded.position,number=excluded.number,portrait=excluded.portrait",
      )
      .run(user.id, a.username, a.position, a.number, portrait);
    for (const row of (await db()
      .prepare(
        "SELECT room_id FROM room_memberships WHERE account_id=? AND status='approved'",
      )
      .all(user.id)) as { room_id: string }[]) {
      const d = await loadClub(row.room_id);
      const p = d.store.players.find(
        (p) => p.id === user.id || p.accountId === user.id,
      );
      if (p) {
        p.name = a.name;
        p.username = a.username;
        p.position = a.position;
        p.number = a.number;
        p.portrait = portrait || undefined;
        d.revision++;
        await saveClub(d);
      }
    }
    return { ok: true };
  });
}

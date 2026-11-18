import { randomBytes } from "node:crypto";
import { db, loadClub, transaction } from "./database";
import { digest, limit } from "./auth";
import { online } from "./service";
import { reconcilePresence } from "../draft";
import { score } from "../domain";
import type { GuestView } from "../guest-types";
export const GUEST_COOKIE = "team_tong_guest";
export async function enterGuest(code: unknown) {
  await limit("guest-entry:global", 100);
  if (typeof code !== "string" || !/^[A-HJ-NP-Z2-9]{8}$/.test(code))
    throw Error("Enter a valid eight-character room invitation code.");
  const room = (await db()
    .prepare("SELECT id FROM rooms WHERE code=? AND archived=0")
    .get(code)) as { id: string } | undefined;
  if (!room)
    throw Error(
      "Invitation unavailable. Ask the organizer for the current code.",
    );
  const token = randomBytes(32).toString("hex");
  await db()
    .prepare("DELETE FROM guest_sessions WHERE expires<?")
    .run(Date.now());
  await db()
    .prepare("INSERT INTO guest_sessions VALUES(?,?,?,?)")
    .run(digest(token), room.id, digest(code), Date.now() + 86400000);
  return { token, roomId: room.id };
}
export async function guestView(
  token: string | undefined,
  roomId: string,
): Promise<GuestView> {
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw Error("Enter the room invitation to continue as a guest.");
  return await transaction(async () => {
    const r = (await db()
      .prepare(
        "SELECT r.id,r.name,r.code,g.code_hash FROM guest_sessions g JOIN rooms r ON r.id=g.room_id WHERE g.token=? AND g.room_id=? AND g.expires>? AND r.archived=0",
      )
      .get(digest(token), roomId, Date.now())) as
      { id: string; name: string; code: string; code_hash: string } | undefined;
    if (!r || digest(r.code) !== r.code_hash)
      throw Error(
        "Guest access expired or the invitation changed. Ask your organizer for the current code.",
      );
    const data = await loadClub(roomId),
      visiblePlayers = new Set<string>();
    const matches = await Promise.all(
      data.store.matches.map(async (m) => {
        const d = data.drafts[m.id] ? structuredClone(data.drafts[m.id]) : null;
        const presence = await online(data, m.id);
        if (d) reconcilePresence(d, presence);
        [
          ...m.teams.flat(),
          ...(d?.pool ||
            m.confirmed ||
            Object.keys(m.attendance).filter(
              (id) => m.attendance[id] === "going",
            )),
        ].forEach((id) => visiblePlayers.add(id));
        return {
          id: m.id,
          date: m.date,
          time: m.time,
          venue: m.venue,
          status: m.status,
          teams: structuredClone(m.teams),
          score: [score(m, 0), score(m, 1)] as [number, number],
          draft: d,
          online: presence,
        };
      }),
    );
    // Whitelist, rather than deleting a few sensitive fields from the private store.
    return {
      room: { id: r.id, name: r.name },
      players: data.store.players
        .filter((p) => visiblePlayers.has(p.id))
        .map((p) => ({
          id: p.id,
          name: p.name,
          position: p.position,
          number: p.number,
        })),
      matches,
    };
  });
}

import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  db,
  transaction,
  loadClub,
  saveClub,
  newRoomCode,
  type Account,
} from "./database";
import { limit } from "./auth";
export type Room = {
  id: string;
  name: string;
  logo: string | null;
  code: string;
  owner: string | null;
  archived: number;
};
export async function roomActor(
  user: Account,
  roomId: string,
  allowArchived = false,
): Promise<Account> {
  const m = (await db()
    .prepare(
      `SELECT m.role,m.status,r.archived FROM room_memberships m JOIN rooms r ON r.id=m.room_id WHERE m.room_id=? AND m.account_id=?`,
    )
    .get(roomId, user.id)) as
    { role: string; status: string; archived: number } | undefined;
  if (
    user.status === "suspended" ||
    !m ||
    m.status !== "approved" ||
    (!allowArchived && m.archived)
  )
    throw Error("Room unavailable or membership not approved.");
  return {
    ...user,
    status: "approved",
    role: m.role === "member" ? "member" : "organizer",
  };
}
export async function roomList(user: Account) {
  return await db()
    .prepare(
      `SELECT r.id,r.name,r.logo,r.archived,m.role,m.status FROM room_memberships m JOIN rooms r ON r.id=m.room_id WHERE m.account_id=? ORDER BY r.created`,
    )
    .all(user.id);
}
export async function roomInfo(user: Account, id: string) {
  const actor = await roomActor(user, id, true);
  const r = (await db()
    .prepare("SELECT id,name,logo,code,owner,archived FROM rooms WHERE id=?")
    .get(id)) as Room;
  const transfer = await db()
    .prepare("SELECT target,requested_by FROM room_transfers WHERE room_id=?")
    .get(id);
  const audit =
    actor.role === "organizer"
      ? await db()
          .prepare(
            "SELECT actor,action,created FROM room_audit WHERE room_id=? ORDER BY id DESC LIMIT 40",
          )
          .all(id)
      : [];
  return {
    ...r,
    code: actor.role === "organizer" ? r.code : undefined,
    transfer,
    audit,
  };
}
export async function invitation(code: unknown) {
  await limit("invite:global", 200);
  const valid = z
    .string()
    .regex(/^[A-HJ-NP-Z2-9]{8}$/)
    .parse(code);
  const room = await db()
    .prepare("SELECT name,logo FROM rooms WHERE code=? AND archived=0")
    .get(valid);
  if (!room)
    throw Error("Invitation unavailable. Check the code with your organizer.");
  return room;
}
const id = z.string().min(1).max(200);
const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("roomLogo"), logo: z.string().nullable() }),
  z.object({
    type: z.literal("roomBulk"),
    approve: z.boolean(),
    users: z.array(id).min(1).max(100),
  }),
  z.object({
    type: z.literal("roomCreate"),
    requestId: z.string().uuid().optional(),
    logo: z.string().nullable().optional(),
    name: z.string().trim().min(1).max(70),
  }),
  z.object({
    type: z.literal("roomJoin"),
    code: z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/),
  }),
  z.object({ type: z.literal("roomDecide"), user: id, approve: z.boolean() }),
  z.object({ type: z.literal("roomRole"), user: id, organizer: z.boolean() }),
  z.object({
    type: z.literal("roomRename"),
    name: z.string().trim().min(1).max(70),
  }),
  z.object({ type: z.literal("roomCode") }),
  z.object({ type: z.literal("roomArchive"), archived: z.boolean() }),
  z.object({ type: z.literal("roomTransfer"), user: id }),
  z.object({ type: z.literal("roomTransferReply"), accept: z.boolean() }),
]);
export async function roomCommand(
  user: Account,
  input: unknown,
  roomId?: string,
) {
  const a = schema.parse(input);
  // Limits commit separately so unsuccessful guesses are still counted.
  await limit("rooms:" + user.id, 80);
  return await transaction(async () => {
    if (user.status === "suspended") throw Error("Account unavailable.");
    if (a.type === "roomCreate") {
      const verified = (await db()
        .prepare("SELECT email_verified FROM accounts WHERE id=?")
        .get(user.id)) as { email_verified: number };
      if (!verified.email_verified)
        throw Error(
          "Verify your email before creating a room. Email delivery must be configured by the server owner.",
        );
      if (a.requestId) {
        const existing = (await db()
          .prepare(
            "SELECT room_id FROM room_creation_requests WHERE account_id=? AND request_id=?",
          )
          .get(user.id, a.requestId)) as { room_id: string } | undefined;
        if (existing) return { roomId: existing.room_id };
      }
      const room = randomUUID(),
        data = await loadClub();
      // A new room starts empty; never copy the legacy club or demo.
      data.store = {
        version: 1,
        club: a.name,
        viewer: "",
        players: [
          { id: user.id, name: user.name, position: "Midfielder", number: 1 },
        ],
        matches: [],
      };
      data.drafts = {};
      data.revision = 0;
      data.roomId = room;
      let code = newRoomCode();
      while (await db().prepare("SELECT 1 FROM rooms WHERE code=?").get(code))
        code = newRoomCode();
      await db()
        .prepare("INSERT INTO rooms VALUES(?,?,?,?,?,0,?,?)")
        .run(
          room,
          a.name,
          a.logo || null,
          code,
          user.id,
          JSON.stringify(data),
          Date.now(),
        );
      await db()
        .prepare("INSERT INTO room_memberships VALUES(?,?,'owner','approved')")
        .run(room, user.id);
      if (a.requestId)
        await db()
          .prepare("INSERT INTO room_creation_requests VALUES(?,?,?)")
          .run(user.id, a.requestId, room);
      await db()
        .prepare(
          "INSERT INTO room_audit(room_id,actor,action,created) VALUES(?,?,?,?)",
        )
        .run(room, user.id, "Room created", Date.now());
      return { roomId: room };
    }
    if (a.type === "roomJoin") {
      const verified = (await db()
        .prepare("SELECT email_verified FROM accounts WHERE id=?")
        .get(user.id)) as { email_verified: number };
      if (!verified.email_verified)
        throw Error("Verify your email before requesting membership.");
      const r = (await db()
        .prepare("SELECT id FROM rooms WHERE code=? AND archived=0")
        .get(a.code)) as { id: string } | undefined;
      if (!r) throw Error("Invitation unavailable.");
      await db()
        .prepare(
          "INSERT INTO room_memberships VALUES(?,?,'member','pending') ON CONFLICT(room_id,account_id) DO NOTHING",
        )
        .run(r.id, user.id);
      return { ok: true };
    }
    if (!roomId) throw Error("Choose a room.");
    const actor = await roomActor(user, roomId, true);
    const r = (await db()
      .prepare("SELECT * FROM rooms WHERE id=?")
      .get(roomId)) as Room;
    const owner = r.owner === user.id;
    const target = async (uid: string) =>
      (await db()
        .prepare(
          "SELECT role,status FROM room_memberships WHERE room_id=? AND account_id=?",
        )
        .get(roomId, uid)) as { role: string; status: string } | undefined;
    if (a.type === "roomTransferReply") {
      const t = (await db()
        .prepare(
          "SELECT target,requested_by FROM room_transfers WHERE room_id=?",
        )
        .get(roomId)) as { target: string; requested_by: string } | undefined;
      if (
        !t ||
        t.target !== user.id ||
        t.requested_by !== r.owner ||
        r.archived
      )
        throw Error("No active ownership invitation.");
      if (a.accept) {
        await db()
          .prepare(
            "UPDATE room_memberships SET role='organizer' WHERE room_id=? AND account_id=?",
          )
          .run(roomId, r.owner);
        await db()
          .prepare(
            "UPDATE room_memberships SET role='owner' WHERE room_id=? AND account_id=?",
          )
          .run(roomId, user.id);
        await db()
          .prepare("UPDATE rooms SET owner=? WHERE id=?")
          .run(user.id, roomId);
      }
      await db()
        .prepare("DELETE FROM room_transfers WHERE room_id=?")
        .run(roomId);
    } else {
      if (actor.role !== "organizer")
        throw Error("Only room organizers can do this.");
      if (r.archived && a.type !== "roomArchive")
        throw Error("Restore the room first.");
      if (
        ["roomRole", "roomTransfer", "roomArchive"].includes(a.type) &&
        !owner
      )
        throw Error("Only the room owner can do this.");
      if (a.type === "roomLogo")
        await db()
          .prepare("UPDATE rooms SET logo=? WHERE id=?")
          .run(a.logo, roomId);
      else if (a.type === "roomBulk") {
        const data = await loadClub(roomId);
        for (const uid of [...new Set(a.users)]) {
          if ((await target(uid))?.status !== "pending")
            throw Error(
              "One of the requests has changed. Refresh and try again.",
            );
          await db()
            .prepare(
              "UPDATE room_memberships SET status=? WHERE room_id=? AND account_id=?",
            )
            .run(a.approve ? "approved" : "rejected", roomId, uid);
          const profile = (await db()
            .prepare("SELECT name FROM accounts WHERE id=?")
            .get(uid)) as { name: string };
          if (a.approve && !data.store.players.some((p) => p.id === uid))
            data.store.players.push({
              id: uid,
              name: profile.name,
              position: "Midfielder",
              number: data.store.players.length + 1,
            });
        }
        data.revision++;
        await saveClub(data);
      } else if (a.type === "roomDecide") {
        if ((await target(a.user))?.status !== "pending")
          throw Error("Choose a pending room request.");
        await db()
          .prepare(
            "UPDATE room_memberships SET status=? WHERE room_id=? AND account_id=?",
          )
          .run(a.approve ? "approved" : "rejected", roomId, a.user);
        if (a.approve) {
          const account = (await db()
            .prepare("SELECT name FROM accounts WHERE id=?")
            .get(a.user)) as { name: string };
          const data = await loadClub(roomId);
          if (!data.store.players.some((p) => p.id === a.user))
            data.store.players.push({
              id: a.user,
              name: account.name,
              position: "Midfielder",
              number: data.store.players.length + 1,
            });
          data.revision++;
          await saveClub(data);
        }
      } else if (a.type === "roomRole") {
        if ((await target(a.user))?.status !== "approved" || a.user === r.owner)
          throw Error(
            "The owner role is protected. Choose an approved member.",
          );
        await db()
          .prepare(
            "UPDATE room_memberships SET role=? WHERE room_id=? AND account_id=?",
          )
          .run(a.organizer ? "organizer" : "member", roomId, a.user);
      } else if (a.type === "roomRename") {
        await db()
          .prepare("UPDATE rooms SET name=? WHERE id=?")
          .run(a.name, roomId);
        const data = await loadClub(roomId);
        data.store.club = a.name;
        data.revision++;
        await saveClub(data);
      } else if (a.type === "roomCode") {
        let code = newRoomCode();
        while (await db().prepare("SELECT 1 FROM rooms WHERE code=?").get(code))
          code = newRoomCode();
        await db()
          .prepare("UPDATE rooms SET code=? WHERE id=?")
          .run(code, roomId);
      } else if (a.type === "roomArchive")
        await db()
          .prepare("UPDATE rooms SET archived=? WHERE id=?")
          .run(Number(a.archived), roomId);
      else if (a.type === "roomTransfer") {
        if (a.user === user.id || (await target(a.user))?.status !== "approved")
          throw Error("Choose another approved room member.");
        await db()
          .prepare(
            "INSERT INTO room_transfers VALUES(?,?,?) ON CONFLICT(room_id) DO UPDATE SET target=excluded.target,requested_by=excluded.requested_by",
          )
          .run(roomId, a.user, user.id);
      }
    }
    await db()
      .prepare(
        "INSERT INTO room_audit(room_id,actor,action,created) VALUES(?,?,?,?)",
      )
      .run(
        roomId,
        user.id,
        a.type === "roomLogo" ? "Room logo updated" : JSON.stringify(a),
        Date.now(),
      );
    return { ok: true };
  });
}

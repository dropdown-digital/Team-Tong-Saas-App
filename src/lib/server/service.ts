import { roomActor } from "./rooms";
import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  fixture,
  startMatch,
  finishMatch,
  logMinutes,
  substitute,
  addGoal,
  addCard,
  saveDraft,
  submitBallot,
  participants,
  validVotes,
  canSeeResults,
  votingIsOpen,
} from "../domain";
import {
  createDraft,
  reconcilePresence,
  readyCaptain,
  pickPlayer,
  replaceCaptain,
  PRESENCE_TTL,
} from "../draft";
import {
  db,
  loadClub,
  saveClub,
  transaction,
  type Account,
  type ClubData,
} from "./database";
export function participantId(data: ClubData, accountId: string) {
  return (
    data.store.players.find((p) => p.accountId === accountId)?.id || accountId
  );
}
function captainAccount(data: ClubData, player: string) {
  const p = data.store.players.find((p) => p.id === player);
  return p?.guest ? p.accountId : p?.id;
}
async function requireCaptainAccount(data: ClubData, player: string) {
  if (!data.roomId) return;
  const id = captainAccount(data, player);
  if (
    !id ||
    !(await db()
      .prepare(
        "SELECT 1 FROM room_memberships m JOIN accounts a ON a.id=m.account_id WHERE m.room_id=? AND m.account_id=? AND m.status='approved' AND a.status!='suspended'",
      )
      .get(data.roomId, id))
  )
    throw Error(
      "Captains need their own approved accounts. Link this participant to an account first.",
    );
}
export async function online(
  data: ClubData,
  id: string,
): Promise<[boolean, boolean]> {
  const draft = data.drafts[id];
  if (!draft) return [false, false];
  return (await Promise.all(
    draft.captains.map(
      async (c) =>
        !!(await db()
          .prepare(
            `SELECT 1 FROM ${data.roomId ? "room_presence" : "presence"} p JOIN sessions s ON s.token=p.session JOIN accounts a ON a.id=s.account_id WHERE p.match_id=? AND s.account_id=? AND p.seen>? AND s.expires>? AND a.status!='suspended' ${data.roomId ? "AND p.room_id=? AND EXISTS(SELECT 1 FROM room_memberships rm WHERE rm.room_id=p.room_id AND rm.account_id=a.id AND rm.status='approved')" : ""} LIMIT 1`,
          )
          .get(
            id,
            captainAccount(data, c) || c,
            Date.now() - PRESENCE_TTL,
            Date.now(),
            ...(data.roomId ? [data.roomId] : []),
          )),
    ),
  )) as [boolean, boolean];
}
async function reconcile(data: ClubData) {
  let changed = false;
  for (const [id, d] of Object.entries(data.drafts)) {
    const before = JSON.stringify(d);
    reconcilePresence(d, await online(data, id));
    if (before !== JSON.stringify(d)) changed = true;
  }
  if (changed) {
    data.revision++;
    await saveClub(data);
  }
}
export async function snapshot(user: Account, roomId?: string) {
  return await transaction(async () => {
    if (roomId) user = await roomActor(user, roomId);
    const data = await loadClub(roomId);
    await reconcile(data);
    return await project(data, user);
  });
}
export async function project(data: ClubData, user: Account) {
  const store = structuredClone(data.store);
  const viewer = participantId(data, user.id);
  store.viewer = viewer;
  for (const m of store.matches) {
    const reveal = canSeeResults(m, viewer);
    m.serverVotingOpen = votingIsOpen(m);
    m.results = reveal
      ? Object.fromEntries(
          participants(m).map((id) => {
            const v = validVotes(m, id);
            return [
              id,
              {
                count: v.length,
                average:
                  v.length >= 3
                    ? v.reduce((s, v) => s + v.value, 0) / v.length
                    : null,
              },
            ];
          }),
        )
      : undefined;
    m.submittedBy =
      user.role === "organizer" ? Object.keys(m.ballots || {}) : undefined;
    m.votes = [];
    m.ballots = m.ballots?.[viewer] ? { [viewer]: m.ballots[viewer] } : {};
    m.drafts = m.drafts?.[viewer] ? { [viewer]: m.drafts[viewer] } : {};
  }
  const members = data.roomId
    ? user.role === "organizer"
      ? await db()
          .prepare(
            "SELECT a.id,a.name,CASE WHEN m.role='owner' THEN 'organizer' ELSE m.role END role,m.status FROM room_memberships m JOIN accounts a ON a.id=m.account_id WHERE m.room_id=? ORDER BY a.name",
          )
          .all(data.roomId)
      : []
    : user.role === "organizer"
      ? await db()
          .prepare(
            "SELECT id,email,name,role,status FROM accounts ORDER BY name",
          )
          .all()
      : [];
  return {
    store,
    drafts: data.drafts,
    revision: data.revision,
    online: Object.fromEntries(
      await Promise.all(
        Object.keys(data.drafts).map(async (id) => [
          id,
          await online(data, id),
        ]),
      ),
    ),
    members,
  };
}
const str = z.string().min(1).max(200);
const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("addParticipant"),
    name: z.string().trim().min(1).max(70),
    position: z.enum([
      "Goalkeeper",
      "Defender",
      "Midfielder",
      "Winger",
      "Forward",
    ]),
    match: str.optional(),
  }),
  z.object({ type: z.literal("linkParticipant"), player: str, account: str }),
  z.object({
    type: z.literal("participantRsvp"),
    match: str,
    player: str,
    value: z.enum(["going", "maybe", "out"]),
  }),
  z.object({
    type: z.literal("confirmPool"),
    match: str,
    players: z.array(str).min(14).max(30),
  }),
  z.object({
    type: z.literal("confirmPlayed"),
    match: str,
    players: z.array(str).min(2).max(30),
  }),
  z.object({
    type: z.literal("openVoting"),
    match: str,
    deadline: z.string().datetime(),
  }),
  z.object({
    type: z.literal("editMatch"),
    match: str,
    venue: z.string().trim().min(1).max(150),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    fee: z.number().min(0).max(1000000),
  }),
  z.object({
    type: z.literal("create"),
    venue: z.string().trim().min(1).max(150),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    fee: z.number().min(0).max(1000000),
  }),
  z.object({ type: z.literal("approve"), user: str }),
  z.object({
    type: z.literal("rsvp"),
    match: str,
    value: z.enum(["going", "maybe", "out"]),
  }),
  z.object({ type: z.literal("captains"), match: str, white: str, black: str }),
  z.object({
    type: z.literal("ready"),
    match: str,
    generation: z.number().int(),
  }),
  z.object({
    type: z.literal("pick"),
    match: str,
    player: str,
    picks: z.number().int(),
  }),
  z.object({
    type: z.literal("replace"),
    match: str,
    side: z.number().int().min(0).max(1),
    player: str,
  }),
  z.object({ type: z.literal("start"), match: str }),
  z.object({ type: z.literal("finish"), match: str }),
  z.object({
    type: z.literal("minutes"),
    match: str,
    minutes: z.number().int().min(1).max(180),
  }),
  z.object({
    type: z.literal("rotate"),
    match: str,
    side: z.number().int().min(0).max(1),
    off: str,
    on: str,
    minute: z.number().int().min(0).max(180),
  }),
  z.object({
    type: z.literal("goal"),
    match: str,
    scorer: str,
    assist: z.string(),
    minute: z.number().int().min(1).max(180).nullable(),
    ownGoal: z.boolean().optional(),
    assistStatus: z.enum(["recorded", "none", "unknown"]).optional(),
    id: z.string().optional(),
  }),
  z.object({ type: z.literal("removeGoal"), match: str, id: str }),
  z.object({
    type: z.literal("score"),
    match: str,
    white: z.number().int().min(0).max(99),
    black: z.number().int().min(0).max(99),
  }),
  z.object({
    type: z.literal("card"),
    match: str,
    player: str,
    kind: z.enum(["yellow", "red"]),
    minute: z.number().int().min(1).max(180),
  }),
  z.object({
    type: z.literal("voteDraft"),
    match: str,
    target: str,
    value: z.number().min(1).max(10).multipleOf(0.5),
  }),
  z.object({ type: z.literal("submit"), match: str }),
  z.object({ type: z.literal("closeVoting"), match: str }),
  z.object({
    type: z.literal("formation"),
    match: str,
    side: z.number().int().min(0).max(1),
    formation: z.enum(["2-3-1", "3-2-1", "2-2-2"]),
  }),
  z.object({
    type: z.literal("lineup"),
    match: str,
    side: z.number().int().min(0).max(1),
    off: str,
    on: str,
  }),
]);
const organizerActions = new Set([
  "addParticipant",
  "linkParticipant",
  "participantRsvp",
  "confirmPool",
  "confirmPlayed",
  "openVoting",
  "editMatch",
  "approve",
  "create",
  "captains",
  "replace",
  "start",
  "finish",
  "minutes",
  "rotate",
  "goal",
  "removeGoal",
  "score",
  "card",
  "closeVoting",
  "formation",
  "lineup",
]);
export async function command(actor: Account, input: unknown, roomId?: string) {
  const a = actionSchema.parse(input);
  return await transaction(async () => {
    if (roomId) actor = await roomActor(actor, roomId);
    if (actor.status !== "approved")
      throw Error("Organizer approval is required.");
    if (organizerActions.has(a.type) && actor.role !== "organizer")
      throw Error("Only organizers can change official match information.");
    const data = await loadClub(roomId);
    const actorPlayer = participantId(data, actor.id);
    await reconcile(data);
    if (a.type === "addParticipant") {
      if (data.store.players.length >= 100)
        throw Error("This room already has 100 participants.");
      const id = "guest-" + randomUUID();
      if (a.match) {
        const m = data.store.matches.find((m) => m.id === a.match);
        if (!m || m.status !== "scheduled" || data.drafts[m.id])
          throw Error("Add players to a match before its draft begins.");
        m.attendance[id] = "going";
        m.confirmed = undefined;
      }
      data.store.players.push({
        id,
        name: a.name,
        position: a.position,
        number: 0,
        guest: true,
      });
    } else if (a.type === "linkParticipant") {
      if (!roomId) throw Error("Choose a room.");
      const p = data.store.players.find((p) => p.id === a.player);
      if (!p?.guest || p.accountId)
        throw Error("Choose an unlinked participant.");
      const membership = await db()
        .prepare(
          "SELECT 1 FROM room_memberships m JOIN accounts a ON a.id=m.account_id WHERE m.room_id=? AND m.account_id=? AND m.status='approved' AND a.status!='suspended'",
        )
        .get(roomId, a.account);
      if (
        !membership ||
        data.store.players.some((p) => p.accountId === a.account)
      )
        throw Error(
          "Choose an approved account not already linked to another participant.",
        );
      if (
        data.store.matches.some(
          (m) =>
            m.ballots?.[p.id] || Object.keys(m.drafts?.[p.id] || {}).length,
        )
      )
        throw Error(
          "This participant already has voting activity; their identity cannot be reassigned.",
        );
      if (
        data.store.matches.some(
          (m) =>
            m.teams.flat().includes(a.account) ||
            m.confirmed?.includes(a.account) ||
            Object.hasOwn(m.attendance, a.account),
        )
      )
        throw Error(
          "This account already has match activity. Its history cannot be merged automatically.",
        );
      p.accountId = a.account;
      data.store.players = data.store.players.filter(
        (other) => other.id !== a.account,
      );
    } else if (a.type === "approve") {
      if (roomId) throw Error("Use the room membership controls.");
      const target = (await db()
        .prepare("SELECT id,name,status FROM accounts WHERE id=?")
        .get(a.user)) as
        { id: string; name: string; status: string } | undefined;
      if (!target || target.status !== "pending")
        throw Error("Select a pending member.");
      await db()
        .prepare("UPDATE accounts SET status='approved' WHERE id=?")
        .run(a.user);
      data.store.players.push({
        id: target.id,
        name: target.name,
        position: "Midfielder",
        number: data.store.players.length + 1,
      });
    } else if (a.type === "create") {
      if (
        Number.isNaN(Date.parse(a.date)) ||
        new Date(a.date).toISOString().slice(0, 10) !== a.date
      )
        throw Error("Choose a valid date.");
      const m = fixture(randomUUID(), a.date);
      m.venue = a.venue;
      m.time = a.time;
      m.fee = a.fee;
      m.ballots = {};
      data.store.matches.push(m);
    } else {
      const m = data.store.matches.find((m) => m.id === a.match);
      if (!m) throw Error("Match not found.");
      const d = data.drafts[m.id];
      switch (a.type) {
        case "editMatch":
          if (
            m.status !== "scheduled" ||
            !Number.isFinite(Date.parse(a.date)) ||
            new Date(a.date).toISOString().slice(0, 10) !== a.date
          )
            throw Error("Only valid upcoming fixtures can be edited.");
          m.venue = a.venue;
          m.date = a.date;
          m.time = a.time;
          m.fee = a.fee;
          break;
        case "confirmPool":
          if (m.status !== "scheduled" || d)
            throw Error("Confirm the pool before selecting captains.");
          if (
            new Set(a.players).size !== a.players.length ||
            a.players.length % 2 ||
            a.players.some(
              (id) =>
                m.attendance[id] !== "going" ||
                !data.store.players.some((p) => p.id === id),
            )
          )
            throw Error("Choose an even number of 14–30 Going room members.");
          m.confirmed = a.players;
          break;
        case "confirmPlayed":
          if (
            m.status !== "completed" ||
            m.eligibilityFrozen ||
            Object.keys(m.ballots || {}).length ||
            m.votes.length
          )
            throw Error("Eligibility is locked after voting opens.");
          if (
            new Set(a.players).size !== a.players.length ||
            a.players.some((id) => !m.teams.flat().includes(id))
          )
            throw Error("Choose actual participants from the assigned teams.");
          m.played = a.players;
          m.playedConfirmed = true;
          break;
        case "openVoting":
          if (
            m.status !== "completed" ||
            !m.playedConfirmed ||
            m.eligibilityFrozen
          )
            throw Error(
              "Confirm actual participation first. A locked window cannot be reopened.",
            );
          if (
            Date.parse(a.deadline) <= Date.now() ||
            Date.parse(a.deadline) > Date.now() + 30 * 86400000
          )
            throw Error("Choose a deadline within the next 30 days.");
          m.votingDeadline = a.deadline;
          m.eligibilityFrozen = true;
          m.voting = true;
          break;
        case "participantRsvp":
          if (m.status !== "scheduled" || d)
            throw Error("Attendance is locked once the draft starts.");
          if (!data.store.players.some((p) => p.id === a.player))
            throw Error("Choose a participant in this room.");
          m.attendance[a.player] = a.value;
          m.confirmed = undefined;
          break;
        case "rsvp":
          if (m.status !== "scheduled" || d)
            throw Error("Attendance is locked once captains are selected.");
          m.attendance[actorPlayer] = a.value;
          m.confirmed = undefined;
          break;
        case "captains":
          if (d)
            throw Error(
              "Captains are already selected. Use replacement to preserve the draft.",
            );
          if (roomId && !m.confirmed)
            throw Error("Confirm the draft pool first.");
          if (roomId) {
            await requireCaptainAccount(data, a.white);
            await requireCaptainAccount(data, a.black);
            const attendance = { ...m.attendance };
            m.attendance = Object.fromEntries(
              m.confirmed!.map((id) => [id, "going" as const]),
            );
            data.drafts[m.id] = createDraft(m, [a.white, a.black]);
            m.attendance = attendance;
          } else data.drafts[m.id] = createDraft(m, [a.white, a.black]);
          break;
        case "ready":
          if (!d) throw Error("Captains have not been selected.");
          readyCaptain(
            d,
            actorPlayer,
            await online(data, m.id),
            a.generation,
            () => randomInt(2),
          );
          break;
        case "pick":
          if (!d) throw Error("No draft.");
          pickPlayer(
            m,
            d,
            actorPlayer,
            a.player,
            await online(data, m.id),
            a.picks,
          );
          break;
        case "replace":
          if (!d) throw Error("No draft.");
          if (roomId && d.picks.length && !m.teams[a.side].includes(a.player))
            throw Error(
              "After picks begin, choose an already-drafted teammate.",
            );
          await requireCaptainAccount(data, a.player);
          replaceCaptain(m, d, a.side, a.player);
          break;
        case "start":
          if (d?.state !== "complete")
            throw Error("Complete the captain draft first.");
          startMatch(m);
          break;
        case "finish":
          finishMatch(m);
          if (roomId) {
            m.voting = false;
            m.votingDeadline = undefined;
            m.playedConfirmed = false;
            m.eligibilityFrozen = false;
          }
          break;
        case "minutes":
          logMinutes(m, a.minutes);
          break;
        case "rotate":
          if (a.minute < m.elapsed || a.minute >= m.duration)
            throw Error("Choose a valid rotation minute.");
          if (a.minute > m.elapsed) logMinutes(m, a.minute - m.elapsed);
          substitute(m, a.side, a.off, a.on);
          break;
        case "goal": {
          if (m.status === "scheduled")
            throw Error("Goals can be recorded during or after play.");
          if (a.id && !m.goals.some((g) => g.id === a.id))
            throw Error("Goal no longer exists.");
          const status = m.status;
          m.status = "live";
          if (a.id) m.goals = m.goals.filter((g) => g.id !== a.id);
          addGoal(m, a.scorer, a.assist, a.minute, a.ownGoal, a.assistStatus);
          m.status = status;
          break;
        }
        case "removeGoal":
          if (m.status === "scheduled") throw Error("Match has not started.");
          m.goals = m.goals.filter((g) => g.id !== a.id);
          break;
        case "score":
          if (m.status === "scheduled") throw Error("Match has not started.");
          m.officialScore = [a.white, a.black];
          break;
        case "card": {
          const status = m.status;
          if (status === "scheduled") throw Error("Match has not started.");
          m.status = "live";
          addCard(m, a.player, a.kind, a.minute);
          m.status = status;
          break;
        }
        case "voteDraft":
          saveDraft(m, actorPlayer, a.target, a.value);
          break;
        case "submit":
          submitBallot(m, actorPlayer);
          break;
        case "closeVoting":
          if (m.status !== "completed") throw Error("Match has not finished.");
          m.voting = false;
          break;
        case "formation":
          if (m.status !== "scheduled" || d?.state !== "complete")
            throw Error("Complete the draft and set formation before kickoff.");
          m.formations ??= ["2-3-1", "2-3-1"];
          m.formations[a.side] = a.formation;
          break;
        case "lineup":
          if (
            m.status !== "scheduled" ||
            d?.state !== "complete" ||
            !m.active[a.side].includes(a.off) ||
            m.active[a.side].includes(a.on) ||
            !m.teams[a.side].includes(a.on)
          )
            throw Error(
              "Choose an active player and a rotating teammate before kickoff.",
            );
          m.active[a.side][m.active[a.side].indexOf(a.off)] = a.on;
          break;
      }
    }
    data.revision++;
    await saveClub(data);
    if (roomId)
      await db()
        .prepare(
          "INSERT INTO room_audit(room_id,actor,action,created) VALUES(?,?,?,?)",
        )
        .run(
          roomId,
          actor.id,
          a.type === "voteDraft" || a.type === "submit"
            ? a.type
            : JSON.stringify(a),
          Date.now(),
        );
    else
      await db()
        .prepare("INSERT INTO audit(actor,action,created) VALUES(?,?,?)")
        .run(actor.id, a.type, Date.now());
    return await project(data, actor);
  });
}
export async function heartbeat(
  user: Account,
  token: string,
  match: string,
  leave = false,
  roomId?: string,
) {
  return await transaction(async () => {
    if (roomId) user = await roomActor(user, roomId);
    const data = await loadClub(roomId);
    if (!data.store.matches.some((m) => m.id === match))
      throw Error("Match not found.");
    // Detect an expired lease before renewing it; reconnecting never silently resumes a draft.
    await reconcile(data);
    if (roomId) {
      if (leave)
        await db()
          .prepare(
            "DELETE FROM room_presence WHERE room_id=? AND session=? AND match_id=?",
          )
          .run(roomId, token, match);
      else
        await db()
          .prepare(
            "INSERT INTO room_presence VALUES(?,?,?,?) ON CONFLICT(room_id,session,match_id) DO UPDATE SET seen=excluded.seen",
          )
          .run(roomId, token, match, Date.now());
    } else if (leave)
      await db()
        .prepare("DELETE FROM presence WHERE session=? AND match_id=?")
        .run(token, match);
    else
      await db()
        .prepare(
          "INSERT INTO presence VALUES(?,?,?) ON CONFLICT(session,match_id) DO UPDATE SET seen=excluded.seen",
        )
        .run(token, match, Date.now());
    await reconcile(data);
    return await project(data, user);
  });
}

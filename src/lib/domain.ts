import { z } from "zod";
export const playerSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(70),
  position: z.string(),
  number: z.number(),
  portrait: z.string().optional(),
  username: z.string().optional(),
  guest: z.boolean().optional(),
  accountId: z.string().optional(),
});
const rsvp = z.enum(["going", "maybe", "out"]);
export const matchSchema = z.object({
  id: z.string(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) =>
        !Number.isNaN(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v,
    ),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  venue: z.string(),
  duration: z.number().min(20).max(180),
  fee: z.number().nonnegative(),
  status: z.enum(["scheduled", "live", "completed"]),
  attendance: z.record(z.string(), rsvp),
  teams: z.array(z.array(z.string())).length(2),
  active: z.array(z.array(z.string())).length(2),
  captains: z.array(z.string()).length(2),
  minutes: z.record(z.string(), z.number()),
  elapsed: z.number(),
  confirmed: z.array(z.string()).optional(),
  playedConfirmed: z.boolean().optional(),
  eligibilityFrozen: z.boolean().optional(),
  submittedBy: z.array(z.string()).optional(),
  paid: z.array(z.string()),
  goals: z.array(
    z.object({
      id: z.string(),
      scorer: z.string(),
      assist: z.string(),
      side: z.number().int().min(0).max(1),
      minute: z.number().nullable(),
      ownGoal: z.boolean().optional(),
      assistStatus: z.enum(["recorded", "none", "unknown"]).optional(),
    }),
  ),
  formations: z
    .array(z.enum(["2-3-1", "3-2-1", "2-2-2"]))
    .length(2)
    .optional(),
  kickoff: z.array(z.array(z.string())).length(2).optional(),
  played: z.array(z.string()).optional(),
  rotations: z
    .array(
      z.object({
        id: z.string(),
        minute: z.number().nonnegative(),
        side: z.number().int().min(0).max(1),
        off: z.string(),
        on: z.string(),
      }),
    )
    .optional(),
  cards: z
    .array(
      z.object({
        id: z.string(),
        player: z.string(),
        kind: z.enum(["yellow", "red"]),
        minute: z.number().int().positive(),
      }),
    )
    .optional(),
  ballots: z.record(z.string(), z.string().datetime()).optional(),
  drafts: z
    .record(
      z.string(),
      z.record(z.string(), z.number().min(1).max(10).multipleOf(0.5)),
    )
    .optional(),
  officialScore: z
    .tuple([z.number().int().min(0).max(99), z.number().int().min(0).max(99)])
    .optional(),
  results: z
    .record(
      z.string(),
      z.object({
        count: z.number().int().nonnegative(),
        average: z.number().nullable(),
      }),
    )
    .optional(),
  votingDeadline: z.string().datetime().optional(),
  voting: z.boolean(),
  serverVotingOpen: z.boolean().optional(),
  votes: z.array(
    z.object({
      voter: z.string(),
      target: z.string(),
      value: z.number().min(1).max(10).multipleOf(0.5),
    }),
  ),
});
export const storeSchema = z
  .object({
    version: z.literal(1),
    club: z.string().min(1),
    viewer: z.string(),
    players: z.array(playerSchema).min(1),
    matches: z.array(matchSchema),
  })
  .superRefine((s, ctx) => {
    const ids = new Set(s.players.map((p) => p.id));
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (ids.size !== s.players.length || !ids.has(s.viewer))
      issue("Invalid member identity.");
    if (new Set(s.matches.map((m) => m.id)).size !== s.matches.length)
      issue("Duplicate fixture.");
    for (const m of s.matches) {
      const pool = m.teams.flat();
      if (new Set(pool).size !== pool.length || pool.some((id) => !ids.has(id)))
        issue("Invalid team assignment.");
      m.teams.forEach((team, side) => {
        if (
          m.active[side].length > 7 ||
          new Set(m.active[side]).size !== m.active[side].length ||
          m.active[side].some((id) => !team.includes(id))
        )
          issue("Invalid active lineup.");
        if (team.length && !team.includes(m.captains[side]))
          issue("Captain must belong to the side.");
      });
      if (m.elapsed < 0 || m.elapsed > m.duration)
        issue("Invalid elapsed time.");
      if (
        m.goals.some(
          (g) =>
            !m.teams[g.ownGoal ? 1 - g.side : g.side].includes(g.scorer) ||
            (g.assist &&
              (g.assist === g.scorer || !m.teams[g.side].includes(g.assist))) ||
            (g.minute !== null && (g.minute < 1 || g.minute > m.duration)),
        )
      )
        issue("Invalid goal event.");
      if (
        m.kickoff &&
        m.kickoff.some(
          (lineup, side) =>
            lineup.length !== 7 ||
            new Set(lineup).size !== 7 ||
            lineup.some((id) => !m.teams[side].includes(id)),
        )
      )
        issue("Invalid kickoff snapshot.");
      if (
        m.played &&
        (new Set(m.played).size !== m.played.length ||
          m.played.some((id) => !pool.includes(id)))
      )
        issue("Invalid participation record.");
      if (
        (m.rotations || []).some(
          (r) =>
            r.minute > m.elapsed ||
            r.on === r.off ||
            !m.teams[r.side].includes(r.on) ||
            !m.teams[r.side].includes(r.off),
        )
      )
        issue("Invalid rotation record.");
      if (
        (m.cards || []).some(
          (c) => !pool.includes(c.player) || c.minute > m.duration,
        )
      )
        issue("Invalid card record.");
      for (const voter of Object.keys(m.ballots || {})) {
        const played = participants(m);
        const targets = played.filter((id) => id !== voter);
        const votes = m.votes.filter((v) => v.voter === voter);
        if (
          m.status !== "completed" ||
          !played.includes(voter) ||
          !targets.length ||
          votes.length !== targets.length ||
          targets.some((id) => !votes.some((v) => v.target === id))
        )
          issue("Invalid complete ballot.");
        if (m.drafts?.[voter]) issue("Submitted ballots cannot retain drafts.");
      }
      for (const [voter, draft] of Object.entries(m.drafts || {})) {
        if (
          !participants(m).includes(voter) ||
          Object.keys(draft).some(
            (id) => id === voter || !participants(m).includes(id),
          )
        )
          issue("Invalid draft participants.");
      }
      const keys = m.votes.map((v) => `${v.voter}:${v.target}`);
      if (
        new Set(keys).size !== keys.length ||
        m.votes.some(
          (v) =>
            v.voter === v.target ||
            !pool.includes(v.voter) ||
            !pool.includes(v.target),
        )
      )
        issue("Invalid peer votes.");
    }
  });
export type Player = z.infer<typeof playerSchema>;
export type Match = z.infer<typeof matchSchema>;
export type Store = z.infer<typeof storeSchema>;
export function fixture(id: string, date = "2026-10-23"): Match {
  return {
    id,
    date,
    time: "20:30",
    venue: "North Arena, Bashundhara · sample venue",
    duration: 70,
    fee: 5400,
    status: "scheduled",
    attendance: {},
    teams: [[], []],
    active: [[], []],
    captains: ["", ""],
    minutes: {},
    elapsed: 0,
    paid: [],
    goals: [],
    formations: ["2-3-1", "2-3-1"],
    rotations: [],
    cards: [],
    voting: false,
    votes: [],
  };
}
export function votingIsOpen(m: Match, now = Date.now()) {
  if (m.serverVotingOpen !== undefined)
    return m.status === "completed" && m.serverVotingOpen;
  return (
    m.status === "completed" &&
    m.voting &&
    (!m.votingDeadline || now < Date.parse(m.votingDeadline))
  );
}
export function participants(m: Match) {
  return m.played ?? m.teams.flat().filter((id) => (m.minutes[id] || 0) > 0);
}
export function validVotes(m: Match, id: string) {
  const pool = participants(m);
  const unique = new Map<string, Match["votes"][number]>();
  for (const v of m.votes) {
    if (
      (!m.ballots || !!m.ballots[v.voter]) &&
      v.target === id &&
      v.voter !== id &&
      pool.includes(v.voter) &&
      pool.includes(id) &&
      Number.isFinite(v.value) &&
      v.value >= 1 &&
      v.value <= 10 &&
      (v.value * 2) % 1 === 0
    )
      unique.set(v.voter, v);
  }
  return [...unique.values()];
}
export function rating(m: Match, id: string, now = Date.now()) {
  if (m.results)
    return votingIsOpen(m, now) ? null : (m.results[id]?.average ?? null);
  const v = validVotes(m, id);
  return m.status !== "completed" || votingIsOpen(m, now) || v.length < 3
    ? null
    : v.reduce((sum, v) => sum + v.value, 0) / v.length;
}
export function playerOfMatch(m: Match, now = Date.now()) {
  const candidates = participants(m)
    .map((id) => ({ id, value: rating(m, id, now) }))
    .filter((p): p is { id: string; value: number } => p.value !== null);
  const max = Math.max(...candidates.map((p) => p.value));
  return candidates.filter((p) => p.value === max).map((p) => p.id);
}
export function score(m: Match, side: number) {
  return (
    m.officialScore?.[side] ?? m.goals.filter((g) => g.side === side).length
  );
}
export function stats(s: Store, id: string) {
  const matches = s.matches.filter(
    (m) => m.status === "completed" && participants(m).includes(id),
  );
  const rr = matches
    .map((m) => (canSeeResults(m, s.viewer) ? rating(m, id) : null))
    .filter((n): n is number => n !== null);
  return {
    appearances: matches.length,
    goals: matches.reduce(
      (n, m) => n + m.goals.filter((g) => g.scorer === id && !g.ownGoal).length,
      0,
    ),
    assists: matches.reduce(
      (n, m) => n + m.goals.filter((g) => g.assist === id).length,
      0,
    ),
    minutes: matches.reduce((n, m) => n + (m.minutes[id] || 0), 0),
    wins: matches.filter(
      (m) =>
        score(m, m.teams[0].includes(id) ? 0 : 1) >
        score(m, m.teams[0].includes(id) ? 1 : 0),
    ).length,
    captainWins: matches.filter(
      (m) =>
        m.captains.includes(id) &&
        score(m, m.captains.indexOf(id)) > score(m, 1 - m.captains.indexOf(id)),
    ).length,
    rating: rr.length
      ? Number((rr.reduce((a, b) => a + b, 0) / rr.length).toFixed(1))
      : 0,
  };
}
export function balance(m: Match, s: Store) {
  const ids = s.players
    .filter((p) => m.attendance[p.id] === "going")
    .map((p) => p.id)
    .sort((a, b) => stats(s, b).rating - stats(s, a).rating);
  if (m.status !== "scheduled") throw Error("Teams are locked after kickoff.");
  m.teams = [[], []];
  ids.forEach((id, i) => m.teams[[0, 1, 1, 0][i % 4]].push(id));
  m.active = m.teams.map((t) => {
    const positions = [
      "Goalkeeper",
      "Defender",
      "Defender",
      "Winger",
      "Midfielder",
      "Winger",
      "Forward",
    ];
    const remaining = [...t];
    return positions
      .map((pos) => {
        const found = remaining.findIndex(
          (id) => s.players.find((p) => p.id === id)?.position === pos,
        );
        return remaining.splice(found < 0 ? 0 : found, 1)[0];
      })
      .filter(Boolean);
  });
  m.kickoff = undefined;
  m.captains = m.teams.map((t) => t[0] || "");
}
export function startMatch(m: Match) {
  if (
    m.status !== "scheduled" ||
    m.active.some((t) => t.length !== 7) ||
    new Set(m.active.flat()).size !== 14
  )
    throw Error("Choose seven unique active players on each side first.");
  m.status = "live";
  m.kickoff = m.active.map((t) => [...t]);
  m.played = [...m.active.flat()];
  m.elapsed = 0;
  m.minutes = {};
  m.rotations = [];
}
export function logMinutes(m: Match, amount: number) {
  if (
    m.status !== "live" ||
    !Number.isInteger(amount) ||
    amount < 1 ||
    m.elapsed + amount > m.duration
  )
    throw Error("Enter minutes within the remaining match duration.");
  m.active
    .flat()
    .forEach((id) => (m.minutes[id] = (m.minutes[id] || 0) + amount));
  m.played = [
    ...new Set([
      ...(m.played ?? m.teams.flat().filter((id) => (m.minutes[id] || 0) > 0)),
      ...m.active.flat(),
    ]),
  ];
  m.elapsed += amount;
}
export function substitute(m: Match, side: number, off: string, on: string) {
  if (
    m.status !== "live" ||
    m.elapsed >= m.duration ||
    !m.active[side]?.includes(off) ||
    m.active[side].includes(on) ||
    !m.teams[side].includes(on)
  )
    throw Error(
      "Choose an active player and a rotating teammate before full time.",
    );
  m.active[side] = m.active[side].map((id) => (id === off ? on : id));
  m.played = [
    ...new Set([
      ...(m.played ?? m.teams.flat().filter((id) => (m.minutes[id] || 0) > 0)),
      on,
    ]),
  ];
  m.rotations ??= [];
  m.rotations.push({
    id: crypto.randomUUID(),
    minute: m.elapsed,
    side,
    off,
    on,
  });
}
export function rotate(m: Match) {
  if (m.status !== "live" || m.elapsed >= m.duration) return;
  // Existing live records have no historical kickoff snapshot; never invent one.
  logMinutes(m, Math.min(10, m.duration - m.elapsed));
  if (m.elapsed === m.duration) return;
  m.teams.forEach((team, side) => {
    const resting = team
      .filter((id) => !m.active[side].includes(id))
      .sort((a, b) => (m.minutes[a] || 0) - (m.minutes[b] || 0))
      .slice(0, 7);
    const outgoing = [...m.active[side]]
      .sort((a, b) => (m.minutes[b] || 0) - (m.minutes[a] || 0))
      .slice(0, resting.length);
    resting.forEach((on, i) => substitute(m, side, outgoing[i], on));
  });
}
export function finishMatch(m: Match, now = Date.now()) {
  if (m.status !== "live") throw Error("Start the match first.");
  m.status = "completed";
  m.voting = true;
  m.votingDeadline = new Date(now + 48 * 60 * 60 * 1000).toISOString();
}
export function addCard(
  m: Match,
  player: string,
  kind: "yellow" | "red",
  minute: number,
) {
  if (
    m.status !== "live" ||
    !m.teams.flat().includes(player) ||
    !Number.isInteger(minute) ||
    minute < 1 ||
    minute > m.duration
  )
    throw Error("Choose a participant and valid minute.");
  m.cards ??= [];
  m.cards.push({ id: crypto.randomUUID(), player, kind, minute });
}
export function addGoal(
  m: Match,
  scorer: string,
  assist: string,
  minute: number | null,
  ownGoal = false,
  assistStatus: "recorded" | "none" | "unknown" = assist ? "recorded" : "none",
) {
  const side = m.teams.findIndex((t) => t.includes(scorer));
  if (
    m.status !== "live" ||
    side < 0 ||
    (minute !== null &&
      (!Number.isInteger(minute) || minute < 1 || minute > m.duration))
  )
    throw Error("Choose a participant and a valid match minute.");
  if (ownGoal && assist) throw Error("Own goals cannot credit an assist.");
  if (assist && (assist === scorer || !m.teams[side].includes(assist)))
    throw Error("The assist must be a different player on the same side.");
  m.goals.push({
    id: crypto.randomUUID(),
    scorer,
    assist,
    side: ownGoal ? 1 - side : side,
    minute,
    ownGoal,
    assistStatus,
  });
}
export function vote(
  m: Match,
  voter: string,
  target: string,
  value: number,
  now = Date.now(),
) {
  if (
    !!m.ballots?.[voter] ||
    m.status !== "completed" ||
    !votingIsOpen(m, now) ||
    voter === target ||
    ![voter, target].every((id) => participants(m).includes(id)) ||
    !Number.isFinite(value) ||
    value < 1 ||
    value > 10 ||
    (value * 2) % 1
  )
    throw Error(
      "Only participants may rate another participant, from 1–10 in half points.",
    );
  m.votes = m.votes.filter((v) => !(v.voter === voter && v.target === target));
  m.votes.push({ voter, target, value });
}
// These checks model product rules only. Browser data is not a security boundary.
export function canSeeResults(m: Match, viewer: string) {
  return (
    m.status === "completed" &&
    participants(m).includes(viewer) &&
    !!m.ballots?.[viewer]
  );
}
export function communityRating(m: Match, target: string, viewer: string) {
  if (m.results)
    return canSeeResults(m, viewer)
      ? (m.results[target]?.average ?? null)
      : null;
  const votes = validVotes(m, target);
  return !canSeeResults(m, viewer) || votes.length < 3
    ? null
    : votes.reduce((sum, v) => sum + v.value, 0) / votes.length;
}
export function ballotTargets(m: Match, viewer: string) {
  return participants(m).filter((id) => id !== viewer);
}
export function saveDraft(
  m: Match,
  viewer: string,
  target: string,
  value: number,
  now = Date.now(),
) {
  if (
    !votingIsOpen(m, now) ||
    m.ballots?.[viewer] ||
    !participants(m).includes(viewer) ||
    !ballotTargets(m, viewer).includes(target)
  )
    throw Error("This ballot is locked or you are not eligible to rate.");
  if (!Number.isFinite(value) || value < 1 || value > 10 || (value * 2) % 1)
    throw Error("Choose 1–10 in half points.");
  m.drafts ??= {};
  m.drafts[viewer] ??= {};
  m.drafts[viewer][target] = value;
}
export function submitBallot(m: Match, viewer: string, now = Date.now()) {
  if (
    !votingIsOpen(m, now) ||
    m.ballots?.[viewer] ||
    !participants(m).includes(viewer)
  )
    throw Error("This ballot is locked or voting is closed.");
  const targets = ballotTargets(m, viewer),
    draft = m.drafts?.[viewer] || {};
  if (
    !targets.length ||
    Object.keys(draft).length !== targets.length ||
    targets.some(
      (id) =>
        !Number.isFinite(draft[id]) ||
        draft[id] < 1 ||
        draft[id] > 10 ||
        (draft[id] * 2) % 1,
    )
  )
    throw Error("Rate every other actual participant before submitting.");
  const votes = targets.map((target) => ({
    voter: viewer,
    target,
    value: draft[target],
  }));
  m.votes = [...m.votes.filter((v) => v.voter !== viewer), ...votes];
  m.ballots ??= {};
  m.ballots[viewer] = new Date(now).toISOString();
  delete m.drafts?.[viewer];
}
export function seed(): Store {
  const names = [
    "Rafi Hasan",
    "Sajid Rahman",
    "Fahim Ahmed",
    "Tahmid Islam",
    "Nafis Chowdhury",
    "Arham Khan",
    "Rakin Mahmud",
    "Ayon Karim",
    "Shahriar Nabil",
    "Tanvir Hossain",
    "Mahin Rashid",
    "Zayan Rahman",
    "Abrar Fahim",
    "Ishraq Hossain",
    "Sadman Sakib",
    "Farhan Noor",
    "Rifat Ahmed",
    "Mehedi Hasan",
    "Rayhan Kabir",
    "Adnan Sami",
    "Raiyan Ahmed",
    "Zarif Hossain",
  ];
  const s: Store = {
    version: 1,
    club: "Team Tong",
    viewer: "p1",
    players: names.map((name, i) => ({
      id: `p${i + 1}`,
      name,
      number: i + 1,
      position: [
        "Midfielder",
        "Forward",
        "Defender",
        "Winger",
        "Midfielder",
        "Goalkeeper",
      ][i % 6],
    })),
    matches: [],
  };
  for (let j = 0; j < 4; j++) {
    const m = fixture(
      `m${j + 1}`,
      ["2026-10-23", "2026-10-17", "2026-10-10", "2026-10-03"][j],
    );
    s.players.forEach(
      (p, i) =>
        (m.attendance[p.id] = i < 18 ? "going" : i < 20 ? "maybe" : "out"),
    );
    balance(m, s);
    if (j) {
      startMatch(m);
      while (m.elapsed < m.duration) rotate(m);
      for (let i = 0; i < 10 - j; i++) {
        const side = i % 2;
        const team = m.teams[side];
        m.goals.push({
          id: `g${j}-${i}`,
          scorer: team[(i + j) % 9],
          assist: team[(i + j + 2) % 9],
          side,
          minute: 5 + i * 7,
        });
      }
      m.status = "completed";
      m.cards = [
        {
          id: `card-${j}`,
          player: m.teams[j % 2][2],
          kind: "yellow",
          minute: 33,
        },
      ];
      for (const target of m.teams.flat())
        for (const voter of m.teams
          .flat()
          .filter((p) => p !== target)
          .slice(0, 4))
          m.votes.push({
            target,
            voter,
            value: 6.5 + ((Number(target.slice(1)) + j) % 7) / 2,
          });
      m.paid = m.teams.flat();
    }
    s.matches.push(m);
  }
  return s;
}
export function ratingSample(): Match {
  const s = seed();
  const m = s.matches.find((m) => m.status === "completed")!;
  // Complete fictional ballots from four peers; the default viewer has not voted.
  m.votes = [];
  m.ballots = {};
  m.drafts = {};
  m.voting = true;
  m.votingDeadline = new Date(Date.now() + 48 * 3600000).toISOString();
  for (const voter of participants(m)
    .filter((id) => id !== s.viewer)
    .slice(0, 4)) {
    for (const target of ballotTargets(m, voter))
      saveDraft(
        m,
        voter,
        target,
        6.5 + ((Number(target.slice(1)) + 1) % 7) / 2,
      );
    submitBallot(m, voter);
  }
  return m;
}
export function dateLabel(m: Match) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    weekday: "short",
    timeZone: "Asia/Dhaka",
  }).format(new Date(`${m.date}T${m.time}:00+06:00`));
}

export function voteCount(m: Match, id: string) {
  return m.results?.[id]?.count ?? validVotes(m, id).length;
}

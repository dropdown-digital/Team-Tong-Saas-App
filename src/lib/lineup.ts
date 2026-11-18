import type { Match, Player } from "./domain";
export type Formation = "2-3-1" | "3-2-1" | "2-2-2";
export const FORMATIONS: Record<
  Formation,
  { label: string; x: number; y: number }[]
> = {
  "2-3-1": [
    { label: "GK", x: 50, y: 88 },
    { label: "LCB", x: 29, y: 66 },
    { label: "RCB", x: 71, y: 66 },
    { label: "LM", x: 17, y: 40 },
    { label: "CM", x: 50, y: 43 },
    { label: "RM", x: 83, y: 40 },
    { label: "ST", x: 50, y: 16 },
  ],
  "3-2-1": [
    { label: "GK", x: 50, y: 88 },
    { label: "LB", x: 17, y: 66 },
    { label: "CB", x: 50, y: 66 },
    { label: "RB", x: 83, y: 66 },
    { label: "LCM", x: 29, y: 41 },
    { label: "RCM", x: 71, y: 41 },
    { label: "ST", x: 50, y: 16 },
  ],
  "2-2-2": [
    { label: "GK", x: 50, y: 88 },
    { label: "LCB", x: 29, y: 66 },
    { label: "RCB", x: 71, y: 66 },
    { label: "LM", x: 29, y: 42 },
    { label: "RM", x: 71, y: 42 },
    { label: "LS", x: 29, y: 16 },
    { label: "RS", x: 71, y: 16 },
  ],
};
export const teamName = (side: number) =>
  side === 0 ? "Team White" : "Team Black";
export function initials(p: Player) {
  return p.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}
export function ratingColor(value: number | null) {
  return value === null
    ? "unrated"
    : value >= 9
      ? "excellent"
      : value >= 7
        ? "good"
        : "lower";
}
export function setSlot(m: Match, side: number, index: number, id: string) {
  if (
    m.status !== "scheduled" ||
    m.active[side]?.length !== 7 ||
    !m.teams[side]?.includes(id) ||
    index < 0 ||
    index >= 7
  )
    throw Error("Only assigned players can be chosen before kickoff.");
  const previous = m.active[side][index];
  const current = m.active[side].indexOf(id);
  if (current >= 0) m.active[side][current] = previous;
  m.active[side][index] = id;
}
export function contributions(m: Match, id: string) {
  return {
    goals: m.goals.filter((g) => g.scorer === id && !g.ownGoal).length,
    assists: m.goals.filter((g) => g.assist === id).length,
    cards: (m.cards || []).filter((c) => c.player === id),
    minutes: m.minutes[id] ?? "Not tracked",
  };
}
export function matchEvents(m: Match) {
  return [
    ...m.goals.map((g) => ({
      id: g.id,
      minute: g.minute,
      type: "goal" as const,
      player: g.scorer,
      assist: g.assist,
      side: g.side,
      ownGoal: g.ownGoal,
      assistStatus: g.assistStatus,
    })),
    ...(m.cards || []).map((c) => ({
      id: c.id,
      minute: c.minute,
      type: c.kind,
      player: c.player,
      side: m.teams.findIndex((t) => t.includes(c.player)),
    })),
    ...(m.rotations || []).map((r) => ({
      id: r.id,
      minute: r.minute,
      type: "rotation" as const,
      player: r.on,
      off: r.off,
      side: r.side,
    })),
  ].sort((a, b) => (a.minute ?? Infinity) - (b.minute ?? Infinity));
}

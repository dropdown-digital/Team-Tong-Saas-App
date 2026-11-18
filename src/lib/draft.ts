import type { Match } from "./domain";
export type CaptainDraft = {
  state: "waiting" | "active" | "paused" | "complete";
  pool: string[];
  captains: [string, string];
  ready: [boolean, boolean];
  first: number | null;
  tossCaptain: string | null;
  turn: number;
  picks: { side: number; player: string }[];
  generation: number;
};
export const PRESENCE_TTL = 15000;
export function createDraft(
  m: Match,
  captains: [string, string],
): CaptainDraft {
  const pool = Object.keys(m.attendance).filter(
    (id) => m.attendance[id] === "going",
  );
  if (
    m.status !== "scheduled" ||
    pool.length < 14 ||
    pool.length > 30 ||
    pool.length % 2 !== 0
  )
    throw Error(
      "Confirm an even number of 14–30 participants before selecting captains.",
    );
  if (captains[0] === captains[1] || captains.some((id) => !pool.includes(id)))
    throw Error("Choose two different confirmed participants.");
  m.teams = [[captains[0]], [captains[1]]];
  m.captains = [...captains];
  m.active = [[], []];
  return {
    state: "waiting",
    pool,
    captains,
    ready: [false, false],
    first: null,
    tossCaptain: null,
    turn: 0,
    picks: [],
    generation: 0,
  };
}
export function reconcilePresence(d: CaptainDraft, online: [boolean, boolean]) {
  if (d.state === "complete") return;
  if (
    !online.every(Boolean) &&
    (d.state === "active" || d.ready.some(Boolean))
  ) {
    d.state = "paused";
    d.ready = [false, false];
    d.generation++;
  }
}
export function readyCaptain(
  d: CaptainDraft,
  actor: string,
  online: [boolean, boolean],
  generation: number,
  coin: () => number,
) {
  if (d.state === "complete") throw Error("Draft is already complete.");
  if (generation !== d.generation)
    throw Error(
      "Draft paused or changed. Refresh and confirm readiness again.",
    );
  const side = d.captains.indexOf(actor);
  if (side < 0) throw Error("Only a current captain may press Ready.");
  if (!online.every(Boolean))
    throw Error("Both captains must be connected before pressing Ready.");
  d.ready[side] = true;
  if (d.ready.every(Boolean)) {
    if (d.first === null) {
      d.first = coin();
      if (d.first !== 0 && d.first !== 1) throw Error("Invalid coin toss.");
      d.turn = d.first;
      d.tossCaptain = d.captains[d.first];
    }
    d.state = "active";
  }
}
export function pickPlayer(
  m: Match,
  d: CaptainDraft,
  actor: string,
  player: string,
  online: [boolean, boolean],
  expectedPicks: number,
) {
  if (d.state !== "active" || !online.every(Boolean) || !d.ready.every(Boolean))
    throw Error(
      "Draft is paused until both captains reconnect and press Ready.",
    );
  if (expectedPicks !== d.picks.length)
    throw Error(
      "The draft changed. Review the latest pick before trying again.",
    );
  if (actor !== d.captains[d.turn])
    throw Error("It is the other captain’s turn.");
  if (
    !d.pool.includes(player) ||
    m.attendance[player] !== "going" ||
    m.teams.flat().includes(player)
  )
    throw Error("Select a confirmed, undrafted participant.");
  if (m.teams[d.turn].length >= d.pool.length / 2)
    throw Error("This team is full.");
  m.teams[d.turn].push(player);
  d.picks.push({ side: d.turn, player });
  d.turn = 1 - d.turn;
  if (m.teams.flat().length === d.pool.length) {
    d.state = "complete";
    m.active = m.teams.map((t) => t.slice(0, 7));
  }
}
export function replaceCaptain(
  m: Match,
  d: CaptainDraft,
  side: number,
  replacement: string,
) {
  if (d.state === "complete" || ![0, 1].includes(side))
    throw Error("Replacement is available during an unfinished draft.");
  if (
    !d.pool.includes(replacement) ||
    m.attendance[replacement] !== "going" ||
    d.captains.includes(replacement)
  )
    throw Error("Choose another confirmed participant.");
  if (m.teams[1 - side].includes(replacement))
    throw Error(
      "Choose a teammate or an undrafted participant. Moving an opponent would undo an existing assignment.",
    );
  if (!m.teams[side].includes(replacement)) {
    m.teams[side][0] = replacement;
  } // Only the reserved captain seat changes; all draft picks remain untouched.
  d.captains[side] = replacement;
  m.captains[side] = replacement;
  d.ready = [false, false];
  d.state = "paused";
  d.generation++;
}

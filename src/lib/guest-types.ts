import type { CaptainDraft } from "./draft";
import type { Player, Match } from "./domain";
export type GuestMatch = Pick<
  Match,
  "id" | "date" | "time" | "venue" | "status" | "teams"
> & {
  score: [number, number];
  draft: CaptainDraft | null;
  online: [boolean, boolean];
};
export type GuestView = {
  room: { id: string; name: string };
  players: Pick<Player, "id" | "name" | "position" | "number">[];
  matches: GuestMatch[];
};

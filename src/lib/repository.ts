import { seed, storeSchema, type Store } from "./domain";
// Replace this boundary with authenticated Supabase queries in Phase 2.
export interface ClubRepository {
  load(): Promise<Store>;
  save(state: Store): void;
}
export const demoRepository: ClubRepository = {
  async load() {
    const raw = localStorage.getItem("team-tong-phase1");
    const state = raw ? storeSchema.parse(JSON.parse(raw)) : seed();
    // Legacy individual votes are retained in backups but are not complete ballots.
    for (const match of state.matches) match.ballots ??= {};
    return state;
  },
  save(state) {
    localStorage.setItem("team-tong-phase1", JSON.stringify(state));
  },
};

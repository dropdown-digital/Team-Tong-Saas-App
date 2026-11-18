"use client";
import { useState } from "react";
import {
  type Store,
  stats,
  participants,
  canSeeResults,
  rating,
  score,
  playerOfMatch,
} from "@/lib/domain";
import { PlayerPortrait } from "./match-center/PlayerMarker";
export function RoomPlayers({
  store,
  roomId,
  selected,
}: {
  store: Store;
  roomId: string;
  selected?: string;
}) {
  const [month, setMonth] = useState(""),
    [sort, setSort] = useState<"goals" | "assists" | "appearances" | "wins">(
      "goals",
    );
  const filtered = {
    ...store,
    matches: store.matches.filter((m) => !month || m.date.startsWith(month)),
  };
  const players = [...store.players].sort(
    (a, b) => stats(filtered, b.id)[sort] - stats(filtered, a.id)[sort],
  );
  return (
    <section className="panel">
      <span className="eyebrow">THIS ROOM ONLY</span>
      <h2>Players & leaderboards</h2>
      <div className="form-grid">
        <label>
          Month (blank = all history)
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <label>
          Order by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            <option value="goals">Goals</option>
            <option value="assists">Assists</option>
            <option value="appearances">Appearances</option>
            <option value="wins">Wins</option>
          </select>
        </label>
      </div>
      <p>
        Ratings use only final matches whose results you have personally
        unlocked. Hidden ratings never enter these summaries.
      </p>
      {!players.length && <p>No approved players yet.</p>}
      {players.map((p) => {
        const s = stats(filtered, p.id),
          matches = filtered.matches.filter(
            (m) => m.status === "completed" && participants(m).includes(p.id),
          );
        const draws = matches.filter((m) => score(m, 0) === score(m, 1)).length;
        return (
          <details
            id={"room-player-" + p.id}
            key={p.id}
            open={selected === p.id || undefined}
          >
            <summary>
              {p.name} · {s[sort]} {sort}
            </summary>
            <div className="room-member">
              <PlayerPortrait player={p} />
              <div>
                <h3>{p.name}</h3>
                {p.username && <p>@{p.username}</p>}
                <p>
                  #{p.number || "—"} · {p.position}
                </p>
              </div>
            </div>
            <p>
              {s.appearances} appearances · {s.goals} goals · {s.assists}{" "}
              assists · {s.wins} wins · {draws} draws ·{" "}
              {s.appearances - s.wins - draws} losses
            </p>
            <p>
              {matches.filter((m) => m.captains.includes(p.id)).length} captain
              appearances · {s.captainWins} captain wins ·{" "}
              {
                matches.filter(
                  (m) =>
                    canSeeResults(m, store.viewer) &&
                    playerOfMatch(m).includes(p.id),
                ).length
              }{" "}
              visible Player of the Match awards
            </p>
            <p>
              Eligible final rating average:{" "}
              {s.rating ? s.rating.toFixed(1) : "Not available"}
            </p>
            {matches.map((m) => (
              <p key={m.id}>
                <a href={`/club?room=${roomId}&match=${m.id}`}>
                  {m.date} · {m.venue}
                </a>{" "}
                ·{" "}
                {m.minutes[p.id] === undefined
                  ? "Minutes not tracked"
                  : `${m.minutes[p.id]} recorded minutes`}{" "}
                ·{" "}
                {canSeeResults(m, store.viewer) && rating(m, p.id) !== null
                  ? `Final rating ${rating(m, p.id)!.toFixed(1)}`
                  : "Rating unavailable"}
              </p>
            ))}
          </details>
        );
      })}
    </section>
  );
}
export type AccountProfile = {
  username: string;
  position: string;
  number: number;
  portrait: string | null;
};
export async function imageData(file: File | undefined) {
  if (!file || !file.size) return undefined;
  if (file.size > 262144) throw Error("Choose an image smaller than 256 KB.");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error("Unable to read image"));
    reader.readAsDataURL(file);
  });
}
export function MyProfile({
  name,
  profile,
  act,
}: {
  name: string;
  profile: AccountProfile;
  act: (body: unknown) => Promise<boolean>;
}) {
  const [error, setError] = useState("");
  return (
    <details className="panel">
      <summary>My account profile</summary>
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            setError("");
            const portrait = await imageData(f.get("portrait") as File);
            await act({
              type: "profile",
              name: f.get("name"),
              username: f.get("username"),
              position: f.get("position"),
              number: Number(f.get("number")),
              portrait,
            });
          } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to save");
          }
        }}
      >
        <label>
          Preferred/full name
          <input name="name" defaultValue={name} required maxLength={70} />
        </label>
        <label>
          Display username
          <input
            name="username"
            defaultValue={profile.username}
            required
            maxLength={40}
          />
        </label>
        <label>
          Preferred position
          <select name="position" defaultValue={profile.position}>
            {["Goalkeeper", "Defender", "Midfielder", "Winger", "Forward"].map(
              (p) => (
                <option key={p}>{p}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Shirt number (0 = unset)
          <input
            type="number"
            name="number"
            min="0"
            max="99"
            defaultValue={profile.number}
          />
        </label>
        <label>
          Portrait · PNG/JPEG/WebP, up to 256 KB
          <input
            type="file"
            name="portrait"
            accept="image/png,image/jpeg,image/webp"
          />
        </label>
        <button>Save account profile</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <p>
        Your identity updates in rooms where you are approved. Match history
        remains separate.
      </p>
    </details>
  );
}

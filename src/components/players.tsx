"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { useClub } from "./provider";
import { Avatar, Title, Stats, Panel, MatchCard } from "./ui";
import { stats } from "@/lib/domain";
export function Players() {
  const { s } = useClub();
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("All positions");
  const ps = s.players.filter(
    (p) =>
      (p.name + " " + p.number).toLowerCase().includes(query.toLowerCase()) &&
      (position === "All positions" || p.position === position),
  );
  return (
    <>
      <Title
        eyebrow="THE PEOPLE MAKE THE CLUB"
        title="Our squad."
        subtitle={`${s.players.length} players. Plenty of personality. All fictional demo members.`}
      />
      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search players"
            placeholder="Find a player or shirt number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter by position"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        >
          {["All positions", ...new Set(s.players.map((p) => p.position))].map(
            (p) => (
              <option key={p}>{p}</option>
            ),
          )}
        </select>
        <span className="muted">{ps.length} players</span>
      </div>
      <div className="player-grid">
        {ps.map((p) => {
          const st = stats(s, p.id);
          return (
            <Link className="player-card" href={`/players/${p.id}`} key={p.id}>
              <span className="shirt">{String(p.number).padStart(2, "0")}</span>
              <ArrowUpRight className="card-arrow" size={18} />
              <Avatar p={p} />
              <h2>{p.name}</h2>
              <p className="muted">{p.position}</p>
              <div className="mini-stats">
                {[
                  ["Played", st.appearances],
                  ["Goals", st.goals],
                  ["Rating", st.rating || "—"],
                ].map(([l, v]) => (
                  <div key={l}>
                    <strong>{v}</strong>
                    <small>{l}</small>
                  </div>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
      {!ps.length && <p className="empty">No players match your search.</p>}
    </>
  );
}
export function Profile({ id }: { id: string }) {
  const { s, update, notify } = useClub();
  const [edit, setEdit] = useState(false);
  const p = s.players.find((p) => p.id === id);
  if (!p)
    return (
      <Title
        eyebrow="PLAYER NOT FOUND"
        title="No player here."
        subtitle="Choose a player from the squad page."
      />
    );
  const st = stats(s, id);
  return (
    <>
      <Link href="/players" className="text-link">
        ← Back to squad
      </Link>
      <div className="profile-heading">
        <Avatar p={p} />
        <Title
          eyebrow={`TEAM TONG / #${p.number} / SAMPLE MEMBER`}
          title={p.name}
          subtitle={p.position}
        />
        <button className="secondary" onClick={() => setEdit(!edit)}>
          {edit ? "Cancel" : "Edit player"}
        </button>
      </div>
      {edit && (
        <form
          className="panel form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            update((s) => {
              const p = s.players.find((p) => p.id === id)!;
              p.name = String(f.get("name")).trim() || p.name;
              p.position = String(f.get("position"));
              p.number = Number(f.get("number"));
              const portrait = String(f.get("portrait") || "").trim();
              p.portrait = portrait || undefined;
            });
            setEdit(false);
            notify("Player updated in this browser.");
          }}
        >
          <label>
            Name
            <input name="name" defaultValue={p.name} required maxLength={70} />
          </label>
          <label>
            Position
            <select name="position" defaultValue={p.position}>
              {[
                "Forward",
                "Midfielder",
                "Defender",
                "Winger",
                "Goalkeeper",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Shirt number
            <input
              name="number"
              type="number"
              min="1"
              max="99"
              defaultValue={p.number}
              required
            />
          </label>
          <label className="wide">
            Portrait URL (optional)
            <input
              name="portrait"
              defaultValue={p.portrait || ""}
              placeholder="https://… or /portraits/your-photo.jpg"
              pattern="(https?://.*|/[^/].*)?"
              maxLength={1000}
            />
            <span>
              Use your own photo. Missing or broken images display initials on
              the pitch.
            </span>
          </label>
          <button>Save player</button>
        </form>
      )}
      <Stats
        items={[
          ["Appearances", st.appearances, "Completed matches"],
          ["Goals", st.goals, `${st.assists} assists`],
          [
            "Community rating",
            st.rating || "—",
            "Submitted ballot · final results · 3+ votes",
          ],
          [
            "Minutes played",
            st.minutes,
            `${st.wins} wins · ${st.captainWins} captain wins`,
          ],
        ]}
      />
      <Panel title="Match-by-match">
        <div className="match-grid">
          {s.matches
            .filter(
              (m) => m.status === "completed" && m.teams.flat().includes(id),
            )
            .map((m) => (
              <div key={m.id}>
                <MatchCard m={m} />
                <p className="performance">
                  {m.goals.filter((g) => g.scorer === id).length} goals ·{" "}
                  {m.goals.filter((g) => g.assist === id).length} assists ·{" "}
                  {m.minutes[id] || 0} minutes
                </p>
              </div>
            ))}
        </div>
        {!st.appearances && (
          <p className="empty">The story starts with the first game.</p>
        )}
      </Panel>
    </>
  );
}
export function Leaderboards() {
  const { s } = useClub();
  const [metric, setMetric] = useState<keyof ReturnType<typeof stats>>("goals");
  const options = {
    goals: "Golden boot",
    assists: "Playmakers",
    rating: "Top rated",
    appearances: "Appearances",
    wins: "Wins",
    captainWins: "Captain wins",
    minutes: "Minutes",
  };
  const ranked = s.players
    .map((p) => ({ ...p, st: stats(s, p.id) }))
    .sort(
      (a, b) =>
        b.st[metric] - a.st[metric] ||
        b.st.appearances - a.st.appearances ||
        a.name.localeCompare(b.name),
    );
  return (
    <>
      <Title
        eyebrow="A LITTLE FRIENDLY COMPETITION"
        title="Bragging rights."
        subtitle="The performances. The debates. The numbers behind them."
      />
      <div className="tabs">
        {Object.entries(options).map(([k, v]) => (
          <button
            key={k}
            className={metric === k ? "active" : ""}
            onClick={() => setMetric(k as typeof metric)}
          >
            {v}
          </button>
        ))}
      </div>
      <Panel title={`${options[metric]} · sample season`}>
        {ranked.map((p, i) => (
          <Link
            className="rank-row leaderboard"
            key={p.id}
            href={`/players/${p.id}`}
          >
            <span className={`rank ${i < 3 ? "green" : ""}`}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <Avatar p={p} />
            <span className="person">
              <b>{p.name}</b>
              <small>
                {p.position} · {p.st.appearances} appearances
              </small>
            </span>
            <div className="bar">
              <i
                style={{
                  width: `${(p.st[metric] / Math.max(1, ranked[0].st[metric])) * 100}%`,
                }}
              />
            </div>
            <strong>
              {metric === "rating" ? p.st.rating || "—" : p.st[metric]}
            </strong>
            <ArrowUpRight size={16} />
          </Link>
        ))}
      </Panel>
      <p className="support">
        Season ratings include only matches where you submitted, after voting closes, with at least three peer votes
        per player per match. Season ratings average qualifying match ratings.
        Ties use appearances, then name.
      </p>
    </>
  );
}

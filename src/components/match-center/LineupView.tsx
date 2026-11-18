import { useState } from "react";
import { ArrowLeftRight, Users } from "lucide-react";
import { type Match, communityRating, participants } from "@/lib/domain";
import {
  FORMATIONS,
  type Formation,
  teamName,
  setSlot,
  contributions,
} from "@/lib/lineup";
import { useClub } from "../provider";
import { Pitch } from "./Pitch";
import { PlayerPortrait, RatingBadge } from "./PlayerMarker";
import { SubstitutionTimeline } from "./SubstitutionTimeline";
export function LineupView({
  match: m,
  now,
  onSelect,
}: {
  match: Match;
  now: number;
  onSelect: (id: string) => void;
}) {
  const { s, mutate, live } = useClub();
  const [side, setSide] = useState(0);
  const [view, setView] = useState<"current" | "kickoff" | "full">("current");
  const formation = m.formations?.[side] || "2-3-1";
  const lineup = view === "kickoff" ? m.kickoff?.[side] || [] : m.active[side];
  const resting = m.teams[side].filter((id) => !m.active[side].includes(id));
  function roster(ids: string[], full = false) {
    return ids.map((id) => {
      const p = s.players.find((p) => p.id === id);
      if (!p) return null;
      const c = contributions(m, id);
      return (
        <button
          className="mc-roster-player"
          key={id}
          onClick={() => onSelect(id)}
          aria-label={`Open ${p.name} details`}
        >
          <PlayerPortrait player={p} />
          <span>
            <b>
              {p.name}
              {m.captains[side] === id && (
                <i className="mc-inline-captain">C</i>
              )}
            </b>
            <small>
              {p.position} ·{" "}
              {m.status === "scheduled"
                ? "Ready to play"
                : `${c.minutes} min${full && !participants(m).includes(id) ? " · Did not play" : ""}`}
            </small>
            {full && (
              <small>
                {c.goals} goals · {c.assists} assists
              </small>
            )}
          </span>
          <RatingBadge value={communityRating(m, id, s.viewer)} />
        </button>
      );
    });
  }
  return (
    <>
      <div className="mc-lineup-toolbar">
        <div className="mc-team-switch" role="group" aria-label="Choose team">
          {[0, 1].map((i) => (
            <button
              key={i}
              className={side === i ? "selected" : ""}
              aria-pressed={side === i}
              onClick={() => setSide(i)}
            >
              <span className={`mc-team-dot side-${i}`} />
              {teamName(i)}
              <small>{m.teams[i].length}</small>
            </button>
          ))}
        </div>
        <label className="mc-formation-label">
          Formation
          <select
            aria-label={`${teamName(side)} formation`}
            value={formation}
            disabled={live || m.status !== "scheduled"}
            onChange={(e) =>
              mutate(m.id, (m) => {
                m.formations ??= ["2-3-1", "2-3-1"];
                m.formations[side] = e.target.value as Formation;
              })
            }
          >
            {Object.keys(FORMATIONS).map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mc-view-switch" role="group" aria-label="Roster view">
        {(["current", "kickoff", "full"] as const).map((v) => (
          <button
            key={v}
            aria-pressed={view === v}
            className={view === v ? "selected" : ""}
            onClick={() => setView(v)}
          >
            {v === "current"
              ? m.status === "scheduled"
                ? "Starting seven"
                : m.status === "live"
                  ? "On the turf"
                  : "Final lineup"
              : v === "kickoff"
                ? "At kickoff"
                : "Full roster"}
          </button>
        ))}
      </div>
      <div className="mc-lineup-grid">
        <section className="mc-pitch-panel">
          <div className="mc-pitch-heading">
            <span>
              <i className={`mc-team-dot side-${side}`} />
              {teamName(side)}
            </span>
            <small>
              {formation} <span>+ GK</span> ·{" "}
              {view === "full" ? m.teams[side].length : lineup.length} players
            </small>
          </div>
          {view === "full" ? (
            <div className="mc-full-roster">
              <p className="mc-fine">
                Every assigned player, including those who rotated. A rotation
                never removes someone from this roster.
              </p>
              {roster(m.teams[side], true)}
            </div>
          ) : view === "kickoff" && !m.kickoff ? (
            <div className="mc-empty mc-pitch-unavailable">
              <Users size={32} />
              <h3>
                {m.status === "scheduled"
                  ? "Kickoff is still ahead."
                  : "Kickoff snapshot unavailable."}
              </h3>
              <p>
                {m.status === "scheduled"
                  ? "Your starting seven will be saved when the match begins."
                  : "This older match did not record its starting lineup. View the final lineup or full roster instead."}
              </p>
            </div>
          ) : (
            <Pitch
              match={m}
              players={s.players}
              lineup={lineup}
              formation={formation}
              side={side}
              now={now}
              onSelect={onSelect}
            />
          )}
          <div className="mc-pitch-footer">
            <span>○ Tap a player for their match story</span>
            <span>
              {m.status === "scheduled"
                ? "PROVISIONAL LINEUP"
                : view === "kickoff"
                  ? "KICKOFF SNAPSHOT"
                  : "RECORDED LINEUP"}
            </span>
          </div>
        </section>
        <aside className="mc-lineup-aside">
          <section className="mc-card-panel">
            <div className="mc-section-title">
              <h3>
                <ArrowLeftRight size={16} />
                {m.status === "completed"
                  ? "Off at final whistle"
                  : "In the rotation"}
              </h3>
              <span>{resting.length} PLAYERS</span>
            </div>
            <p className="mc-fine">
              Same team. Next shift. Everyone stays in the game.
            </p>
            {roster(resting)}
            {!resting.length && (
              <p className="mc-empty">All assigned players are on the turf.</p>
            )}
          </section>
          <section className="mc-card-panel mc-rotation-note">
            <span className="eyebrow">THE TEAM TONG WAY</span>
            <h3>
              Seven on.
              <br />
              Everyone involved.
            </h3>
            <p>
              {m.teams[side].length} assigned · {m.active[side].length} active ·{" "}
              {resting.length} rotating
            </p>
            <div className="mc-minute-track">
              {m.teams[side].map((id) => (
                <i
                  key={id}
                  className={m.active[side].includes(id) ? "on" : ""}
                />
              ))}
            </div>
            <p className="mc-fine">
              Lineup positions show match roles. A player’s preferred position
              can differ. Ratings unlock after your complete ballot is
              submitted.
            </p>
          </section>
          <section className="mc-card-panel">
            <div className="mc-section-title">
              <h3>Rotation log</h3>
              <ArrowLeftRight size={16} />
            </div>
            <SubstitutionTimeline match={m} players={s.players} side={side} />
          </section>
        </aside>
      </div>
      {!live && m.status === "scheduled" && (
        <details className="mc-card-panel">
          <summary>
            Set positions & match captain <span>{teamName(side)}</span>
          </summary>
          <p className="mc-fine">
            Selecting an active teammate swaps their position. Selecting a
            rotating teammate swaps them onto the turf. Assign exactly seven
            before kickoff.
          </p>
          <div className="form-grid">
            {FORMATIONS[formation].map((slot, i) => (
              <label key={slot.label}>
                {slot.label}
                <select
                  aria-label={`${slot.label} player`}
                  value={m.active[side][i] || ""}
                  onChange={(e) =>
                    mutate(m.id, (m) => setSlot(m, side, i, e.target.value))
                  }
                >
                  <option value="" disabled>
                    Choose a player
                  </option>
                  {m.teams[side].map((id) => (
                    <option key={id} value={id}>
                      {s.players.find((p) => p.id === id)?.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              Match captain
              <select
                aria-label={`${teamName(side)} captain`}
                value={m.captains[side]}
                onChange={(e) =>
                  mutate(m.id, (m) => {
                    m.captains[side] = e.target.value;
                  })
                }
              >
                {m.teams[side].map((id) => (
                  <option key={id} value={id}>
                    {s.players.find((p) => p.id === id)?.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <hr />
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const a = String(f.get("a")),
                b = String(f.get("b"));
              mutate(m.id, (m) => {
                if (!m.teams[0].includes(a) || !m.teams[1].includes(b))
                  throw Error("Choose one assigned player from each side.");
                m.teams[0] = m.teams[0].map((id) => (id === a ? b : id));
                m.teams[1] = m.teams[1].map((id) => (id === b ? a : id));
                m.active[0] = m.active[0].map((id) => (id === a ? b : id));
                m.active[1] = m.active[1].map((id) => (id === b ? a : id));
                m.captains = m.captains.map((id, side) =>
                  m.teams[side].includes(id) ? id : m.teams[side][0],
                );
              });
            }}
          >
            {m.teams.map((team, i) => (
              <label key={i}>
                Swap from {teamName(i)}
                <select name={i ? "b" : "a"}>
                  {team.map((id) => (
                    <option key={id} value={id}>
                      {s.players.find((p) => p.id === id)?.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button
              className="secondary"
              disabled={m.teams.some((t) => !t.length)}
            >
              Swap between sides
            </button>
          </form>
        </details>
      )}
      <div className="mc-rating-legend">
        <span>
          <i className="lower" />
          1.0–6.9
        </span>
        <span>
          <i className="good" />
          7.0–8.9
        </span>
        <span>
          <i className="excellent" />
          9.0–10.0
        </span>
        <span>— Hidden or fewer than 3 votes · open voting is provisional</span>
      </div>
    </>
  );
}

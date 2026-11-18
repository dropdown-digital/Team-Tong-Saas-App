import { Goal, Trophy, ArrowLeftRight } from "lucide-react";
import {
  type Match,
  type Player,
  rating,
  canSeeResults,
  playerOfMatch,
  score,
  votingIsOpen,
} from "@/lib/domain";
import { contributions, matchEvents, teamName } from "@/lib/lineup";
import { PlayerPortrait, RatingBadge } from "./PlayerMarker";
import { useClub } from "../provider";
export function EventsView({
  match: m,
  players,
  compact = false,
}: {
  match: Match;
  players: Player[];
  compact?: boolean;
}) {
  const { mutate, live } = useClub();
  const name = (id: string) =>
    players.find((p) => p.id === id)?.name || "Unknown player";
  const events = matchEvents(m).filter((e) => !compact || e.type === "goal");
  return (
    <section className="mc-card-panel">
      <div className="mc-section-title">
        <h3>{compact ? "The match story" : "Match events"}</h3>
        <span>{events.length} RECORDED</span>
      </div>
      {!events.length ? (
        <div className="mc-empty">
          <Goal size={28} />
          <h3>
            {m.status === "scheduled"
              ? "A story waiting to happen."
              : "No events recorded."}
          </h3>
          <p>
            Goals, assists, cards, and rotations appear when an organizer
            records them.
          </p>
        </div>
      ) : (
        <ol className="mc-events">
          {events.map((e) => (
            <li key={e.id}>
              <time>{e.minute === null ? "—" : `${e.minute}′`}</time>
              <span className={`mc-event-icon ${e.type}`}>
                {e.type === "goal" ? (
                  <Goal size={19} />
                ) : e.type === "rotation" ? (
                  <ArrowLeftRight size={17} />
                ) : (
                  <i className={`mc-card ${e.type}`} />
                )}
              </span>
              <div>
                <strong>{name(e.player)}</strong>
                <span>
                  {e.type === "goal"
                    ? `${e.ownGoal ? "Own goal" : "Goal"}${e.assist ? ` · Assisted by ${name(e.assist)}` : e.assistStatus === "unknown" ? " · Assist unknown" : " · Unassisted"}`
                    : e.type === "rotation"
                      ? `On for ${name(e.off)}`
                      : `${e.type === "yellow" ? "Yellow" : "Red"} card`}
                </span>
                <small>{teamName(e.side)}</small>
              </div>
              {!live && m.status === "live" && e.type !== "rotation" && (
                <button
                  className="mc-remove-event"
                  aria-label={`Remove ${e.type} at ${e.minute} minutes`}
                  onClick={() =>
                    mutate(m.id, (m) => {
                      if (e.type === "goal")
                        m.goals = m.goals.filter((g) => g.id !== e.id);
                      else
                        m.cards = (m.cards || []).filter((c) => c.id !== e.id);
                    })
                  }
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      {!m.rotations && m.status !== "scheduled" && !compact && (
        <p className="mc-fine">
          This older match did not record rotation history.
        </p>
      )}
    </section>
  );
}
export function MatchAward({
  match: m,
  players,
  now,
  onSelect,
}: {
  match: Match;
  players: Player[];
  now: number;
  onSelect: (id: string) => void;
}) {
  const { s } = useClub();
  const winners = canSeeResults(m, s.viewer) ? playerOfMatch(m, now) : [];
  return (
    <section className="mc-award">
      <span className="eyebrow">
        <Trophy size={15} /> COMMUNITY PLAYER OF THE MATCH
      </span>
      {winners.length ? (
        <>
          {winners.map((id) => {
            const p = players.find((p) => p.id === id)!;
            return (
              <button key={id} onClick={() => onSelect(id)}>
                <PlayerPortrait player={p} />
                <span>
                  <b>{p.name}</b>
                  <small>
                    {winners.length > 1
                      ? "Joint award"
                      : "Highest eligible rating"}
                  </small>
                </span>
                <RatingBadge value={rating(m, id, now)} />
              </button>
            );
          })}
          <p>
            Exact highest mean wins. Equal means share the award; rounding never
            breaks a tie.
          </p>
        </>
      ) : (
        <>
          <h3>
            {m.status !== "completed"
              ? "Earn it on the turf."
              : votingIsOpen(m, now)
                ? "The squad is still voting."
                : "No eligible winner yet."}
          </h3>
          <p>
            Submit your complete ballot to unlock results. Awards are final
            after voting closes, with at least 3 eligible peer votes. This
            rating-based award is separate from any future popularity poll.
          </p>
        </>
      )}
    </section>
  );
}
export function StatsView({
  match: m,
  players,
  onSelect,
}: {
  match: Match;
  players: Player[];
  onSelect: (id: string) => void;
}) {
  const rows: [string, number, number][] = [
    ["Goals", score(m, 0), score(m, 1)],
    [
      "Recorded assists",
      m.goals.filter((g) => g.side === 0 && g.assist).length,
      m.goals.filter((g) => g.side === 1 && g.assist).length,
    ],
    ["Assigned players", m.teams[0].length, m.teams[1].length],
    [
      "Recorded player-minutes",
      ...(m.teams.map((t) =>
        t.reduce((n, id) => n + (m.minutes[id] || 0), 0),
      ) as [number, number]),
    ],
    [
      "Yellow cards",
      ...(m.teams.map(
        (t) =>
          (m.cards || []).filter(
            (c) => c.kind === "yellow" && t.includes(c.player),
          ).length,
      ) as [number, number]),
    ],
  ];
  return (
    <>
      <section className="mc-card-panel">
        <div className="mc-section-title">
          <h3>Only what we record.</h3>
          <span>TEAM COMPARISON</span>
        </div>
        <div className="mc-stats-teams">
          <b>Team White</b>
          <b>Team Black</b>
        </div>
        {rows.map(([label, a, b]) => (
          <div className="mc-compare" key={label}>
            <div>
              <strong>{a}</strong>
              <span>{label}</span>
              <strong>{b}</strong>
            </div>
            <div className="mc-compare-bars">
              <i style={{ width: `${a + b ? (a / (a + b)) * 100 : 50}%` }} />
              <i style={{ width: `${a + b ? (b / (a + b)) * 100 : 50}%` }} />
            </div>
          </div>
        ))}
        <p className="mc-fine">
          {Object.values(m.attendance).filter((v) => v === "going").length}{" "}
          confirmed RSVPs ·{" "}
          {Object.values(m.attendance).filter((v) => v === "maybe").length}{" "}
          maybe ·{" "}
          {Object.values(m.attendance).filter((v) => v === "out").length} out.
          RSVP is not verified attendance.
        </p>
      </section>
      <section className="mc-card-panel">
        <div className="mc-section-title">
          <h3>Player contributions</h3>
          <span>G / A / MIN</span>
        </div>
        {m.teams.flat().map((id) => {
          const p = players.find((p) => p.id === id)!;
          const c = contributions(m, id);
          return (
            <button
              className="mc-contribution"
              key={id}
              onClick={() => onSelect(id)}
            >
              <PlayerPortrait player={p} />
              <span>
                {p.name}
                <small>{teamName(m.teams[0].includes(id) ? 0 : 1)}</small>
              </span>
              <b aria-label={`${c.goals} goals`}>{c.goals}</b>
              <b aria-label={`${c.assists} assists`}>{c.assists}</b>
              <b aria-label={`${c.minutes} minutes`}>{c.minutes}</b>
            </button>
          );
        })}
      </section>
      <p className="mc-fine">
        Possession, passes, xG, and custom statistics are not recorded in this
        app, so no estimates are displayed.
      </p>
    </>
  );
}

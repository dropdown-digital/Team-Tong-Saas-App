import { CalendarDays, Clock, MapPin, Flag } from "lucide-react";
import { dateLabel, score, type Match, type Player } from "@/lib/domain";
import { teamName } from "@/lib/lineup";
export function MatchHeader({
  match: m,
  players,
}: {
  match: Match;
  players: Player[];
}) {
  return (
    <section className="mc-header" aria-label="Match summary">
      <div className="mc-header-top">
        <span>
          TEAM TONG <i /> FRIENDLY SERIES
        </span>
        <span className={`mc-status ${m.status}`}>
          {m.status === "completed"
            ? "Full time"
            : m.status === "live"
              ? `Live · ${m.elapsed}′ logged`
              : "Upcoming"}
        </span>
      </div>
      <div className="mc-scoreboard">
        {[0, 1].map((side) => (
          <div key={side} className={`mc-side side-${side}`}>
            <div className="mc-shield">
              <span>TT</span>
              <small>{side ? "BLACK" : "WHITE"}</small>
            </div>
            <h2>{teamName(side)}</h2>
            <span className="mc-captain">
              <Flag size={12} />
              {players.find((p) => p.id === m.captains[side])?.name ||
                "Captain to be chosen"}
            </span>
          </div>
        ))}
        <div className="mc-result">
          <strong>
            {m.status === "scheduled" ? (
              <span className="mc-vs">VS</span>
            ) : (
              <>
                {score(m, 0)}
                <span>–</span>
                {score(m, 1)}
              </>
            )}
          </strong>
          <small>
            {m.status === "completed"
              ? "THE FINAL WHISTLE"
              : m.status === "live"
                ? "EVERY MINUTE COUNTS"
                : "UNDER THE LIGHTS"}
          </small>
        </div>
      </div>
      <div className="mc-match-meta">
        <span>
          <MapPin size={14} />
          {m.venue}
        </span>
        <span>
          <CalendarDays size={14} />
          {dateLabel(m)} · {m.time} Dhaka
        </span>
        <span>
          <Clock size={14} />
          {m.duration} min · 7v7
        </span>
      </div>
    </section>
  );
}

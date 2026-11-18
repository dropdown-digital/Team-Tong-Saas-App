import type { Match, Player } from "@/lib/domain";
import { FORMATIONS, type Formation } from "@/lib/lineup";
import { PlayerMarker } from "./PlayerMarker";
export function Pitch({
  match,
  players,
  lineup,
  formation,
  side,
  now,
  onSelect,
}: {
  match: Match;
  players: Player[];
  lineup: string[];
  formation: Formation;
  side: number;
  now: number;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className={`mc-pitch side-${side}`}
      aria-label={`${formation} formation, seven positions including goalkeeper`}
    >
      <div className="mc-pitch-lines" aria-hidden="true">
        <span className="mc-halfway" />
        <span className="mc-center-circle" />
        <span className="mc-center-dot" />
        <span className="mc-area top" />
        <span className="mc-area bottom" />
        <span className="mc-six top" />
        <span className="mc-six bottom" />
        <span className="mc-arc top" />
        <span className="mc-arc bottom" />
      </div>
      <span className="mc-pitch-direction">ATTACKING ↑</span>
      {FORMATIONS[formation].map((slot, i) => {
        const p = players.find((p) => p.id === lineup[i]);
        return (
          <div
            className="mc-position"
            key={slot.label}
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            {p ? (
              <PlayerMarker
                player={p}
                match={match}
                position={slot.label}
                side={side}
                now={now}
                onSelect={onSelect}
              />
            ) : (
              <div className="mc-empty-position">
                <span>+</span>
                <small>{slot.label} · Unassigned</small>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

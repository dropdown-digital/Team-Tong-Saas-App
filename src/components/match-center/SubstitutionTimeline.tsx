import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Match, Player } from "@/lib/domain";
import { teamName } from "@/lib/lineup";
export function SubstitutionTimeline({
  match,
  players,
  side,
}: {
  match: Match;
  players: Player[];
  side?: number;
}) {
  const events = (match.rotations || []).filter(
    (r) => side === undefined || r.side === side,
  );
  const name = (id: string) =>
    players.find((p) => p.id === id)?.name || "Unknown player";
  return (
    <div className="mc-rotation-timeline">
      {events.length ? (
        events.map((r) => (
          <div className="mc-rotation-event" key={r.id}>
            <time>{r.minute}′</time>
            <div>
              <span>
                <ArrowUpRight size={14} />
                {name(r.on)} <small>ON</small>
              </span>
              <span>
                <ArrowDownLeft size={14} />
                {name(r.off)} <small>OFF</small>
              </span>
            </div>
            <small>{teamName(r.side)}</small>
          </div>
        ))
      ) : (
        <p className="mc-empty">
          {match.status === "scheduled"
            ? "Rotations appear here after kickoff."
            : match.rotations
              ? "No rotations recorded yet."
              : "This older record has no substitution timeline. No history has been invented."}
        </p>
      )}
      <p className="mc-fine">
        Off the turf, still in the team. Players can rotate back on repeatedly.
      </p>
    </div>
  );
}

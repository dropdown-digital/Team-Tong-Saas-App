import { useClub } from "../provider";
import { useState } from "react";
import Image from "next/image";
import { Goal, Footprints } from "lucide-react";
import { communityRating, type Match, type Player } from "@/lib/domain";
import { initials, contributions, ratingColor } from "@/lib/lineup";
export function PlayerPortrait({ player: p }: { player: Player }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <span className={`mc-portrait tone-${p.number % 4}`}>
      {p.portrait && p.portrait !== failedSrc ? (
        <Image
          src={p.portrait}
          alt=""
          width={80}
          height={80}
          unoptimized
          onError={() => setFailedSrc(p.portrait!)}
        />
      ) : (
        <span aria-hidden="true">{initials(p)}</span>
      )}
    </span>
  );
}
export function RatingBadge({ value }: { value: number | null }) {
  return (
    <span
      className={`mc-rating ${ratingColor(value)}`}
      aria-label={
        value === null
          ? "Not rated"
          : `Community rating ${value.toFixed(1)} out of 10`
      }
    >
      {value === null ? "—" : value.toFixed(1)}
    </span>
  );
}
export function PlayerMarker({
  player,
  match,
  position,
  side,
  onSelect,
}: {
  player: Player;
  match: Match;
  position: string;
  side: number;
  now: number;
  onSelect: (id: string) => void;
}) {
  const { s } = useClub();
  const r = communityRating(match, player.id, s.viewer),
    c = contributions(match, player.id);
  return (
    <button
      className={`mc-player-marker side-${side}`}
      aria-label={`${player.name}, ${position}${match.captains[side] === player.id ? ", captain" : ""}, ${r === null ? "not rated" : `rating ${r.toFixed(1)}`}. Open player details`}
      onClick={() => onSelect(player.id)}
    >
      <span className="mc-marker-portrait">
        <PlayerPortrait player={player} />
        <RatingBadge value={r} />
        {match.captains[side] === player.id && (
          <span className="mc-captain-pin" title="Match captain">
            C
          </span>
        )}
        <span className="mc-player-events">
          {c.goals > 0 && (
            <span title={`${c.goals} goals`}>
              <Goal size={12} />
              {c.goals > 1 && c.goals}
            </span>
          )}
          {c.assists > 0 && (
            <span title={`${c.assists} assists`}>
              <Footprints size={11} />
              {c.assists > 1 && c.assists}
            </span>
          )}
          {c.cards.map((card) => (
            <i
              key={card.id}
              className={`mc-card ${card.kind}`}
              title={`${card.kind} card`}
            />
          ))}
        </span>
      </span>
      <span className="mc-marker-name">{player.name}</span>
      <span className="mc-marker-position">
        {position} <span>· {player.number}</span>
      </span>
    </button>
  );
}

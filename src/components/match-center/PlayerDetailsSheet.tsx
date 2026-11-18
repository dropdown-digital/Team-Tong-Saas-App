import { useEffect, useRef } from "react";
import Link from "next/link";
import { X, ArrowUpRight, LockKeyhole } from "lucide-react";
import {
  type Match,
  type Player,
  canSeeResults,
  ballotTargets,
  communityRating,
  voteCount,
  votingIsOpen,
} from "@/lib/domain";
import { contributions, teamName } from "@/lib/lineup";
import { useClub } from "../provider";
import { PlayerPortrait, RatingBadge } from "./PlayerMarker";
export function PlayerDetailsSheet({
  player,
  match,
  now,
  onClose,
  onRate,
}: {
  player: Player;
  match: Match;
  now: number;
  onClose: () => void;
  onRate?: (id: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { s, live } = useClub();
  useEffect(() => {
    const dialog = ref.current;
    const focus = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      focus?.focus();
    };
  }, []);
  const side = match.teams.findIndex((t) => t.includes(player.id)),
    c = contributions(match, player.id),
    value = communityRating(match, player.id, s.viewer),
    count = canSeeResults(match, s.viewer) ? voteCount(match, player.id) : "—";
  return (
    <dialog
      ref={ref}
      className="mc-player-sheet"
      aria-labelledby="player-sheet-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mc-sheet-content">
        <div className="mc-sheet-handle" />
        <div className="mc-sheet-top">
          <span className="eyebrow">MATCH PERFORMANCE</span>
          <button
            className="mc-icon-button"
            aria-label="Close player details"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <div className="mc-sheet-profile">
          <PlayerPortrait player={player} />
          <span className="mc-sheet-rating">
            <RatingBadge value={value} />
            <small>
              {!canSeeResults(match, s.viewer)
                ? "Hidden until submission"
                : votingIsOpen(match, now)
                  ? "Provisional"
                  : "Final"}
            </small>
          </span>
        </div>
        <h2 id="player-sheet-title">{player.name}</h2>
        <p className="mc-sheet-sub">
          #{player.number} · {player.position} · {teamName(side)}
          {match.captains[side] === player.id ? " · Captain" : ""}
        </p>
        <div className="mc-player-stats">
          {[
            ["Goals", c.goals],
            ["Assists", c.assists],
            ["Minutes", c.minutes],
            ["Peer votes", count],
          ].map(([k, v]) => (
            <div key={k}>
              <strong>{v}</strong>
              <span>{k}</span>
            </div>
          ))}
        </div>
        <div className="mc-rating-explainer">
          <LockKeyhole size={17} />
          <p>
            {!canSeeResults(match, s.viewer)
              ? "Submit your complete ballot from the Ratings tab to unlock results."
              : "Averages require three eligible votes. Results are provisional while voting is open."}
          </p>
        </div>
        {onRate &&
          votingIsOpen(match, now) &&
          !canSeeResults(match, s.viewer) &&
          ballotTargets(match, s.viewer).includes(player.id) && (
            <button onClick={() => onRate(player.id)}>
              Rate in my complete ballot
            </button>
          )}
        {match.votingDeadline && (
          <p className="mc-fine">
            Voting deadline:{" "}
            {new Date(match.votingDeadline).toLocaleString("en-GB", {
              timeZone: "Asia/Dhaka",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            Dhaka
          </p>
        )}
        {!live && (
          <div className="mc-local-voting">
            <b>LOCAL DEMO · NO AUTHENTICATION</b>
            <p>
              Real voting is unavailable. No backend is connected. Demo ballots
              stay on this device and are not confidential in browser storage.
            </p>
            <p>
              Use the Ratings tab to rate every other participant, review, and
              submit one complete ballot. Submitted ballots cannot be edited.
            </p>
          </div>
        )}
        {
          <Link
            className="button secondary mc-profile-link"
            href={
              live
                ? `/club?room=${new URLSearchParams(window.location.search).get("room")}&player=${player.id}#room-player-${player.id}`
                : `/players/${player.id}`
            }
            onClick={onClose}
          >
            Full player profile <ArrowUpRight size={16} />
          </Link>
        }
      </div>
    </dialog>
  );
}

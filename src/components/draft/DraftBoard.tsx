"use client";
import { Crown, UserRound, Plus, Shield, CheckCircle2 } from "lucide-react";
import type { Match, Player } from "@/lib/domain";
import type { CaptainDraft } from "@/lib/draft";
import { teamName } from "@/lib/lineup";
import "./draft.css";
export function DraftBoard({
  match: m,
  draft: d,
  players,
  online,
  canPick = false,
  onPick,
  practice = false,
}: {
  match: Pick<Match, "teams">;
  draft: CaptainDraft;
  players: Player[];
  online?: [boolean, boolean];
  canPick?: boolean;
  onPick?: (id: string) => void;
  practice?: boolean;
}) {
  const name = (id: string) =>
    players.find((p) => p.id === id)?.name || "Player";
  const available = d.pool.filter((id) => !m.teams.flat().includes(id));
  return (
    <section className="tong-draft" aria-label="Live captain draft">
      <header className="td-heading">
        <div>
          <span className="td-kicker">TEAM TONG</span>
          <h2>Live draft</h2>
          <p>
            7v7 · {d.pool.length} players · {d.pool.length / 2} per team
          </p>
        </div>
        <span className="td-badge">
          {practice
            ? "Practice"
            : d.state === "complete"
              ? "Final teams"
              : "Live room"}
        </span>
      </header>
      <div className="td-teams">
        {([0, 1] as const).map((side) => (
          <section
            key={side}
            className={`td-team td-team-${side} ${d.state === "active" && d.turn === side ? "td-turn" : ""}`}
            aria-label={teamName(side)}
          >
            <div className="td-team-title">
              <Shield size={22} />
              <h3>{teamName(side)}</h3>
              {d.state === "active" && d.turn === side && (
                <span className="td-turn-dot" aria-label="Picking now" />
              )}
            </div>
            <p className="td-count">
              {m.teams[side].length}/{d.pool.length / 2} selected
            </p>
            <ol>
              {m.teams[side].map((id) => {
                const captain = id === d.captains[side],
                  pick = d.picks.findIndex((p) => p.player === id);
                return (
                  <li key={id}>
                    {captain ? (
                      <Crown size={18} aria-label="Captain" />
                    ) : (
                      <UserRound size={18} />
                    )}
                    <span>
                      {name(id)}
                      <small>
                        {captain
                          ? "Captain"
                          : pick >= 0
                            ? `Pick ${pick + 1}`
                            : "Assigned"}
                      </small>
                    </span>
                  </li>
                );
              })}
            </ol>
            {online && (
              <div className="td-presence">
                <span className={online[side] ? "is-online" : ""} />
                {online[side] ? "Online" : "Offline"} ·{" "}
                {d.ready[side] ? "Ready" : "Not ready"}
              </div>
            )}
          </section>
        ))}
      </div>
      <div className="td-status" role="status" aria-live="polite">
        {d.state === "complete" ? (
          <>
            <CheckCircle2 size={26} />
            <h3>Draft completed</h3>
            <p>
              {d.pool.length / 2} players on each side, including captains.
              <br />7 play and {d.pool.length / 2 - 7} rotate per team. Everyone
              remains part of the match.
            </p>
          </>
        ) : (
          <>
            <span className="td-kicker">
              {d.state === "active"
                ? `PICK ${d.picks.length + 1} OF ${d.pool.length - 2}`
                : "CAPTAIN READINESS"}
            </span>
            <h3>
              {d.state === "active"
                ? `${teamName(d.turn)}’s turn to pick`
                : d.state === "paused"
                  ? "Draft paused"
                  : "Waiting for both captains"}
            </h3>
            <p>
              {available.length} players remaining
              {d.state !== "active"
                ? " · Both captains must be online and ready."
                : ""}
            </p>
          </>
        )}
      </div>
      {d.state !== "complete" && (
        <>
          <div className="td-pool-heading">
            <h3>Available players</h3>
            <span>
              {canPick
                ? "Choose one player"
                : d.state === "active"
                  ? "Following the draft"
                  : "Selections paused"}
            </span>
          </div>
          <div className="td-pool">
            {available.map((id) => (
              <button
                key={id}
                type="button"
                disabled={!canPick}
                onClick={() => onPick?.(id)}
                aria-label={`Pick ${name(id)}`}
              >
                <Plus size={20} />
                <span>{name(id)}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <p className="td-toss">
        {d.first === null
          ? "One coin toss will decide the first pick."
          : `Original toss: ${teamName(d.first)} picks first. The result stays fixed.`}
      </p>
    </section>
  );
}

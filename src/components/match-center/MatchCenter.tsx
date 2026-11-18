"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Users, ArrowUpRight } from "lucide-react";
import { useClub } from "../provider";
import { MatchHeader } from "./MatchHeader";
import { MatchTabs, type MatchTab } from "./MatchTabs";
import { LineupView } from "./LineupView";
import { PlayerDetailsSheet } from "./PlayerDetailsSheet";
import { MatchControls, Attendance, Fees } from "./MatchControls";
import { EventsView, StatsView, MatchAward } from "./MatchViews";
import { MatchRatingFlow } from "./MatchRatingFlow";
import { teamName } from "@/lib/lineup";
import "./match-center.css";
export function MatchCenter({ id }: { id: string }) {
  const { s, live } = useClub();
  const [tab, setTab] = useState<MatchTab>(
    s.matches.find((m) => m.id === id)?.status === "completed"
      ? "Ratings"
      : "Lineup",
  );
  const [rateTarget, setRateTarget] = useState<string | undefined>();
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const m = s.matches.find((m) => m.id === id);
  if (!m)
    return (
      <section className="mc-empty">
        <h1>Match not found.</h1>
        <Link href={live ? "/club" : "/matches"} className="button secondary">
          Back to match history
        </Link>
      </section>
    );
  const player = s.players.find((p) => p.id === selected);
  return (
    <div className="match-center">
      <div className="mc-breadcrumb">
        <Link href={live ? "/club" : "/matches"}>
          <ArrowLeft size={15} /> Match centre
        </Link>
        <span>
          {live ? "PRIVATE CLUB · SHARED MATCH" : "SAMPLE FIXTURE · LOCAL DEMO"}
        </span>
      </div>
      <MatchHeader match={m} players={s.players} />
      {m.status === "completed" && tab !== "Ratings" && (
        <button className="ballot-primary" onClick={() => setTab("Ratings")}>
          {m.ballots?.[s.viewer] ? "View community results" : "Rate this match"}{" "}
          <ArrowUpRight size={17} />
        </button>
      )}
      <MatchTabs tab={tab} onChange={setTab} />
      <div
        className="mc-tab-panel"
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
        key={tab}
      >
        {tab === "Lineup" ? (
          <LineupView match={m} now={now} onSelect={setSelected} />
        ) : tab === "Overview" ? (
          <>
            <div className="mc-overview-grid">
              <div>
                <Attendance match={m} />
                <EventsView match={m} players={s.players} compact />
              </div>
              <div>
                <MatchAward
                  match={m}
                  players={s.players}
                  now={now}
                  onSelect={setSelected}
                />
                <section className="mc-card-panel">
                  <div className="mc-section-title">
                    <h3>The two sides</h3>
                    <Users size={17} />
                  </div>
                  {m.teams.map((team, side) => (
                    <button
                      key={side}
                      className="mc-team-overview"
                      onClick={() => setTab("Lineup")}
                    >
                      <span className={`mc-team-dot side-${side}`} />
                      <span>
                        <b>{teamName(side)}</b>
                        <small>
                          {team.length} assigned · {m.active[side].length}{" "}
                          active
                        </small>
                      </span>
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                </section>
              </div>
            </div>
            <Fees match={m} />
          </>
        ) : tab === "Stats" ? (
          <StatsView match={m} players={s.players} onSelect={setSelected} />
        ) : tab === "Ratings" ? (
          <MatchRatingFlow
            key={`${m.id}-${s.viewer}-${rateTarget}`}
            match={m}
            now={now}
            initialTarget={rateTarget}
          />
        ) : (
          <EventsView match={m} players={s.players} />
        )}
      </div>
      {!live && <MatchControls match={m} />}
      {!live && (
        <p className="mc-demo-footnote">
          Demo only. No authenticated accounts or shared backend. Public-rating
          rules are simulated locally; raw demo ballots are accessible in
          browser storage and backups.
        </p>
      )}
      {player && (
        <PlayerDetailsSheet
          key={player.id}
          player={player}
          match={m}
          now={now}
          onClose={() => setSelected(null)}
          onRate={(id) => {
            setRateTarget(id);
            setSelected(null);
            setTab("Ratings");
          }}
        />
      )}
    </div>
  );
}

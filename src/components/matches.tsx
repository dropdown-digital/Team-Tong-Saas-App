"use client";
import { useState } from "react";
import Link from "next/link";
import { useClub } from "./provider";
import { Title, MatchCard } from "./ui";
import { MatchCenter } from "./match-center/MatchCenter";
export { FixtureForm } from "./match-center/FixtureForm";
export function MatchHistory() {
  const { s } = useClub();
  const [filter, setFilter] = useState("all");
  return (
    <>
      <Title
        eyebrow="EVERY GAME HAS A STORY"
        title="Match archive."
        subtitle="The late winners, the close calls, and everything in between."
      />
      <div className="tabs">
        {["all", "completed", "scheduled", "live"].map((v) => (
          <button
            key={v}
            className={filter === v ? "active" : ""}
            onClick={() => setFilter(v)}
          >
            {v === "all" ? "All matches" : v}
          </button>
        ))}
      </div>
      <div className="match-grid">
        {s.matches
          .filter((m) => filter === "all" || m.status === filter)
          .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
          .map((m) => (
            <MatchCard key={m.id} m={m} />
          ))}
      </div>
      {!s.matches.some((m) => filter === "all" || m.status === filter) && (
        <p className="empty">No {filter} matches yet.</p>
      )}
    </>
  );
}
export function Upcoming() {
  const { s } = useClub();
  const m = s.matches
    .filter((m) => m.status !== "completed")
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  return m ? (
    <MatchDetails id={m.id} />
  ) : (
    <>
      <Title
        eyebrow="MATCH CENTRE"
        title="The next chapter awaits."
        subtitle="Schedule your next fixture in club settings."
      />
      <Link href="/settings" className="button">
        Schedule a match
      </Link>
    </>
  );
}
export function MatchDetails({ id }: { id: string }) {
  return <MatchCenter key={id} id={id} />;
}

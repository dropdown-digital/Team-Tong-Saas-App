"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Trophy,
  Users,
} from "lucide-react";
import { useClub } from "./provider";
import {
  Avatar,
  MatchCard,
  Panel,
  Pitch,
  Stats,
  Title,
  FixtureMeta,
} from "./ui";
import { stats } from "@/lib/domain";
export function Overview() {
  const { s } = useClub();
  const done = s.matches
    .filter((m) => m.status === "completed")
    .sort((a, b) => b.date.localeCompare(a.date));
  const next = s.matches
    .filter((m) => m.status !== "completed")
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  const ranked = s.players
    .map((p) => ({ ...p, st: stats(s, p.id) }))
    .sort((a, b) => b.st.goals - a.st.goals);
  return (
    <>
      <Title
        eyebrow="YOUR WEEKLY FOOTBALL FIX"
        title="The clubhouse."
        subtitle="A little rivalry. A lot of good football."
        action={
          <Link className="button secondary" href="/players">
            <Users size={16} />
            Meet the squad <ArrowUpRight size={16} />
          </Link>
        }
      />
      <section className="hero">
        <div>
          <span className="eyebrow">
            <span className="dot" /> THE GAME BRINGS US TOGETHER
          </span>
          <h2>
            Same people.
            <br />
            New <em>legends.</em>
          </h2>
          <p>
            Under the lights, every game has a story.
            <br />
            This is where we keep ours.
          </p>
          <Link
            className="button"
            href={done[0] ? `/matches/${done[0].id}` : "/upcoming"}
          >
            {done[0] ? "Rate this match" : "Next match"}{" "}
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="hero-art">
          <span className="pitch-caption">THE TONG WAY / 7-A-SIDE</span>
          <Pitch />
          <span className="pitch-note">
            <span className="dot" /> 14 on the turf. Everyone in the game.
          </span>
        </div>
        <span className="hero-number">01 / THE CLUB</span>
      </section>
      <Stats
        items={[
          ["Club members", s.players.length, "One squad. No permanent sides."],
          ["Matches played", done.length, "2026 · sample season"],
          [
            "Goals scored",
            done.reduce((n, m) => n + m.goals.length, 0),
            "Every finish, recorded.",
          ],
          [
            "Next match RSVP",
            next
              ? Object.values(next.attendance).filter((v) => v === "going")
                  .length
              : 0,
            "Confirmed players",
          ],
        ]}
      />
      <div className="dashboard-grid">
        <div>
          <Panel
            title="Next under the lights"
            href="/upcoming"
            label="Match centre"
          >
            {next ? (
              <>
                <div className="next-title">
                  <CalendarDays size={23} />
                  <div>
                    <span className="eyebrow">FRIENDLY / SAMPLE FIXTURE</span>
                    <h3>
                      Team White <span className="muted">vs</span> Team Black
                    </h3>
                  </div>
                  <span className="badge">{next.status}</span>
                </div>
                <FixtureMeta m={next} />
                <div className="attendance-preview">
                  <div className="avatar-stack">
                    {s.players
                      .filter((p) => next.attendance[p.id] === "going")
                      .slice(0, 5)
                      .map((p) => (
                        <Avatar key={p.id} p={p} />
                      ))}
                  </div>
                  <span>
                    <b>
                      {
                        Object.values(next.attendance).filter(
                          (v) => v === "going",
                        ).length
                      }{" "}
                      confirmed
                    </b>
                    <small>Room for every rotation.</small>
                  </span>
                  <Link className="button secondary" href="/upcoming">
                    Count me in <ArrowRight size={15} />
                  </Link>
                </div>
              </>
            ) : (
              <p className="muted">
                No upcoming fixture. Schedule one in club settings.
              </p>
            )}
          </Panel>
          <Panel title="Recent results" href="/matches">
            <div className="recent-grid">
              {done.slice(0, 2).map((m) => (
                <MatchCard key={m.id} m={m} />
              ))}
            </div>
          </Panel>
        </div>
        <Panel title="The golden boot" href="/leaderboards">
          <div className="ranking-kicker">
            <Trophy size={18} />
            <span>SEASON 2026 · SAMPLE STANDINGS</span>
          </div>
          {ranked.slice(0, 5).map((p, i) => (
            <Link href={`/players/${p.id}`} className="rank-row" key={p.id}>
              <span className="rank">{String(i + 1).padStart(2, "0")}</span>
              <Avatar p={p} />
              <span className="person">
                <b>{p.name}</b>
                <small>{p.position}</small>
              </span>
              <strong>
                {p.st.goals}
                <small>GOALS</small>
              </strong>
            </Link>
          ))}
          <div className="quote">
            “The group chat remembers.
            <br />
            The numbers don’t forget.”<span>TEAM TONG</span>
          </div>
        </Panel>
      </div>
    </>
  );
}

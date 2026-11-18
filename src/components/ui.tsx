"use client";
import Link from "next/link";
import { ArrowUpRight, MapPin, Clock, ArrowRight } from "lucide-react";
import { dateLabel, score, type Match, type Player } from "@/lib/domain";
export function Title({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
export function Avatar({ p }: { p: Player }) {
  return (
    <span className={`avatar tone-${p.number % 4}`}>
      {p.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function Panel({
  title,
  children,
  href,
  label = "View all",
}: {
  title: string;
  children: React.ReactNode;
  href?: string;
  label?: string;
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>{title}</h2>
        {href && (
          <Link className="text-link" href={href}>
            {label}
            <ArrowUpRight size={15} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
export function Stats({
  items,
}: {
  items: [string, string | number, string][];
}) {
  return (
    <div className="stats-grid">
      {items.map(([label, value, note]) => (
        <div className="stat" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          <small>{note}</small>
        </div>
      ))}
    </div>
  );
}
export function MatchCard({ m }: { m: Match }) {
  return (
    <Link className="match-card" href={`/matches/${m.id}`}>
      <div className="section-heading">
        <span className="tiny">
          {dateLabel(m)} · {m.time}
        </span>
        <span className={`badge ${m.status === "live" ? "live" : ""}`}>
          {m.status}
        </span>
      </div>
      <div className="versus">
        <div>
          <span className="team-icon">T</span>
          <b>Team White</b>
        </div>
        <strong>
          {m.status === "scheduled" ? (
            <small>VS</small>
          ) : (
            `${score(m, 0)} : ${score(m, 1)}`
          )}
        </strong>
        <div>
          <span className="team-icon blue">T</span>
          <b>Team Black</b>
        </div>
      </div>
      <div className="card-bottom">
        <span>
          <MapPin size={14} />
          {m.venue}
        </span>
        {m.status === "completed" && <b>Rate this match</b>}
        <ArrowRight size={18} />
      </div>
    </Link>
  );
}
export function Pitch() {
  return (
    <div className="pitch" aria-label="Illustrated seven-a-side football pitch">
      <div className="pitch-center" />
      <div className="pitch-box left" />
      <div className="pitch-box right" />
      {[
        [12, 50],
        [29, 24],
        [29, 76],
        [43, 50],
        [55, 22],
        [55, 78],
        [68, 50],
        [88, 50],
        [72, 24],
        [72, 76],
        [58, 50],
        [45, 24],
        [45, 76],
        [32, 50],
      ].map(([x, y], i) => (
        <i
          key={i}
          className={i > 6 ? "blue" : ""}
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          {(i % 7) + 1}
        </i>
      ))}
    </div>
  );
}
export function FixtureMeta({ m }: { m: Match }) {
  return (
    <div className="meta">
      <span>
        <Clock size={16} />
        {dateLabel(m)} · {m.time} (Dhaka)
      </span>
      <span>
        <MapPin size={16} />
        {m.venue}
      </span>
      <span>7v7 · {m.duration} min</span>
    </div>
  );
}

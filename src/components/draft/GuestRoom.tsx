"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { GuestView } from "@/lib/guest-types";
import { DraftBoard } from "./DraftBoard";
import "../live-club.css";
export function GuestRoom({
  invite,
  initialRoom,
}: {
  invite?: string;
  initialRoom?: string;
}) {
  const [code, setCode] = useState(invite || ""),
    [roomId, setRoomId] = useState(initialRoom || ""),
    [data, setData] = useState<GuestView | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState("");
  const refresh = useCallback(async () => {
    if (!roomId) return;
    try {
      const response = await fetch(
        "/api/guest?room=" + encodeURIComponent(roomId),
        { cache: "no-store" },
      );
      const value = await response.json();
      if (!response.ok) throw Error(value.error);
      setData(value);
      setError("");
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Unable to connect.");
    }
  }, [roomId]);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0),
      timer = setInterval(() => void refresh(), 2000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refresh]);
  const match = data?.matches.find((m) => m.id === selected);
  return (
    <div className="live-club">
      <header className="live-header">
        <Link className="brand" href="/club">
          <span className="crest">TT</span>TEAM TONG
        </Link>
        <Link
          className="button secondary"
          href={code ? "/club?invite=" + encodeURIComponent(code) : "/club"}
        >
          Sign in to participate
        </Link>
      </header>
      <main>
        <div className="live-heading">
          <div>
            <span className="eyebrow">NO ACCOUNT NEEDED TO WATCH</span>
            <h1>{data ? data.room.name : "Come into the room."}</h1>
          </div>
          <Link className="button secondary" href="/club/draft-demo">
            Try a practice draft
          </Link>
        </div>
        <div className="td-demo-banner td-guest-login">
          <div>
            <strong>Guest view · read-only</strong>Watch the live draft, teams
            and match scores. Ratings and vote counts stay private. To rate,
            sign in with your own approved account and be confirmed as an actual
            participant.
          </div>
        </div>
        {error && (
          <p role="alert" className="live-notice">
            {error}
          </p>
        )}
        {!data ? (
          <section className="panel td-guest-gate">
            <h2>Enter a room invitation</h2>
            <p>
              Your organizer can share the room’s eight-character code. A code
              opens guest viewing; it does not grant membership or voting
              access.
            </p>
            <form
              className="form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  const response = await fetch("/api/guest", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: "enter", code }),
                  });
                  const value = await response.json();
                  if (!response.ok) throw Error(value.error);
                  setSelected("");
                  setRoomId(value.roomId);
                  window.history.replaceState(
                    {},
                    "",
                    "/club/guest?room=" + value.roomId,
                  );
                  setError("");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Unable to enter.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Room invitation code
                <input
                  required
                  maxLength={8}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.toUpperCase().replace(/\s/g, ""))
                  }
                  autoCapitalize="characters"
                />
              </label>
              <button disabled={busy}>
                {busy ? "Entering…" : "Enter as guest"}
              </button>
            </form>
          </section>
        ) : match ? (
          <>
            <button className="secondary" onClick={() => setSelected("")}>
              ← All matches
            </button>
            <section className="panel">
              <span className="badge">{match.status}</span>
              <h2>{match.venue}</h2>
              <p>
                {match.date} · {match.time} Dhaka
              </p>
              <h3>
                Team White{" "}
                {match.status === "scheduled"
                  ? "vs"
                  : `${match.score[0]} – ${match.score[1]}`}{" "}
                Team Black
              </h3>
            </section>
            {match.draft ? (
              <DraftBoard
                match={match}
                draft={match.draft}
                players={data.players}
                online={match.online}
              />
            ) : (
              <section className="panel">
                <h3>Draft not started yet</h3>
                <p>
                  The organizer will confirm participants and choose two
                  captains. Come back here to follow their picks live.
                </p>
              </section>
            )}
          </>
        ) : (
          <section className="panel">
            <h2>Matches in this room</h2>
            {!data.matches.length && <p>No matches scheduled yet.</p>}
            <div className="match-grid">
              {data.matches.map((m) => (
                <button
                  key={m.id}
                  className="match-card live-match-card"
                  onClick={() => setSelected(m.id)}
                >
                  <span className="badge">{m.status}</span>
                  <h3>{m.venue}</h3>
                  <p>
                    {m.date} · {m.time} Dhaka
                  </p>
                  <p>
                    {m.draft?.state === "complete"
                      ? "View final teams"
                      : m.draft
                        ? "Watch live draft"
                        : "View match"}{" "}
                    →
                  </p>
                </button>
              ))}
            </div>
            <button
              className="secondary"
              onClick={() => {
                setRoomId("");
                setData(null);
                setCode("");
                window.history.replaceState({}, "", "/club/guest");
              }}
            >
              Enter another room
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

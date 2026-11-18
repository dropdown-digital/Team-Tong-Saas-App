"use client";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RoomPlayers, MyProfile, type AccountProfile } from "./room-players";
import {
  RoomsHub,
  RoomAdmin,
  EmailLink,
  type RoomSummary,
  type RoomDetail,
} from "./rooms";
import { Context } from "./provider";
import { MatchCenter } from "./match-center/MatchCenter";
import { type Store, type Match, score } from "@/lib/domain";
import type { CaptainDraft } from "@/lib/draft";
import { DraftBoard } from "./draft/DraftBoard";
import { ParticipantTools } from "./draft/ParticipantTools";
import { teamName } from "@/lib/lineup";
import "./match-center/match-center.css";
import "./live-club.css";
type User = {
  id: string;
  name: string;
  email: string;
  role: "organizer" | "member";
  status: string;
  email_verified?: number;
};
type Snapshot = {
  store: Store;
  drafts: Record<string, CaptainDraft>;
  online: Record<string, [boolean, boolean]>;
  revision: number;
  members: User[];
};
function apiUrl() {
  return (
    "/api/club" +
    (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("room")
      ? "?room=" +
        encodeURIComponent(
          new URLSearchParams(window.location.search).get("room")!,
        )
      : "")
  );
}
async function api(body?: unknown) {
  const response = await fetch(apiUrl(), {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const value = await response.json();
  if (!response.ok) throw Error(value.error || "Unable to connect.");
  return value;
}
export function LiveClub({
  backend = "sqlite",
  cloudConfigured = false,
  initialMatch = null,
  initialRoom = null,
  invite,
  initialPlayer,
}: {
  backend?: "sqlite" | "supabase";
  cloudConfigured?: boolean;
  initialMatch?: string | null;
  initialRoom?: string | null;
  invite?: string;
  initialPlayer?: string;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]),
    [room, setRoom] = useState<RoomDetail | null>(null),
    [mail, setMail] = useState(false);
  const [user, setUser] = useState<User | null>(null),
    [data, setData] = useState<Snapshot | null>(null),
    [loaded, setLoaded] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [connected, setConnected] = useState(false),
    [selected, setSelected] = useState<string | null>(initialMatch),
    [signup, setSignup] = useState(false);
  const receive = useCallback(
    (value: Snapshot) =>
      setData((prev) =>
        !prev || value.revision >= prev.revision ? value : prev,
      ),
    [],
  );
  const refresh = useCallback(async () => {
    try {
      const value = await api();
      setUser(value.user);
      setProfile(value.profile || null);
      setRooms(value.rooms || []);
      setRoom(value.room || null);
      setMail(!!value.mailConfigured);
      if (value.store) receive(value);
      else setData(null);
      setConnected(true);
    } catch (e) {
      setConnected(false);
      setNotice(e instanceof Error ? e.message : "Connection lost.");
    } finally {
      setLoaded(true);
    }
  }, [receive]);
  const signedInId = user?.id;
  useEffect(() => {
    if (backend !== "supabase" || !initialRoom || !signedInId) return;
    const client = supabaseBrowser();
    const channel = client
      .channel("room:" + initialRoom)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "team_tong_room_activity",
          filter: "room_id=eq." + initialRoom,
        },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [backend, initialRoom, signedInId, refresh]);

  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 2000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    if (!selected || user?.status !== "approved") return;
    const beat = () => {
      if (document.visibilityState === "visible")
        void api({ type: "heartbeat", match: selected })
          .then(receive)
          .catch(() => setConnected(false));
    };
    const leave = () => {
      void fetch(apiUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "leave", match: selected }),
        keepalive: true,
      });
    };
    const visibility = () =>
      document.visibilityState === "visible" ? beat() : leave();
    beat();
    const timer = setInterval(beat, 4000);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", leave);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [selected, user?.id, user?.status, receive]);
  async function act(body: unknown) {
    setBusy(true);
    setNotice("");
    try {
      const value = await api(body);
      if (value.roomId) {
        router.push("/club?room=" + value.roomId + "&ready=1");
        return true;
      }
      if (value.store) receive(value);
      else await refresh();
      if (value.message) setNotice(value.message);
      setConnected(true);
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Action failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  function choose(id: string | null) {
    setSelected(id);
    window.history.replaceState(
      {},
      "",
      id
        ? `/club?room=${initialRoom}&match=${id}`
        : `/club?room=${initialRoom}`,
    );
  }
  const match = data?.store.matches.find((m) => m.id === selected);
  const isOrganizer = user?.role === "organizer";
  return (
    <div className="live-club">
      <header className="live-header">
        <Link href="/club" className="brand">
          <img src="/images/logo.jpg" alt="Team Tong" className="brand-logo-img" />TEAM TONG
        </Link>
        <span>PRIVATE CLUB · REAL ACCOUNTS</span>
        {user && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void act({ type: "logout" })}
          >
            Sign out
          </button>
        )}
      </header>
      <main>
        <div className="live-heading">
          <div>
            <span className="eyebrow">OUR FOOTBALL. OUR PEOPLE.</span>
            <h1>
              {user
                ? `Welcome, ${user.name.split(" ")[0]}.`
                : "Your club starts here."}
            </h1>
          </div>
          <Link className="button secondary" href="/">
            Open separate demo
          </Link>
        </div>
        {notice && (
          <p className="live-notice" role="alert">
            {notice}
          </p>
        )}
        <div className="td-actions">
          <Link className="button secondary" href="/club/draft-demo">
            Try the live draft · no login needed
          </Link>
          <Link
            className="button secondary"
            href={
              invite
                ? `/club/guest?invite=${encodeURIComponent(invite)}`
                : "/club/guest"
            }
          >
            Enter a room as a guest
          </Link>
        </div>
        {cloudConfigured && (
          <p className="live-connection">
            {backend === "supabase"
              ? "Supabase accounts & database · room updates live, with polling backup"
              : "Local database active · Supabase setup pending. Your existing accounts and matches are still available."}
          </p>
        )}
        {backend === "sqlite" && <EmailLink act={act} />}
        {user && profile && (
          <MyProfile
            key={user.name + JSON.stringify(profile)}
            name={user.name}
            profile={profile}
            act={act}
          />
        )}
        {user && room && (
          <RoomAdmin
            room={room}
            user={user}
            members={data?.members || []}
            act={act}
          />
        )}
        {!loaded ? (
          <p>Connecting to the clubhouse…</p>
        ) : !user ? (
          <section className="panel auth-panel">
            <h2>{signup ? "Join Team Tong" : "Sign in"}</h2>
            <p>
              {backend === "supabase"
                ? "Sign in with Supabase. New members need email confirmation and room approval. Existing members: create a Supabase account with the same email first, then link your history below."
                : "Email/password accounts are stored on this server. New members need organizer approval."}
            </p>
            <form
              className="form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const ok = await act({
                  type: signup ? "register" : "login",
                  email: f.get("email"),
                  password: f.get("password"),
                  name: f.get("name"),
                  previousPassword: f.get("previousPassword"),
                });
                if (ok && signup) {
                  setSignup(false);
                  setNotice(
                    backend === "supabase"
                      ? "Check your confirmation email, then sign in with your Supabase password. Existing members should also enter their previous Team Tong password once to link their history."
                      : "Account created. Sign in to join or create a room.",
                  );
                }
              }}
            >
              {signup && (
                <label className="wide">
                  Your name
                  <input
                    name="name"
                    required
                    maxLength={70}
                    autoComplete="name"
                  />
                </label>
              )}
              <label className="wide">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                />
              </label>
              <label className="wide">
                Password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete={signup ? "new-password" : "current-password"}
                />
                <small>At least 12 characters. Use a unique password.</small>
              </label>
              {backend === "supabase" && !signup && (
                <label className="wide">
                  Previous Team Tong password · first-time transition only
                  <input
                    name="previousPassword"
                    type="password"
                    maxLength={128}
                    autoComplete="off"
                  />
                  <small>
                    Leave blank after your account has been linked. This
                    preserves your existing player, rooms and match records.
                  </small>
                </label>
              )}
              <button disabled={busy}>
                {signup ? "Request membership" : "Sign in"}
              </button>
            </form>
            <button className="secondary" onClick={() => setSignup(!signup)}>
              {signup ? "Already a member? Sign in" : "Create an account"}
            </button>
            <details>
              <summary>Forgot password?</summary>
              <form
                className="form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act({
                    type: "requestReset",
                    email: new FormData(e.currentTarget).get("email"),
                  });
                }}
              >
                <label>
                  Email
                  <input name="email" type="email" required />
                </label>
                <button>Send reset email</button>
              </form>
              <p>Email delivery must be configured by the server owner.</p>
            </details>
          </section>
        ) : !initialRoom ? (
          <RoomsHub
            rooms={rooms}
            verified={!!user.email_verified}
            mail={mail}
            act={act}
            invite={invite}
          />
        ) : data ? (
          <>
            <div className="live-connection" role="status">
              {connected
                ? "● Connected · updates every 2 seconds"
                : "○ Connection lost · draft actions unavailable"}{" "}
              · {user.role} · {user.email}
            </div>
            {isOrganizer && (
              <ParticipantTools
                store={data.store}
                members={data.members}
                match={match}
                act={act}
                disabled={busy}
              />
            )}
            <details open={!!initialPlayer || undefined}>
              <summary>Players & leaderboards</summary>
              <RoomPlayers
                store={data.store}
                roomId={initialRoom!}
                selected={initialPlayer}
              />
            </details>
            {match ? (
              <>
                <button className="secondary" onClick={() => choose(null)}>
                  ← All club matches
                </button>
                <a
                  className="button secondary"
                  href={
                    "https://wa.me/?text=" +
                    encodeURIComponent(
                      `${data.store.club} · ${match.venue} · ${match.date} ${match.time} (Dhaka) · Total slot ৳${match.fee}. Open Team Tong and RSVP in your room.`,
                    )
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Share match summary
                </a>
                <DraftRoom
                  match={match}
                  draft={data.drafts[match.id]}
                  online={data.online[match.id] || [false, false]}
                  user={{ ...user, id: data.store.viewer }}
                  players={data.store.players}
                  act={act}
                  disabled={busy || !connected}
                />
                <Context.Provider
                  value={{
                    s: data.store,
                    live: true,
                    organizer: isOrganizer,
                    notice,
                    notify: setNotice,
                    update: () =>
                      setNotice(
                        "Use the official club controls to change shared data.",
                      ),
                    mutate: (id, fn) => {
                      try {
                        const original = data.store.matches.find(
                          (m) => m.id === id,
                        )!;
                        const next = structuredClone(original);
                        fn(next, structuredClone(data.store));
                        if (
                          !original.ballots?.[data.store.viewer] &&
                          next.ballots?.[data.store.viewer]
                        ) {
                          void act({ type: "submit", match: id });
                          return;
                        }
                        const draft = next.drafts?.[data.store.viewer] || {};
                        const changed = Object.keys(draft).find(
                          (target) =>
                            draft[target] !==
                            original.drafts?.[data.store.viewer]?.[target],
                        );
                        if (changed) {
                          void act({
                            type: "voteDraft",
                            match: id,
                            target: changed,
                            value: draft[changed],
                          });
                          return;
                        }
                        if (
                          next.attendance[data.store.viewer] !==
                          original.attendance[data.store.viewer]
                        ) {
                          void act({
                            type: "rsvp",
                            match: id,
                            value: next.attendance[data.store.viewer],
                          });
                          return;
                        }
                        setNotice(
                          "Use the organizer controls below for official changes.",
                        );
                      } catch (e) {
                        setNotice(
                          e instanceof Error ? e.message : "Unable to save.",
                        );
                      }
                    },
                  }}
                >
                  <MatchCenter key={match.id} id={match.id} />
                </Context.Provider>
                {isOrganizer && (
                  <OfficialTools
                    key={match.id}
                    match={match}
                    players={data.store.players}
                    draft={data.drafts[match.id]}
                    act={act}
                    disabled={busy || !connected}
                  />
                )}
              </>
            ) : (
              <>
                <section className="panel">
                  <h2>Club matches</h2>
                  <p>
                    Confirm attendance, follow the captain draft, then rate the
                    match.
                  </p>
                  {!data.store.matches.length && (
                    <p>
                      No real matches yet. An organizer can create the first one
                      below.
                    </p>
                  )}
                  <div className="match-grid">
                    {data.store.matches.map((m) => (
                      <button
                        className="match-card live-match-card"
                        key={m.id}
                        onClick={() => choose(m.id)}
                      >
                        <span className="badge">{m.status}</span>
                        <h3>{m.venue}</h3>
                        <p>
                          {m.date} · {m.time} Dhaka · ৳{m.fee}
                        </p>
                        {m.status === "scheduled" && (
                          <p>
                            {(() => {
                              const hours = Math.ceil(
                                (Date.parse(
                                  m.date + "T" + m.time + ":00+06:00",
                                ) -
                                  Date.now()) /
                                  3600000,
                              );
                              return hours > 0
                                ? `Kickoff in ${hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h`}`
                                : "Kickoff time reached · awaiting organizer";
                            })()}
                          </p>
                        )}
                        <b>
                          Team White{" "}
                          {m.status === "scheduled"
                            ? "vs"
                            : `${score(m, 0)} – ${score(m, 1)}`}{" "}
                          Team Black
                        </b>
                        <p>
                          {m.status === "completed"
                            ? "Rate this match →"
                            : "Open match & draft →"}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
                {isOrganizer && (
                  <section className="panel">
                    <h2>Create a match</h2>
                    <form
                      className="form-grid"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        const [date, time] = String(f.get("when")).split("T");
                        void act({
                          type: "create",
                          venue: f.get("venue"),
                          date,
                          time,
                          fee: Number(f.get("fee")),
                        });
                      }}
                    >
                      <label className="wide">
                        Turf name / location
                        <input name="venue" required maxLength={150} />
                      </label>
                      <label>
                        Match date and time · Dhaka
                        <input type="datetime-local" name="when" required />
                      </label>
                      <label>
                        Total turf slot fee · BDT
                        <input
                          name="fee"
                          type="number"
                          min="0"
                          max="1000000"
                          step="1"
                          required
                        />
                      </label>
                      <button disabled={busy}>Create match</button>
                    </form>
                    <p className="support">
                      7v7. The match clock defaults to 70 minutes. No team or
                      captain selection is required to create a fixture.
                    </p>
                  </section>
                )}
              </>
            )}
          </>
        ) : null}
      </main>
      <footer>Team Tong · Local preview · Nothing deployed</footer>
    </div>
  );
}
type Action = (body: unknown) => Promise<boolean>;
function DraftRoom({
  match: m,
  draft: d,
  online,
  user,
  players,
  act,
  disabled,
}: {
  match: Match;
  draft?: CaptainDraft;
  online: [boolean, boolean];
  user: User;
  players: Store["players"];
  act: Action;
  disabled: boolean;
}) {
  const name = (id: string) =>
    players.find((p) => p.id === id)?.name || "Unknown player";
  const going = players.filter((p) => m.attendance[p.id] === "going");
  if (m.status !== "scheduled") return null;
  const captainSide = d?.captains.indexOf(user.id) ?? -1;
  return (
    <section className="panel draft-room">
      <div className="section-heading">
        <h2>Captain draft</h2>
        <span className="badge">{d?.state || "Attendance open"}</span>
      </div>
      {!d ? (
        <>
          <p>
            {going.length} Going · {m.confirmed?.length || 0}{" "}
            organizer-confirmed. Equal teams support 14–30 players, including
            both captains.
          </p>
          <div className="live-rsvp">
            {(["going", "maybe", "out"] as const).map((value) => (
              <button
                key={value}
                className={m.attendance[user.id] === value ? "" : "secondary"}
                disabled={disabled}
                onClick={() => void act({ type: "rsvp", match: m.id, value })}
              >
                {value === "going"
                  ? "Confirm attendance"
                  : value === "maybe"
                    ? "Maybe"
                    : "Not playing"}
              </button>
            ))}
          </div>
          <p>
            {going.map((p) => p.name).join(" · ") || "No confirmations yet."}
          </p>
          {user.role === "organizer" && (
            <form
              className="form-grid"
              key={going.map((p) => p.id).join()}
              onSubmit={(e) => {
                e.preventDefault();
                void act({
                  type: "confirmPool",
                  match: m.id,
                  players: new FormData(e.currentTarget).getAll("player"),
                });
              }}
            >
              <h3 className="wide">Confirm draft pool</h3>
              {going.map((p) => (
                <label key={p.id}>
                  <input
                    type="checkbox"
                    name="player"
                    value={p.id}
                    defaultChecked={
                      m.confirmed ? m.confirmed.includes(p.id) : true
                    }
                  />
                  {p.name}
                </label>
              ))}
              <button disabled={disabled}>Confirm selected participants</button>
            </form>
          )}
          {user.role === "organizer" && (
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void act({
                  type: "captains",
                  match: m.id,
                  white: f.get("white"),
                  black: f.get("black"),
                });
              }}
            >
              {["white", "black"].map((side) => (
                <label key={side}>
                  Team {side === "white" ? "White" : "Black"} captain
                  <select name={side} required defaultValue="">
                    <option value="" disabled>
                      Choose a confirmed member
                    </option>
                    {going
                      .filter(
                        (p) =>
                          m.confirmed?.includes(p.id) &&
                          (!p.guest || p.accountId),
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
              <button disabled={disabled || !m.confirmed}>
                Select captains & lock attendance
              </button>
            </form>
          )}
        </>
      ) : (
        <>
          <DraftBoard
            match={m}
            draft={d}
            players={players}
            online={online}
            canPick={
              !disabled &&
              d.state === "active" &&
              captainSide === d.turn &&
              online.every(Boolean)
            }
            onPick={(player) =>
              void act({
                type: "pick",
                match: m.id,
                player,
                picks: d.picks.length,
              })
            }
          />
          {d.state !== "complete" && captainSide >= 0 && (
            <button
              disabled={
                disabled || !online.every(Boolean) || d.ready[captainSide]
              }
              onClick={() =>
                void act({
                  type: "ready",
                  match: m.id,
                  generation: d.generation,
                })
              }
            >
              {d.ready[captainSide] ? "You are ready" : "Ready to draft"}
            </button>
          )}
          {d.state !== "complete" && user.role === "organizer" && (
            <details>
              <summary>Replace a captain without restarting</summary>
              <p>
                After picks begin, choose an already-drafted teammate with an
                approved account. The original toss, picks and turn stay
                unchanged.
              </p>
              <form
                className="form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act({
                    type: "replace",
                    match: m.id,
                    side: Number(f.get("side")),
                    player: f.get("player"),
                  });
                }}
              >
                <label>
                  Team
                  <select name="side">
                    <option value="0">Team White</option>
                    <option value="1">Team Black</option>
                  </select>
                </label>
                <label>
                  New captain
                  <select name="player">
                    {d.pool
                      .filter(
                        (id) =>
                          !d.captains.includes(id) &&
                          (!players.find((p) => p.id === id)?.guest ||
                            players.find((p) => p.id === id)?.accountId),
                      )
                      .map((id) => (
                        <option key={id} value={id}>
                          {name(id)}
                        </option>
                      ))}
                  </select>
                </label>
                <button disabled={disabled}>Appoint replacement</button>
              </form>
            </details>
          )}
          <p className="support">
            Keep this tab visible. Disconnects pause selections; both captains
            must confirm readiness to resume. All picks and the coin toss are
            preserved.
          </p>
        </>
      )}
    </section>
  );
}
function OfficialTools({
  match: m,
  players,
  draft,
  act,
  disabled,
}: {
  match: Match;
  players: Store["players"];
  draft?: CaptainDraft;
  act: Action;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState<string>("");
  const goal = m.goals.find((g) => g.id === editing);
  const name = (id: string) => players.find((p) => p.id === id)?.name || id;
  const options = m.teams.flat().map((id) => (
    <option key={id} value={id}>
      {name(id)}
    </option>
  ));
  return (
    <section className="panel official-tools">
      <h2>Organizer · Official match controls</h2>
      <p>
        Server-enforced organizer access. Statistical corrections do not alter
        player ratings or submitted ballots.
      </p>
      <div className="live-rsvp">
        {m.status === "scheduled" ? (
          <button
            disabled={disabled || draft?.state !== "complete"}
            onClick={() => void act({ type: "start", match: m.id })}
          >
            Start match
          </button>
        ) : m.status === "live" ? (
          <button
            disabled={disabled}
            onClick={() => void act({ type: "finish", match: m.id })}
          >
            Finish match · review participants
          </button>
        ) : (
          <button
            disabled={disabled || !m.voting}
            onClick={() => void act({ type: "closeVoting", match: m.id })}
          >
            Close voting · final results
          </button>
        )}
      </div>
      {m.status === "completed" && (
        <section>
          <h3>Participation & rating window</h3>
          {!m.eligibilityFrozen &&
            !m.voting &&
            !Object.keys(m.ballots || {}).length && (
              <>
                <form
                  className="form-grid"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act({
                      type: "confirmPlayed",
                      match: m.id,
                      players: new FormData(e.currentTarget).getAll("player"),
                    });
                  }}
                >
                  <p className="wide">
                    Check everyone who actually played, including every rotating
                    player. RSVP alone does not qualify.
                  </p>
                  {m.teams.flat().map((id) => (
                    <label key={id}>
                      <input
                        type="checkbox"
                        name="player"
                        value={id}
                        defaultChecked={m.played?.includes(id)}
                      />
                      {name(id)}
                    </label>
                  ))}
                  <button disabled={disabled}>
                    Confirm actual participants
                  </button>
                </form>
                <form
                  className="form-grid"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act({
                      type: "openVoting",
                      match: m.id,
                      deadline: new Date(
                        String(new FormData(e.currentTarget).get("deadline")) +
                          ":00+06:00",
                      ).toISOString(),
                    });
                  }}
                >
                  <label>
                    Voting closes (Dhaka time)
                    <input name="deadline" type="datetime-local" required />
                  </label>
                  <button disabled={disabled || !m.playedConfirmed}>
                    Freeze participants & open ratings
                  </button>
                </form>
              </>
            )}
          {m.eligibilityFrozen && (
            <p>Participation is frozen. Submitted ballots cannot be changed.</p>
          )}
          <p>
            Submitted:{" "}
            {(m.submittedBy || []).map(name).join(", ") || "Nobody yet"}.
            Individual scores remain private.
          </p>
        </section>
      )}
      {m.status === "scheduled" && (
        <details>
          <summary>Edit fixture</summary>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void act({
                type: "editMatch",
                match: m.id,
                venue: f.get("venue"),
                date: f.get("date"),
                time: f.get("time"),
                fee: Number(f.get("fee")),
              });
            }}
          >
            <label>
              Turf
              <input name="venue" defaultValue={m.venue} required />
            </label>
            <label>
              Date
              <input type="date" name="date" defaultValue={m.date} required />
            </label>
            <label>
              Time (Dhaka)
              <input type="time" name="time" defaultValue={m.time} required />
            </label>
            <label>
              Slot fee (BDT)
              <input
                type="number"
                name="fee"
                defaultValue={m.fee}
                min="0"
                required
              />
            </label>
            <button disabled={disabled}>Save fixture</button>
          </form>
        </details>
      )}
      {m.status === "scheduled" && draft?.state === "complete" && (
        <>
          <h3>Formation & kickoff seven</h3>
          {[0, 1].map((side) => (
            <div key={side}>
              <h4>{teamName(side)}</h4>
              <label>
                Formation
                <select
                  value={m.formations?.[side] || "2-3-1"}
                  disabled={disabled}
                  onChange={(e) =>
                    void act({
                      type: "formation",
                      match: m.id,
                      side,
                      formation: e.target.value,
                    })
                  }
                >
                  {["2-3-1", "3-2-1", "2-2-2"].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
              <form
                className="form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act({
                    type: "lineup",
                    match: m.id,
                    side,
                    off: f.get("off"),
                    on: f.get("on"),
                  });
                }}
              >
                <label>
                  Move to rotation
                  <select name="off">
                    {m.active[side].map((id) => (
                      <option key={id} value={id}>
                        {name(id)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Start on pitch
                  <select name="on">
                    {m.teams[side]
                      .filter((id) => !m.active[side].includes(id))
                      .map((id) => (
                        <option key={id} value={id}>
                          {name(id)}
                        </option>
                      ))}
                  </select>
                </label>
                <button disabled={disabled}>Update kickoff lineup</button>
              </form>
            </div>
          ))}
        </>
      )}
      {m.status === "live" && (
        <>
          <h3>Playing time & repeat rotations</h3>
          <p>
            {m.elapsed} / {m.duration} minutes logged. Each interval credits the
            current seven on each team.
          </p>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              void act({
                type: "minutes",
                match: m.id,
                minutes: Number(new FormData(e.currentTarget).get("minutes")),
              });
            }}
          >
            <label>
              Minutes to log
              <input
                type="number"
                name="minutes"
                min="1"
                max={Math.max(1, m.duration - m.elapsed)}
                required
                defaultValue="5"
              />
            </label>
            <button disabled={disabled || m.elapsed >= m.duration}>
              Log minutes
            </button>
          </form>
          {[0, 1].map((side) => (
            <form
              className="form-grid"
              key={`${side}-${m.active[side].join()}`}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void act({
                  type: "rotate",
                  match: m.id,
                  side,
                  off: f.get("off"),
                  on: f.get("on"),
                  minute: Number(f.get("minute")),
                });
              }}
            >
              <h4 className="wide">{teamName(side)}</h4>
              <label>
                Off
                <select name="off">
                  {m.active[side].map((id) => (
                    <option key={id} value={id}>
                      {name(id)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                On
                <select name="on">
                  {m.teams[side]
                    .filter((id) => !m.active[side].includes(id))
                    .map((id) => (
                      <option key={id} value={id}>
                        {name(id)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Match minute
                <input
                  type="number"
                  name="minute"
                  required
                  min={m.elapsed}
                  max={m.duration - 1}
                  defaultValue={m.elapsed}
                />
              </label>
              <button disabled={disabled || m.elapsed >= m.duration}>
                Rotate players
              </button>
            </form>
          ))}
        </>
      )}
      {m.status !== "scheduled" && (
        <>
          <h3>Official score</h3>
          {m.officialScore?.some(
            (n, side) => n !== m.goals.filter((g) => g.side === side).length,
          ) && (
            <p className="live-notice">
              The official score differs from the recorded goal events. Check
              the breakdown; no missing scorers will be invented.
            </p>
          )}
          <p>
            The official score can differ from recorded goal events when the
            full scorer breakdown is unavailable. No player goals are invented.
          </p>
          <form
            className="form-grid"
            key={`score-${m.officialScore?.join()}`}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void act({
                type: "score",
                match: m.id,
                white: Number(f.get("white")),
                black: Number(f.get("black")),
              });
            }}
          >
            <label>
              Team White
              <input
                type="number"
                name="white"
                min="0"
                max="99"
                required
                defaultValue={score(m, 0)}
              />
            </label>
            <label>
              Team Black
              <input
                type="number"
                name="black"
                min="0"
                max="99"
                required
                defaultValue={score(m, 1)}
              />
            </label>
            <button disabled={disabled}>Save official score</button>
          </form>
          <h3>{goal ? "Edit goal / assist" : "Record goal / assist"}</h3>
          <form
            key={editing}
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await act({
                  type: "goal",
                  match: m.id,
                  scorer: f.get("scorer"),
                  assist: f.get("assist") === "unknown" ? "" : f.get("assist"),
                  assistStatus:
                    f.get("assist") === "unknown"
                      ? "unknown"
                      : f.get("assist")
                        ? "recorded"
                        : "none",
                  ownGoal: f.get("ownGoal") === "on",
                  minute: f.get("minute") ? Number(f.get("minute")) : null,
                  id: goal?.id,
                })
              )
                setEditing("");
            }}
          >
            <label>
              Scorer
              <select name="scorer" defaultValue={goal?.scorer}>
                {options}
              </select>
            </label>
            <label>
              Assist
              <select
                name="assist"
                defaultValue={
                  goal?.assistStatus === "unknown"
                    ? "unknown"
                    : goal?.assist || ""
                }
              >
                <option value="">No assist</option>
                <option value="unknown">Assist unknown</option>
                {options}
              </select>
              <small>Must be a different player on the scorer’s team.</small>
            </label>
            <label>
              Minute (optional)
              <input
                type="number"
                name="minute"
                min="1"
                max={m.duration}
                defaultValue={goal?.minute ?? ""}
              />
            </label>
            <label>
              <input
                name="ownGoal"
                type="checkbox"
                defaultChecked={goal?.ownGoal}
              />
              Own goal (credits the other team; no assist)
            </label>
            <button disabled={disabled}>
              {goal ? "Save correction" : "Record goal"}
            </button>
            {goal && (
              <button
                type="button"
                className="secondary"
                onClick={() => setEditing("")}
              >
                Cancel edit
              </button>
            )}
          </form>
          {m.goals.map((g) => (
            <div className="live-member" key={g.id}>
              <span>
                {g.minute === null ? "—" : `${g.minute}′`} {name(g.scorer)}
                {g.ownGoal ? " (own goal)" : ""}
                <small>
                  {g.assist
                    ? `Assist: ${name(g.assist)}`
                    : g.assistStatus === "unknown"
                      ? "Assist unknown"
                      : "No assist"}
                </small>
              </span>
              <button
                className="secondary"
                disabled={disabled}
                onClick={() => setEditing(g.id)}
              >
                Edit
              </button>
              <button
                className="secondary"
                disabled={disabled}
                onClick={() =>
                  void act({ type: "removeGoal", match: m.id, id: g.id })
                }
              >
                Remove
              </button>
            </div>
          ))}
          <h3>Official card events</h3>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void act({
                type: "card",
                match: m.id,
                player: f.get("player"),
                kind: f.get("kind"),
                minute: Number(f.get("minute")),
              });
            }}
          >
            <label>
              Player<select name="player">{options}</select>
            </label>
            <label>
              Card
              <select name="kind">
                <option value="yellow">Yellow</option>
                <option value="red">Red</option>
              </select>
            </label>
            <label>
              Minute
              <input
                name="minute"
                type="number"
                min="1"
                max={m.duration}
                required
              />
            </label>
            <button disabled={disabled}>Record card</button>
          </form>
        </>
      )}
    </section>
  );
}

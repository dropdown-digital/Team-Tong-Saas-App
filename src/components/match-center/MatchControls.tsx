import { useState } from "react";
import { useClub } from "../provider";
import {
  type Match,
  balance,
  startMatch,
  rotate,
  finishMatch,
  addGoal,
  addCard,
  logMinutes,
  substitute,
  votingIsOpen,
} from "@/lib/domain";
import { teamName } from "@/lib/lineup";
import { FixtureForm } from "./FixtureForm";
export function Attendance({ match: m }: { match: Match }) {
  const { s, mutate, live } = useClub();
  return (
    <section className="mc-card-panel">
      <div className="mc-section-title">
        <h3>Who’s playing?</h3>
        <span>
          {Object.values(m.attendance).filter((v) => v === "going").length}{" "}
          confirmed
        </span>
      </div>
      {m.status === "scheduled" ? (
        <>
          <div className="mc-rsvp">
            <span>
              {live ? "Your RSVP" : "Your demo RSVP"}
              <strong>{s.players.find((p) => p.id === s.viewer)?.name}</strong>
            </span>
            <div>
              {(["going", "maybe", "out"] as const).map((v) => (
                <button
                  key={v}
                  aria-pressed={m.attendance[s.viewer] === v}
                  className={m.attendance[s.viewer] === v ? "chosen" : ""}
                  onClick={() =>
                    mutate(m.id, (m, s) => {
                      m.attendance[s.viewer] = v;
                      balance(m, s);
                    })
                  }
                >
                  {v === "going" ? "Going" : v === "maybe" ? "Maybe" : "Out"}
                </button>
              ))}
            </div>
          </div>
          {!live && (
            <details>
              <summary>Manage all RSVPs</summary>
              <p className="mc-fine">
                Updating attendance rebuilds provisional lineups and captains.
                This is not verified check-in.
              </p>
              <div className="attendance-grid">
                {s.players.map((p) => (
                  <label key={p.id}>
                    {p.name}
                    <select
                      aria-label={`${p.name} attendance`}
                      value={m.attendance[p.id] || "maybe"}
                      onChange={(e) =>
                        mutate(m.id, (m, s) => {
                          m.attendance[p.id] = e.target.value as
                            "going" | "maybe" | "out";
                          balance(m, s);
                        })
                      }
                    >
                      {["going", "maybe", "out"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </details>
          )}
        </>
      ) : (
        <p className="mc-fine">
          RSVP is locked after kickoff. The full roster keeps every assigned
          player visible; minutes and recorded participation determine who
          played.
        </p>
      )}
    </section>
  );
}
export function MatchControls({ match: m }: { match: Match }) {
  const { s, mutate } = useClub();
  const [editing, setEditing] = useState(false);
  const [scorer, setScorer] = useState("");
  const [side, setSide] = useState(0);
  const patch = (fn: (m: Match) => void) => mutate(m.id, fn);
  const name = (id: string) =>
    s.players.find((p) => p.id === id)?.name || "Unknown player";
  const pool = m.teams.flat();
  const scorerId = pool.includes(scorer) ? scorer : pool[0] || "";
  const scorerSide = m.teams.findIndex((t) => t.includes(scorerId));
  return (
    <details className="mc-card-panel mc-controls">
      <summary>
        Organizer tools <span>LOCAL DEMO</span>
      </summary>
      <p className="mc-fine">
        These controls are open to everyone in this demo. No authenticated
        organizer account is connected.
      </p>
      <div className="mc-control-actions">
        {m.status === "scheduled" ? (
          <>
            <button
              onClick={() => patch(startMatch)}
              disabled={m.active.some((t) => t.length !== 7)}
            >
              Start match
            </button>
            <button className="secondary" onClick={() => setEditing(!editing)}>
              {editing ? "Cancel edit" : "Edit fixture"}
            </button>
            <button
              className="secondary"
              onClick={() => mutate(m.id, (m, s) => balance(m, s))}
            >
              Rebalance squads
            </button>
          </>
        ) : m.status === "live" ? (
          <>
            <button
              disabled={m.elapsed >= m.duration}
              onClick={() => patch(rotate)}
            >
              Log {Math.min(10, m.duration - m.elapsed)} minutes & rotate
            </button>
            <button
              className="secondary"
              onClick={() => {
                if (
                  confirm(
                    "Finish at this score and logged time? Unlogged minutes will not be added.",
                  )
                )
                  patch((m) => finishMatch(m));
              }}
            >
              End match
            </button>
          </>
        ) : (
          <button
            className="secondary"
            onClick={() =>
              patch((m) => {
                if (votingIsOpen(m)) {
                  m.voting = false;
                } else {
                  m.voting = true;
                  m.votingDeadline = new Date(
                    Date.now() + 48 * 3600000,
                  ).toISOString();
                }
              })
            }
          >
            {votingIsOpen(m)
              ? "Close voting · finalize results"
              : "Reopen voting for 48 hours"}
          </button>
        )}
      </div>
      {editing && m.status === "scheduled" && (
        <FixtureForm match={m} onSave={() => setEditing(false)} />
      )}
      {m.status === "live" && (
        <>
          <p className="mc-fine">
            {m.elapsed} / {m.duration} minutes recorded. Manual clock; no time
            advances automatically.
          </p>
          <form
            className="mc-inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              patch((m) =>
                logMinutes(
                  m,
                  Number(new FormData(e.currentTarget).get("minutes")),
                ),
              );
            }}
          >
            <label>
              Log minutes without a rotation
              <input
                aria-label="Minutes to log"
                name="minutes"
                type="number"
                min="1"
                max={Math.max(1, m.duration - m.elapsed)}
                defaultValue="1"
                required
              />
            </label>
            <button disabled={m.elapsed >= m.duration} className="secondary">
              Log minutes
            </button>
          </form>
          <hr />
          <h3>Make a rotation</h3>
          <p className="mc-fine">
            Enter the match minute. Any time since the last log is credited to
            the current seven before the swap. A player can return later.
          </p>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              patch((m) => {
                const minute = Number(f.get("minute"));
                const off = String(f.get("off")),
                  on = String(f.get("on"));
                if (
                  !m.active[side].includes(off) ||
                  m.active[side].includes(on) ||
                  !m.teams[side].includes(on)
                )
                  throw Error("Choose an active and a rotating teammate.");
                if (minute < m.elapsed || minute >= m.duration)
                  throw Error(
                    "Rotation minute must be between logged time and full time.",
                  );
                if (minute > m.elapsed) logMinutes(m, minute - m.elapsed);
                substitute(m, side, off, on);
              });
            }}
          >
            <label>
              Side
              <select
                value={side}
                onChange={(e) => setSide(Number(e.target.value))}
              >
                {[0, 1].map((i) => (
                  <option key={i} value={i}>
                    {teamName(i)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              At minute
              <input
                name="minute"
                type="number"
                min={m.elapsed}
                max={m.duration - 1}
                defaultValue={m.elapsed}
                key={m.elapsed}
                required
              />
            </label>
            <label>
              Coming off
              <select name="off" key={`off-${side}-${m.active[side].join()}`}>
                {m.active[side].map((id) => (
                  <option key={id} value={id}>
                    {name(id)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Coming on
              <select name="on" key={`on-${side}-${m.active[side].join()}`}>
                {m.teams[side]
                  .filter((id) => !m.active[side].includes(id))
                  .map((id) => (
                    <option key={id} value={id}>
                      {name(id)}
                    </option>
                  ))}
              </select>
            </label>
            <button
              disabled={m.elapsed >= m.duration || m.teams[side].length <= 7}
              className="secondary"
            >
              Confirm rotation
            </button>
          </form>
          <hr />
          <h3>Record a goal</h3>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              patch((m) =>
                addGoal(
                  m,
                  scorerId,
                  String(f.get("assist")),
                  Number(f.get("minute")),
                ),
              );
            }}
          >
            <label>
              Scorer
              <select
                aria-label="Scorer"
                value={scorerId}
                onChange={(e) => setScorer(e.target.value)}
              >
                {pool.map((id) => (
                  <option key={id} value={id}>
                    {name(id)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assist
              <select name="assist" aria-label="Assist" key={scorerId}>
                <option value="">No assist</option>
                {(m.teams[scorerSide] || [])
                  .filter((id) => id !== scorerId)
                  .map((id) => (
                    <option key={id} value={id}>
                      {name(id)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Goal minute
              <input
                name="minute"
                aria-label="Goal minute"
                type="number"
                min="1"
                max={m.duration}
                defaultValue={Math.max(1, m.elapsed)}
                required
              />
            </label>
            <button>Record goal</button>
          </form>
          <hr />
          <h3>Record a card</h3>
          <p className="mc-fine">
            Cards are recorded events only. They do not automatically change the
            lineup or enforce suspensions.
          </p>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              patch((m) =>
                addCard(
                  m,
                  String(f.get("player")),
                  String(f.get("kind")) as "yellow" | "red",
                  Number(f.get("minute")),
                ),
              );
            }}
          >
            <label>
              Player
              <select name="player">
                {pool.map((id) => (
                  <option key={id} value={id}>
                    {name(id)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Card
              <select name="kind">
                <option value="yellow">Yellow</option>
                <option value="red">Red</option>
              </select>
            </label>
            <label>
              Card minute
              <input
                name="minute"
                type="number"
                min="1"
                max={m.duration}
                required
                defaultValue={Math.max(1, m.elapsed)}
              />
            </label>
            <button className="secondary">Record card</button>
          </form>
        </>
      )}
    </details>
  );
}
export function Fees({ match: m }: { match: Match }) {
  const { s, mutate, live } = useClub();
  const going = s.players.filter((p) => m.attendance[p.id] === "going");
  return (
    <details className="mc-card-panel">
      <summary>
        Turf collection{" "}
        <span>
          ৳{going.length ? Math.ceil(m.fee / going.length) : "—"} / player
        </span>
      </summary>
      <p className="mc-fine">
        ৳{m.fee} total ·{" "}
        {m.paid.filter((id) => m.attendance[id] === "going").length}/
        {going.length} paid. Rounded up to whole BDT. A local checklist, not a
        payment service.
      </p>
      <div className="payment-grid">
        {going.map((p) => (
          <label key={p.id}>
            <input
              type="checkbox"
              disabled={live}
              checked={m.paid.includes(p.id)}
              onChange={() =>
                mutate(m.id, (m) => {
                  m.paid = m.paid.includes(p.id)
                    ? m.paid.filter((id) => id !== p.id)
                    : [...m.paid, p.id];
                })
              }
            />
            {p.name}
          </label>
        ))}
      </div>
    </details>
  );
}

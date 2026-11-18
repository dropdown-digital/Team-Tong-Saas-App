"use client";
import { useState } from "react";
import Link from "next/link";
import { Undo2, RotateCcw, Pause, Play } from "lucide-react";
import { fixture, type Match, type Player } from "@/lib/domain";
import {
  createDraft,
  readyCaptain,
  pickPlayer,
  reconcilePresence,
  type CaptainDraft,
} from "@/lib/draft";
import { DraftBoard } from "./DraftBoard";
import "../live-club.css";
const names = [
  "Rafi",
  "Siam",
  "Nabil",
  "Tamim",
  "Rony",
  "Mahin",
  "Fahim",
  "Sakib",
  "Arian",
  "Rahat",
  "Imran",
  "Rifat",
  "Jisan",
  "Nayeem",
  "Hasib",
  "Sabbir",
  "Adnan",
  "Sohan",
  "Arif",
  "Tanvir",
];
const players: Player[] = names.map((name, i) => ({
  id: "practice-" + i,
  name,
  position:
    i % 7 === 0 ? "Goalkeeper" : i % 3 === 0 ? "Defender" : "Midfielder",
  number: i + 1,
}));
type State = { match: Match; draft: CaptainDraft };
function begin(count: number): State {
  const m = fixture("practice");
  for (const p of players.slice(0, count)) m.attendance[p.id] = "going";
  const d = createDraft(m, [players[0].id, players[1].id]);
  return { match: m, draft: d };
}
export function PracticeDraft() {
  const [count, setCount] = useState(18),
    [state, setState] = useState<State>(() => begin(18)),
    [history, setHistory] = useState<State[]>([]),
    [notice, setNotice] = useState("");
  const d = state.draft;
  function ready() {
    const next = structuredClone(state);
    const first = crypto.getRandomValues(new Uint32Array(1))[0] % 2;
    for (const id of next.draft.captains)
      readyCaptain(
        next.draft,
        id,
        [true, true],
        next.draft.generation,
        () => first,
      );
    setState(next);
  }
  function pick(id: string) {
    const next = structuredClone(state);
    pickPlayer(
      next.match,
      next.draft,
      next.draft.captains[next.draft.turn],
      id,
      [true, true],
      next.draft.picks.length,
    );
    setHistory((h) => [...h, structuredClone(state)]);
    setState(next);
    setNotice("");
  }
  return (
    <div className="live-club">
      <header className="live-header">
        <Link href="/club" className="brand">
          <span className="crest">TT</span>TEAM TONG
        </Link>
        <Link href="/club" className="button secondary">
          Back to rooms
        </Link>
      </header>
      <main>
        <div className="live-heading">
          <div>
            <span className="eyebrow">TRY IT RIGHT NOW</span>
            <h1>Your next match starts here.</h1>
          </div>
          <label>
            Practice roster
            <select
              aria-label="Practice roster"
              value={count}
              onChange={(e) => {
                const n = Number(e.target.value);
                setCount(n);
                setState(begin(n));
                setHistory([]);
                setNotice("New fictional practice roster.");
              }}
            >
              {[16, 18, 20].map((n) => (
                <option key={n} value={n}>
                  {n} players
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="td-demo-banner">
          <strong>Practice draft · fictional players · no login needed</strong>
          You control both captains here. Nothing is saved to a real room. In a
          live room, only the captain whose turn it is can pick.
        </div>
        <div className="td-actions">
          {d.state === "waiting" && (
            <button onClick={ready}>
              <Play size={16} /> Start practice · toss coin
            </button>
          )}
          {d.state === "paused" && (
            <button onClick={ready}>
              <Play size={16} /> Both captains ready · resume
            </button>
          )}
          {d.state === "active" && (
            <button
              className="secondary"
              onClick={() => {
                const next = structuredClone(state);
                reconcilePresence(next.draft, [true, false]);
                setState(next);
              }}
            >
              <Pause size={16} /> Simulate a disconnect
            </button>
          )}
        </div>
        <DraftBoard
          match={state.match}
          draft={d}
          players={players}
          practice
          canPick={d.state === "active"}
          onPick={pick}
        />
        <div className="td-practice-controls">
          <button
            className="secondary"
            disabled={!history.length || d.state === "paused"}
            onClick={() => {
              setState(history[history.length - 1]);
              setHistory((h) => h.slice(0, -1));
              setNotice("Last practice pick undone.");
            }}
          >
            <Undo2 size={18} />
            Undo last pick
          </button>
          <button
            className="secondary"
            onClick={() => {
              setState(begin(count));
              setHistory([]);
              setNotice("Practice reset. Real rooms are unchanged.");
            }}
          >
            <RotateCcw size={18} />
            Reset practice
          </button>
        </div>
        {notice && <p role="status">{notice}</p>}
        <p className="support">
          18 players finish as 9 per team: 7 active and 2 rotating. Undo and
          Reset are practice controls; real draft history and the original toss
          remain protected.
        </p>
      </main>
    </div>
  );
}

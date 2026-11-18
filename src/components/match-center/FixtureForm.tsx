"use client";
import { useClub } from "../provider";
import { fixture, type Match } from "@/lib/domain";
export function FixtureForm({
  match,
  onSave,
}: {
  match?: Match;
  onSave?: () => void;
}) {
  const { update, notify } = useClub();
  return (
    <form
      className="panel form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        update((s) => {
          const m = match
            ? s.matches.find((m) => m.id === match.id)!
            : fixture(crypto.randomUUID());
          m.date = String(f.get("date"));
          m.time = String(f.get("time"));
          m.venue = String(f.get("venue")).trim();
          if (!m.venue) throw Error("Enter a turf location.");
          m.duration = Number(f.get("duration"));
          m.fee = Number(f.get("fee"));
          if (!match) {
            s.players.forEach((p) => (m.attendance[p.id] = "maybe"));
            s.matches.push(m);
          }
        });
        notify("Fixture saved locally. Find it in Match history.");
        onSave?.();
      }}
    >
      <label>
        Match date
        <input
          type="date"
          name="date"
          required
          defaultValue={match?.date || "2026-10-30"}
        />
      </label>
      <label>
        Kickoff · Dhaka (UTC+6)
        <input
          type="time"
          name="time"
          required
          defaultValue={match?.time || "20:30"}
        />
      </label>
      <label className="wide">
        Turf name and address
        <input
          name="venue"
          required
          maxLength={150}
          defaultValue={match?.venue}
          placeholder="Enter your turf and neighborhood"
        />
      </label>
      <label>
        Duration (minutes)
        <input
          type="number"
          name="duration"
          min="20"
          max="180"
          required
          defaultValue={match?.duration || 70}
        />
      </label>
      <label>
        Total turf fee (BDT)
        <input
          type="number"
          name="fee"
          min="0"
          max="1000000"
          required
          defaultValue={match?.fee ?? 5400}
        />
      </label>
      <p className="support">
        Format: 7v7. All edits remain demo data on this browser.
      </p>
      <button>Save fixture</button>
    </form>
  );
}

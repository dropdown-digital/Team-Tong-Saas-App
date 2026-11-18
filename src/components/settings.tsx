"use client";
import { useState } from "react";
import { useClub } from "./provider";
import { Panel, Title } from "./ui";
import { FixtureForm } from "./matches";
import { seed, storeSchema } from "@/lib/domain";
export function Settings() {
  const { s, update, notify } = useClub();
  const [add, setAdd] = useState(false);
  return (
    <>
      <Title
        eyebrow="BEHIND THE TOUCHLINE"
        title="Club settings."
        subtitle="Keep the football organized. Keep the group chat for everything else."
      />
      <div className="notice">
        <b>You’re in a local demo.</b>
        <p>
          Every name, result, venue, and rating starts as fictional sample data.
          Anyone can use these organizer controls. The viewer selector is not a
          login. Nothing syncs to another phone.
        </p>
      </div>
      <div className="team-grid">
        <div>
          <Panel title="Schedule a fixture">
            <FixtureForm />
          </Panel>
          <Panel title="Squad management">
            <p className="muted">
              {s.players.length} sample members. Edit existing players from
              their profiles.
            </p>
            <button className="secondary" onClick={() => setAdd(!add)}>
              {add ? "Cancel" : "+ Add a player"}
            </button>
            {add && (
              <form
                className="form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const name = String(f.get("name")).trim();
                  if (!name) return;
                  update((s) => {
                    s.players.push({
                      id: crypto.randomUUID(),
                      name,
                      position: String(f.get("position")),
                      number: Number(f.get("number")),
                    });
                  });
                  setAdd(false);
                  notify("Demo player added.");
                }}
              >
                <label>
                  Name
                  <input name="name" required maxLength={70} />
                </label>
                <label>
                  Shirt number
                  <input
                    name="number"
                    type="number"
                    required
                    min="1"
                    max="99"
                    defaultValue="23"
                  />
                </label>
                <label>
                  Position
                  <select name="position">
                    {[
                      "Midfielder",
                      "Forward",
                      "Defender",
                      "Winger",
                      "Goalkeeper",
                    ].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <button>Add player</button>
              </form>
            )}
          </Panel>
        </div>
        <div>
          <Panel title="Your data, your browser">
            <p className="muted">
              Changes save automatically in this browser. Export a backup before
              clearing your browser’s data. Imported backups replace the current
              demo.
            </p>
            <div className="actions">
              <button
                className="secondary"
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(s, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "team-tong-demo-backup.json";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                Export JSON backup
              </button>
              <label className="button secondary file-button">
                Import backup
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      if (file.size > 2000000)
                        throw Error("Backup must be smaller than 2 MB.");
                      const parsed = storeSchema.parse(
                        JSON.parse(await file.text()),
                      );
                      const ids = new Set(parsed.players.map((p) => p.id));
                      if (
                        !ids.has(parsed.viewer) ||
                        ids.size !== parsed.players.length ||
                        parsed.matches.some(
                          (m) =>
                            m.teams.flat().some((id) => !ids.has(id)) ||
                            new Set(m.teams.flat()).size !==
                              m.teams.flat().length,
                        )
                      )
                        throw Error(
                          "Backup has invalid player references or duplicate assignments.",
                        );
                      if (
                        confirm("Replace this browser’s demo with this backup?")
                      ) {
                        update((s) => Object.assign(s, parsed));
                        notify("Backup restored.");
                      }
                    } catch {
                      notify(
                        "Unable to import. Choose a valid Phase 1 Team Tong backup. Current data was kept.",
                      );
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <hr />
            <button
              className="danger"
              onClick={() => {
                if (
                  confirm(
                    "Reset all local changes to the original fictional sample data? Export first if you want to keep them.",
                  )
                ) {
                  update((s) => Object.assign(s, seed()));
                  notify("Sample data restored.");
                }
              }}
            >
              Reset sample data
            </button>
          </Panel>
          <Panel title="Club rules">
            <ul className="rules">
              <li>
                <b>Seven on, everyone involved.</b>
                <p>
                  Two squads of nine for 18 attendees. Log rotations manually to
                  distribute playing time.
                </p>
              </li>
              <li>
                <b>A captain for the match.</b>
                <p>
                  Captaincy changes each fixture and grants no permanent admin
                  role.
                </p>
              </li>
              <li>
                <b>Rate the performance.</b>
                <p>
                  One complete, permanently locked ballot per participant. No
                  self-votes. Ratings unlock after submission and require at
                  least three votes. Open results are provisional.
                </p>
              </li>
            </ul>
          </Panel>
          <Panel title="What comes in Phase 2">
            <p className="muted">
              Supabase can provide invitation-only accounts, shared data,
              server-enforced roles, private voting, and an audit trail. None of
              those services is connected in Phase 1. No account or API key is
              needed now.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}

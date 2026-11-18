"use client";
import { type Store, type Match } from "@/lib/domain";
export function ParticipantTools({
  store,
  members,
  match,
  act,
  disabled,
}: {
  store: Store;
  members: { id: string; name: string; status: string }[];
  match?: Match;
  act: (body: unknown) => Promise<boolean>;
  disabled: boolean;
}) {
  const canAddToMatch =
    match?.status === "scheduled" && !match.captains.some(Boolean);
  const guests = store.players.filter((p) => p.guest && !p.accountId);
  return (
    <details className="panel td-participants">
      <summary>Organizer · Add and manage participants</summary>
      <p>
        Add a real player by name. This creates a football profile, not a login
        account. No email or password is needed to be included in a draft.
      </p>
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            f = new FormData(form);
          if (
            await act({
              type: "addParticipant",
              name: f.get("name"),
              position: f.get("position"),
              match: canAddToMatch ? match.id : undefined,
            })
          )
            form.reset();
        }}
      >
        <label>
          Player name
          <input name="name" required maxLength={70} placeholder="e.g. Rafi" />
        </label>
        <label>
          Preferred position
          <select name="position">
            <option>Midfielder</option>
            <option>Goalkeeper</option>
            <option>Defender</option>
            <option>Winger</option>
            <option>Forward</option>
          </select>
        </label>
        <button disabled={disabled}>
          Add participant{canAddToMatch ? " to this match" : " to room"}
        </button>
      </form>
      {match?.status === "scheduled" && (
        <>
          <h3>Match attendance</h3>
          <p>
            Use this for players without accounts, or confirm attendance on
            someone’s behalf before the draft starts.
          </p>
          <div className="room-grid">
            {store.players.map((p) => (
              <label key={p.id}>
                {p.name}
                {p.guest && !p.accountId ? " · no account" : ""}
                <select
                  aria-label={`Attendance for ${p.name}`}
                  disabled={disabled || !!match.captains.some(Boolean)}
                  value={match.attendance[p.id] || "out"}
                  onChange={(e) =>
                    void act({
                      type: "participantRsvp",
                      match: match.id,
                      player: p.id,
                      value: e.target.value,
                    })
                  }
                >
                  <option value="going">Going</option>
                  <option value="maybe">Maybe</option>
                  <option value="out">Not playing</option>
                </select>
              </label>
            ))}
          </div>
        </>
      )}
      {!!guests.length && (
        <>
          <h3>Connect a participant to their account</h3>
          <p>
            After the player signs up and is approved in this room, link their
            account here. Confirm the person’s identity first. A linked player
            can captain and submit their own ballot while voting is open.
            Linking never changes the confirmed participant list or a submitted
            ballot. Guest visitors cannot claim someone else’s profile.
          </p>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void act({
                type: "linkParticipant",
                player: f.get("player"),
                account: f.get("account"),
              });
            }}
          >
            <label>
              Participant
              <select name="player" required>
                {guests.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Approved account
              <select name="account" required defaultValue="">
                <option value="" disabled>
                  Choose the correct member
                </option>
                {members
                  .filter(
                    (m) =>
                      m.status === "approved" &&
                      !store.players.some((p) => p.accountId === m.id),
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="wide">
              <input type="checkbox" required />I confirm these are the same
              person.
            </label>
            <button disabled={disabled}>Link account to participant</button>
          </form>
        </>
      )}
    </details>
  );
}

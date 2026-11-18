"use client";
import { useState, useEffect, useRef } from "react";
import { imageData } from "./room-players";
export type RoomSummary = {
  id: string;
  name: string;
  logo?: string;
  archived: number;
  role: string;
  status: string;
};
export type RoomDetail = {
  logo?: string | null;
  id: string;
  name: string;
  owner: string | null;
  code?: string;
  archived: number;
  transfer?: { target: string };
  audit: { actor: string; action: string; created: number }[];
};
type Act = (body: unknown) => Promise<boolean>;
export function RoomsHub({
  rooms,
  verified,
  mail,
  act,
  invite,
}: {
  rooms: RoomSummary[];
  verified: boolean;
  mail: boolean;
  act: Act;
  invite?: string;
}) {
  const requestId = useRef<string | null>(null);
  const [preview, setPreview] = useState<{ name: string } | null>(null),
    [code, setCode] = useState(invite || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="panel">
      <span className="eyebrow">YOUR PRIVATE FOOTBALL SPACES</span>
      <h2>My rooms</h2>
      <p>One account. Separate teams, matches and permissions in every room.</p>
      <div className="room-grid">
        {rooms
          .filter((r) => r.status === "approved")
          .map((r) => (
            <article className="panel" key={r.id}>
              <h3>
                {r.logo && (
                  <span
                    className="room-logo"
                    style={{ backgroundImage: `url(${r.logo})` }}
                  />
                )}
                {r.name}
              </h3>
              <p>
                {r.status} · {r.role}
                {r.archived ? " · archived" : ""}
              </p>
              {r.status === "approved" && (
                <a className="button" href={"/club?room=" + r.id}>
                  Open room →
                </a>
              )}
            </article>
          ))}
      </div>
      {rooms.some((r) => r.status !== "approved") && (
        <section>
          <h3>My membership requests</h3>
          {rooms
            .filter((r) => r.status !== "approved")
            .map((r) => (
              <p key={r.id}>
                {r.name} · {r.status}
              </p>
            ))}
        </section>
      )}
      {!rooms.length && (
        <p>
          You haven’t joined a room yet. Ask your organizer for an invite code,
          or create your own.
        </p>
      )}
      <div className="room-grid">
        <section>
          <h3>Join a room</h3>
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const res = await fetch("/api/club", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ type: "invitePreview", code }),
                });
                const value = await res.json();
                if (!res.ok) throw Error(value.error);
                setPreview(value.invitation);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Unable to check code",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Invitation code
              <input
                value={code}
                maxLength={8}
                required
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().replace(/\s/g, ""));
                  setPreview(null);
                }}
                autoCapitalize="characters"
              />
            </label>
            <button disabled={busy}>Check invitation</button>
          </form>
          {error && <p role="alert">{error}</p>}
          {preview && (
            <div>
              <h4>{preview.name}</h4>
              <p>
                Request access. An organizer must approve you before you can see
                any matches or members.
              </p>
              <button onClick={() => void act({ type: "roomJoin", code })}>
                Request to join
              </button>
            </div>
          )}
        </section>
        <section>
          <h3>Create a room</h3>
          {!verified && (
            <p>
              Verify your email first.{" "}
              {mail
                ? "Check your inbox after requesting a verification email."
                : "The server owner must configure email delivery first; see the README."}
            </p>
          )}
          {!verified && (
            <button
              className="secondary"
              disabled={!mail}
              onClick={() => void act({ type: "requestVerification" })}
            >
              Send verification email
            </button>
          )}
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              requestId.current ??= crypto.randomUUID();
              try {
                const logo = await imageData(f.get("logo") as File);
                await act({
                  type: "roomCreate",
                  name: f.get("name"),
                  requestId: requestId.current,
                  logo,
                });
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Unable to create room",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Room name
              <input
                name="name"
                required
                maxLength={70}
                placeholder="Friday football"
              />
            </label>
            <label>
              Optional logo · PNG/JPEG/WebP up to 256 KB
              <input
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
              />
            </label>
            <button disabled={!verified || busy}>Create private room</button>
          </form>
        </section>
      </div>
    </section>
  );
}
export function RoomAdmin({
  room,
  user,
  members,
  act,
}: {
  room: RoomDetail;
  user: { id: string; role: string };
  members: { id: string; name: string; status: string; role: string }[];
  act: Act;
}) {
  const ready =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("ready");
  const owner = room.owner === user.id,
    [copied, setCopied] = useState(false),
    [confirm, setConfirm] = useState("");
  return (
    <section className="panel">
      <div className="live-heading">
        <div>
          <span className="eyebrow">
            {ready ? "ROOM READY · INVITE YOUR FRIENDS" : "CURRENT ROOM"}
          </span>
          <h2>
            {room.logo && (
              <span
                className="room-logo"
                style={{ backgroundImage: `url(${room.logo})` }}
              />
            )}
            {room.name}
          </h2>
        </div>
        <a className="button secondary" href="/club">
          Switch room
        </a>
      </div>
      {room.archived === 1 && (
        <p>This room is archived. Its records are preserved.</p>
      )}
      {room.transfer?.target === user.id && (
        <div className="live-notice">
          <p>
            You have been invited to own this room. The current owner stays an
            organizer after you accept.
          </p>
          <button
            onClick={() =>
              void act({ type: "roomTransferReply", accept: true })
            }
          >
            Accept ownership
          </button>{" "}
          <button
            className="secondary"
            onClick={() =>
              void act({ type: "roomTransferReply", accept: false })
            }
          >
            Decline
          </button>
        </div>
      )}
      {user.role === "organizer" && (
        <details open={ready || undefined}>
          <summary>Room administration</summary>
          {room.code && (
            <div>
              <p>
                Invite code: <strong>{room.code}</strong> · Requests still
                require approval.
              </p>
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      window.location.origin + "/club?invite=" + room.code,
                    );
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? "Copied invite link" : "Copy invite link"}
              </button>
              <p>
                <small>
                  {typeof window !== "undefined" ? window.location.origin : ""}
                  /club?invite={room.code}
                </small>
              </p>
              <button className="secondary" onClick={() => setConfirm("code")}>
                Replace invitation code
              </button>
              <a
                className="button secondary"
                href={"/club/guest?invite=" + room.code}
              >
                Open guest entrance
              </a>
            </div>
          )}
          {confirm === "code" && (
            <div role="alert">
              <p>
                Old links will stop accepting new requests. Existing members and
                pending requests stay unchanged.
              </p>
              <button
                onClick={async () => {
                  if (await act({ type: "roomCode" })) setConfirm("");
                }}
              >
                Confirm new code
              </button>{" "}
              <button className="secondary" onClick={() => setConfirm("")}>
                Cancel
              </button>
            </div>
          )}
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              void act({
                type: "roomRename",
                name: new FormData(e.currentTarget).get("name"),
              });
            }}
          >
            <label>
              Room name
              <input
                key={room.name}
                name="name"
                defaultValue={room.name}
                required
                maxLength={70}
              />
            </label>
            <button>Save name</button>
          </form>
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const logo = await imageData(
                  new FormData(e.currentTarget).get("logo") as File,
                );
                if (logo) await act({ type: "roomLogo", logo });
              } catch (e) {
                setConfirm(
                  e instanceof Error ? e.message : "Image upload failed",
                );
              }
            }}
          >
            <label>
              Room logo · PNG/JPEG/WebP up to 256 KB
              <input
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                required
              />
            </label>
            <button>Save room logo</button>
          </form>
          <h3>Membership requests</h3>
          {members.some((m) => m.status === "pending") && (
            <div>
              <button
                onClick={() =>
                  void act({
                    type: "roomBulk",
                    approve: true,
                    users: members
                      .filter((m) => m.status === "pending")
                      .map((m) => m.id),
                  })
                }
              >
                Approve all pending requests
              </button>{" "}
              <button
                className="secondary"
                onClick={() => setConfirm("reject")}
              >
                Reject all pending
              </button>
              {confirm === "reject" && (
                <button
                  onClick={() =>
                    void act({
                      type: "roomBulk",
                      approve: false,
                      users: members
                        .filter((m) => m.status === "pending")
                        .map((m) => m.id),
                    })
                  }
                >
                  Confirm rejection
                </button>
              )}
            </div>
          )}
          {members
            .filter((m) => m.status === "pending")
            .map((m) => (
              <div className="room-member" key={m.id}>
                <span>{m.name}</span>
                <button
                  onClick={() =>
                    void act({ type: "roomDecide", user: m.id, approve: true })
                  }
                >
                  Approve
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    void act({ type: "roomDecide", user: m.id, approve: false })
                  }
                >
                  Reject
                </button>
              </div>
            ))}
          {!members.some((m) => m.status === "pending") && (
            <p>No pending requests.</p>
          )}
          {owner && (
            <>
              <h3>Organizers & ownership</h3>
              <p>
                Only you can assign organizers or transfer ownership. A transfer
                needs the recipient’s acceptance.
              </p>
              {members
                .filter((m) => m.status === "approved" && m.id !== user.id)
                .map((m) => (
                  <div className="room-member" key={m.id}>
                    <span>
                      {m.name} · {m.role}
                    </span>
                    <button
                      className="secondary"
                      onClick={() =>
                        void act({
                          type: "roomRole",
                          user: m.id,
                          organizer: m.role !== "organizer",
                        })
                      }
                    >
                      {m.role === "organizer"
                        ? "Make member"
                        : "Make organizer"}
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        setConfirm(m.id);
                      }}
                    >
                      Transfer ownership
                    </button>
                    {confirm === m.id && (
                      <button
                        onClick={async () => {
                          if (await act({ type: "roomTransfer", user: m.id }))
                            setConfirm("");
                        }}
                      >
                        Send ownership invitation
                      </button>
                    )}
                  </div>
                ))}
              <button
                className="secondary"
                onClick={() => setConfirm("archive")}
              >
                {room.archived ? "Restore room" : "Archive room"}
              </button>
              {confirm === "archive" && (
                <p>
                  All records will be kept.{" "}
                  <button
                    onClick={async () => {
                      if (
                        await act({
                          type: "roomArchive",
                          archived: !room.archived,
                        })
                      )
                        setConfirm("");
                    }}
                  >
                    Confirm {room.archived ? "restore" : "archive"}
                  </button>
                </p>
              )}
            </>
          )}
          <details>
            <summary>Room activity</summary>
            {room.audit.map((a, i) => (
              <p key={i}>
                <small>
                  {new Date(a.created).toLocaleString()} · {a.action}
                </small>
              </p>
            ))}
          </details>
        </details>
      )}
    </section>
  );
}
export function EmailLink({ act }: { act: Act }) {
  const [link, setLink] = useState<{ kind: string; token: string } | null>(
    null,
  );
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const kind = params.has("verify")
      ? "verify"
      : params.has("reset")
        ? "reset"
        : "";
    const timer = setTimeout(() => {
      if (kind) setLink({ kind, token: params.get(kind)! });
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  if (!link) return null;
  return (
    <section className="panel">
      <h2>
        {link.kind === "verify" ? "Verify your email" : "Set a new password"}
      </h2>
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await act({
              type: link.kind === "verify" ? "verifyEmail" : "resetPassword",
              token: link.token,
              password: new FormData(e.currentTarget).get("password"),
            })
          ) {
            window.history.replaceState(
              {},
              "",
              window.location.pathname + window.location.search,
            );
            setLink(null);
          }
        }}
      >
        {link.kind === "reset" && (
          <label>
            New password
            <input
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
              required
              autoComplete="new-password"
            />
          </label>
        )}
        <button>
          {link.kind === "verify"
            ? "Confirm email address"
            : "Save new password"}
        </button>
      </form>
    </section>
  );
}

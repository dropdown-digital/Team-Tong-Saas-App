"use client";
import { useState } from "react";
import Link from "next/link";
import "@/components/live-club.css";
export default function PasswordPage() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="live-club">
      <div className="panel">
        <h1>Choose your new password</h1>
        <p>
          Open this page using the password-reset email. This changes your
          Supabase password; your match history stays the same.
        </p>
        <form
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const f = new FormData(e.currentTarget);
              const r = await fetch("/api/club", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "setCloudPassword",
                  password: f.get("password"),
                }),
              });
              const v = await r.json();
              setMessage(v.message || v.error);
            } catch {
              setMessage("Unable to connect. Try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <button disabled={busy}>Save new password</button>
        </form>
        <p role="status">{message}</p>
        <Link href="/club">Back to sign in</Link>
      </div>
    </main>
  );
}

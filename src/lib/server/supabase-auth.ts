import { randomUUID } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { supabaseServer } from "../supabase/server";
import { db, transaction, type Account } from "./database";
import { checkPassword, digest, limit } from "./auth";

// A verified Supabase identity never takes a legacy account merely by claiming its name.
// Existing users prove both email ownership and knowledge of their previous local password.
export async function bindIdentity(
  identity: Pick<User, "id" | "email" | "email_confirmed_at" | "user_metadata">,
  previousPassword?: string,
) {
  if (!identity.email || !identity.email_confirmed_at)
    throw Error("Confirm your email before signing in.");
  const email = identity.email.toLowerCase();
  return transaction(async () => {
    const linked = (await db()
      .prepare(
        "SELECT a.* FROM auth_links l JOIN accounts a ON a.id=l.account_id WHERE l.auth_id=?",
      )
      .get(identity.id)) as Account | undefined;
    if (linked) {
      if (linked.status === "suspended") throw Error("Account unavailable.");
      return linked;
    }
    let user = (await db()
      .prepare("SELECT * FROM accounts WHERE lower(email)=?")
      .get(email)) as Account | undefined;
    if (user) {
      if (user.status === "suspended") throw Error("Account unavailable.");
      const bound = await db()
        .prepare("SELECT 1 FROM auth_links WHERE account_id=?")
        .get(user.id);
      if (
        bound ||
        !previousPassword ||
        previousPassword.length > 128 ||
        !checkPassword(previousPassword, user.password)
      )
        throw Error(
          "To keep your existing Team Tong history, enter your previous Team Tong password in the account transition field. If you forgot it, ask the organizer for an identity review; do not create a second player profile.",
        );
    } else {
      const id = randomUUID(),
        name =
          String(identity.user_metadata?.name || email.split("@")[0])
            .trim()
            .slice(0, 70) || "Member";
      await db()
        .prepare(
          "INSERT INTO accounts(id,email,name,password,email_verified) VALUES(?,?,?,'supabase-only',1)",
        )
        .run(id, email, name);
      user = (await db()
        .prepare("SELECT * FROM accounts WHERE id=?")
        .get(id)) as Account;
    }
    await db()
      .prepare("INSERT INTO auth_links VALUES(?,?)")
      .run(identity.id, user.id);
    await db()
      .prepare("UPDATE accounts SET email_verified=1 WHERE id=?")
      .run(user.id);
    return { ...user, email_verified: 1 };
  });
}
export async function cloudSession() {
  const client = await supabaseServer();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user || !user.email_confirmed_at) return null;
  const linked = (await db()
    .prepare(
      "SELECT a.* FROM auth_links l JOIN accounts a ON a.id=l.account_id WHERE l.auth_id=?",
    )
    .get(user.id)) as Account | undefined;
  if (!linked || linked.status === "suspended") return null;
  // getUser verifies the JWT first. getSession is only used to identify this verified session.
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return null;
  const claims = JSON.parse(
    Buffer.from(session.access_token.split(".")[1], "base64url").toString(),
  );
  if (!claims.session_id || claims.sub !== user.id) return null;
  const token = digest("supabase:" + claims.session_id);
  if (
    await db()
      .prepare(
        "SELECT 1 FROM auth_session_revocations WHERE token=? AND expires>?",
      )
      .get(token, Date.now())
  )
    return null;
  await db()
    .prepare(
      "INSERT INTO sessions VALUES(?,?,?) ON CONFLICT(token) DO UPDATE SET expires=excluded.expires",
    )
    .run(token, linked.id, (session.expires_at || 0) * 1000);
  return { user: linked, token };
}
export async function cloudAuth(body: Record<string, unknown>) {
  const client = await supabaseServer();
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const origin = process.env.TEAM_TONG_ORIGIN;
  if (!origin) throw Error("Set TEAM_TONG_ORIGIN before using Supabase Auth.");
  if (
    ["login", "register", "requestReset", "requestVerification"].includes(
      String(body.type),
    )
  ) {
    await limit("cloud-auth:global", 200);
    await limit("cloud-auth:" + digest(email), 12);
  }
  if (body.type === "login" || body.type === "register") {
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      typeof body.password !== "string" ||
      body.password.length < 12 ||
      body.password.length > 128
    )
      throw Error("Enter a valid email and a password of 12–128 characters.");
    if (body.type === "register") {
      if (
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.length > 70
      )
        throw Error("Enter your name.");
      const { error } = await client.auth.signUp({
        email,
        password: body.password,
        options: {
          data: { name: body.name.trim() },
          emailRedirectTo: origin + "/auth/callback",
        },
      });
      if (error) throw Error(error.message);
      return {
        message:
          "Check your email to confirm your Supabase account, then sign in. Existing members: use the same email and enter your previous Team Tong password when signing in to keep your history.",
      };
    }
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password: body.password,
    });
    if (error || !data.user)
      throw Error(
        "Email or password is incorrect, or email confirmation is still required.",
      );
    await bindIdentity(
      data.user,
      typeof body.previousPassword === "string"
        ? body.previousPassword
        : undefined,
    );
    return { ok: true };
  }
  if (body.type === "requestReset") {
    if (!email || email.length > 254) throw Error("Enter your email.");
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: origin + "/auth/callback?next=password",
    });
    if (error)
      throw Error(
        "Unable to send a reset email. Check Supabase email settings or try later.",
      );
    return {
      message: "If the account exists, a password-reset email has been sent.",
    };
  }
  if (body.type === "requestVerification") {
    const {
      data: { user },
    } = await client.auth.getUser();
    const address = user?.email || email;
    if (!address) throw Error("Enter the email you used to sign up.");
    const { error } = await client.auth.resend({
      type: "signup",
      email: address,
      options: { emailRedirectTo: origin + "/auth/callback" },
    });
    if (error) throw Error(error.message);
    return { message: "Confirmation email requested. Check your inbox." };
  }
  if (body.type === "setCloudPassword") {
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError || !user)
      throw Error("Open the password-reset link from your email first.");
    if (
      typeof body.password !== "string" ||
      body.password.length < 12 ||
      body.password.length > 128
    )
      throw Error("Use a password of 12–128 characters.");
    const { error } = await client.auth.updateUser({ password: body.password });
    if (error) throw Error(error.message);
    await client.auth.signOut({ scope: "global" });
    const linked = (await db()
      .prepare("SELECT account_id FROM auth_links WHERE auth_id=?")
      .get(user.id)) as { account_id: string } | undefined;
    if (linked) {
      await db()
        .prepare(
          "INSERT INTO auth_session_revocations SELECT token,expires FROM sessions WHERE account_id=? ON CONFLICT(token) DO UPDATE SET expires=excluded.expires",
        )
        .run(linked.account_id);
      await db()
        .prepare("DELETE FROM sessions WHERE account_id=?")
        .run(linked.account_id);
    }
    return { message: "Password updated. Sign in with your new password." };
  }
  if (body.type === "logout") {
    const auth = await cloudSession();
    if (auth) {
      await db()
        .prepare(
          "INSERT INTO auth_session_revocations SELECT token,expires FROM sessions WHERE token=? ON CONFLICT(token) DO UPDATE SET expires=excluded.expires",
        )
        .run(auth.token);
      await db()
        .prepare("DELETE FROM room_presence WHERE session=?")
        .run(auth.token);
      await db().prepare("DELETE FROM sessions WHERE token=?").run(auth.token);
    }
    await client.auth.signOut({ scope: "local" });
    return { ok: true };
  }
  throw Error(
    "Use a Supabase confirmation or password-reset email for this account.",
  );
}

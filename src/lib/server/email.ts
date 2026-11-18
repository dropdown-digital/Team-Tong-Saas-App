import { randomBytes } from "node:crypto";
import { db, transaction, type Account } from "./database";
import { digest, hashPassword, limit } from "./auth";
export function mailConfigured() {
  return !!(
    process.env.RESEND_API_KEY &&
    process.env.TEAM_TONG_MAIL_FROM &&
    process.env.TEAM_TONG_ORIGIN
  );
}
export async function sendAccountEmail(
  kind: "verify" | "reset",
  email: string,
  user?: Account,
) {
  await limit("mail:global", 100);
  await limit("mail:" + digest(email), 4);
  if (!mailConfigured())
    throw Error(
      "Email delivery is not configured. Ask the server owner to follow the README email setup.",
    );
  const account =
    kind === "verify"
      ? user
      : ((await db()
          .prepare("SELECT id,email FROM accounts WHERE email=?")
          .get(email)) as { id: string; email: string } | undefined);
  if (!account) return;
  const token = randomBytes(32).toString("hex");
  const origin = new URL(process.env.TEAM_TONG_ORIGIN!);
  if (!["http:", "https:"].includes(origin.protocol))
    throw Error("Invalid configured application origin.");
  const link = new URL("/club", origin);
  link.hash = kind + "=" + token;
  await db()
    .prepare("INSERT INTO email_tokens VALUES(?,?,?,?)")
    .run(digest(token), account.id, kind, Date.now() + 3600000);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.TEAM_TONG_MAIL_FROM,
      to: [account.email],
      subject:
        kind === "verify"
          ? "Verify your Team Tong email"
          : "Reset your Team Tong password",
      text: `Open this link within one hour: ${link.toString()}\nIf you did not request this, ignore this message.`,
    }),
  });
  if (!response.ok) {
    await db()
      .prepare("DELETE FROM email_tokens WHERE token=?")
      .run(digest(token));
    throw Error(
      "Email could not be sent. Check the server email configuration.",
    );
  }
}
export async function consumeEmail(
  kind: "verify" | "reset",
  token: string,
  password?: string,
) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw Error("Invalid or expired email link.");
  if (
    kind === "reset" &&
    (!password || password.length < 12 || password.length > 128)
  )
    throw Error("Use a password of 12–128 characters.");
  return await transaction(async () => {
    const row = (await db()
      .prepare(
        "SELECT account_id FROM email_tokens WHERE token=? AND kind=? AND expires>?",
      )
      .get(digest(token), kind, Date.now())) as
      { account_id: string } | undefined;
    if (!row) throw Error("Invalid or expired email link.");
    if (kind === "verify")
      await db()
        .prepare("UPDATE accounts SET email_verified=1 WHERE id=?")
        .run(row.account_id);
    else {
      await db()
        .prepare("UPDATE accounts SET password=? WHERE id=?")
        .run(hashPassword(password!), row.account_id);
      await db()
        .prepare("DELETE FROM sessions WHERE account_id=?")
        .run(row.account_id);
    }
    await db()
      .prepare("DELETE FROM email_tokens WHERE account_id=? AND kind=?")
      .run(row.account_id, kind);
    return { ok: true };
  });
}

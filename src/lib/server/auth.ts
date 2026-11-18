import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import type { NextRequest } from "next/server";
import { db, account, transaction, type Account } from "./database";
export const COOKIE = "team_tong_session";
export const digest = (v: string) =>
  createHash("sha256").update(v).digest("hex");
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function checkPassword(password: string, hash: string) {
  const [salt, value] = hash.split(":");
  const candidate = scryptSync(password, salt, 64);
  return (
    candidate.length === Buffer.from(value, "hex").length &&
    timingSafeEqual(candidate, Buffer.from(value, "hex"))
  );
}
export async function limit(key: string, max = 12) {
  return transaction(async () => {
    const sql = db(),
      now = Date.now();
    const row = (await sql
      .prepare("SELECT count,until FROM attempts WHERE key=?")
      .get(key)) as { count: number; until: number } | undefined;
    if (row && row.until > now && row.count >= max)
      throw Error("Too many attempts. Please try again in 15 minutes.");
    await sql
      .prepare(
        "INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN attempts.until<? THEN 1 ELSE attempts.count+1 END,until=CASE WHEN attempts.until<? THEN excluded.until ELSE attempts.until END",
      )
      .run(key, now + 900000, now, now);
  });
}
export async function register(email: string, password: string, name: string) {
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    password.length < 12 ||
    password.length > 128 ||
    !name.trim() ||
    name.length > 70
  )
    throw Error(
      "Enter a name, valid email and a password of 12–128 characters.",
    );
  try {
    await db()
      .prepare("INSERT INTO accounts(id,email,name,password) VALUES(?,?,?,?)")
      .run(randomUUID(), email, name.trim(), hashPassword(password));
  } catch {
    throw Error("Unable to create this account. Try signing in instead.");
  }
}
export async function login(email: string, password: string) {
  const user = (await db()
    .prepare("SELECT * FROM accounts WHERE email=?")
    .get(email)) as Account | undefined;
  const fallback = "00000000000000000000000000000000:" + "00".repeat(64);
  if (
    !checkPassword(password, user?.password || fallback) ||
    !user ||
    user.status === "suspended"
  )
    throw Error("Email or password is incorrect, or access is unavailable.");
  const token = randomBytes(32).toString("hex");
  await db()
    .prepare("INSERT INTO sessions VALUES(?,?,?)")
    .run(digest(token), user.id, Date.now() + 7 * 86400000);
  return token;
}
export async function session(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  const row = (await db()
    .prepare("SELECT account_id FROM sessions WHERE token=? AND expires>?")
    .get(digest(token), Date.now())) as { account_id: string } | undefined;
  const user = row && (await account(row.account_id));
  return user && user.status !== "suspended"
    ? { user, token: digest(token) }
    : null;
}

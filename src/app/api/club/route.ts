import { safeImage } from "@/lib/server/images";
import { ownProfile, updateProfile } from "@/lib/server/profiles";
import {
  roomList,
  roomInfo,
  roomActor,
  roomCommand,
  invitation,
} from "@/lib/server/rooms";
import {
  mailConfigured,
  sendAccountEmail,
  consumeEmail,
} from "@/lib/server/email";
import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE,
  session,
  register,
  login,
  limit,
  digest,
} from "@/lib/server/auth";
import { cloudAuth, cloudSession } from "@/lib/server/supabase-auth";
import { db, supabaseMode } from "@/lib/server/database";
import { snapshot, command, heartbeat } from "@/lib/server/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store, private", Vary: "Cookie" },
  });
}
export async function GET(req: NextRequest) {
  try {
    const auth = supabaseMode() ? await cloudSession() : await session(req);
    if (!auth)
      return json({
        user: null,
        backend: supabaseMode() ? "supabase" : "sqlite",
      });
    const { password: _, ...user } = auth.user;
    void _;
    const roomId = req.nextUrl.searchParams.get("room");
    const base = {
      user,
      backend: supabaseMode() ? "supabase" : "sqlite",
      rooms: await roomList(auth.user),
      mailConfigured: supabaseMode() || mailConfigured(),
      profile: await ownProfile(auth.user),
    };
    if (!roomId) return json(base);
    const info = await roomInfo(auth.user, roomId),
      actor = await roomActor(auth.user, roomId, true);
    return json({
      ...base,
      user: { ...user, role: actor.role, status: actor.status },
      room: info,
      ...(!info.archived ? await snapshot(auth.user, roomId) : {}),
    });
  } catch {
    return json({ error: "Unable to load the clubhouse." }, 500);
  }
}
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (
      !origin ||
      new URL(origin).host !== req.headers.get("host") ||
      !["http:", "https:"].includes(new URL(origin).protocol) ||
      (process.env.TEAM_TONG_ORIGIN && origin !== process.env.TEAM_TONG_ORIGIN)
    )
      return json({ error: "Same-origin request required." }, 403);
    const text = await req.text();
    if (text.length > 400000) return json({ error: "Request too large." }, 413);
    const body = JSON.parse(text);
    const roomId = req.nextUrl.searchParams.get("room") || undefined;
    if (
      supabaseMode() &&
      [
        "login",
        "register",
        "logout",
        "requestReset",
        "requestVerification",
        "verifyEmail",
        "resetPassword",
        "setCloudPassword",
      ].includes(body.type)
    )
      return json(await cloudAuth(body));
    if (body.type === "invitePreview")
      return json({ invitation: await invitation(body.code) });
    if (body.type === "verifyEmail" || body.type === "resetPassword")
      return json(
        await consumeEmail(
          body.type === "verifyEmail" ? "verify" : "reset",
          body.token,
          body.password,
        ),
      );
    if (body.type === "requestReset") {
      if (typeof body.email !== "string" || body.email.length > 254)
        throw Error("Enter your email.");
      await sendAccountEmail("reset", body.email.trim().toLowerCase());
      return json({
        message: "If the account exists, an email has been sent.",
      });
    }
    if (body.type === "register" || body.type === "login") {
      if (
        typeof body.email !== "string" ||
        typeof body.password !== "string" ||
        body.password.length > 128
      )
        throw Error("Enter valid account details.");
      const email = body.email.trim().toLowerCase();
      await limit("auth:all", 200);
      await limit("auth:" + digest(email), 12);
      if (body.type === "register") {
        if (typeof body.name !== "string") throw Error("Enter your name.");
        await register(email, body.password, body.name);
        return json({
          message: "Account created. Sign in to join or create a room.",
        });
      }
      const token = await login(email, body.password),
        res = json({ ok: true });
      res.cookies.set(COOKIE, token, {
        httpOnly: true,
        sameSite: "strict",
        secure: new URL(origin).protocol === "https:",
        path: "/",
        maxAge: 7 * 86400,
      });
      return res;
    }
    const auth = supabaseMode() ? await cloudSession() : await session(req);
    if (!auth) return json({ error: "Please sign in." }, 401);
    if (body.type === "logout") {
      await db()
        .prepare("DELETE FROM presence WHERE session=?")
        .run(auth.token);
      await db()
        .prepare("DELETE FROM room_presence WHERE session=?")
        .run(auth.token);
      await db().prepare("DELETE FROM sessions WHERE token=?").run(auth.token);
      const res = json({ ok: true });
      res.cookies.set(COOKIE, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        sameSite: "strict",
      });
      return res;
    }
    if (body.type === "requestVerification") {
      await sendAccountEmail("verify", auth.user.email, auth.user);
      return json({ message: "Verification email sent." });
    }
    if (body.type === "profile") {
      if (body.portrait !== undefined)
        body.portrait = await safeImage(body.portrait);
      return json(await updateProfile(auth.user, body));
    }
    if (body.type === "roomCreate" && body.logo !== undefined)
      body.logo = await safeImage(body.logo);
    if (body.type === "roomLogo") {
      if (!roomId) throw Error("Choose a room.");
      if ((await roomActor(auth.user, roomId)).role !== "organizer")
        throw Error("Organizer access required.");
      body.logo = await safeImage(body.logo);
    }
    if (typeof body.type === "string" && body.type.startsWith("room"))
      return json(await roomCommand(auth.user, body, roomId));
    if (!roomId) return json({ error: "Choose a room first." }, 403);
    await roomActor(auth.user, roomId);
    if (body.type === "heartbeat" || body.type === "leave") {
      if (typeof body.match !== "string") throw Error("Choose a match.");
      return json(
        await heartbeat(
          auth.user,
          auth.token,
          body.match,
          body.type === "leave",
          roomId,
        ),
      );
    }
    return json(await command(auth.user, body, roomId));
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error ? e.message : "Unable to complete this action.",
      },
      400,
    );
  }
}

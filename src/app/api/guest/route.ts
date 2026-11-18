import { NextRequest, NextResponse } from "next/server";
import { GUEST_COOKIE, enterGuest, guestView } from "@/lib/server/guests";
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
    return json(
      await guestView(
        req.cookies.get(GUEST_COOKIE)?.value,
        req.nextUrl.searchParams.get("room") || "",
      ),
    );
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Guest access unavailable." },
      403,
    );
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
    const raw = await req.text();
    if (raw.length > 1000) return json({ error: "Request too large." }, 413);
    const body = JSON.parse(raw);
    if (body.type !== "enter")
      return json(
        { error: "Guest access is read-only. Sign in to participate or rate." },
        403,
      );
    const access = await enterGuest(body.code),
      res = json({ roomId: access.roomId });
    res.cookies.set(GUEST_COOKIE, access.token, {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(origin).protocol === "https:",
      path: "/",
      maxAge: 86400,
    });
    return res;
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Unable to enter room." },
      400,
    );
  }
}

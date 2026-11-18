import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseMode } from "@/lib/server/database";
export async function GET(req: NextRequest) {
  const origin = process.env.TEAM_TONG_ORIGIN || req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  if (supabaseMode() && code) {
    const client = await supabaseServer();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          req.nextUrl.searchParams.get("next") === "password"
            ? "/club/password"
            : "/club?confirmed=1",
          origin,
        ),
      );
  }
  return NextResponse.redirect(new URL("/club?authError=expired", origin));
}

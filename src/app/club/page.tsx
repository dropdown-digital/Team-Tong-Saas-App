import { supabaseMode } from "@/lib/server/database";
import { LiveClub } from "@/components/live-club";
export default async function ClubPage({
  searchParams,
}: {
  searchParams: Promise<{
    match?: string;
    room?: string;
    invite?: string;
    player?: string;
  }>;
}) {
  const p = await searchParams;
  return (
    <LiveClub
      backend={supabaseMode() ? "supabase" : "sqlite"}
      cloudConfigured={!!process.env.NEXT_PUBLIC_SUPABASE_URL}
      key={p.room || "rooms"}
      initialRoom={p.room || null}
      initialMatch={p.match || null}
      invite={p.invite}
      initialPlayer={p.player}
    />
  );
}

import { GuestRoom } from "@/components/draft/GuestRoom";
export default async function GuestPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; room?: string }>;
}) {
  const p = await searchParams;
  return <GuestRoom invite={p.invite} initialRoom={p.room} />;
}

import { MatchDetails } from "@/components/matches";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <MatchDetails id={(await params).id} />;
}

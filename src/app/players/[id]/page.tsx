import { Profile } from "@/components/players";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <Profile id={(await params).id} />;
}

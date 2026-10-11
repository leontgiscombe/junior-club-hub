// The squad now lives in Members (each team's players, with their parents),
// like Spond. Old links and saved shortcuts land there.
import { redirect } from "next/navigation";

export default async function PlayersPage({ searchParams }: { searchParams: Promise<{ q?: string; key?: string }> }) {
  const { q, key } = await searchParams;
  const params = new URLSearchParams();
  if (key) params.set("key", key);
  if (q) params.set("q", q);
  redirect(`/admin/members${params.size ? `?${params}` : ""}`);
}

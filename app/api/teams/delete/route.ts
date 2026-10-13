// Deleting an archived team for good (lib/teamDelete.ts), club admins only.
//   GET  ?key=…&team=slug                 -> { name, footprint } (what would go)
//   POST ?key=… { team, confirm }         -> deletes it, once `confirm` is the team's name
import { NextRequest, NextResponse } from "next/server";
import { isClubAdmin } from "@/lib/adminAuth";
import { getAllTeams } from "@/lib/settings";
import { requireTenant } from "@/lib/tenant";
import { deleteTeamForGood, teamFootprint } from "@/lib/teamDelete";

export const dynamic = "force-dynamic";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

async function find(req: NextRequest, slug: string) {
  if (!(await isClubAdmin(req.nextUrl.searchParams.get("key") ?? ""))) return { error: NextResponse.json({ error: "Only a club admin can delete a team" }, { status: 403 }) };
  const team = (await getAllTeams()).find((t) => t.slug === slug);
  if (!team) return { error: NextResponse.json({ error: "No such team" }, { status: 404 }) };
  if (!team.archived) return { error: NextResponse.json({ error: "Archive the team first" }, { status: 400 }) };
  return { team };
}

export async function GET(req: NextRequest) {
  const found = await find(req, req.nextUrl.searchParams.get("team") ?? "");
  if (found.error) return found.error;
  return NextResponse.json({ name: found.team.name, footprint: await teamFootprint(await requireTenant(), found.team.slug) });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { team?: unknown; confirm?: unknown } | null;
  const found = await find(req, typeof body?.team === "string" ? body.team : "");
  if (found.error) return found.error;
  if (typeof body?.confirm !== "string" || !same(body.confirm, found.team.name)) {
    return NextResponse.json({ error: `Type the team's name, ${found.team.name}, to delete it` }, { status: 400 });
  }
  await deleteTeamForGood(await requireTenant(), found.team.slug);
  return NextResponse.json({ ok: true });
}

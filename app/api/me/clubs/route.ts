// The clubs the signed-in account belongs to, for the club switcher (tap the
// crest on Home): each one's name, crest, address and whether it's this one.
//   GET -> { clubs: [{ name, crest, home, current, waiting }], start } (start: the
//          platform's opening screen, where switching and joining happen)
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getClubFor } from "@/lib/settings";
import { getTenant, platformUrl, tenantUrl } from "@/lib/tenant";
import { clubsOfUser } from "@/lib/userClubs";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const [here, mine] = await Promise.all([getTenant(), clubsOfUser(user.id).catch(() => [])]);
  const clubs = await Promise.all(
    mine
      .filter((c) => c.status !== "declined")
      .map(async (c) => {
        const { crest } = await getClubFor(c.id);
        return {
          name: c.name,
          // the crest from the club's own address (it's a path there)
          crest: crest.src.startsWith("/") ? tenantUrl(c.id, crest.src) : crest.src,
          home: c.url,
          current: c.id === here,
          waiting: c.status === "pending",
        };
      }),
  );
  clubs.sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name));
  return NextResponse.json({ clubs, start: platformUrl("/start") }, { headers: { "cache-control": "no-store" } });
}

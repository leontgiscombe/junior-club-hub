"use client";

// Coach Admin → Fixtures keeps each shown team's games in step with FA
// Full-Time, the same way the Match Log does (FaSync): opening the page
// brings in new and changed games (at most hourly per team on each phone),
// and the list redraws if anything came in.
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { SESSION_KEY } from "@/lib/access";
import FaSync from "../../components/FaSync";

const ignore = () => {};

export default function FaSyncTeams({ teams }: { teams: { slug: string; name: string }[] }) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  return (
    <div className="-mb-4">
      {teams.map((t) => (
        <FaSync
          key={t.slug}
          team={t.slug}
          adminKey={SESSION_KEY}
          onMatches={ignore}
          onSynced={refresh}
          label={teams.length > 1 ? `${t.name}: fixtures from FA Full-Time` : undefined}
        />
      ))}
    </div>
  );
}

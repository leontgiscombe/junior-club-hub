// How players' names appear on the pages parents see (the results page and the
// kit form). A hub open to everyone shows "Jamie S." — enough for parents to
// know who's who without publishing children's full names on a page anyone can
// open. A private hub (Coach Admin → Members) is only seen by people a coach
// has approved, so it shows full names, like Spond. Server only.
import { readAccess } from "./access";
import { getTenant } from "./tenant";

export async function showFullNames(): Promise<boolean> {
  const tenant = await getTenant();
  if (!tenant) return false;
  try {
    return (await readAccess(tenant)).private;
  } catch {
    return false;
  }
}

/** "Jamie Smith" -> "Jamie S." */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

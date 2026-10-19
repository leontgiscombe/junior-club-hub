// The squad player a child a parent typed in most likely already is, so a coach
// approving them (app/components/MembersAdmin.tsx) has it picked already:
// "alfie brooke" finds "Alfie Brook", "Alex Ellis" finds "Alexander Ellis".
// Only a clear best match counts: two equally close players, or none close
// enough, picks no one ("new"), and the coach chooses.

type Player = { id: string; name: string; team: string };

const words = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .replace(/['-]/g, "")
    .split(/\s+/)
    .filter(Boolean);

function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

/** How alike two names (single words) are, 0 to 1: a short form ("Alex", "Alexander") counts as close. */
function alike(a: string, b: string): number {
  if (a === b) return 1;
  if (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a))) return 0.85;
  return 1 - distance(a, b) / Math.max(a.length, b.length);
}

// close enough on its own; a name just under it ("Alfy", "Alfie") still counts
// when the surname agrees
const CLOSE = 0.75;
const NEAR = 0.6;

/** The id of the squad player `child` most likely is (in their team, if they have one), or "new". */
export function likelyPlayer(child: { name: string; team?: { slug: string } }, players: Player[]): string {
  const [first, ...rest] = words(child.name);
  if (!first) return "new";
  const last = rest.at(-1);
  let best = { id: "new", score: 0 };
  let tie = false;
  for (const p of players) {
    if (child.team && p.team !== child.team.slug) continue;
    const [pf, ...pr] = words(p.name);
    if (!pf) continue;
    const firstScore = alike(first, pf);
    const pl = pr.at(-1);
    let score = firstScore;
    if (last && pl) {
      // a surname that's an initial ("Alfie B") matches on the letter
      const lastScore = last.length === 1 || pl.length === 1 ? (last[0] === pl[0] ? 0.8 : 0) : alike(last, pl);
      if (firstScore < NEAR || lastScore < CLOSE) continue;
      score = (firstScore + lastScore) / 2;
    }
    if (score < CLOSE) continue;
    if (score > best.score) {
      best = { id: p.id, score };
      tie = false;
    } else if (score === best.score) tie = true;
  }
  return tie ? "new" : best.id;
}

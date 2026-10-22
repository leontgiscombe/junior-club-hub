# Drill pack

Drills and season plans that come built into the hub's drill library.

The pack is the hub's own, written for it. It is split into age bands
(`AGE_BANDS` in `lib/trainingPlanTypes.ts`: U8, U9–11, U12–14, U15–17, U18),
each with its own folder: 126 drills, 21 on each of six topics (passing,
control/turning, dribbling, movement, finishing and defending), each topic with
7 warm-ups, 7 technical practices and 7 games, and a 42-week season plan built
from them. A team's plan is filled from its own band's (by its age group). Don't
add content you don't have the rights to: every club using the hub gets the pack.

- `index.ts`: puts the pack together from each band's folder (`PACKS`),
  exporting the drills (`DRILLS`), each band's season plan (`SEASON_PLANS`) and
  `drawnFile`, which draws a drill's diagram.
- `u9-11/`, `u12-14/`, `u15-17/`, `u18/` (and one folder per band as they're written): the drills, one file
  per topic, and the band's `index.ts` listing the topics in season-plan order.
  Within a topic, each kind's drills run easiest first; the season plan takes
  the first four of each kind for its first block on that topic and the last
  three for its second.
- `diagram.ts`: each drill's diagram is described in yards — cones, players,
  goals, and passes, runs, dribbles and shots — and drawn as an SVG when a coach
  opens it, so there are no image files to keep.
- `files/` (optional): page images or PDFs for a drill, listed in its `files`.

Signed-in coaches get a drill's files through `/api/training/files`; they are
never public. The app reads the pack only through `lib/builtInDrills.ts`, and
`next.config.ts` includes `files/` in the deployment.

## Running the hub without it

Replace `index.ts` with an empty pack:

```ts
import type { AgeBand, Drill, DrillTopic } from "@/lib/trainingPlanTypes";

export const DRILLS: Drill[] = [];

export const SEASON_PLANS: Partial<
  Record<AgeBand, { title: string; weeks: { topic: DrillTopic; drillIds: string[] }[] }>
> = {};

export function drawnFile(_name: string): string | undefined {
  return undefined;
}
```

The drill library then starts empty for coaches to fill, and the "Use the
season plan" button doesn't show.

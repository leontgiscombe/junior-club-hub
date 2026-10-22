// The drill pack: drills and season plans that come built into the drill
// library, written for the hub. Each age band (AGE_BANDS) has its own folder:
// 126 drills, 21 on each of six topics (7 warm-ups, 7 technical practices and
// 7 games), and a 42-week season plan built from them. Each drill's diagram is
// drawn from its description (see diagram.ts) rather than kept as an image.
// The app reads the pack only through lib/builtInDrills.ts; see README.md here.
import type { AgeBand, Drill, DrillKind, DrillTopic } from "@/lib/trainingPlanTypes";
import { bandName } from "@/lib/trainingPlanTypes";
import { diagramSvg } from "./diagram";
import type { BandPack } from "./types";
import { U9_11 } from "./u9-11";
import { U12_14 } from "./u12-14";
import { U15_17 } from "./u15-17";
import { U18 } from "./u18";

const PACKS: BandPack[] = [U9_11, U12_14, U15_17, U18];

const diagramName = (id: string) => `${id}.svg`;

export const DRILLS: Drill[] = PACKS.flatMap(({ band, topics }) =>
  topics.flatMap(({ topic, drills }) =>
    drills.map((d) => ({
      id: d.id,
      title: d.title,
      kind: d.kind,
      topic,
      ageGroup: band,
      minutes: d.minutes,
      players: d.players,
      equipment: d.equipment,
      setup: d.setup,
      howItWorks: d.howItWorks,
      coachingPoints: d.coachingPoints,
      progressions: d.progressions,
      videoUrl: "",
      files: [{ name: diagramName(d.id), label: "Diagram", type: "image" as const }],
      uploads: [],
      builtIn: true,
      updatedAt: "",
    }))
  )
);

const DIAGRAMS = new Map(
  PACKS.flatMap(({ topics }) => topics.flatMap(({ drills }) => drills.map((d) => [diagramName(d.id), d] as const)))
);

/** A file the pack draws rather than keeps in files/ — a drill's diagram, as SVG. */
export function drawnFile(name: string): string | undefined {
  const drill = DIAGRAMS.get(name);
  return drill ? diagramSvg(drill.title, drill.diagram) : undefined;
}

// Each band's season: two rounds of its topics, in blocks of four weeks and
// then three, each week a warm-up, a technical practice and a game. The first
// round takes each topic's first four drills of each kind, the second its
// harder last three, so every drill is used once.
const ROUNDS = [4, 3];

function seasonWeeks({ topics }: BandPack): { topic: DrillTopic; drillIds: string[] }[] {
  const weeks: { topic: DrillTopic; drillIds: string[] }[] = [];
  const used = new Map<DrillTopic, number>();
  for (const length of ROUNDS) {
    for (const { topic, drills } of topics) {
      const start = used.get(topic) ?? 0;
      for (let w = start; w < start + length; w++) {
        const pick = (kind: DrillKind) => drills.filter((d) => d.kind === kind)[w]?.id;
        const drillIds = [pick("warm-up"), pick("technical"), pick("game")].filter((id): id is string => !!id);
        if (drillIds.length) weeks.push({ topic, drillIds });
      }
      used.set(topic, start + length);
    }
  }
  return weeks;
}

export type SeasonPlan = { title: string; weeks: { topic: DrillTopic; drillIds: string[] }[] };

/** Each band's season plan; a band without drills yet has none. */
export const SEASON_PLANS: Partial<Record<AgeBand, SeasonPlan>> = Object.fromEntries(
  PACKS.map((pack) => [pack.band, { title: `${bandName(pack.band)} Season Plan`, weeks: seasonWeeks(pack) }])
);

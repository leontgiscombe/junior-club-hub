// The drill pack: drills and a season plan that come built into the drill
// library — 126 drills for U9–U11, 21 on each of six topics (7 warm-ups, 7
// technical practices and 7 games), written for the hub, and a 42-week season
// plan built from them. Each drill's diagram is drawn from its description in
// drills/ (see diagram.ts) rather than kept as an image. The app reads the pack
// only through lib/builtInDrills.ts; see README.md here.
import type { Drill, DrillKind, DrillTopic } from "@/lib/trainingPlanTypes";
import { diagramSvg } from "./diagram";
import type { PackDrill } from "./types";
import { PASSING } from "./drills/passing";
import { CONTROL } from "./drills/control";
import { DRIBBLING } from "./drills/dribbling";
import { MOVEMENT } from "./drills/movement";
import { FINISHING } from "./drills/finishing";
import { DEFENDING } from "./drills/defending";

// In season-plan order. Within a topic, each kind's drills run easiest first.
const TOPICS: { topic: DrillTopic; drills: PackDrill[] }[] = [
  { topic: "passing", drills: PASSING },
  { topic: "control", drills: CONTROL },
  { topic: "dribbling", drills: DRIBBLING },
  { topic: "movement", drills: MOVEMENT },
  { topic: "finishing", drills: FINISHING },
  { topic: "defending", drills: DEFENDING },
];

const diagramName = (id: string) => `${id}.svg`;

export const DRILLS: Drill[] = TOPICS.flatMap(({ topic, drills }) =>
  drills.map((d) => ({
    id: d.id,
    title: d.title,
    kind: d.kind,
    topic,
    ageGroup: "U9–U11",
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
);

const DIAGRAMS = new Map(
  TOPICS.flatMap(({ drills }) => drills.map((d) => [diagramName(d.id), d] as const))
);

/** A file the pack draws rather than keeps in files/ — a drill's diagram, as SVG. */
export function drawnFile(name: string): string | undefined {
  const drill = DIAGRAMS.get(name);
  return drill ? diagramSvg(drill.title, drill.diagram) : undefined;
}

// The season: two rounds of the six topics, in blocks of four weeks and then
// three, each week a warm-up, a technical practice and a game. The first round
// takes each topic's first four drills of each kind, the second its harder
// last three, so every drill is used once.
const ROUNDS = [4, 3];

function seasonWeeks(): { topic: DrillTopic; drillIds: string[] }[] {
  const weeks: { topic: DrillTopic; drillIds: string[] }[] = [];
  const used = new Map<DrillTopic, number>();
  for (const length of ROUNDS) {
    for (const { topic, drills } of TOPICS) {
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

export const SEASON_PLAN: {
  title: string;
  weeks: { topic: DrillTopic; drillIds: string[] }[];
} = { title: "U9–U11 Season Plan", weeks: seasonWeeks() };

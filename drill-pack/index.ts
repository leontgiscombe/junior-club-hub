// The drill pack: drills and a season plan that come built into the drill
// library. This copy of the hub ships with an empty pack — coaches build the
// library themselves. See README.md here for dropping in a pack of your own.
import type { Drill, DrillTopic } from "@/lib/trainingPlanTypes";

export const DRILLS: Drill[] = [];

export const SEASON_PLAN: {
  title: string;
  weeks: { topic: DrillTopic; drillIds: string[] }[];
} = { title: "", weeks: [] };

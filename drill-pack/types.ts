// A drill as the pack writes it: the drill library's fields, less the ones
// the pack fills in for every drill (see index.ts), plus its diagram.
import type { AgeBand, Drill, DrillTopic } from "@/lib/trainingPlanTypes";
import type { Diagram } from "./diagram";

export type PackDrill = Pick<
  Drill,
  | "id"
  | "title"
  | "kind"
  | "minutes"
  | "players"
  | "equipment"
  | "setup"
  | "howItWorks"
  | "coachingPoints"
  | "progressions"
> & { diagram: Diagram };

/**
 * One age band's drills: each topic's, in the order its season plan runs
 * them, and within a topic each kind's drills easiest first.
 */
export interface BandPack {
  band: AgeBand;
  topics: { topic: DrillTopic; drills: PackDrill[] }[];
}

// A drill as the pack writes it: the drill library's fields, less the ones
// the pack fills in for every drill (see index.ts), plus its diagram.
import type { Drill } from "@/lib/trainingPlanTypes";
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

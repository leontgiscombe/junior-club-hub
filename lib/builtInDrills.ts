// Drills that ship with the app, from the drill pack in drill-pack/ — the one
// place the app reads it, so the pack can be swapped or removed by changing
// this file alone (see drill-pack/README.md). They show in the drill library
// alongside the ones coaches add; editing one saves a copy over it in KV, but
// its files always come from the pack.
import type { Drill, DrillFile } from "./trainingPlanTypes";
import { DRILLS, SEASON_PLANS, drawnFile } from "@/drill-pack";

export const BUILT_IN_DRILLS: Drill[] = DRILLS;

/** The pack's season plan for each age band that has one: the title it gives a plan, and its weeks in order. */
export { SEASON_PLANS };

/** A built-in drill's diagram, drawn by the pack as SVG — undefined for files kept in drill-pack/files/. */
export function builtInDiagram(name: string): string | undefined {
  return builtInFile(name) ? drawnFile(name) : undefined;
}

/** A file a built-in drill uses — the only files /api/training/files will serve. */
export function builtInFile(name: string): DrillFile | undefined {
  for (const drill of BUILT_IN_DRILLS) {
    const file = drill.files.find((f) => f.name === name);
    if (file) return file;
  }
  return undefined;
}

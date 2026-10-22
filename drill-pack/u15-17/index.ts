// U15–17: 126 drills, 21 on each of six topics, in season-plan order.
import type { BandPack } from "../types";
import { PASSING } from "./passing";
import { CONTROL } from "./control";
import { DRIBBLING } from "./dribbling";
import { MOVEMENT } from "./movement";
import { FINISHING } from "./finishing";
import { DEFENDING } from "./defending";

export const U15_17: BandPack = {
  band: "u15-17",
  topics: [
    { topic: "passing", drills: PASSING },
    { topic: "control", drills: CONTROL },
    { topic: "dribbling", drills: DRIBBLING },
    { topic: "movement", drills: MOVEMENT },
    { topic: "finishing", drills: FINISHING },
    { topic: "defending", drills: DEFENDING },
  ],
};

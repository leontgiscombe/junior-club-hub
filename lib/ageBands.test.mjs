import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path, dependencies) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: (name) => { assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name]; } });
  return exports;
}

const settings = load("./clubSettings.ts", { "@/club.config": { CLUB: {}, TEAMS: [] } });
const types = load("./trainingPlanTypes.ts", { "./clubSettings": settings });

test("each age is in one band", () => {
  assert.deepEqual([6, 8, 9, 11, 12, 14, 15, 17, 18].map(types.bandForAge), ["u8", "u8", "u9-11", "u9-11", "u12-14", "u12-14", "u15-17", "u15-17", "u18"]);
});

test("a drill's age group from before bands finds its band", () => {
  assert.equal(types.bandOf("u12-14"), "u12-14");
  assert.equal(types.bandOf("U9–U11"), "u9-11");
  assert.equal(types.bandOf("Under 13s"), "u12-14");
  assert.equal(types.bandOf("anyone"), "");
  assert.equal(types.bandOf(""), "");
});

test("a team's band: its year, an age in its name, else its format", () => {
  assert.equal(types.teamBand({ name: "Greens", age: 13 }), "u12-14");
  assert.equal(types.teamBand({ name: "U16 Reds" }), "u15-17");
  assert.equal(types.teamBand({ name: "Greens", format: "5v5" }), "u8");
  assert.equal(types.teamBand({ name: "Greens" }), "u9-11");
});

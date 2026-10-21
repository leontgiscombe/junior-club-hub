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

test("a team keeps the 7v7 formation the club chose, and nothing else", () => {
  const teams = settings.cleanTeams([
    { slug: "lions", name: "U10 Lions", format: "7v7", formation: "3-2-1" },
    { slug: "tigers", name: "U9 Tigers", formation: "4-4-2" },
    { slug: "bears", name: "U10 Bears" },
  ]);
  assert.equal(teams[0].formation, "3-2-1");
  assert.equal("formation" in teams[1], false);
  assert.equal("formation" in teams[2], false);
});

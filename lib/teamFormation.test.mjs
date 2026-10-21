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

test("a team keeps a formation its format has, and nothing else", () => {
  const teams = settings.cleanTeams([
    { slug: "lions", name: "U10 Lions", format: "7v7", formation: "3-2-1" },
    { slug: "tigers", name: "U9 Tigers", formation: "4-4-2" },
    { slug: "hawks", name: "U12 Hawks", formation: "3-3-2" },
    { slug: "eagles", name: "Eagles", format: "11v11", formation: "4-4-2" },
    { slug: "bears", name: "U10 Bears" },
    { slug: "cubs", name: "U7 Cubs", formation: "2-1-1" },
  ]);
  assert.equal(teams[0].formation, "3-2-1");
  assert.equal("formation" in teams[1], false);
  assert.equal(teams[2].formation, "3-3-2");
  assert.equal(teams[3].formation, "4-4-2");
  assert.equal("formation" in teams[4], false);
  assert.equal(teams[5].formation, "2-1-1");
});

test("a team without a formation plays its format's usual one", () => {
  assert.equal(settings.teamFormation({ name: "U8 Blues" }), "1-2-1");
  assert.equal(settings.teamFormation({ name: "U10 Lions" }), "2-3-1");
  assert.equal(settings.teamFormation({ name: "U12 Hawks" }), "3-2-3");
  assert.equal(settings.teamFormation({ name: "U14 Eagles" }), "4-3-3");
  // one its format doesn't have (the age group was changed afterwards)
  assert.equal(settings.teamFormation({ name: "U14 Eagles", formation: "3-2-1" }), "4-3-3");
});

test("a team's year sets its format, over a format or a name", () => {
  const teams = settings.cleanTeams([
    { slug: "lions", name: "U10 Lions", age: 12, format: "7v7", formation: "3-3-2" },
    { slug: "cubs", name: "Cubs", age: 7 },
    { slug: "owls", name: "Owls", age: 30, format: "9v9" },
  ]);
  assert.equal(teams[0].age, 12);
  assert.equal(teams[0].format, "9v9");
  assert.equal(teams[0].formation, "3-3-2");
  assert.equal(teams[1].format, "5v5");
  // not a year a team can be: its format stays as it was
  assert.equal("age" in teams[2], false);
  assert.equal(teams[2].format, "9v9");
  assert.equal(settings.teamFormat({ name: "U14 Eagles", age: 9 }), "7v7");
  assert.equal(settings.teamAgeName({ name: "Eagles", age: 9 }), "Under 9s");
  assert.equal(settings.teamAgeName({ name: "Eagles", format: "9v9" }), "Under 11s & 12s");
});

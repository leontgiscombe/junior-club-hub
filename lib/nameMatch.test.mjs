import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("./nameMatch.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const exports = {};
runInNewContext(outputText, { exports });
const { likelyPlayer } = exports;

const squad = [
  { id: "a", name: "Alfie Brook", team: "lions" },
  { id: "b", name: "Alexander Ellis", team: "lions" },
  { id: "c", name: "Mia Carter", team: "lions" },
  { id: "d", name: "Mia Dale", team: "lions" },
  { id: "e", name: "Zoë O'Neill", team: "lions" },
  { id: "f", name: "Alfie Brook", team: "tigers" },
];
const lions = { slug: "lions" };

test("small spelling differences and case still match", () => {
  assert.equal(likelyPlayer({ name: "alfie brooke", team: lions }, squad), "a");
  assert.equal(likelyPlayer({ name: "Alfy Brook", team: lions }, squad), "a");
  assert.equal(likelyPlayer({ name: "  MIA   CARTER ", team: lions }, squad), "c");
});

test("short forms, initials, accents and apostrophes", () => {
  assert.equal(likelyPlayer({ name: "Alex Ellis", team: lions }, squad), "b");
  assert.equal(likelyPlayer({ name: "Mia D", team: lions }, squad), "d");
  assert.equal(likelyPlayer({ name: "Zoe ONeill", team: lions }, squad), "e");
});

test("only the child's own team", () => {
  assert.equal(likelyPlayer({ name: "Alfie Brook", team: { slug: "tigers" } }, squad), "f");
});

test("no clear match picks no one", () => {
  // two Mias and no surname
  assert.equal(likelyPlayer({ name: "Mia", team: lions }, squad), "new");
  // same first name, different surname
  assert.equal(likelyPlayer({ name: "Mia Jones", team: lions }, squad), "new");
  assert.equal(likelyPlayer({ name: "Oscar Kemp", team: lions }, squad), "new");
  assert.equal(likelyPlayer({ name: "", team: lions }, squad), "new");
  // no team given: both Alfie Brooks are as close
  assert.equal(likelyPlayer({ name: "Alfie Brook" }, squad), "new");
});

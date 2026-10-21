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

// what the code made, as plain data (it was made in another context)
const plain = (x) => JSON.parse(JSON.stringify(x));

const settings = load("./clubSettings.ts", { "@/club.config": { CLUB: {}, TEAMS: [] } });

function signup() {
  const made = {};
  const route = load("../app/api/signup/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, body }) } },
    "@/lib/kv": { rawKv: async () => ({ incr: async () => 1, expire: async () => {} }) },
    "@/lib/clubSettings": settings,
    "@/lib/access": { showCode: (c) => c },
    "@/lib/members": { getAccess: async () => ({ code: "ABC123" }), setPasswordOff: async () => {}, setPrivate: async () => {} },
    "@/lib/settings": { saveClubChanges: async () => {}, saveTeams: async (teams) => { made.teams = teams; } },
    "@/lib/email": { sendEmail: async () => true, simpleEmail: () => ({ text: "", html: "" }) },
    "@/lib/legal": { operator: () => ({ email: "" }) },
    "@/lib/tenant": { PLATFORM_NAME: "Platform", getTenant: async () => null, platformUrl: (p) => p, tenantUrl: (t, p = "/") => `https://${t}.example${p}` },
    "@/lib/tenants": { addressProblem: async () => null, createTenant: async (record) => { made.record = record; return true; } },
    "@/lib/clientIp": { clientIp: () => "1.2.3.4" },
  });
  const post = (body) => route.POST({ json: async () => body, headers: new Map() });
  return { post, made };
}

const club = { name: "Riverside FC", address: "riverside", email: "a@example.com", website: "", agreed: true };

test("a club signs up with all its teams, and the organiser's own team", async () => {
  const { post, made } = signup();
  const res = await post({
    ...club,
    teams: [
      { name: "U10 Lions", format: "7v7", formation: "3-2-1", training: [{ day: 2, start: "18:00", end: "19:00" }], faSnippet: "460765991" },
      { name: "", format: "9v9" },
      { name: "U12 Hawks", format: "9v9", formation: "4-4-2", archived: true, opponents: ["Rivals"] },
    ],
    myTeam: 2,
  });
  assert.equal(res.status, 200);
  assert.deepEqual(plain(made.teams).map((t) => [t.slug, t.format, t.formation ?? null]), [["u10-lions", "7v7", "3-2-1"], ["u12-hawks", "9v9", null]]);
  assert.deepEqual(plain(made.teams[0].training), [{ day: 2, start: "18:00", end: "19:00" }]);
  assert.equal(made.teams[0].faSnippet, "460765991");
  // only what sign-up asks for: not archived, no opponents
  assert.equal("archived" in made.teams[1], false);
  assert.equal("opponents" in made.teams[1], false);
  // the third team sent is the organiser's (the empty one between doesn't shift it)
  assert.equal(made.record.ownerTeam, "u12-hawks");
});

test("a sign-up from before teams still makes its one team", async () => {
  const { post, made } = signup();
  assert.equal((await post({ ...club, team: "U8 Blues", format: "5v5" })).status, 200);
  assert.deepEqual(plain(made.teams).map((t) => [t.name, t.format]), [["U8 Blues", "5v5"]]);
  assert.equal("ownerTeam" in made.record, false);
});

test("a club needs at least one named team", async () => {
  const { post } = signup();
  const res = await post({ ...club, teams: [{ name: "  " }] });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /at least one team/);
});

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, { exports, crypto: { randomUUID }, require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}

const scoring = load("./seasonAwards.ts");
const nominees = [{ id: "a", name: "Alex" }, { id: "b", name: "Blake" }, { id: "c", name: "Casey" }];
const baseAward = { id: "award", team: "lions", season: "2026/27", title: "Team Player", description: "", open: true, nominees };

function fixture() {
  const state = { award: structuredClone(baseAward), choices: null, writes: 0, season: "2026/27", coach: false, parent: true, accepts: true, fail: false };
  const storage = {
    getSeasonAward: async (id) => id === state.award?.id ? state.award : null,
    listSeasonAwards: async () => { if (state.fail) throw new Error("database unavailable"); return state.award ? [state.award] : []; },
    ownAwardBallot: async () => state.choices ? { choices: state.choices, updatedAt: "now" } : null,
    awardBallots: async () => state.choices ? [{ choices: state.choices, updatedAt: "now" }] : [],
    submitAwardBallot: async (_id, userId, _season, choices) => { assert.equal(userId, "parent1"); if (!state.accepts) return false; state.choices = choices; state.writes += 1; return true; },
    saveSeasonAward: async (award) => { state.award = award; state.writes += 1; },
    removeSeasonAward: async () => { state.award = null; state.choices = null; state.writes += 1; },
  };
  const dependencies = {
    "next/server": { NextResponse: { json: (...args) => Response.json(...args) } },
    "@/lib/access": { SESSION_KEY: "~account", childrenOf: (person) => person.children },
    "@/lib/people": { currentPerson: async () => state.parent ? { user: { id: "parent1" }, person: { status: "approved", children: [{ team: { slug: "lions" } }] } } : null },
    "@/lib/tenant": { getTenant: async () => "club" },
    "@/lib/adminAuth": { isCoach: async () => state.coach },
    "@/lib/settings": { getTeams: async () => [{ slug: "lions", name: "Lions" }] },
    "@/lib/season": { getCurrentSeason: async () => state.season },
    "@/lib/statsStorage": { listPlayers: async () => nominees.map((player) => ({ ...player, team: "lions" })) },
    "@/lib/seasonAwards": scoring,
    "@/lib/seasonAwardsStorage": storage,
  };
  return { state, parent: load("../app/api/awards/route.ts", dependencies), admin: load("../app/api/awards/admin/route.ts", dependencies) };
}

function request(body) {
  return new Request("http://localhost/api/awards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

test("ranked points, percentages and ties", () => {
  const results = scoring.awardStandings([{ choices: ["a", "b", "c"] }, { choices: ["b", "a", "c"] }]);
  assert.equal(results[0].points, 5);
  assert.equal(results[0].first, 1);
  assert.equal(results[0].second, 1);
  assert.equal(results[0].rank, 1);
  assert.equal(results[1].rank, 1);
  assert.equal(results[2].rank, 3);
  assert.equal(results[2].third, 2);
  assert.equal(results.reduce((sum, result) => sum + result.percentage, 0), 100);
});

test("optional ranks use only points actually cast", () => {
  const results = scoring.awardStandings([{ choices: ["a"] }, { choices: ["b", "a"] }]);
  assert.equal(results.find((result) => result.playerId === "a").points, 5);
  assert.equal(results.find((result) => result.playerId === "a").percentage, 62.5);
  assert.equal(scoring.awardStandings([]).length, 0);
});

for (const choices of [[], ["a", "a"], ["a", "b", "c", "d"], ["foreign"], ["a", ""], [123], null, "a"]) {
  test(`reject invalid ballot ${JSON.stringify(choices)}`, async () => {
    const { state, parent } = fixture();
    assert.equal((await parent.POST(request({ id: "award", choices }))).status, 400);
    assert.equal(state.writes, 0);
  });
}

test("parent ballot replacement does not add a second ballot", async () => {
  const { state, parent } = fixture();
  assert.equal((await parent.POST(request({ id: "award", choices: ["a", "b", "c"] }))).status, 200);
  assert.equal((await parent.POST(request({ id: "award", choices: ["b", "a"] }))).status, 200);
  const data = await (await parent.GET()).json();
  assert.equal(data.awards.length, 1);
  assert.deepEqual(data.awards[0].ballot.choices, ["b", "a"]);
  assert.equal("standings" in data.awards[0], false);
  assert.equal("ballotCount" in data.awards[0], false);
  assert.equal(state.writes, 2);
});

test("parents cannot vote outside their children's teams", async () => {
  const { state, parent } = fixture();
  state.award.team = "tigers";
  assert.equal((await parent.POST(request({ id: "award", choices: ["a"] }))).status, 403);
  assert.equal((await (await parent.GET()).json()).awards.length, 0);
  assert.equal(state.writes, 0);
});

test("parents cannot vote when closed, in a past season or after a concurrent close", async () => {
  const { state, parent } = fixture();
  state.award.open = false;
  assert.equal((await parent.POST(request({ id: "award", choices: ["a"] }))).status, 409);
  state.award.open = true;
  state.season = "2027/28";
  assert.equal((await parent.POST(request({ id: "award", choices: ["a"] }))).status, 409);
  state.season = "2026/27";
  state.accepts = false;
  assert.equal((await parent.POST(request({ id: "award", choices: ["a"] }))).status, 409);
  assert.equal(state.writes, 0);
});

test("anonymous visitors cannot read or submit ballots", async () => {
  const { state, parent } = fixture();
  state.parent = false;
  assert.equal((await parent.GET()).status, 403);
  assert.equal((await parent.POST(request({ id: "award", choices: ["a"] }))).status, 403);
});

test("non-coaches cannot manage awards or see results", async () => {
  const { state, admin } = fixture();
  assert.equal((await admin.GET(request({}))).status, 401);
  assert.equal((await admin.POST(request({ action: "delete", id: "award" }))).status, 401);
  assert.equal(state.writes, 0);
});

test("coaches can create, edit, read results and remove awards", async () => {
  const { state, admin } = fixture();
  state.coach = true;
  assert.equal((await admin.POST(request({ action: "save", award: { title: "Most Improved", description: "Progress over the season", open: true, team: "lions" } }))).status, 200);
  assert.equal(state.award.nominees.length, 3);
  const id = state.award.id;
  assert.equal((await admin.POST(request({ action: "save", award: { id, title: "Updated", description: "", open: false, team: "other", season: "other", nominees: [] } }))).status, 200);
  assert.equal(state.award.team, "lions");
  assert.equal(state.award.season, "2026/27");
  assert.equal(state.award.nominees.length, 3);
  state.choices = ["a", "b"];
  const data = await (await admin.GET(request({}))).json();
  assert.equal(data.awards[0].ballotCount, 1);
  assert.equal(data.awards[0].standings[0].percentage, 60);
  assert.equal((await admin.POST(request({ action: "delete", id }))).status, 200);
  assert.equal(state.award, null);
  assert.equal(state.choices, null);
});

test("invalid awards and reopening past seasons are rejected", async () => {
  const { state, admin } = fixture();
  state.coach = true;
  assert.equal((await admin.POST(request({ action: "save", award: { title: " ", description: "", open: true, team: "lions" } }))).status, 400);
  assert.equal((await admin.POST(request({ action: "save", award: { title: "Award", description: "", open: true, team: "foreign" } }))).status, 400);
  state.season = "2027/28";
  assert.equal((await admin.POST(request({ action: "save", award: { ...state.award, open: true } }))).status, 400);
  assert.equal(state.writes, 0);
});

test("storage failures are not reported as empty successful results", async () => {
  const { state, parent, admin } = fixture();
  state.coach = true;
  state.fail = true;
  assert.equal((await parent.GET()).status, 503);
  assert.equal((await admin.GET(request({}))).status, 503);
});

test("atomic ballot storage uses tenant keys and one field per parent", async () => {
  const calls = [];
  const storage = load("./seasonAwardsStorage.ts", {
    "./tenant": { requireTenant: async () => "riverside" },
    "./kv": { getKv: async () => ({}), keyPrefix: (tenant) => `t:${tenant}:`, rawKv: async () => ({ eval: async (script, keys, args) => { calls.push({ script, keys, args }); return 1; } }) },
  });
  assert.equal(await storage.submitAwardBallot("award", "parent1", "2026/27", ["a"]), true);
  const call = calls[0];
  assert.equal(call.keys[0], "t:riverside:season_awards");
  assert.equal(call.keys[1], "t:riverside:season_awards_ballots:award");
  assert.equal(call.args[2], "parent1");
  assert.deepEqual(JSON.parse(call.args[3]).choices, ["a"]);
  assert.match(call.script, /if not award.open or award.season ~= ARGV\[2\] then return 0 end/);
  await storage.removeSeasonAward("award");
  assert.match(calls[1].script, /HDEL/);
  assert.match(calls[1].script, /DEL/);
  assert.equal(calls[1].keys[1], "t:riverside:season_awards_ballots:award");
});
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
const storageDependencies = {
  "./access": { childrenOf: (person) => person.children ?? [] },
  "./season": { getCurrentSeason: async () => "2026/27" },
  "./tenant": { requireTenant: async () => "riverside" },
};

function activationDatabase(hashes) {
  return {
    getKv: async () => ({ hgetall: async (key) => hashes.get(key) ?? null }),
    keyPrefix: () => "",
    rawKv: async () => ({ eval: async (_script, [key], [team, value]) => {
      const previous = hashes.get(key)?.[team];
      hashes.set(key, { ...hashes.get(key), [team]: value });
      return value === "true" && previous !== "true" ? 1 : 0;
    } }),
  };
}

function fixture() {
  const state = { award: structuredClone(baseAward), choices: null, writes: 0, season: "2026/27", coach: false, parent: true, activeTeams: ["lions"], accepts: true, fail: false, notifications: [] };
  const storage = {
    activeAwardTeams: async () => state.activeTeams,
    setAwardsActive: async (_season, team, active) => { const previous = state.activeTeams.includes(team); state.activeTeams = active ? [...new Set([...state.activeTeams, team])] : state.activeTeams.filter((slug) => slug !== team); state.writes += 1; return active && !previous; },
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
    "@/lib/tenant": { getTenant: async () => "club", requireTenant: async () => "club" },
    "@/lib/notify": { notifyAwardsActivated: async (tenant, details) => state.notifications.push({ tenant, ...details }) },
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
  assert.equal((await admin.POST(request({ action: "activate", team: "lions", active: true }))).status, 401);
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

test("inactive awards stay hidden even when voting is open", async () => {
  const { state, parent } = fixture();
  state.activeTeams = [];
  assert.equal(state.award.open, true);
  assert.equal((await parent.GET()).status, 404);
  assert.equal((await parent.POST(request({ id: "award", choices: ["a"] }))).status, 404);
  assert.equal(state.writes, 0);
});

test("coaches activate and hide a team's awards without deleting ballots", async () => {
  const { state, parent, admin } = fixture();
  state.coach = true;
  state.activeTeams = [];
  const hidden = await (await admin.GET(request({}))).json();
  assert.equal(hidden.awards.length, 1);
  assert.deepEqual(hidden.activeTeams, []);
  assert.equal((await admin.POST(request({ action: "activate", team: "lions", active: true }))).status, 200);
  assert.equal((await parent.GET()).status, 200);
  assert.equal((await parent.POST(request({ id: "award", choices: ["a"] }))).status, 200);
  assert.equal((await admin.POST(request({ action: "activate", team: "lions", active: false }))).status, 200);
  assert.equal((await parent.GET()).status, 404);
  assert.deepEqual(state.choices, ["a"]);
  assert.equal((await (await admin.GET(request({}))).json()).awards[0].ballotCount, 1);
});

test("activation rejects unknown teams and non-boolean values", async () => {
  const { state, admin } = fixture();
  state.coach = true;
  assert.equal((await admin.POST(request({ action: "activate", team: "foreign", active: true }))).status, 400);
  assert.equal((await admin.POST(request({ action: "activate", team: "lions", active: "true" }))).status, 400);
  assert.equal(state.writes, 0);
});

test("activation defaults off and is stored separately for each season", async () => {
  const hashes = new Map();
  const storage = load("./seasonAwardsStorage.ts", {
    ...storageDependencies,
    "./kv": activationDatabase(hashes),
  });
  assert.equal((await storage.activeAwardTeams("2026/27")).length, 0);
  assert.equal(await storage.setAwardsActive("2026/27", "lions", true), true);
  assert.equal(await storage.setAwardsActive("2026/27", "lions", true), false);
  assert.equal((await storage.activeAwardTeams("2026/27"))[0], "lions");
  assert.equal((await storage.activeAwardTeams("2027/28")).length, 0);
  assert.equal(await storage.setAwardsActive("2026/27", "lions", false), false);
  assert.equal((await storage.activeAwardTeams("2026/27")).length, 0);
});

test("parent visibility requires approval, an approved child team and current-season activation", async () => {
  const hashes = new Map();
  const storage = load("./seasonAwardsStorage.ts", {
    ...storageDependencies,
    "./kv": activationDatabase(hashes),
  });
  const person = { status: "approved", children: [{ team: { slug: "lions" } }] };
  assert.equal(await storage.parentAwardsVisible(person), false);
  await storage.setAwardsActive("2025/26", "lions", true);
  assert.equal(await storage.parentAwardsVisible(person), false);
  await storage.setAwardsActive("2026/27", "tigers", true);
  assert.equal(await storage.parentAwardsVisible(person), false);
  await storage.setAwardsActive("2026/27", "lions", true);
  assert.equal(await storage.parentAwardsVisible(person), true);
  assert.equal(await storage.parentAwardsVisible({ ...person, status: "pending" }), false);
  assert.equal(await storage.parentAwardsVisible({ ...person, children: [{ pending: true, team: { slug: "lions" } }] }), false);
  assert.equal(await storage.parentAwardsVisible(null), false);
  await storage.setAwardsActive("2026/27", "lions", false);
  assert.equal(await storage.parentAwardsVisible(person), false);
});

test("only an off-to-on activation notifies parents", async () => {
  const { state, admin } = fixture();
  state.coach = true;
  state.activeTeams = [];
  assert.equal((await admin.POST(request({ action: "activate", team: "lions", active: true }))).status, 200);
  assert.deepEqual(state.notifications, [{ tenant: "club", team: "lions", teamName: "Lions", season: "2026/27" }]);
  assert.equal((await admin.POST(request({ action: "activate", team: "lions", active: true }))).status, 200);
  assert.equal(state.notifications.length, 1);
  assert.equal((await admin.POST(request({ action: "activate", team: "lions", active: false }))).status, 200);
  assert.equal(state.notifications.length, 1);
  assert.equal((await admin.POST(request({ action: "activate", team: "lions", active: true }))).status, 200);
  assert.equal(state.notifications.length, 2);
});

test("activation sends web/native push only to eligible parents and never sends email", async () => {
  const sent = [];
  let emails = 0;
  const people = [
    { userId: "parent-web", status: "approved", children: [{ team: { slug: "lions" } }] },
    { userId: "parent-app", status: "approved", children: [{ team: { slug: "lions" } }] },
    { userId: "other-team", status: "approved", children: [{ team: { slug: "tigers" } }] },
    { userId: "pending-child", status: "approved", children: [{ pending: true, team: { slug: "lions" } }] },
    { userId: "pending-parent", status: "pending", children: [{ team: { slug: "lions" } }] },
  ];
  const alerts = people.map((person) => ({ userId: person.userId, endpoint: person.userId === "parent-app" ? "apns:token" : `https://push.example/${person.userId}`, ...(person.userId === "parent-app" ? { apns: "token" } : { keys: { p256dh: "key", auth: "auth" } }) }));
  const notify = load("./notify.ts", {
    crypto: {},
    "web-push": { default: { sendNotification: async (subscription, payload) => sent.push({ endpoint: subscription.endpoint, ...JSON.parse(payload) }) } },
    "./access": { childrenOf: (person) => person.children, joinAlertsKey: () => "alerts", kvCall: async () => alerts.flatMap((alert) => [alert.endpoint, JSON.stringify(alert)]) },
    "./email": { sendEmail: async () => { emails += 1; }, simpleEmail: () => { throw new Error("Activation must not build an email"); } },
    "./kv": {},
    "./people": { listPeople: async () => people },
    "./tenants": {},
    "./vapid": { setUpVapid: async () => true },
    "./apns": { sendApns: async (token, message) => { sent.push({ endpoint: `apns:${token}`, ...message }); return "sent"; } },
    "./tenant": { tenantUrl: (tenant, path = "") => `https://${tenant}.example${path}` },
  });
  await notify.notifyAwardsActivated("club", { team: "lions", teamName: "Lions", season: "2026/27" });
  assert.equal(emails, 0);
  assert.equal(sent.length, 2);
  assert.deepEqual(sent.map((message) => message.endpoint).sort(), ["apns:token", "https://push.example/parent-web"]);
  assert.equal(sent.find((message) => message.endpoint === "apns:token").url, "https://club.example/awards");
  assert.equal(sent.find((message) => message.endpoint !== "apns:token").url, "/awards");
  for (const message of sent) assert.doesNotMatch(message.body, /points|1st|2nd|3rd/i);
});

test("approved parents can subscribe without seeing coach requests or deleting another account's subscription", async () => {
  const state = { approved: true, registered: [], removed: [] };
  const alerts = load("../app/api/members/alerts/route.ts", {
    "next/server": { NextResponse: { json: (...args) => Response.json(...args) } },
    "@/lib/access": { SESSION_KEY: "~account", awaitingApproval: (people) => people.map((person) => person.name) },
    "@/lib/adminAuth": { isCoach: async () => false },
    "@/lib/members": { listMembers: () => { throw new Error("Parents must not read join requests"); } },
    "@/lib/people": { currentPerson: async () => ({ user: { id: "parent1" }, person: { status: state.approved ? "approved" : "pending" } }), listPeople: () => { throw new Error("Parents must not read people"); } },
    "@/lib/tenant": { requireTenant: async () => "club" },
    "@/lib/apns": { isApnsToken: (token) => token === "token" },
    "@/lib/notify": {
      pushConfigured: async () => true,
      hasJoinAlert: async (_tenant, endpoint, userId) => endpoint === "apns:token" && userId === "parent1",
      addNativeAlert: async (tenant, userId, token) => state.registered.push({ tenant, userId, token }),
      addJoinAlert: async () => {},
      removeJoinAlert: async (_tenant, endpoint) => state.removed.push(endpoint),
    },
  });
  const get = new Request("http://localhost/api/members/alerts?endpoint=apns:token");
  Object.defineProperty(get, "nextUrl", { value: new URL(get.url) });
  const data = await (await alerts.GET(get)).json();
  assert.equal(data.pending, 0);
  assert.equal(data.coach, false);
  assert.equal(data.alerts, true);
  assert.equal((await alerts.POST(request({ apnsToken: "token" }))).status, 200);
  assert.deepEqual(state.registered, [{ tenant: "club", userId: "parent1", token: "token" }]);
  assert.equal((await alerts.DELETE(request({ endpoint: "someone-else" }))).status, 403);
  assert.equal(state.removed.length, 0);
  assert.equal((await alerts.DELETE(request({ endpoint: "apns:token" }))).status, 200);
  assert.deepEqual(state.removed, ["apns:token"]);
  state.approved = false;
  assert.equal((await alerts.GET(get)).status, 401);
  assert.equal((await alerts.POST(request({ apnsToken: "token" }))).status, 401);
  assert.equal((await alerts.DELETE(request({ endpoint: "apns:token" }))).status, 401);
});

test("atomic ballot storage uses tenant keys and one field per parent", async () => {
  const calls = [];
  const storage = load("./seasonAwardsStorage.ts", {
    ...storageDependencies,
    "./tenant": { requireTenant: async () => "riverside" },
    "./kv": { getKv: async () => ({}), keyPrefix: (tenant) => `t:${tenant}:`, rawKv: async () => ({ eval: async (script, keys, args) => { calls.push({ script, keys, args }); return 1; } }) },
  });
  assert.equal(await storage.submitAwardBallot("award", "parent1", "2026/27", ["a"]), true);
  const call = calls[0];
  assert.equal(call.keys[0], "t:riverside:season_awards");
  assert.equal(call.keys[1], "t:riverside:season_awards_ballots:award");
  assert.equal(call.keys[2], "t:riverside:season_awards_active:2026%2F27");
  assert.equal(call.args[2], "parent1");
  assert.deepEqual(JSON.parse(call.args[3]).choices, ["a"]);
  assert.match(call.script, /if not award.open or award.season ~= ARGV\[2\] then return 0 end/);
  assert.match(call.script, /if redis.call\('HGET', KEYS\[3\], award.team\) ~= 'true' then return 0 end/);
  await storage.removeSeasonAward("award");
  assert.match(calls[1].script, /HDEL/);
  assert.match(calls[1].script, /DEL/);
  assert.equal(calls[1].keys[1], "t:riverside:season_awards_ballots:award");
});
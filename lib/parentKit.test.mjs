import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

function load(path, dependencies) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: (name) => { assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name]; } });
  return exports;
}

const childrenOf = (person) => person.children ?? [];
const requestsModule = load("./kitRequests.ts", { "./access": { childrenOf }, "./kv": {} });
const person = { userId: "parent", name: "Parent Sample", status: "approved", roles: ["parent"], children: [{ id: "child", name: "Alex Sample", playerId: "own", team: { slug: "lions" } }, { id: "pending", name: "Pending Child", pending: true, team: { slug: "lions" } }] };

function fixture({ roster, submissions, requests } = {}) {
  return load("./parentKit.ts", {
    "./access": { childrenOf },
    "./kitRequests": { kitFamily: requestsModule.kitFamily, listKitRequests: async () => requests ?? [] },
    "./settings": { getTeams: async () => [{ slug: "lions", name: "Lions" }] },
    "./statsStorage": { listPlayers: async () => roster ?? [{ id: "own", name: "Alex Sample", team: "lions" }] },
    "./storage": { getSubmissions: async () => submissions ?? [] },
  });
}

test("history keeps only the family's linked player, even when another child has the same name", async () => {
  const data = await fixture({ submissions: [{ id: "own-new", playerId: "own", childName: "Alex Sample", submittedAt: "2026-10-02" }, { id: "foreign", playerId: "other", childName: "Alex Sample", submittedAt: "2026-10-03" }, { id: "own-old", playerId: "own", childName: "Alex Sample", submittedAt: "2026-10-01" }] }).parentKitData(person);
  assert.equal(data.family.length, 1);
  assert.equal(data.family[0].submissions.length, 2);
  assert.equal(data.family[0].submissions[0].id, "own-new");
  assert.equal(data.family[0].submissions[1].id, "own-old");
});

test("legacy sizes match names only when the roster is unambiguous", async () => {
  const submissions = [{ id: "legacy", childName: " alex  sample ", submittedAt: "2026-10-01" }];
  assert.equal((await fixture({ submissions }).parentKitData(person)).family[0].submissions.length, 1);
  const roster = [{ id: "own", name: "Alex Sample", team: "lions" }, { id: "other", name: "Alex Sample", team: "lions" }];
  assert.equal((await fixture({ submissions, roster }).parentKitData(person)).family[0].submissions.length, 0);
});

test("parents see only their own requests and no requester account metadata", async () => {
  const data = await fixture({ requests: [{ id: "own-request", userId: "parent", requestedBy: "Parent Sample", childName: "Alex Sample", team: "lions" }, { id: "foreign-request", userId: "someone-else", childName: "Alex Sample", team: "lions" }] }).parentKitData(person);
  assert.equal(data.requests.length, 1);
  assert.equal(data.requests[0].id, "own-request");
  assert.equal("userId" in data.requests[0], false);
  assert.equal("requestedBy" in data.requests[0], false);
});

test("pending children and unapproved people cannot read personal sizing history", async () => {
  assert.equal(requestsModule.kitFamily(person).length, 1);
  await assert.rejects(() => fixture().parentKitData({ ...person, status: "pending" }), /Approved membership/);
  const data = await fixture().parentKitData({ ...person, children: person.children.slice(1) });
  assert.equal(data.family.length, 0);
});

test("a player account resolves only a unique same-team squad identity", async () => {
  const player = { userId: "player-account", name: "Alex Sample", status: "approved", roles: ["player"], team: { slug: "lions" } };
  const data = await fixture({ submissions: [{ id: "own", playerId: "own", childName: "Alex Sample", submittedAt: "2026-10-01" }] }).parentKitData(player);
  assert.equal(data.family[0].id, "me");
  assert.equal(data.family[0].playerId, "own");
  assert.equal(data.family[0].submissions.length, 1);
});

test("personal Kit API requires approval, respects feature flags and never caches private data", async () => {
  const state = { person, enabled: true, fails: false, reads: 0 };
  const api = load("../app/api/kit/route.ts", {
    "next/server": { NextResponse: { json: (...args) => Response.json(...args) } },
    "@/lib/tenant": { getTenant: async () => "club" },
    "@/lib/people": { currentPerson: async () => state.person ? { person: state.person } : null },
    "@/lib/settings": { getClub: async () => ({ features: { kitSizes: state.enabled } }) },
    "@/lib/parentKit": { parentKitData: async () => { state.reads += 1; if (state.fails) throw new Error("Database unavailable"); return { family: [], requests: [] }; } },
  });
  state.person = null;
  assert.equal((await api.GET()).status, 403);
  state.person = { ...person, status: "pending" };
  assert.equal((await api.GET()).status, 403);
  state.person = person;
  state.enabled = false;
  assert.equal((await api.GET()).status, 404);
  assert.equal(state.reads, 0);
  state.enabled = true;
  const response = await api.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  state.fails = true;
  assert.equal((await api.GET()).status, 503);
});

const require = createRequire(import.meta.url);
const kitForm = load("../app/components/KitForm.tsx", {
  react: require("react"),
  "react/jsx-runtime": require("react/jsx-runtime"),
  "@/lib/clubSettings": { KIT_EXTRAS: {}, NOT_NEEDED: "Not needed" },
  "@/lib/kitItems": { SIZES: ["4XS", "3XS", "XXS", "XS", "S"], SOCK_SIZES: ["XS", "S", "M"] },
});

test("legacy Kit form retains its child selector while the focused form fixes its identity", () => {
  const props = { team: "lions", squad: [{ id: "own", label: "Alex Sample" }] };
  const legacy = renderToStaticMarkup(createElement(kitForm.default, props));
  assert.match(legacy, /Choose your child/);
  assert.match(legacy, /My child isn/);
  const focused = renderToStaticMarkup(createElement(kitForm.default, { ...props, fixedChild: { id: "own", name: "Alex Sample" }, initial: { shirtSize: "XXS", shortsSize: "XS", socksSize: "S" } }));
  assert.doesNotMatch(focused, /Choose your child|My child isn/);
  assert.match(focused, /Alex Sample/);
  assert.match(focused, /XXS/);
});

test("approved accounts stay on the dashboard even with old manual-team links while guests keep the picker", async () => {
  const state = { me: { person } };
  const dashboard = () => null;
  const page = load("../app/kit/page.tsx", {
    "react/jsx-runtime": require("react/jsx-runtime"),
    "next/link": { default: () => null }, "next/image": { default: () => null },
    "@/lib/clubSettings": { kitAspect: () => 1.8 },
    "@/lib/settings": { requireFeature: async () => {}, getClub: async () => ({ fullName: "Sample Club", kitSeason: "2026/27", kitImage: { src: "/kit-generic.jpg" } }), getTeams: async () => [{ slug: "lions", name: "Lions" }] },
    "@/lib/people": { canCoach: () => false, currentPerson: async () => state.me },
    "@/lib/access": { childrenOf, teamsOf: () => ["lions"] },
    "@/lib/storage": { getSubmissions: async () => [] },
    "@/lib/tenant": { getTenant: async () => "club" },
    "@/lib/viewer": { getViewer: async () => ({ signedIn: true, initials: "PA", photo: null }) },
    "../components/KitHeader": { default: () => null, KitFooter: () => null },
    "../components/ParentKit": { default: dashboard },
  });
  assert.equal((await page.default({ searchParams: Promise.resolve({}) })).type, dashboard);
  assert.equal((await page.default({ searchParams: Promise.resolve({ all: "1" }) })).type, dashboard);
  state.me = null;
  assert.equal((await page.default({ searchParams: Promise.resolve({}) })).type, "div");
});

test("old approved request links redirect to the real dashboard form without changing guest access", async () => {
  const state = { me: { user: { id: "parent" }, person } };
  const page = load("../app/kit/request/page.tsx", {
    "react/jsx-runtime": require("react/jsx-runtime"),
    "next/link": { default: () => null },
    "next/navigation": { redirect: (url) => { throw new Error(`REDIRECT:${url}`); } },
    "../../components/KitHeader": { default: () => null, KitFooter: () => null },
    "../../components/KitRequestForm": { default: () => null },
    "@/lib/settings": { requireFeature: async () => {}, getClub: async () => ({ kitExtras: [] }), getTeams: async () => [{ slug: "lions", name: "Lions" }] },
    "@/lib/tenant": { getTenant: async () => "club" },
    "@/lib/people": { currentPerson: async () => state.me },
    "@/lib/kitItems": { itemsFor: () => ["shirt", "shorts", "socks"] },
    "@/lib/kitRequests": { kitFamily: requestsModule.kitFamily, listKitRequests: async () => [] },
  });
  await assert.rejects(() => page.default(), /REDIRECT:\/kit#new-request/);
  state.me = null;
  assert.equal((await page.default()).type, "div");
});
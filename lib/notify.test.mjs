import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path, dependencies) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, console: { log() {}, error() {} }, require: (name) => { assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name]; } });
  return exports;
}

const parent = { userId: "parent", name: "Parent Sample", email: "parent@example.com", status: "approved", roles: ["parent"] };
const treasurer = { userId: "treasurer", name: "Treasurer Sample", email: "t@example.com", status: "approved", roles: ["treasurer"] };
const admin = { userId: "admin", name: "Admin Sample", email: "a@example.com", status: "approved", roles: ["admin"] };

function fixture({ people = [parent, treasurer, admin], alerts = [], apns = true, seen = new Set() } = {}) {
  const sent = { emails: [], apns: [] };
  const notify = load("./notify.ts", {
    crypto: { createHash: () => ({ update: () => ({ digest: () => "hash" }) }) },
    "web-push": { default: { sendNotification: async () => {} } },
    "./access": {
      childrenOf: (p) => p.children ?? [],
      joinAlertsKey: () => "alerts",
      kvCall: async ([cmd]) => (cmd === "HGETALL" ? alerts.flatMap((a) => [a.endpoint, JSON.stringify(a)]) : null),
    },
    "./email": {
      sendEmail: async (msg) => { sent.emails.push(msg); return true; },
      simpleEmail: (o) => ({ text: [o.heading, ...o.paragraphs].join("\n"), html: "" }),
    },
    // the half-hour gap: a key set once, refused after
    "./kv": { rawKv: async () => ({ set: async (key) => (seen.has(key) ? null : (seen.add(key), "OK")) }) },
    "./people": { listPeople: async () => people },
    "./tenants": { getTenantRecord: async () => null },
    "./vapid": { setUpVapid: async () => false, vapidKeys: async () => null },
    "./apns": { apnsConfigured: () => apns, sendApns: async (token, message) => { sent.apns.push({ token, message }); return "sent"; } },
    "./tenant": { DEFAULT_TENANT: "default", PLATFORM_NAME: "Platform", tenantUrl: (t, path = "/") => `https://${t}.example${path}` },
  });
  return { notify, sent };
}

test("an approved person hears they're in, by email and on their app", async () => {
  const { notify, sent } = fixture({ alerts: [{ userId: "parent", endpoint: "apns:abc", apns: "abc" }] });
  await notify.notifyApproved("club", parent, "Sample FC");
  assert.equal(sent.emails.length, 1);
  assert.equal(sent.emails[0].to, "parent@example.com");
  assert.match(sent.emails[0].subject, /You're in: Sample FC/);
  assert.equal(sent.apns.length, 1);
  assert.equal(sent.apns[0].message.url, "https://club.example/");
});

test("a parent hears their child is in the squad, without the child's name", async () => {
  const { notify, sent } = fixture();
  await notify.notifyChildApproved("club", { ...parent, children: [{ id: "c", name: "Alex Sample" }] }, "Lions", "Sample FC");
  assert.equal(sent.emails.length, 1);
  assert.match(sent.emails[0].subject, /the Lions squad/);
  assert.doesNotMatch(sent.emails[0].subject + sent.emails[0].text, /Alex/);
});

test("kit sorted goes to the family once in half an hour, and never to someone not approved", async () => {
  const { notify, sent } = fixture();
  await notify.notifyKitDone("club", "parent", "Sample FC");
  await notify.notifyKitDone("club", "parent", "Sample FC");
  assert.equal(sent.emails.length, 1);
  assert.equal(sent.emails[0].to, "parent@example.com");
  const left = fixture({ people: [{ ...parent, status: "declined" }] });
  await left.notify.notifyKitDone("club", "parent", "Sample FC");
  assert.equal(left.sent.emails.length, 0);
});

test("the subs reminder reaches treasurers' apps only", async () => {
  const alerts = [
    { userId: "treasurer", endpoint: "apns:t", apns: "t" },
    { userId: "admin", endpoint: "apns:a", apns: "a" },
    { userId: "treasurer", endpoint: "https://web.push/x", keys: { p256dh: "k", auth: "a" } },
  ];
  const { notify, sent } = fixture({ alerts });
  const n = await notify.notifyTreasurersInApp("club", { title: "Subs", body: "Check who's paid", url: "/finance" });
  assert.equal(n, 1);
  assert.deepEqual(sent.apns.map((a) => a.token), ["t"]);
  assert.equal(sent.apns[0].message.url, "https://club.example/finance");
  const off = fixture({ alerts, apns: false });
  assert.equal(await off.notify.notifyTreasurersInApp("club", { title: "Subs", body: "", url: "/finance" }), 0);
});

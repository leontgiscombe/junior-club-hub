import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, { exports, process, require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}

const billing = load("./billing.ts");
const rc = load("./revenuecat.ts", { "./billing": billing, "./tenants": {} });

test("product ids name their plan", () => {
  assert.equal(billing.planFromProduct("uk.co.grassrootsclubhub.club.monthly"), "club");
  assert.equal(billing.planFromProduct("starter_yearly"), "starter");
  assert.equal(billing.planFromProduct("large-monthly"), "large");
  assert.equal(billing.planFromProduct("uk.co.grassrootsclubhub.monthly"), null);
  assert.equal(billing.planFromProduct("clubhub.weekly"), null);
});

test("customer ids are the club's", () => {
  assert.equal(rc.customerId("riverside"), "club:riverside");
  assert.equal(rc.tenantOf("club:riverside"), "riverside");
  assert.equal(rc.tenantOf("$RCAnonymousID:abc"), null);
  assert.equal(rc.tenantOf("club:"), null);
  assert.equal(rc.tenantOf(undefined), null);
});

test("the plan subscription that runs latest wins", () => {
  const found = rc.planFromSubscriber({ subscriptions: {
    "x.starter.monthly": { expires_date: "2026-11-01T00:00:00Z", store: "stripe" },
    "x.club.yearly": { expires_date: "2027-10-01T00:00:00Z", store: "app_store", unsubscribe_detected_at: "2026-10-10T00:00:00Z" },
    "x.tip.jar": { expires_date: "2030-01-01T00:00:00Z", store: "app_store" },
  } });
  assert.deepEqual({ ...found }, { plan: "club", paidUntil: "2027-10-01T00:00:00.000Z", source: "apple", cancelled: true, billingIssue: false });
  assert.equal(rc.planFromSubscriber({}), null);
  assert.equal(rc.planFromSubscriber({ subscriptions: { "x.club.monthly": { expires_date: null } } }), null);
});

test("web purchases and promotions get their source", () => {
  assert.equal(rc.planFromSubscriber({ subscriptions: { "a.large.monthly": { expires_date: "2026-12-01T00:00:00Z", store: "rc_billing" } } }).source, "web");
  assert.equal(rc.planFromSubscriber({ subscriptions: { "a.large.monthly": { expires_date: "2026-12-01T00:00:00Z", store: "promotional" } } }).source, "manual");
});

const store = { plan: "club", paidUntil: "2026-12-01T00:00:00.000Z", source: "apple", cancelled: false, billingIssue: false };

test("a founding club is never touched", () => {
  assert.equal(rc.billingChange(undefined, store), null);
});

test("a longer plan set by hand is kept", () => {
  assert.equal(rc.billingChange({ plan: "large", paidUntil: "2027-06-01T00:00:00.000Z", source: "manual" }, store), null);
  assert.deepEqual({ ...rc.billingChange({ plan: "large", paidUntil: "2026-11-01T00:00:00.000Z", source: "manual" }, store) }, { ...store });
});

test("a trial club takes the store plan, and an unchanged one isn't rewritten", () => {
  assert.deepEqual({ ...rc.billingChange({ trialEndsAt: "2026-11-15T00:00:00.000Z" }, store) }, { ...store });
  assert.equal(rc.billingChange({ trialEndsAt: "2026-11-15T00:00:00.000Z", ...store }, store), null);
  assert.equal(rc.billingChange({ trialEndsAt: "2026-11-15T00:00:00.000Z" }, null), null);
});

test("the web purchase link carries the club", () => {
  process.env.REVENUECAT_WEB_PURCHASE_URL = "https://pay.rev.cat/abc123/";
  assert.equal(rc.webPurchaseUrl("riverside"), "https://pay.rev.cat/abc123/club%3Ariverside");
  delete process.env.REVENUECAT_WEB_PURCHASE_URL;
  assert.equal(rc.webPurchaseUrl("riverside"), null);
});

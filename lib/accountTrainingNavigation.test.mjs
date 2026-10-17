import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const navigationSource = readFileSync(new URL("../public/training-hub/home-navigation.js", import.meta.url), "utf8");

function training() {
  const names = ["learn", "practice", "progress"];
  const state = { refreshes: 0, focused: "" };
  const tabs = Object.fromEntries(names.map((name) => [name, { dataset: { hubView: name }, attributes: {}, events: {}, setAttribute(key, value) { this.attributes[key] = value; }, addEventListener(key, callback) { this.events[key] = callback; }, focus() { state.focused = name; } }]));
  const panels = Object.fromEntries(names.map((name) => [`hub-${name}`, { hidden: false }]));
  const selectors = new Map(names.map((name) => [`[data-hub-view="${name}"]`, tabs[name]]));
  const window = { scrollTo: () => {}, refreshHomeProgress: () => { state.refreshes += 1; } };
  runInNewContext(navigationSource, {
    window,
    document: { querySelector: (selector) => selectors.get(selector), querySelectorAll: () => Object.values(tabs), getElementById: (id) => panels[id] },
    localStorage: { setItem: () => { throw new Error("Navigation must not overwrite saved training progress"); }, removeItem: () => { throw new Error("Navigation must not erase saved training progress"); } },
  });
  return { state, tabs, panels, window };
}

test("Training opens on Learn and exposes one panel at a time", () => {
  const { tabs, panels, window } = training();
  assert.equal(tabs.learn.attributes["aria-selected"], "true");
  assert.equal(panels["hub-learn"].hidden, false);
  assert.equal(panels["hub-practice"].hidden, true);
  window.setHubHomeView("practice");
  assert.equal(tabs.practice.tabIndex, 0);
  assert.equal(tabs.learn.tabIndex, -1);
  assert.equal(panels["hub-learn"].hidden, true);
  assert.equal(panels["hub-practice"].hidden, false);
});

test("Progress refreshes existing counters without resetting storage", () => {
  const { state, window, panels } = training();
  window.setHubHomeView("progress");
  assert.equal(state.refreshes, 1);
  window.setHubHomeView("unknown");
  assert.equal(state.refreshes, 1);
  assert.equal(panels["hub-progress"].hidden, false);
});

test("Training tabs support arrow, Home and End keys", () => {
  const { tabs, state } = training();
  const event = (key) => ({ key, preventDefault: () => {} });
  tabs.learn.events.keydown(event("ArrowRight"));
  assert.equal(state.focused, "practice");
  tabs.practice.events.keydown(event("End"));
  assert.equal(state.focused, "progress");
  tabs.progress.events.keydown(event("Home"));
  assert.equal(state.focused, "learn");
  tabs.learn.events.keydown(event("ArrowLeft"));
  assert.equal(state.focused, "progress");
});

const exports = {};
runInNewContext(ts.transpileModule(readFileSync(new URL("../app/components/ChildrenEditor.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  exports,
  require: (name) => name === "react/jsx-runtime" ? require(name) : name === "@/lib/access" ? { MAX_CHILDREN: 8 } : { default: ({ label }) => createElement("input", { "aria-label": label }) },
});
const kids = [{ id: "approved", name: "Alex Sample", team: "lions", linked: true, teamLabel: "Lions (set by the club)" }, { id: "pending", name: "Sam Sample", team: "tigers", pending: true }];
const editorProps = { value: kids, teams: [{ slug: "lions", name: "Lions" }, { slug: "tigers", name: "Tigers" }], onChange: () => {}, clubDecidesTeams: true };

test("existing child editor consumers retain add and remove controls by default", () => {
  const html = renderToStaticMarkup(createElement(exports.default, editorProps));
  assert.match(html, /Add another child/);
  assert.match(html, /Remove child 1/);
  assert.match(html, /Remove child 2/);
  assert.equal((html.match(/<select/g) ?? []).length, 1);
  assert.match(html, /Lions \(set by the club\)/);
});

test("focused child editor hides list controls and preserves a club-assigned team", () => {
  const html = renderToStaticMarkup(createElement(exports.default, { ...editorProps, value: [kids[0]], showAdd: false, allowRemove: false }));
  assert.doesNotMatch(html, /Add another child|Add a child|Remove child/);
  assert.doesNotMatch(html, /<select/);
  assert.match(html, /Lions \(set by the club\)/);
});
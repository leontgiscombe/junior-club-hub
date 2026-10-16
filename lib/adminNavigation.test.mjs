import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const exports = {};
const source = readFileSync(new URL("../app/components/SettingsUI.tsx", import.meta.url), "utf8");
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  exports,
  require: (name) => name === "react" || name === "react/jsx-runtime" ? require(name) : {},
});
const tabs = [{ id: "upcoming", label: "Upcoming", count: 3 }, { id: "history", label: "History", count: 0 }];
const props = { label: "Training views", tabs, value: "upcoming", onChange: () => {}, panelId: "training-panel" };

test("tool tabs name their view, counts and controlled panel accessibly", () => {
  const html = renderToStaticMarkup(createElement(exports.ToolTabs, props));
  assert.match(html, /role="tablist" aria-label="Training views"/);
  assert.match(html, /aria-label="Upcoming \(3\)"/);
  assert.match(html, /aria-label="History"/);
  assert.match(html, /aria-controls="training-panel"/);
  assert.doesNotMatch(html, /History \(0\)/);
});

test("only the selected tab is in the keyboard tab order", () => {
  const html = renderToStaticMarkup(createElement(exports.ToolTabs, props));
  const buttons = html.match(/<button[^>]+>/g);
  assert.equal(buttons.length, 2);
  assert.match(buttons[0], /aria-selected="true"/);
  assert.match(buttons[0], /tabindex="0"/);
  assert.match(buttons[1], /aria-selected="false"/);
  assert.match(buttons[1], /tabindex="-1"/);
});

test("multiple tool tab groups have distinct button IDs", () => {
  const html = renderToStaticMarkup(createElement("div", null, createElement(exports.ToolTabs, props), createElement(exports.ToolTabs, props)));
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, 4);
  assert.equal(new Set(ids).size, 4);
});
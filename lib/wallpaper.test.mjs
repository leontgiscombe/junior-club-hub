import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../public/wallpaper.js", import.meta.url), "utf8");
const reactSource = readFileSync(new URL("../app/components/HomeWallpaper.tsx", import.meta.url), "utf8");
const reactModule = {};
runInNewContext(ts.transpileModule(reactSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports: reactModule, require: () => ({}) });

function fixture() {
  const nodes = [];
  const listeners = new Map();
  const state = { stored: null, denied: false };
  const document = {
    documentElement: { dataset: {} },
    getElementById: (id) => nodes.find((node) => node.id === id),
    createElement: () => {
      const node = { style: {}, children: [], setAttribute: () => {}, append: (...children) => node.children.push(...children) };
      nodes.push(node);
      return node;
    },
    body: { children: [], prepend: (node) => document.body.children.unshift(node) },
  };
  const context = {
    document,
    localStorage: { getItem: () => { if (state.denied) throw new Error("Storage unavailable"); return state.stored; } },
    window: { addEventListener: (event, listener) => {
      const callbacks = listeners.get(event) ?? [];
      callbacks.push(listener);
      listeners.set(event, callbacks);
    } },
  };
  const run = () => runInNewContext(source, context);
  const emit = (event) => listeners.get(event)?.forEach((listener) => listener());
  run();
  return { state, document, run, emit };
}

test("static apps and React use identical wallpaper backgrounds", () => {
  const { state, document, emit } = fixture();
  for (const kind of ["club", "brush", "pitch", "photo"]) {
    const wall = { kind, photo: "data:image/jpeg;base64,test" };
    state.stored = JSON.stringify(wall);
    emit("hub-wallpaper");
    const expected = reactModule.wallpaperStyle(wall);
    assert.equal(document.getElementById("app-wallpaper-image").style.background, expected.background);
    assert.equal(document.getElementById("app-wallpaper-image").style.filter, expected.filter ?? "");
    assert.equal(document.getElementById("app-wallpaper").hidden, false);
    assert.equal(document.documentElement.dataset.wallpaper, kind);
  }
});

test("none, missing photos, malformed preferences and denied storage disable wallpaper", () => {
  const { state, document, emit } = fixture();
  for (const raw of [null, "{bad", "null", '{"kind":"none"}', '{"kind":"unknown"}', '{"kind":"photo"}', '{"kind":"photo","photo":123}']) {
    state.stored = '{"kind":"pitch"}';
    emit("hub-wallpaper");
    state.stored = raw;
    emit("storage");
    assert.equal(document.getElementById("app-wallpaper").hidden, true);
    assert.equal(document.documentElement.dataset.wallpaper, undefined);
  }
  state.denied = true;
  emit("pageshow");
  assert.equal(document.getElementById("app-wallpaper").hidden, true);
});

test("restoring a page refreshes wallpaper without adding duplicate layers", () => {
  const { state, document, emit, run } = fixture();
  state.stored = '{"kind":"pitch"}';
  emit("pageshow");
  assert.equal(document.documentElement.dataset.wallpaper, "pitch");
  run();
  assert.equal(document.body.children.length, 1);
});
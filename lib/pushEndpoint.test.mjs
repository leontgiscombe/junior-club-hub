import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("./pushEndpoint.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const exports = {};
runInNewContext(outputText, { exports, URL });
const { isPushEndpoint } = exports;

test("the browsers' push services are allowed", () => {
  for (const e of ["https://fcm.googleapis.com/fcm/send/abc", "https://web.push.apple.com/QAB", "https://wns2-db5p.notify.windows.com/w/?token=x", "https://updates.push.services.mozilla.com/wpush/v2/x"]) {
    assert.equal(isPushEndpoint(e), true, e);
  }
});

test("anything else isn't", () => {
  for (const e of ["http://fcm.googleapis.com/x", "https://10.0.0.5/admin", "http://localhost:3000/", "https://evil.com/push.apple.com", "https://push.apple.com.evil.com/", "https://fcm.googleapis.com:8443/x", "", 42, "notaurl"]) {
    assert.equal(isPushEndpoint(e), false, String(e));
  }
});

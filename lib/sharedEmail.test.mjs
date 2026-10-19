import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("./sharedEmail.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const exports = {};
runInNewContext(outputText, { exports });
const { looksShared } = exports;

test("club and office addresses look shared", () => {
  for (const e of ["pudseyjuniorsjfc@gmail.com", "secretary@riverside.org", "info@club.co.uk", "riverside.fc@gmail.com", "u10s.team@hotmail.com", "welfare@lions.org", "hello@mysite.com"]) {
    assert.equal(looksShared(e), true, e);
  }
});

test("a word of the club's name before the @ looks shared", () => {
  assert.equal(looksShared("calverleycolts@gmail.com", "Calverley Colts"), true);
  assert.equal(looksShared("dave.smith@gmail.com", "Calverley Colts"), false);
  // common words in a club's name don't count on their own
  assert.equal(looksShared("thesmithfamily@gmail.com", "Smithfield Juniors Football Club"), false);
  assert.equal(looksShared("pudseyjfc.secretary@gmail.com", "Pudsey Juniors"), true);
});

test("people's own addresses don't", () => {
  for (const e of ["leontgiscombe@hotmail.com", "sam.jones@gmail.com", "jo1985@outlook.com", "dteam@x.com", "", "notanemail"]) {
    assert.equal(looksShared(e, "Riverside Rovers"), false, e);
  }
});

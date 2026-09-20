import assert from "node:assert/strict";
import { test } from "node:test";

import { CsvError, parseCsvLine } from "../src/csv.mjs";

test("plain fields", () => {
  assert.deepEqual(parseCsvLine("a,b,c"), ["a", "b", "c"]);
  assert.deepEqual(parseCsvLine("a,"), ["a", ""]);
  assert.deepEqual(parseCsvLine(""), [""]);
});

test("quoted fields keep commas", () => {
  assert.deepEqual(parseCsvLine('"x, y",z'), ["x, y", "z"]);
});

test("non-string input", () => {
  assert.throws(() => parseCsvLine(null), TypeError);
});

test("CsvError is an Error", () => {
  assert.ok(new CsvError("x") instanceof Error);
});

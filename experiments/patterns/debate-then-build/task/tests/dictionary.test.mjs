import assert from "node:assert/strict";
import { test } from "node:test";

import { lookup } from "../src/dictionary.mjs";

test("lookup finds words in any case and rejects unknown ones", () => {
  assert.equal(lookup("bala"), true);
  assert.equal(lookup("BALA"), true);
  assert.equal(lookup("xyzzy"), false);
  assert.equal(lookup(""), false);
});

test("lookup refuses a non-string", () => {
  assert.throws(() => lookup(7), TypeError);
});

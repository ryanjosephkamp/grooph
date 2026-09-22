import assert from "node:assert/strict";
import { test } from "node:test";

import { limit } from "../src/limit.mjs";

test("the first n items", () => {
  assert.deepEqual(limit([1, 2, 3, 4], 2), [1, 2]);
  assert.deepEqual(limit([1, 2], 5), [1, 2]);
  assert.deepEqual(limit([], 3), []);
});

test("n must be an integer", () => {
  assert.throws(() => limit([1, 2, 3], 1.5), TypeError);
});

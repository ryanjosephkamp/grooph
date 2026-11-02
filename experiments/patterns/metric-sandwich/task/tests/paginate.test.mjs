import assert from "node:assert/strict";
import { test } from "node:test";

import { paginate } from "../src/paginate.mjs";

const letters = ["a", "b", "c", "d", "e"];

test("page 0 is the first page", () => {
  assert.deepEqual(paginate(letters, 2, 0), ["a", "b"]);
});

test("the last page may be short", () => {
  assert.deepEqual(paginate(letters, 2, 2), ["e"]);
});

test("a page past the end is empty", () => {
  assert.deepEqual(paginate(letters, 2, 3), []);
});

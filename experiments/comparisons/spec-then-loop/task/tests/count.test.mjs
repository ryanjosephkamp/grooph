import assert from "node:assert/strict";
import { test } from "node:test";

import { countWords } from "../src/count.mjs";

test("countWords counts runs of non-whitespace", () => {
  assert.equal(countWords("one two  three"), 3);
  assert.equal(countWords("  "), 0);
});

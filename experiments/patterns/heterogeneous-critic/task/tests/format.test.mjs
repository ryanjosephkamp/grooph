import assert from "node:assert/strict";
import { test } from "node:test";

import { formatSeconds } from "../src/format.mjs";

test("formatSeconds writes the shortest run of parts", () => {
  assert.equal(formatSeconds(5400), "1h30m");
  assert.equal(formatSeconds(45), "45s");
  assert.equal(formatSeconds(0.5), "500ms");
  assert.equal(formatSeconds(61), "1m1s");
  assert.equal(formatSeconds(0), "0s");
});

test("formatSeconds refuses bad input", () => {
  assert.throws(() => formatSeconds(-1), RangeError);
  assert.throws(() => formatSeconds(Infinity), RangeError);
  assert.throws(() => formatSeconds("45"), TypeError);
});

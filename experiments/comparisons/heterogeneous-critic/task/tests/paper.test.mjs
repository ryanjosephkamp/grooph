import assert from "node:assert/strict";
import { test } from "node:test";

import { paperSize } from "../src/paper.mjs";

test("paperSize gives millimeters, portrait", () => {
  assert.deepEqual(paperSize("A4"), { width: 210, height: 297 });
  assert.deepEqual(paperSize("letter"), { width: 215.9, height: 279.4 });
  assert.deepEqual(paperSize("a5"), { width: 148, height: 210 });
});

test("paperSize refuses what it does not know", () => {
  assert.throws(() => paperSize("B5"), RangeError);
  assert.throws(() => paperSize(4), TypeError);
});

test("paperSize hands out a fresh object each time", () => {
  const first = paperSize("A4");
  first.width = 0;
  assert.equal(paperSize("A4").width, 210);
});

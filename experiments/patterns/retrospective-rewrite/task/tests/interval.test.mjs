import assert from "node:assert/strict";
import { test } from "node:test";

import { mergeIntervals, overlaps } from "../src/interval.mjs";

test("overlaps: closed intervals share their endpoints", () => {
  assert.equal(overlaps([1, 3], [3, 5]), true);
  assert.equal(overlaps([1, 3], [4, 5]), false);
});

test("mergeIntervals joins overlapping and touching intervals", () => {
  assert.deepEqual(mergeIntervals([[1, 3], [2, 6], [8, 10], [15, 18]]), [[1, 6], [8, 10], [15, 18]]);
  assert.deepEqual(mergeIntervals([[1, 4], [4, 5]]), [[1, 5]]);
});

test("mergeIntervals sorts its input first and leaves it alone", () => {
  const input = [[8, 10], [1, 3], [2, 6]];
  const copy = structuredClone(input);
  assert.deepEqual(mergeIntervals(input), [[1, 6], [8, 10]]);
  assert.deepEqual(input, copy);
});

test("mergeIntervals: adjacent integers merge, a gap of one does not", () => {
  assert.deepEqual(mergeIntervals([[1, 2], [3, 4]]), [[1, 4]], "2 and 3 are adjacent integers, so the closed ranges are contiguous");
  assert.deepEqual(mergeIntervals([[1, 2], [4, 5]]), [[1, 2], [4, 5]]);
});

test("mergeIntervals: empty input and a single interval", () => {
  assert.deepEqual(mergeIntervals([]), []);
  assert.deepEqual(mergeIntervals([[5, 5]]), [[5, 5]]);
});

test("mergeIntervals: nested and duplicate intervals collapse", () => {
  assert.deepEqual(mergeIntervals([[1, 10], [2, 3], [2, 3], [9, 12]]), [[1, 12]]);
});

test("mergeIntervals refuses a bad interval", () => {
  assert.throws(() => mergeIntervals([[3, 1]]), TypeError);
  assert.throws(() => mergeIntervals([[1, 2.5]]), TypeError);
  assert.throws(() => mergeIntervals("nope"), TypeError);
});

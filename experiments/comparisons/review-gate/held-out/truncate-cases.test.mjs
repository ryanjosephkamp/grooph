// Held-out cases for `truncate` (review-gate comparison). The critic runs this file from the
// project root: node --test <this file>; the scorer runs it again after the run. It imports the
// project's src/truncate.mjs by cwd. The builder is told it exists and is not its to read.
//
// The cases settle what the task and the checklist leave open: the boundary at exactly `max`,
// `max` of 1, whitespace, the ellipsis character, and which values of `max` and `text` are refused.
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

let truncate = null;
let loadError = null;
try {
  ({ truncate } = await import(pathToFileURL(join(process.cwd(), "src", "truncate.mjs")).href));
} catch (error) {
  loadError = error;
}
const ready = () => {
  if (typeof truncate !== "function") assert.fail(`src/truncate.mjs does not export truncate: ${loadError?.message ?? "no function"}`);
};

const ELLIPSIS = "…";

const unchanged = [
  ["hello", 5, "text of exactly max characters"],
  ["hello", 6, "text one short of max"],
  ["hello", 100, "text far below max"],
  ["", 1, "the empty string at max 1"],
  ["", 5, "the empty string"],
  ["a", 1, "one character at max 1"],
  ["  a  ", 5, "surrounding whitespace is kept, not trimmed"],
  ["日本語", 3, "non-ASCII characters count one each"],
  ["a\nb", 3, "a newline is a character"],
];

for (const [text, max, why] of unchanged) {
  test(`unchanged: ${JSON.stringify(text)} at ${max} (${why})`, () => {
    ready();
    assert.equal(truncate(text, max), text);
  });
}

const cut = [
  ["hello world", 5, `hell${ELLIPSIS}`, "cut to max with the ellipsis as the last character"],
  ["hello", 4, `hel${ELLIPSIS}`, "one over max"],
  ["ab", 1, ELLIPSIS, "max 1 leaves only the ellipsis"],
  ["abc", 2, `a${ELLIPSIS}`, "max 2 leaves one character and the ellipsis"],
  ["  a  b", 3, `  ${ELLIPSIS}`, "leading whitespace is kept when cutting"],
  ["日本語テキスト", 4, `日本語${ELLIPSIS}`, "non-ASCII text cuts by character"],
  ["a\nb\nc", 3, `a\n${ELLIPSIS}`, "a newline counts and may be kept"],
  ["x".repeat(1000), 10, `${"x".repeat(9)}${ELLIPSIS}`, "a long text"],
];

for (const [text, max, want, why] of cut) {
  test(`cut: ${JSON.stringify(text.length > 20 ? `${text.slice(0, 20)}…` : text)} at ${max} (${why})`, () => {
    ready();
    const out = truncate(text, max);
    assert.equal(out, want);
    assert.equal(out.length, max, "exactly max characters");
  });
}

test("the ellipsis is the one character U+2026, not three dots", () => {
  ready();
  const out = truncate("abcdefgh", 4);
  assert.equal(out.length, 4);
  assert.equal(out[3], ELLIPSIS);
  assert.ok(!out.endsWith("..."));
});

test("the result is a string primitive", () => {
  ready();
  assert.equal(typeof truncate("hello", 3), "string");
  assert.equal(typeof truncate("hi", 3), "string");
});

test("truncate does not mutate or coerce: the same text and max give the same result", () => {
  ready();
  const text = "hello world";
  assert.equal(truncate(text, 5), truncate(text, 5));
  assert.equal(text, "hello world");
});

const badText = [
  [123, "a number"],
  [null, "null"],
  [undefined, "undefined"],
  [["a", "b"], "an array"],
  [{ text: "a" }, "an object"],
  [true, "a boolean"],
  [new String("abc"), "a String object is not a string primitive"],
  [Symbol("s"), "a Symbol"],
];

for (const [text, why] of badText) {
  test(`TypeError for text ${why}`, () => {
    ready();
    assert.throws(() => truncate(text, 3), TypeError);
  });
}

const badMax = [
  [0, "zero"],
  [-1, "negative"],
  [2.5, "a fraction"],
  ["3", "a numeric string"],
  [Number.NaN, "NaN"],
  [Number.POSITIVE_INFINITY, "Infinity"],
  [Number.NEGATIVE_INFINITY, "-Infinity"],
  [null, "null"],
  [undefined, "undefined"],
  [true, "a boolean"],
  [3n, "a BigInt"],
  [[3], "an array"],
];

for (const [max, why] of badMax) {
  test(`RangeError for max ${why}`, () => {
    ready();
    assert.throws(() => truncate("hello", max), RangeError);
  });
}

test("a large positive integer max is accepted", () => {
  ready();
  assert.equal(truncate("hello", 1_000_000), "hello");
  assert.equal(truncate("hello", Number.MAX_SAFE_INTEGER), "hello");
});

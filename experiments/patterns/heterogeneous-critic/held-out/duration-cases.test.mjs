// Held-out cases for parseDuration (heterogeneous-critic proving run). The critic runs this file
// from the project root: node --test <this file>. It imports the project's src/duration.mjs by cwd.
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const { parseDuration } = await import(pathToFileURL(join(process.cwd(), "src", "duration.mjs")).href);

const ok = [
  ["1h30m", 5400],
  ["45s", 45],
  ["500ms", 0.5],
  ["0s", 0],
  ["0h", 0],
  ["1h", 3600],
  ["1m1s", 61],
  ["5ms", 0.005, "ms is one unit, not m followed by s"],
  ["5m5s", 305],
  ["1h1ms", 3600.001],
  ["1H30M", 5400, "letter case does not matter"],
  ["500MS", 0.5],
  ["1h 30m", 5400, "whitespace between parts is allowed"],
  ["  45s  ", 45, "surrounding whitespace is trimmed"],
  ["1.5h", 5400, "a fraction is allowed on any part"],
  ["0.5m", 30],
  ["0.25h", 900],
  ["1.5s", 1.5],
  ["250ms", 0.25],
  ["1000000h", 3.6e9],
  ["1h0m0s", 3600, "zero parts are allowed"],
];

const bad = [
  ["", RangeError, "empty"],
  ["   ", RangeError, "only whitespace"],
  ["1h30", RangeError, "a trailing number without a unit"],
  ["30m1h", RangeError, "units out of order"],
  ["1h1h", RangeError, "a unit twice"],
  ["1d", RangeError, "an unknown unit"],
  ["-1h", RangeError, "a sign"],
  ["+1h", RangeError, "a sign"],
  ["1 h", RangeError, "whitespace between a number and its unit"],
  ["1h,30m", RangeError, "a separator other than whitespace"],
  ["1e2s", RangeError, "an exponent"],
  [".5s", RangeError, "a fraction needs a digit before the point"],
  ["5.s", RangeError, "a fraction needs a digit after the point"],
  ["1_000s", RangeError, "a digit group separator"],
  ["h", RangeError, "a unit without a number"],
  ["Infinity", RangeError, "not a duration"],
  ["1h and 30m", RangeError, "words"],
  [90, TypeError, "a number is not a duration text"],
  [null, TypeError],
  [["1h"], TypeError],
];

for (const [input, expected, why] of ok) {
  test(`parseDuration(${JSON.stringify(input)}) is ${expected}${why ? ` (${why})` : ""}`, () => {
    assert.equal(parseDuration(input), expected);
  });
}

for (const [input, error, why] of bad) {
  test(`parseDuration(${JSON.stringify(input)}) throws ${error.name}${why ? ` (${why})` : ""}`, () => {
    assert.throws(() => parseDuration(input), error);
  });
}

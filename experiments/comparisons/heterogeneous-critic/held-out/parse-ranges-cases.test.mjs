// Held-out cases for parseRanges(text, pageCount). Run from the project root:
//   node --test <this file>
// The file imports the project's src/parse-ranges.mjs by the working directory.
//
// The first two groups hold what the task and the checklist state. The six groups
// after them settle what the task leaves open, each one way:
//   order      pages come back in the order typed, and a page typed twice comes back twice
//   backward   a range typed last-first runs backward
//   spaces     spaces and tabs around a number, a comma or the hyphen are ignored
//   open end   a range may leave out its first page (from page 1) or its last (to the last page)
//   empty      an empty box means every page
//   zeros      a number may carry leading zeros
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const { parseRanges } = await import(pathToFileURL(join(process.cwd(), "src", "parse-ranges.mjs")).href);

const TEN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// [group, text, pageCount, expected pages]
const ok = [
  ["stated", "1-3,5", 10, [1, 2, 3, 5]],
  ["stated", "7", 10, [7]],
  ["stated", "1", 10, [1]],
  ["stated", "10", 10, [10]],
  ["stated", "1-10", 10, TEN],
  ["stated", "3-3", 10, [3]],
  ["stated", "2,4,6", 10, [2, 4, 6]],
  ["stated", "1-2,4-5", 10, [1, 2, 4, 5]],
  ["stated", "1", 1, [1]],
  ["stated", "998-1000", 1000, [998, 999, 1000]],

  ["order", "5,1-3", 10, [5, 1, 2, 3]],
  ["order", "3,1", 10, [3, 1]],
  ["order", "2,2", 10, [2, 2]],
  ["order", "1-3,2", 10, [1, 2, 3, 2]],
  ["order", "1-2,1-2", 10, [1, 2, 1, 2]],

  ["backward", "5-3", 10, [5, 4, 3]],
  ["backward", "10-8", 10, [10, 9, 8]],
  ["backward", "2-1", 10, [2, 1]],
  ["backward", "3-1,5", 10, [3, 2, 1, 5]],

  ["spaces", " 1-3 , 5 ", 10, [1, 2, 3, 5]],
  ["spaces", "1 - 3", 10, [1, 2, 3]],
  ["spaces", "1- 3", 10, [1, 2, 3]],
  ["spaces", "2 ,4", 10, [2, 4]],
  ["spaces", "\t7\t", 10, [7]],

  ["open end", "8-", 10, [8, 9, 10]],
  ["open end", "-3", 10, [1, 2, 3]],
  ["open end", "10-", 10, [10]],
  ["open end", "-1", 10, [1]],
  ["open end", "9-,-2", 10, [9, 10, 1, 2]],

  ["empty", "", 10, TEN],
  ["empty", "   ", 10, TEN],
  ["empty", "", 1, [1]],

  ["zeros", "01", 10, [1]],
  ["zeros", "007", 10, [7]],
  ["zeros", "01-03", 10, [1, 2, 3]],
  ["zeros", "010", 10, [10]],
];

// [group, text, pageCount, error, why]
const bad = [
  ["stated", "11", 10, RangeError, "a page past the last one"],
  ["stated", "8-12", 10, RangeError, "a range that runs past the last page"],
  ["stated", "0", 10, RangeError, "pages start at 1"],
  ["stated", "0-2", 10, RangeError, "pages start at 1"],
  ["stated", "abc", 10, RangeError, "a word"],
  ["stated", "1-2-3", 10, RangeError, "neither a page nor a range"],
  ["stated", "1;2", 10, RangeError, "parts are separated by commas"],
  ["stated", "1.5", 10, RangeError, "not a page number"],
  ["stated", 12, 10, TypeError, "a number is not a text"],
  ["stated", null, 10, TypeError],
  ["stated", ["1"], 10, TypeError],
  ["stated", "1", 0, TypeError, "pageCount 0"],
  ["stated", "1", -1, TypeError, "pageCount -1"],
  ["stated", "1", 2.5, TypeError, "pageCount 2.5"],
  ["stated", "1", "10", TypeError, "pageCount as text"],
  ["stated", "1", NaN, TypeError, "pageCount NaN"],
  ["stated", "1", Infinity, TypeError, "pageCount Infinity"],
  ["stated", "1", undefined, TypeError, "pageCount left out"],

  ["careful", "1e1", 10, RangeError, "an exponent is not a page number"],
  ["careful", "0x3", 10, RangeError, "a hexadecimal number is not a page number"],
  ["careful", "+3", 10, RangeError, "a sign"],
  ["careful", "1,,2", 10, RangeError, "an empty part between commas"],
  ["careful", "1,2,", 10, RangeError, "a comma with nothing after it"],
  ["careful", ",1", 10, RangeError, "a comma with nothing before it"],
  ["careful", "1 2", 10, RangeError, "two numbers with no comma between them"],
  ["careful", "-", 10, RangeError, "a hyphen alone"],
  ["careful", "1--3", 10, RangeError, "two hyphens"],

  ["zeros", "00", 10, RangeError, "page 0 with a leading zero is still page 0"],
  ["open end", "12-", 10, RangeError, "an open range that starts past the last page"],
  ["open end", "-12", 10, RangeError, "an open range that ends past the last page"],
  ["backward", "12-8", 10, RangeError, "a backward range that starts past the last page"],
];

for (const [group, text, pageCount, expected] of ok) {
  test(`${group}: parseRanges(${JSON.stringify(text)}, ${pageCount}) is [${expected.length > 12 ? `${expected.slice(0, 3).join(", ")}, … ${expected[expected.length - 1]}` : expected.join(", ")}]`, () => {
    assert.deepEqual(parseRanges(text, pageCount), expected);
  });
}

for (const [group, text, pageCount, error, why] of bad) {
  test(`${group}: parseRanges(${JSON.stringify(text)}, ${String(pageCount)}) throws ${error.name}${why ? ` (${why})` : ""}`, () => {
    assert.throws(() => parseRanges(text, pageCount), error);
  });
}

test("stated: each call returns a new array", () => {
  const first = parseRanges("1-3", 10);
  first.push(99);
  assert.deepEqual(parseRanges("1-3", 10), [1, 2, 3]);
});

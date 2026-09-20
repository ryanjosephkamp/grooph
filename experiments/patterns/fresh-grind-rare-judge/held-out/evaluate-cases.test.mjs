// Held-out cases for evaluate (fresh-grind-rare-judge proving run, phase 2). The judge runs this
// file from the project root: node --test <this file>. It imports src/evaluate.mjs by cwd.
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const { evaluate } = await import(pathToFileURL(join(process.cwd(), "src", "evaluate.mjs")).href);

const ok = [
  ["1 + 2 * 3", 7],
  ["(1 + 2) * 3", 9],
  ["2 ^ 3 ^ 2", 512, "^ is right-associative"],
  ["-2 ^ 2", -4, "^ binds tighter than unary minus"],
  ["(-2) ^ 2", 4],
  ["2 ^ -1", 0.5, "unary minus inside an exponent"],
  ["-2 ^ -2", -0.25],
  ["2 * -3", -6, "unary minus after an operator"],
  ["3 - -2", 5],
  ["--1", 1, "unary minus twice"],
  ["-(-3)", 3],
  ["2 ^ 3 ^ 0", 2],
  ["2 ^ 0.5", Math.SQRT2],
  ["0 ^ 0", 1],
  ["100 / 10 / 2", 5, "/ is left-associative"],
  ["2 - 3 - 4", -5, "- is left-associative"],
  ["(2 + 3) ^ 2 * 2", 50],
  ["((1))", 1],
  ["  1+1  ", 2],
  ["1 +\n1", 2, "a newline is whitespace"],
  ["0.1 + 0.2", 0.1 + 0.2, "plain IEEE arithmetic, no rounding"],
  ["2 ^ 62", 4611686018427387904],
  ["10 / 4", 2.5],
];

const bad = [
  ["", SyntaxError, "empty"],
  ["   ", SyntaxError, "only whitespace"],
  ["1 +", SyntaxError],
  ["+ 1", SyntaxError, "no unary plus"],
  ["+1", SyntaxError, "no unary plus"],
  ["1 2", SyntaxError, "two numbers in a row"],
  ["2(3)", SyntaxError, "no implicit multiplication"],
  ["(3)2", SyntaxError],
  ["()", SyntaxError, "empty parentheses"],
  ["(1 + 2", SyntaxError, "unclosed parenthesis"],
  ["1 + 2)", SyntaxError, "stray closing parenthesis"],
  ["1 * / 2", SyntaxError],
  ["1e3", SyntaxError, "no exponent notation: e is not a character of the language"],
  ["7 % 2", SyntaxError, "no modulo"],
  ["2 ** 3", SyntaxError, "no ** operator"],
  ["1 / 0", RangeError],
  ["0 / 0", RangeError],
  ["1 / (2 - 2)", RangeError],
  [42, TypeError, "a number is not an expression text"],
  [null, TypeError],
];

for (const [input, expected, why] of ok) {
  test(`evaluate(${JSON.stringify(input)}) is ${expected}${why ? ` (${why})` : ""}`, () => {
    assert.equal(evaluate(input), expected);
  });
}

for (const [input, error, why] of bad) {
  test(`evaluate(${JSON.stringify(input)}) throws ${error.name}${why ? ` (${why})` : ""}`, () => {
    assert.throws(() => evaluate(input), error);
  });
}

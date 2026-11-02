import assert from "node:assert/strict";
import { test } from "node:test";

import { tokenize } from "../src/tokenize.mjs";

test("numbers, operators and parentheses with positions", () => {
  assert.deepEqual(tokenize("1 + 2"), [
    { type: "number", value: 1, at: 0 },
    { type: "op", value: "+", at: 2 },
    { type: "number", value: 2, at: 4 },
  ]);
  assert.deepEqual(tokenize("(2.5*3)^4-1/2"), [
    { type: "lparen", value: "(", at: 0 },
    { type: "number", value: 2.5, at: 1 },
    { type: "op", value: "*", at: 4 },
    { type: "number", value: 3, at: 5 },
    { type: "rparen", value: ")", at: 6 },
    { type: "op", value: "^", at: 7 },
    { type: "number", value: 4, at: 8 },
    { type: "op", value: "-", at: 9 },
    { type: "number", value: 1, at: 10 },
    { type: "op", value: "/", at: 11 },
    { type: "number", value: 2, at: 12 },
  ]);
});

test("whitespace of every kind is skipped and the empty text has no tokens", () => {
  assert.deepEqual(tokenize(" \t1\n+\t2 ").map((t) => t.value), [1, "+", 2]);
  assert.deepEqual(tokenize(""), []);
});

test("a bad number and an unknown character are SyntaxErrors that name the index", () => {
  assert.throws(() => tokenize("2."), { name: "SyntaxError", message: /\b1\b/ });
  assert.throws(() => tokenize(".5"), { name: "SyntaxError", message: /\b0\b/ });
  assert.throws(() => tokenize("1 + x"), { name: "SyntaxError", message: /\b4\b/ });
  assert.throws(() => tokenize("7 % 2"), { name: "SyntaxError", message: /\b2\b/ });
});

test("a non-string is a TypeError", () => {
  assert.throws(() => tokenize(12), TypeError);
});

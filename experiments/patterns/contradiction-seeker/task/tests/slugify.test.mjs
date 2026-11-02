import assert from "node:assert/strict";
import { test } from "node:test";

import { slugify } from "../src/slugify.mjs";

test("words are lowercased and joined by single hyphens", () => {
  assert.equal(slugify("Hello, World"), "hello-world");
  assert.equal(slugify("  many   spaces  "), "many-spaces");
});

test("accents are dropped", () => {
  assert.equal(slugify("Crème Brûlée, Twice!"), "creme-brulee-twice");
});

test("a long title is cut to maxLength", () => {
  assert.equal(slugify("abcdefghij", { maxLength: 4 }), "abcd");
  assert.ok(slugify("x".repeat(100)).length <= 48);
});

test("text that is not a string throws a TypeError", () => {
  assert.throws(() => slugify(42), TypeError);
});

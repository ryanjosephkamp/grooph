import assert from "node:assert/strict";
import { test } from "node:test";

import { search } from "../src/search.mjs";

const items = [
  { id: 1, title: "Zebra crossing" },
  { id: 2, title: "Apple pie" },
  { id: 3, title: "Apple" },
  { id: 4, title: "Pineapple" },
];

test("finds titles containing the query", () => {
  assert.deepEqual(search(items, "pie").map((i) => i.id), [2]);
  assert.deepEqual(search(items, "crossing").map((i) => i.id), [1]);
  assert.deepEqual(search(items, "nothing"), []);
});

test("an exact title match comes first, the rest keep their order", () => {
  assert.deepEqual(search(items, "Apple").map((i) => i.id), [3, 2]);
});

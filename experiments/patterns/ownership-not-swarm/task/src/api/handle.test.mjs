import assert from "node:assert/strict";
import { test } from "node:test";

import { createStore } from "../db/store.mjs";
import { createHandler } from "./handle.mjs";

test("POST /notes then GET /notes", () => {
  const handle = createHandler(createStore());
  assert.equal(handle({ method: "POST", path: "/notes", body: { text: "buy milk" } }).status, 201);
  assert.deepEqual(handle({ method: "GET", path: "/notes" }).body.map((n) => n.text), ["buy milk"]);
});

test("a bad body is 400 and an unknown route is 404", () => {
  const handle = createHandler(createStore());
  assert.equal(handle({ method: "POST", path: "/notes", body: {} }).status, 400);
  assert.equal(handle({ method: "GET", path: "/nope" }).status, 404);
});

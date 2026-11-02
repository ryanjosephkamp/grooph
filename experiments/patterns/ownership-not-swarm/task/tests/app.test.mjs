import assert from "node:assert/strict";
import { test } from "node:test";

import { createApp } from "../src/index.mjs";

function seeded() {
  const app = createApp();
  const a = app.handle({ method: "POST", path: "/notes", body: { text: "buy milk" } }).body;
  const b = app.handle({ method: "POST", path: "/notes", body: { text: "call Sam, then Ann" } }).body;
  app.handle({ method: "POST", path: `/notes/${a.id}/tags`, body: { tag: "errand" } });
  app.handle({ method: "POST", path: `/notes/${b.id}/tags`, body: { tag: "phone" } });
  app.handle({ method: "POST", path: `/notes/${b.id}/tags`, body: { tag: "errand" } });
  return { app, a, b };
}

test("tags round-trip through the API", () => {
  const { app, a, b } = seeded();
  const all = app.handle({ method: "GET", path: "/notes" });
  assert.equal(all.status, 200);
  assert.deepEqual(all.body.map((n) => [n.id, n.tags]), [[a.id, ["errand"]], [b.id, ["errand", "phone"]]]);
  const phone = app.handle({ method: "GET", path: "/notes?tag=phone" });
  assert.deepEqual(phone.body.map((n) => n.id), [b.id]);
  assert.equal(app.handle({ method: "POST", path: "/notes/99/tags", body: { tag: "x" } }).status, 404);
  assert.equal(app.handle({ method: "POST", path: `/notes/${a.id}/tags`, body: { tag: "Not Valid" } }).status, 400);
  assert.equal(app.handle({ method: "GET", path: "/notes?tag=none" }).body.length, 0);
});

test("renderTable pads columns and joins tags with commas", () => {
  const { app } = seeded();
  const text = app.renderTable(app.handle({ method: "GET", path: "/notes" }).body);
  const lines = text.trimEnd().split("\n");
  assert.equal(lines[0].replace(/\s+/g, " ").trim(), "id | text | tags");
  assert.equal(lines.length, 3, "a header and two rows");
  assert.ok(lines.every((line) => line.length === lines[0].length), "every line is as wide as the header");
  assert.ok(lines[2].includes("errand,phone"));
});

test("exportCsv quotes text with commas and joins tags with semicolons", () => {
  const { app } = seeded();
  const csv = app.exportCsv(app.handle({ method: "GET", path: "/notes" }).body);
  const lines = csv.trimEnd().split("\n");
  assert.equal(lines[0], "id,text,tags");
  assert.equal(lines[1], "1,buy milk,errand");
  assert.equal(lines[2], '2,"call Sam, then Ann",errand;phone');
});

test("each app has its own store", () => {
  const one = createApp();
  const two = createApp();
  one.handle({ method: "POST", path: "/notes", body: { text: "only here" } });
  assert.equal(two.handle({ method: "GET", path: "/notes" }).body.length, 0);
});

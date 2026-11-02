/**
 * grooph on a page (browser/index.ts), as built (dist/browser/): `render` draws exactly what core draws, for every
 * pattern, valid graph and map, in each view, layout and theme; it throws a coded error for what it cannot draw; and
 * the script with one global sets `grooph` and draws the same. What a page does with it (mount, drawAll, a resize)
 * is apps/web/e2e/browser-build.spec.ts.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import { STILL_VIEWS, mapPicture, mapSequence, mapStill, mapWide, parseGraphText, parseMapText, picture, still, themed, type Graph, type OperationMap } from "@grooph/core";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = (() => {
  let dir = here;
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("workspace root not found");
})();
const built = join(here, "..", "browser");
type Api = typeof import("../browser/grooph.js");
const browser = (await import(join(built, "grooph.js"))) as Api;

const graphs: [string, Graph][] = [
  ...readdirSync(join(repoRoot, "patterns")).filter((f) => f.endsWith(".grooph.json")).map((f) => join(repoRoot, "patterns", f)),
  ...readdirSync(join(repoRoot, "fixtures", "valid")).filter((f) => f.endsWith(".grooph.json")).map((f) => join(repoRoot, "fixtures", "valid", f)),
].map((path) => [path.slice(repoRoot.length + 1), parseGraphText(readFileSync(path, "utf8")).doc!]);
const maps: [string, OperationMap][] = readdirSync(join(repoRoot, "fixtures", "maps", "valid"))
  .filter((f) => f.endsWith(".grooph-map.json"))
  .map((f) => [f, parseMapText(readFileSync(join(repoRoot, "fixtures", "maps", "valid", f), "utf8")).map!]);
const review = graphs.find(([name]) => name === "patterns/review-gate.grooph.json")![1];

test("render draws every graph as core's picture, from the document or its JSON, with the size its viewBox has", () => {
  assert.ok(graphs.length >= 30);
  for (const [name, doc] of graphs) {
    const drawn = browser.render(doc);
    assert.equal(drawn.svg, picture(doc), name);
    assert.deepEqual(browser.render(JSON.stringify(doc)), drawn, `${name} as JSON text`);
    const [, w, h] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(drawn.svg)!;
    assert.deepEqual([drawn.width, drawn.height], [Number(w), Number(h)], name);
    // A graph's flat picture has one layout.
    assert.equal(browser.render(doc, { layout: "wide" }).svg, drawn.svg, name);
  }
});

test("render draws every map as core does: its picture, its lanes side by side, its sequence, and its stairs", () => {
  assert.ok(maps.length >= 5);
  for (const [name, map] of maps) {
    assert.equal(browser.render(map).svg, mapPicture(map), name);
    assert.equal(browser.render(map, { layout: "phone" }).svg, mapPicture(map), name);
    assert.equal(browser.render(map, { layout: "wide" }).svg, mapWide(map), name);
    assert.equal(browser.render(map, { view: "sequence" }).svg, mapSequence(map), name);
    assert.equal(browser.render(map, { view: "stairs" }).svg, mapStill(map, { layout: "wide" }), name);
    assert.equal(browser.render(map, { view: "stairs", layout: "phone" }).svg, mapStill(map, { layout: "phone" }), name);
  }
});

test("render draws each 3D still in both layouts, and each theme in each form, as core and grooph image do", () => {
  for (const view of STILL_VIEWS) {
    assert.equal(browser.render(review, { view }).svg, still(review, { view, layout: "wide" }), view);
    assert.equal(browser.render(review, { view, layout: "phone" }).svg, still(review, { view, layout: "phone" }), view);
  }
  assert.equal(browser.render(review, { theme: "light" }).svg, picture(review, { theme: "light" }));
  assert.equal(browser.render(review, { theme: "dark" }).svg, picture(review, { theme: "dark" }));
  assert.equal(browser.render(review, { theme: "paper" }).svg, picture(review));
  for (const name of ["blueprint", "ink", "phosphor", "transit", "chalk"]) {
    assert.equal(browser.render(review, { theme: name }).svg, themed(picture(review), name), name);
    assert.equal(browser.render(review, { theme: `${name}-dark` }).svg, themed(picture(review), name, "dark"), `${name}-dark`);
    assert.equal(browser.render(review, { theme: name, view: "panes" }).svg, themed(still(review, { view: "panes", layout: "wide" }), name), `${name} in 3D`);
  }
});

test("render throws a GroophError with a code for what it cannot draw, and its message is plain words", () => {
  const thrown = (doc: unknown, options?: Parameters<Api["render"]>[1]): { code: string; message: string } => {
    try {
      browser.render(doc, options);
    } catch (err) {
      assert.ok(err instanceof browser.GroophError, String(err));
      return { code: err.code, message: err.message };
    }
    throw new Error("render drew it");
  };
  assert.equal(thrown("{ not json").code, "bad-json");
  assert.match(thrown("{ not json").message, /^This is not JSON, so there is no grooph document in it: /);
  for (const doc of [{}, [], null, 3, "3", '"text"', { name: "x" }]) assert.equal(thrown(doc).code, "not-grooph", JSON.stringify(doc));
  assert.match(thrown({ ...review, nodes: [{ id: "x" }] }).message, /^This is not a graph grooph can draw: \/nodes\/0/);
  const big = { ...review, nodes: Array.from({ length: 501 }, (_, i) => ({ ...review.nodes[0]!, id: `n${i}` })) };
  assert.deepEqual(thrown(big), { code: "too-large", message: "This graph is too large to draw: 501 nodes, more than the 500 grooph draws in a graph." });
  assert.equal(thrown(review, { theme: "neon" }).code, "bad-option");
  assert.equal(thrown(review, { layout: "tall" as "wide" }).code, "bad-option");
  assert.equal(thrown(review, { view: "cube" as "panes" }).code, "bad-option");
  assert.equal(thrown(review, { view: "sequence" }).code, "bad-option");
  assert.equal(thrown(maps[0]![1], { view: "panes" }).code, "bad-option");
  // A document's words in an error stay words: the message is shown as text, and a page puts it in as text.
  const hostile = { ...review, nodes: [{ id: "<img src=x onerror=alert(1)>" }] };
  assert.equal(thrown(hostile).code, "not-grooph");
});

test("the script with one global sets grooph, and draws what the module draws", () => {
  const code = readFileSync(join(built, "grooph.global.js"), "utf8");
  const sandbox: { grooph?: Api } = {};
  runInNewContext(code, sandbox);
  assert.deepEqual(Object.keys(sandbox.grooph!).sort(), ["GroophError", "PHONE_BELOW", "WIDE_FROM", "drawAll", "mount", "render"]);
  assert.equal(sandbox.grooph!.render(review).svg, picture(review));
  assert.equal(sandbox.grooph!.PHONE_BELOW, 640);
  assert.equal(sandbox.grooph!.WIDE_FROM, 680);
});

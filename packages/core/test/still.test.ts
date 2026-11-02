/**
 * A still of a document in three dimensions (`picture/stage/still.ts`, `grooph image --view`): every view draws
 * every document there is to draw, the same bytes each time, from the same arithmetic the app turns; a theme puts
 * it in any look; and the doors the web app comes through lead nowhere new.
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { parseEvents } from "../src/events.js";
import { mapLive, mapStill, parseGraphText, still, STILL_VIEWS, summarizeSessions, themed, type Graph, type OperationMap, type RunNote } from "../src/index.js";
import { parseMapText } from "../src/map.js";
import { KINDS_3D } from "../src/picture/stage/graph-scene.js";
import { brakes, spiral, topOf } from "../src/picture/stage/spiral.js";
import { columnsAt, modelOf, stepsOf } from "../src/picture/stage/model.js";
import { shownAt } from "../src/picture/stage/shapes.js";
import { S3_CARD } from "../src/picture/stage/still.js";
import { fixturesDir, read, repoRoot } from "./helpers.js";

/** Every file under a folder, at any depth, that ends so: an invalid fixture is in a folder named for its rule. */
const under = (dir: string, end: string): string[] => readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(end)).map((f) => join(dir, f)).sort();
const graphs = (): [string, Graph][] =>
  [join(repoRoot, "patterns"), join(fixturesDir, "valid"), join(fixturesDir, "invalid")].flatMap((dir) =>
    under(dir, ".grooph.json").flatMap((file): [string, Graph][] => {
      const doc = parseGraphText(read(file)).doc;
      return doc ? [[file.slice(repoRoot.length + 1), doc]] : [];
    }),
  );
const maps = (): [string, OperationMap][] =>
  ["valid", "invalid"].flatMap((kind) =>
    under(join(fixturesDir, "maps", kind), ".grooph-map.json").flatMap((file): [string, OperationMap][] => {
      const map = parseMapText(read(file)).map;
      return map ? [[file.slice(repoRoot.length + 1), map]] : [];
    }),
  );
const pattern = (id: string): Graph => parseGraphText(read(join(repoRoot, "patterns", `${id}.grooph.json`))).doc!;
const viewBox = (svg: string): number[] => /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)!.slice(1).map(Number);

/**
 * That a still is whole: no number that is not one, and its drawing inside its frame, give or take a stroke's
 * width: every point of every line and shape, every number's place, every card's four corners (placed by a
 * translation and a scale on the stage, by a matrix on the stairs), and the corner of every label of the stairs.
 */
function inside(svg: string, what: string): void {
  assert.ok(!/NaN|Infinity|undefined/.test(svg), `${what}: a number that is not one`);
  const [W, H] = viewBox(svg);
  const top = Number(/<g transform="translate\(0,([\d.]+)\)">/.exec(svg)?.[1] ?? 0);
  const within = (x: number, y: number, said: string): void => assert.ok(x >= -3 && x <= W! + 3 && y + top >= -3 && y + top <= H! + 3, `${what}: ${said} at ${x},${y}, outside ${W} by ${H}`);
  for (const [, d] of svg.matchAll(/ d="M([^"]+)"/g)) for (const [, x, y] of d!.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)) within(Number(x), Number(y), "a point");
  for (const [, x, y] of svg.matchAll(/transform="translate\((-?[\d.]+),(-?[\d.]+)\)/g)) if (!(x === "0" && Number(y) === top)) within(Number(x), Number(y), "a card or a number");
  const corners = (w: number, h: number): [number, number][] => [[0, 0], [w, 0], [0, h], [w, h]];
  for (const [, x, y, s, w, h] of svg.matchAll(/translate\((-?[\d.]+),(-?[\d.]+)\) scale\(([\d.]+)\)"><rect data-card="" x="[\d.]+" y="[\d.]+" width="([\d.]+)" height="([\d.]+)"/g)) {
    for (const [u, v] of corners(Number(w), Number(h))) within(Number(x) + u * Number(s), Number(y) + v * Number(s), "a card's corner");
  }
  for (const [, m, rest] of svg.matchAll(/transform="matrix\(([^)]+)\)">(<g data-[a-z]+="[^"]*"[^>]*><rect data-card="" x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+")?/g)) {
    const [a, b, c, d, e, f] = m!.split(",").map(Number) as [number, number, number, number, number, number];
    const size = rest ? /width="([\d.]+)" height="([\d.]+)"/.exec(rest)!.slice(1).map(Number) : [0, 0];
    for (const [u, v] of corners(size[0]!, size[1]!)) within(a * u + c * v + e, b * u + d * v + f, rest ? "a card's corner" : "a label");
  }
}

/** A graph with a chain of agents put before its first node: deep where the views stand a first pass in a line. */
function chained(doc: Graph, n: number): Graph {
  const chain = Array.from({ length: n }, (_, k) => ({ id: `extra-${k}`, kind: "agent", name: `Extra ${k}`, role: "builder" }));
  const first = doc.nodes[0]!.id;
  const edges = chain.map((c, k) => ({ id: `ew${k}`, from: c.id, to: k + 1 < n ? `extra-${k + 1}` : first }));
  return { ...doc, nodes: [...chain, ...doc.nodes], edges: [...edges, ...doc.edges], layout: undefined } as unknown as Graph;
}

test("the views are the app's five, in its order, and a still names its document and what its view is", () => {
  assert.deepEqual(STILL_VIEWS, ["stairs", "panes", "spiral", "rings", "columns"]);
  assert.deepEqual(
    KINDS_3D.map(([id]) => id),
    STILL_VIEWS,
  );
  const doc = pattern("review-gate");
  for (const [view, name, says] of KINDS_3D) {
    const svg = still(doc, { view, theme: "light" });
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" class="grooph-picture" data-picture="[a-z]+"/);
    assert.ok(svg.includes(">Review gate</text>"), `${view}: the document's name`);
    // The sentence is wrapped to the width: its first words are on the first line.
    assert.ok(svg.includes(`${name}. ${says.split(" ").slice(0, 4).join(" ")}`), `${view}: what the view is`);
  }
});

test("every view draws every graph that parses, every node's card once, the same bytes each time, at the width asked for", () => {
  let drawn = 0;
  for (const [file, doc] of graphs()) {
    for (const view of STILL_VIEWS) {
      for (const layout of ["wide", "phone"] as const) {
        const svg = still(doc, { view, layout });
        assert.equal(svg, still(doc, { view, layout }), `${file} ${view} ${layout}: not the same twice`);
        assert.equal(viewBox(svg)[0], layout === "wide" ? 800 : 400, `${file} ${view} ${layout}`);
        assert.ok(!/NaN|Infinity|undefined/.test(svg), `${file} ${view} ${layout}: a number that is not one`);
        // Every node is a card, drawn once, inside the frame. (A node a graph in error names twice is drawn at least
        // once: as two cards where the view places each node, as one where the loops place them.)
        for (const id of new Set(doc.nodes.map((n) => n.id))) {
          const cards = svg.split(`data-node="${id.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`).length - 1;
          const named = doc.nodes.filter((n) => n.id === id).length;
          assert.ok(named === 1 ? cards === 1 : cards >= 1 && cards <= named, `${file} ${view} ${layout}: ${cards} cards of ${id}`);
        }
        inside(svg, `${file} ${view} ${layout}`);
        drawn += 1;
      }
    }
  }
  assert.ok(drawn > 700, `only ${drawn} stills drawn`);
  // A node named twice, which no fixture has.
  const doc = pattern("review-gate");
  const twice = { ...doc, nodes: [...doc.nodes, doc.nodes[0]!] } as Graph;
  for (const view of STILL_VIEWS) {
    const svg = still(twice, { view });
    inside(svg, `a node named twice, ${view}`);
    assert.ok([1, 2].includes(svg.split(`data-node="${doc.nodes[0]!.id}"`).length - 1), view);
  }
});

test("a graph with no nodes says so, in every view", () => {
  const empty: Graph = { grooph: 0, id: "empty", name: "Empty", version: 1, nodes: [], edges: [], loops: [] } as unknown as Graph;
  for (const view of STILL_VIEWS) assert.match(still(empty, { view, theme: "dark" }), view === "stairs" ? /no loop · no nodes/ : /This graph has no nodes to draw/);
  // And a loop with no members, which a document may have, does not break a view.
  const hollow = { ...pattern("review-gate"), loops: [...pattern("review-gate").loops, { id: "hollow", name: "Hollow", members: [], back: [], stops: [{ kind: "max-iterations", n: 2 }] }] } as Graph;
  for (const view of STILL_VIEWS) inside(still(hollow, { view }), `a hollow loop, ${view}`);
});

test("a deep scene stays whole and is seen as the app sees it: nothing comes near the eye, and the top of tall stairs is seen from above", () => {
  const doc = parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!;
  for (const n of [24, 30, 60]) for (const view of STILL_VIEWS) for (const layout of ["wide", "phone"] as const) inside(still(chained(doc, n), { view, layout }), `${n} more, ${view}, ${layout}`);
  // Maps of many lanes, a session each, the lanes by turns local and in the cloud (furthest apart): every sheet's
  // front edge is drawn under its back edge, as from above.
  const tall = (n: number): OperationMap => {
    const lanes = Array.from({ length: n }, (_, k) => ({ id: `lane-${k}`, name: `Lane ${k}`, machine: `machine ${k}`, account: "account", place: k % 2 ? "cloud" : "local" }));
    return { groophMap: 0, id: "tall", name: "Tall", version: 1, lanes, sessions: lanes.map((l, k) => ({ id: `s-${k}`, name: `Session ${k}`, lane: l.id, harness: "claude-code", role: "worker" })), handoffs: lanes.slice(1).map((_, k) => ({ id: `h-${k}`, from: `s-${k}`, to: `s-${k + 1}`, via: "session-message" })) } as unknown as OperationMap;
  };
  for (const [n, layout] of [[16, "wide"], [16, "phone"], [30, "wide"], [60, "wide"], [76, "phone"]] as const) {
    const svg = mapStill(tall(n), { layout, theme: "light" });
    inside(svg, `${n} lanes, ${layout}`);
    for (const [, d] of svg.matchAll(/<path data-sheet="" d="M([^"]+) Z"/g)) {
      const ys = [...d!.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[2]));
      // The outline's four corners, seven points each, from the back of the right end: at either end the front edge is
      // lower on the page than the back one.
      assert.equal(ys.length, 28);
      assert.ok(ys[13]! > ys[0]! && ys[14]! > ys[27]!, `${n} lanes, ${layout}: a sheet seen from below`);
    }
  }
});

test("a spiral says each loop's brakes under it, as the app does; the other views do not", () => {
  const doc = pattern("gauntlet-decomposed");
  const svg = still(doc, { view: "spiral", theme: "light" });
  const model = modelOf(doc, {}, undefined, false);
  for (const loop of model.loops) {
    assert.ok(svg.includes(`>${loop.name}:</tspan>`), loop.name);
    // The first of its brakes is on the line with its name.
    assert.ok(svg.includes(brakes(loop, topOf(model, loop)).words[0]!.split(" ").slice(0, 3).join(" ")), loop.name);
  }
  assert.ok(!still(doc, { view: "rings", theme: "light" }).includes("</tspan>"));
});

test("a spiral is never more than fifty rounds tall: a lid above them is said and not drawn, and a huge one draws at once", () => {
  const doc = pattern("review-gate");
  const loop = doc.loops[0]!;
  loop.stops = [{ kind: "max-iterations", n: 1_000_000_000 }];
  const started = performance.now();
  const svg = still(doc, { view: "spiral", theme: "light" });
  assert.ok(performance.now() - started < 1000, "drawn in under a second");
  const model = modelOf(doc, {}, undefined, false);
  assert.equal(topOf(model, model.loops[0]!), 50);
  assert.ok(svg.includes("not drawn, above the 50 rounds shown"));
  loop.stops = [{ kind: "max-iterations", n: 50 }];
  assert.ok(!still(doc, { view: "spiral", theme: "light" }).includes("not drawn"), "a lid of fifty is drawn");
});

test("a lid or a person's turn that a document the editor holds gets wrong, though it fails the schema, draws at once", () => {
  const doc = pattern("review-gate");
  doc.loops[0]!.stops = [{ kind: "max-iterations", n: -1_000_000 }, { kind: "human", every: 0.000001 }];
  const began = performance.now();
  for (const view of STILL_VIEWS) assert.match(still(doc, { view }), /^<svg /, view);
  assert.ok(performance.now() - began < 1000, `${Math.round(performance.now() - began)} ms`);
  doc.loops[0]!.stops = [{ kind: "max-iterations", n: Number.NaN }];
  assert.equal(topOf(modelOf(doc, {}, undefined, false), modelOf(doc, {}, undefined, false).loops[0]!), 50);
});

test("a run of many notes is read and drawn in time that grows with the notes, not their square", () => {
  const doc = pattern("review-gate");
  const member = doc.loops[0]!.members[0]!;
  const notes = Array.from({ length: 20_000 }, (_, i) => ({ id: `t${i}`, run: "r", at: `node:${member}`, outcome: "pass", round: i % 3 })) as unknown as RunNote[];
  const began = performance.now();
  const model = modelOf(doc, {}, notes, false);
  const steps = stepsOf(model);
  spiral(model, shownAt(model, steps, steps.length - 1));
  assert.ok(performance.now() - began < 3000, `${Math.round(performance.now() - began)} ms`);
});

test("light and dark write the colors in, as the picture's do; a theme is added as it is to the picture", () => {
  const doc = pattern("debate-then-build");
  for (const view of STILL_VIEWS) {
    const auto = still(doc, { view });
    assert.ok(auto.includes("var(--gp-") && auto.includes("<style>"));
    for (const theme of ["light", "dark"] as const) {
      const solid = still(doc, { view, theme });
      assert.ok(!solid.includes("var(--gp-") && !solid.includes("<style>"), `${view} ${theme}`);
    }
    assert.notEqual(still(doc, { view, theme: "light" }), still(doc, { view, theme: "dark" }));
    for (const name of ["blueprint", "chalk", "transit", "phosphor", "ink"]) {
      const looked = themed(auto, name, "light");
      assert.match(looked, new RegExp(`^<svg [^>]* data-look="${name}"`), `${view} ${name}`);
      assert.ok(!looked.includes("var(--gp-"), `${view} ${name}: a color left unwritten`);
    }
  }
});

test("a map's stairs draw every map, with the hooks' marks on the cards where they are given", () => {
  let drawn = 0;
  for (const [file, map] of maps()) {
    for (const layout of ["wide", "phone"] as const) {
      const svg = mapStill(map, { layout, theme: "light" });
      assert.equal(svg, mapStill(map, { layout, theme: "light" }), file);
      inside(svg, `${file} ${layout}`);
      // What the picture draws, the stairs draw: a session in a lane, a person, a handoff between two of them.
      const shown = new Set([...map.sessions.filter((s) => map.lanes.some((l) => l.id === s.lane)).map((s) => s.id), ...(map.people ?? []).map((p) => p.id)]);
      for (const s of map.sessions) if (shown.has(s.id)) assert.ok(svg.includes(`data-session="${s.id}"`), `${file}: ${s.id}`);
      for (const h of map.handoffs) if (shown.has(h.from) && shown.has(h.to)) assert.ok(svg.includes(`data-handoff="${h.id}"`), `${file}: ${h.id}`);
      drawn += 1;
    }
  }
  assert.ok(drawn > 20, `only ${drawn} maps drawn`);
  const map = parseMapText(read(join(fixturesDir, "maps", "valid", "a-product-team-first-draft.grooph-map.json"))).map!;
  const events = parseEvents(read(join(fixturesDir, "events", "claude-code-running.jsonl"))).events.map((e) => ({ ...e, source: "operator" }));
  const live = mapLive(summarizeSessions(events), map);
  const svg = mapStill(map, { live });
  assert.match(svg, /data-session="operator" data-live="working"/);
  assert.ok(!mapStill(map).includes("data-live"));
});

test("a card is the app's: the still's measures are the ones the app's style sheet gives a card in three dimensions", () => {
  const css = read(join(repoRoot, "apps", "web", "src", "ui", "canvas", "graph-stage.css"));
  const rule = (selector: string): string => {
    // The last rule of the selector alone: the one that sizes it, after any it shares with another.
    const at = css.lastIndexOf(`\n${selector} {`);
    assert.ok(at >= 0, `no rule for ${selector}`);
    return css.slice(at, css.indexOf("}", at));
  };
  const card = rule(".s3-card");
  assert.ok(card.includes(`width: ${S3_CARD.width}px;`));
  assert.ok(card.includes(`padding: ${S3_CARD.padding.join("px ")}px;`));
  assert.ok(card.includes(`border-left: ${S3_CARD.edge}px solid`));
  assert.ok(card.includes(`border-radius: ${S3_CARD.radius}px;`));
  assert.ok(card.includes("border: 1px solid"));
  const name = rule(".s3-card b");
  assert.ok(name.includes(`font-size: ${S3_CARD.name[0]}px;`) && name.includes(`line-height: ${S3_CARD.name[1]};`));
  const line = rule(".s3-card span");
  assert.ok(line.includes(`font-size: ${S3_CARD.line[0]}px;`) && line.includes(`line-height: ${S3_CARD.line[1]};`));
  const small = rule(".s3-card.is-small");
  assert.ok(small.includes(`min-width: ${S3_CARD.small.min}px;`) && small.includes(`max-width: ${S3_CARD.small.max}px;`) && small.includes(`padding-block: ${S3_CARD.small.padding}px;`));
  // And the canvas's rule for how many nodes a row holds, which the still lays a graph out by.
  assert.deepEqual([columnsAt(400), columnsAt(800)], [2, 4]);
});

test("the stills the exports page shows are the ones the command draws now", () => {
  const doc = parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!;
  const page = read(join(repoRoot, "docs", "exports.md"));
  for (const view of STILL_VIEWS) {
    const path = `docs/assets/stills/review-loop.${view}.svg`;
    assert.equal(read(join(repoRoot, path)), still(doc, { view }), `${path} is stale: grooph image fixtures/valid/review-loop.grooph.json --view ${view} --out ${path}`);
    assert.ok(page.includes(`<img src="${path.slice("docs/".length)}"`), `docs/exports.md does not show ${view}`);
  }
});

// ─── the doors ────────────────────────────────────────────────────────────

const src = join(repoRoot, "packages", "core", "src");
// Every import that is not of types alone: `import { a } from`, `export * from`, and a bare `import "./x.js"`.
const runtimeImports = (file: string): string[] =>
  [...read(file).matchAll(/^(?:import|export)\s+(?!type\b)(?:[^;"]*?from\s+)?"(\.[^"]+)\.js"/gms)].map((m) => join(file, "..", `${m[1]}.ts`));
const follow = (file: string, into: Set<string> = new Set()): Set<string> => {
  if (into.has(file)) return into;
  into.add(file);
  for (const next of runtimeImports(file)) follow(next, into);
  return into;
};
const stage = (name: string): string => join(src, "picture", "stage", name);

test("the web app's doors to the views lead nowhere new: base.ts reaches none of them, and they reach only what it does", () => {
  const base = follow(join(src, "base.ts"));
  assert.ok(base.size > 20 && base.has(join(src, "validate.ts")), "base.ts was not followed");
  for (const file of readdirSync(join(src, "picture", "stage"))) assert.ok(!base.has(stage(file)), `base.ts leads to picture/stage/${file}`);
  // The stage's door and the graph's scene bring nothing an address did not have, but their own files.
  for (const door of ["stage.ts", "graph-scene.ts"]) {
    for (const file of follow(stage(door))) assert.ok(base.has(file) || file.startsWith(join(src, "picture", "stage")), `${door} leads to ${file.slice(src.length + 1)}`);
  }
  // The stairs, and Rings and Columns, are handed what they draw with: they import only types.
  for (const file of ["stairs.ts", "rings.ts", "columns.ts", "prim.ts", "trim.ts"]) assert.deepEqual(runtimeImports(stage(file)), [], `${file} imports something that is not a type`);
  assert.deepEqual([...follow(stage("more.ts"))].map((f) => f.slice(src.length + 1)).sort(), ["picture/stage/columns.ts", "picture/stage/more.ts", "picture/stage/rings.ts"]);
  // The two pieces of the app that draw on the stage share nothing but what the first door had.
  for (const file of follow(stage("more.ts"))) assert.ok(!follow(stage("stage.ts")).has(file), `${file.slice(src.length + 1)} is behind both doors`);
});

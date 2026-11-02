/**
 * grooph's size caps (limits.ts, docs/security.md): a graph or a map over them is refused wherever it is opened, by
 * a link, a file or a paste, before anything is drawn; one at them opens and draws, its 3D views included.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateRawSync, inflateRawSync } from "node:zlib";

import { GRAPH_LIMITS, MAP_LIMITS } from "../src/limits.js";
import { parseMap } from "../src/map.js";
import { parseProposalSet } from "../src/proposals.js";
import { parseRunBundle } from "../src/runs.js";
import { mermaid } from "../src/mermaid.js";
import { readMermaid } from "../src/mermaid-read.js";
import { parseGraph, parseGraphText } from "../src/parse.js";
import { picture } from "../src/picture/graph-picture.js";
import { MOST_ROUNDS } from "../src/picture/stage/spiral.js";
import { STILL_VIEWS, still } from "../src/picture/stage/still.js";
import { SHARE_VERSION, decodeSharePayload, toBase64Url, type InflateRaw } from "../src/share.js";
import type { Graph } from "../src/types.js";
import { validate } from "../src/validate.js";

/** A graph of `n` nodes in a chain, with more edges forward to make `m`, a loop for every few nodes, and groups of five. */
function sized(n: number, m: number, loops = 0, groups = 0): Graph {
  const nodes = Array.from({ length: n }, (_, i) => ({ id: `n${i}`, kind: "agent" as const, name: `Step ${i}`, role: "builder" as const, brief: "Do it.", outputs: ["it"] }));
  const edges: Graph["edges"] = [];
  for (let i = 1; i < n; i++) edges.push({ id: `e${i}`, from: `n${i - 1}`, to: `n${i}` });
  for (let k = 0; edges.length < m - loops; k++) {
    const a = (k * 7919) % n;
    const b = (k * 104729 + 13) % n;
    if (a !== b) edges.push({ id: `x${k}`, from: `n${Math.min(a, b)}`, to: `n${Math.max(a, b)}` });
  }
  const loopList: Graph["loops"] = [];
  for (let j = 0; j < loops; j++) {
    edges.push({ id: `back${j}`, from: `n${2 * j + 1}`, to: `n${2 * j}`, when: "fail" });
    loopList.push({ id: `loop${j}`, name: `Loop ${j}`, members: [`n${2 * j}`, `n${2 * j + 1}`], back: [`back${j}`], stops: [{ kind: "max-iterations", n: 3 }] });
  }
  const groupList = Array.from({ length: groups }, (_, g) => ({ id: `group${g}`, name: `Group ${g}`, members: Array.from({ length: 5 }, (_, k) => `n${(g * 5 + k) % n}`) }));
  return { grooph: 0, id: "sized", name: "Sized", version: 1, nodes, edges, loops: loopList, ...(groups > 0 ? { groups: groupList } : {}) };
}

test("a graph at the caps opens, validates, and draws, flat and in every 3D view", () => {
  const doc = sized(GRAPH_LIMITS.nodes, GRAPH_LIMITS.edges, GRAPH_LIMITS.loops, GRAPH_LIMITS.groups);
  assert.equal(doc.edges.length, GRAPH_LIMITS.edges);
  const parsed = parseGraphText(JSON.stringify(doc));
  assert.deepEqual(parsed.issues, []);
  assert.deepEqual(validate(parsed.doc!).filter((i) => i.severity === "error"), []);
  assert.match(picture(parsed.doc!), /^<svg /);
  // Every 3D view, with every loop's spiral as tall as one is drawn: the most points a graph inside the caps has. The
  // still's arithmetic is the app's.
  for (const loop of parsed.doc!.loops) loop.stops = [{ kind: "max-iterations", n: MOST_ROUNDS }];
  for (const view of STILL_VIEWS) assert.match(still(parsed.doc!, { view }), /^<svg /, view);
});

test("one node or one edge over the caps is refused, with what was found and what grooph opens", () => {
  const nodes = parseGraph(sized(GRAPH_LIMITS.nodes + 1, GRAPH_LIMITS.nodes));
  assert.equal(nodes.doc, undefined);
  assert.deepEqual(
    nodes.issues.map((i) => `${i.code} ${i.message}`),
    ["E_SCHEMA /nodes: 501 nodes, more than the 500 grooph draws in a graph"],
  );
  const edges = parseGraph(sized(10, GRAPH_LIMITS.edges + 1));
  assert.match(edges.issues[0]!.message, /^\/edges: 2,001 edges, more than the 2,000 grooph draws in a graph$/);
  // Before the schema: a hundred thousand nodes that are not even nodes are refused for their number, at once.
  const began = performance.now();
  const huge = parseGraph({ grooph: 0, id: "x", name: "x", version: 1, nodes: new Array(100_000).fill(0), edges: [], loops: [] });
  assert.match(huge.issues[0]!.message, /^\/nodes: 100,000 nodes/);
  assert.ok(performance.now() - began < 200);
});

test("a map over its caps is refused the same way", () => {
  const sessions = Array.from({ length: MAP_LIMITS.sessions + 1 }, (_, i) => ({ id: `s${i}` }));
  const result = parseMap({ groophMap: 0, id: "m", name: "M", version: 1, sessions, handoffs: [] });
  assert.equal(result.map, undefined);
  assert.match(result.issues[0]!.message, /^\/sessions: 201 sessions, more than the 200 grooph draws in a map$/);
});

test("a link that carries a graph over the caps is refused when it is opened, and so is Mermaid text", () => {
  const inflate: InflateRaw = (bytes, maxOutput) => inflateRawSync(bytes, { maxOutputLength: maxOutput });
  const doc = sized(GRAPH_LIMITS.nodes + 1, GRAPH_LIMITS.nodes);
  const payload = toBase64Url(deflateRawSync(new TextEncoder().encode(JSON.stringify({ v: SHARE_VERSION, kind: "graph", doc })), { level: 9 }));
  const opened = decodeSharePayload(payload, inflate);
  assert.equal(opened.ok, false);
  // The headline says it, for an embed that shows the headline alone.
  assert.equal((opened as { message?: string }).message, "The link holds a graph too large to draw: 501 nodes, more than the 500 grooph draws in a graph. It was not opened.");

  const read = readMermaid(mermaid(doc));
  assert.equal(read.ok, false);
  assert.match(read.ok ? "" : read.error, /^a diagram too large to open: 501 nodes, more than the 500 grooph draws in a graph$/);
  assert.equal(readMermaid(mermaid(sized(GRAPH_LIMITS.nodes, GRAPH_LIMITS.edges))).ok, true);
});

test("loops and groups are held by their members in all, and a set's candidates and a run's graphs by every cap", () => {
  const groups = sized(300, 400);
  groups.groups = Array.from({ length: 10 }, (_, g) => ({ id: `g${g}`, name: `G${g}`, members: groups.nodes.map((n) => n.id) }));
  assert.match(parseGraph(groups).issues[0]!.message, /^\/groups: 3,000 members of groups in all, more than the 2,000 grooph draws in a graph$/);
  const loops = sized(300, 400, 2);
  for (const loop of loops.loops) loop.members = loops.nodes.map((n) => n.id);
  loops.loops = [...loops.loops, ...Array.from({ length: 5 }, (_, k) => ({ ...loops.loops[0]!, id: `more${k}` }))];
  assert.match(parseGraph(loops).issues[0]!.message, /^\/loops: 2,100 members of loops in all, more than the 2,000 grooph draws in a graph$/);

  const big = sized(GRAPH_LIMITS.nodes + 1, GRAPH_LIMITS.nodes);
  const set = { groophProposals: 0, id: "s", title: "S", brief: "b", candidates: [{ id: "a", label: "A", graph: sized(3, 2) }, { id: "b", label: "B", graph: big }] };
  assert.deepEqual(parseProposalSet(set).issues.map((i) => i.message), ["/candidates/1/graph/nodes: 501 nodes, more than the 500 grooph draws in a graph"]);
  const run = { groophRun: 0, run: "r", source: sized(3, 2), working: big, notes: [] };
  assert.deepEqual(parseRunBundle(run).issues, ["/working/nodes: 501 nodes, more than the 500 grooph draws in a graph"]);
});

test("a name of any length is cut to its card in time that grows with its length, not its square", () => {
  const doc = sized(20, 19);
  doc.nodes[0]!.name = "W".repeat(200_000);
  doc.name = "x ".repeat(100_000);
  const began = performance.now();
  const svg = picture(doc);
  assert.ok(performance.now() - began < 1000, `${Math.round(performance.now() - began)} ms`);
  assert.match(svg, /W…</);
});


test("loops are held by their stops in all, and a loop at that cap draws at once", () => {
  const doc = sized(10, 9, 1);
  doc.loops[0]!.stops = Array.from({ length: GRAPH_LIMITS.loopStops }, (_, k) => ({ kind: "max-iterations" as const, n: 3 + k }));
  assert.deepEqual(parseGraph(doc).issues, []);
  const began = performance.now();
  for (const view of STILL_VIEWS) still(doc, { view });
  assert.ok(performance.now() - began < 2000, `${Math.round(performance.now() - began)} ms`);
  doc.loops[0]!.stops.push({ kind: "max-iterations", n: 3 });
  assert.match(parseGraph(doc).issues[0]!.message, /^\/loops: 2,001 stops of loops in all, more than the 2,000 grooph draws in a graph$/);
});

test("groups nested as deep as the caps allow draw in every 3D view in time that does not grow with the depth's cube", () => {
  // Each group holds the next and two nodes: 200 deep, inside every cap.
  const doc = sized(GRAPH_LIMITS.groups * 2, GRAPH_LIMITS.groups * 2 - 1);
  doc.groups = Array.from({ length: GRAPH_LIMITS.groups }, (_, g) => ({ id: `group${g}`, name: `Group ${g}`, members: [`n${2 * g}`, `n${2 * g + 1}`, ...(g + 1 < GRAPH_LIMITS.groups ? [`group${g + 1}`] : [])] }));
  assert.deepEqual(parseGraph(doc).issues, []);
  for (const view of STILL_VIEWS) {
    const began = performance.now();
    assert.match(still(doc, { view }), /^<svg /);
    assert.ok(performance.now() - began < 3000, `${view}: ${Math.round(performance.now() - began)} ms`);
  }
});

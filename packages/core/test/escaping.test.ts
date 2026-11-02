/**
 * Text from a document is escaped wherever grooph shows it (docs/security.md): markup in a name, a brief, a goal, a
 * loop's name, a verdict or a stop's metric is words in every picture, page and text grooph writes, and never
 * an element, an attribute or a statement.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { glyph, mapLive, mapPicture, mapSequence, mapShape, mapStill, mapWide, mermaid, mermaidAgentflow, offlinePage, parseGraphText, parseMapText, picture, resolvePositions, still, STILL_VIEWS, summarizeRun, themed, validate } from "../src/index.js";
import type { Graph, OperationMap, RunNote } from "../src/types.js";
import { fixturesDir, read, repoRoot } from "./helpers.js";

const HOSTILE = `"><script>alert(1)</script><img src=x onerror=alert(2)><svg onload=alert(3)> ]]> &amp; <!-- x`;

function hostileGraph(): Graph {
  const doc = parseGraphText(read(join(repoRoot, "patterns", "review-gate.grooph.json"))).doc!;
  doc.name = HOSTILE;
  doc.goal = HOSTILE;
  for (const node of doc.nodes) {
    node.name = `${node.name} ${HOSTILE}`;
    if (node.kind === "agent") node.brief = HOSTILE;
    if (node.kind === "human-gate") node.prompt = HOSTILE;
  }
  for (const loop of doc.loops) {
    loop.name = HOSTILE;
    if (loop.bar) loop.bar.name = HOSTILE;
    loop.stops.push({ kind: "diminishing-returns", rounds: 2, metric: HOSTILE });
  }
  for (const edge of doc.edges) if (edge.when === "fail") edge.when = { verdict: HOSTILE };
  return doc;
}

function hostileMap(): OperationMap {
  const map = parseMapText(read(join(fixturesDir, "maps", "valid", "a-small-studio.grooph-map.json"))).map!;
  map.name = HOSTILE;
  for (const session of map.sessions) session.name = `${session.name ?? session.id} ${HOSTILE}`;
  for (const handoff of map.handoffs) (handoff as { what?: string }).what = HOSTILE;
  return map;
}

/**
 * The markup that could run or fetch in a text: each real tag that is a script, an image, a frame or an object, and
 * each on…= attribute inside a real tag. Escaped text (`&lt;img onerror=…&gt;`) is words and is not counted.
 */
function markup(text: string): string[] {
  const found: string[] = [];
  for (const tag of text.matchAll(/<([a-zA-Z][\w:-]*)([^<>]*)>/g)) {
    const name = tag[1]!.toLowerCase();
    if (["script", "img", "iframe", "object", "embed", "foreignobject"].includes(name)) found.push(`<${name}`);
    // A handler is an attribute: what stands inside a quoted value (an escaped title or label) is words.
    for (const attribute of tag[2]!.replace(/"[^"]*"/g, '""').matchAll(/\son[a-z]+\s*=/gi)) found.push(attribute[0].trim().toLowerCase());
  }
  return found;
}

test("markup in a document is words in every picture: flat, in each theme and form, as a glyph, and in every 3D still", () => {
  const doc = hostileGraph();
  const outputs: [string, string][] = [
    ["picture", picture(doc)],
    ["picture, light", picture(doc, { theme: "light" })],
    ["picture, dark", picture(doc, { theme: "dark" })],
    ["picture, ink", themed(picture(doc), "ink")],
    ["glyph", glyph(doc)],
    ...STILL_VIEWS.map((view): [string, string] => [`still ${view}`, still(doc, { view })]),
  ];
  for (const [name, svg] of outputs) {
    assert.deepEqual(markup(svg), [], name);
    assert.ok(svg.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), `${name}: the words are there, as words`);
  }
  const map = hostileMap();
  for (const [name, svg] of [["map", mapPicture(map)], ["map, wide", mapWide(map)], ["map, sequence", mapSequence(map)]] as const) {
    assert.deepEqual(markup(svg), [], name);
  }
});

test("markup in a document is words in the offline page, whose own script is the only one, and in Mermaid text", () => {
  const plain = parseGraphText(read(join(repoRoot, "patterns", "review-gate.grooph.json"))).doc!;
  const page = offlinePage(hostileGraph(), { version: "9.9.9" });
  assert.deepEqual(markup(page), markup(offlinePage(plain, { version: "9.9.9" })), "the same elements as the same page of a plain document");
  for (const text of [mermaid(hostileGraph()), mermaidAgentflow(hostileGraph())]) {
    assert.deepEqual(markup(text), [], "no tag reaches Mermaid, which would read it as HTML");
  }
});

test("a character XML does not allow is dropped from every picture, so a picture saved as a file still opens", () => {
  const doc = parseGraphText(read(join(repoRoot, "patterns", "review-gate.grooph.json"))).doc!;
  const odd = `a${String.fromCharCode(1)}b${String.fromCharCode(0x1b)}c${String.fromCharCode(0xfffe)}d${String.fromCharCode(0xd800)}e`;
  doc.name = odd;
  for (const node of doc.nodes) node.name = `${node.name} ${odd}`;
  for (const loop of doc.loops) loop.name = odd;
  const map = hostileMap();
  for (const session of map.sessions) session.name = odd;
  const outputs: [string, string][] = [
    ["picture", picture(doc)],
    ["glyph", glyph(doc)],
    ...STILL_VIEWS.map((view): [string, string] => [`still ${view}`, still(doc, { view })]),
    ["map", mapPicture(map)],
    ["map, wide", mapWide(map)],
    ["map, sequence", mapSequence(map)],
  ];
  const forbidden = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\uFFFE\\uFFFF]|[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|(?<![\\uD800-\\uDBFF])[\\uDC00-\\uDFFF]");
  for (const [name, svg] of outputs) {
    assert.ok(!forbidden.test(svg), name);
    assert.ok(svg.includes("abcde"), `${name}: the rest of the words are there`);
  }
  // A pair that makes one character is kept.
  doc.name = "a \u{1F600} b";
  assert.ok(picture(doc).includes("a \u{1F600} b"));
});

test("a harness the map names is its own words, whatever it is called", () => {
  const map = parseMapText(read(join(fixturesDir, "maps", "valid", "a-small-studio.grooph-map.json"))).map!;
  map.sessions[0]!.harness = "constructor";
  map.sessions[1]!.harness = "__proto__";
  for (const svg of [mapPicture(map), mapStill(map)]) {
    assert.ok(!svg.includes("native code") && !svg.includes("[object Object]"), "no built-in of the language is drawn");
    assert.ok(svg.includes("constructor") && svg.includes("__proto__"));
  }
});

test("an id or a harness named like a built-in of the language is drawn as its own, in every view and count", () => {
  const plain = parseGraphText(read(join(repoRoot, "patterns", "review-gate.grooph.json"))).doc!;
  const renamed = (from: string): Graph => JSON.parse(JSON.stringify(plain).replaceAll(`"${from}"`, '"constructor"')) as Graph;
  const docs: [string, Graph][] = [
    ["a node", renamed(plain.nodes[0]!.id)],
    ["a loop", renamed(plain.loops[0]!.id)],
    ["an edge", renamed(plain.edges[0]!.id)],
    ["a group", { ...plain, groups: [{ id: "constructor", name: "G", members: [plain.nodes[1]!.id] }] }],
  ];
  const wrong = /NaN|native code|\[object Object\]/;
  for (const [what, doc] of docs) {
    assert.deepEqual(validate(doc).filter((i) => i.severity === "error"), [], what);
    for (const [name, svg] of [["picture", picture(doc)], ...STILL_VIEWS.map((view) => [view, still(doc, { view })])] as const) assert.doesNotMatch(svg, wrong, `${what}: ${name}`);
    for (const position of Object.values(resolvePositions(doc).positions)) assert.ok(Number.isFinite(position.x) && Number.isFinite(position.y), what);
  }
  const map = parseMapText(read(join(fixturesDir, "maps", "valid", "a-small-studio.grooph-map.json"))).map!;
  const named = JSON.parse(JSON.stringify(map).replaceAll(`"${map.sessions[0]!.id}"`, '"constructor"')) as OperationMap;
  named.sessions[0]!.harness = "__proto__";
  named.sessions[1]!.harness = "constructor";
  for (const svg of [mapPicture(named), mapWide(named), mapSequence(named), mapStill(named)]) assert.doesNotMatch(svg, wrong);
  const harnesses = mapShape(named).harnesses;
  assert.equal(harnesses["constructor"], named.sessions[1]!.count ?? 1);
  assert.equal(Object.hasOwn(harnesses, "__proto__"), true);
  const live = mapLive([{ source: "constructor", sessionId: "x", state: "working", lastAt: "2026-10-28T12:00:00Z", agents: [] } as unknown as Parameters<typeof mapLive>[0][number]], named, "2026-10-28T12:05:00Z");
  assert.equal(live["constructor"]?.sessions, 1);
  // A run's note at a node or a loop named so, which the graph does not have, is its own entry, and writes on nothing else.
  const notes = [
    { id: "a", run: "r", at: "node:constructor", outcome: "pass", round: 4 },
    { id: "b", run: "r", at: "loop:constructor", outcome: "pass", round: 2 },
  ] as unknown as RunNote[];
  const summary = summarizeRun(notes, plain);
  assert.equal(Object.hasOwn(summary.nodes, "constructor") && Object.hasOwn(summary.loops, "constructor"), true);
  assert.equal(summary.nodes["constructor"]?.state, "passed");
  assert.equal(Object.hasOwn(Object, "state") || Object.hasOwn(Object, "runs") || Object.hasOwn(Object, "round"), false);
});

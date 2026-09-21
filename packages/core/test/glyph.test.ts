/**
 * The glyph and the Mermaid projection (slice 0015): one fixture per feature,
 * byte-identical output for the same document, and no words in the picture.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { glyph } from "../src/glyph.js";
import { mermaid } from "../src/mermaid.js";
import { parseGraphText } from "../src/parse.js";
import type { Graph } from "../src/types.js";
import { fixturesDir, read, repoRoot } from "./helpers.js";

const load = (path: string): Graph => {
  const parsed = parseGraphText(read(path));
  assert.deepEqual(parsed.issues, [], `${path} parses`);
  return parsed.doc!;
};
const valid = (name: string): Graph => load(join(fixturesDir, "valid", `${name}.grooph.json`));
const pattern = (id: string): Graph => load(join(repoRoot, "patterns", `${id}.grooph.json`));

const count = (text: string, re: RegExp): number => (text.match(re) ?? []).length;
const STYLE = (colour: string): RegExp => new RegExp(`style="[^"]*${colour.replace(/[()]/g, "\\$&")}`, "g");

// ─── glyph ────────────────────────────────────────────────────────────────

test("glyph: the same document gives byte-identical SVG, and a copy of it too", () => {
  const doc = pattern("review-gate");
  const a = glyph(doc);
  const b = glyph(JSON.parse(JSON.stringify(doc)) as Graph);
  assert.equal(a, b);
  assert.equal(glyph(doc, { scale: 2 }), glyph(doc, { scale: 2 }));
  assert.notEqual(glyph(doc, { scale: 2 }), a, "scale changes the width and height attributes");
  assert.match(glyph(doc, { scale: 2 }), /viewBox="[^"]+" width="426" height="148"/);
});

test("glyph: no words; the graph's name is in a <title> only, escaped", () => {
  const doc = { ...pattern("review-gate"), name: "Review <gate> & friends" };
  const svg = glyph(doc);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[^"]+" width="[^"]+" height="[^"]+" role="img"/);
  assert.match(svg, /<title>Review &lt;gate&gt; &amp; friends<\/title>/);
  assert.equal(count(svg, /<text/g), 0, "no text elements");
  for (const node of doc.nodes) assert.equal(svg.replace(/<title>.*<\/title>/, "").includes(node.name), false, `${node.name} is not written`);
  assert.equal(count(svg, / id="/g), 0, "no ids, so several glyphs can share a page");
});

test("glyph: a loop with a back edge (fix-until-green): hull, a dashed fail edge returning, square, hexagon, dot", () => {
  const svg = glyph(valid("fix-until-green"));
  assert.equal(count(svg, /stroke-dasharray="4 3"/g), 1, "one dashed hull for one loop");
  assert.match(svg, /<rect [^>]*rx="10"[^>]*style="stroke:var\(--loop-0, #7a4cc2\)"/, "the hull takes the loop's colour");
  assert.equal(count(svg, /stroke-dasharray="5 3"/g), 1, "the fail edge is dashed");
  assert.match(svg, /<path d="M[^"]+ C[^"]+" stroke-width="1.6" stroke-dasharray="5 3" style="stroke:var\(--warning, #955500\)"/, "the back edge is a curve in the warning colour");
  assert.equal(count(svg, /<rect [^>]*rx="2"/g), 1, "one writer square");
  assert.equal(count(svg, /<path d="M[^"]+" stroke-width="1.8" style="fill:var\(--surface, #ffffff\);stroke:var\(--kind-check, #2b5f9e\)"/g), 1, "one check hexagon");
  assert.equal(count(svg, /<circle [^>]*r="6" style="fill:var\(--ink, #2b302e\)"/g), 1, "one filled stop dot");
  // Left to right: the builder, then the check, then the stop.
  const xs = [...svg.matchAll(/<rect x="([\d.-]+)" y="[\d.-]+" width="22"|<path d="M([\d.-]+),[\d.-]+ L[\d.-]+,[\d.-]+ L[\d.-]+,[\d.-]+ L[\d.-]+,[\d.-]+ L[\d.-]+,[\d.-]+ L[\d.-]+,[\d.-]+ Z"|<circle cx="([\d.-]+)"/g)].map((m) => Number(m[1] ?? m[2] ?? m[3]));
  assert.equal(xs.length, 3);
  assert.ok(xs[0]! < xs[1]! && xs[1]! < xs[2]!, `builder, check, stop read left to right: ${xs.join(", ")}`);
});

test("glyph: a gate (review-loop) is an octagon in the gate colour, drawn heavier", () => {
  const svg = glyph(valid("review-loop"));
  assert.equal(count(svg, /stroke-width="2.4" style="fill:var\(--surface, #ffffff\);stroke:var\(--kind-human-gate, #b25e09\)"/g), 1);
  assert.equal(count(svg, /<path d="M[^"]+ L[^"]+ L[^"]+ L[^"]+ Z" stroke-width="1.8" style="fill:var\(--accent-soft, #e3efe9\);stroke:var\(--kind-agent, #1f5f4a\)"/g), 1, "one critic diamond");
  assert.equal(count(svg, /stroke-dasharray="5 3"/g), 2, "both back edges are fail edges, dashed");
});

test("glyph: a fragment with an irreversible node (approval-fragment): a bar under it, no hull", () => {
  const svg = glyph(valid("approval-fragment"));
  assert.equal(count(svg, /stroke-dasharray="4 3"/g), 0, "no loop, no hull");
  assert.equal(count(svg, /stroke-width="3" style="stroke:var\(--error, #b42318\)"/g), 1, "one bar");
  assert.equal(count(svg, /<rect /g), 1, "the publisher square");
  const bar = /<path d="M([\d.-]+),([\d.-]+) L([\d.-]+),([\d.-]+)" stroke-width="3"/.exec(svg)!;
  const square = /<rect x="([\d.-]+)" y="([\d.-]+)" width="22"/.exec(svg)!;
  assert.equal(Number(bar[2]), Number(square[2]) + 11 + 17, "the bar sits under the square");
  assert.equal(Number(bar[1]), Number(square[1]) + 11 - 13);
});

test("glyph: every edge style and every shape (glyph-vocabulary)", () => {
  const svg = glyph(valid("glyph-vocabulary"));
  assert.equal(count(svg, /<rect [^>]*rx="2"/g), 4, "planner, builder, docs writer and ship are writer squares");
  assert.equal(count(svg, /<rect [^>]*rx="7"/g), 1, "the researcher is a rounded square");
  assert.equal(count(svg, /<circle [^>]*r="11"/g), 1, "the merge is a circle");
  assert.equal(count(svg, /<circle [^>]*r="6" style="fill:var\(--ink, #2b302e\)"/g), 1, "the success stop is an ink dot");
  assert.equal(count(svg, /<circle [^>]*r="6" style="fill:var\(--warning, #955500\)"/g), 1, "the halt stop is a warning dot");
  assert.equal(count(svg, /stroke-dasharray="1.5 3.5"/g), 1, "the verdict edge is dotted");
  assert.equal(count(svg, STYLE("var(--ink-3, #6b7370)")), 2, "the verdict edge and its arrowhead are muted");
  assert.equal(count(svg, /<g transform="translate\(/g), 2, "the approval edge is doubled");
  assert.equal(count(svg, STYLE("var(--kind-human-gate, #b25e09)")), 4, "the octagon, both halves of the approval edge, and its arrowhead");
  assert.equal(count(svg, /stroke-dasharray="4 3"/g), 2, "two loops, two hulls");
  // The outer hull is drawn first and encloses the inner one.
  const hulls = [...svg.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)" rx="10"/g)].map((m) => m.slice(1, 5).map(Number));
  assert.equal(hulls.length, 2);
  const [outer, inner] = hulls as [number[], number[]];
  assert.ok(outer[0]! < inner[0]! && outer[1]! < inner[1]!, "outer starts before inner");
  assert.ok(outer[0]! + outer[2]! > inner[0]! + inner[2]! && outer[1]! + outer[3]! > inner[1]! + inner[3]!, "outer ends after inner");
  assert.match(svg, /rx="10" stroke-width="1.3" stroke-dasharray="4 3" style="stroke:var\(--loop-1, #0f7c8c\)"/, "the second loop takes the second colour");
});

test("glyph: a document with a layout follows it; without one, the layered layout", () => {
  const doc = valid("review-loop");
  // The fixture's layout is one line; move the critic under the builder, and the glyph must follow.
  const moved: Graph = { ...doc, layout: { ...doc.layout!, critic: { x: 80, y: 460 } } };
  const withLayout = glyph(moved);
  const { layout: _layout, ...rest } = doc;
  const without = glyph(rest as Graph);
  assert.notEqual(withLayout, without);
  const box = (svg: string, kind: "rect" | "diamond"): [number, number] => {
    const m = kind === "rect" ? /<rect x="([\d.-]+)" y="([\d.-]+)" width="22"/.exec(svg)! : /<path d="M([\d.-]+),([\d.-]+) L[^"]+ Z" stroke-width="1.8" style="fill:var\(--accent-soft/.exec(svg)!;
    return [Number(m[1]), Number(m[2])];
  };
  const [bx, by] = box(withLayout, "rect");
  const [cx, cy] = box(withLayout, "diamond");
  assert.equal(cx, bx + 11, "critic under the builder, as the layout has it");
  assert.ok(cy > by + 22, "critic below the builder");
  const [bx2, by2] = box(without, "rect");
  const [cx2, cy2] = box(without, "diamond");
  assert.ok(cx2 > bx2, "layered: critic one rank to the right");
  assert.equal(cy2 + 14, by2 + 11, "layered: on the same line");
  assert.equal(glyph(moved), withLayout, "and byte-identical again");
});

test("glyph: an empty document is an empty frame; dangling edges are left out", () => {
  const empty: Graph = { grooph: 0, id: "empty", name: "Empty", version: 1, nodes: [], edges: [], loops: [] };
  assert.match(glyph(empty), /<svg [^>]+>\n<title>Empty<\/title>\n<\/svg>$/);
  const dangling: Graph = { ...valid("fix-until-green"), edges: [{ id: "e-x", from: "fixer", to: "nowhere" }] };
  assert.equal(count(glyph(dangling), /<path d="M[^"]+" stroke-width="1.6"/g), 0);
});

test("glyph: every built-in pattern draws, with one hull per loop and one shape per node", () => {
  for (const id of ["grind-loop", "specialist-critic-bank", "fresh-grind-rare-judge", "tournament-then-judge", "human-gated-irreversible", "debate-then-build"]) {
    const doc = pattern(id);
    const svg = glyph(doc);
    assert.equal(count(svg, /stroke-dasharray="4 3"/g), doc.loops.length, `${id}: hulls`);
    assert.equal(count(svg, /<rect [^>]*rx="[27]"|<circle |<path d="M[^"]+ Z" stroke-width="(1\.8|2\.4)"/g), doc.nodes.length, `${id}: shapes`);
    assert.equal(count(svg, /<path d="M[^"]+ L[^"]+ L[^"]+ Z" style="fill:/g), doc.edges.length, `${id}: arrowheads`);
  }
});

// ─── mermaid ──────────────────────────────────────────────────────────────

test("mermaid: a flowchart LR with a header saying it is one way, a subgraph per loop, labels and stop notes", () => {
  const text = mermaid(pattern("review-gate"));
  const lines = text.split("\n");
  assert.match(lines[0]!, /^%% grooph mermaid: a projection of Review gate \(review-gate@1\)\. One way only: it does not round-trip\.$/);
  assert.match(lines[1]!, /^%% .*edit that, not this\.$/);
  assert.equal(lines[2], "flowchart LR");
  assert.equal(count(text, /^\s*subgraph /gm), 1);
  assert.match(text, /subgraph n_review\["Review · judgment loop"\]/);
  assert.match(text, /n_builder\["Builder"\]/, "a writer is a box");
  assert.match(text, /n_critic\{"Critic"\}/, "a critic is a diamond");
  assert.match(text, /n_merge_gate\[\/"Merge approval"\\\]/, "a gate is the manual-operation trapezoid");
  assert.match(text, /n_done\(\(\("Done"\)\)\)/, "a stop is a double circle");
  assert.match(text, /n_critic -\.->\|"fail"\| n_builder/, "a back edge is dotted and labelled");
  assert.match(text, /n_merge_gate -->\|"pass"\| n_done/);
  assert.match(text, /n_builder --> n_critic/, "an always edge has no label");
  assert.equal(count(text, /:::stop$/gm), 3, "one note per stop");
  assert.match(text, /n_review_stop_2>"stop: max iterations: 4"\]:::stop/);
  assert.match(text, /classDef stop /);
  assert.ok(text.endsWith("\n"));
});

test("mermaid: nested loops nest their subgraphs; approval and verdict edges are labelled; other kinds get their shapes", () => {
  const text = mermaid(valid("glyph-vocabulary"));
  assert.match(text, /  subgraph n_review\["Review · judgment loop"\]\n(.*\n)*    subgraph n_grind\["Grind · grind loop"\]\n(.*\n)*    end\n(.*\n)*  end\n/);
  assert.match(text, /n_gate -->\|"pass, approval"\| n_ship/);
  assert.match(text, /n_critic -\.->\|"verdict: needs-evidence"\| n_build/);
  assert.match(text, /n_scout\(\["Scout"\]\)/, "another role is a stadium");
  assert.match(text, /n_tests\{\{"Tests"\}\}/, "a check is a hexagon");
  assert.match(text, /n_merge\(\("Merge"\)\)/, "a merge is a circle");
  assert.equal(count(text, /:::stop$/gm), 5);
  assert.equal(count(text, /%% .* is also a member of loop/g), 0, "nested loops share nothing improperly");
});

test("mermaid: a node in two loops that do not nest goes in the first, and the other is named in a comment", () => {
  const doc = valid("glyph-vocabulary");
  const twisted: Graph = {
    ...doc,
    loops: [
      doc.loops[0]!,
      { ...doc.loops[1]!, members: ["tests", "critic"] }, // overlaps grind on tests without containing it
    ],
  };
  const text = mermaid(twisted);
  assert.match(text, /%% tests is also a member of loop review/);
  assert.equal(count(text, /n_tests\{\{"Tests"\}\}/g), 1, "declared once");
});

test("mermaid: quotes in a name are escaped for Mermaid, and a name that is only an id falls back to the id", () => {
  const doc = valid("fix-until-green");
  doc.nodes[0]!.name = 'The "fixer"';
  doc.nodes[2]!.name = "";
  const text = mermaid(doc);
  assert.match(text, /n_fixer\["The #quot;fixer#quot;"\]/);
  assert.match(text, /n_green\(\(\("green"\)\)\)/);
});

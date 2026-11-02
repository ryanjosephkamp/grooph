/**
 * The glyph and the Mermaid projection: one fixture per feature,
 * byte-identical output for the same document, and no words in the picture.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { glyph } from "../src/glyph.js";
import { mermaid } from "../src/mermaid.js";
import { mermaidAgentflow } from "../src/mermaid-agentflow.js";
import { parseGraphText } from "../src/parse.js";
import type { AgentNode, Graph } from "../src/types.js";
import { fixturesDir, read, repoRoot } from "./helpers.js";

const load = (path: string): Graph => {
  const parsed = parseGraphText(read(path));
  assert.deepEqual(parsed.issues, [], `${path} parses`);
  return parsed.doc!;
};
const valid = (name: string): Graph => load(join(fixturesDir, "valid", `${name}.grooph.json`));
const pattern = (id: string): Graph => load(join(repoRoot, "patterns", `${id}.grooph.json`));

const count = (text: string, re: RegExp): number => (text.match(re) ?? []).length;
const STYLE = (color: string): RegExp => new RegExp(`style="[^"]*${color.replace(/[()]/g, "\\$&")}`, "g");

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
  assert.match(svg, /<rect [^>]*rx="10"[^>]*style="stroke:var\(--loop-0, #7a4cc2\)"/, "the hull takes the loop's color");
  assert.equal(count(svg, /stroke-dasharray="5 3"/g), 1, "the fail edge is dashed");
  assert.match(svg, /<path d="M[^"]+ C[^"]+" stroke-width="1.6" stroke-dasharray="5 3" style="stroke:var\(--warning, #955500\)"/, "the back edge is a curve in the warning color");
  assert.equal(count(svg, /<rect [^>]*rx="2"/g), 1, "one writer square");
  assert.equal(count(svg, /<path d="M[^"]+" stroke-width="1.8" style="fill:var\(--surface, #ffffff\);stroke:var\(--kind-check, #2b5f9e\)"/g), 1, "one check hexagon");
  assert.equal(count(svg, /<circle [^>]*r="6" style="fill:var\(--ink, #2b302e\)"/g), 1, "one filled stop dot");
  // Left to right: the builder, then the check, then the stop.
  const xs = [...svg.matchAll(/<rect x="([\d.-]+)" y="[\d.-]+" width="22"|<path d="M([\d.-]+),[\d.-]+ L[\d.-]+,[\d.-]+ L[\d.-]+,[\d.-]+ L[\d.-]+,[\d.-]+ L[\d.-]+,[\d.-]+ L[\d.-]+,[\d.-]+ Z"|<circle cx="([\d.-]+)"/g)].map((m) => Number(m[1] ?? m[2] ?? m[3]));
  assert.equal(xs.length, 3);
  assert.ok(xs[0]! < xs[1]! && xs[1]! < xs[2]!, `builder, check, stop read left to right: ${xs.join(", ")}`);
});

test("glyph: a gate (review-loop) is an octagon in the gate color, drawn heavier", () => {
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
  assert.match(svg, /rx="10" stroke-width="1.3" stroke-dasharray="4 3" style="stroke:var\(--loop-1, #0f7c8c\)"/, "the second loop takes the second color");
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

test("mermaid: a flowchart LR with a header saying what reads back, a subgraph per loop, labels and a stops note", () => {
  const text = mermaid(pattern("review-gate"));
  const lines = text.split("\n");
  assert.match(lines[0]!, /^%% grooph mermaid: a projection of Review gate \(review-gate@1\)\.$/);
  assert.match(lines[1]!, /^%% grooph import reads back its nodes, edges, loops and stops; briefs, bars and brakes live in the graph document\.$/);
  assert.equal(lines[2], "flowchart LR");
  assert.equal(count(text, /^\s*subgraph /gm), 1);
  assert.match(text, /subgraph n_review\["Review · judgment loop"\]/);
  assert.match(text, /n_builder\["Builder"\]/, "a writer is a box");
  assert.match(text, /n_critic\{"Critic"\}/, "a critic is a diamond");
  assert.match(text, /n_merge_gate\[\/"Merge approval"\\\]/, "a gate is the manual-operation trapezoid");
  assert.match(text, /n_done\(\(\("Done"\)\)\)/, "a stop is a double circle");
  assert.match(text, /n_critic -\.->\|"fail"\| n_builder/, "a back edge is dotted and labeled");
  assert.match(text, /n_merge_gate -->\|"pass"\| n_done/);
  assert.match(text, /n_builder --> n_critic/, "an always edge has no label");
  assert.equal(count(text, /:::stop$/gm), 1, "one note per loop");
  assert.match(text, /\n    stops_review\["stops<br>bar passed<br>max iterations: 4<br>budget: 10 dispatches"\]:::stop\n/, "the loop's stops, one per line, inside its subgraph");
  assert.match(text, /classDef stop /);
  assert.ok(text.endsWith("\n"));
});

test("mermaid: nested loops nest their subgraphs; approval and verdict edges are labeled; other kinds get their shapes", () => {
  const text = mermaid(valid("glyph-vocabulary"));
  assert.match(text, /  subgraph n_review\["Review · judgment loop"\]\n(.*\n)*    subgraph n_grind\["Grind · grind loop"\]\n(.*\n)*    end\n(.*\n)*  end\n/);
  assert.match(text, /n_gate -->\|"pass, approval"\| n_ship/);
  assert.match(text, /n_critic -\.->\|"verdict: needs-evidence"\| n_build/);
  assert.match(text, /n_scout\(\["Scout"\]\)/, "another role is a stadium");
  assert.match(text, /n_tests\{\{"Tests"\}\}/, "a check is a hexagon");
  assert.match(text, /n_merge\(\("Merge"\)\)/, "a merge is a circle");
  assert.equal(count(text, /:::stop$/gm), 2, "one note for each loop");
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

test("mermaid: quotes and angle brackets in a name are escaped for Mermaid, and a name that is only an id falls back to the id", () => {
  const doc = valid("fix-until-green");
  doc.nodes[0]!.name = 'The "fixer" <br> <b>';
  doc.nodes[2]!.name = "";
  const text = mermaid(doc);
  assert.match(text, /n_fixer\["The #quot;fixer#quot; #lt;br#gt; #lt;b#gt;"\]/);
  assert.match(text, /n_green\(\(\("green"\)\)\)/);
});

test("mermaid: words shaped like an entity, a backtick, a directive and a line break stay words in one label", () => {
  const doc = valid("fix-until-green");
  doc.nodes[0]!.name = "issue #35; and #quot;x#quot;";
  doc.nodes[1]!.name = "`**bold**`";
  doc.nodes[2]!.name = '%%{init: {"flowchart": {"nodeSpacing": 400}}}%%\nend';
  const text = mermaid(doc);
  assert.match(text, /n_fixer\["issue #35;35; and #35;quot;x#35;quot;"\]/);
  assert.match(text, /n_suite\{\{"#96;\*\*bold\*\*#96;"\}\}/);
  assert.match(text, /n_green\(\(\("#37;#37;\{init: \{#quot;flowchart#quot;: \{#quot;nodeSpacing#quot;: 400\}\}\}#37;#37; end"\)\)\)/);
  assert.doesNotMatch(text, /%%\{/);
});

test("mermaid: a line break in the graph's name stays inside the header comment", () => {
  const doc = valid("fix-until-green");
  doc.name = "Evil\n%%{init: {}}%%\n  n_plan --> n_halt";
  const lines = mermaid(doc).split("\n");
  assert.match(lines[0]!, /^%% grooph mermaid: a projection of Evil #37;#37;\{init: \{\}\}#37;#37; n_plan --#gt; n_halt \(/);
  assert.equal(lines[2], "flowchart LR");
  assert.doesNotMatch(mermaid(doc), /%%\{/, "no directive anywhere in the text");
});

test("mermaid: an HTML entity, a backslash, and a colon before a # stay as typed", () => {
  const doc = valid("fix-until-green");
  doc.nodes[0]!.name = "&lt;b&gt; R&D C:\\new\\file";
  doc.nodes[1]!.name = "style:#1";
  const text = mermaid(doc);
  assert.match(text, /n_fixer\["#38;lt;b#38;gt; R#38;D C#58;#92;new#92;file"\]/);
  assert.match(text, /n_suite\{\{"style#58;#35;1"\}\}/);
  assert.match(mermaid(pattern("review-gate")), /"stops<br>bar passed<br>max iterations: 4<br>budget: 10 dispatches"/, "a colon before a space is left alone");
});

test("mermaid: a stop's own words are escaped inside the stops note, and a loop with no stops has no note", () => {
  const doc = valid("glyph-vocabulary");
  doc.loops.find((l) => l.id === "review")!.stops = [{ kind: "diminishing-returns", rounds: 2, metric: '<script>"x"' }];
  doc.loops.find((l) => l.id === "grind")!.stops = [];
  const text = mermaid(doc);
  assert.match(text, /stops_review\["stops<br>diminishing returns over 2 round\(s\) on #lt;script#gt;#quot;x#quot;"\]:::stop/);
  assert.equal(count(text, /:::stop$/gm), 1);
  assert.doesNotMatch(text, /stops_grind/);
});

// ─── mermaid --agentflow ──────────────────────────────────────────────────

test("mermaid agentflow: agents are flows holding one task, a gate is an action, the goal an input, and the way back carries the stops", () => {
  const doc = pattern("review-gate");
  const text = mermaidAgentflow(doc);
  const lines = text.split("\n");
  assert.match(lines[0]!, /^%% grooph mermaid --agentflow: Review gate \(review-gate@1\), in Mermaid's agentflow-beta syntax, which may still change\.$/);
  assert.equal(lines[2], "agentflow-beta TB");
  assert.match(text, /\n  goal\["\{\{task\}\} Done when every item in \{\{checklist\}\} is shown to…"\]@\{ shape: input, value: "\{\{task\}\} Done when every item in \{\{checklist\}\} is shown to hold, `\{\{test-command\}\}` passes, and a human approves the merge\." \}\n/);
  assert.match(text, /\n  flow n_builder\["Builder"\]\n    t_builder\["Do the task in the code, with tests\."\]@\{ shape: task \}\n  end\n  n_builder@\{ role: "builder", model: "strong", instruction: "Do the task in the code, with tests\. On a later round/);
  assert.match(text, /\n  n_merge_gate\["Merge approval"\]@\{ shape: action, question: "/);
  assert.match(text, /\n  n_done\["Done"\]@\{ shape: task, kind: "stop" \}\n/);
  assert.match(text, /\n  goal --> t_builder\n/);
  assert.match(text, /\n  t_builder --> t_critic\n/);
  assert.match(text, /\n  t_critic -- "fail<br>stops: bar passed<br>max iterations: 4<br>budget: 10 dispatches" --> t_builder\n/, "the loop's first way back carries its stops");
  assert.match(text, /\n  n_merge_gate -- "fail" --> t_builder\n/, "a second way back carries only its condition");
  assert.match(text, /\n  n_merge_gate -- "pass" --> n_done\n/);
  assert.equal(count(text, /^\s*flow /gm), 2);
  assert.ok(text.endsWith("\n"));
});

test("mermaid agentflow: a check is a decision, a merge a task, a person's step an action, and a metadata value cannot become an entity or a directive", () => {
  const glyphs = mermaidAgentflow(valid("glyph-vocabulary"));
  assert.match(glyphs, /n_tests\["Tests"\]@\{ shape: decision, check: "tests", /);
  assert.match(glyphs, /n_merge\["Merge"\]@\{ shape: task, kind: "merge" \}/);
  const doc = valid("fix-until-green");
  const fixer = doc.nodes[0] as AgentNode;
  fixer.brief = 'Fix it.\nThen %%{init: {}}%% and #quot;x#quot; "y"';
  fixer.by = "person";
  const text = mermaidAgentflow(doc);
  assert.match(text, /n_fixer\["Fixer \(a person\)"\]@\{ shape: action, role: "builder", instruction: "Fix it\.\\nThen \\u0025\\u0025\{init: \{\}\}\\u0025\\u0025 and \\u0023quot;x\\u0023quot; \\u0022y\\u0022" \}/);
  assert.doesNotMatch(text, /flow n_fixer/);
});

test("mermaid agentflow: a long brief is clipped at a word in its task and whole in its instruction; a graph with no goal has no input", () => {
  const doc = valid("fix-until-green");
  delete doc.goal;
  (doc.nodes[0] as AgentNode).brief = "Make every failing test pass by changing the code under test and never the tests themselves, then run the suite.";
  const text = mermaidAgentflow(doc);
  assert.match(text, /t_fixer\["Make every failing test pass by changing the code under…"\]/);
  assert.match(text, /instruction: "Make every failing test pass by changing the code under test and never the tests themselves, then run the suite\."/);
  assert.doesNotMatch(text, /shape: input/);
});

test("mermaid agentflow: a quote, a caret, a brace, a tag and the word direction in metadata cannot end the string or the line", () => {
  const doc = valid("fix-until-green");
  (doc.nodes[0] as AgentNode).brief = 'Fit a 27" screen; run node -e "if (!ok) { process.exit(1) }" in direction LR.';
  const suite = doc.nodes[1]!;
  if (suite.kind !== "check") throw new Error("the suite is a check");
  suite.check.run = 'grep -q "^ok" <in.txt --x="1"';
  const text = mermaidAgentflow(doc);
  const fixer = /\n  n_fixer@\{ (.*) \}\n/.exec(text)![1]!;
  assert.doesNotMatch(fixer.replace(/^role: "builder", model: "strong", instruction: "/, "").replace(/" *$/, ""), /["#%<]|direction/, "no character Mermaid acts on is left in the value");
  assert.match(fixer, /instruction: "Fit a 27\\u0022 screen; run node -e \\u0022if \(!ok\) \{ process\.exit\(1\) \}\\u0022 in \\u0064irection LR\."$/);
  assert.match(text, /run: "grep -q \\u0022\^ok\\u0022 \\u003Cin\.txt --x=\\u00221\\u0022"/);
});

test("mermaid agentflow: the goal goes to where the work starts, not to where a cap continues", () => {
  const text = mermaidAgentflow(valid("wrap-up-after-the-cap"));
  assert.match(text, /\n  goal --> t_fixer\n/);
  assert.doesNotMatch(text, /goal --> t_wrap/);
});

test("mermaid agentflow: two loops sharing a way back both keep their stops", () => {
  const doc = valid("fix-until-green");
  const [fixer, suite] = [doc.nodes[0]!.id, doc.nodes[1]!.id];
  const back = doc.loops[0]!.back[0]!;
  doc.loops.push({ id: "outer", name: "Outer", members: [fixer, suite], back: [back], stops: [{ kind: "budget", measure: "turns", limit: 40 }] });
  const text = mermaidAgentflow(doc);
  assert.match(text, /stops: max iterations: 5<br>budget: 20 minutes<br>budget: 40 turns" -->/);
});

test("mermaid: a label of only white space is a space, the word direction is broken, and a clipped emoji stays whole", () => {
  const doc = valid("fix-until-green");
  doc.nodes[0]!.name = "   ";
  doc.nodes[1]!.name = "Approve direction TB";
  doc.goal = "😀".repeat(70);
  (doc.nodes[0] as AgentNode).brief = "   ";
  const flow = mermaid(doc);
  assert.match(flow, /n_fixer\[" "\]/);
  assert.match(flow, /n_suite\{\{"Approve #100;irection TB"\}\}/);
  const agentflow = mermaidAgentflow(doc);
  assert.match(agentflow, /t_fixer\["fixer"\]/, "a task with no words takes the node's id");
  assert.match(agentflow, new RegExp(`goal\\["${"😀".repeat(59)}…"\\]`));
  assert.doesNotMatch(agentflow, /\uFFFD/);
});

test("mermaid agentflow: a name with direction LR or a < cannot break the header, and a d before irection cannot break an escape", () => {
  const doc = valid("review-loop");
  doc.name = "Set direction LR <b";
  const text = mermaidAgentflow(doc);
  assert.match(text.split("\n")[0]!, /^%% grooph mermaid --agentflow: Set #100;irection LR #lt;b \(review-loop@1\)/);
  (doc.nodes[0] as AgentNode).brief = "\u001direction LR, and \ud83direction TB";
  const brief = /n_builder@\{ .*instruction: "([^"]*)"/.exec(mermaidAgentflow(doc))![1]!;
  // JSON's own escape in capitals: "\u001D" and then "irection" spells "Direction", which Mermaid does not take for a direction.
  assert.equal(brief, "\\u001Direction LR, and \\uD83Direction TB");
  assert.doesNotMatch(brief, /direction/);
  assert.equal(JSON.parse(`"${brief}"`), (doc.nodes[0] as AgentNode).brief, "JSON, and so YAML, reads it back exactly");
});


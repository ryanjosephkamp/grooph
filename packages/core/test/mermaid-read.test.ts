/**
 * Mermaid read into a graph document (`mermaid-read.ts`): every pattern's and valid graph's export read back, the
 * shapes and an agentflow's parts as kinds, what is guessed and said, what is refused, and the same nodes and edges
 * as Pele finds, a second reader of Mermaid.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { parse } from "pele";

import { indexGraph } from "../src/graph-index.js";
import { GRAPH_LIMITS } from "../src/limits.js";
import { mermaid } from "../src/mermaid.js";
import { mermaidAgentflow } from "../src/mermaid-agentflow.js";
import { isMermaidText, readMermaid, readMermaidSyntax, readStop } from "../src/mermaid-read.js";
import { parseGraph, parseGraphText } from "../src/parse.js";
import { describeStop, isCriticFamily, isPersonStep, isWriterFamily, loopMode } from "../src/semantics.js";
import type { AgentNode, Graph, Stop } from "../src/types.js";
import { validate } from "../src/validate.js";
import { fixturesDir, listFiles, read, repoRoot } from "./helpers.js";

const graphs: [string, Graph][] = [
  ...listFiles(join(repoRoot, "patterns")).map((f) => [`patterns/${f}`, join(repoRoot, "patterns", f)] as const),
  ...listFiles(join(fixturesDir, "valid")).map((f) => [`fixtures/valid/${f}`, join(fixturesDir, "valid", f)] as const),
].map(([name, path]) => [name, parseGraphText(read(path)).doc!]);

const ok = (text: string, name?: string): { doc: Graph; guesses: string[] } => {
  const r = readMermaid(text, name ? { name } : {});
  if (!r.ok) throw new Error(`refused: ${r.error} (line ${r.line})`);
  return r;
};

/** What a round trip keeps: each node's id, kind, name and family; each edge's ends and condition; each loop. */
function kept(doc: Graph, form: "flowchart" | "agentflow") {
  const edge = new Map(doc.edges.map((e) => [e.id, e]));
  const index = indexGraph(doc);
  const family = (n: Graph["nodes"][number]): string =>
    n.kind !== "agent" ? n.kind : `${isPersonStep(n) ? "person " : ""}${isCriticFamily(n) ? "critic" : isWriterFamily(n) ? "writer" : "other"}`;
  return {
    nodes: doc.nodes
      .map((n) => [n.id, n.kind, n.name || n.id, family(n), ...(form === "agentflow" && n.kind === "agent" ? [n.role, n.model?.tier, n.brief] : [])])
      .map((x) => JSON.stringify(x))
      .sort(),
    edges: doc.edges.map((e) => `${e.from}>${e.to} ${JSON.stringify(e.when ?? "always")}${e.approval ? " approval" : ""}`).sort(),
    loops: doc.loops
      .map((l) => ({
        ...(form === "flowchart" ? { id: l.id, name: l.name, mode: loopMode(index, l) } : {}),
        members: [...l.members].sort(),
        back: l.back.map((b) => `${edge.get(b)!.from}>${edge.get(b)!.to}`).sort(),
        stops: l.stops,
      }))
      .map((x) => JSON.stringify(x))
      .sort(),
  };
}

test("every graph's flowchart reads back as its nodes, edges and loops, with each loop's name, mode and stops", () => {
  assert.ok(graphs.length >= 30);
  for (const [name, doc] of graphs) {
    const back = ok(mermaid(doc)).doc;
    assert.deepEqual(kept(back, "flowchart"), kept(doc, "flowchart"), name);
    assert.equal(back.id, doc.id, `${name}: the header gives back the id`);
    assert.equal(back.name, doc.name || doc.id, `${name}: and the name`);
    assert.deepEqual(validate(back).filter((i) => i.severity === "error"), [], `${name}: no errors`);
  }
});

test("every graph's agentflow reads back as its nodes (with their roles, tiers and briefs), edges and goal; nested loops come back as one", () => {
  for (const [name, doc] of graphs) {
    const back = ok(mermaidAgentflow(doc)).doc;
    const want = kept(doc, "agentflow");
    const got = kept(back, "agentflow");
    assert.deepEqual(got.nodes, want.nodes, `${name}: nodes`);
    assert.deepEqual(got.edges, want.edges, `${name}: edges`);
    assert.equal(back.goal, doc.goal?.trim() ? doc.goal : undefined, `${name}: goal`);
    // An agentflow has no box for a loop, so a loop inside another comes back inside it: one loop with all their stops.
    const nested = doc.loops.some((a) => doc.loops.some((b) => a !== b && a.members.every((m) => b.members.includes(m))));
    if (!nested) assert.deepEqual(got.loops, want.loops, `${name}: loops`);
    else {
      const stops = (d: Graph): string[] => d.loops.flatMap((l) => l.stops.map((s) => JSON.stringify(s))).sort();
      assert.deepEqual(stops(back), stops(doc), `${name}: every stop`);
      assert.deepEqual([...new Set(back.loops.flatMap((l) => l.members))].sort(), [...new Set(doc.loops.flatMap((l) => l.members))].sort(), `${name}: every member`);
    }
    assert.deepEqual(validate(back).filter((i) => i.severity === "error"), [], `${name}: no errors`);
  }
});

test("a flowchart's shapes are kinds: diamond a critic, hexagon a check, trapezoid a gate, circles a merge and a stop, the rest agents", () => {
  const { doc } = ok(`flowchart LR
  a[Box] --> b(Round) --> c([Stadium]) --> d{Diamond} --> e{{Hexagon}} --> f[/Trapezoid\\] --> g((Circle)) --> h(((Stop)))
  i[[Sub]] & j[(Store)] --> k>Flag]
  l@{ shape: diamond, label: "Named diamond" } --> m@{ shape: hex }`);
  const kinds = Object.fromEntries(doc.nodes.map((n) => [n.id, n.kind === "agent" ? `agent ${typeof n.role === "string" ? n.role : n.role.custom}` : n.kind]));
  assert.deepEqual(kinds, {
    a: "agent builder", b: "agent builder", c: "agent researcher", d: "agent critic", e: "check", f: "human-gate", g: "merge", h: "stop",
    i: "agent builder", j: "agent builder", k: "agent builder", l: "agent critic", m: "check",
  });
  assert.equal(doc.nodes.find((n) => n.id === "l")!.name, "Named diamond");
  assert.equal(doc.edges.length, 10, "a chain and an & make every edge");
});

test("an agentflow's flow is an agent with its model and instruction, an action a person's step, a decision a check, an input the goal", () => {
  const { doc, guesses } = ok(`agentflow-beta TB
  brief["Release brief"]@{ shape: input }
  flow writer["Drafting Agent"]
    draft["Draft the notes"]@{ shape: task }
    lookup["changelog_search"]@{ shape: tool }
    guide["Tone of voice"]@{ shape: refdoc }
    draft --> lookup
    draft -.- guide
  end
  writer@{ model: "strong", instruction: "Write the release notes." }
  ok["Accurate?"]@{ shape: decision }
  publish["Publish"]@{ shape: action }
  brief --> writer
  writer --> ok
  ok -- pass --> publish
  ok -- fail --> writer`);
  assert.equal(doc.goal, "Release brief");
  const writer = doc.nodes.find((n) => n.id === "writer")!;
  assert.equal(writer.kind, "agent");
  if (writer.kind === "agent") {
    assert.equal(writer.name, "Drafting Agent");
    assert.deepEqual(writer.model, { tier: "strong" });
    assert.equal(writer.brief, "Write the release notes.");
  }
  assert.equal(doc.nodes.find((n) => n.id === "ok")!.kind, "check");
  const publish = doc.nodes.find((n) => n.id === "publish")!;
  assert.ok(publish.kind === "agent" && publish.by === "person");
  assert.deepEqual(doc.nodes.map((n) => n.id).sort(), ["ok", "publish", "writer"], "the steps inside a flow are its agent's; reference material is left out");
  assert.deepEqual(doc.loops.map((l) => l.members), [["writer", "ok"]]);
  assert.ok(guesses.includes("Drafting Agent: its 2 steps are one agent"));
  assert.ok(guesses.includes("Tone of voice: reference material, not a step, so it was left out"));
  assert.ok(guesses.includes("1 reference line (-.-) left out: a reference is not a step"));
});

test("a sketch's cycle is a loop with no stops, it validates, and the guesses say so one line each", () => {
  const { doc, guesses } = ok("flowchart LR\n  A[Draft] --> B{Review}\n  B -->|fail| A\n  B -->|pass| C(((Done)))", "Sketch");
  assert.equal(doc.name, "Sketch");
  assert.deepEqual(doc.loops, [{ id: "a-loop", name: "Draft loop", members: ["a", "b"], back: ["b-to-a"], stops: [] }]);
  assert.deepEqual(validate(doc).filter((i) => i.severity === "error"), []);
  assert.ok(validate(doc, { loops: "advice" }).some((i) => i.code === "E_CYCLE_NO_STOP" && i.severity === "warning"));
  assert.deepEqual(guesses, [
    "Draft: a box, so an agent with the builder role; its brief and its outputs are left to fill in",
    "Review: a diamond, so an agent with the critic role; its brief and its outputs are left to fill in",
    "Draft loop: the cycle through Draft, Review, so a loop with no stops; grooph validate --loops says what it lacks",
  ]);
});

test("a subgraph with no loop in it is a group, an edge to a box is left out, and styles are read and left out", () => {
  const { doc, guesses } = ok(`---
title: Two services
---
flowchart LR
  subgraph Client
    UI[Web app] --> Cache[(Local cache)]
  end
  subgraph services [Services]
    API[API gateway] --> Auth[Auth service]
  end
  UI --> API
  Cache --> services
  classDef hot fill:#f96
  style UI stroke:#333
  click UI "https://example.com"`);
  assert.equal(doc.name, "Two services");
  assert.deepEqual(doc.groups, [
    { id: "client", name: "Client", members: ["ui", "cache"] },
    { id: "services", name: "Services", members: ["api", "auth"] },
  ]);
  assert.equal(doc.edges.length, 3);
  assert.ok(guesses.includes('An edge to the box "services" was left out: an edge in grooph joins two steps'));
  assert.ok(guesses.includes("1 classDef line left out: grooph draws in its own style"));
  assert.ok(guesses.includes("1 click line left out: grooph draws in its own style"));
});

test("anything else is refused with what was met and what is read, and a refusal is never a throw", () => {
  const refused = (text: string): string => {
    const r = readMermaid(text);
    assert.equal(r.ok, false, text);
    return r.ok ? "" : `${r.error}${r.line !== undefined ? ` @${r.line}` : ""}`;
  };
  assert.match(refused("sequenceDiagram\n  A->>B: hi"), /^this is not a diagram grooph reads: it starts with "sequenceDiagram"\. grooph reads flowchart, graph and agentflow-beta text: .* @1$/);
  assert.match(refused("flowchart LR\n  A[open --> B"), /a node's brackets that do not close: \[open --> B @2/);
  assert.match(refused("flowchart LR\n  end"), /an "end" with nothing open @2/);
  assert.match(refused("flowchart LR\n  A ==> B ?? C"), /something it cannot read after "B": \?\? C @2/);
  assert.match(refused("%% only a comment"), /no diagram/);
  assert.match(refused("flowchart LR\n  A@{ shape: diamond"), /does not close/);
  assert.equal(isMermaidText("sequenceDiagram\n A->>B: x"), true);
  assert.equal(isMermaidText('{"grooph": 0}'), false);
  assert.equal(isMermaidText("Some notes.\n```mermaid\nflowchart LR\nA-->B\n```"), true);
});

test("metadata's prototype-shaped keys are dropped, and a value is read as YAML's double-quoted string", () => {
  const { doc } = ok('agentflow-beta TB\n  flow w["W"]\n    t["x"]\n  end\n  w@{ __proto__: "x", constructor: "y", instruction: "a \\u0022quoted\\u0022 \\\\ line\\nnext", model: "nope" }');
  const w = doc.nodes[0]!;
  assert.ok(w.kind === "agent");
  if (w.kind === "agent") {
    assert.equal(w.brief, 'a "quoted" \\ line\nnext');
    assert.equal(w.model, undefined, "a model that is not a tier is left out");
  }
  assert.equal(({} as Record<string, unknown>)["x"], undefined);
});

test("every stop's words read back as the stop, and grooph's earlier export, a note per stop, still reads", () => {
  const stops: Stop[] = [
    { kind: "bar-passed" },
    { kind: "human" },
    { kind: "human", every: 2, then: "wrap" },
    { kind: "budget", measure: "usd", limit: 2.5 },
    { kind: "diminishing-returns", rounds: 2, metric: "open findings", threshold: 0.5 },
    { kind: "evidence-invalid", rounds: 3 },
    { kind: "max-iterations", n: 4, then: "land" },
  ];
  for (const stop of stops) assert.deepEqual(readStop(`${describeStop(stop)}${stop.then ? ` → ${stop.then}` : ""}`), stop);
  const { doc } = ok(`%% grooph mermaid: a projection of Old (old@2). One way only: it does not round-trip.
flowchart LR
  subgraph n_fix["Fix · grind loop"]
    n_a["A"]
    n_t{{"Tests"}}
    n_fix_stop_1>"stop: max iterations: 5"]:::stop
    n_fix_stop_2>"stop: budget: 20 minutes"]:::stop
  end
  n_a --> n_t
  n_t -.->|"fail"| n_a`);
  assert.equal(doc.version, 2);
  assert.deepEqual(doc.loops[0]!.stops, [{ kind: "max-iterations", n: 5 }, { kind: "budget", measure: "minutes", limit: 20 }]);
});

test("the reader finds the same nodes and edges as Pele in every graph's flowchart and agentflow", () => {
  for (const [name, doc] of graphs) {
    for (const text of [mermaid(doc), mermaidAgentflow(doc)]) {
      same(text, name);
    }
  }
});

/**
 * Pele's own samples, from its repository's `tests/corpus/` (114 flowcharts and 12 agentflows at Pele 1.12.0). They
 * are read where they are, never copied here: set GROOPH_PELE_CORPUS to that folder in a checkout of Pele.
 */
const corpus = process.env["GROOPH_PELE_CORPUS"];
test("the reader finds the same nodes and edges as Pele in Pele's own flowchart and agentflow samples", { skip: corpus === undefined ? "GROOPH_PELE_CORPUS is not set" : false }, () => {
  let read = 0;
  for (const kind of ["flowchart", "agentflow"]) {
    const file = join(corpus!, `${kind}-docs.json`);
    assert.ok(existsSync(file), file);
    for (const [i, text] of (JSON.parse(readFileSync(file, "utf8")) as string[]).entries()) {
      same(text, `${kind} sample ${i}`);
      assert.ok(readMermaid(text).ok, `${kind} sample ${i} makes a document`);
      read++;
    }
  }
  assert.ok(read >= 126, `${read} samples`);
  // The agentflow reference: Pele's edge cases. What the reader reads, it reads as Pele does; what it refuses, it says.
  const reference = JSON.parse(readFileSync(join(corpus!, "agentflow-reference.json"), "utf8")) as { src: string }[];
  let matched = 0;
  for (const [i, { src }] of reference.entries()) {
    try {
      parse(src);
    } catch {
      continue;
    }
    const ours = readMermaidSyntax(src);
    if (!ours.ok) {
      assert.match(ours.error, /\S/, `reference sample ${i}`);
      continue;
    }
    same(src, `reference sample ${i}`);
    matched++;
  }
  assert.ok(matched >= 165, `${matched} reference samples read as Pele reads them`);
});

function same(text: string, name: string): void {
  const pele = parse(text) as unknown as { nodes: Map<string, unknown>; edges: { start: string; end: string }[]; subgraphs?: { id: string }[]; connectors?: Map<string, unknown> };
  const ours = readMermaidSyntax(text);
  assert.ok(ours.ok, `${name}: ${ours.ok ? "" : ours.error}`);
  if (!ours.ok) return;
  // A box, and an agentflow's connector, which grooph leaves out as not a step, are not nodes; an edge's ends are.
  const boxes = new Set([...(pele.subgraphs ?? []).map((s) => s.id), ...(pele.connectors instanceof Map ? pele.connectors.keys() : [])]);
  const nodes = (ids: Iterable<string>, edges: [string, string][]): string[] => [...new Set([...ids, ...edges.flat()])].filter((id) => !boxes.has(id)).sort();
  assert.deepEqual(nodes(ours.nodes, ours.edges.map((e) => [e.from, e.to])), nodes(pele.nodes.keys(), pele.edges.map((e) => [e.start, e.end])), `${name}: nodes`);
  assert.deepEqual(ours.edges.map((e) => `${e.from}>${e.to}`).sort(), pele.edges.map((e) => `${e.start}>${e.end}`).sort(), `${name}: edges`);
}

// ─── what an independent read found ───────────────────────────────────────

const ms = (run: () => unknown): number => {
  const began = performance.now();
  run();
  return performance.now() - began;
};

test("long runs of spaces in an arrow, a quote that never closes, deep boxes and a flood of & are refused or read at once", () => {
  for (const text of [`flowchart LR\n  A --${" ".repeat(20_000)}x`, `flowchart LR\n  A -.${"\t".repeat(20_000)}x`, `flowchart LR\n  A ==${" ".repeat(20_000)}x`]) {
    assert.ok(ms(() => assert.equal(readMermaid(text).ok, false)) < 500, "an arrow's label is looked for in a bounded way");
  }
  const unclosed = `flowchart LR\n  A["open\n${"x --> y\n".repeat(30_000)}`;
  assert.ok(ms(() => assert.match((readMermaid(unclosed) as { error: string }).error, /does not close within 100 lines/)) < 1000);
  const deep = `flowchart LR\n${"subgraph s\n".repeat(150)}a\n${"end\n".repeat(150)}`;
  assert.match((readMermaid(deep) as { error: string }).error, /nested more than 100 deep/);
  const flood = `flowchart LR\n  ${Array.from({ length: 1000 }, (_, i) => `N${i}`).join(" & ")} --> ${Array.from({ length: 1000 }, (_, i) => `M${i}`).join(" & ")}`;
  assert.ok(ms(() => assert.match((readMermaid(flood) as { error: string }).error, /more than 20,000 edges/)) < 1000);
  const chain = (n: number): string => `flowchart LR\n${Array.from({ length: n }, (_, i) => `  N${i} --> N${i + 1}`).join("\n")}\n  N${n} --> N0`;
  assert.ok(ms(() => assert.equal(readMermaid(chain(GRAPH_LIMITS.nodes - 1)).ok, true)) < 1000, "a chain at the caps with one cycle is read at once");
  assert.ok(ms(() => assert.match((readMermaid(chain(4_000)) as { error: string }).error, /^a diagram too large to open: 4,001 nodes/)) < 1000, "and one far over them is refused at once");
  assert.match((readMermaid("flowchart LR\n" + "x".repeat(1_000_001)) as { error: string }).error, /grooph reads Mermaid of up to 1,000,000/);
});

test("a lean shape and a trapezoid on one line each close at their own bracket", () => {
  const { doc } = ok("flowchart LR\n  A[/path/to/input/] --> B[/Approve release\\]\n  C[\\x\\] --> D[\\y/]");
  const kinds = Object.fromEntries(doc.nodes.map((n) => [n.id, `${n.kind} ${n.name}`]));
  assert.deepEqual(kinds, { a: "agent path/to/input", b: "human-gate Approve release", c: "agent x", d: "agent y" });
  assert.deepEqual(doc.edges.map((e) => `${e.from}>${e.to}`), ["a>b", "c>d"]);
});

test("a verdict with a comma keeps its condition and its approval, both ways", () => {
  const doc = parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!;
  const edge = doc.edges.find((e) => e.when === "pass")!;
  edge.when = { verdict: "minor, ship it" };
  edge.approval = true;
  for (const text of [mermaid(doc), mermaidAgentflow(doc)]) {
    const back = ok(text).doc.edges.find((e) => e.from === edge.from && e.to === edge.to)!;
    assert.deepEqual([back.when, back.approval, back.label], [{ verdict: "minor, ship it" }, true, undefined]);
  }
});

test("the one-line form, and names that are Mermaid's words, read as Pele reads them", () => {
  assert.deepEqual(ok("graph TD; A-->B; B-->C").doc.edges.map((e) => `${e.from}>${e.to}`), ["a>b", "b>c"]);
  assert.deepEqual(ok("flowchart TD;A-->B").doc.nodes.map((n) => n.id), ["a", "b"]);
  for (const word of ["flow", "pie", "gantt", "journey", "mindmap", "direction", "subgraph"]) {
    assert.equal(ok(`flowchart LR\n  ${word} --> B`).doc.edges.length, 1, word);
  }
  const forms = ok("flowchart LR\n  A --text--> B\n  C --xD\n  E -->|a;b| F\n  a.b --> k\n  G ~~~ H\n  G --x H\n  G --x H").doc;
  assert.deepEqual(forms.edges.map((e) => `${e.from}>${e.to}${e.label ? ` "${e.label}"` : ""}`), ['a>b "text"', "c>d", 'e>f "a;b"', "a-b>k", "g>h"]);
});

test("entities are read once: a name that says #quot; keeps it, and none becomes a property of Object", () => {
  const doc = parseGraphText(read(join(fixturesDir, "valid", "fix-until-green.grooph.json"))).doc!;
  doc.nodes[0]!.name = "Say #quot;hi#quot; #lt;b#gt;";
  doc.nodes[1]!.name = "#nbsp; #constructor; #toString;";
  const back = ok(mermaid(doc)).doc;
  assert.equal(back.nodes.find((n) => n.id === doc.nodes[0]!.id)!.name, "Say #quot;hi#quot; #lt;b#gt;");
  assert.equal(back.nodes.find((n) => n.id === doc.nodes[1]!.id)!.name, "#nbsp; #constructor; #toString;");
});

test("metadata reads every YAML escape JSON writes, a block scalar, and a flow's metadata after its name", () => {
  const brief = "line1\r\nline2\b\f\u0000 end";
  const doc = parseGraphText(read(join(fixturesDir, "valid", "fix-until-green.grooph.json"))).doc!;
  (doc.nodes[0] as AgentNode).brief = brief;
  assert.equal((ok(mermaidAgentflow(doc)).doc.nodes.find((n) => n.id === "fixer") as AgentNode).brief, brief);
  const block = ok('agentflow-beta TB\n  flow w["W"]@{ model: "fast" }\n    t["x"]\n  end\n  w@{\n    instruction: |\n      First line.\n      Second line.\n    role: critic\n  }').doc.nodes[0] as AgentNode;
  assert.deepEqual([block.brief, block.role, block.model], ["First line.\nSecond line.", "critic", { tier: "fast" }]);
});

test("a stop of zero rounds is left out and said, so what is read always meets the schema", () => {
  const { doc, guesses } = ok('%% grooph mermaid: a projection of Z (z@1).\nflowchart LR\n  subgraph n_fix["Fix · grind loop"]\n    n_a["A"]\n    n_t{{"T"}}\n    stops_fix["stops<br>max iterations: 0<br>budget: 0 minutes<br>max iterations: 3"]:::stop\n  end\n  n_a --> n_t\n  n_t -.->|"fail"| n_a');
  // A budget of 0 is the schema's least and stays; a round count of 0 is none, and goes, said.
  assert.deepEqual(doc.loops[0]!.stops, [{ kind: "budget", measure: "minutes", limit: 0 }, { kind: "max-iterations", n: 3 }]);
  assert.ok(guesses.includes('A stop it could not read was left out: "max iterations: 0"'));
  assert.deepEqual(parseGraph(doc).issues, []);
});

test("in someone else's flowchart a dotted edge is only a style, and class lines make no node", () => {
  const { doc } = ok("flowchart LR\n  Start --> Draft\n  Draft -.-> Review\n  Review -->|fail| Draft\n  Review -->|pass| Done\n  class C hot\n  class Draft hot");
  assert.deepEqual(doc.loops[0]!.back.map((id) => doc.edges.find((e) => e.id === id)!).map((e) => `${e.from}>${e.to}`), ["review>draft"]);
  assert.deepEqual(doc.nodes.map((n) => n.id), ["start", "draft", "review", "done"]);
});

test("what is guessed is said: a cross at an edge's head, an edge said twice, and an invisible link", () => {
  const { guesses } = ok("flowchart LR\n  A --x B\n  A --> C\n  A --> C\n  B ~~~ C", "x");
  for (const line of ["1 edge with a cross at its head (--x), so on fail", "1 edge said twice, kept once", "1 invisible link (~~~) left out: they only place nodes"]) assert.ok(guesses.includes(line), line);
});

test("a loop whose id looks like an edge's keeps it, and prose that starts with graph is not Mermaid", () => {
  const { doc } = ok('%% grooph mermaid: a projection of L (l@1).\nflowchart LR\n  subgraph n_a_to_b["L · judgment loop"]\n    n_a["A"]\n    n_b{"B"}\n  end\n  n_a --> n_b\n  n_b -.->|"fail"| n_a');
  assert.equal(doc.loops[0]!.id, "a-to-b");
  for (const text of ["graph of costs per month", "info about the meeting", "timeline for launch", "flowchart for onboarding"]) assert.equal(isMermaidText(text), false, text);
  for (const text of ["graph TD", "graph TD; A-->B", "flowchart", "sequenceDiagram", "pie title Pets"]) assert.equal(isMermaidText(text), true, text);
});


test("from the second read: long arrows, a lone pipe, a zero budget, a class-marked note, an edge's early metadata, and many same-named edges", () => {
  // An arrow longer than twenty is the arrow, not part of the label before it.
  const long = ok(`flowchart LR\n  B -- fail ${"-".repeat(25)}> A\n  A -- t ${"-".repeat(30)} B`).doc;
  assert.deepEqual(long.edges.map((e) => `${e.from}>${e.to} ${JSON.stringify(e.when ?? "always")} ${e.label ?? ""}`), ['b>a "fail" ', 'a>b "always" t']);
  // A pipe inside a middle label is a character, and a later `;` still ends the statement.
  assert.deepEqual(ok("flowchart LR\n  A -- a|b --> C; D --> E").doc.edges.map((e) => `${e.from}>${e.to}`), ["a>c", "d>e"]);
  // A budget of 0 is the schema's least, and reads back.
  const doc = parseGraphText(read(join(fixturesDir, "valid", "fix-until-green.grooph.json"))).doc!;
  doc.loops[0]!.stops.push({ kind: "budget", measure: "usd", limit: 0 });
  for (const text of [mermaid(doc), mermaidAgentflow(doc)]) assert.deepEqual(ok(text).doc.loops[0]!.stops.at(-1), { kind: "budget", measure: "usd", limit: 0 });
  // A stops note marked by a class line is a note.
  const marked = ok('%% grooph mermaid: a projection of M (m@1).\nflowchart LR\n  subgraph n_l["L · grind loop"]\n    n_a["A"]\n    n_t{{"T"}}\n    note1["stops<br>max iterations: 3"]\n  end\n  class note1 stop\n  n_a --> n_t\n  n_t -.->|"fail"| n_a').doc;
  assert.deepEqual(marked.loops[0]!.stops, [{ kind: "max-iterations", n: 3 }]);
  // An edge's metadata given before its edge is not one of a flow's steps.
  const { doc: flowDoc, guesses } = ok('agentflow-beta TB\n  flow w["Writer"]\n    e1@{ animate: true }\n    d["Draft it"]\n    d e1@--> s["Spell"]\n  end');
  assert.equal((flowDoc.nodes[0] as AgentNode).brief, "Draft it");
  assert.ok(guesses.includes("Writer: its 2 steps are one agent"), guesses.join(" | "));
  // Many edges between the same two nodes are named in linear time.
  const many = (n: number): string => `flowchart LR\n${Array.from({ length: n }, (_, i) => `  A -->|l${i}| B`).join("\n")}`;
  assert.ok(ms(() => assert.equal(readMermaid(many(GRAPH_LIMITS.edges)).ok, true)) < 1500, "at the caps");
  assert.ok(ms(() => assert.match((readMermaid(many(10_000)) as { error: string }).error, /^a diagram too large to open: 10,000 edges/)) < 1500, "far over them");
});

test("other kinds of Mermaid with their arguments are known as Mermaid, so the refusal names them", () => {
  for (const text of ["swimlane-beta LR", "timeline TD", "info showInfo", "railroad-ebnf-beta", "gitGraph:", "gitGraph TB:"]) assert.equal(isMermaidText(text), true, text);
});

test("a shape grooph has no kind for is named in plain words in its guess, however Mermaid writes it", () => {
  const { guesses } = ok(
    [
      "flowchart TD",
      "  A[/In/]",
      "  B[\\Out\\]",
      "  C[\\Wide top/]",
      '  D@{ shape: tri, label: "Up" }',
      '  E@{ shape: flip-tri, label: "Down" }',
      '  F@{ shape: sm-circ, label: "Dot" }',
      '  G@{ shape: notch-pent, label: "Odd" }',
      "  H[Plain]",
      '  I@{ shape: process, label: "Proc" }',
      '  J@{ shape: database, label: "Store" }',
      '  K@{ shape: f-circ, label: "Join" }',
      "  A --> B --> C --> D --> E --> F --> G --> H --> I --> J --> K",
    ].join("\n"),
  );
  assert.deepEqual(
    guesses.filter((g) => g.includes("so an agent")).map((g) => g.slice(0, g.indexOf(", so"))),
    ["In: a parallelogram", "Out: a parallelogram", "Wide top: a trapezoid wide at the top", "Up: a triangle", "Down: an upside-down triangle", "Dot: a small circle", 'Odd: a shape Mermaid calls "notch-pent"', "Plain: a box", "Proc: a box", "Store: a cylinder", "Join: a small filled circle"],
  );
});

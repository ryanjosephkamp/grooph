/**
 * The Mermaid text read by a second reader: Pele (https://pele.run), a Mermaid renderer tested against Mermaid's own
 * parser specs. Every pattern's and every valid graph's flowchart and agentflow parse with its `parse()`, and what it
 * finds is what grooph wrote: each node, each edge, each loop's box, each agent's flow and its metadata. Pele is a
 * development dependency of core and nothing of it ships.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { parse } from "pele";

import { mermaid } from "../src/mermaid.js";
import { mermaidAgentflow } from "../src/mermaid-agentflow.js";
import { parseGraphText } from "../src/parse.js";
import { indexGraph } from "../src/graph-index.js";
import { entryNodeIds, isPersonStep } from "../src/semantics.js";
import type { Graph } from "../src/types.js";
import { fixturesDir, listFiles, read, repoRoot } from "./helpers.js";

/** What these tests read of Pele's model: its nodes, its edges, and its boxes (a flowchart's subgraphs, an agentflow's flows). */
type Model = {
  type: string;
  nodes: Map<string, { id: string; text?: string; metadata?: Record<string, unknown> }>;
  edges: { start: string; end: string; text?: string }[];
  subgraphs: { id: string; type?: string; nodes: string[]; title?: string; metadata?: Record<string, unknown> }[];
};
const read2 = (text: string): Model => parse(text) as unknown as Model;

const graphs: [string, Graph][] = [
  ...listFiles(join(repoRoot, "patterns")).map((f) => [`patterns/${f}`, join(repoRoot, "patterns", f)] as const),
  ...listFiles(join(fixturesDir, "valid")).map((f) => [`fixtures/valid/${f}`, join(fixturesDir, "valid", f)] as const),
].map(([name, path]) => {
  const parsed = parseGraphText(read(path));
  assert.ok(parsed.doc, `${name} parses`);
  return [name, parsed.doc];
});

const mid = (id: string): string => `n_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;

test("Pele reads every graph's flowchart: every node, a stops note per loop with stops, every edge, and a box per loop", () => {
  assert.ok(graphs.length >= 30, "the patterns and the valid graphs");
  for (const [name, doc] of graphs) {
    const model = read2(mermaid(doc));
    assert.equal(model.type, "flowchart", name);
    const boxes = new Set(model.subgraphs.map((s) => s.id));
    const vertices = [...model.nodes.keys()].filter((id) => !boxes.has(id)).sort();
    const notes = doc.loops.filter((l) => l.stops.length > 0).map((l) => `stops_${l.id.replace(/[^A-Za-z0-9_]/g, "_")}`);
    assert.deepEqual(vertices, [...doc.nodes.map((n) => mid(n.id)), ...notes].sort(), `${name}: nodes`);
    const edges = model.edges.map((e) => `${e.start}>${e.end}`).sort();
    assert.deepEqual(edges, doc.edges.map((e) => `${mid(e.from)}>${mid(e.to)}`).sort(), `${name}: edges`);
    assert.deepEqual([...boxes].sort(), doc.loops.map((l) => mid(l.id)).sort(), `${name}: a box per loop`);
  }
});

test("Pele reads every graph's agentflow: a flow per agent with its metadata, the gates and checks, and every edge", () => {
  for (const [name, doc] of graphs) {
    const model = read2(mermaidAgentflow(doc));
    assert.equal(model.type, "agentflow", name);
    const agents = doc.nodes.filter((n) => n.kind === "agent" && !isPersonStep(n));
    const flows = model.subgraphs.filter((s) => s.type === "flow");
    assert.deepEqual(flows.map((f) => f.id).sort(), agents.map((a) => mid(a.id)).sort(), `${name}: a flow per agent`);
    for (const agent of agents) {
      if (agent.kind !== "agent") continue;
      const flow = flows.find((f) => f.id === mid(agent.id))!;
      assert.deepEqual(flow.nodes, [`t_${mid(agent.id).slice(2)}`], `${name}: ${agent.id}'s flow holds its task`);
      assert.equal(flow.metadata?.["instruction"], agent.brief, `${name}: ${agent.id}'s brief comes back whole`);
      if (agent.model) assert.equal(flow.metadata?.["model"], agent.model.tier, `${name}: ${agent.id}'s tier`);
    }
    for (const node of doc.nodes.filter((n) => n.kind === "human-gate" || n.kind === "check")) {
      const shape = model.nodes.get(mid(node.id))?.metadata?.["shape"];
      assert.equal(shape, node.kind === "check" ? "diamond" : "hexagon", `${name}: ${node.id} as a ${node.kind === "check" ? "decision" : "action"}`);
    }
    const end = (id: string): string => (agents.some((a) => a.id === id) ? `t_${mid(id).slice(2)}` : mid(id));
    const starts = entryNodeIds(indexGraph(doc));
    const goal = doc.goal?.trim() ? (starts.length > 0 ? starts : [doc.nodes[0]!.id]).map((id) => `goal>${end(id)}`) : [];
    assert.deepEqual(model.edges.map((e) => `${e.start}>${e.end}`).sort(), [...goal, ...doc.edges.map((e) => `${end(e.from)}>${end(e.to)}`)].sort(), `${name}: edges`);
  }
});

test("Pele reads the stops on a loop's way back, and hostile words in a brief come back as written", () => {
  const doc = graphs.find(([name]) => name === "patterns/review-gate.grooph.json")![1];
  const copy: Graph = JSON.parse(JSON.stringify(doc));
  const builder = copy.nodes.find((n) => n.id === "builder")!;
  if (builder.kind !== "agent") throw new Error("the review gate's builder is an agent");
  builder.brief = 'Line one.\nThen %%{init: {"flowchart": {}}}%% and #quot;x#quot; "y" \\ key: value, - item & {a: b}';
  const model = read2(mermaidAgentflow(copy));
  assert.equal(model.subgraphs.find((s) => s.id === "n_builder")!.metadata?.["instruction"], builder.brief);
  const back = model.edges.find((e) => e.start === "t_critic" && e.end === "t_builder")!;
  assert.equal(back.text, "fail<br>stops: bar passed<br>max iterations: 4<br>budget: 10 dispatches");
});

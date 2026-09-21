/**
 * A Mermaid projection of a graph (slice 0015; spec §6 allows a Mermaid-like
 * view). One way only: Mermaid has no loops, stops, bars or brakes, so the
 * text cannot be read back into a document, and the header says so. Edits
 * happen in the document; this is a picture of it.
 *
 *   flowchart LR
 *     subgraph per loop (nested when one loop's members sit inside another's)
 *     node labels, shaped by kind and role family as the glyph shapes them
 *     edge labels from `when` and `approval`; a loop's back edges dotted
 *     one styled note per stop, inside its loop's subgraph
 */

import { indexGraph } from "./graph-index.js";
import { describeStop, isCriticFamily, isWriterFamily, loopMode } from "./semantics.js";
import type { Edge, Graph, Id, Loop, Node } from "./types.js";

/** Mermaid ids are safest as letters, digits and underscores; a hyphen can read as an arrow. */
const mid = (id: Id): string => `n_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;

/** A label inside `"…"`: quotes become their entity, which Mermaid renders as the character. */
const label = (text: string): string => `"${text.replace(/"/g, "#quot;")}"`;

/** The node with its shape: the glyph vocabulary in Mermaid's flowchart brackets. */
function nodeLine(node: Node): string {
  const name = label(node.name || node.id);
  switch (node.kind) {
    case "agent":
      if (isCriticFamily(node)) return `${mid(node.id)}{${name}}`;
      if (isWriterFamily(node)) return `${mid(node.id)}[${name}]`;
      return `${mid(node.id)}([${name}])`;
    case "check":
      return `${mid(node.id)}{{${name}}}`;
    case "human-gate":
      return `${mid(node.id)}[/${name}\\]`;
    case "merge":
      return `${mid(node.id)}((${name}))`;
    case "stop":
      return `${mid(node.id)}(((${name})))`;
  }
}

function edgeLabel(edge: Edge): string {
  const when = edge.when ?? "always";
  const parts: string[] = [];
  if (when !== "always") parts.push(typeof when === "string" ? when : `verdict: ${when.verdict}`);
  if (edge.approval) parts.push("approval");
  return parts.join(", ");
}

function stopText(loop: Loop, index: number): string {
  const stop = loop.stops[index]!;
  return `stop: ${describeStop(stop)}${stop.then !== undefined ? ` → ${stop.then}` : ""}`;
}

/**
 * The Mermaid text for a graph. Nodes that belong to two loops neither of
 * which contains the other go in the first (document order), with a comment
 * naming the other, since Mermaid puts a node in one subgraph only.
 */
export function mermaid(doc: Graph): string {
  const nodes = new Map<Id, Node>(doc.nodes.map((n) => [n.id, n]));
  const index = indexGraph(doc);
  const loops = doc.loops.map((loop, i) => ({ loop, i, members: new Set(loop.members.filter((m) => nodes.has(m))) }));
  const encloses = (outer: (typeof loops)[number], inner: (typeof loops)[number]): boolean =>
    outer !== inner && inner.members.size > 0 && inner.members.size < outer.members.size && [...inner.members].every((m) => outer.members.has(m));
  // Each loop's parent: the smallest loop that encloses it.
  const parent = new Map<number, number>();
  for (const inner of loops) {
    const outers = loops.filter((outer) => encloses(outer, inner)).sort((a, b) => a.members.size - b.members.size);
    if (outers[0]) parent.set(inner.i, outers[0].i);
  }
  // Each node's home: the smallest loop holding it; ties (overlap without nesting) go to the first loop.
  const home = new Map<Id, number>();
  const shared: string[] = [];
  for (const node of doc.nodes) {
    const holders = loops.filter((l) => l.members.has(node.id)).sort((a, b) => a.members.size - b.members.size || a.i - b.i);
    if (holders.length === 0) continue;
    home.set(node.id, holders[0]!.i);
    for (const other of holders.slice(1)) {
      if (!encloses(other, holders[0]!)) shared.push(`%% ${node.id} is also a member of loop ${other.loop.id}`);
    }
  }

  const lines: string[] = [
    `%% grooph mermaid: a projection of ${doc.name || doc.id} (${doc.id}@${doc.version}). One way only: it does not round-trip.`,
    `%% Loops, stops, bars and brakes live in the graph document; edit that, not this.`,
    `flowchart LR`,
  ];
  const back = new Set(doc.loops.flatMap((l) => l.back));
  const emitLoop = (at: number, depth: number): void => {
    const { loop } = loops[at]!;
    const pad = "  ".repeat(depth);
    lines.push(`${pad}subgraph ${mid(loop.id)}[${label(`${loop.name || loop.id} · ${loopMode(index, loop)} loop`)}]`);
    for (const node of doc.nodes) if (home.get(node.id) === at) lines.push(`${pad}  ${nodeLine(node)}`);
    loop.stops.forEach((_, s) => lines.push(`${pad}  ${mid(`${loop.id}_stop_${s + 1}`)}>${label(stopText(loop, s))}]:::stop`));
    for (const child of loops) if (parent.get(child.i) === at) emitLoop(child.i, depth + 1);
    lines.push(`${pad}end`);
  };
  for (const l of loops) if (!parent.has(l.i)) emitLoop(l.i, 1);
  for (const node of doc.nodes) if (!home.has(node.id)) lines.push(`  ${nodeLine(node)}`);
  lines.push(...shared.map((line) => `  ${line}`));

  for (const edge of doc.edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) continue;
    const text = edgeLabel(edge);
    const arrow = `${back.has(edge.id) ? "-.->" : "-->"}${text === "" ? "" : `|${label(text)}|`}`;
    lines.push(`  ${mid(edge.from)} ${arrow} ${mid(edge.to)}`);
  }
  if (doc.loops.some((l) => l.stops.length > 0)) lines.push(`  classDef stop fill:none,stroke-dasharray:3 3,font-size:12px`);
  return `${lines.join("\n")}\n`;
}

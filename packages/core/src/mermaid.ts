/**
 * A Mermaid projection of a graph (spec §6 allows a Mermaid-like view). Mermaid has no loops, stops, bars or brakes;
 * a loop is drawn as a box with a note of its stops, so `grooph import` (`mermaid-read.ts`) reads back the nodes, the
 * edges, the loops and their stops, and the header says so. The rest lives only in the document.
 *
 *   flowchart LR
 *     subgraph per loop (nested when one loop's members sit inside another's)
 *     node labels, shaped by kind and role family as the glyph shapes them
 *     edge labels from `when` and `approval`; a loop's back edges dotted
 *     one styled note per loop, inside its subgraph, listing its stops one per line
 *
 * Mermaid's agentflow form is `mermaid-agentflow.ts`, beside this file, and uses its pieces.
 */

import { indexGraph } from "./graph-index.js";
import { describeStop, isCriticFamily, isPersonStep, isWriterFamily, loopMode } from "./semantics.js";
import type { Edge, Graph, Id, Loop, Node } from "./types.js";


/** Mermaid ids are safest as letters, digits and underscores; a hyphen can read as an arrow. */
export const mid = (id: Id): string => `n_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;

/**
 * Text for a label, as entities Mermaid renders as the characters. `#` goes first, so words shaped like an entity
 * stay words, and `&`, so an HTML entity does too. Then a backslash, which would start a line break; quotes and
 * angle brackets; a backtick, which would make the label Markdown; `%%`, which would start a directive Mermaid
 * strips; the word "direction", because Mermaid reads any line holding "direction LR" as a direction and drops
 * the rest; and a colon with no space after it, last, because Mermaid drops the final `;` of a line holding
 * `style` and then `:…#`, and every entity ends in one. A line break is a space.
 */
export const escape = (text: string): string =>
  text
    .replace(/[\r\n]+/g, " ")
    .replace(/#/g, "#35;")
    .replace(/&/g, "#38;")
    .replace(/\\/g, "#92;")
    .replace(/"/g, "#quot;")
    .replace(/</g, "#lt;")
    .replace(/>/g, "#gt;")
    .replace(/`/g, "#96;")
    .replace(/%%/g, "#37;#37;")
    .replace(/direction/g, "#100;irection")
    .replace(/:(?=\S)/g, "#58;");

/**
 * The graph's name in the header comment, escaped as a label is: on one line, with no `%%` to start a directive, no
 * `<` to start Mermaid's rewrite of tags, and no "direction LR", which an agentflow reads even in a comment.
 */
export const headerName = (name: string): string => escape(name.replace(/\s+/g, " "));

/** A label inside `"…"`; one that is only white space is a single space, since Mermaid cannot read `[""]`. */
export const label = (text: string): string => `"${escape(text).trim() === "" ? " " : escape(text)}"`;

/** The node with its shape: the glyph vocabulary in Mermaid's flowchart brackets. */
function nodeLine(node: Node): string {
  // A person's step keeps its role's shape and says whose it is in its label.
  const name = label(`${node.name || node.id}${isPersonStep(node) ? " (a person)" : ""}`);
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

export function edgeLabel(edge: Edge): string {
  const when = edge.when ?? "always";
  const parts: string[] = [];
  if (when !== "always") parts.push(typeof when === "string" ? when : `verdict: ${when.verdict}`);
  if (edge.approval) parts.push("approval");
  return parts.join(", ");
}

/**
 * A loop's stops as one note: "stops" and then one stop per line. One narrow
 * box per loop keeps the loop's subgraph small, where a note per stop set the
 * notes side by side or stacked and stretched it.
 */
function stopsNote(loop: Loop): string {
  return `"${["stops", ...stopLines(loop)].map(escape).join("<br>")}"`;
}

/** A loop's stops in words, one each, with where each continues. */
export const stopLines = (loop: Loop): string[] => loop.stops.map((stop) => `${describeStop(stop)}${stop.then !== undefined ? ` → ${stop.then}` : ""}`);

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
    `%% grooph mermaid: a projection of ${headerName(doc.name || doc.id)} (${doc.id}@${doc.version}).`,
    `%% grooph import reads back its nodes, edges, loops and stops; briefs, bars and brakes live in the graph document.`,
    `flowchart LR`,
  ];
  const back = new Set(doc.loops.flatMap((l) => l.back));
  const emitLoop = (at: number, depth: number): void => {
    const { loop } = loops[at]!;
    const pad = "  ".repeat(depth);
    lines.push(`${pad}subgraph ${mid(loop.id)}[${label(`${loop.name || loop.id} · ${loopMode(index, loop)} loop`)}]`);
    for (const node of doc.nodes) if (home.get(node.id) === at) lines.push(`${pad}  ${nodeLine(node)}`);
    if (loop.stops.length > 0) lines.push(`${pad}  stops_${loop.id.replace(/[^A-Za-z0-9_]/g, "_")}[${stopsNote(loop)}]:::stop`);
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

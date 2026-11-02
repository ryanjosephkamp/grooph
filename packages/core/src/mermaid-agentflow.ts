/**
 * A graph in Mermaid's syntax for agent workflows, `agentflow-beta` (beta since Mermaid 12.0, so its syntax may
 * still change). `mermaid.ts` writes the flowchart, which stays the default; this file is its own module so that
 * the web app, which offers only the flowchart, never loads it.
 *
 *   agentflow-beta TB
 *     an agent: a flow holding one task (its brief's first sentence), with its role, model tier and brief as metadata
 *     a person's step and a human gate: actions; a check: a decision; a merge and a stop: tasks
 *     the goal: an input; a loop: its way back, whose first edge carries the loop's stops
 */

import { edgeLabel, escape, headerName, label, mid, stopLines } from "./mermaid.js";
import { indexGraph } from "./graph-index.js";
import { entryNodeIds, isPersonStep } from "./semantics.js";
import type { AgentNode, Graph, Id, Node } from "./types.js";


/** Text cut at a word near `max` characters, with an ellipsis, for a label whose whole text is in metadata beside it. */
function clip(text: string, max = 60): string {
  const flat = [...text.replace(/\s+/g, " ").trim()];
  if (flat.length <= max) return flat.join("");
  const cut = flat.slice(0, max - 1).join("");
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

/**
 * A metadata value: a JSON string, which YAML reads as a double-quoted scalar, written so that nothing Mermaid does
 * to the whole text before it reads metadata can reach it. Mermaid's lexer ends the string at the first `"`, whatever
 * stands before it; it reads entities (`#…;`) and directives (`%%{…}%%`); it rewrites `="…"` inside anything shaped
 * like a tag; and it takes a line holding "direction LR" for a direction. So `"`, `#`, `%`, `<` and the d of
 * "direction" go as `\u` escapes, which YAML turns back into the characters.
 */
const value = (text: string): string =>
  `"${JSON.stringify(text)
    .slice(1, -1)
    .replace(/\\u[0-9a-fA-F]{4}|\\.|d(?=irection)|[#%<\u2028\u2029]/g, (token) =>
      token === '\\"'
        ? "\\u0022"
        : // JSON's own escapes in capitals, so one ending in d cannot spell "direction" with the text after it.
          token.startsWith("\\u")
          ? `\\u${token.slice(2).toUpperCase()}`
          : token.length === 1
            ? `\\u${token.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`
            : token,
    )}"`;

/** An `@{ … }` block: `shape` bare, every other value written by {@link value}. */
function metadata(shape: string | undefined, pairs: [string, string | undefined][]): string {
  const parts = [...(shape ? [`shape: ${shape}`] : []), ...pairs.flatMap(([key, text]) => (text === undefined || text === "" ? [] : [`${key}: ${value(text)}`]))];
  return parts.length === 0 ? "" : `@{ ${parts.join(", ")} }`;
}

const roleName = (node: AgentNode): string => (typeof node.role === "string" ? node.role : node.role.custom);

/** A brief's first sentence: what an agent's task box says. */
const firstSentence = (text: string): string => /^[\s\S]*?[.!?](?=\s|$)/.exec(text.trim())?.[0] ?? text.trim();

/** A graph in Mermaid's agentflow syntax: see the top of this file. */
export function mermaidAgentflow(doc: Graph): string {
  const nodes = new Map<Id, Node>(doc.nodes.map((n) => [n.id, n]));
  const flow = (node: Node | undefined): boolean => node?.kind === "agent" && !isPersonStep(node);
  // An edge meets an agent at the task inside its flow: `t_` for the task, `n_` for the flow and every other node.
  const end = (id: Id): string => (flow(nodes.get(id)) ? `t_${mid(id).slice(2)}` : mid(id));
  const lines: string[] = [
    `%% grooph mermaid --agentflow: ${headerName(doc.name || doc.id)} (${doc.id}@${doc.version}), in Mermaid's agentflow-beta syntax, which may still change.`,
    `%% A loop is its way back, and one of its edges back carries its stops; the graph document holds the rest.`,
    `agentflow-beta TB`,
  ];
  const goal = doc.goal !== undefined && doc.goal.trim() !== "";
  if (goal) lines.push(`  goal[${label(clip(doc.goal!))}]${metadata("input", [["value", doc.goal]])}`);
  for (const node of doc.nodes) {
    const name = node.name || node.id;
    switch (node.kind) {
      case "agent":
        if (flow(node)) {
          lines.push(`  flow ${mid(node.id)}[${label(name)}]`, `    ${end(node.id)}[${label(clip(firstSentence(node.brief)) || clip(name) || node.id)}]${metadata("task", [])}`, `  end`);
          lines.push(`  ${mid(node.id)}${metadata(undefined, [["role", roleName(node)], ["model", node.model?.tier], ["instruction", node.brief]])}`);
        } else lines.push(`  ${mid(node.id)}[${label(`${name} (a person)`)}]${metadata("action", [["role", roleName(node)], ["instruction", node.brief]])}`);
        break;
      case "human-gate":
        // `question`, not `prompt`: Mermaid reads `prompt` as the old name of `instruction`.
        lines.push(`  ${mid(node.id)}[${label(name)}]${metadata("action", [["question", node.prompt]])}`);
        break;
      case "check":
        lines.push(`  ${mid(node.id)}[${label(name)}]${metadata("decision", [["check", node.check.kind], ["run", node.check.run], ["pass", node.check.pass]])}`);
        break;
      case "merge":
      case "stop":
        lines.push(`  ${mid(node.id)}[${label(name)}]${metadata("task", [["kind", node.kind]])}`);
        break;
    }
  }
  const edges = doc.edges.filter((e) => nodes.has(e.from) && nodes.has(e.to));
  if (goal) {
    // The goal goes to where the work starts (`entryNodeIds`, graph-ir §2), or to the first node when nothing says.
    const starts = entryNodeIds(indexGraph(doc)).filter((id) => nodes.has(id));
    for (const id of starts.length > 0 ? starts : doc.nodes.slice(0, 1).map((n) => n.id)) lines.push(`  goal --> ${end(id)}`);
  }
  // Each loop's stops ride on its first way back that no other loop's ride on; when every one is taken, they share the first.
  const carries = new Map<Id, string[]>();
  // The loops with the fewest ways back choose first, so a loop with another way does not take a shared one.
  for (const loop of [...doc.loops].sort((a, b) => a.back.length - b.back.length)) {
    const back = loop.back.filter((id) => edges.some((e) => e.id === id));
    const on = back.find((id) => !carries.has(id)) ?? back[0];
    if (on !== undefined && loop.stops.length > 0) carries.set(on, [...(carries.get(on) ?? []), ...stopLines(loop)]);
  }
  for (const edge of edges) {
    const stops = carries.get(edge.id) ?? [];
    const words = [edgeLabel(edge), ...stops.map((line, i) => (i === 0 ? `stops: ${line}` : line))].filter((w) => w !== "");
    const text = words.map(escape).join("<br>");
    lines.push(`  ${end(edge.from)} ${text === "" ? "-->" : `-- "${text}" -->`} ${end(edge.to)}`);
  }
  return `${lines.join("\n")}\n`;
}

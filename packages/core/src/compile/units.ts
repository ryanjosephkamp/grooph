/**
 * The "Units" table of a lead's brief: the subgroophs of a graph, in the section that lists its nodes. The same
 * words for every compile target (`claude-code/lead.ts`, `codex/lead.ts`).
 */

import { contentsOf, listGroups } from "../groups.js";
import { GROUP_FROM_PATTERN } from "../schema/graph.js";
import type { Graph } from "../types.js";
import { cell, code, lines, table } from "./markdown.js";

/**
 * The subgroophs of the graph (amendment A-018): each a template placed as a unit. Nothing about running them is
 * new, so this says only what they are and asks the lead to name them. Absent for a graph that has none.
 *
 * A group's `from` is printed only as the token the schema holds it to, and the values it was filled with (`with`)
 * are not printed at all: they are already in the nodes they filled, and a brief is no place for a second copy
 * that nothing checks.
 *
 * One function for every target: a subgrooph is the graph's, and no harness runs it differently. Each lead's brief
 * ends its section on the nodes with this.
 */
export function units(doc: Graph): string | false {
  const placed = listGroups(doc).filter((group) => group.from !== undefined);
  if (placed.length === 0) return false;
  const name = (id: string): string => code(id);
  const fromOf = new Map((doc.groups ?? []).map((group) => [group.id, group.from ?? ""]));
  const rows = placed.map((group) => [
    cell(group.name),
    code(group.id),
    GROUP_FROM_PATTERN.test(fromOf.get(group.id)!) ? code(fromOf.get(group.id)!) : "a template",
    contentsOf(doc, group.id)!.nodes.map(name).join(", "),
    group.entries.length > 0 ? [...new Set(group.entries.map((edge) => name(edge.to)))].join(", ") : "nothing leads in",
    group.exits.length > 0 ? [...new Set(group.exits.map((edge) => name(edge.to)))].join(", ") : "its own stop",
  ]);
  return lines(
    "",
    "### Units",
    "",
    `Some of these nodes were placed together, each set from one template: a **subgrooph**. A person reading the graph sees each as one box under its name. Its nodes are ordinary nodes: run them as you run any others, by the edges, loops and stops below. When ${code("PROGRESS.md")} or a note says where the run is, name the unit as well as the node.`,
    "",
    table(["unit", "id", "placed from", "its nodes", "entered at", "leads on to"], rows),
  );
}

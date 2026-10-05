/**
 * What a graph's groups hold, read from the document: nothing is stored about a group but its members (graph-ir §1).
 *
 * This file imports only types, and the file the web app starts from (`base.ts`) does not reach it: it is fetched
 * with the compiler, which names subgroophs in the lead's brief, and with the views of a subgrooph
 * (`picture/graph-units.ts`), and an address that shows neither never carries it.
 */

import type { Edge, Graph, Group, GroupFrom, Id } from "./types.js";

export type GroupContents = {
  /** every node inside, at any depth, in document order */
  nodes: Id[];
  /** every group inside, at any depth */
  groups: Id[];
  /** edges with both ends inside */
  edges: Id[];
  /** loops whose members are all inside */
  loops: Id[];
  /** edges that cross the boundary inward */
  entries: Edge[];
  /** edges that cross the boundary outward */
  exits: Edge[];
};

/** What belongs to a group; undefined when the graph has no such group. A group that holds itself is walked once. */
export function contentsOf(doc: Graph, groupId: Id): GroupContents | undefined {
  const groups = new Map((doc.groups ?? []).map((group) => [group.id, group]));
  const start = groups.get(groupId);
  if (!start) return undefined;
  const inside = new Set<Id>();
  const inner: Id[] = [];
  const seen = new Set<Id>([groupId]);
  const walk = (group: Group): void => {
    for (const member of group.members) {
      const next = groups.get(member);
      if (!next) inside.add(member);
      else if (!seen.has(member)) {
        seen.add(member);
        inner.push(member);
        walk(next);
      }
    }
  };
  walk(start);
  return {
    nodes: doc.nodes.filter((node) => inside.has(node.id)).map((node) => node.id),
    groups: inner,
    edges: doc.edges.filter((edge) => inside.has(edge.from) && inside.has(edge.to)).map((edge) => edge.id),
    loops: doc.loops.filter((loop) => loop.members.length > 0 && loop.members.every((member) => inside.has(member))).map((loop) => loop.id),
    entries: doc.edges.filter((edge) => !inside.has(edge.from) && inside.has(edge.to)),
    exits: doc.edges.filter((edge) => inside.has(edge.from) && !inside.has(edge.to)),
  };
}

export type GroupSummary = {
  id: Id;
  name: string;
  description?: string;
  /** set when the group is a subgrooph */
  from?: { template: Id; version: number };
  with?: Record<string, string>;
  /** the group that lists this one as a member, if any */
  inside?: Id;
  nodes: number;
  groups: number;
  entries: { edge: Id; from: Id; to: Id }[];
  exits: { edge: Id; from: Id; to: Id }[];
};

export const parseGroupFrom = (from: GroupFrom | string): { template: Id; version: number } => {
  const at = from.lastIndexOf("@");
  return at < 0 ? { template: from, version: Number.NaN } : { template: from.slice(0, at), version: Number(from.slice(at + 1)) };
};

/** Every group of a graph, subgroophs and plain ones, with what each holds and how it is connected. */
export function listGroups(doc: Graph): GroupSummary[] {
  const groups = doc.groups ?? [];
  return groups.map((group) => {
    const contents = contentsOf(doc, group.id)!;
    const ends = (edge: Edge): { edge: Id; from: Id; to: Id } => ({ edge: edge.id, from: edge.from, to: edge.to });
    const holder = groups.find((other) => other.id !== group.id && other.members.includes(group.id));
    return {
      id: group.id,
      name: group.name,
      ...(group.description !== undefined ? { description: group.description } : {}),
      ...(group.from !== undefined ? { from: parseGroupFrom(group.from) } : {}),
      ...(group.with !== undefined ? { with: group.with } : {}),
      ...(holder ? { inside: holder.id } : {}),
      nodes: contents.nodes.length,
      groups: contents.groups.length,
      entries: contents.entries.map(ends),
      exits: contents.exits.map(ends),
    };
  });
}

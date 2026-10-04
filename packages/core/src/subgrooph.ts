/**
 * Subgroophs (amendment A-018, decision 0025): a template placed inside a graph as a unit, as a group that
 * remembers the template and version it came from. Placing one, listing what a graph holds, refreshing one from a
 * newer version of its template, and saving any group as a template.
 *
 * All pure: document in, document out, beside `insertFragment`, which does the copying. By value: nothing here
 * resolves or fetches a template; the caller hands it in.
 */

import { indexGraph } from "./graph-index.js";
import { edgeIdFor } from "./ops/edit.js";
import { allIds, uniqueId } from "./ops/ids.js";
import { ID_PATTERN, ONE_LINE_PATTERN } from "./schema/dsl.js";
import { brakesLost, type Loss } from "./brakes.js";
import { decisionName, decisionsShared, reachedWithout, type Closed } from "./reach.js";
import { entryNodeIds } from "./semantics.js";
import { didYouMean } from "./suggest.js";
import { TemplateError, extractTemplate, insertFragment, slotKeys, type SlotValues, type TemplateMeta } from "./template.js";
import type { Edge, Graph, Group, GroupFrom, Id, Loop, Node, Policy, Stop } from "./types.js";
import { validate } from "./validate.js";

// ─── what a group holds ───────────────────────────────────────────────────

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

/** What belongs to a group, read from the document: nothing is stored but its members (graph-ir §1). */
export function groupContents(doc: Graph, groupId: Id): GroupContents {
  const groups = new Map((doc.groups ?? []).map((group) => [group.id, group]));
  const start = groups.get(groupId);
  if (!start) throw new TemplateError(`no group "${groupId}" in "${doc.id}"${didYouMean(groupId, [...groups.keys()])}`);
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
    const contents = groupContents(doc, group.id);
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

// ─── placing ──────────────────────────────────────────────────────────────

export type PlaceOptions = {
  /** the group's id, and the prefix of every id that comes in with it */
  as: Id;
  /** the box's name; the template's title when absent */
  name?: string;
  values?: SlotValues;
  /** a node of the graph that leads into the subgrooph */
  after?: Id;
  /** a node of the graph the subgrooph leads on to, in place of its own success stop */
  then?: Id;
};

export type PlaceResult = {
  doc: Graph;
  group: Group;
  /** template id → id in the graph, for everything that came in */
  ids: Record<Id, Id>;
  /** the template's success stops that `then` took the place of */
  dropped: Id[];
  /** edges added to connect it: from `after`, and to `then` */
  connected: Id[];
  /**
   * Nodes of the graph that a run reached only by a person's decision, and reaches without it now that the subgrooph
   * leads to them: `past` is "a person" when none stands before the node any more, or the gate or approval passed by
   */
  opens: { node: Id; past: string }[];
};

const isSuccessStop = (node: Node): boolean => node.kind === "stop" && (node.outcome ?? "success") === "success";
const emptyHost = (): Graph => ({ grooph: 0, id: "x", name: "x", version: 1, nodes: [], edges: [], loops: [] });
const oneLine = (text: string | undefined): string | undefined => (text !== undefined && ONE_LINE_PATTERN.test(text) ? text : undefined);

/**
 * Place a template inside `doc` as a subgrooph: its nodes, edges, loops and policies come in under ids that start
 * with `as`, inside a group `as` that names the template, its version and the values it was filled with.
 *
 * With `then`, the edges that reached the template's success stop lead to that node of the graph, and the stop is
 * dropped; a stop that halts stays. A template with no success stop is led on from the nodes it ends at. With
 * `after`, that node leads into the template's entry nodes. Refuses an `as` whose ids the graph already uses: a
 * subgrooph's ids are its template's under one prefix, which is what lets it be refreshed.
 */
export function placeSubgrooph(doc: Graph, template: Graph, options: PlaceOptions): PlaceResult {
  const { as } = options;
  if (!ID_PATTERN.test(as)) throw new TemplateError(`"${as}" cannot name a subgrooph: an id starts with a letter and uses only a-z, 0-9 and "-"`);
  const hostNodes = doc.nodes.map((node) => node.id);
  for (const [flag, id] of [["--after", options.after], ["--then", options.then]] as const) {
    if (id !== undefined && !hostNodes.includes(id)) throw new TemplateError(`${flag} names "${id}", and "${doc.id}" has no such node${didYouMean(id, hostNodes)}`);
  }
  const taken = allIds(doc);
  if (taken.has(as)) throw new TemplateError(`"${as}" is taken in "${doc.id}": give the subgrooph another id`);
  // Every id under the prefix is the subgrooph's: that is how a refresh knows what is the template's.
  const under = [...taken].find((id) => id.startsWith(`${as}-`));
  if (under !== undefined) throw new TemplateError(`"${doc.id}" already has "${under}", and every id that begins with "${as}-" would be the subgrooph's own: give the subgrooph another id`);
  const over = (doc.groups ?? []).find((g) => g.from !== undefined && as.startsWith(`${g.id}-`));
  if (over) throw new TemplateError(`"${as}" begins with "${over.id}-", and every such id is the subgrooph "${over.id}"'s own: give this one another id`);
  refuseLead(template);

  const values = options.values ?? {};
  const placed = insertFragment(doc, template, { values, prefix: as });
  // Its ids as they come out with nothing in the way. Any difference is an id the graph already uses.
  const clean = insertFragment(emptyHost(), template, { values, prefix: as }).ids;
  const clash = Object.keys(placed.ids).find((id) => placed.ids[id] !== clean[id]);
  if (clash !== undefined) {
    throw new TemplateError(`"${doc.id}" already has "${clean[clash]}", which "${as}" would need for the template's "${clash}": give the subgrooph another id`);
  }

  const cameIn = new Set(template.nodes.map((node) => placed.ids[node.id]!));
  let nodes = placed.doc.nodes;
  let edges = placed.doc.edges;
  let loops = placed.doc.loops;
  const dropped: Id[] = [];
  const connected: Id[] = [];
  const ids = new Set(allIds(placed.doc));
  const connect = (from: Id, to: Id, like?: Edge): void => {
    const id = uniqueId(edgeIdFor(from, to), ids);
    ids.add(id);
    edges = [...edges, { ...like, id, from, to }];
    connected.push(id);
  };

  if (options.then !== undefined) {
    const then = options.then;
    const stops = nodes.filter((node) => cameIn.has(node.id) && isSuccessStop(node)).map((node) => node.id);
    if (stops.length > 0) {
      const gone = new Set(stops);
      const reaching = edges.filter((edge) => gone.has(edge.to));
      edges = edges.filter((edge) => !gone.has(edge.to));
      for (const edge of reaching) {
        ids.delete(edge.id);
        const { id: _id, from, to: _to, ...rest } = edge;
        connect(from, then, rest as Edge);
      }
      nodes = nodes.filter((node) => !gone.has(node.id));
      loops = loops.map((loop) => ({ ...loop, stops: loop.stops.map((stop) => (stop.then !== undefined && gone.has(stop.then) ? { ...stop, then } : stop)) }));
      for (const id of stops) cameIn.delete(id);
      dropped.push(...stops);
    } else {
      // A fragment ends in its host: lead on from each node that leads nowhere.
      for (const node of nodes) if (cameIn.has(node.id) && node.kind !== "stop" && !edges.some((edge) => edge.from === node.id)) connect(node.id, then);
    }
  }

  if (options.after !== undefined) {
    const inside: Graph = { ...emptyHost(), nodes: nodes.filter((node) => cameIn.has(node.id)), edges: edges.filter((edge) => cameIn.has(edge.from) && cameIn.has(edge.to)), loops: loops.filter((loop) => loop.members.every((member) => cameIn.has(member))) };
    for (const entry of entryNodeIds(indexGraph(inside))) connect(options.after, entry);
  }

  // The group holds the template's own outermost groups, and every node that is in none of them.
  const own = (template.groups ?? []).map((group) => placed.ids[group.id]!);
  const placedGroups = (placed.doc.groups ?? []).filter((group) => own.includes(group.id));
  const held = new Set(placedGroups.flatMap((group) => group.members));
  const description = oneLine(template.template?.summary);
  const group: Group = {
    id: as,
    name: options.name ?? template.template?.title ?? template.name,
    members: [...own.filter((id) => !held.has(id)), ...nodes.filter((node) => cameIn.has(node.id) && !held.has(node.id)).map((node) => node.id)],
    ...(description !== undefined ? { description } : {}),
    from: `${template.id}@${template.version}` as GroupFrom,
    ...(Object.keys(values).length > 0 ? { with: { ...values } } : {}),
  };
  const dropStops = (list: Group[]): Group[] => list.map((g) => (dropped.some((id) => g.members.includes(id)) ? { ...g, members: g.members.filter((id) => !dropped.includes(id)) } : g));
  const next: Graph = { ...placed.doc, nodes, edges, loops, groups: [...dropStops(placed.doc.groups ?? []), group] };
  const opens: PlaceResult["opens"] = [];
  for (const closed of decisionsShared(doc, next)) {
    const opened = nodesOpened(doc, next, closed);
    // Each node once, for the widest decision it is now reached around: a person before one gate, a gate before one answer.
    for (const node of hostNodes) if (opened.has(node) && !opens.some((open) => open.node === node)) opens.push({ node, past: decisionName(closed) });
  }
  return { doc: next, group, ids: placed.ids, dropped, connected, opens };
}

// ─── refreshing ───────────────────────────────────────────────────────────

export type Change = {
  /** what to ask for by name: `node:review-critic.brief`, `edge:e-a-b`, `loop:review-review.stops` */
  name: string;
  kind: "add" | "remove" | "change";
  object: "node" | "edge" | "loop" | "policy";
  id: Id;
  field?: string;
  /** one line a person reads */
  summary: string;
  /** set when the change removes or loosens a brake (amendment A-008's list): why, each reason once */
  loosens?: string;
  /** set when the change is held back because another is: the name of the change it waits for */
  waits?: string;
};

export type RefreshResult = {
  doc: Graph;
  /** every difference between the subgrooph as it stands and as the template would place it now, loosening ones first */
  changes: Change[];
  /**
   * The changes that were not applied: each one that loosens a brake and was not asked for by name, and each change
   * that cannot stand without one of those (`waits`): the rest of the shape, and whatever names a part of it
   */
  held: Change[];
  from: { was: GroupFrom; now: GroupFrom };
  /** things a person should know that are not changes: a slot the template no longer has, an end with nowhere to lead */
  notes: string[];
};

const json = (value: unknown): string => JSON.stringify(value);
const same = (a: unknown, b: unknown): boolean => json(a) === json(b);
const short = (value: unknown): string => {
  const text = typeof value === "string" ? value : json(value);
  return text === undefined ? "nothing" : text.length > 60 ? `${text.slice(0, 57)}…` : text;
};
/** Two values side by side, cut to where they differ: two long briefs that share their opening are told apart. */
const fromTo = (a: unknown, b: unknown): string => {
  if (typeof a !== "string" || typeof b !== "string" || (a.length <= 60 && b.length <= 60)) return `${short(a)} to ${short(b)}`;
  let shared = 0;
  while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared += 1;
  const start = Math.max(0, shared - 20);
  const cut = (text: string): string => `${start > 0 ? "…" : ""}${text.slice(start, start + 60)}${text.length > start + 60 ? "…" : ""}`;
  return `${cut(a)} to ${cut(b)}`;
};
const quote = (list: readonly string[]): string => list.map((item) => `"${item}"`).join(", ");
/** Whether a value names one of these ids: as a string, in a list, or as a policy's scope (`node:<id>`). */
const mentions = (value: unknown, ids: ReadonlySet<Id>): boolean =>
  typeof value === "string"
    ? ids.has(value) || ids.has(value.replace(/^(node|loop|edge):/, ""))
    : typeof value === "object" && value !== null && Object.values(value).some((inner) => mentions(inner, ids));

/** The nodes of `before` that a run reaches only by a decision there, and without it in `after`. */
function nodesOpened(before: Graph, after: Graph, closed: Closed): Set<Id> {
  const was = reachedWithout(before, closed);
  const reached = reachedWithout(after, closed);
  const known = new Set(before.nodes.map((node) => node.id));
  return new Set(after.nodes.filter((node) => known.has(node.id) && !was.has(node.id) && reached.has(node.id)).map((node) => node.id));
}

/** The template's lead node, if it has one: a subgrooph has no lead of its own (decision 0025, rule 4). */
function refuseLead(template: Graph): void {
  const lead = template.nodes.find((node) => node.kind === "agent" && node.role === "lead");
  if (lead) throw new TemplateError(`the template "${template.id}" has a lead node ("${lead.id}"): a subgrooph has no lead of its own, and a graph has one`);
}

/**
 * What a newer version of its template would change in a subgrooph, and the graph with those changes applied.
 *
 * The template is placed afresh, with the values the group was filled with and under the group's own prefix, and
 * compared with what stands in the graph. The subgrooph's own are: the nodes inside the box whose ids begin with
 * its id; the loops and policies whose ids do; an edge whose id the template has, an edge between two of its nodes,
 * and, where the template's stop was replaced when it was placed, an edge that leads where the subgrooph leads on.
 * A node a person added inside the box under another id is theirs and is left alone, with its edges. An edit a
 * person made to one of the template's own objects is a difference like any other, and is shown before it is
 * undone: nothing keeps the version the group was placed from, so there is no telling the template's change from
 * theirs.
 *
 * A change that removes or loosens a brake of amendment A-008's list is named and **not applied** unless its name
 * is in `allow`. Everything else applies, tightening included. What a brake is, and what losing one means, is in
 * `brakes.ts`: it compares the graph as it stands with the graph as it would be written, whole, so a brake cannot
 * be shed by doing in two changes, or under a new id, what one change under the old id would be held for. A change
 * is held for every loss it may be the cause of, and where no one change can be named, every change is.
 *
 * That list is not everything that could make a graph worse: a brief, a gate's prompt, a model tier, a critic's
 * permissions, a bar's answer key or what it inspects, a loop's other stops and a policy of another kind are shown
 * and applied. And nothing here remembers: a step dropped by one version and brought back, in front of its gate,
 * by the next is two refreshes that each lose nothing.
 *
 * **The shape moves as a whole.** Nodes, edges and a loop's members hang together: a gate kept while the edges
 * around it are replaced is a gate nobody reaches. So while any change to the shape is held back, every change to
 * the shape waits with it, and so does a change that names a part of the new shape; a brief, a cap or an approval
 * is its own, and is applied or held alone. The group's `from` moves to the template's version either way, and a
 * change held back is shown again the next time.
 */
export function refreshSubgrooph(doc: Graph, groupId: Id, template: Graph, options: { allow?: readonly string[] } = {}): RefreshResult {
  const group = (doc.groups ?? []).find((g) => g.id === groupId);
  if (!group) throw new TemplateError(`no group "${groupId}" in "${doc.id}"${didYouMean(groupId, (doc.groups ?? []).map((g) => g.id))}`);
  if (group.from === undefined) throw new TemplateError(`group "${groupId}" is not a subgrooph: it does not say which template it came from`);
  const was = parseGroupFrom(group.from);
  if (was.template !== template.id) throw new TemplateError(`group "${groupId}" came from "${was.template}", and this template is "${template.id}"`);
  refuseLead(template);

  const said: string[] = [];
  if (template.version < was.version) said.push(`this is version ${template.version} of "${template.id}", older than the version ${was.version} the subgrooph was placed from: the changes below lead back to it`);
  const prefix = `${groupId}-`;
  const keys = slotKeys(template);
  const values: SlotValues = {};
  for (const [key, value] of Object.entries(group.with ?? {})) {
    if (keys.includes(key)) values[key] = value;
    else said.push(`the template no longer has the slot "${key}"; its value is kept in the group and used nowhere`);
  }
  const fresh = insertFragment(emptyHost(), template, { values, prefix: groupId }).doc;

  const contents = groupContents(doc, groupId);
  const inside = new Set(contents.nodes);
  // Another subgrooph whose id begins with this one's prefix, and that is not inside it, has its ids to itself.
  const apart = (doc.groups ?? []).filter((g) => g.id !== groupId && g.from !== undefined && g.id.startsWith(prefix) && !contents.groups.includes(g.id)).map((g) => `${g.id}-`);
  const mine = (id: Id): boolean => id.startsWith(prefix) && !apart.some((other) => id.startsWith(other));
  /** A node the template brought: inside the box, under the box's prefix. One a person added under another id is theirs. */
  const placed = (id: Id): boolean => inside.has(id) && mine(id);
  const ownNodes = doc.nodes.filter((node) => placed(node.id));
  const leaving = doc.edges.filter((edge) => placed(edge.from) && !inside.has(edge.to));

  // The template's success stop, where the subgrooph holds none: it was replaced when the template was placed
  // (`then`). The edges that reach it are the ones that now leave the subgrooph, and keep where they lead.
  let freshNodes = fresh.nodes;
  let freshEdges = fresh.edges;
  let freshLoops = fresh.loops;
  const replaced = new Set(ownNodes.some(isSuccessStop) ? [] : freshNodes.filter((node) => isSuccessStop(node) && !doc.nodes.some((n) => n.id === node.id)).map((node) => node.id));
  /** where the subgrooph leads on to, in place of its stop */
  let onward: Id | undefined;
  if (replaced.size > 0) {
    const used = new Set<Id>();
    /** the template's edge into its stop → the graph's edge that took its place */
    const stands = new Map<Id, Edge>();
    for (const edge of freshEdges) {
      if (!replaced.has(edge.to)) continue;
      const match = leaving.find((e) => !used.has(e.id) && e.from === edge.from && same(e.when, edge.when));
      if (!match) continue;
      used.add(match.id);
      stands.set(edge.id, match);
    }
    onward = [...stands.values()][0]?.to ?? leaving[0]?.to;
    const taken = new Set<Id>([...allIds(doc), ...freshEdges.map((edge) => edge.id)]);
    freshEdges = freshEdges.flatMap((edge) => {
      if (!replaced.has(edge.to)) return [edge];
      const match = stands.get(edge.id);
      if (match) return [{ ...edge, id: match.id, to: match.to }];
      if (onward === undefined) {
        said.push(`the template now ends after "${edge.from}", and nothing leads on from the subgrooph in this graph: connect it`);
        return [];
      }
      // The way out this graph already has from that node is the same edge, changed; otherwise it is a new one.
      const already = leaving.find((e) => !used.has(e.id) && e.from === edge.from && e.to === onward);
      const id = already?.id ?? uniqueId(edgeIdFor(edge.from, onward), taken);
      used.add(id);
      taken.add(id);
      return [{ ...edge, id, to: onward }];
    });
    freshNodes = freshNodes.filter((node) => !replaced.has(node.id));
    freshLoops = freshLoops.map((loop) => ({
      ...loop,
      stops: loop.stops.map((stop) => {
        if (stop.then === undefined || !replaced.has(stop.then)) return stop;
        if (onward !== undefined) return { ...stop, then: onward };
        const { then: _then, ...rest } = stop;
        return rest as Stop;
      }),
    }));
  }
  const freshEdgeIds = new Set(freshEdges.map((edge) => edge.id));
  const current = {
    nodes: ownNodes,
    // An edge that leaves for the rest of the graph, that the template never had and that does not stand for its
    // stop, is the graph's own: not compared.
    edges: doc.edges.filter((edge) => freshEdgeIds.has(edge.id) || (placed(edge.from) && (placed(edge.to) || (onward !== undefined && edge.to === onward && !inside.has(edge.to))))),
    loops: doc.loops.filter((loop) => mine(loop.id)),
    policies: (doc.policies ?? []).filter((policy) => mine(policy.id)),
  };
  // A graph-wide policy the graph has under an id of its own came in once, when the template was placed; the
  // template's copy is not added beside it. Where the subgrooph holds its own copy, that copy is compared.
  const held0 = new Set(current.policies.map((policy) => policy.id));
  const freshPolicies = (fresh.policies ?? []).filter(
    (policy) => held0.has(policy.id) || policy.scope !== "graph" || !(doc.policies ?? []).some((p) => p.scope === "graph" && same(p.kind, policy.kind) && same(p.params, policy.params) && !mine(p.id)),
  );

  let changes: Change[] = [];
  /** what each change takes away and what it brings: a field's two values, or the whole object */
  const detail = new Map<string, { before?: unknown; after?: unknown }>();
  const compare = <T extends { id: Id }>(object: Change["object"], now: readonly T[], next: readonly T[]): void => {
    const nextById = new Map(next.map((o) => [o.id, o]));
    const nowById = new Map(now.map((o) => [o.id, o]));
    const push = (change: Change, before: T | undefined, after: T | undefined): void => {
      changes.push(change);
      detail.set(change.name, change.field === undefined ? { before, after } : { before: (before as Record<string, unknown>)[change.field], after: (after as Record<string, unknown>)[change.field] });
    };
    for (const before of now) {
      const after = nextById.get(before.id);
      if (!after) {
        push({ name: `${object}:${before.id}`, kind: "remove", object, id: before.id, summary: `removes ${object} "${before.id}"` }, before, undefined);
        continue;
      }
      const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => key !== "id");
      for (const field of fields) {
        const a = (before as Record<string, unknown>)[field];
        const b = (after as Record<string, unknown>)[field];
        if (same(a, b)) continue;
        push(
          { name: `${object}:${before.id}.${field}`, kind: "change", object, id: before.id, field, summary: `${object} "${before.id}": ${field} ${a === undefined ? "is set to" : b === undefined ? "is removed; it was" : "changes from"} ${b === undefined ? short(a) : a === undefined ? short(b) : fromTo(a, b)}` },
          before,
          after,
        );
      }
    }
    for (const after of next) {
      if (nowById.has(after.id)) continue;
      push({ name: `${object}:${after.id}`, kind: "add", object, id: after.id, summary: `adds ${object} "${after.id}"` }, undefined, after);
    }
  };
  compare<Node>("node", current.nodes, freshNodes);
  compare<Edge>("edge", current.edges, freshEdges);
  compare<Loop>("loop", current.loops, freshLoops);
  compare<Policy>("policy", current.policies, freshPolicies);

  // What comes in takes an id of its own: one the graph already uses elsewhere is a person's, and is not overwritten.
  const taken = allIds(doc);
  const clash = changes.find((change) => change.kind === "add" && taken.has(change.id));
  if (clash) throw new TemplateError(`the template's ${clash.object} "${clash.id}" needs an id that "${doc.id}" already uses outside the subgrooph "${groupId}": rename that one first`);

  const allow = new Set(options.allow ?? []);
  const unknown = [...allow].filter((name) => !changes.some((change) => change.name === name));
  if (unknown.length > 0) throw new TemplateError(`no change named ${unknown.map((n) => `"${n}"`).join(", ")}${didYouMean(unknown[0]!, changes.map((c) => c.name))}`);

  /** A change to the shape: a node, an edge or a loop coming or going, an edge moved, what a loop holds, what kind a node is. */
  const shape = (change: Change): boolean =>
    change.object !== "policy" &&
    (change.kind !== "change" ||
      (change.object === "loop" && (change.field === "members" || change.field === "back")) ||
      (change.object === "node" && change.field === "kind") ||
      (change.object === "edge" && (change.field === "from" || change.field === "to")));
  const coming = new Set(changes.filter((change) => shape(change) && change.kind === "add").map((change) => change.id));
  const going = new Set(changes.filter((change) => shape(change) && change.kind === "remove").map((change) => change.id));

  /** What is not applied, given the changes refused: those, and every change that cannot stand without one of them. */
  const holdFor = (refused: ReadonlySet<string>): Change[] => {
    const no = changes.filter((change) => refused.has(change.name));
    // A node kept as the kind it is keeps the fields of that kind: a field of it refused holds its kind, and its
    // kind held holds every field of it.
    const fieldRefused = new Map(no.filter((change) => change.object === "node" && change.kind === "change").map((change) => [change.id, change.name]));
    const kindOf = (id: Id): Change | undefined => changes.find((change) => change.object === "node" && change.id === id && change.field === "kind");
    // The shape waits for a refused change to it, for a kind that a refused field holds, and for a refused change
    // that keeps naming something the shape removes.
    const blocker = no.find(shape) ?? [...fieldRefused].map(([id, name]) => (kindOf(id) ? name : undefined)).find((name) => name !== undefined) ?? no.find((change) => mentions(detail.get(change.name)?.before, going))?.name;
    const blockedBy = typeof blocker === "string" ? blocker : blocker?.name;
    return changes.flatMap((change) => {
      if (refused.has(change.name)) return [change];
      if (blockedBy !== undefined && (shape(change) || mentions(detail.get(change.name)?.after, coming))) return [{ ...change, waits: blockedBy }];
      if (change.object === "node" && change.kind === "change" && kindOf(change.id) && (blockedBy !== undefined || fieldRefused.has(change.id))) return [{ ...change, waits: fieldRefused.get(change.id) ?? `node:${change.id}.kind` }];
      return [];
    });
  };

  const now = `${template.id}@${template.version}` as GroupFrom;
  /** The graph with every change applied but the ones named. */
  const build = (heldNames: ReadonlySet<string>): { doc: Graph; notes: string[] } => {
    /** One kind of object as it will stand: the template's, except where a change is held back. */
    const settle = <T extends { id: Id }>(object: Change["object"], was: readonly T[], next: readonly T[]): { keep: Map<Id, T>; gone: Set<Id>; added: T[] } => {
      const wasById = new Map(was.map((o) => [o.id, o]));
      const keep = new Map<Id, T>();
      const added: T[] = [];
      for (const after of next) {
        const before = wasById.get(after.id);
        if (!before) {
          if (!heldNames.has(`${object}:${after.id}`)) added.push(after);
          continue;
        }
        const settled: Record<string, unknown> = { ...after };
        for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
          if (!heldNames.has(`${object}:${after.id}.${field}`)) continue;
          const value = (before as Record<string, unknown>)[field];
          if (value === undefined) delete settled[field];
          else settled[field] = value;
        }
        keep.set(after.id, settled as T);
      }
      const gone = new Set(was.filter((before) => !next.some((after) => after.id === before.id) && !heldNames.has(`${object}:${before.id}`)).map((o) => o.id));
      return { keep, gone, added };
    };
    const apply = <T extends { id: Id }>(list: readonly T[], settled: { keep: Map<Id, T>; gone: Set<Id>; added: T[] }): T[] => [...list.filter((o) => !settled.gone.has(o.id)).map((o) => settled.keep.get(o.id) ?? o), ...settled.added];

    const notes: string[] = [];
    const nodes = settle("node", current.nodes, freshNodes);
    const edges = settle("edge", current.edges, freshEdges);
    const loops = settle("loop", current.loops, freshLoops);
    const nextNodes = apply(doc.nodes, nodes);
    // An edge of the graph's own that led to or from a node that is gone goes with it, and is said. One that pointed
    // at nothing before this refresh is not this refresh's to remove.
    const nextEdges = apply(doc.edges, edges).filter((edge) => {
      if (!nodes.gone.has(edge.from) && !nodes.gone.has(edge.to)) return true;
      notes.push(`edge "${edge.id}" (${edge.from} → ${edge.to}) is removed with the node it ${nodes.gone.has(edge.to) ? "led to" : "came from"}: reconnect what it joined`);
      return false;
    });
    const cut = new Set(doc.edges.filter((edge) => !nextEdges.some((kept) => kept.id === edge.id)).map((edge) => edge.id));
    // So does its place in a loop of the graph's own.
    const nextLoops = apply(doc.loops, loops).map((loop) => {
      const lost = [...loop.members.filter((member) => nodes.gone.has(member)), ...loop.back.filter((edge) => cut.has(edge))];
      if (lost.length === 0) return loop;
      notes.push(`loop "${loop.id}" no longer holds ${quote(lost)}, removed from the subgrooph: check that the loop still closes`);
      return { ...loop, members: loop.members.filter((member) => !nodes.gone.has(member)), back: loop.back.filter((edge) => !cut.has(edge)) };
    });
    const nextPolicies = apply(doc.policies ?? [], settle("policy", current.policies, freshPolicies));
    const groups = (doc.groups ?? []).map((g) => {
      const members = g.members.filter((member) => !nodes.gone.has(member));
      if (g.id !== groupId) return members.length === g.members.length ? g : { ...g, members };
      return { ...g, members: [...members, ...nodes.added.map((node) => node.id)], from: now };
    });
    // Anything else of the graph's own that still names what is gone is said, and left for a person to point elsewhere.
    const dead = new Set([...nodes.gone, ...loops.gone, ...cut]);
    if (dead.size > 0) {
      for (const [kind, list] of [["node", nextNodes], ["loop", nextLoops], ["policy", nextPolicies]] as const) {
        for (const object of list) {
          const { id: _id, ...rest } = object as { id: Id } & Record<string, unknown>;
          const named = [...dead].filter((id) => mentions(rest, new Set([id])));
          if (named.length > 0) notes.push(`${kind} "${object.id}" still names ${quote(named)}, which the newer version no longer has: point it at what took its place`);
        }
      }
    }
    // A node the newer version starts at, that nothing in this graph leads to.
    const built: Graph = { ...doc, nodes: nextNodes, edges: nextEdges, loops: nextLoops, ...(nextPolicies.length > 0 || doc.policies !== undefined ? { policies: nextPolicies } : {}), groups };
    if (doc.layout && nodes.gone.size > 0) built.layout = Object.fromEntries(Object.entries(doc.layout).filter(([id]) => !nodes.gone.has(id)));
    if (contents.entries.length > 0) {
      const starts = new Set(entryNodeIds(indexGraph(built)));
      for (const node of nodes.added) if (starts.has(node.id)) notes.push(`the newer version starts at "${node.id}" too, and nothing in this graph leads to it: a run would begin there. Lead into it from where the subgrooph is entered`);
    }
    return { doc: built, notes };
  };

  /**
   * Lay each loss at the changes that may have caused it, among those applied. Where none of them is one, any change
   * applied may be the cause, and each is marked. A change carries every reason it is marked for.
   */
  const mark = (losses: readonly Loss[], applied: (change: Change) => boolean): void => {
    for (const loss of losses) {
      const named = new Set(loss.at.filter((name) => changes.some((change) => change.name === name && applied(change))));
      changes = changes.map((change) => {
        if (!(named.size > 0 ? named.has(change.name) : applied(change)) || (change.loosens ?? "").split("; ").includes(loss.why)) return change;
        return { ...change, loosens: change.loosens === undefined ? loss.why : `${change.loosens}; ${loss.why}` };
      });
    }
  };
  const refusedNow = (): string[] => changes.filter((change) => change.loosens !== undefined && !allow.has(change.name)).map((change) => change.name);
  // First with everything applied, so that all of it is named at once. Then on what would be written once the
  // refused changes are held back, again and again until it loses no brake that was not asked for by name: what is
  // held is judged on the graph as it will stand, not on the graph the whole newer version would make.
  mark(brakesLost(doc, build(new Set()).doc), () => true);
  let held: Change[] = [];
  let built = build(new Set());
  for (let round = 0; round <= changes.length + 1; round += 1) {
    const refused = refusedNow();
    held = holdFor(new Set(refused));
    const heldNames = new Set(held.map((change) => change.name));
    built = build(heldNames);
    mark(brakesLost(doc, built.doc), (change) => !heldNames.has(change.name));
    if (refusedNow().length === refused.length) break;
  }

  // Half an update can be a graph that does not hold together: a role changed while the edge that went with it is
  // held. Where what is left would fail a rule the graph passes now, nothing is applied until the held changes are
  // asked for: a graph is not left worse than it was found, by loosening or by breaking.
  const errors = (graph: Graph): Set<string> => new Set(validate(graph).filter((issue) => issue.severity === "error").map((issue) => `${issue.code} ${issue.message}`));
  const first = held.find((change) => change.waits === undefined);
  if (first) {
    const had = errors(doc);
    const broken = [...new Set(validate(built.doc).filter((issue) => issue.severity === "error" && !had.has(`${issue.code} ${issue.message}`)).map((issue) => issue.code))];
    if (broken.length > 0) {
      held = changes.map((change) => held.find((h) => h.name === change.name) ?? { ...change, waits: first.name });
      built = build(new Set(held.map((change) => change.name)));
      built.notes.push(`with those held back, the rest would leave the graph with ${broken.join(", ")}, which it does not have now: nothing is applied until they are asked for`);
    }
  }

  changes.sort((a, b) => Number(b.loosens !== undefined) - Number(a.loosens !== undefined));
  held = changes.flatMap((change) => held.filter((h) => h.name === change.name).map((h) => (h.waits !== undefined ? { ...change, waits: h.waits } : change)));
  return { doc: built.doc, changes, held, from: { was: group.from, now }, notes: [...said, ...built.notes] };
}

// ─── saving a group as a template ─────────────────────────────────────────

/**
 * A fragment template made from a group: its nodes, at any depth, with the edges and loops between them and the
 * groups inside it. The group itself becomes the template, so it is not carried in as a group of its own.
 */
export function extractGroup(doc: Graph, groupId: Id, meta: TemplateMeta): Graph {
  const contents = groupContents(doc, groupId);
  if (contents.nodes.length === 0) throw new TemplateError(`group "${groupId}" holds no node: there is nothing to save`);
  // Without the group itself, so that the template may take the group's own id as its name.
  const others = (doc.groups ?? []).filter((group) => group.id !== groupId);
  const { groups: _groups, ...rest } = doc;
  return extractTemplate(others.length > 0 ? { ...rest, groups: others } : (rest as Graph), { kind: "fragment", nodeIds: contents.nodes, meta });
}

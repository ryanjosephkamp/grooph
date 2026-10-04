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
import { edgeIsolation, entryNodeIds, isCriticFamily } from "./semantics.js";
import { didYouMean } from "./suggest.js";
import { TemplateError, extractTemplate, insertFragment, slotKeys, type SlotValues, type TemplateMeta } from "./template.js";
import type { Edge, Graph, Group, GroupFrom, Id, Loop, Node, Policy, Stop } from "./types.js";

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
  return { template: from.slice(0, at), version: Number(from.slice(at + 1)) };
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
  return { doc: next, group, ids: placed.ids, dropped, connected };
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
  /** set when the change removes or loosens a brake (amendment A-008's list): why */
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
   * to the subgrooph's shape that waits for one of those (`waits`)
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

/** Why a loop's stops, as they would become, are a looser brake than as they are; undefined when they are not. */
function looserStops(now: readonly Stop[], next: readonly Stop[]): string | undefined {
  for (const stop of now) {
    if (stop.kind === "max-iterations") {
      const caps = next.filter((s): s is Extract<Stop, { kind: "max-iterations" }> => s.kind === "max-iterations").map((s) => s.n);
      if (caps.length === 0) return `removes the round cap (${stop.n})`;
      if (Math.min(...caps) > stop.n) return `raises the round cap from ${stop.n} to ${Math.min(...caps)}`;
    }
    if (stop.kind === "budget") {
      const limits = next.filter((s): s is Extract<Stop, { kind: "budget" }> => s.kind === "budget" && s.measure === stop.measure).map((s) => s.limit);
      if (limits.length === 0) return `removes the budget of ${stop.limit} ${stop.measure}`;
      if (Math.min(...limits) > stop.limit) return `raises the budget from ${stop.limit} to ${Math.min(...limits)} ${stop.measure}`;
    }
    if (stop.kind === "human" && !next.some((s) => s.kind === "human")) return "removes the stop where a person is asked";
  }
  return undefined;
}

/**
 * What a newer version of its template would change in a subgrooph, and the graph with those changes applied.
 *
 * The template is placed afresh, with the values the group was filled with and under the group's own prefix, and
 * compared with what stands in the graph: the nodes, loops and policies whose ids begin with the group's id, and
 * the edges between those nodes. A node a person added inside the box under another id is theirs and is left
 * alone, with its edges; an edge that leaves the subgrooph for the rest of the graph keeps where it leads. An edit
 * a person made to one of the template's own nodes is a difference like any other, and is shown before it is undone:
 * nothing keeps the version the group was placed from, so there is no telling the template's change from theirs.
 *
 * A change that removes or loosens a brake (a human gate, an approval, an irreversible marker, a budget or a round
 * cap, a bar's acceptance, critic isolation: amendment A-008's list) is named and **not applied** unless its name
 * is in `allow`. Everything else applies, tightening included. The group's `from` moves to the template's version
 * either way, and a change held back is shown again the next time.
 *
 * **The shape moves as a whole.** Nodes, edges and a loop's members hang together: a gate kept while the edges
 * around it are replaced is a gate nobody reaches. So while any change to the shape is held back, every change to
 * the shape waits with it; a brief, a cap or an approval is its own, and is applied or held alone.
 */
export function refreshSubgrooph(doc: Graph, groupId: Id, template: Graph, options: { allow?: readonly string[] } = {}): RefreshResult {
  const group = (doc.groups ?? []).find((g) => g.id === groupId);
  if (!group) throw new TemplateError(`no group "${groupId}" in "${doc.id}"${didYouMean(groupId, (doc.groups ?? []).map((g) => g.id))}`);
  if (group.from === undefined) throw new TemplateError(`group "${groupId}" is not a subgrooph: it does not say which template it came from`);
  const was = parseGroupFrom(group.from);
  if (was.template !== template.id) throw new TemplateError(`group "${groupId}" came from "${was.template}", and this template is "${template.id}"`);

  const notes: string[] = [];
  const prefix = `${groupId}-`;
  const keys = slotKeys(template);
  const values: SlotValues = {};
  for (const [key, value] of Object.entries(group.with ?? {})) {
    if (keys.includes(key)) values[key] = value;
    else notes.push(`the template no longer has the slot "${key}"; its value is kept in the group and used nowhere`);
  }
  const fresh = insertFragment(emptyHost(), template, { values, prefix: groupId }).doc;

  const contents = groupContents(doc, groupId);
  const inside = new Set(contents.nodes);
  const mine = (id: Id): boolean => id.startsWith(prefix);
  /** A node the template brought: inside the box, under the box's prefix. One a person added under another id is theirs. */
  const placed = (id: Id): boolean => inside.has(id) && mine(id);
  const current = {
    nodes: doc.nodes.filter((node) => placed(node.id)),
    // Between two of the template's nodes, or from one of them out of the box. An edge to or from a node a person added is theirs.
    edges: doc.edges.filter((edge) => placed(edge.from) && (placed(edge.to) || !inside.has(edge.to))),
    loops: doc.loops.filter((loop) => contents.loops.includes(loop.id) && mine(loop.id)),
    policies: (doc.policies ?? []).filter((policy) => mine(policy.id)),
  };

  // The template's success stop, where this graph has none under that id: it was replaced when the template was
  // placed (`then`). The edges that reach it are the ones that now leave the subgrooph, and keep where they lead.
  let freshNodes = fresh.nodes;
  let freshEdges = fresh.edges;
  let freshLoops = fresh.loops;
  const replaced = new Set(freshNodes.filter((node) => isSuccessStop(node) && !doc.nodes.some((n) => n.id === node.id)).map((node) => node.id));
  if (replaced.size > 0) {
    const leaving = current.edges.filter((edge) => !inside.has(edge.to));
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
    // Where the subgrooph leads on to. A way to its end that the template has gained leads there too, and is a
    // change like any other: shown, and held back if it would pass no person where every way in passes one today.
    const onward = [...stands.values()][0]?.to ?? leaving[0]?.to;
    freshEdges = freshEdges.flatMap((edge) => {
      if (!replaced.has(edge.to)) return [edge];
      const match = stands.get(edge.id);
      if (match) return [{ ...edge, id: match.id, to: match.to }];
      if (onward === undefined) {
        notes.push(`the template now ends after "${edge.from}", and nothing leads on from the subgrooph in this graph: connect it`);
        return [];
      }
      return [{ ...edge, id: edgeIdFor(edge.from, onward), to: onward }];
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
  // An edge that leaves for the rest of the graph and that the template never had is the graph's own: not compared.
  const freshEdgeIds = new Set(freshEdges.map((edge) => edge.id));
  current.edges = current.edges.filter((edge) => inside.has(edge.to) || freshEdgeIds.has(edge.id));

  const changes: Change[] = [];
  const nodeNow = new Map(doc.nodes.map((node) => [node.id, node]));
  const gated = (edge: Edge, nodes: ReadonlyMap<Id, Node>): boolean => edge.approval === true || nodes.get(edge.from)?.kind === "human-gate";

  const compare = <T extends { id: Id }>(object: Change["object"], now: readonly T[], next: readonly T[], loosens: (change: Change, before: T | undefined, after: T | undefined) => string | undefined): void => {
    const nextById = new Map(next.map((o) => [o.id, o]));
    const nowById = new Map(now.map((o) => [o.id, o]));
    const push = (change: Change, before: T | undefined, after: T | undefined): void => {
      const why = loosens(change, before, after);
      changes.push(why === undefined ? change : { ...change, loosens: why });
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

  const freshNodeById = new Map<Id, Node>([...nodeNow, ...freshNodes.map((node) => [node.id, node] as const)]);
  compare<Node>("node", current.nodes, freshNodes, (change, before, after) => {
    if (change.kind === "remove" && before!.kind === "human-gate") return "removes a human gate";
    if (change.field === "kind" && before!.kind === "human-gate") return "a human gate becomes another kind of node";
    if (change.field === "irreversible") {
      const kept = new Set((after as { irreversible?: string[] }).irreversible ?? []);
      const lost = ((before as { irreversible?: string[] }).irreversible ?? []).filter((marker) => !kept.has(marker));
      if (lost.length > 0) return `removes the irreversible marker ${lost.map((m) => `"${m}"`).join(", ")}`;
    }
    return undefined;
  });
  compare<Edge>("edge", current.edges, freshEdges, (change, before, after) => {
    if (change.kind === "remove" && before!.approval === true) return "removes an edge that needs a person's approval";
    if (change.field === "approval" && before!.approval === true) return "removes a person's approval from the edge";
    const target = nodeNow.get((before ?? after)!.to) ?? freshNodeById.get((before ?? after)!.to);
    if (change.kind === "change" && target && isCriticFamily(target)) {
      if (change.field === "isolation" && edgeIsolation(before!) === "fresh" && edgeIsolation(after!) === "shared") return "the critic would share its builder's context";
      if (change.field === "evidence" && (before!.evidence ?? []).length > 0 && (after!.evidence ?? []).length === 0) return "the critic would be handed no evidence";
    }
    if (change.kind === "add") {
      const ways = doc.edges.filter((edge) => edge.to === after!.to);
      if (ways.length > 0 && ways.every((edge) => gated(edge, nodeNow)) && !gated(after!, freshNodeById)) return `adds a way into "${after!.to}" that does not pass a person`;
    }
    return undefined;
  });
  compare<Loop>("loop", current.loops, freshLoops, (change, before, after) => {
    if (change.kind === "remove") {
      const brakes = before!.stops.filter((stop) => stop.kind === "budget" || stop.kind === "max-iterations" || stop.kind === "human");
      return brakes.length > 0 || before!.bar ? "removes a loop with its stops and its bar" : undefined;
    }
    if (change.field === "stops") return looserStops(before!.stops, after!.stops);
    if (change.field === "bar") {
      if (before!.bar && !after!.bar) return "removes the loop's bar";
      if (before!.bar && after!.bar && before!.bar.acceptance !== after!.bar.acceptance) return "changes the bar's acceptance";
    }
    return undefined;
  });
  const freshPolicies = (fresh.policies ?? []).filter((policy) => policy.scope !== "graph" || !(doc.policies ?? []).some((p) => p.scope === "graph" && same(p.kind, policy.kind) && same(p.params, policy.params) && !mine(p.id)));
  compare<Policy>("policy", current.policies, freshPolicies, (change, before) => {
    if (change.kind !== "remove" && change.field !== "kind" && change.field !== "scope") return undefined;
    if (before?.kind === "critic-isolation") return "removes critic isolation";
    if (before?.kind === "no-live-graph-rewrite") return "lets a run rewrite the graph where it could only propose";
    return undefined;
  });

  changes.sort((a, b) => Number(b.loosens !== undefined) - Number(a.loosens !== undefined));
  const allow = new Set(options.allow ?? []);
  const unknown = [...allow].filter((name) => !changes.some((change) => change.name === name));
  if (unknown.length > 0) throw new TemplateError(`no change named ${unknown.map((n) => `"${n}"`).join(", ")}${didYouMean(unknown[0]!, changes.map((c) => c.name))}`);
  /** A change to the shape: a node, an edge or a loop coming or going, what a loop holds, what kind a node is. */
  const shape = (change: Change): boolean =>
    change.object !== "policy" && (change.kind !== "change" || (change.object === "loop" && (change.field === "members" || change.field === "back")) || (change.object === "node" && change.field === "kind"));
  const refused = changes.filter((change) => change.loosens !== undefined && !allow.has(change.name));
  const blocker = refused.find(shape);
  const held = changes.flatMap((change) => {
    if (refused.includes(change)) return [change];
    return blocker !== undefined && shape(change) ? [{ ...change, waits: blocker.name }] : [];
  });
  const heldNames = new Set(held.map((change) => change.name));

  /** One kind of object as it will stand: the template's, except where a change is held back. */
  const settle = <T extends { id: Id }>(object: Change["object"], now: readonly T[], next: readonly T[]): { keep: Map<Id, T>; gone: Set<Id>; added: T[] } => {
    const nowById = new Map(now.map((o) => [o.id, o]));
    const keep = new Map<Id, T>();
    const added: T[] = [];
    for (const after of next) {
      const before = nowById.get(after.id);
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
    const gone = new Set(now.filter((before) => !next.some((after) => after.id === before.id) && !heldNames.has(`${object}:${before.id}`)).map((o) => o.id));
    return { keep, gone, added };
  };
  const apply = <T extends { id: Id }>(list: readonly T[], settled: { keep: Map<Id, T>; gone: Set<Id>; added: T[] }): T[] => [...list.filter((o) => !settled.gone.has(o.id)).map((o) => settled.keep.get(o.id) ?? o), ...settled.added];

  const nodes = settle("node", current.nodes, freshNodes);
  const edges = settle("edge", current.edges, freshEdges);
  const loops = settle("loop", current.loops, freshLoops);
  const policies = settle("policy", current.policies, freshPolicies);
  const now = `${template.id}@${template.version}` as GroupFrom;
  const nextPolicies = apply(doc.policies ?? [], policies);
  // An edge of the graph's own that led to or from a node that is gone goes with it, and is said.
  const orphaned = doc.edges.filter((edge) => (nodes.gone.has(edge.from) || nodes.gone.has(edge.to)) && !edges.gone.has(edge.id));
  for (const edge of orphaned) {
    edges.gone.add(edge.id);
    notes.push(`edge "${edge.id}" (${edge.from} → ${edge.to}) is removed with the node it ${nodes.gone.has(edge.to) ? "led to" : "came from"}: reconnect what it joined`);
  }
  const groupsNext = (doc.groups ?? []).map((g) => {
    const members = g.members.filter((member) => !nodes.gone.has(member));
    if (g.id !== groupId) return members.length === g.members.length ? g : { ...g, members };
    return { ...g, members: [...members, ...nodes.added.map((node) => node.id)], from: now };
  });
  const next: Graph = {
    ...doc,
    nodes: apply(doc.nodes, nodes),
    edges: apply(doc.edges, edges),
    loops: apply(doc.loops, loops),
    ...(nextPolicies.length > 0 || doc.policies !== undefined ? { policies: nextPolicies } : {}),
    groups: groupsNext,
  };
  return { doc: next, changes, held, from: { was: group.from, now }, notes };
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

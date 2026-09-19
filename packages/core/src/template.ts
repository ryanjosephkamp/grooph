/**
 * Templates (docs/templates.md §2): a template is a graph document with a
 * `template` block. These operations turn one into a graph, insert one into a
 * graph, make one from a graph, and describe one for a registry index.
 *
 * All pure: document in, document out. Reading registries from folders or the
 * network is a shell concern (the CLI does it; decision 0005).
 */

import { allIds, slugify, uniqueId } from "./ops/ids.js";
import { edgeIdFor } from "./ops/edit.js";
import { ID_PATTERN } from "./schema/dsl.js";
import { isCriticFamily } from "./semantics.js";
import { didYouMean } from "./suggest.js";
import type {
  Edge,
  Graph,
  Group,
  Id,
  Loop,
  Node,
  Policy,
  PolicyScope,
  Profile,
  Template,
  TemplateKind,
  TemplateSlot,
} from "./types.js";

/** Thrown when an operation cannot apply to the template it was given. The message says what to do instead. */
export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateError";
  }
}

/** Slot values by key: `{ task: "Add a slugify function" }`. */
export type SlotValues = Record<string, string>;

/** `{{key}}`, tolerating inner spaces so `{{ key }}` is neither missed nor left behind. */
const SLOT = /\{\{\s*([^{}\s]+)\s*\}\}/g;

/** The graph-level keys that hold other objects, or hold no slot text. */
const NOT_GRAPH_TEXT = new Set(["nodes", "edges", "loops", "policies", "groups", "notes", "layout", "template"]);

// ─── slots ────────────────────────────────────────────────────────────────

export type SlotUse = {
  key: string;
  /** the objects whose string fields hold `{{key}}`, in document order; the graph id for graph-level fields */
  at: Id[];
};

function eachString(value: unknown, visit: (text: string) => void): void {
  if (typeof value === "string") visit(value);
  else if (Array.isArray(value)) for (const item of value) eachString(item, visit);
  else if (value !== null && typeof value === "object") for (const item of Object.values(value)) eachString(item, visit);
}

function mapStrings<T>(value: T, fn: (text: string) => string): T {
  if (typeof value === "string") return fn(value) as T;
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, fn)) as T;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = mapStrings(item, fn);
    return out as T;
  }
  return value;
}

/** Every object that can hold slot text, with the id `at` names for it. The template block and run notes hold none. */
function slotHolders(doc: Graph): { id: Id; value: unknown }[] {
  const graphText: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) if (!NOT_GRAPH_TEXT.has(key)) graphText[key] = value;
  const lists: readonly ({ id: Id }[] | undefined)[] = [doc.nodes, doc.edges, doc.loops, doc.policies, doc.groups];
  return [{ id: doc.id, value: graphText }, ...lists.flatMap((list) => (list ?? []).map((item) => ({ id: item.id, value: item })))];
}

/** Every `{{key}}` in the document's string fields, with the ids of the objects holding it (docs/templates.md §2). */
export function findSlots(doc: Graph): SlotUse[] {
  const found = new Map<string, Id[]>();
  for (const holder of slotHolders(doc)) {
    eachString(holder.value, (text) => {
      for (const match of text.matchAll(SLOT)) {
        const at = found.get(match[1]!) ?? [];
        if (!at.includes(holder.id)) at.push(holder.id);
        found.set(match[1]!, at);
      }
    });
  }
  return [...found].map(([key, at]) => ({ key, at }));
}

/**
 * Replace `{{key}}` with `values[key]` in every string field that can hold a
 * slot (not the template block, run notes or layout). Keys with no value stay
 * as written. One pass: a value that itself contains `{{…}}` is not expanded.
 */
export function fillSlots(doc: Graph, values: SlotValues): Graph {
  const fill = (text: string): string =>
    text.replace(SLOT, (whole, key: string) => (Object.hasOwn(values, key) ? values[key]! : whole));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) out[key] = key === "template" || key === "notes" || key === "layout" ? value : mapStrings(value, fill);
  return out as Graph;
}

/** The slot keys a template asks for: those its block declares, then any other `{{key}}` its text uses. */
export function slotKeys(template: Graph): string[] {
  const declared = (template.template?.slots ?? []).map((slot) => slot.key);
  return [...new Set([...declared, ...findSlots(template).map((use) => use.key)])];
}

/** Refuse a value for a key the template never asks for, so a typo cannot pass silently. */
function checkValues(template: Graph, values: SlotValues): void {
  const keys = slotKeys(template);
  for (const key of Object.keys(values)) {
    if (!keys.includes(key)) {
      throw new TemplateError(
        `template "${template.id}" has no slot "${key}"${didYouMean(key, keys)}${
          keys.length > 0 ? `; its slots are ${keys.join(", ")}` : "; it has no slots"
        }`,
      );
    }
  }
}

function requireTemplate(doc: Graph): Template {
  if (!doc.template) throw new TemplateError(`"${doc.id}" is not a template: it has no template block`);
  return doc.template;
}

// ─── instantiate ──────────────────────────────────────────────────────────

/**
 * A graph from a `kind: "graph"` template: slots filled, the template block
 * removed, a new id and name, `version: 1`, and lineage naming the template
 * and version it came from. Unfilled slots stay as `{{key}}` (export refuses
 * them with `E_UNFILLED_SLOT`). Refuses fragments and values for unknown slots.
 */
export function instantiate(template: Graph, options: { name: string; values?: SlotValues; id?: Id }): Graph {
  const block = requireTemplate(template);
  if (block.kind === "fragment") {
    throw new TemplateError(
      `"${template.id}" is a fragment, not a whole graph; insert it into a graph instead (insertFragment, grooph template insert)`,
    );
  }
  const values = options.values ?? {};
  checkValues(template, values);

  const { template: _block, notes: _notes, ...rest } = template;
  const filled = fillSlots(rest as Graph, values);
  const taken = allIds(filled);
  taken.delete(filled.id);
  return {
    ...filled,
    id: options.id ?? uniqueId(slugify(options.name, "graph"), taken),
    name: options.name,
    version: 1,
    lineage: { pattern: template.id, from: `${template.id}@${template.version}` },
  };
}

// ─── insertFragment ───────────────────────────────────────────────────────

export type InsertResult = {
  doc: Graph;
  /** template id → id in the host document, for every node, edge, loop, policy and group carried in */
  ids: Record<Id, Id>;
};

const isDerivedEdgeId = (edge: Edge): boolean => {
  const derived = edgeIdFor(edge.from, edge.to);
  return edge.id === derived || new RegExp(`^${derived}-\\d+$`).test(edge.id);
};

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Add a template's nodes, edges, loops, policies and groups to `doc`, and
 * return where each id landed. An id that collides with one in `doc` is
 * re-derived (`gate` → `gate-2`); with `prefix`, every id is prefixed
 * (`ship-gate`). Edges with derived ids (`e-<from>-<to>`) follow their nodes.
 * Layout, notes and graph-level fields are not carried; nothing is connected
 * to the host's nodes. Graph-scoped policies come along unless `doc` already
 * has the same one.
 *
 * Takes fragments and whole-graph templates alike: a graph template inserts as
 * a subgraph.
 */
export function insertFragment(doc: Graph, template: Graph, options: { values?: SlotValues; prefix?: string } = {}): InsertResult {
  requireTemplate(template);
  const values = options.values ?? {};
  checkValues(template, values);

  let prefix = "";
  if (options.prefix !== undefined && options.prefix !== "") {
    prefix = options.prefix.endsWith("-") ? options.prefix : `${options.prefix}-`;
    if (!ID_PATTERN.test(prefix)) {
      throw new TemplateError(`prefix "${options.prefix}" must start with a letter and use only a-z, 0-9 and "-", so the ids it makes stay kebab-case`);
    }
  }

  const src = fillSlots(template, values);
  const taken = allIds(doc);
  const ids: Record<Id, Id> = {};
  const claim = (from: Id, base: Id): Id => {
    const id = uniqueId(base, taken);
    taken.add(id);
    ids[from] = id;
    return id;
  };

  for (const node of src.nodes) claim(node.id, prefix + node.id);
  const map = (id: Id): Id => ids[id] ?? id;
  for (const edge of src.edges) {
    claim(edge.id, isDerivedEdgeId(edge) ? edgeIdFor(map(edge.from), map(edge.to)) : prefix + edge.id);
  }
  for (const loop of src.loops) claim(loop.id, prefix + loop.id);
  for (const group of src.groups ?? []) claim(group.id, prefix + group.id);

  const scopeOf = (scope: PolicyScope): PolicyScope => {
    if (scope === "graph") return scope;
    const colon = scope.indexOf(":");
    return `${scope.slice(0, colon)}:${map(scope.slice(colon + 1))}` as PolicyScope;
  };
  const hostPolicies = doc.policies ?? [];
  const carried: Policy[] = [];
  for (const policy of src.policies ?? []) {
    const already =
      policy.scope === "graph" &&
      hostPolicies.some((p) => p.scope === "graph" && sameJson(p.kind, policy.kind) && sameJson(p.params, policy.params));
    if (already) continue;
    carried.push({ ...policy, id: claim(policy.id, prefix + policy.id), scope: scopeOf(policy.scope) });
  }

  const nodes: Node[] = src.nodes.map((node) => ({ ...node, id: map(node.id) }));
  const edges: Edge[] = src.edges.map((edge) => ({ ...edge, id: map(edge.id), from: map(edge.from), to: map(edge.to) }));
  const loops: Loop[] = src.loops.map((loop) => {
    const next: Loop = {
      ...loop,
      id: map(loop.id),
      members: loop.members.map(map),
      back: loop.back.map(map),
      stops: loop.stops.map((stop) => (stop.then === undefined ? stop : { ...stop, then: map(stop.then) })),
    };
    if (loop.bar?.answerKeyFrom !== undefined) next.bar = { ...loop.bar, answerKeyFrom: map(loop.bar.answerKeyFrom) };
    return next;
  });
  const groups: Group[] = (src.groups ?? []).map((group) => ({ ...group, id: map(group.id), members: group.members.map(map) }));

  const next: Graph = {
    ...doc,
    nodes: [...doc.nodes, ...nodes],
    edges: [...doc.edges, ...edges],
    loops: [...doc.loops, ...loops],
  };
  if (carried.length > 0) next.policies = [...hostPolicies, ...carried];
  if (groups.length > 0) next.groups = [...(doc.groups ?? []), ...groups];
  return { doc: next, ids };
}

// ─── extractTemplate ──────────────────────────────────────────────────────

export type TemplateMeta = {
  /** the template's id, which is also its name in a registry */
  id: Id;
  title: string;
  summary: string;
  whenToUse: string;
  notFor?: string;
  /** estimated from the graph when absent (`estimateProfile`) */
  profile?: Profile;
  slots?: TemplateSlot[];
  tags?: string[];
  demo?: string;
};

/**
 * A template made from `doc`: the whole graph, or (`kind: "fragment"`) the
 * given nodes with the edges between them, the loops whose members and back
 * edges are all inside, and the policies and groups scoped inside. Run notes
 * are dropped from both, since they are one run's history; a fragment also
 * drops the graph-level fields insertion ignores (goal, target, constraints,
 * adaptation, description) and layout. Any `{{key}}` left in the text without
 * a slot in `meta` gets a slot that asks for it.
 */
export function extractTemplate(doc: Graph, options: { kind: TemplateKind; nodeIds?: Id[]; meta: TemplateMeta }): Graph {
  const { meta } = options;
  if (!ID_PATTERN.test(meta.id)) throw new TemplateError(`template id "${meta.id}" must be kebab-case, like "my-review-gate"`);

  const { notes: _notes, template: _template, ...rest } = doc;
  let body: Graph = rest as Graph;
  if (options.kind === "fragment") body = fragmentOf(body, options.nodeIds ?? []);
  else if (options.nodeIds !== undefined) throw new TemplateError("nodeIds selects a fragment; pass kind: \"fragment\" with it");

  const taken = allIds(body);
  taken.delete(body.id);
  if (taken.has(meta.id)) throw new TemplateError(`template id "${meta.id}" is already the id of an object inside it; choose another`);

  const slots = [...(meta.slots ?? [])];
  for (const use of findSlots(body)) {
    if (!slots.some((slot) => slot.key === use.key)) slots.push({ key: use.key, ask: `What should "${use.key}" be?`, example: use.key });
  }

  const block: Template = {
    kind: options.kind,
    title: meta.title,
    summary: meta.summary,
    whenToUse: meta.whenToUse,
    profile: meta.profile ?? estimateProfile(body),
  };
  if (meta.notFor !== undefined) block.notFor = meta.notFor;
  if (slots.length > 0) block.slots = slots;
  if (meta.tags !== undefined && meta.tags.length > 0) block.tags = meta.tags;
  if (meta.demo !== undefined) block.demo = meta.demo;

  const lineage: NonNullable<Graph["lineage"]> = { from: `${doc.id}@${doc.version}` };
  if (doc.lineage?.pattern !== undefined) lineage.pattern = doc.lineage.pattern;
  return { ...body, id: meta.id, name: meta.title, version: 1, lineage, template: block };
}

function fragmentOf(doc: Graph, nodeIds: Id[]): Graph {
  if (nodeIds.length === 0) throw new TemplateError("a fragment needs at least one node id");
  const known = doc.nodes.map((node) => node.id);
  for (const id of nodeIds) {
    if (!known.includes(id)) throw new TemplateError(`no node "${id}" in "${doc.id}"${didYouMean(id, known)}`);
  }
  const inside = new Set(nodeIds);
  const edges = doc.edges.filter((edge) => inside.has(edge.from) && inside.has(edge.to));
  const edgeIds = new Set(edges.map((edge) => edge.id));
  const loops = doc.loops
    .filter((loop) => loop.members.length > 0 && loop.members.every((m) => inside.has(m)) && loop.back.every((b) => edgeIds.has(b)))
    .map((loop) => {
      // A stop that continued at a node left behind now halts; an answer key from outside is gone.
      const next: Loop = {
        ...loop,
        stops: loop.stops.map((stop) => {
          if (stop.then === undefined || inside.has(stop.then)) return stop;
          const { then: _then, ...kept } = stop;
          return kept as typeof stop;
        }),
      };
      if (loop.bar?.answerKeyFrom !== undefined && !inside.has(loop.bar.answerKeyFrom)) {
        const { answerKeyFrom: _key, ...bar } = loop.bar;
        next.bar = bar;
      }
      return next;
    });
  const loopIds = new Set(loops.map((loop) => loop.id));

  const groupIds = new Set<Id>();
  for (let grew = true; grew; ) {
    grew = false;
    for (const group of doc.groups ?? []) {
      if (groupIds.has(group.id) || group.members.length === 0) continue;
      if (group.members.every((m) => inside.has(m) || groupIds.has(m))) {
        groupIds.add(group.id);
        grew = true;
      }
    }
  }
  const scopedInside = (scope: PolicyScope): boolean => {
    if (scope === "graph") return false;
    const colon = scope.indexOf(":");
    const kind = scope.slice(0, colon);
    const target = scope.slice(colon + 1);
    return (kind === "node" && inside.has(target)) || (kind === "edge" && edgeIds.has(target)) || (kind === "loop" && loopIds.has(target));
  };

  const {
    goal: _goal,
    target: _target,
    constraints: _constraints,
    adaptation: _adaptation,
    description: _description,
    layout: _layout,
    policies,
    groups,
    ...rest
  } = doc;
  const fragment: Graph = {
    ...rest,
    nodes: doc.nodes.filter((node) => inside.has(node.id)),
    edges,
    loops,
  };
  const keptPolicies = (policies ?? []).filter((policy) => scopedInside(policy.scope));
  if (keptPolicies.length > 0) fragment.policies = keptPolicies;
  const keptGroups = (groups ?? []).filter((group) => groupIds.has(group.id));
  if (keptGroups.length > 0) fragment.groups = keptGroups;
  return fragment;
}

/**
 * A coarse profile read off the graph, for templates saved without one:
 * cost from the model tiers, speed from the loops and size, rigor from the
 * critics and gates. Meant to be corrected by hand when it reads wrong.
 */
export function estimateProfile(doc: Graph): Profile {
  const agents = doc.nodes.filter((node) => node.kind === "agent");
  const tiers = agents.map((node) => node.model?.tier ?? "strong");
  const critics = doc.nodes.filter(isCriticFamily).length;
  const gates = doc.nodes.filter((node) => node.kind === "human-gate").length;
  const judged = doc.loops.filter((loop) => loop.bar !== undefined).length;

  const cost: Profile["cost"] = tiers.includes("frontier") || agents.length >= 6 ? "high" : tiers.length > 0 && tiers.every((t) => t === "fast") ? "low" : "medium";
  const speed: Profile["speed"] = judged >= 2 || agents.length >= 6 ? "slow" : judged === 0 && gates === 0 && agents.length <= 3 ? "fast" : "medium";
  const answerKey = doc.loops.some((loop) => loop.bar?.answerKeyFrom !== undefined);
  const rigor: Profile["rigor"] = critics + gates === 0 ? "light" : critics >= 2 || answerKey ? "high" : "standard";
  return { cost, speed, rigor };
}

// ─── registry index ───────────────────────────────────────────────────────

/** One row of a registry's `index.json` (docs/templates.md §3). */
export type TemplateIndexEntry = {
  id: Id;
  version: number;
  kind: TemplateKind;
  title: string;
  summary: string;
  whenToUse: string;
  profile: Profile;
  tags?: string[];
  slots?: string[];
  /** the template's file, relative to the index */
  file: string;
  demo?: string;
};

export type TemplateIndex = { grooph: 0; generated?: string; templates: TemplateIndexEntry[] };

/** The index row for a template; `file` defaults to `<id>.grooph.json`. */
export function templateIndexEntry(template: Graph, file = `${template.id}.grooph.json`): TemplateIndexEntry {
  const block = requireTemplate(template);
  const slots = slotKeys(template);
  // Keys in the order docs/templates.md §3 lists them.
  return {
    id: template.id,
    version: template.version,
    kind: block.kind,
    title: block.title,
    summary: block.summary,
    whenToUse: block.whenToUse,
    profile: { cost: block.profile.cost, speed: block.profile.speed, rigor: block.profile.rigor },
    ...(block.tags !== undefined && block.tags.length > 0 ? { tags: [...block.tags] } : {}),
    ...(slots.length > 0 ? { slots } : {}),
    file,
    ...(block.demo !== undefined ? { demo: block.demo } : {}),
  };
}

/** A registry index over templates, sorted by id so it diffs quietly. */
export function templateIndex(entries: readonly TemplateIndexEntry[]): TemplateIndex {
  return { grooph: 0, templates: [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) };
}

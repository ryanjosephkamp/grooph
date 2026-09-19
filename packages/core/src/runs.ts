/**
 * Runs (docs/runs.md §2): reading what a harness left in a run folder.
 *
 *   parseRunNotes     notes.jsonl → notes, and the lines that could not be read
 *   summarizeRun      notes + the graph the run followed → states, rounds, timeline
 *   diffGraphs        source → working copy, as grooph ops with a line each
 *   explainChanges    each change → the amendment notes that account for it
 *   adoptWorkingCopy  the working copy as the next version of the source
 *   buildRunBundle    one run, self-contained (`*.grooph-run.json`)
 *
 * Pure like the rest of core: text and documents in, values out. grooph still
 * runs nothing; the CLI reads the files and the app reads bundles.
 */

import { canonicalize } from "./canonicalize.js";
import { formatIssue, type Issue } from "./issues.js";
import { OP_NAMES, applyOps, type Op, type OpName } from "./ops/apply.js";
import { newNode } from "./ops/edit.js";
import { runNoteSchema } from "./schema/graph.js";
import { runBundleSchema } from "./schema/run.js";
import type { SchemaIssue } from "./schema/dsl.js";
import type {
  BudgetMeasure,
  Edge,
  Graph,
  Id,
  Loop,
  Node,
  Policy,
  RunBundle,
  RunNote,
  RunNoteIssue,
  StopKind,
} from "./types.js";
import { validate } from "./validate.js";

// ─── notes.jsonl ──────────────────────────────────────────────────────────

export type ParsedRunNotes = { notes: RunNote[]; issues: RunNoteIssue[] };

/**
 * Line-tolerant: every line that is a run note (graph-ir §6) is kept, in
 * order; any other line becomes an issue with its line number. Blank lines
 * are skipped. Never throws: a line cut short while the lead was writing it
 * is an ordinary sight in a live run.
 */
export function parseRunNotes(text: string): ParsedRunNotes {
  const notes: RunNote[] = [];
  const issues: RunNoteIssue[] = [];
  const firstLine = new Map<Id, number>();
  text.split("\n").forEach((raw, i) => {
    const line = i + 1;
    const body = raw.trim();
    if (body === "") return;
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      issues.push({ line, message: "not JSON; a line cut short while it was being written looks like this" });
      return;
    }
    const found: SchemaIssue[] = [];
    runNoteSchema.check(json, "", found);
    if (found.length > 0) {
      issues.push({ line, message: `not a run note: ${found.map((f) => `${f.path === "" ? "/" : f.path} ${f.message}`).join("; ")}` });
      return;
    }
    const note = json as RunNote;
    const first = firstLine.get(note.id);
    if (first !== undefined) issues.push({ line, message: `id "${note.id}" was already used on line ${first}; both lines are kept` });
    else firstLine.set(note.id, line);
    notes.push(note);
  });
  return { notes, issues };
}

// ─── the summary ──────────────────────────────────────────────────────────

export type RunState = "running" | "halted" | "ended";
export type NodeRunState = "pending" | "running" | "passed" | "failed" | "halted";

export type NodeRun = {
  state: NodeRunState;
  /** dispatches seen: a started note, or a result with no started note before it */
  runs: number;
  lastOutcome?: string;
  lastVerdict?: string;
  round?: number;
  /** the last note about this node */
  lastNote?: Id;
};

export type LoopStop = {
  /** the loop note it comes from */
  note: Id;
  round?: number;
  outcome?: string;
  /** the stop that fired, when the note's outcome ends the loop and its text names one of the loop's stops */
  fired?: StopKind;
  text?: string;
};

export type LoopRun = {
  /** the latest round seen for this loop (graph-ir §2 "Rounds"); null before the loop is entered */
  round: number | null;
  lastStop?: LoopStop;
};

export type RunSummary = {
  run: string;
  state: RunState;
  /** the outcome of the note that ended or halted the run */
  outcome?: string;
  started?: string;
  ended?: string;
  nodes: Record<Id, NodeRun>;
  loops: Record<Id, LoopRun>;
  amendments: RunNote[];
  proposals: RunNote[];
  /** each measure summed over every note that carries a cost */
  cost: Partial<Record<BudgetMeasure, number>>;
  /** every note, in append order */
  timeline: RunNote[];
};

const RESULT_STATE: Record<string, NodeRunState> = {
  pass: "passed",
  fail: "failed",
  "invalid-evidence": "failed",
  halt: "halted",
};

/** What a note says about a node: dispatched, finished with a state, or nothing (commentary). */
function nodeEvent(note: RunNote): { kind: "started" } | { kind: "result"; state: NodeRunState } | undefined {
  if (note.outcome === "started") return { kind: "started" };
  // An outcome the lead named itself ("done", "reached") is a finished run, not a failure (graph-ir §6 leaves outcome open).
  if (note.outcome !== undefined) return { kind: "result", state: RESULT_STATE[note.outcome] ?? "passed" };
  if (note.ended !== undefined) return { kind: "result", state: "passed" };
  if (note.started !== undefined) return { kind: "started" };
  return undefined;
}

const target = (at: RunNote["at"]): { kind: "graph" | "node" | "edge" | "loop"; id?: Id } => {
  if (at === "graph") return { kind: "graph" };
  const colon = at.indexOf(":");
  return { kind: at.slice(0, colon) as "node" | "edge" | "loop", id: at.slice(colon + 1) };
};

/** A note at `graph` whose outcome closes the run: the lead's final note, or a halt. */
const closesRun = (note: RunNote): boolean => note.at === "graph" && note.outcome !== undefined && note.outcome !== "started";

/**
 * The run's state and every node's and loop's, from its notes, against the
 * graph the run followed (its working copy).
 *
 * A node is `running` when its last note is a start. The run is `ended` once
 * a note at `graph` records an outcome, `halted` when that outcome is `halt`
 * (a gate in a session that cannot ask, or a brake) or when a node halted and
 * nothing is running; notes about nodes after a halt mean the run resumed.
 */
export function summarizeRun(notes: readonly RunNote[], graph: Graph): RunSummary {
  const nodes: Record<Id, NodeRun> = {};
  for (const node of graph.nodes) nodes[node.id] = { state: "pending", runs: 0 };
  const loops: Record<Id, LoopRun> = {};
  for (const loop of graph.loops) loops[loop.id] = { round: null };
  const open = new Set<Id>();
  const cost: Partial<Record<BudgetMeasure, number>> = {};
  const innermost = innermostLoops(graph);

  for (const note of notes) {
    if (note.cost) cost[note.cost.measure] = (cost[note.cost.measure] ?? 0) + note.cost.amount;
    const where = target(note.at);
    if (where.kind === "node" && where.id !== undefined) {
      const run = (nodes[where.id] ??= { state: "pending", runs: 0 });
      const event = nodeEvent(note);
      if (event?.kind === "started") {
        run.runs += 1;
        run.state = "running";
        open.add(where.id);
      } else if (event?.kind === "result") {
        if (!open.delete(where.id)) run.runs += 1;
        run.state = event.state;
      }
      if (note.outcome !== undefined && note.outcome !== "started") run.lastOutcome = note.outcome;
      if (note.verdict !== undefined) run.lastVerdict = note.verdict;
      if (note.round !== undefined) {
        run.round = note.round;
        const loop = innermost.get(where.id);
        if (loop !== undefined) loops[loop]!.round = note.round;
      }
      run.lastNote = note.id;
    } else if (where.kind === "loop" && where.id !== undefined) {
      const loop = (loops[where.id] ??= { round: null });
      // Only a pass note (graph-ir §2: it carries the round and the stop evaluated) moves the loop; a proposal about it does not.
      if (note.round === undefined && note.outcome === undefined) continue;
      if (note.round !== undefined) loop.round = note.round;
      const graphLoop = graph.loops.find((l) => l.id === where.id);
      const fired = graphLoop ? firedStop(note, graphLoop) : undefined;
      loop.lastStop = {
        note: note.id,
        ...(note.round !== undefined ? { round: note.round } : {}),
        ...(note.outcome !== undefined ? { outcome: note.outcome } : {}),
        ...(fired ? { fired } : {}),
        ...(note.text !== undefined ? { text: note.text } : {}),
      };
    }
  }

  let state: RunState = "running";
  let closing: RunNote | undefined;
  const lastClose = findLastIndex(notes, closesRun);
  if (lastClose >= 0) {
    closing = notes[lastClose]!;
    const resumed = closing.outcome === "halt" && notes.slice(lastClose + 1).some((n) => n.at.startsWith("node:") && nodeEvent(n) !== undefined);
    state = resumed ? "running" : closing.outcome === "halt" ? "halted" : "ended";
    if (resumed) closing = undefined;
  } else if (open.size === 0 && Object.values(nodes).some((n) => n.state === "halted")) {
    const lastHalt = findLastIndex(notes, (n) => n.at.startsWith("node:") && n.outcome === "halt");
    closing = notes[lastHalt];
    state = "halted";
  }
  // A node dispatched and never heard from again, in a run that has stopped, did not finish.
  if (state !== "running") for (const id of open) nodes[id]!.state = "halted";

  const started = notes.find((n) => n.started !== undefined)?.started;
  const ended = state === "running" ? undefined : closing?.ended;
  return {
    run: notes[0]?.run ?? "",
    state,
    ...(state !== "running" && closing?.outcome !== undefined ? { outcome: closing.outcome } : {}),
    ...(started !== undefined ? { started } : {}),
    ...(ended !== undefined ? { ended } : {}),
    nodes,
    loops,
    amendments: notes.filter((n) => n.amendment !== undefined),
    proposals: notes.filter((n) => n.proposal !== undefined),
    cost,
    timeline: [...notes],
  };
}

/**
 * Each node's innermost loop: the smallest loop that holds it. A nested
 * loop's rounds restart each time the outer loop re-enters it (graph-ir §2),
 * so a note's `round` belongs to the innermost loop around its node.
 */
function innermostLoops(graph: Graph): Map<Id, Id> {
  const out = new Map<Id, Id>();
  for (const node of graph.nodes) {
    let best: Loop | undefined;
    for (const loop of graph.loops) {
      if (loop.members.includes(node.id) && (best === undefined || loop.members.length < best.members.length)) best = loop;
    }
    if (best) out.set(node.id, best.id);
  }
  return out;
}

/** How a lead's text names each stop kind. */
const STOP_WORDS: [StopKind, RegExp][] = [
  ["bar-passed", /\bbar[ -]pass(?:ed|es)\b/i],
  ["max-iterations", /\bmax[ -]iterations?\b/i],
  ["budget", /\bbudget\b/i],
  ["diminishing-returns", /\bdiminishing\b/i],
  ["evidence-invalid", /\bevidence[ -]invalid\b|\binvalid[ -]evidence\b/i],
  ["human", /\bhuman (?:stop|halt)\b/i],
];

/**
 * The stop that fired, as far as a loop note says. Run notes carry no
 * structured stop field (graph-ir §6), so this reads the text: only when the
 * note's outcome ends the loop (`pass` or `halt`), only the loop's own stop
 * kinds, and a mention followed by "fire" wins over a bare mention. When the
 * text is silent, a passing loop with a bar-passed stop passed its bar.
 */
function firedStop(note: RunNote, loop: Loop): StopKind | undefined {
  if (note.outcome !== "pass" && note.outcome !== "halt") return undefined;
  const text = note.text ?? "";
  const own = new Set(loop.stops.map((s) => s.kind));
  const mentioned = STOP_WORDS.filter(([kind, re]) => own.has(kind) && re.test(text));
  const firing = mentioned.filter(([, re]) => new RegExp(`${re.source}[^.;]{0,40}?\\bfire`, "i").test(text));
  if (firing.length === 1) return firing[0]![0];
  if (mentioned.length === 1) return mentioned[0]![0];
  if (note.outcome === "pass" && own.has("bar-passed") && mentioned.length === 0) return "bar-passed";
  return undefined;
}

function findLastIndex<T>(items: readonly T[], test: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) if (test(items[i]!)) return i;
  return -1;
}

/** A run's state in a few words: `ended · pass`, `running`, `halted · halt`. */
export const runStateLine = (summary: RunSummary): string =>
  [summary.state, summary.outcome].filter((part) => part !== undefined).join(" · ");

// ─── what the run changed ─────────────────────────────────────────────────

export type ChangedField = { key: string; before?: unknown; after?: unknown };

export type GraphChange = {
  /** one plain-language line */
  line: string;
  /** the op that makes this change, when a grooph op can express it */
  op?: Op;
  /** the object changed: `graph`, or a node, edge, loop or policy id */
  at: string;
  fields: ChangedField[];
};

export type GraphDiff = {
  changes: GraphChange[];
  /** the ops of `changes`, in an order that replays: `applyOps(source, ops)` */
  ops: Op[];
  /** true when replaying `ops` on the source gives the working copy, layout, notes and version aside */
  exact: boolean;
};

const same = (a: unknown, b: unknown): boolean => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const canon = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canon);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) if ((value as Record<string, unknown>)[key] !== undefined) out[key] = canon((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
};

/** The fields of `before` and `after` that differ, as a patch (`null` removes) and a list. */
function fieldDiff(before: Record<string, unknown>, after: Record<string, unknown>, skip: readonly string[]): { set: Record<string, unknown>; fields: ChangedField[] } {
  const set: Record<string, unknown> = {};
  const fields: ChangedField[] = [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !skip.includes(k));
  for (const key of keys) {
    if (same(before[key], after[key])) continue;
    set[key] = after[key] === undefined ? null : after[key];
    fields.push({ key, ...(before[key] !== undefined ? { before: before[key] } : {}), ...(after[key] !== undefined ? { after: after[key] } : {}) });
  }
  return { set, fields };
}

const FIELD_WORDS: Record<string, string> = {
  brief: "brief",
  outputs: "outputs",
  inputs: "inputs",
  allow: "allowed capabilities",
  deny: "denied capabilities",
  owns: "owned artifacts",
  irreversible: "irreversible actions",
  model: "model",
  effort: "effort",
  role: "role",
  name: "name",
  description: "description",
  prompt: "question",
  options: "options",
  check: "check",
  merges: "merged artifacts",
  strategy: "merge strategy",
  outcome: "outcome",
  coupled: "coupling",
  when: "condition",
  isolation: "isolation",
  concurrency: "concurrency",
  retry: "retries",
  evidence: "evidence",
  approval: "approval",
  label: "label",
  from: "start",
  to: "end",
  members: "members",
  back: "back edges",
  mode: "mode",
  bar: "bar",
  stops: "stops",
};

const words = (keys: string[]): string => {
  const named = keys.map((k) => FIELD_WORDS[k] ?? k);
  return named.length <= 1 ? (named[0] ?? "") : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
};

const CONSTRAINT_WORDS = { budget: "budget", time: "time limit", other: "other limits" } as const;
const GRAPH_FIELDS = ["name", "goal", "description", "adaptation", "lineage"] as const;

const nodeLabel = (node: Node): string => `${node.name || node.id} (${node.id})`;
const edgeLabel = (edge: Edge, doc: Graph): string => {
  const name = (id: Id) => doc.nodes.find((n) => n.id === id)?.name || id;
  return `edge ${name(edge.from)} → ${name(edge.to)} (${edge.id})`;
};
const loopLabel = (loop: Loop): string => `loop ${loop.name || loop.id} (${loop.id})`;
const policyKind = (policy: Policy): string => (typeof policy.kind === "string" ? policy.kind : `custom "${policy.kind.custom}"`);

/**
 * The change list from `source` to `working`, as grooph ops where ops can
 * express it and one plain-language line per change. Layout, run notes and
 * `version` are ignored (adoption sets the version). The ops are ordered so
 * that they replay: graph fields, additions, updates, policies, then
 * removals, so no cascade takes out something the working copy kept.
 */
export function diffGraphs(source: Graph, working: Graph): GraphDiff {
  const graphChanges: GraphChange[] = [];
  const adds: GraphChange[] = [];
  const updates: GraphChange[] = [];
  const policyChanges: GraphChange[] = [];
  const removals: GraphChange[] = [];
  const loose: GraphChange[] = [];

  // Graph fields.
  if (source.id !== working.id) {
    graphChanges.push({ line: `Renamed the graph id from ${source.id} to ${working.id}`, op: { op: "renameId", from: source.id, to: working.id }, at: "graph", fields: [{ key: "id", before: source.id, after: working.id }] });
  }
  for (const key of GRAPH_FIELDS) {
    if (same(source[key], working[key])) continue;
    const before = source[key];
    const after = working[key];
    const line =
      key === "name"
        ? `Renamed the graph from "${String(before ?? "")}" to "${String(after ?? "")}"`
        : key === "adaptation"
          ? `Adaptation: ${String(before ?? "adaptive (default)")} → ${String(after ?? "adaptive (default)")}`
          : `${after === undefined ? "Removed" : before === undefined ? "Added" : "Changed"} the graph's ${key}`;
    graphChanges.push({ line, op: { op: "setGraphField", key, value: after ?? null }, at: "graph", fields: [{ key, ...(before !== undefined ? { before } : {}), ...(after !== undefined ? { after } : {}) }] });
  }
  if (!same(source.target, working.target)) {
    const before = source.target?.harness;
    const after = working.target?.harness;
    graphChanges.push({ line: after === undefined ? "Removed the target harness" : `Target harness: ${before ?? "none"} → ${after}`, op: { op: "setTarget", harness: after ?? null }, at: "graph", fields: [{ key: "target", ...(before ? { before } : {}), ...(after ? { after } : {}) }] });
  }
  for (const key of ["budget", "time", "other"] as const) {
    const before = source.constraints?.[key];
    const after = working.constraints?.[key];
    if (before === after) continue;
    const verb = after === undefined ? "Removed" : before === undefined ? "Added" : "Changed";
    graphChanges.push({
      line: `${verb} the graph's ${CONSTRAINT_WORDS[key]} (constraints.${key})`,
      op: { op: "setConstraint", key, value: after ?? null },
      at: "graph",
      fields: [{ key: `constraints.${key}`, ...(before !== undefined ? { before } : {}), ...(after !== undefined ? { after } : {}) }],
    });
  }
  if (!same(source.template, working.template)) loose.push({ line: `${working.template ? "Changed" : "Removed"} the template block; no op expresses this`, at: "graph", fields: [{ key: "template", before: source.template, after: working.template }] });
  if (!same(source.groups, working.groups)) loose.push({ line: "Changed the groups; no op expresses this", at: "graph", fields: [{ key: "groups", before: source.groups, after: working.groups }] });
  const knownTop = new Set(["grooph", "id", "name", "version", "goal", "target", "constraints", "adaptation", "lineage", "template", "description", "nodes", "edges", "loops", "policies", "groups", "notes", "layout"]);
  for (const key of new Set([...Object.keys(source), ...Object.keys(working)])) {
    if (knownTop.has(key)) continue;
    const before = (source as Record<string, unknown>)[key];
    const after = (working as Record<string, unknown>)[key];
    if (!same(before, after)) loose.push({ line: `Changed the unknown key "${key}"; no op expresses this`, at: "graph", fields: [{ key, before, after }] });
  }

  // Nodes.
  const sourceNodes = new Map(source.nodes.map((n) => [n.id, n]));
  const workingNodes = new Map(working.nodes.map((n) => [n.id, n]));
  for (const node of working.nodes) {
    const before = sourceNodes.get(node.id);
    if (!before) {
      const { id, kind, name, ...rest } = node as Node & Record<string, unknown>;
      const set: Record<string, unknown> = { ...rest };
      for (const key of Object.keys(newNode(kind, id, name))) if (!(key in node) && !["id", "kind", "name"].includes(key)) set[key] = null;
      adds.push({
        line: `Added ${kind} node ${nodeLabel(node)}`,
        op: { op: "addNode", kind, id, name, ...(Object.keys(set).length > 0 ? { set } : {}) },
        at: id,
        fields: [],
      });
      continue;
    }
    if (before.kind !== node.kind) {
      loose.push({ line: `${nodeLabel(node)} changed kind from ${before.kind} to ${node.kind}; no op expresses this`, at: node.id, fields: [{ key: "kind", before: before.kind, after: node.kind }] });
      continue;
    }
    const { set, fields } = fieldDiff(before as Record<string, unknown>, node as Record<string, unknown>, ["id", "kind"]);
    if (fields.length > 0) updates.push({ line: `Changed the ${words(fields.map((f) => f.key))} of ${nodeLabel(node)}`, op: { op: "updateNode", id: node.id, set }, at: node.id, fields });
  }
  for (const node of source.nodes) {
    if (!workingNodes.has(node.id)) removals.push({ line: `Removed node ${nodeLabel(node)}`, op: { op: "removeNode", id: node.id }, at: node.id, fields: [] });
  }

  // Edges.
  const sourceEdges = new Map(source.edges.map((e) => [e.id, e]));
  const workingEdges = new Map(working.edges.map((e) => [e.id, e]));
  for (const edge of working.edges) {
    const before = sourceEdges.get(edge.id);
    if (!before) {
      const { id, from, to, ...rest } = edge;
      adds.push({ line: `Added ${edgeLabel(edge, working)}`, op: { op: "connect", from, to, id, ...(Object.keys(rest).length > 0 ? { set: rest } : {}) }, at: id, fields: [] });
      continue;
    }
    const { set, fields } = fieldDiff(before as Record<string, unknown>, edge as Record<string, unknown>, ["id"]);
    if (fields.length > 0) updates.push({ line: `Changed the ${words(fields.map((f) => f.key))} of ${edgeLabel(edge, working)}`, op: { op: "updateEdge", id: edge.id, set }, at: edge.id, fields });
  }
  for (const edge of source.edges) {
    if (!workingEdges.has(edge.id)) removals.push({ line: `Removed ${edgeLabel(edge, source)}`, op: { op: "removeEdge", id: edge.id }, at: edge.id, fields: [] });
  }

  // Loops.
  const sourceLoops = new Map(source.loops.map((l) => [l.id, l]));
  const workingLoops = new Map(working.loops.map((l) => [l.id, l]));
  for (const loop of working.loops) {
    const before = sourceLoops.get(loop.id);
    if (!before) {
      const { id, name, members, ...rest } = loop;
      adds.push({ line: `Added ${loopLabel(loop)}`, op: { op: "addLoop", members, name, id, set: rest }, at: id, fields: [] });
      continue;
    }
    const { set, fields } = fieldDiff(before as Record<string, unknown>, loop as Record<string, unknown>, ["id"]);
    if (fields.length > 0) updates.push({ line: `Changed the ${words(fields.map((f) => f.key))} of ${loopLabel(loop)}`, op: { op: "updateLoop", id: loop.id, set }, at: loop.id, fields });
  }
  for (const loop of source.loops) {
    if (!workingLoops.has(loop.id)) removals.push({ line: `Removed ${loopLabel(loop)}`, op: { op: "removeLoop", id: loop.id }, at: loop.id, fields: [] });
  }

  // Policies: no update op, so a changed policy is removed and added again.
  const sourcePolicies = new Map((source.policies ?? []).map((p) => [p.id, p]));
  const workingPolicies = new Map((working.policies ?? []).map((p) => [p.id, p]));
  for (const policy of source.policies ?? []) {
    const after = workingPolicies.get(policy.id);
    if (after && same(after, policy)) continue;
    policyChanges.push({ line: `${after ? "Replaced" : "Removed"} policy ${policyKind(policy)} on ${policy.scope} (${policy.id})`, op: { op: "removePolicy", id: policy.id }, at: policy.id, fields: [] });
  }
  for (const policy of working.policies ?? []) {
    const before = sourcePolicies.get(policy.id);
    if (before && same(before, policy)) continue;
    const change: GraphChange = {
      line: `${before ? "Now" : "Added"} policy ${policyKind(policy)} on ${policy.scope} (${policy.id})`,
      op: { op: "addPolicy", kind: policy.kind, scope: policy.scope, id: policy.id, ...(policy.params ? { params: policy.params } : {}) },
      at: policy.id,
      fields: [],
    };
    if (before) {
      // One line for a replaced policy; both ops stay, in order.
      const removal = policyChanges.find((c) => c.at === policy.id)!;
      removal.line = `Changed policy ${policyKind(policy)} on ${policy.scope} (${policy.id})`;
      removal.fields = [{ key: "policy", before, after: policy }];
      policyChanges.push({ ...change, line: "" });
    } else policyChanges.push(change);
  }

  // Removals last, and nodes after the edges and loops that named them.
  const order = { removeLoop: 0, removeEdge: 1, removeNode: 2 } as Record<string, number>;
  removals.sort((a, b) => (order[a.op!.op] ?? 0) - (order[b.op!.op] ?? 0));

  const withOps = [...graphChanges, ...adds, ...updates, ...policyChanges, ...removals];
  const ops = withOps.map((c) => c.op!);
  const changes = [...withOps, ...loose].filter((c) => c.line !== "");
  const replay = applyOps(source, ops);
  const exact = loose.length === 0 && replay.ok && comparable(replay.doc) === comparable(working);
  return { changes, ops, exact };
}

/** The document as `diffGraphs` compares it: layout, run notes and version left out. */
const comparable = (doc: Graph): string => {
  const { layout: _layout, notes: _notes, ...rest } = doc;
  return canonicalize({ ...rest, version: 0 } as Graph);
};

/**
 * For each change, the amendment notes that account for it: a note whose
 * op-list patch touches the same object (and, for an update, at least one of
 * the same fields); failing that, one whose text or patch names the object;
 * failing that, the only amendment when there is exactly one. An empty list
 * means no amendment explains the change, which the view says out loud.
 */
export function explainChanges(changes: readonly GraphChange[], amendments: readonly RunNote[]): Id[][] {
  const ops = amendments.map((note) => (isOpList(note.amendment?.patch) ? (note.amendment!.patch as Op[]) : []));
  return changes.map((change) => {
    const byPatch = amendments.filter((_, i) => ops[i]!.some((op) => opTouches(op, change)));
    if (byPatch.length > 0) return byPatch.map((n) => n.id);
    if (change.at !== "graph") {
      const word = new RegExp(`(^|[^a-z0-9-])${change.at.replace(/[-]/g, "\\-")}([^a-z0-9-]|$)`);
      const byName = amendments.filter((n) => word.test(`${n.amendment!.summary} ${n.amendment!.reason} ${JSON.stringify(n.amendment!.patch ?? "")}`));
      if (byName.length > 0) return byName.map((n) => n.id);
    }
    return amendments.length === 1 ? [amendments[0]!.id] : [];
  });
}

const OP_TARGET: Record<string, string> = {
  setGraphName: "graph", setGraphField: "graph", setTarget: "graph", setConstraint: "graph", renameId: "graph",
  addNode: "id", setNodeName: "id", updateNode: "id", removeNode: "id",
  connect: "id", updateEdge: "id", removeEdge: "id",
  addLoop: "id", setLoopName: "id", updateLoop: "id", removeLoop: "id",
  toggleLoopMember: "loop", toggleLoopBack: "loop", setBar: "loop", addStop: "loop", setStop: "loop", removeStop: "loop", moveStop: "loop",
  addPolicy: "id", removePolicy: "id",
};

function opTouches(op: Op, change: GraphChange): boolean {
  const key = OP_TARGET[op.op];
  if (key === undefined) return false;
  if (key === "graph") {
    if (change.at !== "graph") return false;
    if (op.op === "setConstraint") return change.fields.some((f) => f.key === `constraints.${String(op["key"])}`);
    if (op.op === "setGraphField") return change.fields.some((f) => f.key === op["key"]);
    if (op.op === "setGraphName") return change.fields.some((f) => f.key === "name");
    if (op.op === "setTarget") return change.fields.some((f) => f.key === "target");
    return op.op === "renameId" && change.fields.some((f) => f.key === "id");
  }
  if (op[key] !== change.at) return false;
  const set = op["set"];
  if (change.op?.op.startsWith("update") && set !== null && typeof set === "object" && !Array.isArray(set)) {
    return Object.keys(set).some((k) => change.fields.some((f) => f.key === k));
  }
  return true;
}

/** A patch grooph can replay: a list of `{ "op": <a grooph op>, … }`. */
export function isOpList(patch: unknown): patch is Op[] {
  return (
    Array.isArray(patch) &&
    patch.length > 0 &&
    patch.every((op) => op !== null && typeof op === "object" && !Array.isArray(op) && OP_NAMES.includes((op as { op?: unknown }).op as OpName))
  );
}

/** What kind of patch a proposal or amendment carries, in words a person can act on. */
export function describePatch(patch: unknown): { kind: "ops"; ops: Op[] } | { kind: "none" } | { kind: "other"; why: string } {
  if (patch === undefined || patch === null) return { kind: "none" };
  if (isOpList(patch)) return { kind: "ops", ops: patch };
  if (Array.isArray(patch) && patch.some((p) => p !== null && typeof p === "object" && "path" in p && "op" in p)) {
    return {
      kind: "other",
      why: "This patch uses index paths (JSON Patch), which grooph does not replay: paths like /nodes/2 point at whatever sits there now, so they break when anything is reordered. Read it and make the change by hand, or ask for it as grooph ops.",
    };
  }
  return { kind: "other", why: "This patch is not a list of grooph ops, so grooph cannot apply it. Read it and make the change by hand, or ask for it as grooph ops." };
}

// ─── adoption ─────────────────────────────────────────────────────────────

export type Adoption =
  | { ok: true; doc: Graph; from: string; run?: string }
  | { ok: false; message: string; issues: Issue[] };

/**
 * The working copy as the source's next version (docs/runs.md §2): the
 * source's `id` and `name` kept, `version + 1`, `lineage.from` naming the
 * version it came from. Notes pinned to the source stay; the run's notes are
 * not copied in (they live beside the graph). Layout comes from the working
 * copy when it has one, else from the source, for the nodes that remain.
 *
 * Refused when the result has errors that block export: a graph that cannot
 * run is not a version.
 */
export function adoptWorkingCopy(source: Graph, working: Graph, options: { run?: string } = {}): Adoption {
  const from = `${source.id}@${source.version}`;
  const { notes: _notes, layout: workingLayout, ...rest } = working;
  const layoutFrom = workingLayout ?? source.layout;
  const ids = new Set(working.nodes.map((n) => n.id));
  const layout = layoutFrom ? Object.fromEntries(Object.entries(layoutFrom).filter(([id]) => ids.has(id))) : undefined;
  const doc: Graph = {
    ...rest,
    id: source.id,
    name: source.name,
    version: source.version + 1,
    lineage: { ...working.lineage, from },
    ...(source.notes && source.notes.length > 0 ? { notes: source.notes } : {}),
    ...(layout && Object.keys(layout).length > 0 ? { layout } : {}),
  };
  const errors = validate(doc, { forExport: true }).filter((i) => i.severity === "error");
  if (errors.length > 0) {
    return {
      ok: false,
      message: `The working copy has ${errors.length === 1 ? "an error" : `${errors.length} errors`} that ${errors.length === 1 ? "blocks" : "block"} export, so it cannot become version ${source.version + 1} of ${source.id}. Discard it, or fix the working copy and adopt again. First: ${formatIssue(errors[0]!)}`,
      issues: errors,
    };
  }
  return { ok: true, doc, from, ...(options.run !== undefined ? { run: options.run } : {}) };
}

// ─── bundles ──────────────────────────────────────────────────────────────

/**
 * One run, self-contained (`*.grooph-run.json`): the source, the working
 * copy, the readable notes, the lines that were not, and the progress log.
 * `run` defaults to the notes' own run id.
 */
export function buildRunBundle(input: { source: Graph; working: Graph; notesText: string; progress?: string; run?: string }): RunBundle {
  const { notes, issues } = parseRunNotes(input.notesText);
  const run = input.run ?? notes[0]?.run ?? "run";
  return {
    groophRun: 0,
    run,
    ...(input.progress !== undefined ? { progress: input.progress } : {}),
    source: input.source,
    working: input.working,
    notes,
    ...(issues.length > 0 ? { issues } : {}),
  };
}

export const RUN_BUNDLE_VERSION = 0;

export type ParsedRunBundle = { bundle: RunBundle; issues: string[] } | { bundle?: undefined; issues: string[]; newer?: number };

/** A value that is evidently meant to be a run bundle. */
export const isRunBundleLike = (json: unknown): boolean =>
  typeof json === "object" && json !== null && !Array.isArray(json) && "groophRun" in json;

/**
 * Check an untrusted value (an imported file, a link, the watch endpoint)
 * against the bundle schema, graphs and notes included. `issues` are
 * `path: message` lines. Nothing is recomputed from what it claims: callers
 * summarise and diff from the documents themselves.
 */
export function parseRunBundle(json: unknown): ParsedRunBundle {
  if (isRunBundleLike(json)) {
    const version = (json as Record<string, unknown>)["groophRun"];
    if (typeof version === "number" && version > RUN_BUNDLE_VERSION) return { issues: [`/groophRun: made by a newer grooph (run format ${version})`], newer: version };
  }
  const found: SchemaIssue[] = [];
  runBundleSchema.check(json, "", found);
  if (found.length > 0) return { issues: found.map((f) => `${f.path === "" ? "/" : f.path}: ${f.message}`) };
  return { bundle: json as RunBundle, issues: [] };
}

export function parseRunBundleText(text: string): ParsedRunBundle {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    return { issues: [`/: not valid JSON: ${(err as Error).message}`] };
  }
  return parseRunBundle(json);
}

/** The bundle as a file: two-space JSON in schema key order, one trailing newline. */
export const canonicalizeRunBundle = (bundle: RunBundle): string => `${JSON.stringify(runBundleSchema.canon(bundle), null, 2)}\n`;

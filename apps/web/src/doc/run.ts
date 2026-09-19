/**
 * The run view's model (docs/runs.md §4): everything the screen shows about a
 * run, derived from the bundle alone. Core does the reading; this file only
 * arranges it for the screen, and computes the documents Adopt and Apply to a
 * copy would save, so the screen and its tests agree on them.
 */
import {
  adoptWorkingCopy,
  applyOps,
  describePatch,
  diffGraphs,
  explainChanges,
  formatOpError,
  summarizeRun,
  validate,
  type Adoption,
  type Graph,
  type GraphDiff,
  type Id,
  type Issue,
  type NodeRunState,
  type Op,
  type RunBundle,
  type RunNote,
  type RunSummary,
} from "@grooph/core";

export type RunModel = {
  bundle: RunBundle;
  summary: RunSummary;
  diff: GraphDiff;
  /** per change, the amendment notes that explain it */
  why: Id[][];
  adoption: Adoption;
  /** the source moved on after the run started: its version is not the working copy's */
  moved: boolean;
  /** the working copy as export sees it */
  issues: Issue[];
};

export function runModel(bundle: RunBundle): RunModel {
  const summary = summarizeRun(bundle.notes, bundle.working);
  const diff = diffGraphs(bundle.source, bundle.working);
  return {
    bundle,
    summary,
    diff,
    why: explainChanges(diff.changes, summary.amendments),
    adoption: adoptWorkingCopy(bundle.source, bundle.working, { run: bundle.run }),
    moved: bundle.source.version !== bundle.working.version,
    issues: validate(bundle.working, { forExport: true }),
  };
}

/** Where a note points, parsed: the graph, or a node, edge or loop id. */
export type NoteTarget = { kind: "graph" } | { kind: "node" | "edge" | "loop"; id: Id };

export function noteTarget(note: RunNote): NoteTarget {
  if (note.at === "graph") return { kind: "graph" };
  const colon = note.at.indexOf(":");
  return { kind: note.at.slice(0, colon) as "node" | "edge" | "loop", id: note.at.slice(colon + 1) };
}

/** A note's place in words: "Builder", "Loop Sandwich", "Edge Checks → Critic", "The run". */
export function targetLabel(target: NoteTarget, doc: Graph): string {
  if (target.kind === "graph") return "The run";
  const node = (id: Id) => doc.nodes.find((n) => n.id === id);
  if (target.kind === "node") return node(target.id)?.name || target.id;
  if (target.kind === "loop") return `Loop ${doc.loops.find((l) => l.id === target.id)?.name || target.id}`;
  const edge = doc.edges.find((e) => e.id === target.id);
  return edge ? `Edge ${node(edge.from)?.name || edge.from} → ${node(edge.to)?.name || edge.to}` : `Edge ${target.id}`;
}

/** The nodes and edges a note's target lights up on the canvas. */
export function targetHighlight(target: NoteTarget, doc: Graph): { nodes: Id[]; edges: Id[]; loop?: Id } {
  if (target.kind === "node") return { nodes: [target.id], edges: [] };
  if (target.kind === "edge") {
    const edge = doc.edges.find((e) => e.id === target.id);
    return { nodes: edge ? [edge.from, edge.to] : [], edges: [target.id] };
  }
  if (target.kind === "loop") {
    const loop = doc.loops.find((l) => l.id === target.id);
    return { nodes: loop?.members ?? [], edges: loop?.back ?? [], loop: target.id };
  }
  return { nodes: [], edges: [] };
}

/** The label a state shows beside its icon. A finished node shows the lead's own word when it used one. */
export function stateLabel(state: NodeRunState, lastOutcome?: string): string {
  if (state === "passed" && lastOutcome && !["pass", "fail", "halt", "invalid-evidence", "started"].includes(lastOutcome)) return lastOutcome;
  return state;
}

/** The outcome a note records, as the state it puts a node in, for its icon. */
export function outcomeState(outcome: string | undefined): NodeRunState | undefined {
  if (outcome === undefined) return undefined;
  if (outcome === "started") return "running";
  if (outcome === "pass") return "passed";
  if (outcome === "fail" || outcome === "invalid-evidence") return "failed";
  if (outcome === "halt") return "halted";
  return "passed";
}

/** Two lists of strings as what went and what came; order changes alone show as a reorder. */
export function listChange(before: unknown, after: unknown): { removed: string[]; added: string[]; kept: number; reordered: boolean } | undefined {
  const isList = (v: unknown): v is string[] => v === undefined || (Array.isArray(v) && v.every((x) => typeof x === "string"));
  if (!isList(before) || !isList(after) || (before === undefined && after === undefined)) return undefined;
  const b = before ?? [];
  const a = after ?? [];
  const removed = b.filter((x) => !a.includes(x));
  const added = a.filter((x) => !b.includes(x));
  const kept = b.length - removed.length;
  return { removed, added, kept, reordered: removed.length === 0 && added.length === 0 };
}

export type ProposalCopy = { ok: true; doc: Graph; issues: Issue[] } | { ok: false; message: string };

/**
 * "Apply to a copy": the proposal's ops applied to the working copy the run
 * proposed them against, as the source's next version, for the human to
 * inspect. Refused when the patch is not a grooph op list or does not apply.
 * Nothing is applied to anything that exists (spec §11).
 */
export function proposalCopy(bundle: RunBundle, note: RunNote): ProposalCopy {
  const patch = describePatch(note.proposal?.patch);
  if (patch.kind === "none") return { ok: false, message: "This proposal carries no patch, only its summary; make the change by hand if you agree with it." };
  if (patch.kind === "other") return { ok: false, message: patch.why };
  const applied = applyOps(bundle.working, patch.ops as Op[]);
  if (!applied.ok) return { ok: false, message: `The patch does not apply to the run's working copy: ${formatOpError(applied.error)}. Nothing was saved.` };
  const { source } = bundle;
  const { notes: _notes, ...rest } = applied.doc;
  const doc: Graph = {
    ...rest,
    id: source.id,
    name: source.name,
    version: source.version + 1,
    lineage: { ...applied.doc.lineage, from: `${source.id}@${source.version}` },
    ...(source.notes && source.notes.length > 0 ? { notes: source.notes } : {}),
  };
  return { ok: true, doc, issues: validate(doc, { forExport: true }) };
}

/** Timeline order: oldest first, or newest first while the run is live and running. */
export const orderedNotes = (summary: RunSummary, live: boolean): RunNote[] => (live && summary.state === "running" ? [...summary.timeline].reverse() : summary.timeline);

/** A run's key on this device, and in `#/run/<key>`. */
export const runKey = (bundle: RunBundle): string => `${bundle.working.id}/${bundle.run}`;
export const runHref = (key: string): string => `#/run/${encodeURIComponent(key)}`;

/** "12 min", "1 h 4 min": how long between two ISO times, when both parse. */
export function duration(started?: string, ended?: string): string | undefined {
  if (!started || !ended) return undefined;
  const ms = Date.parse(ended) - Date.parse(started);
  if (!Number.isFinite(ms) || ms < 0) return undefined;
  const minutes = Math.round(ms / 60_000);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

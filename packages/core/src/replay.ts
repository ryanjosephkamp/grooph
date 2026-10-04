/**
 * Replay (slice 0056): a recorded run as steps, so a page can play it on its
 * graph. Step 0 is the graph before the run; step k is the run as its first k
 * notes left it, with the summary `summarizeRun` gives for those notes, the
 * object the k-th note was about, and one line to read under the scrubber.
 * The last step's `end` says how the run stopped: each loop's stop that fired
 * and where the run itself ended or halted.
 *
 * Pure like the rest of core. Nothing is inferred beyond what `summarizeRun`
 * already reads: a step is a note, in append order.
 */

import { summarizeRun, type RunSummary } from "./runs.js";
import type { Graph, Id, RunNote, StopKind } from "./types.js";

export type ReplayFocus = { kind: "graph" } | { kind: "node" | "loop" | "edge"; id: Id };

export type ReplayStep = {
  /** 0 before the first note; k after the k-th note */
  index: number;
  /** the note this step plays; none at step 0 */
  note?: RunNote;
  /** the run as the notes up to this step leave it */
  summary: RunSummary;
  /** what the note is about */
  focus?: ReplayFocus;
  /** one short line: who did what, and in which round */
  caption: string;
};

export type ReplayLoopEnd = { loop: Id; name: string; round?: number; outcome?: string; fired?: StopKind };

export type ReplayEnd = {
  state: RunSummary["state"];
  outcome?: string;
  /** each loop the run entered, with the stop that ended it when the notes name one */
  loops: ReplayLoopEnd[];
  /** the node the run ended or halted at, when the notes show one */
  at?: { id: Id; name: string; kind: string };
  /** one or two sentences: which stop ended the run */
  line: string;
};

export type Replay = { steps: ReplayStep[]; end: ReplayEnd };

/** A stop kind in a person's words (graph-ir §2). */
export const STOP_KIND_WORDS: Record<StopKind, string> = {
  "bar-passed": "bar passed",
  "max-iterations": "max iterations",
  budget: "budget",
  "diminishing-returns": "diminishing returns",
  "evidence-invalid": "evidence invalid",
  human: "human stop",
};

const at = (note: RunNote): ReplayFocus => {
  if (note.at === "graph") return { kind: "graph" };
  const colon = note.at.indexOf(":");
  return { kind: note.at.slice(0, colon) as "node" | "loop" | "edge", id: note.at.slice(colon + 1) };
};

const roundOf = (note: RunNote): string => (note.round !== undefined ? ` · round ${note.round}` : "");

function caption(note: RunNote, graph: Graph): string {
  const focus = at(note);
  const nodeName = (id: Id): string => graph.nodes.find((n) => n.id === id)?.name || id;
  const outcome = note.outcome;
  if (focus.kind === "graph") {
    if (outcome === undefined) return note.started !== undefined && note.ended === undefined ? "Run started" : "Run note";
    if (outcome === "ending") return "Run ending";
    if (outcome === "halt") return "Run halted";
    return `Run ended · ${outcome}`;
  }
  if (focus.kind === "node") {
    const name = nodeName(focus.id);
    if (outcome === "started") return `${name} dispatched${roundOf(note)}`;
    if (outcome === "halt") return `${name} halted${roundOf(note)}`;
    if (outcome !== undefined && outcome !== "ending") return `${name}: ${note.verdict && note.verdict !== outcome ? `${outcome} (${note.verdict})` : outcome}${roundOf(note)}`;
    if (note.amendment) return `${name}: amendment${roundOf(note)}`;
    if (note.proposal) return `${name}: proposal${roundOf(note)}`;
    return `${name}${roundOf(note)}`;
  }
  if (focus.kind === "loop") {
    const loop = graph.loops.find((l) => l.id === focus.id);
    const name = loop?.name || focus.id;
    const stop = note.stop && note.stop in STOP_KIND_WORDS ? ` · ${STOP_KIND_WORDS[note.stop as StopKind]}` : "";
    if (note.round !== undefined && outcome !== undefined) return `${name}: round ${note.round} ends, ${outcome}${stop}`;
    if (note.proposal) return `${name}: proposal`;
    return `${name}${roundOf(note)}${stop}`;
  }
  const edge = graph.edges.find((e) => e.id === focus.id);
  return edge ? `${nodeName(edge.from)} → ${nodeName(edge.to)}${roundOf(note)}` : `Edge ${focus.id}`;
}

/** Where the run stopped: the node of the closing note, or the stop node the last note before the end reached. */
function endedAt(notes: readonly RunNote[], graph: Graph, summary: RunSummary): ReplayEnd["at"] {
  const node = (id: Id | undefined) => {
    const found = id === undefined ? undefined : graph.nodes.find((n) => n.id === id);
    return found ? { id: found.id, name: found.name || found.id, kind: found.kind } : undefined;
  };
  if (summary.state === "halted") {
    for (let i = notes.length - 1; i >= 0; i--) {
      const f = at(notes[i]!);
      if (f.kind === "node" && notes[i]!.outcome === "halt") return node(f.id);
    }
  }
  for (let i = notes.length - 1; i >= 0; i--) {
    const f = at(notes[i]!);
    const id = f.kind === "node" ? f.id : f.kind === "edge" ? graph.edges.find((e) => e.id === f.id)?.to : undefined;
    const found = node(id);
    if (found?.kind === "stop") return found;
    if (found && summary.state === "halted" && found.kind === "human-gate") return found;
  }
  return undefined;
}

function endLine(end: Omit<ReplayEnd, "line">, running: boolean): string {
  const loopParts = end.loops
    .filter((l) => l.fired !== undefined)
    .map((l) => `${l.name} stopped on ${STOP_KIND_WORDS[l.fired!]}${l.round !== undefined ? ` in round ${l.round}` : ""}`);
  const where = end.at ? ` at ${end.at.name}${end.at.kind === "human-gate" ? " (a human gate)" : ""}` : "";
  const run = running
    ? "The record stops while the run was still going."
    : end.state === "halted"
      ? `The run halted${where}.`
      : `The run ended${where}${end.outcome ? `: ${end.outcome}` : ""}.`;
  if (loopParts.length === 0) {
    const entered = end.loops.filter((l) => l.round !== undefined);
    const noStop = entered.length > 0 ? ` No loop stop fired; ${entered.map((l) => `${l.name} ran to round ${l.round}`).join(", ")}.` : "";
    return `${run}${noStop}`;
  }
  return `${loopParts.join(". ")}. ${run}`;
}

/** A run's notes on the graph it followed, as steps to play. */
export function replaySteps(notes: readonly RunNote[], graph: Graph): Replay {
  const steps: ReplayStep[] = [{ index: 0, summary: summarizeRun([], graph), caption: "Before the run" }];
  notes.forEach((note, i) => {
    steps.push({ index: i + 1, note, summary: summarizeRun(notes.slice(0, i + 1), graph), focus: at(note), caption: caption(note, graph) });
  });
  const last = steps[steps.length - 1]!.summary;
  const loops: ReplayLoopEnd[] = graph.loops
    .filter((l) => last.loops[l.id]?.round !== null && last.loops[l.id] !== undefined)
    .map((l) => {
      const run = last.loops[l.id]!;
      const stop = run.lastStop;
      return {
        loop: l.id,
        name: l.name || l.id,
        ...(run.round !== null ? { round: stop?.round ?? run.round } : {}),
        ...(stop?.outcome !== undefined ? { outcome: stop.outcome } : {}),
        ...(stop?.fired !== undefined ? { fired: stop.fired } : {}),
      };
    });
  const where = notes.length > 0 ? endedAt(notes, graph, last) : undefined;
  const partial = { state: last.state, ...(last.outcome !== undefined ? { outcome: last.outcome } : {}), loops, ...(where ? { at: where } : {}) };
  return { steps, end: { ...partial, line: notes.length === 0 ? "The run has no notes yet." : endLine(partial, last.state === "running") } };
}

/**
 * Runs (docs/runs.md §2) against the real record of slice 0007's run,
 * copied into fixtures/runs/, and five synthetic runs beside it: a malformed
 * line, a node still running, a halt at a gate, nested loops, and a working
 * copy with export errors.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { deflateRawSync, inflateRawSync } from "node:zlib";

import { Ajv2020 } from "ajv/dist/2020.js";

import { canonicalize } from "../src/canonicalize.js";
import { applyOps } from "../src/ops/apply.js";
import { parseGraphText } from "../src/parse.js";
import {
  adoptWorkingCopy,
  buildRunBundle,
  canonicalizeRunBundle,
  describePatch,
  diffGraphs,
  explainChanges,
  isOpList,
  parseRunBundle,
  parseRunBundleText,
  parseRunNotes,
  runStateLine,
  summarizeRun,
} from "../src/runs.js";
import { graphJsonSchema } from "../src/schema/graph.js";
import { RUN_SCHEMA_PATH } from "../src/schema/path.js";
import { runJsonSchema } from "../src/schema/run.js";
import { buildShareEnvelope, decodeSharePayload, encodeSharePayload, parseShareEnvelope, ShareError, type InflateRaw } from "../src/share.js";
import type { Graph, RunBundle, RunNote } from "../src/types.js";
import { validate } from "../src/validate.js";
import { fixturesDir, read } from "./helpers.js";

const runs = join(fixturesDir, "runs");

/** A run folder in the fixtures, as `.grooph/<graph-id>/runs/<run-id>/` lays it out. */
function load(graphId: string) {
  const graphDir = join(runs, graphId);
  const runId = readdirSync(join(graphDir, "runs"))[0]!;
  const runDir = join(graphDir, "runs", runId);
  const graph = (path: string): Graph => {
    const parsed = parseGraphText(read(path));
    assert.deepEqual(parsed.issues, [], `${path} is a graph document`);
    return parsed.doc!;
  };
  const notesText = read(join(runDir, "notes.jsonl"));
  let progress: string | undefined;
  try {
    progress = read(join(runDir, "PROGRESS.md"));
  } catch {
    progress = undefined;
  }
  return { runId, runDir, source: graph(join(graphDir, "graph.grooph.json")), working: graph(join(runDir, "graph.grooph.json")), notesText, progress };
}

const real = () => load("slice-0007-sandwich");
const REAL_RUN = "20260919-0057-66c8";

const summaryOf = (graphId: string) => {
  const run = load(graphId);
  return summarizeRun(parseRunNotes(run.notesText).notes, run.working);
};

const note = (fields: Partial<RunNote> & Pick<RunNote, "id" | "at">): RunNote => ({ run: "r", ...fields });

// ─── parseRunNotes ────────────────────────────────────────────────────────

test("the real notes parse whole: fifteen notes, no issues, in append order", () => {
  const { notes, issues } = parseRunNotes(real().notesText);
  assert.deepEqual(issues, []);
  assert.equal(notes.length, 15);
  assert.deepEqual(notes.map((n) => n.id), Array.from({ length: 15 }, (_, i) => `n-${String(i + 1).padStart(4, "0")}`));
  assert.ok(notes.every((n) => n.run === REAL_RUN));
});

test("a malformed line is an issue with its line number, never a throw; the lines around it stay", () => {
  const { notes, issues } = parseRunNotes(load("run-malformed").notesText);
  assert.deepEqual(notes.map((n) => n.id), ["n-0001", "n-0002", "n-0005"]);
  assert.deepEqual(issues.map((i) => i.line), [3, 4]);
  assert.match(issues[0]!.message, /not JSON/);
  assert.match(issues[1]!.message, /\/at .*nodes:critic/);
});

test("parseRunNotes tolerates anything: empty text, CRLF, garbage, a repeated id", () => {
  assert.deepEqual(parseRunNotes(""), { notes: [], issues: [] });
  const text = '{"id":"n-1","run":"r","at":"graph"}\r\n\r\n[1,2]\r\nnull\n{"id":"n-1","run":"r","at":"graph","text":"again"}';
  const { notes, issues } = parseRunNotes(text);
  assert.equal(notes.length, 2);
  assert.deepEqual(issues.map((i) => i.line), [3, 4, 5]);
  assert.match(issues[2]!.message, /already used on line 1/);
});

// ─── summarizeRun ─────────────────────────────────────────────────────────

test("the real run: ended with pass, every node's runs and last result, loop round 1 with bar passed", () => {
  const s = summaryOf("slice-0007-sandwich");
  assert.equal(s.run, REAL_RUN);
  assert.equal(s.state, "ended");
  assert.equal(s.outcome, "pass");
  assert.equal(runStateLine(s), "ended · pass");
  assert.equal(s.started, "2026-09-19T04:57:20Z");
  assert.equal(s.ended, "2026-09-19T05:38:15Z");
  assert.deepEqual(s.nodes["builder"], { state: "passed", runs: 2, lastOutcome: "pass", lastVerdict: "done", round: 1, lastNote: "n-0009" });
  assert.deepEqual(s.nodes["checks"], { state: "passed", runs: 2, lastOutcome: "pass", round: 1, lastNote: "n-0010" });
  assert.deepEqual(s.nodes["critic"], { state: "passed", runs: 2, lastOutcome: "pass", lastVerdict: "pass", round: 1, lastNote: "n-0011" });
  assert.deepEqual(s.nodes["done"], { state: "passed", runs: 1, lastOutcome: "pass", lastNote: "n-0013" });
  assert.equal(s.loops["sandwich"]!.round, 1);
  assert.equal(s.loops["sandwich"]!.lastStop?.fired, "bar-passed");
  assert.equal(s.loops["sandwich"]!.lastStop?.note, "n-0012");
  assert.deepEqual(s.amendments.map((n) => n.id), ["n-0002"]);
  assert.deepEqual(s.proposals.map((n) => n.id), ["n-0008"]);
  assert.deepEqual(s.cost, { minutes: 26, turns: 31 });
  assert.equal(s.timeline.length, 15);
});

test("round 0's loop note names stops without one firing, so none is claimed", () => {
  const { notes } = parseRunNotes(real().notesText);
  const s = summarizeRun(notes.slice(0, 7), real().working);
  assert.equal(s.state, "running");
  assert.equal(s.loops["sandwich"]!.round, 0);
  assert.equal(s.loops["sandwich"]!.lastStop?.outcome, "fail");
  assert.equal(s.loops["sandwich"]!.lastStop?.fired, undefined);
  assert.equal(s.nodes["critic"]!.state, "failed");
  assert.equal(s.nodes["done"]!.state, "pending");
});

test("a loop note's `stop` names the stop that fired; the text is read only for notes without one (graph-ir §6)", () => {
  const run = load("run-gate");
  const { notes } = parseRunNotes(run.notesText);
  const withStop = notes.map((n) => (n.id === "n-0006" ? { ...n, stop: "max-iterations", text: "the bar passed, so the loop ends" } : n));
  assert.equal(summarizeRun(withStop, run.working).loops["review-cycle"]!.lastStop?.fired, "max-iterations", "the field wins over the text");
  const unknownStop = notes.map((n) => (n.id === "n-0006" ? { ...n, stop: "lunch" } : n));
  assert.equal(summarizeRun(unknownStop, run.working).loops["review-cycle"]!.lastStop?.fired, undefined, "a stop no loop can have is not claimed");
  const budgetNote = [...notes.slice(0, 5), note({ id: "n-0006", at: "loop:review-cycle", round: 0, outcome: "halt", stop: "budget" })];
  assert.equal(summarizeRun(budgetNote, run.working).loops["review-cycle"]!.lastStop?.fired, "budget", "no text needed");
});

test("started notes: a node whose last note is a start is running, and so is the run", () => {
  const s = summaryOf("run-live");
  assert.equal(s.state, "running");
  assert.equal(s.ended, undefined);
  assert.equal(s.outcome, undefined);
  assert.deepEqual(s.nodes["builder"], { state: "passed", runs: 1, lastOutcome: "pass", round: 0, lastNote: "n-0003" });
  assert.deepEqual(s.nodes["critic"], { state: "running", runs: 1, round: 0, lastNote: "n-0004" });
  assert.equal(s.nodes["merge-gate"]!.state, "pending");
  assert.equal(s.loops["review-cycle"]!.round, 0);
});

test("halted at a gate: the run is halted, the gate halted, the bar-passed stop read from the loop note", () => {
  const s = summaryOf("run-gate");
  assert.equal(s.state, "halted");
  assert.equal(runStateLine(s), "halted");
  assert.equal(s.outcome, "halt");
  assert.equal(s.ended, "2026-09-19T12:14:06Z");
  assert.equal(s.nodes["merge-gate"]!.state, "halted");
  assert.equal(s.nodes["done"]!.state, "pending");
  // The proposal note sits at the loop but is not a pass note, so it does not replace the last stop.
  assert.equal(s.loops["review-cycle"]!.lastStop?.note, "n-0006");
  assert.equal(s.loops["review-cycle"]!.lastStop?.fired, "bar-passed");
  assert.deepEqual(s.proposals.map((n) => n.id), ["n-0007"]);
  assert.deepEqual(s.cost, { turns: 10 });
});

test("a run resumes after a halt when notes about nodes follow it", () => {
  const run = load("run-gate");
  const { notes } = parseRunNotes(run.notesText);
  const resumed = [...notes, note({ id: "n-0010", at: "node:merge-gate", outcome: "pass", verdict: "approve" }), note({ id: "n-0011", at: "node:done", outcome: "started" })];
  const s = summarizeRun(resumed, run.working);
  assert.equal(s.state, "running");
  assert.equal(s.outcome, undefined);
  assert.equal(s.nodes["merge-gate"]!.state, "passed");
  assert.equal(s.nodes["done"]!.state, "running");
});

test("a halt at a node with no closing note still halts the run; a node started and never finished in a stopped run is halted", () => {
  const graph = load("run-gate").working;
  const s = summarizeRun([note({ id: "a", at: "node:builder", outcome: "started" }), note({ id: "b", at: "node:builder", outcome: "halt" })], graph);
  assert.equal(s.state, "halted");
  const t = summarizeRun([note({ id: "a", at: "node:builder", outcome: "started" }), note({ id: "b", at: "graph", outcome: "fail", ended: "x" })], graph);
  assert.equal(t.state, "ended");
  assert.equal(t.ended, "x");
  assert.equal(t.nodes["builder"]!.state, "halted");
  const u = summarizeRun([note({ id: "a", at: "node:builder", outcome: "done" }), note({ id: "b", at: "node:critic", outcome: "invalid-evidence" })], graph);
  assert.equal(u.nodes["builder"]!.state, "passed", "an outcome the lead named itself is a finished run");
  assert.equal(u.nodes["builder"]!.lastOutcome, "done");
  assert.equal(u.nodes["critic"]!.state, "failed");
  const v = summarizeRun([], graph);
  assert.equal(v.state, "running");
  assert.equal(v.run, "");
  assert.equal(v.loops["review-cycle"]!.round, null);
});

test("nested loops: the inner round restarts inside the outer loop; each counter follows its own loop", () => {
  const s = summaryOf("run-nested");
  assert.equal(s.state, "running");
  assert.equal(s.loops["grind"]!.round, 0, "phase 2's grind is on its first pass again");
  assert.equal(s.loops["phases"]!.round, 1, "the judge's round belongs to the outer loop");
  assert.equal(s.loops["phases"]!.lastStop?.outcome, "fail");
  assert.equal(s.loops["grind"]!.lastStop?.note, "n-0012");
  assert.equal(s.nodes["builder"]!.runs, 3);
  assert.equal(s.nodes["judge"]!.state, "running");
  assert.equal(s.nodes["judge"]!.lastVerdict, "next-phase");
});

test("notes about objects the graph lacks are kept in the timeline and do not break the summary", () => {
  const graph = real().working;
  const s = summarizeRun([note({ id: "a", at: "node:ghost", outcome: "pass" }), note({ id: "b", at: "loop:nowhere", round: 3 }), note({ id: "c", at: "edge:e-builder-checks", text: "hi" })], graph);
  assert.equal(s.timeline.length, 3);
  assert.equal(s.nodes["ghost"]!.state, "passed");
  assert.equal(s.loops["nowhere"]!.round, 3);
});

// ─── diffGraphs ───────────────────────────────────────────────────────────

test("the real run's diff is amendment n-0002's three string changes and nothing else, as ops that replay", () => {
  const { source, working, runDir } = real();
  const diff = diffGraphs(source, working);
  assert.deepEqual(
    diff.changes.map((c) => c.line),
    ["Changed the graph's other limits (constraints.other)", "Changed the outputs of Builder (builder)", "Changed the outputs of Critic (critic)"],
  );
  assert.deepEqual(diff.ops.map((op) => op.op), ["setConstraint", "updateNode", "updateNode"]);
  // The lead's own record of the amendment, amend-01.ops.json, is the same op list.
  assert.deepEqual(diff.ops, JSON.parse(read(join(runDir, "amend-01.ops.json"))));
  assert.equal(diff.exact, true);
  const replay = applyOps(source, diff.ops);
  assert.ok(replay.ok);
  assert.equal(canonicalize(replay.doc), canonicalize(working));
  assert.deepEqual(diff.changes[0]!.fields.map((f) => f.key), ["constraints.other"]);
  assert.match(String(diff.changes[0]!.fields[0]!.before), /^Touch apps\/web only\./);
  assert.deepEqual(explainChanges(diff.changes, summaryOf("slice-0007-sandwich").amendments), [["n-0002"], ["n-0002"], ["n-0002"]]);
});

test("diffGraphs covers additions, updates, re-routes, loops, policies and removals, and replays exactly", () => {
  const source = real().source;
  const edited = applyOps(source, [
    { op: "setGraphField", key: "description", value: null },
    { op: "setGraphField", key: "adaptation", value: "propose" },
    { op: "setConstraint", key: "budget", value: "about 60 turns" },
    { op: "addNode", kind: "agent", id: "security", name: "Security critic", set: { role: "critic", brief: "Look for injection.", outputs: ["SECURITY.md"], allow: ["read-files", "write-outputs"], model: { tier: "frontier" } } },
    { op: "addNode", kind: "human-gate", id: "gate", name: "Ship it?", set: { prompt: "Ship?" } },
    { op: "updateNode", id: "critic", set: { effort: "max", brief: "Judge harder." } },
    { op: "updateEdge", id: "e-critic-pass", set: { to: "security" } },
    { op: "connect", from: "security", to: "gate", id: "e-security-gate", set: { when: "pass", evidence: ["SECURITY.md"] } },
    { op: "connect", from: "gate", to: "done", id: "e-gate-done" },
    { op: "connect", from: "security", to: "builder", id: "e-security-fail", set: { when: "fail", evidence: ["SECURITY.md"] } },
    { op: "addLoop", id: "harden", name: "Harden", members: ["builder", "checks", "critic", "security"], set: { back: ["e-security-fail"], mode: "judgment", bar: { name: "No findings", inspects: [{ kind: "file", ref: "SECURITY.md" }], acceptance: "No open finding." }, stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 2 }] } },
    { op: "updateLoop", id: "sandwich", set: { stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 3 }, { kind: "budget", measure: "turns", limit: 80 }] } },
    { op: "removePolicy", id: "p-no-self-grading" },
    { op: "addPolicy", kind: "concurrency-cap", scope: "graph", params: { max: 2 }, id: "p-cap" },
    { op: "setPositions", positions: { builder: { x: 1, y: 2 } } },
  ]);
  assert.ok(edited.ok, JSON.stringify(!edited.ok && edited.error));
  const working = { ...edited.doc, notes: [note({ id: "n-x", at: "graph", text: "a pinned note" })] };
  const diff = diffGraphs(source, working);
  assert.equal(diff.exact, true, diff.changes.map((c) => c.line).join("\n"));
  assert.deepEqual(diff.changes.map((c) => c.line), [
    "Removed the graph's description",
    "Adaptation: adaptive (default) → propose",
    "Added the graph's budget (constraints.budget)",
    "Added agent node Security critic (security)",
    "Added human-gate node Ship it? (gate)",
    "Added edge Security critic → Ship it? (e-security-gate)",
    "Added edge Ship it? → Done (e-gate-done)",
    "Added edge Security critic → Builder (e-security-fail)",
    "Added loop Harden (harden)",
    "Changed the effort and brief of Critic (critic)",
    "Changed the end of edge Critic → Security critic (e-critic-pass)",
    "Changed the stops of loop Sandwich (sandwich)",
    "Removed policy no-self-grading on graph (p-no-self-grading)",
    "Added policy concurrency-cap on graph (p-cap)",
  ]);

  // Removing a node the working copy no longer has, with its edges and loop membership.
  const shrunk = applyOps(source, [{ op: "removeNode", id: "critic" }, { op: "connect", from: "checks", to: "done", id: "e-checks-done", set: { when: "pass" } }]);
  assert.ok(shrunk.ok);
  const back = diffGraphs(source, shrunk.doc);
  assert.equal(back.exact, true, back.changes.map((c) => c.line).join("\n"));
  assert.deepEqual(back.ops.map((op) => op.op), ["connect", "updateLoop", "removeEdge", "removeEdge", "removeEdge", "removeNode"]);
  assert.ok(back.changes.some((c) => c.line === "Removed node Critic (critic)"));
});

test("layout, run notes and version are not changes; a kind change or a group change has a line but no op", () => {
  const source = real().source;
  assert.deepEqual(diffGraphs(source, { ...source, version: 7, layout: { builder: { x: 3, y: 4 } }, notes: [note({ id: "z", at: "graph" })] }).changes, []);
  const kinds = { ...source, nodes: source.nodes.map((n) => (n.id === "done" ? { id: "done", kind: "human-gate" as const, name: "Done", prompt: "ok?" } : n)), groups: [{ id: "g", name: "G", members: ["builder"] }] };
  const diff = diffGraphs(source, kinds);
  assert.equal(diff.exact, false);
  assert.deepEqual(diff.changes.map((c) => [c.line, c.op]), [
    ["Changed the groups; no op expresses this", undefined],
    ["Done (done) changed kind from stop to human-gate; no op expresses this", undefined],
  ]);
});

test("the broken working copy's diff does not replay, and says so", () => {
  const { source, working } = load("run-broken");
  const diff = diffGraphs(source, working);
  assert.equal(diff.exact, false);
  assert.deepEqual(diff.changes.map((c) => c.line), ["Added agent node Docs writer (docs)", "Added edge Critic → doc (e-critic-docs)"]);
});

test("explainChanges matches by patch, then by name, then the only amendment; otherwise nothing", () => {
  const source = real().source;
  const edited = applyOps(source, [
    { op: "updateNode", id: "builder", set: { effort: "max" } },
    { op: "updateNode", id: "critic", set: { effort: "max" } },
    { op: "setConstraint", key: "time", value: "an hour" },
  ]);
  assert.ok(edited.ok);
  const changes = diffGraphs(source, edited.doc).changes;
  const a = note({ id: "a1", at: "graph", amendment: { summary: "builder effort up", reason: "hard task", patch: [{ op: "updateNode", id: "builder", set: { effort: "max" } }] } });
  const b = note({ id: "a2", at: "graph", amendment: { summary: "the critic needs more effort", reason: "subtle bugs" } });
  assert.deepEqual(changes.map((c) => c.at), ["graph", "builder", "critic"]);
  assert.deepEqual(explainChanges(changes, [a, b]), [[], ["a1"], ["a2"]]);
  assert.deepEqual(explainChanges(changes, [b]), [["a2"], ["a2"], ["a2"]]);
  assert.deepEqual(explainChanges(changes, []), [[], [], []]);
  // An amendment with an op list explains only what its ops touch, even when it is the only one.
  assert.deepEqual(explainChanges(changes, [a]), [[], ["a1"], []]);
});

// ─── patches ──────────────────────────────────────────────────────────────

test("describePatch: the real n-0008 patch is an op list; JSON Patch and prose are explained, not applied", () => {
  const { notes } = parseRunNotes(real().notesText);
  const n0008 = notes.find((n) => n.id === "n-0008")!;
  const described = describePatch(n0008.proposal!.patch);
  assert.equal(described.kind, "ops");
  const applied = applyOps(real().working, isOpList(n0008.proposal!.patch) ? n0008.proposal!.patch : []);
  assert.ok(applied.ok);
  assert.equal(applied.doc.edges.find((e) => e.id === "e-checks-critic")!.evidence!.length, 4);
  assert.equal(validate(applied.doc, { forExport: true }).filter((i) => i.severity === "error").length, 0);

  const gate = parseRunNotes(load("run-gate").notesText).notes.find((n) => n.proposal)!;
  const other = describePatch(gate.proposal!.patch);
  assert.equal(other.kind, "other");
  assert.match((other as { why: string }).why, /index paths \(JSON Patch\)/);
  assert.equal(describePatch("raise the budget").kind, "other");
  assert.equal(describePatch(undefined).kind, "none");
  assert.equal(isOpList([]), false);
  assert.equal(isOpList([{ op: "updateNode" }, { op: "frobnicate" }]), false);
});

// ─── adoption ─────────────────────────────────────────────────────────────

test("adopting the real run gives version 2, the same in meaning as the driver's hand adoption, description and lineage.from aside", () => {
  const { source, working } = real();
  const before = canonicalize(source);
  const adopted = adoptWorkingCopy(source, working, { run: REAL_RUN });
  assert.ok(adopted.ok);
  assert.equal(canonicalize(source), before, "the source is untouched");
  assert.equal(adopted.doc.version, 2);
  assert.equal(adopted.doc.id, "slice-0007-sandwich");
  assert.equal(adopted.doc.name, "Slice 0007 sandwich");
  assert.deepEqual(adopted.doc.lineage, { pattern: "metric-sandwich", from: "slice-0007-sandwich@1" });
  assert.equal(adopted.from, "slice-0007-sandwich@1");
  assert.equal(adopted.run, REAL_RUN);

  const byHand = parseGraphText(read(join(runs, "slice-0007-sandwich.adopted-by-hand.grooph.json"))).doc!;
  const aside = (g: Graph) => canonicalize({ ...g, description: undefined, lineage: { ...g.lineage, from: undefined } } as Graph);
  assert.equal(aside(adopted.doc), aside(byHand));
  // What sets them apart, said plainly: the driver kept the template's lineage; docs/runs.md §2 names the version adopted from.
  assert.equal(byHand.lineage?.from, "metric-sandwich@1");
});

test("adoption is refused when the working copy has export errors, with the issues", () => {
  const { source, working } = load("run-broken");
  const adopted = adoptWorkingCopy(source, working);
  assert.equal(adopted.ok, false);
  assert.ok(!adopted.ok);
  assert.deepEqual(adopted.issues.map((i) => i.code), ["E_DANGLING_REF"]);
  assert.match(adopted.message, /cannot become version 2 of run-broken/);
});

test("adoption keeps the source's pinned notes and id, drops the working copy's notes, and keeps layout only for nodes that remain", () => {
  const { source, working } = real();
  const pinned = note({ id: "n-pin", at: "node:critic", text: "pinned" });
  const src = { ...source, notes: [pinned], layout: { builder: { x: 1, y: 1 }, gone: { x: 0, y: 0 } } };
  const work = { ...working, id: "renamed-by-lead", name: "Other", notes: [note({ id: "n-run", at: "graph" })] };
  const adopted = adoptWorkingCopy(src, work);
  assert.ok(adopted.ok);
  assert.equal(adopted.doc.id, "slice-0007-sandwich");
  assert.equal(adopted.doc.name, "Slice 0007 sandwich");
  assert.deepEqual(adopted.doc.notes, [pinned]);
  assert.deepEqual(adopted.doc.layout, { builder: { x: 1, y: 1 } });
});

// ─── bundles and links ────────────────────────────────────────────────────

const deflate = (bytes: Uint8Array): Uint8Array => deflateRawSync(bytes, { level: 9 });
const inflate: InflateRaw = (bytes, maxOutput) => inflateRawSync(bytes, { maxOutputLength: maxOutput });

const realBundle = (): RunBundle => {
  const r = real();
  return buildRunBundle({ source: r.source, working: r.working, notesText: r.notesText, ...(r.progress ? { progress: r.progress } : {}), run: r.runId });
};

test("a bundle carries the run whole and round-trips through its canonical text", () => {
  const bundle = realBundle();
  assert.equal(bundle.groophRun, 0);
  assert.equal(bundle.run, REAL_RUN);
  assert.equal(bundle.notes.length, 15);
  assert.equal(bundle.issues, undefined);
  assert.match(bundle.progress!, /^# Run 20260919-0057-66c8/);
  const text = canonicalizeRunBundle(bundle);
  const parsed = parseRunBundleText(text);
  assert.ok(parsed.bundle);
  assert.equal(canonicalizeRunBundle(parsed.bundle), text);
  assert.deepEqual(Object.keys(JSON.parse(text)), ["groophRun", "run", "progress", "source", "working", "notes"]);

  const malformed = load("run-malformed");
  const withIssues = buildRunBundle({ source: malformed.source, working: malformed.working, notesText: malformed.notesText });
  assert.equal(withIssues.run, "20260919-1000-bad1", "the run id comes from the notes when not given");
  assert.deepEqual(withIssues.issues!.map((i) => i.line), [3, 4]);
});

test("parseRunBundle refuses what is not a bundle, naming the path, and a newer format by its version", () => {
  const bundle = realBundle();
  assert.match(parseRunBundle({ ...bundle, working: undefined }).issues.join("\n"), /\/working: missing required property/);
  assert.match(parseRunBundle({ ...bundle, notes: [{ id: "n-1", run: "r", at: "sideways" }] }).issues.join("\n"), /\/notes\/0\/at/);
  assert.match(parseRunBundle({ ...bundle, source: { ...bundle.source, nodes: "no" } }).issues.join("\n"), /\/source\/nodes/);
  assert.equal((parseRunBundle({ ...bundle, groophRun: 3 }) as { newer?: number }).newer, 3);
  assert.deepEqual(parseRunBundle(null).issues, ["/: expected run bundle, got null"]);
  assert.match(parseRunBundleText("{").issues[0]!, /not valid JSON/);
});

test("the published run bundle schema is up to date and agrees with parseRunBundle", () => {
  assert.equal(read(RUN_SCHEMA_PATH), runJsonSchema(), "run pnpm --filter @grooph/core run schema:write");
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  ajv.addSchema(JSON.parse(graphJsonSchema()));
  const validateJson = ajv.compile(JSON.parse(runJsonSchema()));
  const good = JSON.parse(canonicalizeRunBundle(realBundle()));
  assert.equal(validateJson(good), true, ajv.errorsText(validateJson.errors));
  for (const bad of [{ ...good, notes: [{ id: "n-1", run: "r", at: "sideways" }] }, { ...good, working: { ...good.working, grooph: 1 } }, { ...good, groophRun: 1 }]) {
    assert.equal(validateJson(bad), false);
    assert.equal(parseRunBundle(bad).bundle, undefined);
  }
});

test("a run travels in a share link as kind run; the link is checked like any untrusted input", () => {
  const envelope = buildShareEnvelope(realBundle());
  assert.equal(envelope.kind, "run");
  const opened = decodeSharePayload(encodeSharePayload(envelope, deflate), inflate);
  assert.ok(opened.ok);
  assert.equal(opened.envelope.kind, "run");
  assert.deepEqual(opened.envelope.doc, envelope.doc);
  assert.deepEqual(opened.issues, []);

  // A working copy with errors can still be shared and opened: the view refuses adoption, not the look.
  const broken = load("run-broken");
  const brokenEnvelope = buildShareEnvelope(buildRunBundle({ source: broken.source, working: broken.working, notesText: broken.notesText }));
  const openedBroken = parseShareEnvelope(JSON.parse(JSON.stringify(brokenEnvelope)));
  assert.ok(openedBroken.ok);
  assert.deepEqual(openedBroken.issues.filter((i) => i.severity === "error").map((i) => i.code), ["E_DANGLING_REF"]);

  const refused = parseShareEnvelope({ v: 1, kind: "run", doc: { groophRun: 0, run: "x" } });
  assert.equal(refused.ok, false);
  assert.ok(!refused.ok);
  assert.match(refused.message, /run record that does not match/);
  assert.ok(refused.details.some((d) => d.includes("/source")));
  const newer = parseShareEnvelope({ v: 1, kind: "run", doc: { groophRun: 2 } });
  assert.ok(!newer.ok && /newer grooph/.test(newer.message));
  assert.throws(() => buildShareEnvelope({ groophRun: 0 } as unknown as RunBundle), ShareError);
});

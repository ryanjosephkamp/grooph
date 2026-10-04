/**
 * Replay (slice 0056): a run's notes as steps, against the proving run of the
 * heterogeneous-critic template (a loop that fails round 0, passes its bar in
 * round 1, then halts at a human gate) and two fixture runs.
 */

import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { parseGraphText } from "../src/parse.js";
import { replaySteps } from "../src/replay.js";
import { parseRunNotes, summarizeRun } from "../src/runs.js";
import type { Graph, RunNote } from "../src/types.js";
import { fixturesDir, read, repoRoot } from "./helpers.js";

function runIn(dir: string): { graph: Graph; notes: RunNote[] } {
  const runId = readdirSync(dir)[0]!;
  const graph = parseGraphText(read(join(dir, runId, "graph.grooph.json"))).doc!;
  const { notes, issues } = parseRunNotes(read(join(dir, runId, "notes.jsonl")));
  assert.deepEqual(issues, []);
  return { graph, notes };
}

const critic = () => runIn(join(repoRoot, "experiments/patterns/heterogeneous-critic/run/runs"));

test("one step per note, after a step for the graph before the run", () => {
  const { graph, notes } = critic();
  const { steps } = replaySteps(notes, graph);
  assert.equal(steps.length, notes.length + 1);
  assert.equal(steps[0]!.caption, "Before the run");
  assert.equal(steps[0]!.note, undefined);
  assert.ok(Object.values(steps[0]!.summary.nodes).every((n) => n.state === "pending"));
  steps.forEach((step, i) => assert.equal(step.index, i));
});

test("each step is the summary of the notes so far, so the last is the run's own summary", () => {
  const { graph, notes } = critic();
  const { steps } = replaySteps(notes, graph);
  assert.deepEqual(steps.at(-1)!.summary, summarizeRun(notes, graph));
  assert.deepEqual(steps[3]!.summary, summarizeRun(notes.slice(0, 3), graph));
});

test("nodes light as the run reaches them and the loop's round ticks", () => {
  const { graph, notes } = critic();
  const { steps } = replaySteps(notes, graph);
  const state = (k: number, id: string) => steps[k]!.summary.nodes[id]!.state;
  const round = (k: number) => steps[k]!.summary.loops["review"]!.round;

  assert.equal(state(2, "builder"), "running");
  assert.equal(steps[2]!.caption, "Builder dispatched · round 0");
  assert.equal(state(3, "builder"), "passed");
  assert.equal(state(5, "critic"), "failed");
  assert.match(steps[6]!.caption, /round 0 ends, fail$/);
  assert.equal(round(6), 0);
  assert.equal(round(8), 1);
  assert.deepEqual(steps[8]!.focus, { kind: "node", id: "builder" });
  assert.match(steps[11]!.caption, /round 1 ends, pass · bar passed$/);
  assert.equal(state(12, "merge-gate"), "halted");
});

test("the end names the loop's stop and where the run halted", () => {
  const { graph, notes } = critic();
  const { end } = replaySteps(notes, graph);
  assert.equal(end.state, "halted");
  assert.deepEqual(end.loops, [{ loop: "review", name: graph.loops[0]!.name || "review", round: 1, outcome: "pass", fired: "bar-passed" }]);
  assert.equal(end.at?.id, "merge-gate");
  assert.match(end.line, /stopped on bar passed in round 1\. The run halted at .+ \(a human gate\)\.$/);
});

test("a halt written at the graph still names the gate it halted at", () => {
  const { graph, notes } = runIn(join(fixturesDir, "runs/run-gate/runs"));
  const { end } = replaySteps(notes, graph);
  assert.equal(end.state, "halted");
  assert.equal(end.at?.id, "merge-gate");
  assert.equal(end.loops[0]!.fired, "bar-passed");
});

test("a record that stops mid-run says so, and nested loops keep their own rounds", () => {
  const { graph, notes } = runIn(join(fixturesDir, "runs/run-nested/runs"));
  const { steps, end } = replaySteps(notes, graph);
  assert.equal(end.state, "running");
  assert.match(end.line, /still going/);
  assert.equal(steps.at(-1)!.summary.nodes["judge"]!.state, "running");
  assert.equal(steps[5]!.summary.loops["grind"]!.round, 1);
});

test("a run with no notes is one step and says it has none", () => {
  const { graph } = critic();
  const replay = replaySteps([], graph);
  assert.equal(replay.steps.length, 1);
  assert.equal(replay.end.line, "The run has no notes yet.");
});

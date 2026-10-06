import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { isPersonStep, parseGraphText, parseRunNotes, replaySteps, resolvePositions, summarizeRun, type Graph, type RunNote } from "@grooph/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { columnsForViewport } from "../src/doc/layout.js";

import { firstPass } from "../src/ui/canvas/graph-views.js";
import { columnsAt, modelOf as modelAt, stepsOf } from "../src/ui/canvas/stage/model.js";
import { boxesOf, panes } from "../src/ui/canvas/stage/panes.js";

/**
 * A graph's other views in three dimensions (handoff 0096): what every view draws from, held to the documents. The
 * studio these views were picked from was found false in places by a second reader; what it corrected is asserted
 * here, so that it cannot come back with a later view.
 */
const root = join(import.meta.dirname, "../../..");
const graph = (path: string): Graph => parseGraphText(readFileSync(join(root, path), "utf8")).doc!;
const REVIEW = graph("patterns/review-gate.grooph.json");
const GAUNTLET = graph("patterns/gauntlet-decomposed.grooph.json");
const NESTED = graph("fixtures/valid/subgrooph-in-a-graph.grooph.json");
const runDir = join(root, "fixtures/runs/slice-0007-sandwich/runs", readdirSync(join(root, "fixtures/runs/slice-0007-sandwich/runs"))[0]!);
const RUN = graph(join("fixtures/runs/slice-0007-sandwich/runs", readdirSync(join(root, "fixtures/runs/slice-0007-sandwich/runs"))[0]!, "graph.grooph.json"));
const NOTES: RunNote[] = parseRunNotes(readFileSync(join(runDir, "notes.jsonl"), "utf8")).notes;
/** The canvas's own places, on a phone (two to a row) or wider (four): the document's layout where it has one. */
const places = (doc: Graph, columns = 2) => resolvePositions(doc, columns).positions;
const modelOf = (doc: Graph, notes?: RunNote[]) => modelAt(doc, places(doc), notes);
const loop = (doc: Graph, id: string, notes?: RunNote[]) => modelOf(doc, notes).loops.find((l) => l.id === id)!;
/** A recorded run's working copy and its notes. */
const runAt = (name: string): [Graph, RunNote[]] => {
  const dir = join("fixtures/runs", name, "runs", readdirSync(join(root, "fixtures/runs", name, "runs"))[0]!);
  return [graph(join(dir, "graph.grooph.json")), parseRunNotes(readFileSync(join(root, dir, "notes.jsonl"), "utf8")).notes];
};
const ALL = readdirSync(join(root, "patterns")).filter((f) => f.endsWith(".grooph.json")).map((f) => `patterns/${f}`);

describe("what a view draws from", () => {
  it("a loop's brakes are the document's: its cap, its budget, a person asked every so many rounds", () => {
    expect(loop(REVIEW, "review")).toMatchObject({ cap: 4, budget: { measure: "dispatches", limit: 10 }, human: null, inside: null });
    expect(loop(GAUNTLET, "polish")).toMatchObject({ cap: 3, budget: { measure: "dispatches", limit: 10 }, human: null, inside: "pieces" });
    expect(loop(GAUNTLET, "pieces")).toMatchObject({ cap: 4, budget: { measure: "dispatches", limit: 42 }, human: 2, inside: null });
    expect(loop(RUN, "sandwich")).toMatchObject({ cap: 5, budget: { measure: "turns", limit: 80 }, human: null });
    expect(loop(REVIEW, "review").stops).toEqual(["bar passed", "max iterations: 4", "budget: 10 dispatches"]);
  });

  it("a full round is counted as the compiler tells a lead to count it: each member that is an agent or a check, once", () => {
    // The compiled briefs say "3 full rounds and 1 more" of polish's 10, "10 full rounds and 2 more" of pieces' 42,
    // and 5 full rounds of the review gate's 10 (experiments/patterns/gauntlet-decomposed/run/package/LEAD.md).
    expect(loop(REVIEW, "review").perRound).toBe(2);
    expect(loop(GAUNTLET, "polish").perRound).toBe(3);
    // The outer loop's count is its members', the inner loop's among them at one round: not the inner loop at its cap.
    expect(loop(GAUNTLET, "pieces").perRound).toBe(4);
    expect(loop(RUN, "sandwich").perRound).toBe(3);
  });

  it("a loop's own nodes are its members in no loop inside it, in the order a first pass meets them", () => {
    expect(loop(GAUNTLET, "pieces").own).toEqual(["next-piece"]);
    expect(loop(GAUNTLET, "polish").own).toEqual(["owner", "capture-check", "critic"]);
    expect(modelOf(GAUNTLET).nodes.find((n) => n.id === "owner")!.loop).toBe("polish");
    expect(modelOf(GAUNTLET).nodes.find((n) => n.id === "next-piece")!.loop).toBe("pieces");
    expect(modelOf(GAUNTLET).nodes.find((n) => n.id === "planner")!.loop).toBeNull();
  });

  it("the steps of a graph are the app's own first pass, in its order, and then one turn of each loop", () => {
    for (const path of ALL) {
      const doc = graph(path);
      const model = modelOf(doc);
      expect(model.pass.map((p) => p.edge), path).toEqual(firstPass(doc).map((p) => p.edge.id));
      const steps = stepsOf(model);
      expect(steps).toHaveLength(model.pass.length + 1);
      for (const [k, step] of steps.slice(1).entries()) expect([step.edge, step.r0, step.r1], path).toEqual([model.pass[k]!.edge, 0, model.pass[k]!.loop ? 1 : 0]);
    }
  });

  it("a person's step says whose it is: Person, its role, no tier and no effort, in the kind a person's decision has; an agent's is as it was", () => {
    const plan = graph("fixtures/valid/a-plan-with-people.grooph.json");
    const cards = Object.fromEntries(modelOf(plan).nodes.map((n) => [n.id, [n.kind, n.word, n.line, n.tier]]));
    expect(cards).toEqual({
      draft: ["person", "Person", "Person · builder", null],
      "fact-check": ["agent", "Agent", "researcher · strong · high", "strong"],
      review: ["person", "Person", "Person · critic", null],
      publish: ["person", "Person", "Person · builder", null],
      done: ["stop", "Stop", "Stop", null],
    });
    // In Panes each is one card where the picture has it, a person's among them.
    expect(panes(modelOf(plan), { k: 0, lit: null, took: [] }).prims.filter((p) => p.t === "card").map((p) => (p.t === "card" ? p.id : "")).sort()).toEqual(plan.nodes.map((n) => n.id).sort());
  });

  it("a card says what the canvas says: a role, a tier and an effort, or what kind of node it is", () => {
    const lines = Object.fromEntries(modelOf(NESTED).nodes.map((n) => [n.id, [n.word, n.line, n.tier]]));
    expect(lines["review-builder"]).toEqual(["Agent", "builder · strong · high", "strong"]);
    expect(lines["plan"]).toEqual(["Agent", "planner · session default", "unset"]);
    expect(lines["review-merge-gate"]).toEqual(["Human gate", "Human gate", null]);
    expect(lines["done"]).toEqual(["Stop", "Stop", null]);
  });
});

describe("a recorded run", () => {
  const model = modelOf(RUN, NOTES);

  it("its dispatches are the notes about agents and checks, each in the round the note names, with its outcome", () => {
    expect(model.run!.dispatches.map((d) => [d.node, d.round, d.outcome])).toEqual([
      ["builder", 0, "pass"],
      ["checks", 0, "pass"],
      ["critic", 0, "fail"],
      ["builder", 1, "pass"],
      ["checks", 1, "pass"],
      ["critic", 1, "pass"],
    ]);
    expect(model.run!.rounds).toEqual({ sandwich: 1 });
    // A note at an agent that reports nothing (a word, a proposal) is not a dispatch, with a stamp or without one.
    const word = (k: number, more: Partial<RunNote> = {}): RunNote => ({ id: `w-${k}`, run: NOTES[0]!.run, at: "node:builder", text: "a word at the builder", ...more }) as RunNote;
    const wordy = [...NOTES.slice(0, 3), word(1), word(2, { ended: "2026-09-19T13:00:00Z" }), ...NOTES.slice(3), word(3, { proposal: { summary: "s", reason: "r" } } as Partial<RunNote>)];
    expect(modelOf(RUN, wordy).run!.dispatches.map((d) => [d.node, d.round, d.outcome])).toEqual(model.run!.dispatches.map((d) => [d.node, d.round, d.outcome]));
  });

  it("a node in a loop inside another: its note's number is the inner loop's unless the run's own loop notes show the lead wrote another loop's there, and then each loop's round is worked out from the ways back the run took", () => {
    const where = (m: ReturnType<typeof modelOf>) => m.run!.dispatches.map((d) => `${d.node}@${d.loop}:${d.round}`);
    // The nested fixture's lead wrote the inner loop's round on the builder's and the tests' notes.
    const [nested, written] = runAt("run-nested");
    const inner = ["builder@grind:0", "tests@grind:0", "builder@grind:1", "tests@grind:1", "judge@phases:0", "builder@grind:0", "tests@grind:0"];
    expect(where(modelOf(nested, written))).toEqual(inner);
    // The same run with the outer loop's round written there, as the recorded Gauntlet and fresh-grind runs have
    // it, and with none written at any node: the same rounds.
    const phase = [0, 0, 0, 0, 0, 1, 1];
    let k = 0;
    const outer = written.map((n) => (n.at === "node:builder" || n.at === "node:tests" ? ({ ...n, round: phase[k++] } as RunNote) : n));
    expect(k).toBe(6);
    expect(where(modelOf(nested, outer))).toEqual(inner);
    expect(where(modelOf(nested, written.map(({ round, ...n }) => (n.at.startsWith("node:") ? (n as RunNote) : ({ ...n, round } as RunNote)))))).toEqual(inner);
    // The four recorded runs with a loop inside a loop: piece 2 of the Gauntlet is round 1 of Pieces and round 0 of
    // Polish a piece, as its own loop notes say, though the owner's note there carries a 1; and the sentence the
    // page opens with says so.
    const recorded = (dir: string) => modelOf(graph(join(dir, "graph.grooph.json")), parseRunNotes(readFileSync(join(root, dir, "notes.jsonl"), "utf8")).notes);
    for (const dir of ["experiments/patterns/gauntlet-decomposed/run/runs/20261004-224501", "experiments/patterns/gauntlet-decomposed/run-1/runs/20260922-151855"]) {
      expect(where(recorded(dir)), dir).toEqual(["planner@null:null", "owner@polish:0", "capture-check@polish:0", "critic@polish:0", "next-piece@pieces:0", "owner@polish:0", "capture-check@polish:0", "critic@polish:0", "next-piece@pieces:1"]);
      expect(stepsOf(recorded(dir))[0]!.says, dir).toMatch(/^The whole run: 9 dispatches, in round 0 of Polish a piece; rounds 0 and 1 of Pieces\./);
    }
    for (const dir of ["experiments/patterns/fresh-grind-rare-judge/run/runs/20260921-044114", "experiments/patterns/fresh-grind-rare-judge/run-1/runs/20260920-195457"]) {
      expect(where(recorded(dir)), dir).toEqual(["builder@grind:0", "tests@grind:0", "judge@phases:0", "builder@grind:0", "tests@grind:0", "judge@phases:1"]);
      expect(stepsOf(recorded(dir))[0]!.says, dir).toMatch(/^The whole run: 6 dispatches, in round 0 of Grind; rounds 0 and 1 of Phases\./);
    }
    // A node in one loop keeps the round its note names.
    expect(where(model)).toEqual(["builder@sandwich:0", "checks@sandwich:0", "critic@sandwich:0", "builder@sandwich:1", "checks@sandwich:1", "critic@sandwich:1"]);
    // Though the notes skip the step that sent it round, so that no way back is seen: the number is read, not
    // worked out. One loop: the critic's fail is not noted, and the builder's second note names round 1.
    const skip = (list: [string, string, number?, string?][]): RunNote[] => list.map(([at, outcome, round, stop], k) => ({ id: `n-${k + 1}`, run: "r", at: at.includes(":") ? at : `node:${at}`, outcome, ...(round === undefined ? {} : { round }), ...(stop ? { stop } : {}) }) as RunNote);
    expect(where(modelOf(REVIEW, skip([["builder", "pass", 0], ["builder", "pass", 1], ["critic", "pass", 1]])))).toEqual(["builder@review:0", "builder@review:1", "critic@review:1"]);
    // A loop inside another, written the inner way, with the tests' failing note skipped: the loop's own note agrees
    // with its nodes' notes, so their numbers are the inner loop's and are read.
    expect(where(modelOf(nested, skip([["builder", "pass", 0], ["builder", "pass", 1], ["tests", "pass", 1], ["loop:grind", "pass", 1], ["judge", "pass", 0]])))).toEqual(["builder@grind:0", "builder@grind:1", "tests@grind:1", "judge@phases:0"]);
    // And where the judge's way back is not seen (an outcome no edge is for), the second phase's builder, named
    // round 0, starts Grind afresh as its note says.
    expect(where(modelOf(nested, skip([["builder", "pass", 0], ["tests", "fail", 0], ["builder", "pass", 1], ["tests", "pass", 1], ["loop:grind", "pass", 1], ["judge", "revise", 0], ["builder", "pass", 0], ["tests", "pass", 0], ["loop:grind", "pass", 0]]))).slice(-2)).toEqual(["builder@grind:0", "tests@grind:0"]);
    // The same graph written the outer way, with the judge's verdict where its way back wants an outcome, so
    // the walk sees no way back: the loop's own note says round 0 for a pass its nodes' notes call 1, the numbers
    // are another loop's, and Grind is worked out (and stays in the round it was last seen in).
    expect(where(modelOf(nested, skip([["builder", "pass", 0], ["tests", "pass", 0], ["loop:grind", "pass", 0], ["judge", "pass", 0], ["builder", "pass", 1], ["tests", "pass", 1], ["loop:grind", "pass", 0]]))).slice(-2)).toEqual(["builder@grind:0", "tests@grind:0"]);
    // In such a run the outer loop's own node is in one loop, and its number is still read: the judge's second
    // note names round 1 of Phases, though no way back of Phases was seen.
    expect(where(modelOf(nested, skip([["builder", "pass", 0], ["tests", "pass", 0], ["loop:grind", "pass", 0], ["judge", "pass", 0], ["builder", "pass", 1], ["tests", "pass", 1], ["loop:grind", "pass", 0], ["judge", "pass", 1]]))).at(-1)).toBe("judge@phases:1");
  });

  it("a person's step is no dispatch: its result is not counted, in a run or in a full round, and the step is still a stop of the slider", () => {
    const plan = graph("fixtures/valid/a-plan-with-people.grooph.json");
    const said = (k: number, at: string, outcome: string, round?: number): RunNote => ({ id: `n-${k}`, run: "r", at: `node:${at}`, ended: `2026-10-05T10:0${k}:00Z`, outcome, ...(round === undefined ? {} : { round }) }) as RunNote;
    // A person drafts, an agent checks the facts, a person edits and sends it back, and round again.
    const notes = [said(1, "draft", "pass", 0), said(2, "fact-check", "pass", 0), said(3, "review", "fail", 0), said(4, "draft", "pass", 1), said(5, "fact-check", "pass", 1), said(6, "review", "pass", 1), said(7, "publish", "pass")];
    const m = modelOf(plan, notes);
    expect(m.run!.dispatches.map((d) => [d.node, d.round])).toEqual([["fact-check", 0], ["fact-check", 1]]);
    expect(stepsOf(m)[0]!.says).toMatch(/^The whole run: 2 dispatches, in rounds 0 and 1 of /);
    // Every note is a stop of the slider all the same, a person's among them, with the edge taken to it.
    expect(stepsOf(m).slice(1).map((s) => [s.to, s.edge !== undefined])).toEqual([["draft", false], ["fact-check", true], ["review", true], ["draft", true], ["fact-check", true], ["review", true], ["publish", true]]);
    // A full round of the loop is one dispatch, the agent's: a budget in dispatches does not count a person's step.
    expect(m.loops.map((l) => l.perRound)).toEqual([1]);
  });

  it("a dispatch's minutes are by the stamps of the ends: the first from its own start, each after from the end before it", () => {
    // 05:01:00 to 05:20:42, 05:21:16, 05:28:43, 05:32:57, 05:33:25, 05:38:15. Two of these notes are stamped as
    // starting after they end; the first's own note of its cost says 22 minutes. Neither is used.
    expect(model.run!.dispatches.map((d) => d.minutes)).toEqual([19.7, 0.57, 7.45, 4.23, 0.47, 4.83]);
  });

  it("its steps are its notes: a move is along the edge the run took, in the round it took it", () => {
    const steps = stepsOf(model);
    expect(steps).toHaveLength(NOTES.length + 1);
    expect(steps[0]!.says).toMatch(/^The whole run: 6 dispatches, in rounds 0 and 1 of Sandwich\. Sandwich stopped on bar passed in round 1\./);
    // The builder again, after the critic's fail: by the way back, from round 0 to round 1.
    expect(steps[9]).toMatchObject({ to: "builder", edge: "e-critic-fail", from: "critic", r0: 0, r1: 1 });
    // Out to Done, from round 1, where the critic passed: not from round 0, where it failed.
    expect(steps[13]).toMatchObject({ to: "done", edge: "e-critic-pass", from: "critic", r0: 1 });
    // The way back from the checks was never taken, and no step takes it.
    expect(steps.some((s) => s.edge === "e-checks-fail")).toBe(false);
  });

  it("of two edges between the same two nodes, the move is along the one the note before reported, and a loop inside another starts its rounds afresh", () => {
    const [doc, notes] = runAt("run-nested");
    const nested = modelAt(doc, places(doc), notes);
    const steps = stepsOf(nested);
    // n-0008: the judge's verdict is next-phase. n-0010: the builder again, by e-judge-next-phase, not e-judge-fail.
    expect(steps[10]).toMatchObject({ to: "builder", from: "judge", edge: "e-judge-next-phase" });
    // The checks' fail in round 0 led back by e-tests-fail, into round 1 of the inner loop.
    expect(steps[5]).toMatchObject({ to: "builder", from: "tests", edge: "e-tests-fail", r0: 0, r1: 1 });
    // Phase 2's builder is in round 0 of the inner loop again.
    expect(nested.run!.dispatches.map((d) => [d.node, d.round])).toEqual([["builder", 0], ["tests", 0], ["builder", 1], ["tests", 1], ["judge", 0], ["builder", 0], ["tests", 0]]);
    // A round is a loop's own: the rounds of the two loops are said apart, each by its loop's name.
    expect(steps[0]!.says).toMatch(/^The whole run: 7 dispatches, in rounds 0 and 1 of Grind; round 0 of Phases\. /);
    expect(nested.run!.dispatches.map((d) => d.loop)).toEqual(["grind", "grind", "grind", "grind", "phases", "grind", "grind"]);
  });

  it("a move that no edge's condition fits lights no edge, and a dispatch at a node in no loop is in no round", () => {
    // The run's own notes, but the critic's first report is one that neither of its edges is for. The builder is
    // next all the same, and the only edge from the critic to it is for a fail: it is not shown as taken.
    const odd = NOTES.map((n) => (n.id === "n-0006" ? ({ ...n, outcome: "halt", verdict: "undecided" } as RunNote) : n));
    const steps = stepsOf(modelAt(RUN, places(RUN), odd));
    expect(steps[9]).toMatchObject({ to: "builder", nodes: ["builder"] });
    expect([steps[9]!.edge, steps[9]!.from]).toEqual([undefined, undefined]);
    // The other moves are as they were.
    expect(steps[13]).toMatchObject({ to: "done", edge: "e-critic-pass", from: "critic" });
    // The same notes over the same nodes with no loop round them: no dispatch has a loop or a round, and the run's
    // first sentence gives it none.
    const flat = modelAt({ ...RUN, loops: [] }, places(RUN), NOTES);
    expect(flat.run!.dispatches.map((d) => [d.loop, d.round])).toEqual(Array.from({ length: 6 }, () => [null, null]));
    expect(stepsOf(flat)[0]!.says).toMatch(/^The whole run: 6 dispatches\. /);
  });

  it("a note about the run, or about an edge, is said in the note's own words and is not a move", () => {
    const steps = stepsOf(model);
    // n-0008 is a proposal about an edge: lit, with its two ends, and marked as no move along it.
    expect(steps[8]).toMatchObject({ edge: "e-checks-critic", about: true });
    expect(steps[8]!.says).toMatch(/^Note 8 of 15, a proposal about the edge .+, not a move along it: let the critic also read/);
    expect(steps[8]!.to).toBeUndefined();
    // n-0015 is the handback's check after the run ended, which core's short caption calls "Run started".
    expect(steps[15]!.says).toMatch(/^Note 15 of 15, about the run: post-run handback verification, after the run ended/);
    expect([steps[15]!.nodes, steps[15]!.edge, steps[15]!.loops]).toEqual([undefined, undefined, undefined]);
    // A note about a loop lights the loop and is not a dispatch.
    expect(steps[7]).toMatchObject({ loops: ["sandwich"] });
    expect(steps[7]!.dispatch).toBeUndefined();
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("every recorded run the repository keeps", () => {
  /** Every folder with a run's notes under the fixtures and the experiments (but for the game's acceptance runs, which are another lane's). */
  const recorded = (dir: string): string[] =>
    readdirSync(join(root, dir), { withFileTypes: true }).flatMap((d) => (!d.isDirectory() || join(dir, d.name) === "experiments/game/acceptance" ? [] : readdirSync(join(root, dir, d.name)).includes("notes.jsonl") ? [join(dir, d.name)] : recorded(join(dir, d.name))));
  /**
   * Each run, with how many dispatches it had and the round each loop it entered was in at the end, as literal
   * numbers. They are what `main` showed for these runs on 2026-10-05, by core, which this change does not touch:
   * the rounds are core's own (`replaySteps`), and the dispatches are core's count but for the four runs named
   * under the table. A change to how a run is read (`stage/model.ts`) that moves any of them fails here by name.
   * A run added to the repository needs a row: its dispatches are its notes at an agent or a check with an outcome
   * that is not "started", and its rounds are in the sentence its page opens with.
   */
  const RUNS: [string, number, Record<string, number>][] = [
    ["experiments/comparisons/grind-loop/A-1/runs/20260921-213906", 2, { "grind": 0 }],
    ["experiments/comparisons/grind-loop/A-2/runs/20260921-214249", 2, { "grind": 0 }],
    ["experiments/comparisons/heterogeneous-critic/A-1/runs/20261004-214144", 4, { "review": 1 }],
    ["experiments/comparisons/heterogeneous-critic/A-2/runs/20261004-215612", 4, { "review": 1 }],
    ["experiments/comparisons/red-team-loop/A-1/runs/20260921-220554", 2, { "attack": 0 }],
    ["experiments/comparisons/red-team-loop/A-2/runs/20260921-224918", 2, { "attack": 0 }],
    ["experiments/comparisons/review-gate-2/A-1/runs/20261004-211444", 4, { "review": 1 }],
    ["experiments/comparisons/review-gate-2/A-2/runs/20261004-212722", 4, { "review": 1 }],
    ["experiments/comparisons/review-gate/A-1/runs/20260921-214803", 2, { "review": 0 }],
    ["experiments/comparisons/review-gate/A-2/runs/20260921-215704", 2, { "review": 0 }],
    ["experiments/comparisons/spec-then-loop/A-1/runs/20260921-232556", 3, { "build": 0 }],
    ["experiments/comparisons/spec-then-loop/A-2/runs/20260921-233822", 3, { "build": 0 }],
    ["experiments/comparisons/spec-then-loop/A-3/runs/20260921-235057", 3, { "build": 0 }],
    ["experiments/comparisons/taste-polish/A-1/runs/20261004-221102", 6, { "polish": 1 }],
    ["experiments/comparisons/taste-polish/A-2/runs/20261004-222738", 6, { "polish": 1 }],
    ["experiments/patterns/contradiction-seeker/run/runs/20260919-1233-k7qm", 2, { "hunt": 0 }],
    ["experiments/patterns/debate-then-build/run/runs/20260920-185756", 3, { "debate": 0 }],
    ["experiments/patterns/dual-bar/run/runs/20260920-191110", 2, { "review": 0 }],
    ["experiments/patterns/fresh-grind-rare-judge/run-1/runs/20260920-195457", 6, { "grind": 0, "phases": 1 }],
    ["experiments/patterns/fresh-grind-rare-judge/run/runs/20260921-044114", 6, { "grind": 0, "phases": 1 }],
    ["experiments/patterns/gauntlet-decomposed/run-1/runs/20260922-151855", 9, { "polish": 0, "pieces": 1 }],
    ["experiments/patterns/gauntlet-decomposed/run/runs/20261004-224501", 9, { "polish": 0, "pieces": 1 }],
    ["experiments/patterns/grind-loop/run/runs/20260919-1230-k7qm", 2, { "grind": 0 }],
    ["experiments/patterns/heterogeneous-critic/run/runs/20260920-192538", 4, { "review": 1 }],
    ["experiments/patterns/human-gated-irreversible/run/runs/20260920-184824", 2, { "grind": 0 }],
    ["experiments/patterns/merge-queue/run/runs/20260922-051355", 5, { "grind": 0, "queue": 1 }],
    ["experiments/patterns/metric-sandwich/run/runs/20260919-1241-k7qm", 3, { "sandwich": 0 }],
    ["experiments/patterns/ownership-not-swarm/run/runs/20260920-193520", 7, { "integrate": 0 }],
    ["experiments/patterns/patrol-pulse/run-1/runs/20260922-050527", 3, {}],
    ["experiments/patterns/patrol-pulse/run-2/runs/20261004-225445", 2, {}],
    ["experiments/patterns/patrol-pulse/run/runs/20261005-042756", 3, {}],
    ["experiments/patterns/ralph-loop/run/runs/20260922-052016", 14, { "ralph": 4 }],
    ["experiments/patterns/red-team-loop/run/runs/20260920-191614", 2, { "attack": 0 }],
    ["experiments/patterns/retrospective-rewrite/run/runs/20260920-185135", 3, { "grind": 0 }],
    ["experiments/patterns/review-gate/run-1/runs/20260919-1236-k7q2", 2, { "review": 0 }],
    ["experiments/patterns/review-gate/run/runs/20260920-172408", 2, { "review": 0 }],
    ["experiments/patterns/spec-then-loop/run-1/runs/20260919-1245-k7qz", 4, { "build": 0 }],
    ["experiments/patterns/spec-then-loop/run/runs/20260920-172850", 3, { "build": 0 }],
    ["experiments/patterns/specialist-critic-bank/run-1/runs/20260920-200356", 12, { "review": 1 }],
    ["experiments/patterns/specialist-critic-bank/run/runs/20260921-032821", 6, { "review": 0 }],
    ["experiments/patterns/taste-polish/run/runs/20260920-194427", 6, { "polish": 1 }],
    ["experiments/patterns/tournament-then-judge/run/runs/20260920-190434", 6, {}],
    ["fixtures/runs/run-broken/runs/20260919-1400-oops", 0, { "review-cycle": 0 }],
    ["fixtures/runs/run-gate/runs/20260919-1200-gate", 2, { "review-cycle": 0 }],
    ["fixtures/runs/run-live/runs/20260919-1100-live", 1, { "review-cycle": 0 }],
    ["fixtures/runs/run-malformed/runs/20260919-1000-bad1", 1, { "review-cycle": 0 }],
    ["fixtures/runs/run-nested/runs/20260919-1300-nest", 7, { "grind": 0, "phases": 0 }],
    ["fixtures/runs/slice-0007-sandwich/runs/20260919-0057-66c8", 6, { "sandwich": 1 }],
  ];
  /**
   * Where core's count of dispatches (`summarizeRun`: a line before a dispatch, or a result with none before it) is
   * not the number of results, and why. The first three have a dispatch that was started and had not ended when the
   * run was recorded: core counts it and this model, which counts results, does not. In the fourth two pieces were
   * started at one node before either ended (started, started, pass, pass): the second pass has no line before it
   * that is not already answered, so core counts a third dispatch where there were two.
   */
  const CORE_COUNTS: Record<string, number> = {
    "fixtures/runs/run-broken/runs/20260919-1400-oops": 1,
    "fixtures/runs/run-live/runs/20260919-1100-live": 2,
    "fixtures/runs/run-nested/runs/20260919-1300-nest": 8,
    "experiments/patterns/ownership-not-swarm/run/runs/20260920-193520": 8,
  };

  it("has a row here, and its dispatches and each loop's round are what the row says", () => {
    const found = [...recorded("fixtures/runs"), ...recorded("experiments")].sort();
    expect(found).toEqual(RUNS.map(([dir]) => dir).sort());
    for (const [dir, dispatches, rounds] of RUNS) {
      const doc = graph(join(dir, readdirSync(join(root, dir)).find((f) => f.endsWith(".grooph.json"))!));
      const notes = parseRunNotes(readFileSync(join(root, dir, "notes.jsonl"), "utf8")).notes;
      const run = modelOf(doc, notes).run!;
      expect([run.dispatches.length, run.rounds], dir).toEqual([dispatches, rounds]);
      // Against core, read here and not copied: the rounds are its replay's, and its count of dispatches at agents
      // and checks is the same number, but for the four runs above.
      expect(run.rounds, dir).toEqual(Object.fromEntries(replaySteps(notes, doc).end.loops.map((l) => [l.loop, l.round ?? -1])));
      const summary = summarizeRun(notes, doc);
      expect(doc.nodes.reduce((sum, n) => sum + ((n.kind === "agent" && !isPersonStep(n)) || n.kind === "check" ? (summary.nodes[n.id]?.runs ?? 0) : 0), 0), dir).toBe(CORE_COUNTS[dir] ?? dispatches);
      // And the latest round core's summary has for each loop is the same, but for the nested run: its last line
      // is the line before the judge's dispatch, which names round 1 of Phases, and a line before a dispatch is no
      // round of the loop's yet.
      for (const loop of doc.loops) expect(summary.loops[loop.id]?.round ?? -1, `${dir} ${loop.id}`).toBe(dir.includes("run-nested") && loop.id === "phases" ? 1 : (rounds[loop.id] ?? -1));
    }
    expect(RUNS).toHaveLength(48);
  });
});

describe("which edges a run took", () => {
  /** Notes written for a graph: `[node or loop:id, outcome, round or none, verdict or stop]`, with stamps a minute apart unless `bare`. */
  const notes = (list: [string, string, number?, string?][], bare = false): RunNote[] =>
    list.map(([at, outcome, round, more], k) => ({ id: `n-${String(k + 1).padStart(4, "0")}`, run: "r", at: at.includes(":") ? at : `node:${at}`, ...(bare ? {} : { ended: `2026-09-19T13:${String(k).padStart(2, "0")}:00Z` }), outcome, ...(round === undefined ? {} : { round }), ...(more ? (at.startsWith("loop:") ? { stop: more } : { verdict: more }) : {}) }) as RunNote);
  const BANK = graph("patterns/specialist-critic-bank.grooph.json");
  const taken = (doc: Graph, list: RunNote[]) => stepsOf(modelAt(doc, places(doc), list)).map((s) => (s.about ? [] : [s.edge, ...(s.also ?? []).map((x) => x.edge)].filter(Boolean).sort()));

  it("a node that fans out reaches each of its targets, and one that fans in is reached by each of its sources", () => {
    const critics = BANK.edges.filter((e) => e.from === "builder").map((e) => e.to);
    expect(critics).toHaveLength(4);
    const judge = BANK.edges.find((e) => e.from === critics[0])!.to;
    const steps = stepsOf(modelAt(BANK, places(BANK), notes([["builder", "pass", 0], ...critics.map((id): [string, string, number] => [id, "pass", 0]), [judge, "pass", 0]])));
    // Each critic's note is a move from the builder, whichever critic's note came before it.
    for (const [n, id] of critics.entries()) expect(steps[2 + n], id).toMatchObject({ to: id, from: "builder", edge: BANK.edges.find((e) => e.from === "builder" && e.to === id)!.id });
    // The judge's note: the edge from the critic whose note came last is the one followed, and the other three were taken with it.
    expect(steps[6]).toMatchObject({ to: judge, from: critics[3] });
    expect([steps[6]!.edge, ...steps[6]!.also!.map((x) => x.edge)].sort()).toEqual(BANK.edges.filter((e) => e.to === judge && critics.includes(e.from)).map((e) => e.id).sort());
  });

  it("an edge with a condition is taken only by a report that meets it, and only from a node that has reported since its target was last reached", () => {
    const critics = BANK.edges.filter((e) => e.from === "builder").map((e) => e.to);
    const judge = BANK.edges.find((e) => e.from === critics[0])!.to;
    // The judge passed and the gate rejected: back at the builder, the gate's way back was taken and the judge's,
    // which is for a fail, was not, though the judge has reported since the builder was last reached.
    const back = taken(BANK, notes([["builder", "pass", 0], ...critics.map((id): [string, string, number] => [id, "pass", 0]), [judge, "pass", 0], ["gate", "fail", 0], ["builder", "pass", 1]]));
    expect(back[8]).toEqual(["e-gate-reject"]);
    // A second note at the judge with no critic between takes nothing.
    expect(taken(BANK, notes([["builder", "pass", 0], [critics[0]!, "pass", 0], [judge, "pass", 0], [judge, "pass", 0]]))[4]).toEqual([]);
  });

  it("a run whose notes carry no stamps takes the same edges: a note is open by being the line before a dispatch, not by having no end", () => {
    const [doc, written] = runAt("run-nested");
    const bare = written.map(({ started: _started, ended: _ended, ...rest }) => rest as RunNote);
    expect(taken(doc, bare)).toEqual(taken(doc, written));
    expect(taken(doc, bare).filter((t) => t.length)).toHaveLength(7);
    // And its dispatches are still dispatches, with no minutes to their name.
    const model = modelAt(doc, places(doc), bare);
    expect(model.run!.dispatches.map((d) => [d.node, d.minutes])).toEqual(["builder", "tests", "builder", "tests", "judge", "builder", "tests"].map((id) => [id, null]));
    // The line before a dispatch and the result after it are one visit: nothing was taken between them.
    const solo: Graph = { ...REVIEW, edges: [...REVIEW.edges, { id: "e-again", from: "builder", to: "builder" }] } as Graph;
    expect(taken(solo, notes([["builder", "started", 0], ["builder", "pass", 0]]))).toEqual([[], [], []]);
    expect(taken(solo, notes([["builder", "pass", 0], ["builder", "pass", 0]]))[2]).toEqual(["e-again"]);
  });

  it("a stop is looked at before a way back is taken: where a loop's note names the stop that fired, its way back was not taken", () => {
    // Grind stops on its cap and the run goes on to the judge, who sends it back to the builder. The tests' fail,
    // reported before the stop, did not take the tests' way back.
    const [doc] = runAt("run-nested");
    const stopped = taken(doc, notes([["builder", "pass", 0], ["tests", "fail", 0], ["loop:grind", "halt", 0, "max-iterations"], ["judge", "fail", 0, "next-phase"], ["builder", "pass", 0]]));
    expect(stopped[5]).toEqual(["e-judge-next-phase"]);
    // With no stop named, the round ended and the way back was taken.
    const on = taken(doc, notes([["builder", "pass", 0], ["tests", "fail", 0], ["loop:grind", "fail", 0], ["builder", "pass", 1]]));
    expect(on[4]).toEqual(["e-tests-fail"]);
    // A person's stop is lifted by their answer: Gauntlet asks a person every two rounds of Pieces, and when the
    // run goes on, the way back was taken on what was reported before the halt. A cap there bars it.
    const lifted = (stop: string) => taken(GAUNTLET, notes([["next-piece", "pass", 1], ["loop:pieces", "halt", 1, stop], ["owner", "started", 2], ["owner", "pass", 2]]));
    expect(lifted("human")).toEqual([[], [], [], ["e-next-piece-pass"], []]);
    expect(lifted("max-iterations")).toEqual([[], [], [], [], []]);
    // A run that ends at the halt took no way back: its end is no answer. Here core reads the end at the owner,
    // the last node to have halted, and the run's end note shows no arrival there by the way back.
    const halted = [...notes([["owner", "halt", 1], ["next-piece", "pass", 1], ["loop:pieces", "halt", 1, "human"]]), { id: "n-9", run: "r", at: "graph", outcome: "halt", text: "waiting for a person" } as RunNote];
    expect(modelAt(GAUNTLET, places(GAUNTLET), halted).run!.at).toBe("owner");
    expect(taken(GAUNTLET, halted)).toEqual([[], [], [], [], []]);
    // And the answer lifts it once: reached again later, another way, on the same old report, it is barred.
    const elsewhere = taken(GAUNTLET, notes([["next-piece", "pass", 1], ["loop:pieces", "halt", 1, "human"], ["integrator", "pass"], ["owner", "pass", 2]]));
    expect(elsewhere[4]).toEqual([]);
    // A word at a node, or another loop's stop, between the halt and the dispatch that follows the answer does not
    // spend the lift; the same loop's own stop that is no person's takes it away.
    const between = (more: RunNote[]) => taken(GAUNTLET, [...notes([["next-piece", "pass", 1], ["loop:pieces", "halt", 1, "human"]]), ...more, ...notes([["owner", "started", 2]])]).at(-1);
    expect(between([{ id: "w-1", run: "r", at: "node:next-piece", text: "they said go on" } as RunNote])).toEqual(["e-next-piece-pass"]);
    expect(between(notes([["loop:polish", "pass", 0, "bar-passed"]]))).toEqual(["e-next-piece-pass"]);
    expect(between(notes([["loop:pieces", "halt", 1, "max-iterations"]]))).toEqual([]);
  });

  it("a line that reports nothing does not take back what a node reported: a word at the node, or the line before its next dispatch", () => {
    const [doc] = runAt("run-nested");
    const word = { id: "w-1", run: "r", at: "node:tests", text: "a word at the tests" } as RunNote;
    const [first, last] = [notes([["builder", "pass", 0], ["tests", "pass", 0]]), notes([["judge", "pass", 0]])];
    expect(taken(doc, [...first, word, ...last])[4]).toEqual(["e-tests-judge"]);
    expect(taken(doc, [...first, ...notes([["tests", "started", 0]]), ...last])[4]).toEqual(["e-tests-judge"]);
    // A second visit to a node with an edge to itself: the line before the dispatch is the arrival, and the result
    // after it is the same visit, though the node had reported before.
    const solo: Graph = { ...REVIEW, edges: [...REVIEW.edges, { id: "e-again", from: "builder", to: "builder" }] } as Graph;
    expect(taken(solo, notes([["builder", "pass", 0], ["builder", "started", 0], ["builder", "pass", 0]]))).toEqual([[], [], ["e-again"], []]);
    // Of the edges taken into a node, the one from the node of the note before is the one followed, though another
    // source reported later: here a word at the first critic comes between the second critic's pass and the judge.
    const critics = BANK.edges.filter((e) => e.from === "builder").map((e) => e.to);
    const judge = BANK.edges.find((e) => e.from === critics[0])!.to;
    const said = [...notes([["builder", "pass", 0], [critics[0]!, "pass", 0], [critics[1]!, "pass", 0]]), { ...word, at: `node:${critics[0]}` } as RunNote, ...notes([[judge, "pass", 0]])];
    expect(stepsOf(modelAt(BANK, places(BANK), said))[5]).toMatchObject({ to: judge, from: critics[0] });
  });

  it("no edge is taken on a line that reports nothing: a word at a node that has not reported, or at one still running", () => {
    const say = (at: string, k: number): RunNote => ({ id: `w-${k}`, run: "r", at: `node:${at}`, text: "a word" }) as RunNote;
    // Words at the builder and then at the critic, nobody dispatched: nothing was taken between them.
    expect(taken(REVIEW, [say("builder", 1), say("critic", 2)])).toEqual([[], [], []]);
    // Three candidates fan in to one filter. The first is still running, with a word at it, when the filter is
    // reached: its edge was not taken, and the other two's were.
    const TOURNAMENT = graph("patterns/tournament-then-judge.grooph.json");
    const running = [...notes([["candidate-a", "started"]]), say("candidate-a", 1), ...notes([["candidate-b", "pass"], ["candidate-c", "pass"], ["filter", "started"]])];
    expect(taken(TOURNAMENT, running)[5]).toEqual(["e-candidate-b-filter", "e-candidate-c-filter"]);
    expect(taken(TOURNAMENT, running.filter((n) => n.id !== "w-1"))[4]).toEqual(["e-candidate-b-filter", "e-candidate-c-filter"]);
    // A word between the line before a dispatch and its result, at a node with an edge to itself: one visit still.
    const solo: Graph = { ...REVIEW, edges: [...REVIEW.edges, { id: "e-again", from: "builder", to: "builder" }] } as Graph;
    expect(taken(solo, [...notes([["builder", "started", 0]]), say("builder", 1), ...notes([["builder", "pass", 0]])])).toEqual([[], [], [], []]);
  });

  it("a second invalid-evidence in a row routes as a fail; and a run that ends at a stop node with no note there still got there", () => {
    // The critic cannot read its evidence, twice: the builder is next, by the critic's way back for a fail.
    const twice = taken(RUN, notes([["builder", "pass", 0], ["checks", "pass", 0], ["critic", "invalid-evidence", 0], ["critic", "invalid-evidence", 0], ["builder", "pass", 1]]));
    expect(twice[5]).toEqual(["e-critic-fail"]);
    // Once is not a fail: the lead dispatches the critic again, and nothing has been taken to the builder.
    expect(taken(RUN, notes([["builder", "pass", 0], ["checks", "pass", 0], ["critic", "invalid-evidence", 0], ["builder", "pass", 1]]))[4]).toEqual([]);
    // Nor is once in a later round, after twice in an earlier one: the second is the second in one round.
    expect(taken(RUN, notes([["builder", "pass", 0], ["checks", "pass", 0], ["critic", "invalid-evidence", 0], ["critic", "invalid-evidence", 0], ["builder", "pass", 1], ["checks", "pass", 1], ["critic", "invalid-evidence", 1], ["builder", "pass", 2]]))[8]).toEqual([]);
    // The recorded run's notes, with the one at Done written as leads often write it: a plain note at the edge
    // into Done. Core reads the run as ended at Done; the critic's pass took its edge there, and the run's end
    // note, the last about the run with an outcome, is where that is shown. The edge's own note is not a move.
    const without = NOTES.map((n) => (n.at === "node:done" ? ({ id: n.id, run: n.run, at: "edge:e-critic-pass", text: "critic -> done" } as RunNote) : n));
    const model = modelAt(RUN, places(RUN), without);
    expect(model.run!.at).toBe("done");
    const steps = stepsOf(model);
    expect(steps[13]!.says).toMatch(/^Note 13 of 15, at the edge .+: critic -> done$/);
    expect([steps[13]!.about, steps[13]!.to]).toEqual([true, undefined]);
    expect(without[13]!.outcome).toBe("pass");
    expect([steps[14]!.to, steps[14]!.edge, steps[14]!.says.startsWith("Note 14 of 15, about the run")]).toEqual(["done", "e-critic-pass", true]);
    expect(steps[15]!.edge).toBeUndefined();
    // With its own note at Done, the last notes pick nothing out, as before.
    expect(stepsOf(modelAt(RUN, places(RUN), NOTES)).at(-1)!.edge).toBeUndefined();
  });
});

describe("panes", () => {
  const shown = { k: 0, lit: null, took: [] };
  const place = (doc: Graph) => {
    const built = panes(modelOf(doc), shown);
    return { built, z: (id: string) => built.node(id)[2] };
  };

  it("a node is one pane toward the eye for each loop or box it is in", () => {
    const review = place(REVIEW);
    expect(["builder", "critic", "merge-gate", "done"].map(review.z)).toEqual([84, 84, 84, 0]);
    const gauntlet = place(GAUNTLET);
    // The inner loop's nodes are two panes out, the outer loop's own node one, and what is in no loop stays.
    expect(["owner", "capture-check", "critic", "next-piece", "planner", "integrator"].map(gauntlet.z)).toEqual([168, 168, 168, 84, 0, 0]);
  });

  it("a document that is not sound is still drawn: what cannot be placed is left out, and a group that holds itself is held once", () => {
    // A run whose working copy has an edge to a node that is gone; and, added here, notes at a node, an edge and a
    // loop that are not in it: each is a note about the run, and picks nothing out.
    const [broken, written] = runAt("run-broken");
    const gone = ["node:nobody", "edge:e-nowhere", "loop:no-such-loop"].map((at, k) => ({ id: `n-90${k}`, run: written[0]!.run, at, ended: "2026-09-19T15:00:00Z", text: `a note at ${at}` }) as RunNote);
    const notes = [...written, ...gone];
    const model = modelAt(broken, places(broken), notes);
    expect(broken.edges.length).toBeGreaterThan(model.edges.length);
    expect(model.edges.every((e) => broken.nodes.some((n) => n.id === e.from) && broken.nodes.some((n) => n.id === e.to))).toBe(true);
    expect(() => [panes(model, shown), stepsOf(model)]).not.toThrow();
    expect(model.run!.notes.slice(-3).map((n) => [n.about, n.id])).toEqual([["graph", null], ["graph", null], ["graph", null]]);
    for (const step of stepsOf(model).slice(-3)) expect([step.nodes, step.edge, step.loops, step.to]).toEqual([undefined, undefined, undefined, undefined]);
    const cycle = JSON.parse(readFileSync(join(root, "fixtures/invalid/E_GROUP_CYCLE/group-holds-itself.grooph.json"), "utf8")) as Graph;
    expect(() => panes(modelAt(cycle, places(cycle)), shown)).not.toThrow();
    // A node listed by two groups, neither inside the other, is the first one's (graph-ir section 2).
    const overlap = JSON.parse(readFileSync(join(root, "fixtures/invalid/W_GROUP_OVERLAP/node-in-two-groups.grooph.json"), "utf8")) as Graph;
    expect(overlap.groups!.map((g) => [g.id, g.members])).toEqual([["fix", ["builder", "writer"]], ["notes", ["writer"]]]);
    expect(modelAt(overlap, places(overlap)).groups.map((g) => [g.id, g.nodes, g.inside])).toEqual([["fix", ["builder", "writer"], null], ["notes", [], null]]);
  });

  it("a node listed by a group and by one inside it is the inner one's, as core reads it, and has a pane of its own for each", () => {
    // Nesting said twice (graph-ir, W_GROUP_OVERLAP): the outer group lists the inner one and the inner one's node.
    const twice: Graph = { ...NESTED, groups: [{ id: "outer", name: "Outer", from: "outer@1", members: ["inner", "review-builder", "release"] }, { id: "inner", name: "Inner", from: "inner@1", members: ["review-builder"] }], loops: [] };
    const model = modelAt(twice, places(twice));
    expect(model.groups.map((g) => [g.id, g.nodes, g.inside])).toEqual([["outer", ["release", "review-builder"], null], ["inner", ["review-builder"], "outer"]]);
    expect(Object.fromEntries(boxesOf(model.loops, model.groups).map((b) => [b.name, b.depth]))).toEqual({ Outer: 1, Inner: 2 });
    const built = panes(model, shown);
    expect([built.node("review-builder")[2], built.node("release")[2], built.node("plan")[2]]).toEqual([168, 84, 0]);
    // A group listed by a group and by one inside that is the inner one's too; one listed by two that do not hold
    // each other is the first one's, and its nodes are held once.
    const deep: Graph = { ...twice, groups: [["a", ["b", "c"]], ["b", ["c"]], ["c", ["plan"]], ["d", ["c", "release"]]].map(([id, members]) => ({ id: id as string, name: id as string, members: members as string[] })) };
    const groups = modelAt(deep, places(deep)).groups;
    expect(groups.map((g) => [g.id, g.inside, g.nodes])).toEqual([["a", null, ["plan"]], ["b", "a", ["plan"]], ["c", "b", ["plan"]], ["d", null, ["release"]]]);
  });

  it("its rows wrap where the canvas's do: two nodes to a row under 640 pixels, four from there", () => {
    for (const width of [320, 390, 639, 640, 1024, 1920]) {
      vi.stubGlobal("window", { innerWidth: width });
      expect(columnsAt(width), String(width)).toBe(columnsForViewport());
    }
  });

  it("a loop with the very nodes of a subgrooph is inside it; a group that is no subgrooph is not a box on the picture, and has no pane", () => {
    // The document nests the subgrooph in a plain group, "Review and release", which also holds Release.
    expect(modelOf(NESTED).groups.map((g) => [g.name, g.from, g.inside])).toEqual([["Review gate", "review-gate@1", "delivery"], ["Review and release", null, null]]);
    const boxes = Object.fromEntries(boxesOf(modelOf(NESTED).loops, modelOf(NESTED).groups).map((b) => [b.name + " · " + b.sub, b.depth]));
    expect(boxes).toEqual({ "Review · loop": 2, "Review gate · subgrooph, from review-gate@1": 1 });
    const nested = place(NESTED);
    expect(["plan", "release", "review-builder", "review-critic", "review-merge-gate", "done"].map(nested.z)).toEqual([0, 0, 168, 168, 168, 0]);
    // A subgrooph inside a subgrooph is a pane out from it, through a plain group between them.
    const through: Graph = { ...NESTED, groups: [{ ...NESTED.groups![0]! }, { ...NESTED.groups![1]! }, { id: "all", name: "All", from: "all@1", members: ["delivery", "plan"] }] };
    const deep = boxesOf(modelOf(through).loops, modelOf(through).groups);
    expect(Object.fromEntries(deep.map((b) => [b.name, b.depth]))).toEqual({ Review: 3, "Review gate": 2, All: 1 });
  });

  it("two edges between the same two nodes are drawn apart, and a pane's name has other places to stand than its own", () => {
    const [doc] = runAt("run-nested");
    const built = panes(modelAt(doc, places(doc)), shown);
    const [a, b] = [built.path("e-judge-fail"), built.path("e-judge-next-phase")];
    expect([a.length, b.length]).toEqual([19, 19]);
    expect(Math.abs(a[9]![0] - b[9]![0])).toBe(22);
    expect([a[0], a[18]]).toEqual([b[0], b[18]]);
    // The first of two in the document is drawn as it would be alone: here the forward edge (builder to tests,
    // tests back to builder), a straight line. Listed after its twin it is the one that bows.
    expect(built.path("e-builder-tests")).toHaveLength(2);
    const turned: Graph = { ...doc, edges: [...doc.edges.filter((e) => e.id !== "e-builder-tests"), doc.edges.find((e) => e.id === "e-builder-tests")!] };
    expect(panes(modelAt(turned, places(turned)), shown).path("e-builder-tests")).toHaveLength(19);
    // In a row, where the nodes are side by side, it is to the side of the line all the same: under it. The review
    // loop's layout is one row; its way back, and a second edge beside the forward one, each leave the line.
    const flat = graph("fixtures/valid/review-loop.grooph.json");
    const twice: Graph = { ...flat, edges: [...flat.edges, { ...flat.edges.find((e) => e.id === "e-review-pass")!, id: "e-review-pass-too" }] };
    const row = panes(modelAt(twice, places(twice, 4)), shown);
    const [straight, back, second] = [row.path("e-build-review"), row.path("e-review-fail"), row.path("e-review-pass-too")];
    expect(straight).toHaveLength(2);
    expect(straight[0]![1]).toBe(straight[1]![1]);
    // (A way back's 70, and 22 past the forward edge it is the twin of.)
    expect([back[9]![1] - back[0]![1], back[18]![1] - back[0]![1]]).toEqual([-92, 0]);
    expect([second[9]![1] - second[0]![1], second[9]![0]]).toEqual([-22, (second[0]![0] + second[18]![0]) / 2]);
    expect(row.path("e-review-pass")).toHaveLength(2);
    // An edge from a node to itself, a way back or not, goes out to the right of its node and comes back.
    const selfish: Graph = { ...REVIEW, edges: [...REVIEW.edges, { id: "e-self", from: "builder", to: "builder", when: "fail" }, { id: "e-self-too", from: "builder", to: "builder" }], loops: REVIEW.loops.map((l) => ({ ...l, back: [...(l.back ?? []), "e-self"] })) } as Graph;
    const own = panes(modelAt(selfish, places(selfish)), shown);
    for (const [id, out] of [["e-self", 70], ["e-self-too", 92]] as const) {
      const path = own.path(id);
      expect([path[9]![0] - path[0]![0], path[9]![1] - path[0]![1], path[18]], id).toEqual([out, 0, path[0]]);
      // It leaves from the right of its card's middle, as a way back does, and goes out past the card's edge (53).
      expect(path[0]![0] - own.node("builder")[0], id).toBe(50);
    }
    // One plain edge to itself, alone: seen too.
    const once: Graph = { ...REVIEW, edges: [...REVIEW.edges, { id: "e-self", from: "builder", to: "builder" }] } as Graph;
    expect(panes(modelAt(once, places(once)), shown).path("e-self")[9]![0] - panes(modelAt(once, places(once)), shown).node("builder")[0]).toBe(120);
    // Each pane's name may stand at any of six places round its pane: the stage takes the first no card is over.
    const names = built.prims.flatMap((p) => (p.t === "text" && / · (loop|subgrooph)/.test(p.text) ? [p] : []));
    expect(names.map((p) => p.text).sort()).toEqual(["Grind · loop", "Phases · loop"]);
    for (const p of names) expect(p.or).toHaveLength(5);
  });

  it("every node is where the canvas has it, on a phone and on a wide screen, and every node and edge is drawn once", () => {
    // The review loop is a row on the picture, and a row here: not a column of this view's own.
    const row = graph("fixtures/valid/review-loop.grooph.json");
    const at = panes(modelAt(row, places(row, 4)), shown);
    expect(new Set(row.nodes.map((n) => at.node(n.id)[1])).size).toBe(1);
    expect(new Set(row.nodes.map((n) => at.node(n.id)[0])).size).toBe(row.nodes.length);
    for (const [path, columns] of ALL.flatMap((p) => [[p, 2], [p, 4]] as const)) {
      const doc = graph(path);
      const model = modelAt(doc, places(doc, columns));
      const { prims, node } = panes(model, shown);
      expect(prims.filter((p) => p.t === "card").map((p) => (p.t === "card" ? p.id : "")).sort(), path).toEqual(doc.nodes.map((n) => n.id).sort());
      expect(prims.filter((p) => p.t === "line" && p.arrow).map((p) => p.key).sort(), path).toEqual(doc.edges.map((e) => `edge:${e.id}`).sort());
      // Left to right and top to bottom as on the canvas: its own x and y for this screen, scaled.
      const canvas = places(doc, columns);
      for (const n of doc.nodes) expect([node(n.id)[0], node(n.id)[1]], `${path} ${n.id}`).toEqual([canvas[n.id]!.x * 0.8, -canvas[n.id]!.y * 0.4]);
      // A way back is dashed and in its loop's color; an edge that goes on is not.
      for (const e of model.edges) {
        const line = prims.find((p) => p.key === `edge:${e.id}`)!;
        expect(line.t === "line" && !!line.dash, `${path} ${e.id}`).toBe(!!e.back);
      }
    }
  });
});

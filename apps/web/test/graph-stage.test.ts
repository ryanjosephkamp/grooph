import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { isPersonStep, parseGraphText, parseRunNotes, replaySteps, resolvePositions, summarizeRun, type Graph, type RunNote } from "@grooph/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { columnsForViewport } from "../src/doc/layout.js";

import { firstPass } from "../src/ui/canvas/graph-views.js";
import { columnsAt, modelOf as modelAt, stepsOf } from "../src/ui/canvas/stage/model.js";
import { boxesOf, panes } from "../src/ui/canvas/stage/panes.js";
import { shownAt, type Shown } from "../src/ui/canvas/stage/shapes.js";
import { brakes, reach, spiral, topOf } from "../src/ui/canvas/stage/spiral.js";

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

describe("the spiral and its lid", () => {
  const whole: Shown = { k: 0, lit: null, took: [] };
  type Prims = ReturnType<typeof spiral>["prims"];
  const lids = (prims: Prims) => prims.filter((p) => p.t === "poly" && p.fill === "brake");
  const rings = (prims: Prims) => prims.filter((p) => p.t === "line" && p.stroke === "k-gate");
  const dashed = (prims: Prims) => prims.filter((p) => p.t === "line" && p.stroke === "brake" && p.dash);
  const turns = (y: number): number => Math.round((y / 54) * 100) / 100;
  const turnsOf = turns;
  /** What the slider hands a view at a step: the component's own working out (`shownAt`), not a copy of it. */
  const at = (model: ReturnType<typeof modelAt>, k: number): Shown => shownAt(model, stepsOf(model), k);
  /** The edges a view has drawn and not hidden: each by its key, with how strong it is and the turns it starts and ends at. */
  const edges = (prims: Prims) => Object.fromEntries(prims.flatMap((p) => (p.t === "line" && p.key?.startsWith("edge:") && !p.hide ? [[p.key.slice(5), [p.alpha ?? 1, turns(p.pts[0]![1]), turns(p.pts[p.pts.length - 1]![1])]]] : [])));
  /** The nested run's graph, and notes written for it: `[node, outcome, round or none, verdict]`. */
  const [NEST] = runAt("run-nested");
  const notes = (list: [string, string, number?, string?][]): RunNote[] =>
    list.map(([node, outcome, round, verdict], k) => ({ id: `n-${String(k + 1).padStart(4, "0")}`, run: "r", at: node.includes(":") ? node : `node:${node}`, ended: `2026-09-19T13:${String(k).padStart(2, "0")}:00Z`, outcome, ...(round === undefined ? {} : { round }), ...(verdict ? { verdict } : {}) }) as RunNote);
  const withStops = (doc: Graph, id: string, stops: unknown[]): Graph => ({ ...doc, loops: doc.loops.map((l) => (l.id === id ? ({ ...l, stops } as typeof l) : l)) });

  it("every brake of a loop is said, in the document's order, and the ones that count rounds are places on the way up", () => {
    // Review: the cap is 4, so the lid is over round 3; 10 dispatches at two a full round is 5 full rounds.
    expect(brakes(loop(REVIEW, "review"), 4)).toEqual({ lid: 4, asked: [], budget: 5, words: ["max iterations: 4 (the lid, over round 3)", "budget: 10 dispatches, at most 5 full rounds (the dashed ring, a reading)"] });
    // Pieces: a person is asked after every second round, which is after rounds 1 and 3, the second at the lid's
    // own height; their stop is listed before the cap, so they are asked there before the cap is looked at. 42
    // dispatches at four a full round is ten and a half: said, and not drawn. Never "two more than four rounds can
    // use": a round can cost more than a full one, and one cut short costs less.
    expect(brakes(loop(GAUNTLET, "pieces"), 4)).toEqual({
      lid: 4,
      asked: [2, 4],
      budget: null,
      words: ["a person is asked every 2 rounds (the amber rings)", "max iterations: 4 (the lid, over round 3)", "budget: 42 dispatches, at most 10 full rounds and 2 more (not drawn: above the rounds shown)"],
    });
    expect(brakes(loop(GAUNTLET, "polish"), 3)).toMatchObject({ lid: 3, asked: [], budget: 10 / 3 });
    // A budget that is not in dispatches is said to have no place, and nothing is drawn for it.
    expect(brakes(loop(RUN, "sandwich"), 5)).toEqual({ lid: 5, asked: [], budget: null, words: ["max iterations: 5 (the lid, over round 4)", "budget: 80 turns (no place on the way up)"] });
    const cut = (stops: unknown[], top?: number) => {
      const l = loop(withStops(REVIEW, "review", stops), "review");
      return brakes(l, top ?? topOf(modelOf(withStops(REVIEW, "review", stops)), l));
    };
    // A person who is not asked by the round is still a brake, and is said.
    expect(cut([{ kind: "bar-passed" }, { kind: "human" }]).words).toEqual(["no lid: no cap on rounds", "human halt (no place on the way up)"]);
    // Two budgets in dispatches, the looser listed first: the least is the one a lead is held to, and the one
    // drawn; both are said. And two caps: the tightest is the lid, wherever it is listed.
    expect(cut([{ kind: "budget", measure: "minutes", limit: 30 }, { kind: "max-iterations", n: 7 }, { kind: "budget", measure: "dispatches", limit: 40 }, { kind: "budget", measure: "dispatches", limit: 6 }, { kind: "max-iterations", n: 5 }])).toEqual({
      lid: 5,
      asked: [],
      budget: 3,
      words: ["budget: 30 minutes (no place on the way up)", "max iterations: 7 (a looser cap: the lid stops the loop first)", "budget: 40 dispatches, at most 20 full rounds (a looser budget)", "budget: 6 dispatches, at most 3 full rounds (the dashed ring, a reading)", "max iterations: 5 (the lid, over round 4)"],
    });
    // No cap: no lid to be above, and the spiral is two rounds taller than a first pass.
    expect(cut([{ kind: "budget", measure: "dispatches", limit: 30 }])).toEqual({ lid: null, asked: [], budget: null, words: ["no lid: no cap on rounds", "budget: 30 dispatches, at most 15 full rounds (not drawn: above the rounds shown)"] });
    expect(topOf(modelOf(withStops(REVIEW, "review", [])), loop(withStops(REVIEW, "review", []), "review"))).toBe(3);
    // A person asked less often than the lid allows rounds: no ring, and the words do not point at one.
    expect(cut([{ kind: "human", every: 3 }, { kind: "max-iterations", n: 2 }])).toMatchObject({ asked: [], words: ["a person is asked every 3 rounds (not within the rounds drawn)", "max iterations: 2 (the lid, over round 1)"] });
    // The cap listed before the person: at the lid's own round the cap fires first, and no ring is drawn there.
    expect(cut([{ kind: "max-iterations", n: 4 }, { kind: "human", every: 2 }]).asked).toEqual([2]);
    expect(cut([{ kind: "human", every: 2 }, { kind: "max-iterations", n: 4 }]).asked).toEqual([2, 4]);
    // Where that leaves no ring at all, the words say why, and do not say the round is out of the drawing.
    expect(cut([{ kind: "max-iterations", n: 2 }, { kind: "human", every: 2 }])).toMatchObject({ asked: [], words: ["max iterations: 2 (the lid, over round 1)", "a person is asked every 2 rounds (no ring: only at the lid, where the cap is looked at first)"] });
    // Two people by the round: each has rings, and each line says so.
    expect(cut([{ kind: "human", every: 2 }, { kind: "human", every: 3 }, { kind: "max-iterations", n: 6 }])).toMatchObject({ asked: [2, 3, 4, 6], words: ["a person is asked every 2 rounds (the amber rings)", "a person is asked every 3 rounds (the amber rings)", "max iterations: 6 (the lid, over round 5)"] });
  });

  it("draws each brake where it is, and never lights the lid with its loop", () => {
    const m = modelOf(GAUNTLET);
    const { prims } = spiral(m, { ...whole, k: 1, lit: new Set(["loop:pieces", "loop:polish"]) });
    // One lid a loop, 54 a round up: a cap of 3 is a lid over round 2, at the end of its turn. No lid has a key: a
    // step about the loop lights the rounds taken, not the lid.
    expect(lids(prims).map((p) => (p.t === "poly" ? p.pts[0]![1] : 0)).sort()).toEqual([3 * 54, 4 * 54]);
    expect(lids(prims).every((p) => p.key === undefined)).toBe(true);
    expect(prims.filter((p) => p.key?.startsWith("loop:")).every((p) => p.t === "line" && p.stroke !== "brake")).toBe(true);
    // Pieces' two amber rings, after rounds 1 and 3; the one at the lid's height is inside the lid.
    const amber = rings(prims).map((p) => (p.t === "line" ? [p.pts[0]![1], Math.round(Math.hypot(p.pts[0]![0] - p.pts[20]![0], p.pts[0]![2] - p.pts[20]![2]) / 2)] : []));
    expect(amber.map(([y]) => y)).toEqual([2 * 54, 4 * 54]);
    expect(amber[1]![1]).toBeLessThan(amber[0]![1]!);
    // One dashed ring: Polish's budget, a third of a round over its lid. Pieces' is not drawn.
    expect(dashed(prims).map((p) => (p.t === "line" ? Math.round(p.pts[0]![1]) : 0))).toEqual([Math.round((10 / 3) * 54)]);
  });

  it("every node is one card on every template and every valid fixture, with or without a loop, and all but the cards is grown", () => {
    const valid = readdirSync(join(root, "fixtures/valid")).filter((f) => f.endsWith(".grooph.json")).map((f) => `fixtures/valid/${f}`);
    for (const path of [...ALL, ...valid]) {
      const doc = graph(path);
      const m = modelAt(doc, places(doc));
      const { prims, node, path: way } = spiral(m, whole);
      expect(prims.filter((p) => p.t === "card").map((p) => (p.t === "card" ? p.id : "")).sort(), path).toEqual(doc.nodes.map((n) => n.id).sort());
      expect(prims.every((p) => (p.t === "card") !== !!p.grow), path).toBe(true);
      for (const n of doc.nodes) expect(node(n.id).every(Number.isFinite), `${path} ${n.id}`).toBe(true);
      for (const e of m.edges) expect(way(e.id, 0, e.back ? 1 : 0).flat().every(Number.isFinite), `${path} ${e.id}`).toBe(true);
      // A node in no loop is a card with its name alone where there is a loop to look at.
      for (const p of prims) if (p.t === "card") expect(!!p.small, `${path} ${p.id}`).toBe(m.loops.length > 0 && !m.nodes.find((n) => n.id === p.id)!.loop);
      expect(prims.some((p) => p.t === "text" && p.text.startsWith("No loop in this graph")), path).toBe(m.loops.length === 0);
    }
  });

  it("a graph with no loop has its nodes one behind the other in the order of a first pass, and an edge that passes a node goes over it", () => {
    const doc = graph("patterns/tournament-then-judge.grooph.json");
    const m = modelAt(doc, places(doc));
    const built = spiral(m, whole);
    // Each node is farther forward than the one before it, by the same step: none is beside another.
    const depth = m.rows.flat().map((id) => built.node(id)[2]);
    for (let n = 1; n < depth.length; n += 1) expect(depth[n]! - depth[n - 1]!).toBe(150);
    // Three candidates go to one filter. The nearest one's edge is straight; the others rise over the candidates
    // between, the farthest highest: a straight line through them would read as a chain.
    const rise = (id: string) => Math.max(...built.path(id).map((p) => p[1]));
    const into = m.edges.filter((e) => e.to === m.rows.flat()[3]).sort((a, b) => m.rows.flat().indexOf(b.from) - m.rows.flat().indexOf(a.from));
    expect(into).toHaveLength(3);
    expect(into.map((e) => Math.round(rise(e.id)))).toEqual([0, 26, 52]);
  });

  it("an edge between two of a loop's nodes that is not the next step of its round is drawn: only the spiral itself is not drawn twice", () => {
    // The critic bank: a builder fans out to four critics, which fan in to a judge. Its stations are in a row round
    // one turn, and of those edges only builder to the first critic and the last critic to the judge are the turn.
    const bank = graph("patterns/specialist-critic-bank.grooph.json");
    const m = modelAt(bank, places(bank));
    const shown = Object.keys(edges(spiral(m, whole).prims));
    const own = m.loops[0]!.own;
    const within = m.edges.filter((e) => !e.back && own.includes(e.from) && own.includes(e.to));
    const onward = within.filter((e) => own.indexOf(e.to) === own.indexOf(e.from) + 1);
    expect(within.length - onward.length).toBeGreaterThanOrEqual(6);
    for (const e of within) expect(shown.includes(`${e.id}@0>0`), e.id).toBe(!onward.includes(e));
    // And every other edge of the graph is there: none is lost.
    expect(shown.length).toBe(m.edges.length - onward.length);
  });

  it("on a run it is solid as far up as the run has been, says the round the run is in, and has a bead for each dispatch so far, where it was", () => {
    const [doc, written] = runAt("run-nested");
    const m = modelAt(doc, places(doc), written);
    const steps = stepsOf(m);
    // Note 8: the judge, in round 0 of Phases, after two rounds of Grind. Grind is where it was left.
    expect(reach(m, steps, 8)).toEqual({ grind: { now: 1.5, most: 1.5 }, phases: { now: 0.5, most: 0.5 } });
    // Note 10: the builder again, by the phases' way back. Phases is in round 1, at Grind's stop; Grind starts
    // afresh in round 0, and has been as far up as round 1.
    expect(reach(m, steps, 10)).toEqual({ grind: { now: 0, most: 1.5 }, phases: { now: 1, most: 1 } });
    expect(reach(m, steps, 1)).toEqual({});
    const solid = (k: number, id: string) => {
      const line = spiral(m, at(m, k)).prims.find((p) => p.key === `loop:${id}`);
      return line?.t === "line" ? turns(line.pts[line.pts.length - 1]![1]) : null;
    };
    expect([solid(2, "grind"), solid(2, "phases")]).toEqual([null, null]);
    expect([solid(8, "grind"), solid(8, "phases")]).toEqual([1.5, 0.5]);
    expect([solid(10, "grind"), solid(10, "phases")]).toEqual([1.5, 1]);
    const words = (k: number) => spiral(m, at(m, k)).prims.flatMap((p) => (p.t === "text" && p.up ? [p.text] : []));
    expect(words(1)).toEqual(["Grind\nnot entered", "Phases\nnot entered"]);
    // The lid is over round 4, the last a cap of 5 allows: "lid at 5" beside "round 4" would read as a round to spare.
    expect(words(10)).toEqual(["Grind\nround 0, lid over round 4", "Phases\nround 1, lid over round 4"]);
    // Beads: one a dispatch so far, at its round's height and its station's part of the turn; green for a pass,
    // amber for a fail.
    const beads = (k: number) => spiral(m, at(m, k)).prims.flatMap((p) => (p.t === "dot" && p.r === 6 ? [[turns(p.at[1]), p.fill, Math.round(Math.hypot(p.at[0] - spiral(m, at(m, k)).node("builder")[0], p.at[2]))] as const] : []));
    expect([beads(1).length, beads(3).length, beads(8).length, beads(0).length]).toEqual([0, 2, 5, 7]);
    expect(beads(3).map(([y, fill]) => [y, fill])).toEqual([[0, "ok"], [0.5, "bad"]]);
    // Grind started afresh: its second builder and tests of round 0 are where the first were. Each has its own
    // bead, the later set beside the earlier, so the failed tests of the first phase are still seen.
    // (At half a turn there is the judge's fail too, on Phases.)
    const low = beads(0).filter(([y]) => y === 0 || y === 0.5);
    expect(low.map(([y, fill]) => `${y} ${fill}`).sort()).toEqual(["0 ok", "0 ok", "0.5 bad", "0.5 bad", "0.5 ok"]);
    expect(new Set(beads(0).map(([y, , far]) => `${y}:${far}`)).size).toBe(7);
  });

  it("a bead is gray for a dispatch that neither passed nor failed", () => {
    const m = modelAt(NEST, places(NEST), notes([["builder", "pass", 0], ["tests", "invalid-evidence", 0], ["builder", "halt", 1]]));
    expect(spiral(m, at(m, 0)).prims.flatMap((p) => (p.t === "dot" && p.r === 6 ? [p.fill] : []))).toEqual(["ok", "ink-3", "ink-3"]);
  });

  it("a run's edges are between the rounds it took them, as far as the slider has come; one it never took is faint", () => {
    const m = modelAt(RUN, places(RUN), NOTES);
    const drawn = (k: number) => edges(spiral(m, at(m, k)).prims);
    // The whole run: the critic's fail back to the builder, from two thirds round turn 0 to the start of turn 1;
    // its pass out to Done from round 1; and the way back from the checks, never taken, faint at round 0. The
    // edges that are the spiral are not drawn twice over it.
    expect(drawn(0)).toEqual({ "e-critic-fail@0>1": [1, 0.67, 1], "e-critic-pass@1>0": [1, 1.67, 0], "e-checks-fail@0>1": [0.3, 0.33, 1] });
    // At note 6, the critic's fail: no way back has been taken yet, and none is drawn as taken. The edge the note
    // moved along, which is the spiral's own, is shown because the step is about it.
    expect(drawn(6)).toEqual({ "e-checks-critic@0>0": [1, 0.33, 0.67], "e-checks-fail@0>1": [0.3, 0.33, 1] });
    expect(drawn(9)).toMatchObject({ "e-critic-fail@0>1": [1, 0.67, 1] });
  });

  it("a note about an edge lights the edge where it is drawn already, and draws one the run has not come to as never taken: it is not a move", () => {
    const m = modelAt(RUN, places(RUN), NOTES);
    // Note 8 is a proposal about checks to critic, which the run took in round 0: that line, lit, and no other.
    const eight = at(m, 8);
    expect(eight.about).toEqual({ edge: "e-checks-critic", r0: 0 });
    expect(edges(spiral(m, eight).prims)).toEqual({ "e-checks-critic@0>0": [1, 0.33, 0.67], "e-checks-fail@0>1": [0.3, 0.33, 1] });
    expect(eight.lit!.has("edge:e-checks-critic@0>0")).toBe(true);
    // The same note about the critic's pass, which the run has not come to by then: faint at round 0, and lit;
    // not at full strength from a round the run has not reached.
    const ahead: Shown = { ...at(m, 8), lit: new Set(["node:critic", "node:done", "edge:e-critic-pass"]), about: { edge: "e-critic-pass", r0: 1 } };
    expect(edges(spiral(m, ahead).prims)["e-critic-pass@0>0"]).toEqual([0.3, 0.67, 0]);
    expect(ahead.lit!.has("edge:e-critic-pass@0>0")).toBe(true);
    // And about a way back: drawn as a way back is, arriving one turn up, never down into the round it leaves.
    const back: Shown = { ...at(m, 4), lit: new Set(["edge:e-critic-fail"]), about: { edge: "e-critic-fail", r0: 0 } };
    expect(edges(spiral(m, back).prims)["e-critic-fail@0>1"]).toEqual([0.3, 0.67, 1]);
    // About an edge that is the spiral itself, taken in round 0, while the run stands in round 1: the step's own
    // key is for round 1, where it was not taken, so nothing but this branch shows the line of round 0.
    const earlier = (about: boolean): Shown => ({ ...at(m, 9), lit: new Set(["node:builder", "node:checks", "edge:e-builder-checks", "edge:e-builder-checks@1>1"]), ...(about ? { about: { edge: "e-builder-checks", r0: 1 } } : {}) });
    expect(edges(spiral(m, earlier(true)).prims)["e-builder-checks@0>0"]).toEqual([1, 0, 0.33]);
    expect(edges(spiral(m, earlier(false)).prims)["e-builder-checks@0>0"]).toBeUndefined();
  });

  it("an edge the run took twice from the same round is drawn twice, each to the round it arrived in", () => {
    // Both phases go green the first time: tests to the judge from round 0 of Grind, into round 0 and then round 1 of Phases.
    const m = modelAt(NEST, places(NEST), notes([["builder", "pass", 0], ["tests", "pass", 0], ["judge", "fail", 0, "next-phase"], ["builder", "pass", 0], ["tests", "pass", 0], ["judge", "pass", 1]]));
    const drawn = edges(spiral(m, at(m, 0)).prims);
    expect(drawn["e-tests-judge@0>0"]).toEqual([1, 0.5, 0.5]);
    expect(drawn["e-tests-judge@0>1"]).toEqual([1, 0.5, 1.5]);
  });

  it("where a run's notes name no round, a loop inside another starts afresh and the outer one goes on, at every step alike", () => {
    const m = modelAt(NEST, places(NEST), notes([["builder", "pass", 0], ["tests", "fail", 0], ["builder", "pass", 1], ["tests", "pass", 1], ["judge", "fail", 0, "next-phase"], ["builder", "pass"], ["tests", "pass"], ["judge", "pass"]]));
    expect(m.run!.dispatches.map((d) => [d.node, d.round])).toEqual([["builder", 0], ["tests", 0], ["builder", 1], ["tests", 1], ["judge", 0], ["builder", 0], ["tests", 0], ["judge", 1]]);
    const steps = stepsOf(m);
    expect(reach(m, steps, 6)).toEqual({ grind: { now: 0, most: 1.5 }, phases: { now: 1, most: 1 } });
    expect(reach(m, steps, 8)).toEqual({ grind: { now: 0.5, most: 1.5 }, phases: { now: 1.5, most: 1.5 } });
    // A loop's own way back, with no round named: its next round.
    const again = modelAt(NEST, places(NEST), notes([["builder", "pass"], ["tests", "fail"], ["builder", "pass"], ["tests", "fail"], ["builder", "pass"]]));
    expect(again.run!.dispatches.map((d) => d.round)).toEqual([0, 0, 1, 1, 2]);
  });

  it("every loop inside one that comes round starts afresh, wherever its way back lands and however deep; twins do not", () => {
    // Plan is in Phases, outside Grind, and both of the judge's ways back go to it: the way back does not land in Grind.
    const viaPlan: Graph = {
      ...NEST,
      nodes: [{ ...NEST.nodes.find((n) => n.id === "judge")!, id: "plan", name: "Plan" }, ...NEST.nodes],
      edges: [{ id: "e-plan-builder", from: "plan", to: "builder" }, ...NEST.edges.map((e) => (e.from === "judge" && e.to === "builder" ? { ...e, to: "plan" } : e))],
      loops: NEST.loops.map((l) => (l.id === "phases" ? { ...l, members: ["plan", ...l.members] } : l)),
    } as Graph;
    const run = [["plan", "pass"], ["builder", "pass"], ["tests", "fail"], ["builder", "pass"], ["tests", "pass"], ["judge", "fail", undefined, "next-phase"], ["plan", "pass"], ["builder", "pass"], ["tests", "pass"], ["judge", "pass"]] as [string, string, number?, string?][];
    const m = modelAt(viaPlan, places(viaPlan), notes(run));
    expect(m.run!.dispatches.map((d) => `${d.node} ${d.loop}:${d.round}`)).toEqual(["plan phases:0", "builder grind:0", "tests grind:0", "builder grind:1", "tests grind:1", "judge phases:0", "plan phases:1", "builder grind:0", "tests grind:0", "judge phases:1"]);
    expect(reach(m, stepsOf(m), 8).grind).toEqual({ now: 0, most: 1.5 });
    // Three deep, every round named: after the outermost comes round, the middle loop is at round 0 while the
    // run is in the innermost, before any note of the middle loop's own says so.
    const all = { ...NEST.loops.find((l) => l.id === "phases")!, id: "all", name: "All", members: ["builder", "tests", "judge", "chief"], back: ["e-chief-again"] };
    const deep: Graph = { ...NEST, nodes: [...NEST.nodes, { ...NEST.nodes.find((n) => n.id === "judge")!, id: "chief", name: "Chief" }], edges: [...NEST.edges.filter((e) => e.id !== "e-judge-pass"), { id: "e-judge-chief", from: "judge", to: "chief", when: "pass" }, { id: "e-chief-again", from: "chief", to: "builder", when: "fail" }], loops: [...NEST.loops, all] } as Graph;
    const named = modelAt(deep, places(deep), notes([["builder", "pass", 0], ["tests", "pass", 0], ["judge", "fail", 0, "next-phase"], ["builder", "pass", 0], ["tests", "pass", 0], ["judge", "pass", 1], ["chief", "fail", 0], ["builder", "pass", 0], ["tests", "pass", 0], ["judge", "pass", 0]]));
    expect(named.loops.map((l) => [l.id, l.inside])).toEqual([["grind", "phases"], ["phases", "all"], ["all", null]]);
    expect(reach(named, stepsOf(named), 7)).toMatchObject({ phases: { now: 1.5 }, all: { now: 0.5 } });
    expect(reach(named, stepsOf(named), 8)).toMatchObject({ grind: { now: 0 }, phases: { now: 0 }, all: { now: 1 } });
    // And with no round named, the judge after the outermost way back is in round 0 of the middle loop.
    const bare = modelAt(deep, places(deep), notes([["builder", "pass"], ["tests", "pass"], ["judge", "fail", undefined, "next-phase"], ["builder", "pass"], ["tests", "pass"], ["judge", "pass"], ["chief", "fail"], ["builder", "pass"], ["tests", "pass"], ["judge", "pass"]]));
    expect(bare.run!.dispatches.map((d) => `${d.node} ${d.round}`)).toEqual(["builder 0", "tests 0", "judge 0", "builder 0", "tests 0", "judge 1", "chief 0", "builder 0", "tests 0", "judge 0"]);
    // Two loops with the very same members are not one inside the other: the second's way back does not send the
    // first back to round 0.
    const twins: Graph = { ...RUN, loops: [{ ...RUN.loops[0]!, id: "a", name: "A", back: ["e-checks-fail"] }, { ...RUN.loops[0]!, id: "b", name: "B", back: ["e-critic-fail"] }] };
    const both = modelAt(twins, places(twins), notes([["builder", "pass"], ["checks", "fail"], ["builder", "pass"], ["checks", "pass"], ["critic", "fail"], ["builder", "pass"]]));
    expect(both.run!.dispatches.map((d) => d.round)).toEqual([0, 0, 1, 1, 1, 1]);
    expect(both.run!.most).toMatchObject({ a: 1, b: 1 });
  });

  it("two notes of one visit to a node are not a move, though the node has an edge to itself", () => {
    const solo: Graph = { ...RUN, edges: [{ id: "e-again", from: "builder", to: "builder" }], loops: [{ ...RUN.loops[0]!, id: "solo", name: "Solo", members: ["builder"], back: ["e-again"] }] } as Graph;
    const visit = [{ id: "n-0001", run: "r", at: "node:builder", started: "2026-09-19T13:00:00Z", outcome: "started" }, { id: "n-0002", run: "r", at: "node:builder", ended: "2026-09-19T13:05:00Z", outcome: "pass" }] as RunNote[];
    const m = modelAt(solo, places(solo), visit);
    expect(m.run!.dispatches.map((d) => d.round)).toEqual([0]);
    expect(stepsOf(m).map((s) => s.edge)).toEqual([undefined, undefined, undefined]);
    // Two ended notes there are two visits: the way back was taken once.
    const twice = modelAt(solo, places(solo), notes([["builder", "pass"], ["builder", "pass"]]));
    expect(twice.run!.dispatches.map((d) => d.round)).toEqual([0, 1]);
    expect(stepsOf(twice).map((s) => s.edge)).toEqual([undefined, undefined, "e-again"]);
  });

  it("a way back that crosses from one loop's spiral to another's arrives in the round it does, not at round 0", () => {
    // Big has builder, checks and critic, and its way back is critic to builder; Small has critic and Done, and
    // critic is Small's. The way back leaves Small's spiral and lands on Big's, a turn on.
    const big = { ...RUN.loops[0]!, id: "big", name: "Big", members: ["builder", "checks", "critic"], back: ["e-critic-fail"] };
    const small = { ...RUN.loops[0]!, id: "small", name: "Small", members: ["critic", "done"], back: [] };
    const cross: Graph = { ...RUN, loops: [big, small] };
    const m = modelAt(cross, places(cross), notes([["builder", "pass", 0], ["checks", "pass", 0], ["critic", "fail", 0], ["builder", "pass", 1]]));
    expect(m.loops.map((l) => [l.id, l.own])).toEqual([["big", ["builder", "checks"]], ["small", ["critic", "done"]]]);
    const drawn = edges(spiral(m, at(m, 0)).prims);
    expect(drawn["e-critic-fail@0>1"]).toEqual([1, 0, 1]);
    // On a template the same way back is drawn a turn on, as every way back onto its own loop is.
    expect(edges(spiral(modelAt(cross, places(cross)), whole).prims)["e-critic-fail@0>1"]).toEqual([1, 0, 1]);
    // The other direction: Right's way back, critic to checks, lands on Left's spiral, where checks stands. It
    // arrives in the round Left is in, which Right's way back does not move; on a template that is round 0.
    const [left, right] = [{ ...RUN.loops[0]!, id: "left", name: "Left", members: ["builder", "checks"], back: ["e-checks-fail"] }, { ...RUN.loops[0]!, id: "right", name: "Right", members: ["checks", "critic"], back: ["e-critic-again"] }];
    const lr: Graph = { ...RUN, edges: [...RUN.edges.filter((e) => e.id !== "e-critic-fail"), { id: "e-critic-again", from: "critic", to: "checks", when: "fail" }], loops: [left, right] } as Graph;
    const run = modelAt(lr, places(lr), notes([["builder", "pass", 0], ["checks", "fail", 0], ["builder", "pass", 1], ["checks", "pass", 1], ["critic", "fail", 0], ["checks", "pass", 1]]));
    expect(edges(spiral(run, at(run, 0)).prims)["e-critic-again@0>1"]).toEqual([1, 0.5, 1.5]);
    expect(edges(spiral(modelAt(lr, places(lr)), whole).prims)["e-critic-again@0>1"]).toEqual([1, 0.5, 0.5]);
  });

  it("on a frame a phone's width the spirals stand one under the other and every card is its name alone; a graph with no loop is a column", () => {
    const narrow = modelAt(GAUNTLET, places(GAUNTLET), undefined, true);
    const built = spiral(narrow, whole);
    // The two spirals' middles are in one upright line, the inner loop's above the outer's by more than its own height.
    // Each spiral has an upright line up its middle: the foot of each, the higher first. The loop inside is placed first.
    const feet = (prims: typeof built.prims) => prims.flatMap((p) => (p.t === "line" && p.stroke === "line-strong" && p.pts.length === 2 ? [p.pts[0]!] : []));
    /** Each spiral's top (where its middle line ends) and its turn's radius (the floor under it is 12 wider). */
    const feetOf = (prims: typeof built.prims): { y: number; r: number }[] => {
      const floors = prims.flatMap((p) => (p.t === "poly" && p.fill === "floor" ? [p.pts] : []));
      return prims.flatMap((p) => (p.t === "line" && p.stroke === "line-strong" && p.pts.length === 2 ? [p.pts] : [])).map(([foot, top], n) => ({ y: top![1], r: Math.max(...floors[n]!.map((v) => Math.hypot(v[0] - foot![0], v[2] - foot![2]))) - 12 }));
    };
    const [polish, pieces] = feet(built.prims).sort((a, b) => b[1] - a[1]);
    expect(turnsOf(built.node("owner")[1] - polish![1])).toBe(0);
    expect(turnsOf(built.node("next-piece")[1] - pieces![1])).toBe(0.5);
    expect([polish![0], polish![2]]).toEqual([pieces![0], pieces![2]]);
    expect(polish![1] - pieces![1]).toBeGreaterThan(3 * 54 + 100);
    // What is in no loop is in the same line, above the spirals before them and under them after.
    const ys = narrow.rows.flat().map((id) => built.node(id)[1]);
    expect(ys[0]!).toBeGreaterThan(polish![1] + 3 * 54);
    expect(ys[ys.length - 1]!).toBeLessThan(pieces![1]);
    expect(built.prims.every((p) => p.t !== "card" || p.small)).toBe(true);
    // Side by side where there is room, as before, and a card on a spiral whole.
    const wide = spiral(modelAt(GAUNTLET, places(GAUNTLET)), whole);
    expect(feet(wide.prims).map((foot) => foot[1])).toEqual([0, 0]);
    expect(new Set(feet(wide.prims).map((foot) => foot[0])).size).toBe(2);
    expect(wide.prims.some((p) => p.t === "card" && !p.small)).toBe(true);
    // Stacked, over is along the line, so an edge goes out to the side. Round the top of each spiral it passes, lid
    // and turns: where it is level with that top it is more than the lid's radius (the turn's and 18) from the
    // middle, on every template; and on the side of its own end there, so that it does not cross the turns.
    let [passed, right, exits] = [0, 0, 0];
    for (const path of ALL) {
      const doc = graph(path);
      const g = modelAt(doc, places(doc), undefined, true);
      const drawn = spiral(g, whole);
      const tops = feetOf(drawn.prims);
      for (const e of g.edges) {
        const pts = drawn.path(e.id, 0, e.back ? 1 : 0);
        if (pts.length !== 19) continue;
        for (const top of tops) {
          const k = pts.findIndex((v, n) => n > 0 && (pts[n - 1]![1] - top.y) * (v[1] - top.y) < 0);
          if (k < 0) continue;
          const x = pts[k - 1]![0] + ((pts[k]![0] - pts[k - 1]![0]) * (top.y - pts[k - 1]![1])) / (pts[k]![1] - pts[k - 1]![1]);
          expect(Math.abs(x), `${path} ${e.id}`).toBeGreaterThan(top.r + 18 + 8);
          // Between two places on the right of their spirals it stays on the right.
          if (drawn.node(e.from)[0] > 0 && drawn.node(e.to)[0] > 0) expect(x, `${path} ${e.id}`).toBeGreaterThan(0), (right += 1);
          passed += 1;
        }
      }
    }
    expect([passed > 6, right > 0]).toEqual([true, true]);
    // An exit taken in a later round comes down outside the turns under it, on its own side: the recorded sandwich
    // run left its loop from round 1, and where that edge is level with the spiral's foot it is outside the turn,
    // on the side its critic stands on.
    for (const [name, edge] of [["slice-0007-sandwich", "e-critic-pass"]] as const) {
      const [doc, written] = runAt(name);
      const g = modelAt(doc, places(doc), written, true);
      const drawn = spiral(g, at(g, 0));
      const taken = drawn.prims.flatMap((p) => (p.t === "line" && p.key?.startsWith(`edge:${edge}@`) && (p.alpha ?? 1) === 1 ? [p.pts] : []));
      expect(taken.length, name).toBeGreaterThan(0);
      const [foot] = feet(drawn.prims).sort((a, b) => a[1] - b[1]);
      const { r } = feetOf(drawn.prims).sort((a, b) => a.y - b.y)[0]!;
      for (const pts of taken) {
        if (pts[0]![1] - foot![1] < 54) continue;
        const k = pts.findIndex((v, n) => n > 0 && (pts[n - 1]![1] - foot![1]) * (v[1] - foot![1]) <= 0);
        const x = pts[k - 1]![0] + ((pts[k]![0] - pts[k - 1]![0]) * (foot![1] - pts[k - 1]![1])) / (pts[k]![1] - pts[k - 1]![1] || 1);
        expect([Math.abs(x) > r + 18, Math.sign(x) === Math.sign(pts[0]![0])], `${name} ${edge}`).toEqual([true, true]);
        // And all the way down to there: never inside the turns, seen from above.
        for (const v of pts.slice(0, k)) expect(Math.hypot(v[0] - foot![0], v[2] - foot![2]), `${name} ${edge}`).toBeGreaterThan(r - 1);
        exits += 1;
      }
    }
    expect(exits).toBeGreaterThan(0);
    // With a node on the ground between its ends it goes to the left, whatever side its end is on: the cards on the
    // ground are to the right. Spec, then a loop: an edge from the planner past the gate to the critic, on the right.
    const spec = graph("patterns/spec-then-loop.grooph.json");
    const withGate = modelAt(spec, places(spec), undefined, true);
    const [first, gate] = withGate.rows.flat();
    const onRight = withGate.nodes.find((n) => n.loop && spiral(withGate, whole).node(n.id)[0] > 0)!;
    const added: Graph = { ...spec, edges: [...spec.edges, { id: "e-added", from: first!, to: onRight.id }] } as Graph;
    const bowed = spiral(modelAt(added, places(added), undefined, true), whole);
    expect(withGate.nodes.find((n) => n.id === gate)!.loop).toBeNull();
    expect(Math.max(...bowed.path("e-added").slice(0, 10).map((v) => v[0]))).toBeLessThanOrEqual(bowed.node(first!)[0]);
    // Two edges between the same two nodes are not one line: the second is drawn past the first, stacked and wide.
    const fresh = graph("patterns/fresh-grind-rare-judge.grooph.json");
    for (const narrowly of [true, false]) {
      const twins = spiral(modelAt(fresh, places(fresh), undefined, narrowly), whole);
      const [one, two] = [twins.path("e-judge-fail", 0, 1), twins.path("e-judge-next-phase", 0, 1)];
      expect(Math.hypot(one[9]![0] - two[9]![0], one[9]![1] - two[9]![1]), String(narrowly)).toBeGreaterThan(10);
    }
    // Round the nodes on the ground between its ends, to the left, where no card stands: three candidates each go
    // to the filter, and the first's edge is 30 or more to the left of the second and the third where it passes them.
    const tournament = graph("patterns/tournament-then-judge.grooph.json");
    const stacked = spiral(modelAt(tournament, places(tournament), undefined, true), whole);
    const across = (id: string, y: number): number => {
      const pts = stacked.path(id);
      const k = pts.findIndex((v, n) => n > 0 && (pts[n - 1]![1] - y) * (v[1] - y) <= 0);
      return pts[k - 1]![0] + ((pts[k]![0] - pts[k - 1]![0]) * (y - pts[k - 1]![1])) / (pts[k]![1] - pts[k - 1]![1] || 1);
    };
    for (const between of ["candidate-b", "candidate-c"]) expect(across("e-candidate-a-filter", stacked.node(between)[1]) - stacked.node(between)[0], between).toBeLessThan(-30);
    expect(across("e-candidate-b-filter", stacked.node("candidate-c")[1]) - stacked.node("candidate-c")[0]).toBeLessThan(-30);
    expect(stacked.path("e-candidate-c-filter").every((v) => v[0] === stacked.node("filter")[0])).toBe(true);
    // And a graph with no loop keeps its cards whole there: a column has room for them.
    expect(stacked.prims.some((p) => p.t === "card" && p.small)).toBe(false);
    // Two takings that leave one round of one place for two rounds of another: on the recorded fresh-grind run the
    // tests pass to the judge from round 0 of Grind in both phases, into rounds 0 and 1 of Phases. They are apart
    // for most of their way, not only where the shorter one stops.
    const dir = "experiments/patterns/fresh-grind-rare-judge/run/runs/20260921-044114";
    const freshRun = graph(join(dir, "graph.grooph.json"));
    const fr = modelAt(freshRun, places(freshRun), parseRunNotes(readFileSync(join(root, dir, "notes.jsonl"), "utf8")).notes, true);
    const both = spiral(fr, at(fr, 0)).prims.flatMap((p) => (p.t === "line" && p.key?.startsWith("edge:e-tests-judge@") ? [[p.key, p.pts] as const] : []));
    expect(both.map(([key]) => key)).toEqual(["edge:e-tests-judge@0>0", "edge:e-tests-judge@0>1"]);
    expect(Math.abs(both[0]![1][9]![0] - both[1]![1][9]![0])).toBeGreaterThanOrEqual(10);
    // Two takings of one edge between the two spirals of the nested run, one over the other, are apart.
    const [nestedDoc, nestedNotes] = runAt("run-nested");
    const ran = modelAt(nestedDoc, places(nestedDoc), nestedNotes, true);
    const takings = spiral(ran, at(ran, 0)).prims.flatMap((p) => (p.t === "line" && p.key?.startsWith("edge:e-tests-judge@") ? [p.pts] : []));
    expect(takings).toHaveLength(2);
    expect(Math.abs(takings[0]![9]![0] - takings[1]![9]![0])).toBeGreaterThan(5);
    // No loop, narrow: a column, each node 52 under the one before it.
    const line = graph("patterns/tournament-then-judge.grooph.json");
    const column = spiral(modelAt(line, places(line), undefined, true), whole);
    const down = modelAt(line, places(line)).rows.flat().map((id) => column.node(id));
    for (let n = 1; n < down.length; n += 1) expect([down[n]![0], down[n - 1]![1] - down[n]![1], down[n]![2]]).toEqual([down[0]![0], 52, down[0]![2]]);
  });

  it("a node that fans out reaches each of its targets and one that fans in is reached by each of its sources: every such edge was taken", () => {
    // The critic bank: the builder's pass goes to four critics at once, and each critic's pass to the judge.
    const bank = graph("patterns/specialist-critic-bank.grooph.json");
    const b = modelAt(bank, places(bank));
    const critics = b.edges.filter((e) => e.from === "builder").map((e) => e.to);
    expect(critics).toHaveLength(4);
    const judge = b.edges.find((e) => e.from === critics[0])!.to;
    const m = modelAt(bank, places(bank), notes([["builder", "pass", 0], ...critics.map((id): [string, string, number] => [id, "pass", 0]), [judge, "pass", 0]]));
    const steps = stepsOf(m);
    // Each critic's note is a move from the builder, whichever critic's note came before it.
    for (const [n, id] of critics.entries()) expect(steps[2 + n], id).toMatchObject({ to: id, from: "builder", edge: b.edges.find((e) => e.from === "builder" && e.to === id)!.id });
    // The judge's note: the edge from the critic whose note came last is the one followed, and the other three were taken with it.
    const last = steps[6]!;
    expect(last).toMatchObject({ to: judge, from: critics[3] });
    expect([last.edge, ...last.also!.map((x) => x.edge)].sort()).toEqual(b.edges.filter((e) => e.to === judge && critics.includes(e.from)).map((e) => e.id).sort());
    // So in the whole run none of the eight is drawn as never taken, and at the judge's step all four into it are lit.
    const whole8 = b.edges.filter((e) => e.from === "builder" || (e.to === judge && critics.includes(e.from))).map((e) => `${e.id}@0>0`);
    const drawn = spiral(m, at(m, 0)).prims.flatMap((p) => (p.t === "line" && p.key?.startsWith("edge:") ? [[p.key.slice(5), p.alpha ?? 1] as const] : []));
    for (const key of whole8) expect(drawn.find(([k]) => k === key), key).toEqual([key, 1]);
    for (const e of b.edges.filter((x) => x.to === judge && critics.includes(x.from))) expect(at(m, 6).lit!.has(`edge:${e.id}`), e.id).toBe(true);
    // The critics' edges to the judge have no condition, so a critic that failed took its edge too.
    const mixed = modelAt(bank, places(bank), notes([["builder", "pass", 0], [critics[0]!, "fail", 0], [critics[1]!, "pass", 0], [judge, "pass", 0]]));
    const into = stepsOf(mixed)[4]!;
    expect([into.edge, ...(into.also ?? []).map((x) => x.edge)].sort()).toEqual([critics[0], critics[1]].map((id) => b.edges.find((e) => e.from === id && e.to === judge)!.id).sort());
    // An edge with a condition is taken only by a report that meets it. The judge passed and the gate rejected:
    // back at the builder, the gate's way back was taken and the judge's, which is for a fail, was not, though the
    // judge has reported since the builder was last reached.
    const back = modelAt(bank, places(bank), notes([["builder", "pass", 0], ...critics.map((id): [string, string, number] => [id, "pass", 0]), [judge, "pass", 0], ["gate", "fail", 0], ["builder", "pass", 1]]));
    const again = stepsOf(back)[8]!;
    expect([again.to, again.edge, again.also]).toEqual(["builder", "e-gate-reject", undefined]);
    // And a node that has not reported since takes nothing: a second note at the judge, with no critic between.
    const twice = modelAt(bank, places(bank), notes([["builder", "pass", 0], [critics[0]!, "pass", 0], [judge, "pass", 0], [judge, "pass", 0]]));
    expect(stepsOf(twice)[4]!.edge).toBeUndefined();
  });

  it("a way back that is another loop's, between two nodes of one spiral, does not turn that spiral", () => {
    // Twins: the sandwich's loop listed twice, with one way back each. The critic's way back is B's; on A's spiral,
    // where builder and critic stand, it arrives in the round A is in, not a turn on.
    const twins: Graph = { ...RUN, loops: [{ ...RUN.loops[0]!, id: "a", name: "A", back: ["e-checks-fail"] }, { ...RUN.loops[0]!, id: "b", name: "B", back: ["e-critic-fail"] }] };
    const run = modelAt(twins, places(twins), notes([["builder", "pass"], ["checks", "fail"], ["builder", "pass"], ["checks", "pass"], ["critic", "fail"], ["builder", "pass"]]));
    expect(edges(spiral(run, at(run, 0)).prims)["e-critic-fail@1>1"]).toEqual([1, 1.67, 1]);
    expect(edges(spiral(modelAt(twins, places(twins)), whole).prims)["e-critic-fail@0>1"]).toEqual([1, 0.67, 0]);
    // A's own way back, from the middle of its round, still arrives a turn on.
    expect(edges(spiral(run, at(run, 0)).prims)["e-checks-fail@0>1"]).toEqual([1, 0.33, 1]);
    // An outer loop's way back between two nodes of the loop inside it: the inner loop starts afresh, so the edge
    // arrives at round 0 of the inner spiral, on a run and on a template.
    const outer: Graph = { ...NEST, edges: [...NEST.edges, { id: "e-tests-next", from: "tests", to: "builder", when: { verdict: "next" } }], loops: NEST.loops.map((l) => (l.id === "phases" ? { ...l, back: [...l.back, "e-tests-next"] } : l)) } as Graph;
    const again = modelAt(outer, places(outer), notes([["builder", "pass"], ["tests", "fail"], ["builder", "pass"], ["tests", "fail", undefined, "next"], ["builder", "pass"]]));
    expect(again.run!.dispatches.map((d) => d.round)).toEqual([0, 0, 1, 1, 0]);
    expect(edges(spiral(again, at(again, 0)).prims)["e-tests-next@1>0"]).toEqual([1, 1.5, 0]);
    expect(edges(spiral(modelAt(outer, places(outer)), whole).prims)["e-tests-next@0>1"]).toEqual([1, 0.5, 0]);
    // And the judge's way back into the inner loop, on a template: at round 0, not a turn up.
    expect(edges(spiral(modelAt(NEST, places(NEST)), whole).prims)["e-judge-next-phase@0>1"]).toEqual([1, 0.5, 0]);
  });

  it("an edge from the ground into a spiral goes over the ground nodes it passes, and a bead stays where it is as the slider goes on", () => {
    // Plan, scout and docs stand in a line before the first spiral, and plan and scout each have an edge into it.
    const doc = graph("fixtures/valid/glyph-vocabulary.grooph.json");
    const m = modelAt(doc, places(doc));
    const built = spiral(m, whole);
    const before = ["plan", "scout", "docs"];
    expect(before.map((id) => m.nodes.find((n) => n.id === id)!.loop)).toEqual([null, null, null]);
    const lift = (from: string) => {
      const e = m.edges.find((x) => x.from === from && m.nodes.find((n) => n.id === x.to)!.loop)!;
      const pts = built.path(e.id);
      const straight = (n: number) => pts[0]![1] + ((pts[pts.length - 1]![1] - pts[0]![1]) * n) / (pts.length - 1);
      return Math.round(Math.max(...pts.map((p, n) => p[1] - straight(n))));
    };
    expect([lift("plan"), lift("scout")]).toEqual([52, 26]);
    // The nested run: the beads at note 3 are where the same two are in the whole run.
    const [nested, written] = runAt("run-nested");
    const r = modelAt(nested, places(nested), written);
    const beads = (k: number) => spiral(r, at(r, k)).prims.flatMap((p) => (p.t === "dot" && p.r === 6 ? [p.at.map((v) => Math.round(v)).join(",")] : []));
    expect(beads(0).slice(0, 2)).toEqual(beads(3));
    expect(beads(0)).toHaveLength(7);
  });

  it("beads at one place stop short of the middle however many there are, and the solid part stops at the top", () => {
    const phase = (): [string, string, number?, string?][] => [["builder", "pass", 0], ["tests", "pass", 0], ["judge", "fail", undefined, "next-phase"]];
    const open = withStops(withStops(NEST, "phases", []), "grind", [{ kind: "max-iterations", n: 2 }]);
    const m = modelAt(open, places(open), notes(Array.from({ length: 8 }, phase).flat()));
    const built = spiral(m, at(m, 0));
    const axis = (built.node("builder")[0] + built.node("tests")[0]) / 2;
    const beads = built.prims.flatMap((p) => (p.t === "dot" && p.r === 6 && turns(p.at[1]) === 0 ? [p.at[0]] : []));
    expect(beads).toHaveLength(8);
    expect(new Set(beads.map((x) => Math.round(x))).size).toBe(8);
    for (const x of beads) expect(x).toBeLessThan(axis);
    // A run whose notes go past the cap (a lead that did not stop): the solid part ends at the lid, not over it.
    const past = modelAt(open, places(open), notes([["builder", "pass", 0], ["tests", "fail", 0], ["builder", "pass", 1], ["tests", "fail", 1], ["builder", "pass", 2], ["tests", "fail", 2]]));
    const solid = spiral(past, at(past, 0)).prims.find((p) => p.key === "loop:grind")!;
    expect(solid.t === "line" && turns(solid.pts[solid.pts.length - 1]![1])).toBe(2);
  });

  it("a node in a loop inside another: each loop's round is worked out from the loop's own notes and the ways back the run took, whichever loop's number the lead wrote on the node's note", () => {
    const where = (m: ReturnType<typeof modelAt>) => m.run!.dispatches.map((d) => `${d.node}@${d.loop}:${d.round}`);
    // The nested fixture's lead wrote the inner loop's round on the builder's and the tests' notes.
    const [nested, written] = runAt("run-nested");
    const inner = ["builder@grind:0", "tests@grind:0", "builder@grind:1", "tests@grind:1", "judge@phases:0", "builder@grind:0", "tests@grind:0"];
    expect(where(modelAt(nested, places(nested), written))).toEqual(inner);
    // The same run with the outer loop's round written there, as the recorded Gauntlet and fresh-grind runs have
    // it, and with none written: the same rounds.
    const phase = [0, 0, 0, 0, 0, 1, 1];
    let k = 0;
    const outer = written.map((n) => (n.at === "node:builder" || n.at === "node:tests" ? ({ ...n, round: phase[k++] } as RunNote) : n));
    expect(k).toBe(6);
    expect(where(modelAt(nested, places(nested), outer))).toEqual(inner);
    expect(where(modelAt(nested, places(nested), written.map(({ round: _round, ...n }) => (n.at.startsWith("node:") ? (n as RunNote) : ({ ...n, round: _round } as RunNote)))))).toEqual(inner);
    // The recorded Gauntlet run: piece 2 is round 1 of Pieces and round 0 of Polish a piece, as its own loop notes
    // say, though the owner's note there carries a 1; and the page's first sentence says so.
    const dir = "experiments/patterns/gauntlet-decomposed/run/runs/20261004-224501";
    const gauntlet = graph(join(dir, "graph.grooph.json"));
    const ran = modelAt(gauntlet, places(gauntlet), parseRunNotes(readFileSync(join(root, dir, "notes.jsonl"), "utf8")).notes);
    expect(where(ran)).toEqual(["planner@null:null", "owner@polish:0", "capture-check@polish:0", "critic@polish:0", "next-piece@pieces:0", "owner@polish:0", "capture-check@polish:0", "critic@polish:0", "next-piece@pieces:1"]);
    expect(stepsOf(ran)[0]!.says).toMatch(/^The whole run: 9 dispatches, in round 0 of Polish a piece; rounds 0 and 1 of Pieces\./);
    // A node in one loop keeps the round its note names.
    const [sandwich] = [modelAt(RUN, places(RUN), NOTES)];
    expect(where(sandwich)).toEqual(["builder@sandwich:0", "checks@sandwich:0", "critic@sandwich:0", "builder@sandwich:1", "checks@sandwich:1", "critic@sandwich:1"]);
  });

  it("a loop with no cap is as tall as two rounds over the highest it was in, though it has since started afresh", () => {
    const open = withStops(NEST, "grind", []);
    const m = modelAt(open, places(open), notes([["builder", "pass", 0], ["tests", "fail", 0], ["loop:grind", "fail", 3], ["builder", "pass", 4], ["tests", "pass", 4], ["judge", "fail", 0, "next-phase"], ["builder", "pass", 0]]));
    // (The loop's own note says it was in round 3; its way back makes that 4. A number on a note at the builder
    // would not: the builder is in two loops.)
    expect(m.run!.most).toMatchObject({ grind: 4 });
    expect(topOf(m, m.loops.find((l) => l.id === "grind")!)).toBe(7);
    const { prims } = spiral(m, at(m, 0));
    const solid = prims.find((p) => p.key === "loop:grind")!;
    expect(solid.t === "line" && turns(solid.pts[solid.pts.length - 1]![1])).toBe(4.5);
    for (const p of prims) if (p.t === "dot" && p.r === 6) expect(turns(p.at[1])).toBeLessThanOrEqual(7);
  });

  it("a node two loops share, neither inside the other, stands on one spiral and is said on the other; a note there moves only its own loop", () => {
    // The sandwich cut in two: builder and checks, checks and critic. Checks is the first loop's.
    const [left, right] = [{ ...RUN.loops[0]!, id: "left", name: "Left", members: ["builder", "checks"], back: ["e-checks-fail"] }, { ...RUN.loops[0]!, id: "right", name: "Right", members: ["checks", "critic"], back: ["e-critic-fail"] }];
    const cut: Graph = { ...RUN, loops: [left, right] };
    const m = modelAt(cut, places(cut), notes([["builder", "pass", 0], ["checks", "fail", 0], ["builder", "pass", 1], ["checks", "pass", 1], ["critic", "pass", 0]]));
    expect(m.loops.map((l) => [l.id, l.own])).toEqual([["left", ["builder", "checks"]], ["right", ["critic"]]]);
    const built = spiral(m, at(m, 0));
    expect(built.prims.filter((p) => p.t === "card").map((p) => (p.t === "card" ? p.id : "")).sort()).toEqual(["builder", "checks", "critic", "done"]);
    expect(built.prims.some((p) => p.t === "text" && p.text === "Cheap checks: on Left")).toBe(true);
    // Five dispatches, five beads: the two at checks are on Left only.
    expect(built.prims.filter((p) => p.t === "dot" && p.r === 6)).toHaveLength(5);
    // Right's way back was never taken: it is in round 0 at every step, whatever round Left's checks were in.
    const steps = stepsOf(m);
    expect(reach(m, steps, 4)).toEqual({ left: { now: 1.5, most: 1.5 }, right: { now: 0, most: 0 } });
    expect(reach(m, steps, 5)).toEqual({ left: { now: 1.5, most: 1.5 }, right: { now: 0.5, most: 0.5 } });
    // Two loops with the very same members: every node is the first one's, and is drawn once.
    const same: Graph = { ...RUN, loops: [RUN.loops[0]!, { ...RUN.loops[0]!, id: "twin", name: "Twin" }] };
    const twin = spiral(modelAt(same, places(same)), whole);
    expect(twin.prims.filter((p) => p.t === "card")).toHaveLength(4);
  });
});

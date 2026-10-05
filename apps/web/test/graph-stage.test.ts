import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { parseGraphText, parseRunNotes, resolvePositions, type Graph, type RunNote } from "@grooph/core";
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
    const twice: Graph = { ...NESTED, groups: [{ id: "outer", name: "Outer", members: ["inner", "review-builder", "release"] }, { id: "inner", name: "Inner", members: ["review-builder"] }], loops: [] };
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

  it("a loop with the very nodes of a subgrooph is inside it, and the subgrooph inside the group that holds it", () => {
    const boxes = Object.fromEntries(boxesOf(modelOf(NESTED).loops, modelOf(NESTED).groups).map((b) => [b.name + " · " + b.sub, b.depth]));
    expect(boxes).toEqual({ "Review · loop": 3, "Review gate · subgrooph, from review-gate@1": 2, "Review and release · group": 1 });
    const nested = place(NESTED);
    expect(["plan", "release", "review-builder", "review-critic", "review-merge-gate", "done"].map(nested.z)).toEqual([0, 84, 252, 252, 252, 0]);
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
      for (const n of doc.nodes) expect([node(n.id)[0], node(n.id)[1]], `${path} ${n.id}`).toEqual([canvas[n.id]!.x * 0.62 + 62, -canvas[n.id]!.y * 0.4]);
      // A way back is dashed and in its loop's color; an edge that goes on is not.
      for (const e of model.edges) {
        const line = prims.find((p) => p.key === `edge:${e.id}`)!;
        expect(line.t === "line" && !!line.dash, `${path} ${e.id}`).toBe(!!e.back);
      }
    }
  });
});

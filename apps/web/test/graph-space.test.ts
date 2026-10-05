import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { mapKit, parseGraphText, type Graph } from "@grooph/core";
import { describe, expect, it } from "vitest";

import { firstPass, graphScene } from "../src/ui/canvas/graph-views.js";
import { CARD, START, fit, lights, scene } from "../src/ui/map/space.js";

/** A loop graph in three dimensions (handoff 0092): what its sheets are, the order of its slider, and that it draws. */
const root = join(import.meta.dirname, "../../..");
const pattern = (id: string): Graph => parseGraphText(readFileSync(join(root, `patterns/${id}.grooph.json`), "utf8")).doc!;
const ALL = readdirSync(join(root, "patterns")).filter((f) => f.endsWith(".grooph.json")).map((f) => f.replace(".grooph.json", ""));
const REVIEW = pattern("review-gate");
const GAUNTLET = pattern("gauntlet-decomposed");
const count = (html: string, part: string): number => html.split(part).length - 1;
const onSheet = (doc: Graph, mark: string): string[] => graphScene(doc, 3, CARD).sheets.find((s) => s.mark === mark)?.items.map((c) => c.id) ?? [];

describe("a graph's sheets", () => {
  it("a loop is a sheet with its members on it, and what is in no loop stands on the first sheet", () => {
    const made = graphScene(REVIEW, 3, CARD);
    expect(made.sheets.map((s) => s.mark)).toEqual(['data-outside=""', 'data-loop="review"']);
    expect(onSheet(REVIEW, 'data-loop="review"')).toEqual(["builder", "critic", "merge-gate"]);
    expect(onSheet(REVIEW, 'data-outside=""')).toEqual(["done"]);
    expect(made.sheets[1]).toMatchObject({ name: "Review", place: "loop" });
    expect(made.sheets[1]!.sub).toMatch(/^stops: /);
  });

  it("a node in a loop inside a loop stands on the inner one, and the inner sheet says what it is inside", () => {
    expect(onSheet(GAUNTLET, 'data-loop="polish"')).toEqual(["owner", "capture-check", "critic"]);
    expect(onSheet(GAUNTLET, 'data-loop="pieces"')).toEqual(["next-piece"]);
    expect(graphScene(GAUNTLET, 3, CARD).sheets.find((s) => s.mark === 'data-loop="polish"')!.sub).toMatch(/^inside Pieces · stops: /);
  });

  it("a subgrooph is a sheet, and a graph with no loop is one sheet under its own name", () => {
    const flat: Graph = { ...REVIEW, loops: [], edges: REVIEW.edges.filter((e) => !REVIEW.loops[0]!.back.includes(e.id)) };
    expect(graphScene(flat, 3, CARD).sheets).toHaveLength(1);
    expect(graphScene(flat, 3, CARD).sheets[0]).toMatchObject({ name: "Review gate", sub: "no loop" });
    const unit: Graph = { ...flat, groups: [{ id: "u", name: "A placed unit", members: ["builder", "critic"], from: "review-gate@1" }] };
    expect(onSheet(unit, 'data-unit="u"')).toEqual(["builder", "critic"]);
    expect(graphScene(unit, 3, CARD).sheets.find((s) => s.mark === 'data-unit="u"')).toMatchObject({ place: "subgrooph", sub: "from review-gate@1" });
    // A group that is only a frame, placed from nothing, is not a sheet.
    expect(graphScene({ ...flat, groups: [{ id: "g", name: "A frame", members: ["builder"] }] }, 3, CARD).sheets).toHaveLength(1);
  });

  it("every node of every built-in template stands on exactly one sheet, and the cards keep the picture's marks", () => {
    for (const id of ALL) {
      const doc = pattern(id);
      const made = graphScene(doc, 3, CARD);
      expect(made.sheets.flatMap((s) => s.items.map((c) => c.id)).sort(), id).toEqual(doc.nodes.map((n) => n.id).sort());
      expect(made.sheets.every((s) => s.items.length > 0), id).toBe(true);
    }
    const html = scene(mapKit, graphScene(REVIEW, 3, CARD)).html;
    expect(html).toMatch(/<g data-node="merge-gate" data-kind="human-gate">.*?Human gate/);
    expect(html).toMatch(/<g data-node="done" data-kind="stop">.*?Stop/);
    expect(html).toMatch(/<g data-node="builder" data-kind="agent">.*?builder.*?strong/);
  });
});

describe("the slider of a graph", () => {
  it("steps through a first pass in the order of the graph's layers, then one turn of each loop", () => {
    expect(firstPass(REVIEW).map((s) => s.edge.id)).toEqual(["e-builder-critic", "e-critic-pass", "e-merge-gate-done", "e-critic-fail", "e-merge-gate-reject"]);
    expect(firstPass(REVIEW).map((s) => s.loop?.id)).toEqual([undefined, undefined, undefined, "review", "review"]);
    for (const id of ALL) {
      const doc = pattern(id);
      // Every edge once: the forward ones first, each after the edges that lead to it; then the back edges.
      expect(firstPass(doc).map((s) => s.edge.id).sort(), id).toEqual(doc.edges.map((e) => e.id).sort());
      const turns = firstPass(doc).map((s) => !!s.loop);
      expect(turns.indexOf(true) === -1 || turns.slice(turns.indexOf(true)).every(Boolean), id).toBe(true);
    }
  });

  it("says each step in words, a turn of a loop as going back into it, and that it is an order and not a clock", () => {
    const made = graphScene(REVIEW, 3, CARD);
    expect(made.stops).toHaveLength(6);
    expect(made.stops[0]!.says).toBe("All 5 steps are lit. Move the slider or press Play to follow a first pass, one edge at a time.");
    expect(made.stops[1]).toMatchObject({ handoff: "e-builder-critic", short: "step 1 of 5", says: "Step 1 of 5: Builder to Critic" });
    expect(made.stops[2]!.says).toBe("Step 2 of 5: Critic to Merge approval · when pass");
    expect(made.stops[4]!.says).toMatch(/^Step 4 of 5: Critic to Builder · when fail · back into Review: another round, until /);
    expect(made.note).toBe("The edges a first pass takes, in order, and then one turn of each loop. An order, not a clock: a graph records no times.");
    // A back edge is dashed, in its loop's color; an edge of the first pass is a plain line.
    expect(made.links[0]!.style).toEqual({ color: "ink-2", width: 1.6 });
    expect(made.links[3]!.style).toMatchObject({ color: "loop-0", dash: "6 4" });
    expect(made.links.map((l) => l.n)).toEqual([1, 2, 3, 4, 5]);
    // A graph with nothing to step through says so.
    expect(graphScene({ ...REVIEW, edges: [], loops: [] }, 3, CARD).stops).toEqual([{ short: "all steps", says: "This graph has no edges to step through." }]);
  });
});

describe("the scene of a graph", () => {
  it("draws every node and every edge of every built-in template once, with numbers that are numbers, and fits a phone", () => {
    for (const id of ALL) {
      const doc = pattern(id);
      for (const per of [3, 6]) {
        const made = scene(mapKit, graphScene(doc, per, CARD));
        for (const n of doc.nodes) expect(count(made.html, `data-node="${n.id}"`), `${id} ${n.id}`).toBe(1);
        for (const e of doc.edges) expect(count(made.html, `data-edge="${e.id}"`), `${id} ${e.id}`).toBe(1);
        expect(made.html, id).not.toMatch(/NaN|Infinity|undefined/);
        expect([...made.box.min, ...made.box.max].every(Number.isFinite), id).toBe(true);
        expect(fit(made.box, 366, 500, 900, START.yaw, START.pitch), id).toBeGreaterThan(0.2);
      }
    }
  });

  it("lights a step with its two ends, as a map's handoff is lit, and names the steps for the slider", () => {
    const made = scene(mapKit, graphScene(REVIEW, 3, CARD));
    expect(made.html).toContain('aria-label="Step, in the order a first pass takes them"');
    expect(made.html).toContain('aria-label="Next edge"');
    expect(made.html).toContain("Review gate in three dimensions: 2 sheets, 4 cards, 5 edges.");
    expect(made.html).toContain('The picture shows the same graph, flat. <button type="button" data-flat="picture">Picture</button>');
    expect(made.html).not.toContain('data-flat="sequence"');
    expect(lights(made, 4)).toMatchObject({ arcs: ["past", "past", "past", "lit", "ahead"], ends: ["critic", "builder"] });
  });
});

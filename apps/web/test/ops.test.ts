import { describe, expect, it } from "vitest";

import { canonicalize, validate, type AgentNode, type Graph } from "@grooph/core";

import {
  addLoop,
  addNode,
  addStop,
  allIds,
  connect,
  followsName,
  moveStop,
  removeEdge,
  removeLoop,
  removeNode,
  removeStop,
  renameId,
  setConstraint,
  setGraphName,
  setNodeName,
  setPositions,
  setTarget,
  toggleLoopBack,
  toggleLoopMember,
} from "../src/doc/ops.js";
import { reviewLoop } from "./helpers.js";

const empty = (): Graph => ({ grooph: 0, id: "g", name: "G", version: 1, nodes: [], edges: [], loops: [] });

describe("operations never mutate their input", () => {
  it("leaves the original document byte-identical", () => {
    const doc = reviewLoop();
    const before = JSON.stringify(doc);
    removeNode(doc, "critic");
    renameId(doc, "builder", "maker");
    setNodeName(doc, "done", "Finished");
    setPositions(doc, { builder: { x: 1, y: 2 } });
    expect(JSON.stringify(doc)).toBe(before);
  });
});

describe("addNode", () => {
  it("names new nodes after their kind and keeps ids unique", () => {
    let doc = empty();
    const a = addNode(doc, "agent");
    doc = a.doc;
    const b = addNode(doc, "agent");
    doc = b.doc;
    const g = addNode(doc, "human-gate");
    expect([a.id, b.id, g.id]).toEqual(["agent", "agent-2", "human-gate"]);
    expect(b.doc.nodes[1]!.name).toBe("Agent 2");
    expect(g.doc.nodes[2]).toEqual({ id: "human-gate", kind: "human-gate", name: "Human gate", prompt: "" });
  });

  it("keeps a layout-free document layout-free (A-005)", () => {
    const { doc } = addNode(empty(), "stop", { x: 10, y: 20 });
    expect(doc.layout).toBeUndefined();
  });

  it("places the node when the document already has layout", () => {
    const { doc, id } = addNode(reviewLoop(), "check", { x: 10.4, y: 20.6 });
    expect(doc.layout![id]).toEqual({ x: 10, y: 21 });
  });
});

describe("names and ids", () => {
  it("lets the id follow the name while they agree", () => {
    let doc = addNode(empty(), "agent").doc;
    doc = connect(addNode(doc, "stop").doc, "agent", "stop").doc;
    const renamed = setNodeName(doc, "agent", "Builder");
    expect(renamed.id).toBe("builder");
    expect(renamed.doc.edges[0]).toMatchObject({ id: "e-builder-stop", from: "builder", to: "stop" });
  });

  it("stops following once the id was set by hand", () => {
    const doc = reviewLoop(); // "Merge approval" has id "merge-gate"
    expect(followsName("merge-gate", "Merge approval")).toBe(false);
    const renamed = setNodeName(doc, "merge-gate", "Merge");
    expect(renamed.id).toBe("merge-gate");
    expect(renamed.doc.nodes.find((n) => n.id === "merge-gate")!.name).toBe("Merge");
  });

  it("never collides with an existing id", () => {
    const doc = reviewLoop();
    const { doc: withAgent, id } = addNode(doc, "agent");
    const renamed = setNodeName(withAgent, id, "Critic");
    expect(renamed.id).toBe("critic-2");
    expect(new Set(renamed.doc.nodes.map((n) => n.id)).size).toBe(renamed.doc.nodes.length);
  });

  it("renames every reference to a node", () => {
    const doc = renameId(reviewLoop(), "builder", "maker");
    expect(doc.nodes.map((n) => n.id)).toContain("maker");
    expect(doc.edges.filter((e) => e.from === "maker" || e.to === "maker")).toHaveLength(3);
    expect(doc.loops[0]!.members).toEqual(["maker", "critic", "merge-gate"]);
    expect(doc.layout!["maker"]).toEqual({ x: 80, y: 160 });
    expect(doc.layout!["builder"]).toBeUndefined();
    expect(validate(doc, { forExport: true })).toEqual([]);
  });

  it("renames loop back edges and policy scopes with an edge", () => {
    const base = { ...reviewLoop(), policies: [{ id: "p", kind: "evidence-required" as const, scope: "edge:e-review-fail" as const }] };
    const doc = renameId(base, "e-review-fail", "e-fail");
    expect(doc.loops[0]!.back).toEqual(["e-fail", "e-gate-reject"]);
    expect(doc.policies![0]!.scope).toBe("edge:e-fail");
  });

  it("lets the graph id follow the graph name", () => {
    const doc = setGraphName({ ...empty(), id: "untitled-graph", name: "Untitled graph" }, "Review loop");
    expect(doc.id).toBe("review-loop");
  });
});

describe("removal cascades", () => {
  it("removes a node's edges, back-edge entries, memberships and layout", () => {
    const doc = removeNode(reviewLoop(), "merge-gate");
    expect(doc.nodes.map((n) => n.id)).toEqual(["builder", "critic", "done"]);
    expect(doc.edges.map((e) => e.id)).toEqual(["e-build-review", "e-review-fail"]);
    expect(doc.loops[0]!.members).toEqual(["builder", "critic"]);
    expect(doc.loops[0]!.back).toEqual(["e-review-fail"]);
    expect(Object.keys(doc.layout!)).not.toContain("merge-gate");
    // the loop still stands on its own: builder ⇄ critic with a stop
    expect(validate(doc).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("clears stop `then` and `answerKeyFrom` references", () => {
    let doc = reviewLoop();
    doc = { ...doc, loops: [{ ...doc.loops[0]!, stops: [{ kind: "bar-passed", then: "done" }], bar: { ...doc.loops[0]!.bar!, answerKeyFrom: "done" } }] };
    doc = removeNode(doc, "done");
    expect(doc.loops[0]!.stops).toEqual([{ kind: "bar-passed" }]);
    expect(doc.loops[0]!.bar!.answerKeyFrom).toBeUndefined();
  });

  it("drops policies scoped to what was removed, and nothing else", () => {
    let doc: Graph = {
      ...reviewLoop(),
      policies: [
        { id: "p-graph", kind: "critic-isolation", scope: "graph" },
        { id: "p-node", kind: "no-self-grading", scope: "node:critic" },
        { id: "p-loop", kind: "concurrency-cap", scope: "loop:review-cycle", params: { max: 2 } },
      ],
    };
    doc = removeNode(doc, "critic");
    expect(doc.policies!.map((p) => p.id)).toEqual(["p-graph", "p-loop"]);
    doc = removeLoop(doc, "review-cycle");
    expect(doc.policies!.map((p) => p.id)).toEqual(["p-graph"]);
  });

  it("removes an edge from loop back lists", () => {
    const doc = removeEdge(reviewLoop(), "e-gate-reject");
    expect(doc.loops[0]!.back).toEqual(["e-review-fail"]);
  });
});

describe("loops and stops", () => {
  it("builds the review loop's loop from taps", () => {
    let doc = reviewLoop();
    doc = { ...doc, loops: [] };
    const { doc: withLoop, id } = addLoop(doc, ["critic"]);
    doc = toggleLoopMember(withLoop, id, "merge-gate");
    doc = toggleLoopMember(doc, id, "builder");
    expect(doc.loops[0]!.members).toEqual(["builder", "critic", "merge-gate"]); // document order
    doc = toggleLoopBack(doc, id, "e-gate-reject");
    doc = toggleLoopBack(doc, id, "e-review-fail");
    expect(doc.loops[0]!.back).toEqual(["e-review-fail", "e-gate-reject"]);
    doc = toggleLoopBack(doc, id, "e-review-fail");
    expect(doc.loops[0]!.back).toEqual(["e-gate-reject"]);
  });

  it("adds, reorders and removes stops with bounded defaults", () => {
    let doc = addLoop(addNode(empty(), "agent").doc, ["agent"]).doc;
    doc = addStop(doc, "loop", "budget");
    doc = addStop(doc, "loop", "max-iterations");
    expect(doc.loops[0]!.stops).toEqual([
      { kind: "budget", measure: "turns", limit: 40 },
      { kind: "max-iterations", n: 4 },
    ]);
    doc = moveStop(doc, "loop", 1, -1);
    expect(doc.loops[0]!.stops.map((s) => s.kind)).toEqual(["max-iterations", "budget"]);
    doc = removeStop(doc, "loop", 0);
    expect(doc.loops[0]!.stops.map((s) => s.kind)).toEqual(["budget"]);
  });
});

describe("graph fields", () => {
  it("removes empty optional objects instead of leaving husks", () => {
    let doc = setConstraint(empty(), "budget", "10 turns");
    expect(doc.constraints).toEqual({ budget: "10 turns" });
    doc = setConstraint(doc, "budget", undefined);
    expect("constraints" in doc).toBe(false);
    doc = setTarget(doc, "claude-code");
    expect(doc.target).toEqual({ harness: "claude-code" });
    doc = setTarget(doc, undefined);
    expect("target" in doc).toBe(false);
  });

  it("writes whole-pixel positions", () => {
    const doc = setPositions(empty(), { a: { x: 1.6, y: -2.2 } });
    expect(doc.layout).toEqual({ a: { x: 2, y: -2 } });
  });
});

describe("a graph built only with operations", () => {
  it("rebuilds the review loop's shape and validates for export", () => {
    let doc: Graph = { ...empty(), id: "untitled-graph", name: "Untitled graph" };
    doc = setGraphName(doc, "Review loop");
    doc = { ...doc, goal: "Ship the change." };
    doc = setTarget(doc, "claude-code");
    const add = (kind: Parameters<typeof addNode>[1], name: string): string => {
      const added = addNode(doc, kind);
      const named = setNodeName(added.doc, added.id, name);
      doc = named.doc;
      return named.id;
    };
    const builder = add("agent", "Builder");
    const critic = add("agent", "Critic");
    const gate = add("human-gate", "Merge gate");
    const done = add("stop", "Done");
    doc = {
      ...doc,
      nodes: doc.nodes.map((n) =>
        n.kind === "agent"
          ? ({ ...n, role: n.id === critic ? "critic" : "builder", brief: "…", outputs: ["out"] } as AgentNode)
          : n.kind === "human-gate"
            ? { ...n, prompt: "Merge?" }
            : n,
      ),
    };
    const edge = (from: string, to: string, when?: "pass" | "fail"): string => {
      const c = connect(doc, from, to);
      doc = when ? { ...c.doc, edges: c.doc.edges.map((e) => (e.id === c.id ? { ...e, when } : e)) } : c.doc;
      return c.id;
    };
    edge(builder, critic);
    const fail = edge(critic, builder, "fail");
    edge(critic, gate, "pass");
    edge(gate, done, "pass");
    const reject = edge(gate, builder, "fail");
    const loop = addLoop(doc, [builder, critic, gate]);
    doc = toggleLoopBack(toggleLoopBack(loop.doc, loop.id, fail), loop.id, reject);
    doc = {
      ...doc,
      loops: doc.loops.map((l) => ({ ...l, mode: "judgment", bar: { name: "Checklist", inspects: [{ kind: "checklist", ref: "CHECKLIST.md" }], acceptance: "All items met." } })),
    };
    doc = addStop(addStop(addStop(doc, loop.id, "bar-passed"), loop.id, "max-iterations"), loop.id, "budget");

    expect(doc.id).toBe("review-loop");
    expect([doc.nodes.length, doc.edges.length, doc.loops.length, doc.loops[0]!.stops.length]).toEqual([4, 5, 1, 3]);
    expect(doc.edges.map((e) => e.id)).toEqual([
      "e-builder-critic",
      "e-critic-builder",
      "e-critic-merge-gate",
      "e-merge-gate-done",
      "e-merge-gate-builder",
    ]);
    expect(validate(doc, { forExport: true })).toEqual([]);
    expect(allIds(doc).size).toBe(1 + 4 + 5 + 1);
    expect(() => canonicalize(doc)).not.toThrow();
  });
});

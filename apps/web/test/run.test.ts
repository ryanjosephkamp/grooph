import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { buildRunBundle, decodeSharePayload, encodeSharePayload, buildShareEnvelope, parseGraphText, type Graph, type RunBundle } from "@grooph/core";
import { describe, expect, it } from "vitest";

import { deflateRaw as cliDeflate } from "../../../packages/cli/src/share-io.js";
import { listChange, noteTarget, orderedNotes, proposalCopy, runKey, runModel, stateLabel, targetHighlight, targetLabel } from "../src/doc/run.js";
import { deflateRaw as webDeflate, inflateRaw as webInflate } from "../src/doc/share.js";
import { repoRoot } from "./helpers.js";

/** A run folder from fixtures/runs/, bundled as `grooph runs bundle` does. */
function bundle(graphId: string): RunBundle {
  const graphDir = join(repoRoot, "fixtures/runs", graphId);
  const run = readdirSync(join(graphDir, "runs"))[0]!;
  const graph = (path: string): Graph => parseGraphText(readFileSync(path, "utf8")).doc!;
  return buildRunBundle({
    source: graph(join(graphDir, "graph.grooph.json")),
    working: graph(join(graphDir, "runs", run, "graph.grooph.json")),
    notesText: readFileSync(join(graphDir, "runs", run, "notes.jsonl"), "utf8"),
    run,
  });
}

describe("the run view's model", () => {
  it("holds the real run: ended, three explained changes, adoptable as version 2", () => {
    const model = runModel(bundle("slice-0007-sandwich"));
    expect(model.summary.state).toBe("ended");
    expect(model.diff.changes).toHaveLength(3);
    expect(model.why).toEqual([["n-0002"], ["n-0002"], ["n-0002"]]);
    expect(model.adoption.ok && model.adoption.doc.version).toBe(2);
    expect(model.moved).toBe(false);
    expect(runKey(model.bundle)).toBe("slice-0007-sandwich/20260919-0057-66c8");
  });

  it("names and lights up what a note is about", () => {
    const b = bundle("slice-0007-sandwich");
    const at = (id: string) => noteTarget(b.notes.find((n) => n.id === id)!);
    expect(targetLabel(at("n-0006"), b.working)).toBe("Critic");
    expect(targetLabel(at("n-0008"), b.working)).toBe("Edge Cheap checks → Critic");
    expect(targetLabel(at("n-0012"), b.working)).toBe("Loop Sandwich");
    expect(targetLabel(at("n-0001"), b.working)).toBe("The run");
    expect(targetHighlight(at("n-0008"), b.working)).toEqual({ nodes: ["checks", "critic"], edges: ["e-checks-critic"] });
    expect(targetHighlight(at("n-0012"), b.working)).toEqual({ nodes: ["builder", "checks", "critic"], edges: ["e-checks-fail", "e-critic-fail"], loop: "sandwich" });
  });

  it("orders the timeline newest first only while a live run is running", () => {
    const live = runModel(bundle("run-live")).summary;
    expect(orderedNotes(live, true)[0]!.id).toBe("n-0004");
    expect(orderedNotes(live, false)[0]!.id).toBe("n-0001");
    const ended = runModel(bundle("slice-0007-sandwich")).summary;
    expect(orderedNotes(ended, true)[0]!.id).toBe("n-0001");
  });

  it("shows list changes as what went and what came", () => {
    expect(listChange(["a", "b", "c"], ["a", "c", "d"])).toEqual({ removed: ["b"], added: ["d"], kept: 2, reordered: false });
    expect(listChange(["a", "b"], ["b", "a"])).toEqual({ removed: [], added: [], kept: 2, reordered: true });
    expect(listChange("text", "other")).toBeUndefined();
    expect(stateLabel("passed", "done")).toBe("done");
    expect(stateLabel("passed", "pass")).toBe("passed");
  });

  it("applies an op-list proposal to a copy and explains any other patch", () => {
    const real = bundle("slice-0007-sandwich");
    const copy = proposalCopy(real, real.notes.find((n) => n.id === "n-0008")!);
    expect(copy.ok).toBe(true);
    if (copy.ok) {
      expect(copy.doc.version).toBe(2);
      expect(copy.doc.lineage?.from).toBe("slice-0007-sandwich@1");
      expect(copy.issues.filter((i) => i.severity === "error")).toEqual([]);
    }
    const gate = bundle("run-gate");
    const refused = proposalCopy(gate, gate.notes.find((n) => n.proposal)!);
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.message).toMatch(/JSON Patch/);
    const failing = proposalCopy(real, { ...real.notes.find((n) => n.id === "n-0008")!, proposal: { summary: "x", patch: [{ op: "removeNode", id: "ghost" }] } });
    expect(!failing.ok && failing.message).toMatch(/does not apply to the run's working copy: ops\[0\] removeNode/);
  });

  it("reads a run link made by the CLI's codec, and the CLI reads the app's", () => {
    const real = bundle("slice-0007-sandwich");
    for (const deflate of [cliDeflate, webDeflate]) {
      const opened = decodeSharePayload(encodeSharePayload(buildShareEnvelope(real), deflate), webInflate);
      expect(opened.ok && opened.envelope.kind).toBe("run");
    }
  });
});

import { describe, expect, it } from "vitest";

import { strFromU8, unzipSync } from "fflate";

import { attemptExport, graphFileText, zipPackage } from "../src/doc/exportPackage.js";
import { computeIssues, highlightFor } from "../src/doc/issues.js";
import { readGraphFile } from "../src/store/library.js";
import { fixtureText, goldenDir, readTree, reviewLoop } from "./helpers.js";

describe("export", () => {
  it("emits the golden package byte for byte, through the zip", () => {
    const attempt = attemptExport(reviewLoop());
    if (!attempt.ok) throw new Error(attempt.issues.map((i) => i.code).join(", "));
    const unzipped = Object.fromEntries(Object.entries(unzipSync(zipPackage(attempt.result.files))).map(([p, b]) => [p, strFromU8(b)]));
    expect(unzipped).toEqual(readTree(goldenDir));
  });

  it("downloads the graph in canonical form", () => {
    expect(graphFileText(reviewLoop())).toBe(readTree(goldenDir)[".grooph/review-loop/graph.grooph.json"]);
  });

  it("refuses with the validator's errors, as the CLI does", () => {
    const { goal: _goal, ...doc } = reviewLoop();
    const attempt = attemptExport(doc);
    expect(attempt.ok).toBe(false);
    if (attempt.ok) return;
    expect(attempt.reason).toBe("rules");
    expect(attempt.issues.map((i) => i.code)).toEqual(["E_NO_GOAL"]);
  });

  it("refuses a document that does not match the schema yet", () => {
    const doc = reviewLoop();
    const attempt = attemptExport({ ...doc, nodes: [...doc.nodes, { id: "x", kind: "agent", name: "X", role: "builder", brief: "", outputs: [] }] });
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.reason).toBe("schema");
  });
});

describe("live validation", () => {
  it("is clean for the fixture", () => {
    expect(computeIssues(reviewLoop())).toEqual([]);
  });

  it("reports schema issues first, pointing at the node", () => {
    const doc = reviewLoop();
    const issues = computeIssues({ ...doc, nodes: [...doc.nodes, { id: "x", kind: "agent", name: "X", role: "builder", brief: "", outputs: [] }] });
    expect(issues.map((i) => i.code)).toEqual(["E_SCHEMA"]);
    expect(issues[0]!.at).toEqual(["x"]);
  });

  it("expands a loop to its members and back edges when highlighting", () => {
    const h = highlightFor(reviewLoop(), ["review-cycle"]);
    expect([...h.nodes]).toEqual(["builder", "critic", "merge-gate"]);
    expect([...h.edges]).toEqual(["e-review-fail", "e-gate-reject"]);
  });
});

describe("import", () => {
  it("accepts the fixture untouched", () => {
    const result = readGraphFile(fixtureText());
    expect(result.doc).toEqual(reviewLoop());
    expect(result.issues).toEqual([]);
  });

  it("refuses text that is not JSON", () => {
    const result = readGraphFile("{ nope");
    expect(result.doc).toBeUndefined();
    expect(result.issues[0]!.code).toBe("E_SCHEMA");
  });

  it("opens an unfinished graph and keeps its schema issues", () => {
    const doc = reviewLoop();
    const text = JSON.stringify({ ...doc, nodes: [...doc.nodes, { id: "x", kind: "agent", name: "X", role: "builder", brief: "", outputs: [] }] });
    const result = readGraphFile(text);
    expect(result.doc).toBeDefined();
    expect(result.issues.map((i) => i.code)).toEqual(["E_SCHEMA"]);
  });

  it("refuses JSON the editor cannot hold", () => {
    expect(readGraphFile(JSON.stringify({ hello: "world" })).doc).toBeUndefined();
    expect(readGraphFile(JSON.stringify({ id: "g", name: "G", nodes: {}, edges: [], loops: [] })).doc).toBeUndefined();
  });
});

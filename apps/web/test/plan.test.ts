import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { KNOWN_TARGETS, canonicalize, picture, targetTitle, type Graph } from "@grooph/core";
import { describe, expect, it } from "vitest";

import { computeIssues, needInWords, packageNeeds } from "../src/doc/issues.js";
import { planFolder, planOf, planZipName } from "../src/doc/plan.js";
import { repoRoot, reviewLoop } from "./helpers.js";

const root = join(repoRoot, "apps/web/src");
const read = (path: string): string => readFileSync(join(root, path), "utf8");
const TARGETS = KNOWN_TARGETS.map((id) => ({ id, title: targetTitle(id) ?? id }));
const codes = (issues: { code: string }[]): string[] => issues.map((issue) => issue.code);

/** The review loop as a plan nobody has asked a package of: no harness, no goal. */
const aPlan = (): Graph => {
  const doc = reviewLoop();
  delete doc.target;
  delete doc.goal;
  return doc;
};
/** And with its loop's stops gone: a cycle nothing ends, which is an error of the graph itself. */
const inError = (): Graph => ({ ...aPlan(), loops: [] });

/**
 * Slice 0100, amendment A-020: a graph is a plan first. It may name no harness and state no goal, and that is no
 * fault of it; a plan can always be kept, with what the validator found written in it; and a package for a harness
 * says plainly what it still needs.
 */
describe("a plan in the app (slice 0100)", () => {
  it("a graph with no harness and no goal has no issue for it: the two are what a package would need", () => {
    expect(codes(computeIssues(reviewLoop()))).toEqual(["W_HOMOGENEOUS_CRITICS"]);
    expect(packageNeeds(reviewLoop())).toEqual([]);
    // The same graph as a plan: the list is what it was, and the two findings are said apart.
    expect(codes(computeIssues(aPlan()))).toEqual(["W_HOMOGENEOUS_CRITICS"]);
    expect(codes(packageNeeds(aPlan()))).toEqual(["E_NO_TARGET", "E_NO_GOAL"]);
    // A harness grooph has no compiler for is the same need, and not an issue either.
    const custom = { ...reviewLoop(), target: { harness: "my-harness" } };
    expect(codes(computeIssues(custom))).toEqual(["W_HOMOGENEOUS_CRITICS"]);
    expect(codes(packageNeeds(custom))).toEqual(["E_NO_TARGET"]);
  });

  it("every other finding is the graph's own and stays in the list: an error of the graph, a slot left unfilled", () => {
    expect(codes(computeIssues(inError())).filter((code) => code.startsWith("E_"))).toEqual(["E_CYCLE_NO_STOP"]);
    expect(codes(packageNeeds(inError()))).toEqual(["E_NO_TARGET", "E_NO_GOAL"]);
    const gap = reviewLoop();
    gap.nodes = gap.nodes.map((node) => (node.kind === "agent" && node.id === "builder" ? { ...node, brief: "Do {{task}}." } : node));
    expect(codes(computeIssues(gap))).toContain("E_UNFILLED_SLOT");
    expect(packageNeeds(gap)).toEqual([]);
    // A document that does not read as a graph yet has its schema findings, and nothing is said of a package.
    const unread = { ...reviewLoop(), nodes: [{ id: "x", kind: "agent" }] } as unknown as Graph;
    expect(new Set(codes(computeIssues(unread)))).toEqual(new Set(["E_SCHEMA"]));
    expect(packageNeeds(unread)).toEqual([]);
  });

  it("a step that is a person's is no error of a plan either: it is what a package cannot hold yet", () => {
    // Part two of the amendment is on main: a document may hold `by: "person"` (a plan template does), though this
    // app cannot yet set it. Such a graph must not open on a red error.
    const doc = reviewLoop();
    doc.nodes = doc.nodes.map((node) => (node.kind === "agent" && node.id === "critic" ? { ...node, by: "person" as const } : node));
    expect(codes(computeIssues(doc)).filter((code) => code.startsWith("E_"))).toEqual([]);
    expect(codes(packageNeeds(doc))).toEqual(["E_PERSON_STEP_NOT_COMPILED"]);
    expect(needInWords(packageNeeds(doc)[0]!, doc, TARGETS)).toBe("Every step an agent's: Critic is a person's, and grooph cannot yet hand a step to a person inside a harness.");
    // And the plan of it is made, and says whose the step is.
    expect(planOf(doc).files["PLAN.md"]).toMatch(/\| Critic \| a person \|/);
  });

  it("a need is said in plain words, and a harness with no compiler names the ones grooph has", () => {
    const [harness, goal] = packageNeeds(aPlan());
    expect(needInWords(harness!, aPlan(), TARGETS)).toBe("A harness grooph has a compiler for: Claude Code or Codex. This graph names none, which is right for a plan.");
    expect(needInWords(goal!, aPlan(), TARGETS)).toBe("A goal: the lead's brief is built from it.");
    const custom = { ...reviewLoop(), target: { harness: "my-harness" } };
    expect(needInWords(packageNeeds(custom)[0]!, custom, TARGETS)).toBe('grooph has no compiler for "my-harness". It has one for Claude Code or Codex: choose it from the list of harnesses.');
    // A name that is one of grooph's but for a capital or a space is another name, and is shown as it was typed.
    for (const near of ["Codex", " codex", "Claude Code"]) {
      const doc = { ...reviewLoop(), target: { harness: near } };
      expect(needInWords(packageNeeds(doc)[0]!, doc, TARGETS)).toBe(`grooph has no compiler for "${near}". It has one for Claude Code or Codex: choose it from the list of harnesses.`);
    }
  });

  it("the plan the app makes is the plan core's whole entry makes, file for file, errors or not", async () => {
    // The app reaches the maker and hands it core's parts; the CLI's entry binds them. The same bytes either way,
    // for a graph with no subgrooph.
    const whole = await import("../../../packages/core/src/index.js");
    for (const doc of [reviewLoop(), aPlan(), inError()]) {
      const made = planOf(doc);
      expect(made).toEqual(whole.planBundle(doc));
      expect(Object.keys(made.files)).toEqual(["PLAN.md", `${doc.id}.svg`, `${doc.id}.grooph.json`]);
      expect(made.files[`${doc.id}.grooph.json`]).toBe(canonicalize(doc));
    }
    // A plan in error is still a plan: what stands between it and a harness is written in it.
    const errored = planOf(inError());
    expect(codes(errored.toFix).filter((code) => code.startsWith("E_"))).toEqual(["E_CYCLE_NO_STOP", "E_NO_TARGET", "E_NO_GOAL"]);
    expect(errored.files["PLAN.md"]).toContain("As a plan this is not whole yet: it breaks a rule a graph itself is held to");
    expect(errored.files["PLAN.md"]).toContain("**To run it in a coding harness, ");
    expect(errored.files["PLAN.md"]).toContain("`E_CYCLE_NO_STOP`");
    expect(planZipName(inError())).toBe("review-loop-plan.zip");
    expect(Object.keys(planFolder(inError(), errored))).toEqual(["review-loop-plan/PLAN.md", "review-loop-plan/review-loop.svg", "review-loop-plan/review-loop.grooph.json"]);
    expect(Object.values(planFolder(inError(), errored))).toEqual(Object.values(errored.files));
  });

  it("a subgrooph is drawn in the app's plan as its nodes, as the app draws it everywhere, and in the CLI's as one box", async () => {
    // Said in doc/plan.ts and in the pull request: the one difference between the two plans.
    const whole = await import("../../../packages/core/src/index.js");
    const doc = whole.parseGraphText(readFileSync(join(repoRoot, "fixtures/valid/subgrooph-in-a-graph.grooph.json"), "utf8")).doc!;
    const here = planOf(doc);
    const there = whole.planBundle(doc);
    expect(here.files["PLAN.md"]).toBe(there.files["PLAN.md"]);
    expect(here.files[`${doc.id}.grooph.json`]).toBe(there.files[`${doc.id}.grooph.json`]);
    expect(here.files[`${doc.id}.svg`]).toBe(picture(doc));
    expect(here.files[`${doc.id}.svg`]).not.toBe(there.files[`${doc.id}.svg`]);
  });

  it("the Export panel and the plan's maker are a piece: nothing the app starts with and no screen of the canvas imports them outright", () => {
    const seen = new Set<string>();
    const follow = (file: string): void => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const [, to] of readFileSync(file, "utf8").matchAll(/^(?:import|export)\s(?!type\b)(?:[^;]*?\sfrom\s+)?"([^"]+)";/gm)) {
        expect(to, `${file.slice(root.length + 1)} imports the plan's maker outright`).not.toBe("@grooph/core/plan");
        if (!to!.startsWith(".")) continue;
        const base = join(dirname(file), to!.replace(/\.js$/, ""));
        const found = [`${base}.ts`, `${base}.tsx`].find((path) => existsSync(path));
        if (found) follow(found);
      }
    };
    for (const start of ["main.tsx", "App.tsx", "ui/screens.ts", "ui/embed/EmbedApp.tsx"]) follow(join(root, start));
    const reached = [...seen].map((file) => file.slice(root.length + 1));
    for (const file of ["ui/Editor.tsx", "ui/ExportDoor.tsx", "ui/IssuesPanel.tsx", "ui/PackageNeeds.tsx", "doc/issues.ts"]) expect(reached, `the walk did not reach ${file}`).toContain(file);
    for (const file of ["ui/ExportPanel.tsx", "doc/plan.ts"]) expect(reached, `${file} is carried by every canvas`).not.toContain(file);
    // The panel imports nothing of the canvas's own files: a file two pieces import is moved by the bundler into
    // what every address loads (the findings' file went there, 0.56 KB). Its door hands it the rest.
    const relative = (path: string): string[] => [...read(path).matchAll(/^import\s(?!type\b)[^;]*?from\s+"(\.[^"]+)";/gms)].map((m) => m[1]!);
    expect(relative("ui/ExportPanel.tsx").sort()).toEqual(["../doc/exportPackage.js", "../doc/plan.js"]);
    expect(relative("doc/plan.ts")).toEqual([]);
    // And a run's page, which every address loads, reads the two lists from their own small file, not the canvas's.
    expect(relative("doc/run.ts")).toContain("./findings.js");
    expect(relative("doc/run.ts")).not.toContain("./issues.js");
    expect(relative("doc/findings.ts")).toEqual([]);
    // One door, by the name the build gives the piece's file; the editor opens the panel through it.
    expect(read("ui/ExportDoor.tsx")).toContain('piece("ExportPanel", () => import("./ExportPanel.js"))');
    expect(read("ui/Editor.tsx")).toContain("body: <ExportDoor /> };");
    expect(read("ui/Editor.tsx")).not.toMatch(/from "\.\/ExportPanel\.js"/);
  });
});

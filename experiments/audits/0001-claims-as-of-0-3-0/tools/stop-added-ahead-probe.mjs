#!/usr/bin/env node
// Round two, beside finding F1: is a NEW stop that leads on, put ahead of a stop that halts at the same count, held?
// F1 is a reordering of two stops the source already has. This asks about a source that has only the halting stop,
// first on the small probe graph and then on a built-in template (grind-loop). No model is started.
//
//   node stop-added-ahead-probe.mjs <repository root, built> <scratch folder>
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
const root = resolve(process.argv[2] ?? ".");
const scratch = resolve(process.argv[3] ?? "scratch-stop-added");
const core = await import(join(root, "packages/core/dist/src/index.js"));
const cli = join(root, "packages/cli/bin/grooph.js");
console.log(`grooph ${JSON.parse(readFileSync(join(root, "packages/cli/package.json"), "utf8")).version} at ${spawnSync("git", ["-C", root, "rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).stdout.trim()}`);
rmSync(scratch, { recursive: true, force: true });

const small = {
  grooph: 0, id: "added-ahead", name: "Stop added ahead", version: 1, goal: "Build, test, and halt at the dispatch budget.", target: { harness: "claude-code" },
  nodes: [
    { id: "builder", kind: "agent", name: "Builder", role: "builder", brief: "Build.", outputs: ["out.txt"], allow: ["read-files", "edit-files"] },
    { id: "tests", kind: "check", name: "Tests", check: { kind: "command", run: "false", pass: "exit 0" } },
    { id: "done", kind: "stop", name: "Done", outcome: "success" },
  ],
  edges: [{ id: "e-build-test", from: "builder", to: "tests" }, { id: "e-test-fail", from: "tests", to: "builder", when: "fail" }, { id: "e-test-pass", from: "tests", to: "done", when: "pass" }],
  loops: [{ id: "work", name: "Work", members: ["builder", "tests"], back: ["e-test-fail"], mode: "grind", stops: [{ kind: "budget", measure: "dispatches", limit: 2 }] }],
};
// grind-loop, the built-in template, filled as its own example is.
const use = spawnSync(process.execPath, [cli, "template", "use", "grind-loop", "--name", "Grind", "--set", "task=Make the test pass.", "--set", "test-command=pnpm test"], { encoding: "utf8" });
const grind = JSON.parse(use.stdout);
grind.target ??= { harness: "claude-code" };

const tryIt = (label, source, mutate) => {
  const working = structuredClone(source);
  mutate(working);
  const stops = (d) => d.loops[0].stops.map((s) => `${s.kind}${s.limit ? " " + s.limit : ""}${s.n ? " " + s.n : ""}${s.then ? " then " + s.then : ""}`).join(" | ");
  console.log(`\n== ${label}\n  source : ${stops(source)}\n  working: ${stops(working)}`);
  const errors = core.validate(working, { forExport: true }).filter((i) => i.severity === "error").map((i) => i.code);
  console.log(`  working copy validates for export: ${errors.length === 0 ? "yes" : "NO, " + errors.join(", ")}`);
  const adopted = core.adoptWorkingCopy(source, working, { run: "r1" });
  if (!adopted.ok) return console.log("  adoptWorkingCopy refused:", JSON.stringify(adopted).slice(0, 300));
  const check = core.checkAdoption(source, adopted.doc);
  console.log(`  checkAdoption: refused ${JSON.stringify((check.refused ?? []).map((r) => `${r.name}: ${(r.reasons ?? [r.reason]).join("; ")}`)).slice(0, 420)}`);
  const cwd = join(scratch, label.replace(/\W+/g, "-"));
  const run = join(cwd, ".grooph", source.id, "runs", "r1");
  mkdirSync(run, { recursive: true });
  writeFileSync(join(cwd, ".grooph", source.id, "graph.grooph.json"), core.canonicalize(source));
  writeFileSync(join(run, "graph.grooph.json"), core.canonicalize(working));
  writeFileSync(join(run, "notes.jsonl"), "");
  const out = join(cwd, "adopted.grooph.json");
  const a = spawnSync(process.execPath, [cli, "adopt", run, "--write", "--into", out], { cwd, encoding: "utf8" });
  console.log(`  grooph adopt --write, no --allow: exit ${a.status}; ${existsSync(out) ? "WROTE the copy" : "wrote nothing"}`);
};
const successStop = (d) => d.nodes.find((n) => n.kind === "stop" && n.outcome === "success").id;
tryIt("small graph, a leading-on budget of the same size added ahead", small, (d) => d.loops[0].stops.unshift({ kind: "budget", measure: "dispatches", limit: 2, then: "done" }));
tryIt("small graph, a leading-on budget of the same size added behind", small, (d) => d.loops[0].stops.push({ kind: "budget", measure: "dispatches", limit: 2, then: "done" }));
tryIt("small graph, a leading-on cap of one round added ahead", small, (d) => d.loops[0].stops.unshift({ kind: "max-iterations", n: 1, then: "done" }));
const firstHalting = (d) => d.loops[0].stops.findIndex((s) => (s.kind === "budget" || s.kind === "max-iterations") && !s.then);
tryIt("grind-loop, a leading-on copy of its first halting limit added just ahead of it", grind, (d) => { const i = firstHalting(d); d.loops[0].stops.splice(i, 0, { ...d.loops[0].stops[i], then: successStop(d) }); });

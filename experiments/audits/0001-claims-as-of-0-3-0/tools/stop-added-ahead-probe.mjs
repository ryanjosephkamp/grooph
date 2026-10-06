#!/usr/bin/env node
// Round two, beside finding F1: is a NEW stop that leads on, put beside a stop that halts, held?
// F1 as Codex found it is a reordering of two stops the source already has. This asks about a source that has only
// the halting stop. The answer turned out to depend on what stands before the place the new stop leads to, and on
// whether the loop already had a stop of that kind. The fresh reader of the reconciliation found the open case; this
// is the lane's own run of it. No model is started.
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

const halts = { kind: "budget", measure: "dispatches", limit: 2 };
// A check stands before "done": the only way there is the check's pass.
const checked = (stops) => ({
  grooph: 0, id: "checked", name: "A loop with a check", version: 1, goal: "Build, test, and halt at the dispatch budget.", target: { harness: "claude-code" },
  nodes: [
    { id: "builder", kind: "agent", name: "Builder", role: "builder", brief: "Build.", outputs: ["out.txt"], allow: ["read-files", "edit-files"] },
    { id: "tests", kind: "check", name: "Tests", check: { kind: "command", run: "false", pass: "exit 0" } },
    { id: "done", kind: "stop", name: "Done", outcome: "success" },
  ],
  edges: [{ id: "e-build-test", from: "builder", to: "tests" }, { id: "e-test-fail", from: "tests", to: "builder", when: "fail" }, { id: "e-test-pass", from: "tests", to: "done", when: "pass" }],
  loops: [{ id: "work", name: "Work", members: ["builder", "tests"], back: ["e-test-fail"], mode: "grind", stops }],
});
// No check and no critic: a worker, and a sorter that says "more" or "finished".
const plain = (stops) => ({
  grooph: 0, id: "plain", name: "A loop with no check", version: 1, goal: "Work through a list.", target: { harness: "claude-code" },
  nodes: [
    { id: "worker", kind: "agent", name: "Worker", role: "builder", brief: "Do the next item.", outputs: ["out.txt"], allow: ["read-files", "edit-files"] },
    { id: "sorter", kind: "agent", name: "Sorter", role: "planner", brief: "Say whether items remain.", outputs: ["LEFT.md"], allow: ["read-files", "write-outputs"] },
    { id: "done", kind: "stop", name: "Done", outcome: "success" },
  ],
  edges: [{ id: "e-w-s", from: "worker", to: "sorter" }, { id: "e-more", from: "sorter", to: "worker", when: { verdict: "more" } }, { id: "e-fin", from: "sorter", to: "done", when: { verdict: "finished" } }],
  loops: [{ id: "list", name: "List", members: ["worker", "sorter"], back: ["e-more"], mode: "grind", stops }],
});
const said = (s) => `${s.kind}${s.measure ? " " + s.measure : ""} ${s.limit ?? s.n ?? s.rounds ?? ""}${s.then ? " then " + s.then : " halts"}`;
let n = 0;
const tryIt = (label, source, working) => {
  n += 1;
  console.log(`\n== ${n}. ${label}\n  source : ${source.loops[0].stops.map(said).join("  |  ")}\n  working: ${working.loops[0].stops.map(said).join("  |  ")}`);
  const errors = core.validate(working, { forExport: true }).filter((i) => i.severity === "error").map((i) => i.code);
  console.log(`  the working copy validates for export: ${errors.length === 0 ? "yes" : "NO, " + errors.join(", ")}`);
  const adopted = core.adoptWorkingCopy(source, working, { run: "r1" });
  if (!adopted.ok) return console.log("  adoptWorkingCopy refused:", JSON.stringify(adopted).slice(0, 300));
  const check = core.checkAdoption(source, adopted.doc);
  for (const c of check.changes) console.log(`  the comparison lists ${c.name}${c.tightens ? `, and calls it a tightening ("${String(c.tightens).slice(0, 150)}")` : ""}`);
  console.log(`  it refuses: ${check.refused.length === 0 ? "NOTHING" : check.refused.map((r) => `${r.name}, because ${String(r.loosens).slice(0, 260)}`).join(" || ")}`);
  const cwd = join(scratch, String(n));
  const run = join(cwd, ".grooph", source.id, "runs", "r1");
  mkdirSync(run, { recursive: true });
  writeFileSync(join(cwd, ".grooph", source.id, "graph.grooph.json"), core.canonicalize(source));
  writeFileSync(join(run, "graph.grooph.json"), core.canonicalize(working));
  writeFileSync(join(run, "notes.jsonl"), "");
  const out = join(cwd, "adopted.grooph.json");
  const a = spawnSync(process.execPath, [cli, "adopt", run, "--write", "--into", out], { cwd, encoding: "utf8" });
  console.log(`  grooph adopt --write, no --allow: exit ${a.status}; ${existsSync(out) ? "WROTE the copy" : "wrote nothing"}`);
  const label2 = `${a.stdout}${a.stderr}`.split("\n").find((l) => /tightens a brake/i.test(l));
  if (label2) console.log(`    | ${label2.trim().slice(0, 200)}`);
  const project = join(cwd, "project");
  mkdirSync(project, { recursive: true });
  const src = join(cwd, "source.grooph.json");
  const wrk = join(cwd, "working.grooph.json");
  writeFileSync(src, core.canonicalize(source));
  writeFileSync(wrk, core.canonicalize(working));
  spawnSync(process.execPath, [cli, "export", src, "--target", "claude-code", "--into", project], { cwd, encoding: "utf8" });
  const e = spawnSync(process.execPath, [cli, "export", wrk, "--target", "claude-code", "--into", project], { cwd, encoding: "utf8" });
  const line = `${e.stdout}${e.stderr}`.split("\n").find((l) => /brakes:|may remove or loosen/.test(l)) ?? "";
  console.log(`  grooph export --into, the working copy over the source's package, no --allow: exit ${e.status}${line ? "\n    | " + line.trim().slice(0, 200) : ""}`);
};
const capOn = { kind: "max-iterations", n: 1, then: "done" };
console.log("\n#### A check stands before where the new stop leads");
tryIt("a leading-on budget of the same size, added ahead", checked([halts]), checked([{ ...halts, then: "done" }, halts]));
tryIt("a leading-on cap of one round (a kind the loop did not have), added ahead", checked([halts]), checked([capOn, halts]));
console.log("\n#### No check and no critic stands before where the new stop leads");
tryIt("a leading-on budget of the same kind and size, added ahead (control)", plain([halts]), plain([{ ...halts, then: "done" }, halts]));
tryIt("a leading-on cap of one round (a kind the loop did not have), added AHEAD", plain([halts]), plain([capOn, halts]));
tryIt("the same cap, added BEHIND", plain([halts]), plain([halts, capOn]));
tryIt("a leading-on diminishing-returns stop (another kind it did not have), added ahead", plain([halts]), plain([{ kind: "diminishing-returns", rounds: 1, then: "done" }, halts]));

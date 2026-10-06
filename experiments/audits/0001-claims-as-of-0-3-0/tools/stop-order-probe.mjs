#!/usr/bin/env node
// Round two, finding F1 (Codex): the order of two stops that fire together decides whether a loop halts or ends in
// success, and the comparison that adoption makes does not see it. No model is started; this reads and writes files.
//
//   node stop-order-probe.mjs <repository root, built> <scratch folder>
//
// Three working copies of one small graph, each put through validate, checkAdoption, `grooph adopt --write` and,
// where the build has it, `grooph export --into` over the package in place:
//   reorder-equal    two budgets of 2 dispatches, the first halts, the second leads to "done"; the copy swaps them
//   reorder-mixed    a cap of 1 round that halts, then a budget of 2 dispatches that leads to "done" (one round is
//                    two dispatches, so both fire on the same pass); the copy swaps them
//   control-raised   the halting budget raised from 2 to 4, which the comparison is known to refuse
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const scratch = resolve(process.argv[3] ?? "scratch-stop-order");
const core = await import(join(root, "packages/core/dist/src/index.js"));
const cli = join(root, "packages/cli/bin/grooph.js");
const version = JSON.parse(readFileSync(join(root, "packages/cli/package.json"), "utf8")).version;
console.log(`grooph ${version} at ${spawnSync("git", ["-C", root, "rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).stdout.trim()}`);

const graph = (id, stops) => ({
  grooph: 0, id, name: "Stop order probe", version: 1, goal: "Build, test, and halt at the dispatch budget.",
  target: { harness: "claude-code" },
  nodes: [
    { id: "builder", kind: "agent", name: "Builder", role: "builder", brief: "Build.", outputs: ["out.txt"], allow: ["read-files", "edit-files"] },
    { id: "tests", kind: "check", name: "Tests", check: { kind: "command", run: "false", pass: "exit 0" } },
    { id: "done", kind: "stop", name: "Done", outcome: "success" },
  ],
  edges: [
    { id: "e-build-test", from: "builder", to: "tests" },
    { id: "e-test-fail", from: "tests", to: "builder", when: "fail" },
    { id: "e-test-pass", from: "tests", to: "done", when: "pass" },
  ],
  loops: [{ id: "work", name: "Work", members: ["builder", "tests"], back: ["e-test-fail"], mode: "grind", stops }],
});
const halts = { kind: "budget", measure: "dispatches", limit: 2 };
const leadsOn = { kind: "budget", measure: "dispatches", limit: 2, then: "done" };
const capHalts = { kind: "max-iterations", n: 1 };
const cases = [
  ["reorder-equal", [halts, leadsOn], [leadsOn, halts]],
  ["reorder-mixed", [capHalts, leadsOn], [leadsOn, capHalts]],
  ["control-raised", [halts, leadsOn], [{ ...halts, limit: 4 }, leadsOn]],
];
const say = (label, stops) => console.log(`  ${label}: ${stops.map((s) => `${s.kind} ${s.limit ?? s.n}${s.measure ? " " + s.measure : ""} ${s.then ? "then " + s.then : "halts"}`).join("  |  ")}`);
const firstLine = (p) => `${p.stdout}${p.stderr}`.trim().split("\n").filter(Boolean);

rmSync(scratch, { recursive: true, force: true });
for (const [name, before, after] of cases) {
  console.log(`\n== ${name}`);
  const id = `order-${name}`;
  const source = graph(id, before);
  const working = graph(id, after);
  say("source ", before);
  say("working", after);
  for (const [label, doc] of [["source", source], ["working", working]]) {
    const issues = core.validate(doc, { forExport: true });
    console.log(`  validate --for-export, ${label}: ${issues.length === 0 ? "no issues" : issues.map((i) => i.code).join(", ")}`);
  }
  const adopted = core.adoptWorkingCopy(source, working, { run: "r1" });
  if (!adopted.ok) { console.log("  adoptWorkingCopy refused:", JSON.stringify(adopted)); continue; }
  const check = core.checkAdoption(source, adopted.doc);
  console.log(`  checkAdoption: changes ${JSON.stringify(check.changes.map((c) => `${c.name}${c.kind ? " (" + c.kind + ")" : ""}`))}, refused ${JSON.stringify((check.refused ?? []).map((r) => r.name ?? r))}`);

  const cwd = join(scratch, name);
  const run = join(cwd, ".grooph", id, "runs", "r1");
  mkdirSync(run, { recursive: true });
  writeFileSync(join(cwd, ".grooph", id, "graph.grooph.json"), core.canonicalize(source));
  writeFileSync(join(run, "graph.grooph.json"), core.canonicalize(working));
  writeFileSync(join(run, "notes.jsonl"), "");
  const out = join(cwd, "adopted.grooph.json");
  const a = spawnSync(process.execPath, [cli, "adopt", run, "--write", "--into", out], { cwd, encoding: "utf8" });
  console.log(`  grooph adopt --write, no --allow: exit ${a.status}; ${existsSync(out) ? "WROTE the copy" : "wrote nothing"}`);
  for (const line of firstLine(a).slice(0, 6)) console.log(`    | ${line}`);
  if (existsSync(out)) say("written", JSON.parse(readFileSync(out, "utf8")).loops[0].stops);

  // The other door: a package in place, and the working copy exported over it.
  const project = join(cwd, "project");
  mkdirSync(project, { recursive: true });
  const src = join(cwd, "source.grooph.json");
  const wrk = join(cwd, "working.grooph.json");
  writeFileSync(src, core.canonicalize(source));
  writeFileSync(wrk, core.canonicalize(working));
  const first = spawnSync(process.execPath, [cli, "export", src, "--target", "claude-code", "--into", project], { cwd, encoding: "utf8" });
  const kept = join(project, ".grooph", id, "graph.grooph.json");
  const stopsAt = () => (existsSync(kept) ? JSON.stringify(JSON.parse(readFileSync(kept, "utf8")).loops[0].stops) : "no kept graph");
  const beforeStops = stopsAt();
  const second = spawnSync(process.execPath, [cli, "export", wrk, "--target", "claude-code", "--into", project], { cwd, encoding: "utf8" });
  const changed = stopsAt() !== beforeStops;
  console.log(`  grooph export, source into an empty project: exit ${first.status}`);
  console.log(`  grooph export, working copy over that package, no --allow: exit ${second.status}; the package's kept graph ${changed ? "NOW HOLDS the working copy's stops" : "is unchanged"}`);
  for (const line of firstLine(second).filter((l) => /refus|loosen|brake|allow|nothing is written|not written|compared/i.test(l)).slice(0, 4)) console.log(`    | ${line.slice(0, 220)}`);
  const brief = join(project, ".grooph", id, "LEAD.md");
  if (existsSync(brief)) {
    const lines = readFileSync(brief, "utf8").split("\n").filter((l) => /budget|max-iterations|max iterations|in order|first that fires|first one/i.test(l)).slice(0, 6);
    console.log("  what the lead's brief there says of the stops:");
    for (const line of lines) console.log(`    | ${line.trim().slice(0, 230)}`);
  }
}

import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
const root = resolve(process.argv[2]);
const scratch = resolve(process.argv[3]);
const core = await import(join(root, "packages/core/dist/src/index.js"));
const cli = join(root, "packages/cli/bin/grooph.js");
rmSync(scratch, { recursive: true, force: true });

const checkGraph = (stops, extra = {}) => ({
  grooph: 0, id: "v", name: "Variant", version: 1, goal: "Build, test, and halt at the dispatch budget.", target: { harness: "claude-code" },
  nodes: [
    { id: "builder", kind: "agent", name: "Builder", role: "builder", brief: "Build.", outputs: ["out.txt"], allow: ["read-files", "edit-files"] },
    { id: "tests", kind: "check", name: "Tests", check: { kind: "command", run: "false", pass: "exit 0" } },
    { id: "done", kind: "stop", name: "Done", outcome: "success" },
    ...(extra.nodes ?? []),
  ],
  edges: [{ id: "e-build-test", from: "builder", to: "tests" }, { id: "e-test-fail", from: "tests", to: "builder", when: "fail" }, { id: "e-test-pass", from: "tests", to: "done", when: "pass" }, ...(extra.edges ?? [])],
  loops: [{ id: "work", name: "Work", members: ["builder", "tests"], back: ["e-test-fail"], mode: "grind", stops }, ...(extra.loops ?? [])],
});
let n = 0;
const tryIt = (label, source, working) => {
  n += 1;
  const stops = (d) => d.loops.map((l) => `${l.id}: ` + l.stops.map((s) => `${s.kind}${s.measure ? ":" + s.measure : ""} ${s.limit ?? s.n ?? s.every ?? s.rounds ?? ""}${s.then ? " then " + s.then : " HALT"}`).join(" | ")).join(" || ");
  console.log(`\n== ${n}. ${label}\n  source : ${stops(source)}\n  working: ${stops(working)}`);
  for (const [l, d] of [["source", source], ["working", working]]) {
    const issues = core.validate(d, { forExport: true });
    const errs = issues.filter((i) => i.severity === "error").map((i) => i.code);
    console.log(`  validate ${l}: ${errs.length ? "ERRORS " + errs.join(",") : "ok"}${issues.length - errs.length ? " (warnings: " + issues.filter((i) => i.severity !== "error").map((i) => i.code).join(",") + ")" : ""}`);
  }
  const adopted = core.adoptWorkingCopy(source, working, { run: "r1" });
  if (!adopted.ok) return console.log("  adoptWorkingCopy refused:", JSON.stringify(adopted).slice(0, 300));
  const check = core.checkAdoption(source, adopted.doc);
  console.log(`  changes: ${check.changes.map((c) => c.name + (c.tightens ? " [tightens: " + c.tightens.slice(0, 160) + "]" : "")).join(", ")}`);
  console.log(`  refused: ${check.refused.length === 0 ? "NOTHING" : check.refused.map((r) => `${r.name}: ${r.loosens}`).join(" || ").slice(0, 700)}`);
  if (check.notices.length) console.log(`  notices: ${check.notices.join(" | ").slice(0, 300)}`);
  const cwd = join(scratch, String(n));
  const run = join(cwd, ".grooph", source.id, "runs", "r1");
  mkdirSync(run, { recursive: true });
  writeFileSync(join(cwd, ".grooph", source.id, "graph.grooph.json"), core.canonicalize(source));
  writeFileSync(join(run, "graph.grooph.json"), core.canonicalize(working));
  writeFileSync(join(run, "notes.jsonl"), "");
  const out = join(cwd, "adopted.grooph.json");
  const a = spawnSync(process.execPath, [cli, "adopt", run, "--write", "--into", out], { cwd, encoding: "utf8" });
  console.log(`  grooph adopt --write, no --allow: exit ${a.status}; ${existsSync(out) ? "WROTE the copy" : "wrote nothing"}`);
  // export door
  const project = join(cwd, "project"); mkdirSync(project, { recursive: true });
  const src = join(cwd, "source.grooph.json"), wrk = join(cwd, "working.grooph.json");
  writeFileSync(src, core.canonicalize(source)); writeFileSync(wrk, core.canonicalize(working));
  const first = spawnSync(process.execPath, [cli, "export", src, "--target", "claude-code", "--into", project], { cwd, encoding: "utf8" });
  const second = spawnSync(process.execPath, [cli, "export", wrk, "--target", "claude-code", "--into", project], { cwd, encoding: "utf8" });
  console.log(`  grooph export source: exit ${first.status}; working over it, no --allow: exit ${second.status}${second.status === 0 ? " · " + (`${second.stdout}${second.stderr}`.split("\n").find((l) => /brakes:/.test(l)) ?? "").trim().slice(0, 140) : ""}`);
};


const H = { kind: "budget", measure: "dispatches", limit: 2 };
// a loop with no check and no critic: a worker and a sorter that says "more" or "finished"
const plain = (stops, more = [], moreNodes = []) => ({
  grooph: 0, id: "p", name: "Plain loop", version: 1, goal: "Work through a list.", target: { harness: "claude-code" },
  nodes: [
    { id: "worker", kind: "agent", name: "Worker", role: "builder", brief: "Do the next item.", outputs: ["out.txt"], allow: ["read-files", "edit-files"] },
    { id: "sorter", kind: "agent", name: "Sorter", role: "planner", brief: "Say whether items remain.", outputs: ["LEFT.md"], allow: ["read-files"] },
    { id: "done", kind: "stop", name: "Done", outcome: "success" },
    ...moreNodes,
  ],
  edges: [{ id: "e-w-s", from: "worker", to: "sorter" }, { id: "e-more", from: "sorter", to: "worker", when: { verdict: "more" } }, { id: "e-fin", from: "sorter", to: "done", when: { verdict: "finished" } }, ...more],
  loops: [{ id: "list", name: "List", members: ["worker", "sorter"], back: ["e-more"], mode: "grind", stops }],
});
tryIt("(e) loop with no check or critic; source holds ONLY a halting budget; NEW cap of 1 that leads on to done, ahead", plain([H]), plain([{ kind: "max-iterations", n: 1, then: "done" }, H]));
tryIt("(e2) same; NEW diminishing-returns that leads on, ahead", plain([H]), plain([{ kind: "diminishing-returns", rounds: 1, then: "done" }, H]));
tryIt("(e3) same; NEW budget of the SAME kind and size that leads on, ahead (control: looser should see it)", plain([H]), plain([{ ...H, then: "done" }, H]));
tryIt("(e4) same; NEW cap of 1 that leads on, BEHIND", plain([H]), plain([H, { kind: "max-iterations", n: 1, then: "done" }]));

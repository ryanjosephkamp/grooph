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
const farLead = { kind: "budget", measure: "usd", limit: 1000, then: "done" };
// A. new non-brake stops that lead on, ahead of the only (halting) stop
tryIt("A new diminishing-returns that leads on, ahead of the only halting stop", checkGraph([H]), checkGraph([{ kind: "diminishing-returns", rounds: 1, then: "done" }, H]));
tryIt("A new evidence-invalid that leads on, ahead", checkGraph([H]), checkGraph([{ kind: "evidence-invalid", rounds: 1, then: "done" }, H]));
// B. source has a far leading-on stop of another measure (never co-fires). New leading-on stop of a new kind, ahead
tryIt("source: halting budget + far usd budget that leads on; a NEW cap of 1 that leads on to the same place, ahead", checkGraph([H, farLead]), checkGraph([{ kind: "max-iterations", n: 1, then: "done" }, H, farLead]));
tryIt("same source; a NEW diminishing-returns that leads on to the same place, ahead", checkGraph([H, farLead]), checkGraph([{ kind: "diminishing-returns", rounds: 1, then: "done" }, H, farLead]));
// C. same source; the far leading-on stop lowered and moved ahead / only lowered (no reorder)
tryIt("same source; far usd budget only moved ahead (no co-fire in practice)", checkGraph([H, farLead]), checkGraph([farLead, H]));
tryIt("same source; far usd budget lowered to 0.01, not moved", checkGraph([H, farLead]), checkGraph([H, { ...farLead, limit: 0.01 }]));
tryIt("source: cap 3 halts, dispatch budget 100 leads on; budget lowered to 2, NOT moved (fires a round before the cap)", checkGraph([{ kind: "max-iterations", n: 3 }, { kind: "budget", measure: "dispatches", limit: 100, then: "done" }]), checkGraph([{ kind: "max-iterations", n: 3 }, { kind: "budget", measure: "dispatches", limit: 2, then: "done" }]));
// D. change an existing stop's then
tryIt("two halting stops; `then: done` put on the first", checkGraph([{ kind: "max-iterations", n: 1 }, H]), checkGraph([{ kind: "max-iterations", n: 1, then: "done" }, H]));
// E. change kind/measure of an existing leading-on stop
tryIt("far usd leading-on changed to a cap of 1 leading on, and moved ahead", checkGraph([H, farLead]), checkGraph([{ kind: "max-iterations", n: 1, then: "done" }, H]));
tryIt("far usd leading-on changed to a 'turns' budget of 1 leading on, moved ahead", checkGraph([H, farLead]), checkGraph([{ kind: "budget", measure: "turns", limit: 1, then: "done" }, H]));
// F. halting via then -> halt stop node; swap (F1 with a node), and then retarget
const halted = { nodes: [{ id: "halted", kind: "stop", name: "Halted", outcome: "halt" }] };
tryIt("halting stop written as then: halted; `then` retargeted to done", checkGraph([{ ...H, then: "halted" }, farLead], halted), checkGraph([{ ...H, then: "done" }, farLead], halted));
// G. second loop over the same members with a leading-on stop
tryIt("a second loop over the same members and back edge, with a cap of 1 that leads on", checkGraph([H, farLead]), checkGraph([H, farLead], { loops: [{ id: "work2", name: "Work 2", members: ["builder", "tests"], back: ["e-test-fail"], mode: "grind", stops: [{ kind: "max-iterations", n: 1, then: "done" }] }] }));
// H. human stop that leads on
tryIt("source halting budget + far lead; NEW human stop every 1 that leads on to done, ahead", checkGraph([H, farLead]), checkGraph([{ kind: "human", every: 1, then: "done" }, H, farLead]));
// I. three stops: lead, halt, lead -> F1 with the same-kind leading-on already 'first'
tryIt("F1 itself (control): swap of equal budgets", checkGraph([H, { ...H, then: "done" }]), checkGraph([{ ...H, then: "done" }, H]));

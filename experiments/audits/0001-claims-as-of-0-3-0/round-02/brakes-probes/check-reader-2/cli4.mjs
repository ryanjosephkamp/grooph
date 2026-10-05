// Holes A and B through the command: grooph adopt --write, and grooph sub update --write.
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { g, bar, L, N, E, core, errorsOf, R, SCRATCH } from "./lib4.mjs";
const GROOPH = join(R, "packages/cli/bin/grooph.js");
const env = { ...process.env, GROOPH_HOME: join(SCRATCH, "check-reader-2/home"), GROOPH_REGISTRY: "http://127.0.0.1:9/none" };
mkdirSync(join(SCRATCH, "check-reader-2/home/templates"), { recursive: true });
const lines = (out) => (out.stdout + out.stderr).split("\n").filter(Boolean).map((l) => "  | " + l.slice(0, 300)).join("\n");

const adoptCases = [
  ["A a critic from elsewhere listed in the check's loop, a bar, a stop on bar passed", "debate-then-build", (w) => { const l = L(w, "build"); l.members.push("judge"); l.bar = bar(); l.stops.unshift({ kind: "bar-passed" }); }],
  ["A' the same as a new loop over the same round", "debate-then-build", (w) => { w.loops.push({ id: "build-2", name: "Build 2", members: ["builder", "tests", "judge"], back: ["e-tests-fail"], bar: bar(), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 3 }] }); }],
  ["B evidence on the check's fail edge replaced, its target made a critic", "grind-loop", (w) => { N(w, "builder").role = "critic"; E(w, "e-tests-fail").evidence = ["a note that the build went well"]; }],
  ["B' evidence on the check's pass edge replaced, its target made a critic", "retrospective-rewrite", (w) => { N(w, "retro").role = "critic"; E(w, "e-tests-retro").evidence = ["a one-line summary"]; }],
  ["control: bar and stop with no critic borrowed", "debate-then-build", (w) => { const l = L(w, "build"); l.bar = bar(); l.stops.unshift({ kind: "bar-passed" }); }],
];
let i = 0;
for (const [name, which, change] of adoptCases) {
  const dir = join(SCRATCH, "check-reader-2/cli", `adopt${++i}`);
  rmSync(dir, { recursive: true, force: true });
  const src = g(which);
  const run = join(dir, ".grooph", src.id, "runs", "20261005-120000");
  mkdirSync(run, { recursive: true });
  writeFileSync(join(dir, ".grooph", src.id, "graph.grooph.json"), core.canonicalize(src));
  const w = structuredClone(src); change(w);
  writeFileSync(join(run, "graph.grooph.json"), core.canonicalize(w));
  writeFileSync(join(run, "notes.jsonl"), "");
  const target = join(dir, "adopted.grooph.json");
  const out = spawnSync("node", [GROOPH, "adopt", run, "--write", "--into", target], { encoding: "utf8", cwd: dir, env });
  const written = existsSync(target);
  console.log(`\n## adopt: ${name} [${which}]\n  exit ${out.status}, written: ${written}${written ? `, version ${JSON.parse(readFileSync(target, "utf8")).version}, errors: ${errorsOf(core.parseGraphText(readFileSync(target, "utf8")).doc).length}` : ""}`);
  console.log(lines(out));
}

// ---- refresh: the same as a newer version of the template, placed as a subgrooph
const host = () => ({ grooph: 0, id: "host", name: "Host", version: 1, goal: "Plan, build, release.", target: { harness: "claude-code" },
  nodes: [{ id: "plan", kind: "agent", name: "Plan", role: "planner", brief: "Plan.", outputs: ["PLAN0.md"], allow: ["read-files", "write-outputs"] }, { id: "release", kind: "agent", name: "Release", role: "builder", brief: "Release.", outputs: ["REL.md"], allow: ["read-files", "write-outputs"] }, { id: "end", kind: "stop", name: "End", outcome: "success" }],
  edges: [{ id: "e-release-end", from: "release", to: "end" }], loops: [] });
const tpl = (id) => core.parseGraphText(readFileSync(join(R, "patterns", `${id}.grooph.json`), "utf8")).doc;
const refreshCases = [
  ["A", "debate-then-build", (t) => { const l = L(t, "build"); l.members.push("judge"); l.bar = bar(); l.stops.unshift({ kind: "bar-passed" }); }],
  ["B", "grind-loop", (t) => { N(t, "builder").role = "critic"; E(t, "e-tests-fail").evidence = ["a note that the build went well"]; }],
  ["control: check made true", "grind-loop", (t) => { N(t, "tests").check.run = "true"; }],
  ["control: bar, no critic borrowed", "debate-then-build", (t) => { const l = L(t, "build"); l.bar = bar(); l.stops.unshift({ kind: "bar-passed" }); }],
];
i = 0;
for (const [name, id, change] of refreshCases) {
  const t0 = tpl(id);
  const values = Object.fromEntries((t0.template.slots ?? []).map((s) => [s.key, s.example ?? "x"]));
  let placed;
  try { placed = core.placeSubgrooph(host(), t0, { as: "q", values, after: "plan", then: "release" }); } catch (e) { console.log(`\n## refresh ${name} [${id}]: cannot place: ${e.message.slice(0, 200)}`); continue; }
  const before = core.parseGraphText(core.canonicalize(placed.doc)).doc;
  const t = tpl(id); change(t); t.version = (t.version ?? 1) + 1;
  const r = core.refreshSubgrooph(before, "q", t);
  const after = core.parseGraphText(core.canonicalize(r.doc)).doc;
  console.log(`\n## refresh (core): ${name} [${id}]\n  placed valid: ${errorsOf(before).length === 0}; changes: ${r.changes.map((c) => c.name).join(", ")}\n  held: ${r.held.map((c) => `${c.name}: ${c.loosens ?? "waits " + c.waits}`).join(" | ").slice(0, 500) || "NONE"}\n  result valid: ${errorsOf(after).length === 0}`);
  // through the command
  const dir = join(SCRATCH, "check-reader-2/sub", `c${++i}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, ".git"), { recursive: true });
  mkdirSync(join(dir, ".grooph/templates"), { recursive: true });
  writeFileSync(join(dir, ".grooph/templates", `${id}.grooph.json`), core.canonicalize(t));
  const file = join(dir, "host.grooph.json");
  writeFileSync(file, core.canonicalize(before));
  const out = spawnSync("node", [GROOPH, "sub", "update", "host.grooph.json", "--write"], { encoding: "utf8", cwd: dir, env });
  const now = core.parseGraphText(readFileSync(file, "utf8")).doc;
  const changed = core.canonicalize(now) !== core.canonicalize(before);
  console.log(`  command: exit ${out.status}; file changed: ${changed}; valid: ${errorsOf(now).length === 0}`);
  console.log(lines(out));
  if (changed) for (const l of now.loops.filter((l) => l.id.startsWith("q-"))) console.log(`  written loop ${l.id}: members ${l.members.join(",")}; bar ${l.bar ? JSON.stringify(l.bar.acceptance) : "-"}; stops ${l.stops.map((s) => s.kind + (s.then ? ">" + s.then : "")).join("|")}`);
  if (changed) for (const e of now.edges.filter((e) => e.from === "q-tests")) console.log(`  written edge ${e.id}: ${e.from}->${e.to} ${JSON.stringify(e.when)} ev=${JSON.stringify(e.evidence)}`);
}

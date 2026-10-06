// Fifth reader: the clause-4 holes through `grooph adopt --write` and `grooph sub update --write`.
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { g, loop, core, errorsOf, R, SCRATCH } from "./lib5.mjs";
const GROOPH = join(R, "packages/cli/bin/grooph.js");
const env = { ...process.env, GROOPH_HOME: join(SCRATCH, "check-reader-3/home"), GROOPH_REGISTRY: "http://127.0.0.1:9/none" };
mkdirSync(join(SCRATCH, "check-reader-3/home/templates"), { recursive: true });
const lines = (out) => (out.stdout + out.stderr).split("\n").filter(Boolean).map((l) => "  | " + l.slice(0, 260)).join("\n");
const CASES = [
  ["H1 a budget of a measure the loop had not, 1 dispatch, then done", "retrospective-rewrite", (w) => void w.loops.find((l) => l.id.endsWith("grind")).stops.unshift({ kind: "budget", measure: "dispatches", limit: 1, then: w.nodes.find((n) => n.id.endsWith("done")).id })],
  ["H1' a stop where a person is asked, then done", "retrospective-rewrite", (w) => void w.loops.find((l) => l.id.endsWith("grind")).stops.unshift({ kind: "human", every: 1, then: w.nodes.find((n) => n.id.endsWith("done")).id })],
  ["H2 a second loop on the same round, cap 1, then done", "retrospective-rewrite", (w) => { const l = w.loops.find((l) => l.id.endsWith("grind")); w.loops.push({ id: "quick", name: "Quick", members: [...l.members], back: [...l.back], stops: [{ kind: "max-iterations", n: 1, then: w.nodes.find((n) => n.id.endsWith("done")).id }] }); }],
  ["control: diminishing-returns then done (held by the tests)", "retrospective-rewrite", (w) => void w.loops.find((l) => l.id.endsWith("grind")).stops.unshift({ kind: "diminishing-returns", rounds: 1, then: w.nodes.find((n) => n.id.endsWith("done")).id })],
  ["control: H1 on grind-loop (held)", "grind-loop", (w) => void w.loops.find((l) => l.id.endsWith("grind")).stops.unshift({ kind: "budget", measure: "dispatches", limit: 1, then: w.nodes.find((n) => n.id.endsWith("done")).id })],
];
let i = 0;
for (const [name, which, change] of CASES) {
  const dir = join(SCRATCH, "check-reader-3/cli", `adopt${++i}`);
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
  const doc = written ? core.parseGraphText(readFileSync(target, "utf8")).doc : undefined;
  console.log(`\n## adopt --write: ${name} [${which}]\n  exit ${out.status}, written: ${written}${written ? `, version ${doc.version}, errors: ${errorsOf(doc).length}` : ""}`);
  console.log(lines(out));
  if (doc) for (const l of doc.loops) console.log(`  written loop ${l.id}: ${l.stops.map((s) => `${s.kind}${s.measure ? " " + s.measure : ""} ${s.n ?? s.limit ?? s.every ?? s.rounds ?? ""}${s.then ? " then " + s.then : ""}`).join(" | ")}`);
}
// ---- as a newer version of the template, placed as a subgrooph
const host = () => ({ grooph: 0, id: "host", name: "Host", version: 1, goal: "Plan, build, release.", target: { harness: "claude-code" },
  nodes: [{ id: "plan", kind: "agent", name: "Plan", role: "planner", brief: "Plan.", outputs: ["PLAN0.md"], allow: ["read-files", "write-outputs"] }, { id: "release", kind: "agent", name: "Release", role: "builder", brief: "Release.", outputs: ["REL.md"], allow: ["read-files", "write-outputs"] }, { id: "end", kind: "stop", name: "End", outcome: "success" }],
  edges: [{ id: "e-release-end", from: "release", to: "end" }], loops: [] });
const tpl = (id) => core.parseGraphText(readFileSync(join(R, "patterns", `${id}.grooph.json`), "utf8")).doc;
i = 0;
for (const [name, id, change] of CASES) {
  const t0 = tpl(id);
  const values = Object.fromEntries((t0.template.slots ?? []).map((s) => [s.key, s.example ?? "x"]));
  let placed;
  try { placed = core.placeSubgrooph(host(), t0, { as: "q", values, after: "plan", then: "release" }); } catch (e) { console.log(`\n## refresh ${name} [${id}]: cannot place: ${e.message.slice(0, 200)}`); continue; }
  const before = core.parseGraphText(core.canonicalize(placed.doc)).doc;
  const t = tpl(id); change(t); t.version = (t.version ?? 1) + 1;
  const dir = join(SCRATCH, "check-reader-3/sub", `c${++i}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, ".git"), { recursive: true });
  mkdirSync(join(dir, ".grooph/templates"), { recursive: true });
  writeFileSync(join(dir, ".grooph/templates", `${id}.grooph.json`), core.canonicalize(t));
  const file = join(dir, "host.grooph.json");
  writeFileSync(file, core.canonicalize(before));
  const out = spawnSync("node", [GROOPH, "sub", "update", "host.grooph.json", "--write"], { encoding: "utf8", cwd: dir, env });
  const now = core.parseGraphText(readFileSync(file, "utf8")).doc;
  const changed = core.canonicalize(now) !== core.canonicalize(before);
  console.log(`\n## sub update --write: ${name} [${id}]\n  placed valid: ${errorsOf(before).length === 0}; exit ${out.status}; file changed: ${changed}; valid: ${errorsOf(now).length === 0}`);
  console.log(lines(out));
  console.log("  before: " + before.loops.map((l) => `${l.id}: ${l.stops.map((s) => `${s.kind}${s.then ? ">" + s.then : ""}`).join("|")}`).join(" ; ") + "   pass edges: " + before.edges.filter((e) => e.from === "q-tests").map((e) => `${e.id}>${e.to}`).join(","));
  console.log("  now:    " + now.loops.map((l) => `${l.id}: ${l.stops.map((s) => `${s.kind}${s.then ? ">" + s.then : ""}`).join("|")}`).join(" ; "));
}

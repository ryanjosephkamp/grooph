// The third hole (a way round the check where a cap already leads on to what its pass led to) through the commands.
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { g, core, errorsOf, R, SCRATCH } from "./lib4.mjs";
const GROOPH = join(R, "packages/cli/bin/grooph.js");
const env = { ...process.env, GROOPH_HOME: join(SCRATCH, "check-reader-2/home"), GROOPH_REGISTRY: "http://127.0.0.1:9/none" };
const lines = (out) => (out.stdout + out.stderr).split("\n").filter(Boolean).map((l) => "  | " + l.slice(0, 260)).join("\n");
const stop = (w) => { w.nodes.push({ id: "done-too", kind: "stop", name: "Done too", outcome: "success" }); w.edges.push({ id: "e-builder-done-too", from: "builder", to: "done-too", when: { verdict: "good-enough" } }); };
const straight = (w) => { w.edges.push({ id: "e-builder-done", from: "builder", to: "done" }); };
let i = 0;
for (const [name, which, change] of [["C1 builder -> a new success stop on its own word", "retrospective-rewrite", stop], ["C2 builder -> done, always (the audit's third probe)", "retrospective-rewrite", straight], ["control: the same edge on grind-loop", "grind-loop", straight]]) {
  const dir = join(SCRATCH, "check-reader-2/cli", `c-adopt${++i}`); rmSync(dir, { recursive: true, force: true });
  const src = g(which); const run = join(dir, ".grooph", src.id, "runs", "20261005-130000"); mkdirSync(run, { recursive: true });
  writeFileSync(join(dir, ".grooph", src.id, "graph.grooph.json"), core.canonicalize(src));
  const w = structuredClone(src); change(w); writeFileSync(join(run, "graph.grooph.json"), core.canonicalize(w)); writeFileSync(join(run, "notes.jsonl"), "");
  const target = join(dir, "adopted.grooph.json");
  const out = spawnSync("node", [GROOPH, "adopt", run, "--write", "--into", target], { encoding: "utf8", cwd: dir, env });
  const written = existsSync(target);
  console.log(`\n## adopt: ${name} [${which}]\n  exit ${out.status}, written: ${written}${written ? `, version ${JSON.parse(readFileSync(target, "utf8")).version}, errors: ${errorsOf(core.parseGraphText(readFileSync(target, "utf8")).doc).length}` : ""}`);
  console.log(lines(out));
}
const host = () => ({ grooph: 0, id: "host", name: "Host", version: 1, goal: "Plan, build, release.", target: { harness: "claude-code" },
  nodes: [{ id: "plan", kind: "agent", name: "Plan", role: "planner", brief: "Plan.", outputs: ["PLAN0.md"], allow: ["read-files", "write-outputs"] }, { id: "release", kind: "agent", name: "Release", role: "builder", brief: "Release.", outputs: ["REL.md"], allow: ["read-files", "write-outputs"] }, { id: "end", kind: "stop", name: "End", outcome: "success" }],
  edges: [{ id: "e-release-end", from: "release", to: "end" }], loops: [] });
const tpl = (id) => core.parseGraphText(readFileSync(join(R, "patterns", `${id}.grooph.json`), "utf8")).doc;
i = 0;
for (const [name, id, change] of [["C1 as a newer version: builder -> a new success stop", "retrospective-rewrite", stop], ["C3 as a newer version: builder -> retro", "retrospective-rewrite", (t) => { t.edges.push({ id: "e-builder-retro", from: "builder", to: "retro" }); }]]) {
  const t0 = tpl(id); const values = Object.fromEntries((t0.template.slots ?? []).map((s) => [s.key, s.example ?? "x"]));
  const before = core.parseGraphText(core.canonicalize(core.placeSubgrooph(host(), t0, { as: "q", values, after: "plan", then: "release" }).doc)).doc;
  const t = tpl(id); change(t); t.version = (t.version ?? 1) + 1;
  const r = core.refreshSubgrooph(before, "q", t);
  console.log(`\n## refresh (core): ${name} [${id}]\n  placed valid: ${errorsOf(before).length === 0}; changes: ${r.changes.map((c) => c.name).join(", ")}\n  held: ${r.held.map((c) => `${c.name}: ${c.loosens ?? "waits " + c.waits}`).join(" | ").slice(0, 400) || "NONE"}; result valid: ${errorsOf(core.parseGraphText(core.canonicalize(r.doc)).doc).length === 0}`);
  const dir = join(SCRATCH, "check-reader-2/sub", `p${++i}`); rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, ".git"), { recursive: true }); mkdirSync(join(dir, ".grooph/templates"), { recursive: true });
  writeFileSync(join(dir, ".grooph/templates", `${id}.grooph.json`), core.canonicalize(t));
  const file = join(dir, "host.grooph.json"); writeFileSync(file, core.canonicalize(before));
  const out = spawnSync("node", [GROOPH, "sub", "update", "host.grooph.json", "--write"], { encoding: "utf8", cwd: dir, env });
  const now = core.parseGraphText(readFileSync(file, "utf8")).doc;
  console.log(`  command: exit ${out.status}; valid: ${errorsOf(now).length === 0}; edges from q-builder now: ${now.edges.filter((e) => e.from === "q-builder").map((e) => `${e.id}->${e.to}`).join(", ")}; stops: ${now.nodes.filter((n) => n.kind === "stop").map((n) => n.id + ":" + (n.outcome ?? "success")).join(", ")}`);
  console.log(lines(out));
}

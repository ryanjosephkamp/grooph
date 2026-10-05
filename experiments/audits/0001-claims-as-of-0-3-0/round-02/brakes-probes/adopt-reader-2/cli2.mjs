// The command: the husk through --write; --into naming the source / the working copy by other spellings.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, lstatSync, writeFileSync, symlinkSync, linkSync } from "node:fs";
import { join, relative } from "node:path";
import { R, SCRATCH, core, load, clone, E, L, N, agent, copyNode, errorsOf } from "./plib.mjs";
const bin = join(R, "packages/cli/bin/grooph.js");
const work = join(SCRATCH, "adopt-reader-2/cli2");
const sha = (p) => createHash("sha1").update(readFileSync(p)).digest("hex").slice(0, 10);
function project(name, source, change) {
  const dir = join(work, name); rmSync(dir, { recursive: true, force: true });
  const graphDir = join(dir, ".grooph", source.id); const run = join(graphDir, "runs", "r1");
  mkdirSync(run, { recursive: true });
  writeFileSync(join(graphDir, "graph.grooph.json"), core.canonicalize(source));
  const working = clone(source); change(working);
  writeFileSync(join(run, "graph.grooph.json"), core.canonicalize(working));
  writeFileSync(join(run, "notes.jsonl"), "");
  return { dir, run, src: join(graphDir, "graph.grooph.json"), wc: join(run, "graph.grooph.json"), target: join(dir, ".grooph", "graphs", `${source.id}.grooph.json`), source };
}
const grooph = (cwd, args) => { const r = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8" }); return { code: r.status, out: r.stdout, err: r.stderr }; };
const tail = (r, n = 3) => (r.out + r.err).trim().split("\n").slice(-n).map((l) => "      | " + l.slice(0, 230)).join("\n");

const wrap = load("fixtures/valid/wrap-up-after-the-cap.grooph.json");
const sub = load("fixtures/valid/subgrooph-in-a-graph.grooph.json");
const husk = (d) => {
  const f2 = copyNode(d, "fixer", "fixer2"), s2 = copyNode(d, "suite", "suite2");
  d.nodes = d.nodes.filter((n) => n.id !== "fixer"); d.nodes.push(agent("stub"), f2, s2);
  d.edges = d.edges.filter((e) => e.id !== "e-fix-suite");
  E(d, "e-suite-fail").to = "stub";
  d.edges.push({ id: "e-stub-suite", from: "stub", to: "suite" }, { id: "e-fix2-suite2", from: "fixer2", to: "suite2" }, { id: "e-suite2-fail", from: "suite2", to: "fixer2", when: "fail" }, { id: "e-suite2-pass", from: "suite2", to: "green", when: "pass" });
  L(d, "fix-cycle").members = ["stub", "suite"];
  d.loops.push({ id: "fix-cycle-2", name: "Fix cycle", members: ["fixer2", "suite2"], back: ["e-suite2-fail"], stops: [{ kind: "max-iterations", n: 1000 }] });
};
console.log("== 1. the husk through the command (source: fixtures/valid/wrap-up-after-the-cap, adaptation fixed)");
{ const p = project("husk", wrap, husk); const dry = grooph(p.dir, ["adopt", p.run]); const wet = grooph(p.dir, ["adopt", p.run, "--write"]);
  console.log(`  dry exit ${dry.code}; --write exit ${wet.code}; written ${existsSync(p.target)}`); console.log(tail(wet, 4));
  console.log("  lines naming a brake:", (wet.out.match(/^.*(loosens|tightens).*$/gm) ?? []).join(" || ").slice(0, 300) || "(none)");
  if (existsSync(p.target)) { const doc = core.parseGraphText(readFileSync(p.target, "utf8")).doc; console.log(`  written validates: errors ${errorsOf(doc).length}; version ${doc.version}; loops ${doc.loops.map((l) => `${l.id}[${l.members}] ${JSON.stringify(l.stops)}`).join(" ; ")}`); } }

const harmless = (w) => { N(w, "plan").brief += " Keep it short."; };
const raise = (w) => { L(w, "review-review").stops[1].n = 40; };
console.log("\n== 2. --into naming the source by other spellings (harmless working copy; the source must never be written)");
const spell = (label, mk, which = "src", change = harmless) => {
  const p = project("into-" + label.replace(/[^a-z0-9]+/gi, "-"), sub, change); const kept = p[which]; const before = sha(kept);
  let into, cwd = p.dir; try { ({ into, cwd = p.dir } = mk(p)); } catch (e) { console.log(`  ${label}: could not set up: ${e.message}`); return; }
  const r = grooph(cwd, ["adopt", p.run, "--write", "--into", into]);
  console.log(`  ${label}: exit ${r.code}; ${which === "src" ? "source" : "working copy"} ${sha(kept) === before ? "unchanged" : "OVERWRITTEN <<<<<<"}${lstatSync(kept).isSymbolicLink() ? " (now a symlink)" : ""}\n${tail(r, 1)}`);
};
spell("absolute", (p) => ({ into: p.src }));
spell("relative", (p) => ({ into: relative(p.dir, p.src) }));
spell("with ..", (p) => ({ into: join(p.dir, ".grooph", "graphs", "..", sub.id, "graph.grooph.json") }));
spell("relative from the run dir", (p) => ({ into: "../../graph.grooph.json", cwd: p.run }));
spell("symlink to the source", (p) => { const link = join(p.dir, "next.grooph.json"); symlinkSync(p.src, link); return { into: link }; });
spell("symlinked directory", (p) => { const link = join(p.dir, "alias"); symlinkSync(join(p.dir, ".grooph", sub.id), link); return { into: join(link, "graph.grooph.json") }; });
spell("hard link to the source", (p) => { const link = join(p.dir, "hard.grooph.json"); linkSync(p.src, link); return { into: link }; });
spell("another letter case (case-insensitive disk)", (p) => ({ into: join(p.dir, ".GROOPH", sub.id, "graph.grooph.json") }));
spell("another letter case in the file name", (p) => ({ into: join(p.dir, ".grooph", sub.id, "Graph.grooph.json") }));
console.log("\n== 3. --into naming the run's working copy by other spellings");
spell("wc absolute", (p) => ({ into: p.wc }), "wc");
spell("wc relative", (p) => ({ into: relative(p.dir, p.wc) }), "wc");
spell("wc symlink", (p) => { const link = join(p.dir, "next.grooph.json"); symlinkSync(p.wc, link); return { into: link }; }, "wc");
spell("wc another letter case", (p) => ({ into: join(p.dir, ".grooph", sub.id, "RUNS", "r1", "graph.grooph.json") }), "wc");
console.log("\n== 4. the same with a LOOSENED working copy and no --allow (nothing may be written anywhere)");
spell("loosened, symlink to the source", (p) => { const link = join(p.dir, "next.grooph.json"); symlinkSync(p.src, link); return { into: link }; }, "src", raise);
spell("loosened, wc symlink", (p) => { const link = join(p.dir, "next.grooph.json"); symlinkSync(p.wc, link); return { into: link }; }, "wc", raise);
console.log("\n== 5. headings when refused: one change loosens (cap 40), one tightens (budget 5), one does both? (acceptance reworded)");
{ const p = project("headings", sub, (w) => { raise(w); L(w, "review-review").stops[2].limit = 5; L(w, "review-review").bar.acceptance += " And the diff is small."; N(w, "release").irreversible = ["publish"]; });
  const before = readdirSync(join(p.dir, ".grooph")).join(",");
  const r = grooph(p.dir, ["adopt", p.run, "--write"]); console.log(`  exit ${r.code}; .grooph before [${before}] after [${readdirSync(join(p.dir, ".grooph")).join(",")}]`);
  console.log((r.out + r.err).split("\n").filter((l) => /loosens|tightens|^  (loop|node|edge|graph)|not written/.test(l)).map((l) => "      | " + l.slice(0, 250)).join("\n"));
  const r2 = grooph(p.dir, ["adopt", p.run, "--write", "--allow", "loop:review-review.stops"]); console.log(`  with --allow loop:review-review.stops only: exit ${r2.code}`); console.log(tail(r2, 1));
  const r3 = grooph(p.dir, ["adopt", p.run, "--write", "--allow", "loop:review-review.stops", "--allow", "loop:review-review.bar"]); console.log(`  with both allows: exit ${r3.code}; written ${existsSync(p.target)}`);
  console.log((r3.out + r3.err).split("\n").filter((l) => /loosens|tightens|^  (loop|node|edge|graph)|wrote/.test(l)).map((l) => "      | " + l.slice(0, 250)).join("\n")); }

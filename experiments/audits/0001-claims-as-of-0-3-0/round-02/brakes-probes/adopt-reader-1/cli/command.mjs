/**
 * The command's own paths: --into, twice, "already holds", "moved on", the dry run. node R/probe/cli/command.mjs
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, cpSync, rmSync } from "node:fs";
import { join } from "node:path";
import { R, SCRATCH, core, load, clone, E, L, N } from "../lib.mjs";
import { project, grooph } from "./cases.mjs";

const base = load("fixtures/valid/subgrooph-in-a-graph.grooph.json");
const loop = (d) => L(d, "review-review");
const files = (dir) => { const out = {}; const walk = (p) => { for (const name of readdirSync(p).sort()) { const full = join(p, name); if (statSync(full).isDirectory()) walk(full); else out[full.slice(dir.length + 1)] = createHash("sha1").update(readFileSync(full)).digest("hex").slice(0, 8); } }; walk(dir); return out; };
const diff = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).map((k) => `${a[k] === undefined ? "created" : b[k] === undefined ? "deleted" : "changed"} ${k}`);
const last = (r) => ((r.out + r.err).trim().split("\n").at(-1) ?? "").slice(0, 260);
const step = (p, label, args) => { const before = files(p.dir); const r = grooph(p.dir, ["adopt", p.run, ...args]); console.log(`  ${label}: exit ${r.code}; files: ${diff(before, files(p.dir)).join(", ") || "none touched"}\n      ${last(r)}`); return r; };
const raise = (w) => { loop(w).stops[1].n = 40; };
const harmless = (w) => { N(w, "plan").brief += " Keep it short."; };

console.log("\n== A. --into the source file itself, a harmless working copy");
{ const p = project("cmd-a", base, harmless); const src = join(p.dir, ".grooph", base.id, "graph.grooph.json"); step(p, "--write --into <source>", ["--write", "--into", src]); console.log(`      source file now version ${core.parseGraphText(readFileSync(src, "utf8")).doc.version}`); }

console.log("\n== B. --into the source file, a loosened working copy, no allow");
{ const p = project("cmd-b", base, raise); const src = join(p.dir, ".grooph", base.id, "graph.grooph.json"); step(p, "--write --into <source>", ["--write", "--into", src]); }

console.log("\n== C. --into the working copy file itself (inside the run), loosened");
{ const p = project("cmd-c", base, raise); step(p, "--write --into <run>/graph.grooph.json", ["--write", "--into", join(p.run, "graph.grooph.json")]); }

console.log("\n== D. --into a fresh path inside the run folder, loosened, then harmless");
{ const p = project("cmd-d", base, raise); step(p, "--write --into <run>/next.grooph.json", ["--write", "--into", join(p.run, "next.grooph.json")]); }

console.log("\n== E. twice: refused, refused; then allowed; then again with and without allow");
{ const p = project("cmd-e", base, raise);
  step(p, "1 --write", ["--write"]); step(p, "2 --write", ["--write"]);
  step(p, "3 --write --allow", ["--write", "--allow", "loop:review-review.stops"]);
  step(p, "4 --write (no allow, target already holds it)", ["--write"]);
  step(p, "5 dry (no allow)", []); }

console.log("\n== F. a refused adoption made to look done: the target already holds what adoption would write (written by other hands)");
{ const p = project("cmd-f", base, raise);
  const adopted = core.adoptWorkingCopy(p.source, core.parseGraphText(readFileSync(join(p.run, "graph.grooph.json"), "utf8")).doc, { run: "r1" });
  mkdirSync(join(p.dir, ".grooph", "graphs"), { recursive: true }); writeFileSync(p.target, core.canonicalize(adopted.doc));
  const r = step(p, "--write, no allow", ["--write"]);
  console.log("      full output:\n" + (r.out + r.err).split("\n").filter((l) => /loosens|already|refused|not written|^  loop/.test(l)).map((l) => "        | " + l.slice(0, 200)).join("\n")); }

console.log("\n== G. the source moved on (source is version 2, the run worked on 1), loosened");
{ const p = project("cmd-g", base, raise); const src = join(p.dir, ".grooph", base.id, "graph.grooph.json"); const s2 = clone(base); s2.version = 2; writeFileSync(src, core.canonicalize(s2)); step(p, "--write", ["--write"]); step(p, "--write --allow", ["--write", "--allow", "loop:review-review.stops"]); }

console.log("\n== H. the working copy claims another id and a version far ahead, loosened");
{ const p = project("cmd-h", base, (w) => { raise(w); w.id = "other-graph"; w.version = 99; }); step(p, "--write", ["--write"]); }
{ const p = project("cmd-h2", base, (w) => { raise(w); w.id = "other-graph"; w.name = "Other"; }); step(p, "--write (other id, same version)", ["--write"]); console.log(`      wrote other-graph file? ${existsSync(join(p.dir, ".grooph/graphs/other-graph.grooph.json"))}`); }

console.log("\n== I. the target holds another graph; then a file that is no graph");
{ const p = project("cmd-i", base, harmless); mkdirSync(join(p.dir, ".grooph", "graphs"), { recursive: true }); writeFileSync(p.target, core.canonicalize(load("fixtures/valid/review-loop.grooph.json"))); step(p, "--write", ["--write"]); writeFileSync(p.target, "not json"); step(p, "--write", ["--write"]); }

console.log("\n== J. dry run vs --write report: the same lines but the last?");
{ const p = project("cmd-j", base, (w) => { raise(w); loop(w).stops[2].limit = 5; N(w, "review-merge-gate").options = ["approve"]; });
  const dry = grooph(p.dir, ["adopt", p.run]); const wet = grooph(p.dir, ["adopt", p.run, "--write"]);
  const a = dry.out.trim().split("\n"), b = wet.out.trim().split("\n");
  console.log(`  stdout lines equal except the last: ${JSON.stringify(a.slice(0, -1)) === JSON.stringify(b) || JSON.stringify(a.slice(0, -1)) === JSON.stringify(b.slice(0, -1))}; dry exit ${dry.code}, write exit ${wet.code}`);
  console.log(`  dry last: ${a.at(-1).slice(0, 120)}\n  write stderr: ${wet.err.trim().slice(0, 160)}`); }

console.log("\n== K. the real run folder from fixtures (probe/demo copy): cap 5 -> 50 by hand, as the audit did");
{ const dir = join(SCRATCH, "adopt-reader-1/cli/cmd-k"); rmSync(dir, { recursive: true, force: true }); cpSync(join(R, "fixtures/runs/slice-0007-sandwich"), join(dir, ".grooph/slice-0007-sandwich"), { recursive: true });
  const run = join(dir, ".grooph/slice-0007-sandwich/runs/20260919-0057-66c8"); const path = join(run, "graph.grooph.json");
  const w = core.parseGraphText(readFileSync(path, "utf8")).doc; const l = w.loops[0];
  console.log("  loop", l.id, JSON.stringify(l.stops), "members", l.members.join(","), "back", l.back.join(","));
  const r0 = grooph(dir, ["adopt", run, "--write", "--into", join(dir, "probe-out.json")]); console.log(`  as recorded: exit ${r0.code}: ${last(r0)}`); }

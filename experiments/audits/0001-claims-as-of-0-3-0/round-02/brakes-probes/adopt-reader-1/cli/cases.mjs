/**
 * The holes, through the command itself. node R/probe/cli/cases.mjs [--verbose]
 * Each case: a project folder under R/probe/cli/work/<case>/ with the source at .grooph/<id>/graph.grooph.json and a
 * working copy at .grooph/<id>/runs/r1/graph.grooph.json; then `grooph adopt <run>` (dry) and `grooph adopt <run> --write`.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { R, SCRATCH, core, load, clone, E, L, N, agent, errorsOf } from "../lib.mjs";
import { roundsLoosened, personLoosened } from "../fuzz/oracle.mjs";

const verbose = process.argv.includes("--verbose");
const bin = join(R, "packages/cli/bin/grooph.js");
const work = join(SCRATCH, "adopt-reader-1/cli");
const base = load("fixtures/valid/subgrooph-in-a-graph.grooph.json");
const loop = (d) => L(d, "review-review");

const tree = (dir) => { const h = createHash("sha1"); const walk = (p) => { for (const name of readdirSync(p).sort()) { const full = join(p, name); if (statSync(full).isDirectory()) walk(full); else h.update(full).update(readFileSync(full)); } }; walk(dir); return h.digest("hex"); };
export function project(name, source, change) {
  const dir = join(work, name); rmSync(dir, { recursive: true, force: true });
  const graphDir = join(dir, ".grooph", source.id); const run = join(graphDir, "runs", "r1");
  mkdirSync(run, { recursive: true });
  writeFileSync(join(graphDir, "graph.grooph.json"), core.canonicalize(source));
  const working = clone(source); change(working);
  writeFileSync(join(run, "graph.grooph.json"), core.canonicalize(working));
  writeFileSync(join(run, "notes.jsonl"), "");
  return { dir, run, target: join(dir, ".grooph", "graphs", `${source.id}.grooph.json`), source, working };
}
export const grooph = (cwd, args) => { const r = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8" }); return { code: r.status, out: r.stdout, err: r.stderr }; };

function show(name, source, change, extra = []) {
  const p = project(name, source, change);
  const before = tree(p.dir);
  const dry = grooph(p.dir, ["adopt", p.run, ...extra]);
  const dryWrote = tree(p.dir) !== before;
  const wet = grooph(p.dir, ["adopt", p.run, "--write", ...extra]);
  const written = existsSync(p.target);
  const doc = written ? core.parseGraphText(readFileSync(p.target, "utf8")).doc : undefined;
  console.log(`\n=== ${name}`);
  console.log(`  dry run: exit ${dry.code}${dryWrote ? "  !!! THE DRY RUN CHANGED A FILE" : ", nothing written"}; says: ${(dry.out.trim().split("\n").at(-1) ?? "").slice(0, 150)}`);
  console.log(`  --write${extra.length ? " " + extra.join(" ") : ""}: exit ${wet.code}; target written: ${written}${written ? ` (version ${doc.version}, export errors: ${errorsOf(doc).length}, compiles: ${(() => { try { core.compile(doc, "claude-code"); return "yes"; } catch (e) { return "NO " + e.message; } })()})` : ""}`);
  const lines = (wet.out + wet.err).split("\n").filter((l) => /loosens|tightens|^  \S+:\S+\s|not written|wrote |no change named|already holds/.test(l));
  for (const l of lines) console.log(`    | ${l.slice(0, 230)}`);
  if (written) console.log(`  my oracle on source -> written: rounds ${JSON.stringify(roundsLoosened(source, doc))}; people ${JSON.stringify(personLoosened(source, doc).slice(0, 5))}`);
  if (verbose) console.log(wet.out, wet.err);
  return { p, dry, wet, written };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  show("00-control-cap-raised", base, (w) => { loop(w).stops[1].n = 40; });

  show("01-outer-loop", base, (w) => {
    w.edges.push({ id: "e-replan", from: "review-critic", to: "plan", when: { verdict: "replan" } });
    w.loops.push({ id: "replan", name: "Replan", members: ["plan", "review-builder", "review-critic", "review-merge-gate"], back: ["e-replan"], mode: "judgment", bar: clone(loop(w).bar), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 1000 }] });
  });

  show("02-second-way-round-through-a-new-step", base, (w) => {
    w.nodes.push(agent("fixer"));
    w.edges.push({ id: "e-critic-fixer", from: "review-critic", to: "fixer", when: { verdict: "revise" } }, { id: "e-fixer-builder", from: "fixer", to: "review-builder", evidence: ["REVIEW.md"] });
    w.loops.push({ id: "revise", name: "Revise", members: ["review-builder", "review-critic", "fixer"], back: ["e-fixer-builder"], mode: "judgment", bar: clone(loop(w).bar), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 1000 }] });
  });

  show("03-earlier-stop-leads-on-budget-minutes-0", base, (w) => { loop(w).stops.splice(1, 0, { kind: "budget", measure: "minutes", limit: 0, then: "review-builder" }); });
  show("03b-earlier-stop-leads-on-diminishing-returns (an 'other stop': stated limit, same effect)", base, (w) => { loop(w).stops.splice(1, 0, { kind: "diminishing-returns", rounds: 1, then: "review-builder" }); });

  const approved = clone(base); E(approved, "review-e-critic-fail").approval = true;
  show("04-approval-twin", approved, (w) => { w.edges.push({ id: "e-critic-fail-again", from: "review-critic", to: "review-builder", when: "fail", evidence: ["REVIEW.md"] }); loop(w).back.push("e-critic-fail-again"); });

  const twoCaps = clone(base); twoCaps.nodes.push(agent("wrap-up")); loop(twoCaps).stops.splice(1, 0, { kind: "max-iterations", n: 3, then: "wrap-up" });
  show("05-two-caps-the-leading-one-leads-back-in", twoCaps, (w) => { loop(w).stops[1].then = "review-builder"; });

  show("06-second-cap-of-the-same-n-leads-on-before-the-one-that-halts", base, (w) => { loop(w).stops.splice(1, 0, { kind: "max-iterations", n: 4, then: "review-builder" }); });

  const gated = clone(base); E(gated, "review-e-critic-fail").to = "review-merge-gate"; delete E(gated, "review-e-critic-fail").evidence; loop(gated).back = ["review-e-merge-gate-reject"];
  show("07-gate-on-every-return-and-a-new-edge-round-it", gated, (w) => { w.edges.push({ id: "e-critic-minor", from: "review-critic", to: "review-builder", when: { verdict: "minor" }, evidence: ["REVIEW.md"] }); loop(w).back.push("e-critic-minor"); });

  const three = clone(base);
  three.nodes.push({ id: "review-tests", kind: "check", name: "Tests", check: { kind: "tests", run: "pnpm test", pass: "exit 0" } });
  E(three, "e-review-builder-review-critic").from = "review-tests"; three.edges.push({ id: "e-builder-tests", from: "review-builder", to: "review-tests" });
  loop(three).members = ["review-builder", "review-tests", "review-critic", "review-merge-gate"]; loop(three).stops = [{ kind: "bar-passed" }, { kind: "max-iterations", n: 6 }, { kind: "budget", measure: "dispatches", limit: 9 }]; three.groups[0].members.push("review-tests");
  show("08-a-dispatched-step-taken-out-of-the-loops-members", three, (w) => { loop(w).members = ["review-builder", "review-critic", "review-merge-gate"]; w.edges.push({ id: "e-builder-critic-direct", from: "review-builder", to: "review-critic", when: { verdict: "never" }, evidence: ["diff of the change"] }); });

  // the lesser questions
  const twoLosses = (w) => { loop(w).stops[1].n = 40; N(w, "review-merge-gate").options = ["approve"]; };
  show("10-allow-one-of-two", base, twoLosses, ["--allow", "loop:review-review.stops"]);
  show("11-allow-a-tightening-and-a-neutral-name-only", base, (w) => { loop(w).stops[1].n = 40; loop(w).stops[2].limit = 5; N(w, "plan").brief += " More."; }, ["--allow", "node:plan.brief"]);
  show("12-allow-unknown-with-known", base, twoLosses, ["--allow", "loop:review-review.stops", "--allow", "node:review-merge-gate.options", "--allow", "node:nobody"]);
  show("13-allow-both", base, twoLosses, ["--allow", "loop:review-review.stops", "--allow", "node:review-merge-gate.options"]);
  show("14-allow-odd-names", base, twoLosses, ["--allow", "loop:review-review.stops; node:review-merge-gate.options", "--allow", "*", "--allow", ""]);
  show("15-allow-covers-everything-in-the-field (cap 4->5 meant; budget removed rides on the same name)", base, (w) => { loop(w).stops[1].n = 5; loop(w).stops.splice(2, 1); }, ["--allow", "loop:review-review.stops"]);
  show("16-weaker-acceptance (report says both)", base, (w) => { loop(w).bar.acceptance = "Looks fine."; });
  show("17-mixed-tighten-and-loosen", base, (w) => { loop(w).stops[1].n = 2; loop(w).stops[2].limit = 400; });
}

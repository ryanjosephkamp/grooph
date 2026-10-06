// The driver's reader of the check kind (#132), its rename case, through the command on the kept grind-loop record.
// A check given another id is held as a removal, under the old id's name. Allowed, that one name carries whatever
// was done to the check on the way, and every way round it: the check is no longer one the comparison can follow.
// This prints what the person is told before allowing it, and what is written once they do.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { R, SCRATCH, core, errorsOf } from "../adopt-reader-1/lib.mjs";
const rec = join(R, "experiments/patterns/grind-loop/run");
const GROOPH = join(R, "packages/cli/bin/grooph.js");
const rename = (w) => {
  const check = w.nodes.find((n) => n.id === "tests");
  check.id = "test-suite";
  for (const e of w.edges) { if (e.from === "tests") e.from = "test-suite"; if (e.to === "tests") e.to = "test-suite"; }
  for (const l of w.loops) l.members = l.members.map((m) => (m === "tests" ? "test-suite" : m));
  return check;
};
const cases = {
  "the check under another id, nothing else": (w) => void rename(w),
  "under another id, with its command made true and an edge from the builder straight to the end": (w) => {
    rename(w).check.run = "true";
    w.edges.push({ id: "e-builder-done", from: "builder", to: "done" });
  },
  "under another id, and everything a reader could think of beside it": (w) => {
    const check = rename(w);
    check.check = { ...check.check, run: "true", pass: "any exit code" };
    w.edges.push({ id: "e-builder-done", from: "builder", to: "done" }, { id: "e-suite-done-too", from: "test-suite", to: "done", when: { verdict: "close-enough" } });
    const fail = w.edges.find((e) => e.id === "e-tests-fail");
    fail.evidence = ["a note that the build went well"];
    w.edges.find((e) => e.id === "e-tests-pass").when = "always";
    const loop = w.loops[0];
    loop.bar = { name: "Builder says so", inspects: [{ kind: "file", ref: "CHANGES.md" }], acceptance: "CHANGES.md says the change is made." };
    loop.stops.unshift({ kind: "bar-passed" }, { kind: "budget", measure: "dispatches", limit: 1, then: "done" });
  },
};
let i = 0;
for (const [name, change] of Object.entries(cases)) {
  const dir = join(SCRATCH, "check-reader-4/rename", `c${++i}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, ".grooph/g"), { recursive: true });
  cpSync(join(rec, "package/graph.grooph.json"), join(dir, ".grooph/g/graph.grooph.json"));
  cpSync(join(rec, "runs"), join(dir, ".grooph/g/runs"), { recursive: true });
  const run = join(dir, ".grooph/g/runs", readdirSync(join(dir, ".grooph/g/runs"))[0]);
  const f = join(run, "graph.grooph.json");
  const w = JSON.parse(readFileSync(f, "utf8")); change(w); writeFileSync(f, JSON.stringify(w, null, 2));
  const target = join(dir, "adopted.grooph.json");
  console.log(`\n## ${name}`);
  for (const allow of [[], ["node:tests"]]) {
    rmSync(target, { force: true });
    const out = spawnSync("node", [GROOPH, "adopt", run, "--write", "--into", target, ...allow.flatMap((a) => ["--allow", a])], { encoding: "utf8", cwd: dir });
    const written = existsSync(target);
    const doc = written ? core.parseGraphText(readFileSync(target, "utf8")).doc : undefined;
    console.log(`  ${allow.length ? "--allow node:tests" : "no --allow"}: exit ${out.status}, written: ${written}${doc ? `, version ${doc.version}, errors ${errorsOf(doc).length}` : ""}`);
    const lines = (out.stdout + out.stderr).split("\n").filter((l) => /loosens a brake|tightens a brake|not judged|^  (node|edge|loop):|not written|asked for by name|^note:/.test(l));
    console.log(lines.map((l) => "    | " + l.slice(0, 420)).join("\n"));
    if (doc) {
      const check = doc.nodes.find((n) => n.kind === "check");
      console.log(`    written: the check is "${check.id}", runs ${JSON.stringify(check.check.run)}, passes on ${JSON.stringify(check.check.pass)}; edges to "done": ${doc.edges.filter((e) => e.to === "done").map((e) => `${e.from} (${typeof e.when === "object" ? e.when.verdict : (e.when ?? "always")})`).join(", ")}; stops: ${doc.loops[0].stops.map((s) => s.kind + (s.then ? ` then ${s.then}` : "")).join(", ")}; bar: ${doc.loops[0].bar ? JSON.stringify(doc.loops[0].bar.acceptance) : "none"}`);
    }
  }
}

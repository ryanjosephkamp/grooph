import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { R, SCRATCH, core, errorsOf } from "../adopt-reader-1/lib.mjs";
const rec = join(R, "experiments/patterns/grind-loop/run");
const cases = {
  "A fail ends in success, pass needs approval": (w) => { w.nodes.push({ id: "zz-done", kind: "stop", name: "Done too", outcome: "success" }); Object.assign(w.edges.find((e) => e.id === "e-tests-pass"), { when: "fail", to: "zz-done" }); w.edges.push({ id: "zz-pass", from: "tests", to: "done", when: "pass", approval: true }); },
  "A3 fail with approval to a new success stop": (w) => { w.nodes.push({ id: "zz-done", kind: "stop", name: "Done too", outcome: "success" }); w.edges.push({ id: "zz-fail", from: "tests", to: "zz-done", when: "fail", approval: true }); },
  "B a bar of the builder's word, bar-passed then done": (w) => { const l = w.loops[0]; l.bar = { name: "Builder says so", inspects: [{ kind: "file", ref: "CHANGES.md" }], acceptance: "CHANGES.md says the change is made." }; l.stops.unshift({ kind: "bar-passed", then: "done" }); },
  "control: check made true": (w) => { w.nodes.find((n) => n.kind === "check").check.run = "true"; },
};
let i = 0;
for (const [name, change] of Object.entries(cases)) {
  const dir = join(SCRATCH, "check-reader-1/cli", `c${++i}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, ".grooph/g"), { recursive: true });
  cpSync(join(rec, "package/graph.grooph.json"), join(dir, ".grooph/g/graph.grooph.json"));
  cpSync(join(rec, "runs"), join(dir, ".grooph/g/runs"), { recursive: true });
  const run = join(dir, ".grooph/g/runs", readdirSync(join(dir, ".grooph/g/runs"))[0]);
  const f = join(run, "graph.grooph.json");
  const w = JSON.parse(readFileSync(f, "utf8")); change(w); writeFileSync(f, JSON.stringify(w, null, 2));
  const target = join(dir, "adopted.grooph.json");
  const out = spawnSync("node", [join(R, "packages/cli/bin/grooph.js"), "adopt", run, "--write", "--into", target], { encoding: "utf8", cwd: dir });
  const written = existsSync(target);
  console.log(`\n## ${name}\n  exit ${out.status}, written: ${written}${written ? `, version ${JSON.parse(readFileSync(target, "utf8")).version}, errors: ${errorsOf(core.parseGraphText(readFileSync(target, "utf8")).doc).length}` : ""}`);
  console.log((out.stdout + out.stderr).split("\n").filter(Boolean).map((l) => "  | " + l.slice(0, 260)).join("\n"));
}

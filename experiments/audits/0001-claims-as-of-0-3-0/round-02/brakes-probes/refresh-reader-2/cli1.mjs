// The CLI, in a temp folder inside this copy. Templates come from the project folder or the built-in library only.
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { root, host, tpl, newer, agent, canonicalize, parseGraphText, validate } from "./h2.mjs";
const base = join(tmpdir(), "grooph-brakes-probes", "refresh-reader-2-cli");
const bin = join(root, "packages/cli/bin/grooph.js");
export function box(name) {
  const dir = join(base, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "work", ".git"), { recursive: true });
  mkdirSync(join(dir, "work", ".grooph", "templates"), { recursive: true });
  mkdirSync(join(dir, "home"), { recursive: true });
  const file = join(dir, "work", "plan.grooph.json");
  writeFileSync(file, canonicalize(host()));
  const env = { ...process.env, GROOPH_HOME: join(dir, "home"), GROOPH_REGISTRY: "http://127.0.0.1:9/unreachable/index.json" };
  const grooph = (...argv) => { const r = spawnSync(process.execPath, [bin, ...argv], { cwd: join(dir, "work"), env, encoding: "utf8" }); return { code: r.status, out: r.stdout, err: r.stderr }; };
  const put = (t) => writeFileSync(join(dir, "work", ".grooph", "templates", `${t.id}.grooph.json`), canonicalize(t));
  const read = () => parseGraphText(readFileSync(file, "utf8")).doc;
  const hash = () => createHash("sha1").update(readFileSync(file)).digest("hex").slice(0, 10);
  const errors = () => validate(read()).filter((i) => i.severity === "error").map((i) => i.code);
  return { dir, file, grooph, put, read, hash, errors };
}
export const say = (title, r) => console.log(`\n--- ${title}\nexit ${r.code}\n${r.out.trimEnd()}${r.err.trim() ? `\n[stderr] ${r.err.trimEnd()}` : ""}`);
export const ADD = ["sub", "add", "review-gate", "--into", "plan.grooph.json", "--as", "review", "--after", "plan", "--then", "release", "--set", "task=the checkout flow", "--set", "test-command=pnpm test", "--set", "checklist=docs/checklist.md", "--write"];

if (process.argv[1].endsWith("cli1.mjs")) {
  // C1: the reject answer made to lead on (H1), through the CLI
  const b = box("h1");
  say("add", b.grooph(...ADD));
  b.put(newer((t) => { t.edges = t.edges.filter((e) => e.id !== "e-merge-gate-reject"); t.edges.push({ id: "e-merge-gate-done-anyway", from: "merge-gate", to: "done", when: "fail" }); t.loops[0].back = ["e-critic-fail"]; }));
  const h0 = b.hash();
  say("update --write (v2: reject leads on)", b.grooph("sub", "update", "plan.grooph.json", "--write"));
  console.log("file changed:", h0 !== b.hash(), "| out of the gate now:", b.read().edges.filter((e) => e.from === "review-merge-gate").map((e) => `${JSON.stringify(e.when)} -> ${e.to}`), "| errors:", b.errors());

  // C2: the cycle moved out from under its cap (H4b), through the CLI
  const c = box("h4");
  c.grooph(...ADD);
  c.put(newer((t) => {
    t.nodes.push({ id: "lint", kind: "check", name: "Lint", check: { kind: "command", run: "pnpm lint", pass: "exit 0" } }, { id: "fmt", kind: "check", name: "Format", check: { kind: "command", run: "pnpm fmt", pass: "exit 0" } });
    t.edges.push({ id: "e-builder-lint", from: "builder", to: "lint" }, { id: "e-lint-fmt", from: "lint", to: "fmt" }, { id: "e-fmt-lint", from: "fmt", to: "lint", when: "fail" });
    t.loops[0].members = ["lint", "fmt"]; t.loops[0].back = ["e-fmt-lint"];
    t.loops.push({ id: "work", name: "Work", members: ["builder", "critic", "merge-gate"], back: ["e-critic-fail", "e-merge-gate-reject"], mode: "judgment", bar: { name: "Looks fine", inspects: [{ kind: "artifact", ref: "REVIEW.md" }], acceptance: "The critic has no strong objection." }, stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 500 }, { kind: "budget", measure: "dispatches", limit: 5000 }] });
  }));
  say("update --write (v2: the cycle under a new loop, cap 500)", c.grooph("sub", "update", "plan.grooph.json", "--write"));
  console.log("loops now:", c.read().loops.map((l) => `${l.id}: ${l.members} | ${JSON.stringify(l.stops)}`), "| errors:", c.errors());
}

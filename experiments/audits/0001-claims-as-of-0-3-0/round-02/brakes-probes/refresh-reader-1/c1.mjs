import { tmpdir } from "node:os";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../../../../../../packages/cli/dist/src/index.js";
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../../../../..");
const ADD = ["--as", "review", "--after", "plan", "--then", "release", "--set", "task=the checkout flow", "--set", "test-command=pnpm test", "--set", "checklist=docs/checklist.md"];
export function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "grooph-brakes-probes-box-"));
  mkdirSync(join(dir, "work", ".git"), { recursive: true });
  const fixture = JSON.parse(readFileSync(join(root, "fixtures/valid/subgrooph-in-a-graph.grooph.json"), "utf8"));
  const own = (id) => !id.startsWith("review-");
  const { policies, groups, ...rest } = fixture;
  const host = { ...rest, nodes: fixture.nodes.filter((n) => own(n.id)), edges: fixture.edges.filter((e) => own(e.from) && own(e.to)), loops: [] };
  const file = join(dir, "work", "plan.grooph.json");
  writeFileSync(file, JSON.stringify(host, null, 2) + "\n");
  const env = { cwd: join(dir, "work"), userDir: join(dir, "home", "templates"), defaultRegistry: "http://127.0.0.1:9/unreachable/index.json" };
  const project = join(dir, "work", ".grooph", "templates");
  return {
    dir, file, project,
    grooph: async (...argv) => { const out = [], err = []; const code = await run(argv, { out: (t) => out.push(t), err: (t) => err.push(t) }, () => "", env); return { code, out: out.join("\n"), err: err.join("\n") }; },
    read: () => JSON.parse(readFileSync(file, "utf8")),
    raw: () => readFileSync(file, "utf8"),
    write: (doc) => writeFileSync(file, JSON.stringify(doc, null, 2) + "\n"),
    newer: (change, version = 2) => { const t = JSON.parse(readFileSync(join(root, "patterns/review-gate.grooph.json"), "utf8")); change(t); t.version = version; mkdirSync(project, { recursive: true }); writeFileSync(join(project, "review-gate.grooph.json"), JSON.stringify(t, null, 2) + "\n"); },
    done: () => rmSync(dir, { recursive: true, force: true }),
  };
}
export { ADD };
const p = (label, r) => console.log(`--- ${label}\nexit ${r.code}\n${r.out}${r.err ? "\n[stderr] " + r.err : ""}`);

// C1: --allow with a name that matches nothing, with --write
{
  const b = sandbox(); await b.grooph("sub", "add", "review-gate", "--into", b.file, ...ADD, "--write");
  b.newer((t) => { t.loops[0].stops[1].n = 8; t.nodes[0].brief += " X."; });
  const before = b.raw();
  const r = await b.grooph("sub", "update", b.file, "--allow", "loop:review-review.stop", "--write");
  p("C1 --allow of an unknown name, --write", r); console.log("file changed:", b.raw() !== before); b.done();
}
// C2: validation error after update, --write
{
  const b = sandbox(); await b.grooph("sub", "add", "review-gate", "--into", b.file, ...ADD, "--write");
  b.newer((t) => { t.nodes.push({ id: "deploy", kind: "agent", name: "Deploy", role: "builder", brief: "Deploy it.", outputs: ["DEPLOY.md"], allow: ["run-commands", "write-outputs"], irreversible: ["publish"] }); t.edges.push({ id: "e-builder-deploy", from: "builder", to: "deploy" }); });
  const before = b.raw();
  const r = await b.grooph("sub", "update", b.file, "--write");
  p("C2 update leaves E_IRREVERSIBLE_NO_GATE, --write", r); console.log("file changed:", b.raw() !== before); b.done();
}
// C3: schema failure
{
  const b = sandbox(); await b.grooph("sub", "add", "review-gate", "--into", b.file, ...ADD, "--write");
  b.newer((t) => { t.loops[0].stops = []; });
  const before = b.raw();
  const r = await b.grooph("sub", "update", b.file, "--write");
  p("C3 update fails the schema (no stops), --write", r); console.log("file changed:", b.raw() !== before); b.done();
}
// C4: two subgroophs with a shared change name; --allow once
{
  const b = sandbox();
  let r = await b.grooph("sub", "add", "review-gate", "--into", b.file, "--as", "review-two", "--after", "plan", "--then", "release", "--set", "task=a", "--set", "test-command=pnpm test", "--set", "checklist=c.md", "--write");
  r = await b.grooph("sub", "add", "review-gate", "--into", b.file, "--as", "review", "--after", "release", "--then", "done", "--set", "task=b", "--set", "test-command=pnpm test", "--set", "checklist=c.md", "--write");
  console.log("policies:", b.read().policies.map((x) => x.id));
  r = await b.grooph("sub", "update", b.file);
  p("C4a two subgroophs 'review' and 'review-two', SAME template version, dry run", r);
  b.newer((t) => { t.policies = []; });
  r = await b.grooph("sub", "update", b.file);
  p("C4b v2 drops both policies, dry run", r);
  r = await b.grooph("sub", "update", b.file, "review", "--allow", "policy:review-two-p-critic-isolation", "--write");
  p("C4c update ONLY 'review', allowing review-two's policy by name, --write", r);
  console.log("policies after:", (b.read().policies ?? []).map((x) => x.id), "| groups:", b.read().groups.map((g) => `${g.id}:${g.from}`));
  b.done();
}
// C5: nothing applied but held: is anything written? and the from version
{
  const b = sandbox(); await b.grooph("sub", "add", "review-gate", "--into", b.file, ...ADD, "--write");
  b.newer((t) => { t.loops[0].stops[1].n = 8; });
  const r = await b.grooph("sub", "update", b.file, "--write");
  p("C5 only a held change, --write", r); console.log("from:", b.read().groups[0].from);
  const r2 = await b.grooph("sub", "update", b.file);
  p("C5 again", r2);
  b.done();
}

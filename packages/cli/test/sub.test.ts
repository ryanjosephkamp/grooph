/**
 * `grooph sub add | list | update | extract` (amendment A-018, decision 0025; docs/templates.md §4).
 *
 * Each test gets a working tree, a user folder and a default registry nobody answers at, so a template is found
 * in the project or in the built-in library and nowhere else.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, type TestContext } from "node:test";

import { run } from "../src/index.js";
import type { Output } from "../src/print.js";
import type { RegistryEnv } from "../src/registry.js";

const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("workspace root not found");
})();

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t) };
};

type Doc = {
  version: number;
  nodes: { id: string; brief?: string; name?: string }[];
  edges: { id: string; from: string; to: string }[];
  loops: { id: string; stops: { kind: string; n?: number }[] }[];
  groups?: { id: string; name: string; members: string[]; from?: string; with?: Record<string, string> }[];
  template?: unknown;
};

type Box = { file: string; project: string; env: Partial<RegistryEnv>; grooph: (...argv: string[]) => Promise<{ code: number; out: string; err: string }>; read: () => Doc };

/** A working tree holding the graph the fixture's review gate was placed in: a planner, a release step and a stop. */
function sandbox(t: TestContext): Box {
  const dir = mkdtempSync(join(tmpdir(), "grooph-sub-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "work", ".git"), { recursive: true });
  const fixture = JSON.parse(readFileSync(join(repoRoot, "fixtures/valid/subgrooph-in-a-graph.grooph.json"), "utf8")) as Doc & Record<string, unknown>;
  const own = (id: string): boolean => !id.startsWith("review-");
  const { policies: _policies, groups: _groups, ...rest } = fixture;
  const host = { ...rest, nodes: fixture.nodes.filter((node) => own(node.id)), edges: fixture.edges.filter((edge) => own(edge.from) && own(edge.to)), loops: [] };
  const file = join(dir, "work", "plan.grooph.json");
  writeFileSync(file, `${JSON.stringify(host, null, 2)}\n`);
  const env = { cwd: join(dir, "work"), userDir: join(dir, "home", "templates"), defaultRegistry: "http://127.0.0.1:9/unreachable/index.json" };
  return {
    file,
    project: join(dir, "work", ".grooph", "templates"),
    env,
    grooph: async (...argv) => {
      const io = capture();
      const code = await run(argv, io, () => "", env);
      return { code, out: io.stdout.join("\n"), err: io.stderr.join("\n") };
    },
    read: () => JSON.parse(readFileSync(file, "utf8")) as Doc,
  };
}

const ADD = ["--as", "review", "--after", "plan", "--then", "release", "--set", "task=the checkout flow", "--set", "test-command=pnpm test", "--set", "checklist=docs/checklist.md"];

/** A newer version of the review gate in the project's own registry, which is looked in before the built-in library. */
function newerInProject(box: Box, change: (template: Doc) => void): void {
  const template = JSON.parse(readFileSync(join(repoRoot, "patterns/review-gate.grooph.json"), "utf8")) as Doc;
  change(template);
  template.version = 2;
  mkdirSync(box.project, { recursive: true });
  writeFileSync(join(box.project, "review-gate.grooph.json"), `${JSON.stringify(template, null, 2)}\n`);
}

test("sub add places a template as a group, connects it both ways, and writes only when asked", async (t) => {
  const box = sandbox(t);
  const before = readFileSync(box.file, "utf8");
  const dry = await box.grooph("sub", "add", "review-gate", "--into", box.file, ...ADD);
  assert.equal(dry.code, 0, dry.err);
  assert.match(dry.out, /placed review-gate@1 \(built-in\) as "review": 3 members, named "Review gate"/);
  assert.match(dry.out, /its stop "review-done" is dropped: what reached it leads to "release"/);
  assert.match(dry.out, /review-merge-gate → release {3}\(e-review-merge-gate-release\)/);
  assert.match(dry.out, /plan → review-builder {3}\(e-plan-review-builder\)/);
  assert.match(dry.out, /not written \(dry run — pass --write to save\)/);
  assert.equal(readFileSync(box.file, "utf8"), before);

  const wrote = await box.grooph("sub", "add", "review-gate", "--into", box.file, ...ADD, "--write");
  assert.equal(wrote.code, 0, wrote.err);
  const doc = box.read();
  assert.deepEqual(doc.groups!.map((group) => [group.id, group.from, group.members]), [["review", "review-gate@1", ["review-builder", "review-critic", "review-merge-gate"]]]);
  // What it wrote is the fixture, but for the plain group the fixture wraps the subgrooph in and the line a person wrote on it.
  const fixture = JSON.parse(readFileSync(join(repoRoot, "fixtures/valid/subgrooph-in-a-graph.grooph.json"), "utf8")) as Doc;
  assert.deepEqual(doc.nodes, fixture.nodes);
  assert.deepEqual(doc.loops, fixture.loops);
  assert.deepEqual([...doc.edges].sort((a, b) => a.id.localeCompare(b.id)), [...fixture.edges].sort((a, b) => a.id.localeCompare(b.id)));

  // And it exports: a subgrooph's nodes are ordinary nodes.
  const exported = await box.grooph("validate", "--for-export", box.file);
  assert.equal(exported.code, 0, exported.err);
});

test("sub add says what is missing or wrong, and leaves the file alone", async (t) => {
  const box = sandbox(t);
  const before = readFileSync(box.file, "utf8");
  const cases: [string[], RegExp][] = [
    [["sub", "add", "review-gate", "--as", "review"], /sub add needs --into <file>/],
    [["sub", "add", "review-gate", "--into", box.file], /sub add needs --as <id>/],
    [["sub", "add", "--into", box.file, "--as", "review"], /sub add needs one template/],
    [["sub", "add", "review-gate", "--into", box.file, "--as", "plan", "--write"], /"plan" is taken in "plan-review-release"/],
    [["sub", "add", "review-gate", "--into", box.file, "--as", "review", "--then", "relese", "--write"], /--then names "relese".*did you mean "release"/],
    [["sub", "add", "reveiw-gate", "--into", box.file, "--as", "review", "--write"], /reveiw-gate/],
    [["sub", "remove", box.file], /sub has no "remove"; it has add, list, update and extract/],
  ];
  for (const [argv, message] of cases) {
    const result = await box.grooph(...argv);
    assert.equal(result.code, 1, argv.join(" "));
    assert.match(result.err, message, argv.join(" "));
  }
  assert.equal(readFileSync(box.file, "utf8"), before);

  // Unfilled slots are placed as {{key}}, and said.
  const unfilled = await box.grooph("sub", "add", "review-gate", "--into", box.file, "--as", "review");
  assert.match(unfilled.err, /2 slots still unfilled \(\{\{checklist\}\}, \{\{test-command\}\}\)|2 slots still unfilled \(\{\{test-command\}\}, \{\{checklist\}\}\)/);
});

test("sub list says what each group holds and how it is connected; --json gives the same as data", async (t) => {
  const box = sandbox(t);
  assert.match((await box.grooph("sub", "list", box.file)).out, /has no groups\. Place a template as one: grooph sub add/);
  await box.grooph("sub", "add", "review-gate", "--into", box.file, ...ADD, "--write");
  const listed = await box.grooph("sub", "list", box.file);
  assert.equal(listed.code, 0);
  assert.match(listed.out, /^review {2}"Review gate" {2}review-gate@1 {2}3 nodes$/m);
  assert.match(listed.out, /in: {2}plan → review-builder/);
  assert.match(listed.out, /out: review-merge-gate → release/);
  const data = JSON.parse((await box.grooph("sub", "list", box.file, "--json")).out) as { id: string; from: { template: string; version: number }; nodes: number }[];
  assert.deepEqual(data.map((group) => [group.id, group.from, group.nodes]), [["review", { template: "review-gate", version: 1 }, 3]]);
});

test("sub update: a newer version's changes apply, and the one that loosens a brake is listed first and held back", async (t) => {
  const box = sandbox(t);
  await box.grooph("sub", "add", "review-gate", "--into", box.file, ...ADD, "--write");
  assert.match((await box.grooph("sub", "update", box.file)).out, /review {2}review-gate@1 → review-gate@1 \(built-in\): nothing to change\n.*is up to date/);

  newerInProject(box, (template) => {
    template.loops[0]!.stops.find((stop) => stop.kind === "max-iterations")!.n = 8;
    template.nodes.find((node) => node.id === "critic")!.brief += " Cite a file and a line for every item.";
  });
  const before = readFileSync(box.file, "utf8");
  const dry = await box.grooph("sub", "update", box.file);
  assert.equal(dry.code, 0, dry.err);
  const lines = dry.out.split("\n");
  assert.equal(lines[0], "review  review-gate@1 → review-gate@2 (project)");
  assert.equal(lines[1], "  held back: each removes or loosens a brake. Apply one by its name: --allow loop:review-review.stops");
  assert.match(lines[2]!, /^ {4}loop:review-review\.stops +raises the round cap from 4 to 8$/);
  assert.equal(lines[3], "  the rest:");
  assert.match(lines[4]!, /^ {4}node:review-critic\.brief +node "review-critic": brief changes from /);
  assert.equal(readFileSync(box.file, "utf8"), before, "a dry run writes nothing");

  const wrote = await box.grooph("sub", "update", box.file, "--write");
  assert.equal(wrote.code, 0, wrote.err);
  let doc = box.read();
  assert.equal(doc.groups![0]!.from, "review-gate@2");
  assert.equal(doc.loops[0]!.stops.find((stop) => stop.kind === "max-iterations")!.n, 4, "the round cap is what it was");
  assert.match(doc.nodes.find((node) => node.id === "review-critic")!.brief!, /Cite a file and a line for every item\.$/);

  // Still offered, since it was not taken; and taken when asked for by its name.
  const again = await box.grooph("sub", "update", box.file, "--write");
  assert.match(again.out, /held back: each removes or loosens a brake/);
  assert.match(again.out, /is unchanged: every difference is held back/);
  const allowed = await box.grooph("sub", "update", box.file, "--allow", "loop:review-review.stops", "--write");
  assert.equal(allowed.code, 0, allowed.err);
  assert.match(allowed.out, /loop:review-review\.stops .*\(loosens a brake: raises the round cap from 4 to 8; asked for by name\)/);
  doc = box.read();
  assert.equal(doc.loops[0]!.stops.find((stop) => stop.kind === "max-iterations")!.n, 8);
  assert.match((await box.grooph("sub", "update", box.file)).out, /is up to date/);
});

test("sub update refuses a name that is no change, a group that is not there and one that is not a subgrooph", async (t) => {
  const box = sandbox(t);
  await box.grooph("sub", "add", "review-gate", "--into", box.file, ...ADD, "--write");
  const before = readFileSync(box.file, "utf8");
  const noSuch = await box.grooph("sub", "update", box.file, "--allow", "loop:review-review.stop", "--write");
  assert.equal(noSuch.code, 1);
  assert.match(noSuch.err, /no change named "loop:review-review\.stop"/);
  assert.equal((await box.grooph("sub", "update", box.file, "reveiw")).code, 1);
  assert.equal(readFileSync(box.file, "utf8"), before);

  const doc = box.read();
  doc.groups!.push({ id: "plain", name: "Plain", members: ["plan"] });
  writeFileSync(box.file, JSON.stringify(doc));
  const plain = await box.grooph("sub", "update", box.file, "plain");
  assert.equal(plain.code, 1);
  assert.match(plain.err, /group "plain" is not a subgrooph/);
});

test("sub extract saves a group as a template in the project, and the template can be placed again", async (t) => {
  const box = sandbox(t);
  await box.grooph("sub", "add", "review-gate", "--into", box.file, ...ADD, "--write");
  const missing = await box.grooph("sub", "extract", box.file, "review", "--id", "our-review");
  assert.equal(missing.code, 1);
  assert.match(missing.err, /sub extract needs --title/);

  const saved = await box.grooph("sub", "extract", box.file, "review", "--id", "our-review", "--title", "Our review", "--summary", "The review gate as this project runs it.", "--when", "Before a release.");
  assert.equal(saved.code, 0, saved.err);
  assert.match(saved.out, /saved our-review@1 \(fragment: 3 nodes, 4 edges, 1 loop\)/);
  const template = JSON.parse(readFileSync(join(box.project, "our-review.grooph.json"), "utf8")) as Doc;
  assert.deepEqual(template.nodes.map((node) => node.id), ["review-builder", "review-critic", "review-merge-gate"]);
  assert.equal(template.groups, undefined);

  const placed = await box.grooph("sub", "add", "our-review", "--into", box.file, "--as", "second", "--after", "release", "--then", "done", "--write");
  assert.equal(placed.code, 0, placed.err);
  assert.deepEqual(box.read().groups!.map((group) => [group.id, group.from]), [["review", "review-gate@1"], ["second", "our-review@1"]]);
});

test("grooph --help lists sub, and grooph sub --help is its page", async (t) => {
  const box = sandbox(t);
  assert.match((await box.grooph("--help")).out, /^ {2}sub {10}place a template inside a graph as one box, and keep it current$/m);
  const help = await box.grooph("sub", "--help");
  assert.equal(help.code, 0);
  assert.match(help.out, /^grooph sub add <template> --into <file> --as <id>/);
  assert.match(help.out, /NOT applied unless you ask for it by\s+its name with --allow/);
  assert.equal((await box.grooph("help", "sub")).out, help.out);
  assert.match((await box.grooph("sbu", "list", box.file)).err, /Did you mean "sub"\?/);
});

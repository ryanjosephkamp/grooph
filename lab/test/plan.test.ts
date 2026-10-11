/**
 * A plan and the lab's `export` (handoff 0100): an export that is refused ends by naming the plan, no package is made
 * of a graph with a person's step or of one from a plan template, and `grooph plan` never writes the graph a package
 * keeps. Moved from packages/cli/test/plan.test.ts when `export` left the product's command line (slice 0103); `grooph
 * plan` itself and the tool `grooph_export_plan` are tested there.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { canonicalize, type Graph } from "@grooph/core";

import { PLAN_STILL } from "@grooph/cli/commands/export";
import type { Output } from "@grooph/cli/print";

import { run } from "../src/index.js";
import { root as repoRoot } from "./root.js";

delete process.env["GROOPH_MODELS"];

const fixture = (name: string): Graph => JSON.parse(readFileSync(join(repoRoot, "fixtures", "valid", `${name}.grooph.json`), "utf8")) as Graph;
const LF = String.fromCharCode(10);

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (isTTY = false): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, isTTY, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t) };
};
const grooph = async (argv: string[], cwd?: string, isTTY = false): Promise<{ code: number; out: string; err: string }> => {
  const io = capture(isTTY);
  const before = process.cwd();
  if (cwd !== undefined) process.chdir(cwd);
  try {
    const code = await run(argv, io, () => "", { env: {} });
    return { code, out: io.stdout.join(LF), err: io.stderr.join(LF) };
  } finally {
    process.chdir(before);
  }
};
const withFolder = async (fn: (dir: string) => Promise<void>): Promise<void> => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "grooph-plan-")));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const put = (file: string, doc: unknown): string => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof doc === "string" ? doc : JSON.stringify(doc, null, 2));
  return file;
};
const tree = (dir: string): string =>
  JSON.stringify(
    (readdirSync(dir, { recursive: true }) as string[])
      .map(String)
      .sort()
      .map((name) => {
        try {
          return [name, readFileSync(join(dir, name), "utf8")];
        } catch {
          return [name];
        }
      }),
  );

const graph = fixture("review-loop");
/** The same graph as a plan: no harness and no goal, which only a package asks for. */
const planOnly = ((): Graph => {
  const doc = { ...graph } as Graph;
  delete (doc as { target?: unknown }).target;
  delete (doc as { goal?: unknown }).goal;
  return doc;
})();

// The half of the product's "grooph plan writes through no link and never the graph a package keeps" that needs a
// package in place: export puts one there, and nothing of it is changed. The refusal by the file's place alone, the
// links and the folders a tool reads stayed in packages/cli/test/plan.test.ts.
test("grooph plan never writes the graph a package keeps, with the package export placed left as it was", async () => {
  await withFolder(async (dir) => {
    const file = put(join(dir, "g.grooph.json"), graph);
    // A graph whose id is "graph", planned into a package's folder, would be that package's kept graph.
    const named = put(join(dir, "named.grooph.json"), { ...graph, id: "graph" });
    const project = join(dir, "project");
    assert.equal((await grooph(["export", file, "--target", "claude-code", "--into", project])).code, 0);
    const before = tree(project);
    const kept = await grooph(["plan", named, "--into", join(project, ".grooph", "review-loop"), "--force"]);
    assert.equal(kept.code, 1);
    assert.match(kept.err, /is the graph a package keeps\. grooph does not write it: what placed the package compares the next graph with it/);
    assert.equal(tree(project), before);
  });
});

test("an export refused for what the graph lacks, or for a harness grooph has no compiler for, ends by naming the plan", async () => {
  await withFolder(async (dir) => {
    const file = put(join(dir, "p.grooph.json"), planOnly);
    const refused = await grooph(["export", file, "--target", "claude-code", "--into", join(dir, "project")]);
    assert.equal(refused.code, 1);
    assert.equal(refused.err.split(LF).at(-1), PLAN_STILL(file));
    assert.equal(existsSync(join(dir, "project")), false);
    const custom = await grooph(["export", file, "--target", "my-own-harness", "--into", join(dir, "project")]);
    assert.equal(custom.code, 1);
    assert.equal(custom.err.split(LF).at(-1), PLAN_STILL(file));
    // The plan is named only for a file that reads as a graph: not for one that is not there.
    const missing = await grooph(["export", join(dir, "not-there.grooph.json"), "--target", "my-own-harness", "--into", join(dir, "project")]);
    assert.equal(missing.code, 1);
    assert.ok(!missing.err.includes("grooph plan"), missing.err);
    assert.ok(PLAN_STILL(file).startsWith("No package was written. A plan can still be: grooph plan "));
    // A graph with nothing in error is exported with no such line.
    const fine = await grooph(["export", put(join(dir, "g.grooph.json"), graph), "--target", "claude-code", "--into", join(dir, "project")]);
    assert.equal(fine.code, 0, fine.err);
    assert.ok(!`${fine.out}${fine.err}`.includes("grooph plan"));
  });
});

// ─── a step that is a person's (amendment A-020) ───────────────────────────

/** The review loop with its builder made a person's step, and nothing an agent has left on it. */
const BY_PERSON = [{ op: "updateNode", id: "builder", set: { by: "person", model: null, effort: null, allow: null } }];
const personStep = { ...graph, nodes: graph.nodes.map((node) => (node.id === "builder" ? (({ model: _m, effort: _e, allow: _a, ...rest }) => ({ ...rest, by: "person" }))(node as unknown as Record<string, unknown>) : node)) } as unknown as Graph;

// The export half of the product's "a graph with a person's step is a plan at the commands: picked, shared and
// planned as one, and export writes no package".
test("a graph with a person's step is a plan at the commands: export writes no package", async () => {
  await withFolder(async (dir) => {
    const file = put(join(dir, "g.grooph.json"), graph);
    const applied = await grooph(["apply", file, "--ops", put(join(dir, "ops.json"), BY_PERSON), "--write"]);
    assert.equal(applied.code, 0, applied.err);
    assert.equal(readFileSync(file, "utf8"), canonicalize(personStep));

    const exported = await grooph(["export", file, "--target", "claude-code", "--into", join(dir, "project")]);
    assert.equal(exported.code, 1);
    assert.match(exported.err, /^error {2}E_PERSON_STEP_NOT_COMPILED /m);
    assert.equal(exported.err.split(LF).at(-1), PLAN_STILL(file));
    assert.equal(existsSync(join(dir, "project")), false);
  });
});

// ─── the four plan templates (plans/) ─────────────────────────────────────

const PLANS = ["literature-review", "research-study", "solo-project", "team-handoffs"];
/** Every slot of a plan template, filled from the slot's own example. */
const filledFrom = (id: string): string[] => {
  const template = JSON.parse(readFileSync(join(repoRoot, "plans", `${id}.grooph.json`), "utf8")) as { template: { slots?: { key: string; example: string }[] } };
  return (template.template.slots ?? []).flatMap((slot) => ["--set", `${slot.key}=${slot.example}`]);
};

// The export half of the product's "each plan template is found by name, makes a graph that is a plan with nothing of
// its own in error, ends with the plan, and writes one".
test("no package is made of a graph from a plan template", async () => {
  await withFolder(async (dir) => {
    for (const id of PLANS) {
      const file = join(dir, `${id}.grooph.json`);
      const used = await grooph(["template", "use", id, "--name", `Mine ${id}`, ...filledFrom(id), "--out", file], dir);
      assert.equal(used.code, 0, `${id}: ${used.err}`);
      assert.equal((await grooph(["export", file, "--target", "claude-code", "--into", join(dir, "project")])).code, 1, id);
      assert.equal(existsSync(join(dir, "project")), false, id);
    }
  });
});

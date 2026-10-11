/**
 * The no-friction toolkit (handoff 0057), the part of it that is the lab's: `export` has a page of its own with an
 * example, a graph that passes the check for a package is placed, and `export --models`. Moved from
 * packages/cli/test/friction.test.ts when `export` left the product's command line (slice 0103); the rest stayed.
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import type { Output } from "@grooph/cli/print";

import { run } from "../src/index.js";
import { root } from "./root.js";

// A developer's own tier map must not reach these tests.
delete process.env["GROOPH_MODELS"];
delete process.env["GROOPH_MODELS_CODEX"];

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (isTTY?: boolean): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t), ...(isTTY !== undefined ? { isTTY } : {}) };
};

/** Runs `body` inside a fresh folder, as the person at the terminal would be. */
async function inFolder(body: (dir: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "grooph-friction-"));
  const before = process.cwd();
  process.chdir(dir);
  try {
    await body(dir);
  } finally {
    process.chdir(before);
    rmSync(dir, { recursive: true, force: true });
  }
}

// The export half of the product's "the overview fits a screen and every command has its own page with an example":
// the lab's overview is the one with export, adopt and runs in it, and export's page is the lab's.
test("the lab's overview fits a screen, and export has its own page with an example", async () => {
  const io = capture();
  assert.equal(await run(["--help"], io), 0);
  assert.ok(io.stdout.join("\n").split("\n").length <= 45);
  const a = capture();
  const b = capture();
  assert.equal(await run(["help", "export"], a), 0);
  assert.equal(await run(["export", "--help"], b), 0);
  assert.equal(a.stdout.join("\n"), b.stdout.join("\n"));
  assert.match(a.stdout.join("\n"), /Example/);
  // (From the product's "every command answers --help with exit 0", share.test.ts, whose list named export.)
  assert.ok(b.stdout.length > 0 && b.stderr.length === 0);
  const bad = capture();
  assert.equal(await run(["help", "nonsense"], bad), 1);
});

// The export half of the product's "success says what comes next, at a terminal only": export answers as the check
// for a package did, for a graph made from a template at a terminal.
test("at a terminal, export agrees with validate --for-export on a graph made from a template", async () => {
  await inFolder(async () => {
    const make = capture(true);
    await run(["template", "use", "grind-loop", "--name", "Flaky", "--set", "task=t", "--set", "test-command=c", "--out", "f.grooph.json"], make);

    const forExport = capture(true);
    const code = await run(["validate", "--for-export", "f.grooph.json"], forExport);

    const out = capture(true);
    assert.equal(await run(["export", "f.grooph.json", "--target", "claude-code", "--into", "pkg"], out), code === 0 ? 0 : 1);
  });
});

test("export --models names the model of a tier for one export; GROOPH_MODELS says it for a machine; the flag wins", async () => {
  const graph = join(root, "fixtures", "valid", "review-loop.grooph.json");
  const builder = (dir: string): string => readFileSync(join(dir, ".claude", "agents", "review-loop--builder.md"), "utf8");
  const dir = mkdtempSync(join(tmpdir(), "grooph-models-"));
  try {
    let io = capture();
    assert.equal(await run(["export", graph, "--target", "claude-code", "--into", dir, "--models", "strong=opus,frontier=opus"], io, () => "", { env: {} }), 0);
    assert.match(builder(dir), /^model: opus$/m);
    // All three tiers are said, so a tier left on the target's own model is in plain sight.
    assert.match(io.stdout.join("\n"), /tiers in this package: frontier → opus, strong → opus, fast → sonnet \(the target's own\)\. Named by --models\./);
    assert.doesNotMatch(io.stdout.join("\n"), /note: /, "the review loop's agents are on one tier, so no two tiers met");

    // From here on each export changes the model of an agent file already in place, which stops unless the one
    // exporting says so (export-stops.test.ts has the stop itself).
    io = capture();
    assert.equal(await run(["export", graph, "--target", "claude-code", "--into", dir, "--change-models"], io, () => "", { env: { GROOPH_MODELS: "strong=haiku" } }), 0);
    assert.match(builder(dir), /^model: haiku$/m);
    assert.match(io.stdout.join("\n"), /Named by GROOPH_MODELS\./);

    io = capture();
    assert.equal(await run(["export", graph, "--target", "claude-code", "--into", dir, "--models", "strong=opus", "--change-models"], io, () => "", { env: { GROOPH_MODELS: "strong=haiku" } }), 0);
    assert.match(builder(dir), /^model: opus$/m);

    // Nothing named: the target's own map (handoff 0084: frontier opus, strong and fast sonnet), and no file says fable.
    io = capture();
    assert.equal(await run(["export", graph, "--target", "claude-code", "--into", dir, "--change-models"], io, () => "", { env: {} }), 0);
    assert.match(builder(dir), /^model: sonnet$/m);
    // What the tiers mean is said with no map too: the target's own model for a tier is a fact about the package.
    // (Slice 0084 asserted here that the line was not printed; the driver's decision on slice 0078 is that it is
    // printed every time, so the assertion is of the line.)
    assert.match(io.stdout.join("\n"), /tiers in this package: frontier → opus \(the target's own\), strong → sonnet \(the target's own\), fast → sonnet \(the target's own\)\. No tier map was given \(--models, or GROOPH_MODELS\)\. A pin on a node still wins\./);
    assert.doesNotMatch(io.stdout.join("\n"), /note: /, "the review loop's agents are on one tier");
    assert.doesNotMatch(readFileSync(join(dir, ".grooph", "review-loop", "MAPPING.md"), "utf8"), /fable/i);

    // Two tiers the graph uses, made one model from outside the document: the export says what the validator cannot see.
    const mixed = join(root, "fixtures", "valid", "glyph-vocabulary.grooph.json");
    io = capture();
    assert.equal(await run(["export", mixed, "--target", "claude-code", "--into", dir, "--models", "strong=opus"], io, () => "", { env: {} }), 0);
    assert.match(io.stdout.join("\n"), /note: frontier and strong are both opus in this package, and this graph has agents on each\. A critic and the builder it checks may now share a model/);
    io = capture();
    assert.equal(await run(["export", mixed, "--target", "claude-code", "--into", dir, "--models", "frontier=opus,strong=sonnet,fast=haiku", "--change-models"], io, () => "", { env: {} }), 0);
    assert.doesNotMatch(io.stdout.join("\n"), /note: /);
    // And with nothing named: the target's own map gives strong and fast one model, and the export says that too.
    io = capture();
    assert.equal(await run(["export", mixed, "--target", "claude-code", "--into", dir, "--change-models"], io, () => "", { env: {} }), 0);
    // The line and the note together (slice 0084 asserted the note without the line; see above).
    assert.match(io.stdout.join("\n"), /tiers in this package: frontier → opus \(the target's own\), strong → sonnet \(the target's own\), fast → sonnet \(the target's own\)\. No tier map was given \(--models, or GROOPH_MODELS\)\. A pin on a node still wins\.\nnote: strong and fast are both sonnet in this package, by the target's own map, and this graph has agents on each\. A critic and the builder it checks may share a model; the validator's check for that reads tiers and does not see it\. To keep them apart, name the tiers: --models, or GROOPH_MODELS\./);

    for (const bad of ["best=opus", "strong", "strong=", "strong=a b", ",", "strong=sonnet;fast=haiku", "frontier=opus=x", "strong={x}", "strong=opus,strong=sonnet", "Strong=opus"]) {
      io = capture();
      assert.equal(await run(["export", graph, "--target", "claude-code", "--into", dir, "--models", bad], io, () => "", { env: {} }), 1, bad);
      assert.match(io.stderr.join("\n"), /--models: /);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


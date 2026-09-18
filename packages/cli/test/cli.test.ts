/**
 * The CLI surface: the three commands in the handoff, their exit codes, and the
 * file effects. `run()` takes its output sink, so the assertions read the lines
 * a user would see.
 */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { run } from "../src/index.js";
import type { Output } from "../src/print.js";

const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("workspace root not found");
})();

const fixture = (...parts: string[]): string => join(repoRoot, "fixtures", ...parts);

type Capture = Output & { stdout: string[]; stderr: string[]; all: () => string };

const capture = (): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    out: (text) => void stdout.push(text),
    err: (text) => void stderr.push(text),
    all: () => [...stdout, ...stderr].join("\n"),
  };
};

const scratch = (): string => mkdtempSync(join(tmpdir(), "grooph-cli-test-"));

test("validate on a clean document exits 0 and says so", async () => {
  const io = capture();
  assert.equal(await run(["validate", fixture("valid", "review-loop.grooph.json")], io), 0);
  assert.match(io.stdout.join("\n"), /no issues/);
  assert.deepEqual(io.stderr, []);
});

test("validate on a broken document exits 1 and prints code, severity, message and at", async () => {
  const io = capture();
  const code = await run(
    ["validate", fixture("invalid", "E_CYCLE_NO_STOP", "loop-without-stop.grooph.json")],
    io,
  );
  assert.equal(code, 1);
  const text = io.stderr.join("\n");
  assert.match(text, /error {2}E_CYCLE_NO_STOP/);
  assert.match(text, /cycle with no stop/);
  assert.match(text, /\[at: builder, critic\]/);
  assert.match(text, /1 error, 0 warnings/);
});

test("validate --for-export applies the export-only rules", async () => {
  const path = fixture("invalid", "E_NO_TARGET", "no-target-harness.grooph.json");
  assert.equal(await run(["validate", path], capture()), 0, "a draft with no target is legal to author");

  const io = capture();
  assert.equal(await run(["validate", path, "--for-export"], io), 1);
  assert.match(io.stderr.join("\n"), /E_NO_TARGET/);
});

test("validate --json prints the issue list as data", async () => {
  const io = capture();
  await run(["validate", fixture("invalid", "E_NO_GOAL", "no-goal.grooph.json"), "--for-export", "--json"], io);
  const payload = JSON.parse(io.stdout.join("\n")) as {
    ok: boolean;
    issues: { code: string; severity: string; at: string[] }[];
  };
  assert.equal(payload.ok, false);
  assert.equal(payload.issues[0]!.code, "E_NO_GOAL");
  assert.equal(payload.issues[0]!.severity, "error");
});

test("validate reports a schema failure instead of crashing", async () => {
  const io = capture();
  assert.equal(await run(["validate", fixture("invalid", "E_SCHEMA", "wrong-version-and-no-nodes.grooph.json")], io), 1);
  assert.match(io.stderr.join("\n"), /E_SCHEMA/);
  assert.match(io.stderr.join("\n"), /\/nodes: missing required property/);
});

test("canonicalize --write rewrites in place and is then a no-op", async () => {
  const dir = scratch();
  try {
    const path = join(dir, "doc.grooph.json");
    const source = JSON.parse(readFileSync(fixture("valid", "review-loop.grooph.json"), "utf8")) as Record<
      string,
      unknown
    >;
    const shuffled: Record<string, unknown> = {};
    for (const key of Object.keys(source).reverse()) shuffled[key] = source[key];
    writeFileSync(path, JSON.stringify(shuffled), "utf8");

    const first = capture();
    assert.equal(await run(["canonicalize", path, "--write"], first), 0);
    assert.match(first.stdout.join("\n"), /rewritten in canonical form/);

    const second = capture();
    assert.equal(await run(["canonicalize", path, "--write"], second), 0);
    assert.match(second.stdout.join("\n"), /already canonical/);

    assert.match(readFileSync(path, "utf8"), /^\{\n {2}"grooph": 0,/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("export writes the package and prints the kickoff", async () => {
  const dir = scratch();
  try {
    const io = capture();
    const code = await run(
      ["export", fixture("valid", "review-loop.grooph.json"), "--target", "claude-code", "--into", dir],
      io,
    );
    assert.equal(code, 0);

    for (const path of [
      ".grooph/review-loop/graph.grooph.json",
      ".grooph/review-loop/LEAD.md",
      ".grooph/review-loop/MAPPING.md",
      ".grooph/review-loop/KICKOFF.md",
      ".claude/agents/review-loop--builder.md",
      ".claude/agents/review-loop--critic.md",
      ".claude/skills/review-loop/SKILL.md",
    ]) {
      assert.ok(existsSync(join(dir, path)), `${path} was written`);
      assert.equal(
        readFileSync(join(dir, path), "utf8"),
        readFileSync(fixture("golden", "claude-code", "review-loop", path), "utf8"),
        `${path} matches the golden package`,
      );
    }

    const text = io.stdout.join("\n");
    assert.match(text, /wrote 7 files/);
    assert.match(text, /Kickoff/);
    assert.ok(
      text.includes(readFileSync(join(dir, ".grooph/review-loop/KICKOFF.md"), "utf8").trimEnd()),
      "the printed kickoff is the KICKOFF.md text",
    );
    assert.ok(!existsSync(join(dir, ".grooph/review-loop/runs")), "runs/ is created at run time, not by export");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("export refuses an invalid document, names the reasons, and writes nothing", async () => {
  const dir = scratch();
  try {
    const io = capture();
    const code = await run(
      [
        "export",
        fixture("invalid", "E_JUDGMENT_LOOP_NO_BAR", "taste-loop-without-bar.grooph.json"),
        "--target",
        "claude-code",
        "--into",
        dir,
      ],
      io,
    );
    assert.equal(code, 1);
    assert.match(io.stderr.join("\n"), /cannot export/);
    assert.match(io.stderr.join("\n"), /E_JUDGMENT_LOOP_NO_BAR/);
    assert.ok(!existsSync(join(dir, ".grooph")), "nothing was written");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("export carries warnings to the operator as well as into the brief", async () => {
  const dir = scratch();
  try {
    const io = capture();
    const code = await run(
      [
        "export",
        fixture("invalid", "W_DOC_TOO_LARGE", "scout-fanout-too-large.grooph.json"),
        "--target",
        "claude-code",
        "--into",
        dir,
      ],
      io,
    );
    assert.equal(code, 0, "a warning does not block export");
    assert.match(io.stdout.join("\n"), /1 warning, carried into the lead brief/);
    assert.match(
      readFileSync(join(dir, ".grooph/docs-audit-fanout/LEAD.md"), "utf8"),
      /W_DOC_TOO_LARGE/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("bad invocations fail with usage, not a stack trace", async () => {
  for (const argv of [
    ["validate"],
    ["canonicalize"],
    ["export", "x.grooph.json"],
    ["export", "x.grooph.json", "--target", "claude-code"],
    ["export", "x.grooph.json", "--target", "brainwave", "--into", "out"],
    ["wat"],
    [],
  ]) {
    const io = capture();
    assert.equal(await run(argv, io), 1, `${argv.join(" ") || "(no arguments)"} should exit 1`);
    assert.match(io.all(), /Usage/, `${argv.join(" ") || "(no arguments)"} should print usage`);
  }
});

test("a missing file is reported as a missing file", async () => {
  const io = capture();
  assert.equal(await run(["validate", join(scratch(), "nope.grooph.json")], io), 1);
  assert.match(io.stderr.join("\n"), /no such file/);
});

test("help and version are not errors", async () => {
  const help = capture();
  assert.equal(await run(["help"], help), 0);
  assert.match(help.stdout.join("\n"), /grooph never runs a graph/);

  const version = capture();
  assert.equal(await run(["--version"], version), 0);
  assert.match(version.stdout.join("\n"), /^\d+\.\d+\.\d+$/);
});

/**
 * The CLI surface: its commands, their exit codes, and the file effects.
 * `run()` takes its output sink (and stdin), so the assertions read the lines
 * a user would see.
 */

import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  assert.equal(await run(["validate", fixture("valid", "fix-until-green.grooph.json")], io), 0);
  assert.match(io.stdout.join("\n"), /no issues/);
  assert.deepEqual(io.stderr, []);
});

test("validate exits 0 on warnings and prints them", async () => {
  const io = capture();
  assert.equal(await run(["validate", fixture("valid", "review-loop.grooph.json")], io), 0);
  assert.match(io.stdout.join("\n"), /warning {2}W_HOMOGENEOUS_CRITICS/);
  assert.match(io.stdout.join("\n"), /0 errors, 1 warning/);
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
  assert.match(text, /1 error, 6 warnings/);
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

test("validate on a proposal set says so and points to grooph share", async () => {
  const set = fixture("proposals", "valid", "csv-export", "csv-export.grooph-proposals.json");
  const io = capture();
  assert.equal(await run(["validate", set], io), 1);
  assert.deepEqual(io.stdout, []);
  const said = io.stderr.join("\n");
  assert.match(said, /is a proposal set, not a graph document/);
  assert.match(said, /grooph share .*csv-export\.grooph-proposals\.json/);
  assert.match(said, /grooph pick/);
  assert.doesNotMatch(said, /E_SCHEMA/, "no schema noise from reading it as a graph");

  const json = capture();
  assert.equal(await run(["validate", set, "--json"], json), 1);
  const data = JSON.parse(json.stdout.join("\n")) as { ok: boolean; kind: string; message: string };
  assert.equal(data.ok, false);
  assert.equal(data.kind, "proposal-set");
  assert.match(data.message, /grooph share/);
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
    assert.match(io.stdout.join("\n"), /\d+ warnings, carried into the lead brief/);
    assert.match(io.stdout.join("\n"), /W_DOC_TOO_LARGE/);
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
    ["new"],
    ["new", "Scratch"],
    ["new", "--name", " "],
    ["apply"],
    ["apply", "x.grooph.json"],
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

/* ------------------------------------------------------------------ *
 * new, apply, and a run's working copy (handoff 0004, criterion 6).
 * ------------------------------------------------------------------ */

const opsFile = fixture("ops", "review-loop.ops.json");

test("new writes a minimal canonical document and refuses to overwrite it", async () => {
  const dir = scratch();
  try {
    const path = join(dir, "s.grooph.json");
    const io = capture();
    assert.equal(await run(["new", "--name", "Scratch", "--goal", "Try ops", "--target", "claude-code", "--out", path], io), 0);
    assert.match(io.stdout.join("\n"), /wrote .*s\.grooph\.json \(graph "scratch"\)/);
    assert.equal(
      readFileSync(path, "utf8"),
      `${JSON.stringify(
        { grooph: 0, id: "scratch", name: "Scratch", version: 1, goal: "Try ops", target: { harness: "claude-code" }, nodes: [], edges: [], loops: [] },
        null,
        2,
      )}\n`,
    );
    assert.equal(await run(["validate", path, "--for-export"], capture()), 0, "a new document validates");

    const again = capture();
    assert.equal(await run(["new", "--name", "Other", "--out", path], again), 1);
    assert.match(again.stderr.join("\n"), /already exists; pass --force/);
    assert.equal(await run(["new", "--name", "Other", "--out", path, "--force"], capture()), 0);
    assert.match(readFileSync(path, "utf8"), /"id": "other"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("new then apply builds the review loop, byte for byte", async () => {
  const dir = scratch();
  try {
    const path = join(dir, "review.grooph.json");
    assert.equal(await run(["new", "--name", "Review loop", "--out", path], capture()), 0);

    const dry = capture();
    assert.equal(await run(["apply", path, "--ops", opsFile], dry), 0);
    assert.match(dry.stdout.join("\n"), /applied 25 ops; .* not written \(dry run/);
    assert.doesNotMatch(readFileSync(path, "utf8"), /builder/, "a dry run writes nothing");

    const io = capture();
    assert.equal(await run(["apply", path, "--ops", opsFile, "--write", "--for-export"], io), 0);
    assert.match(io.stdout.join("\n"), /W_HOMOGENEOUS_CRITICS/, "the resulting issues are printed");
    assert.match(io.stdout.join("\n"), /applied 25 ops; wrote /);
    assert.equal(readFileSync(path, "utf8"), readFileSync(fixture("valid", "review-loop.grooph.json"), "utf8"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("apply reads ops from stdin with --ops -", async () => {
  const dir = scratch();
  try {
    const path = join(dir, "g.grooph.json");
    await run(["new", "--name", "G", "--out", path], capture());
    const ops = JSON.stringify([
      { op: "addNode", kind: "agent", name: "Writer", set: { brief: "Write it.", outputs: ["DRAFT.md"], allow: ["write-outputs"] } },
      { op: "addNode", kind: "stop", name: "Done" },
      { op: "connect", from: "writer", to: "done" },
    ]);
    const io = capture();
    assert.equal(await run(["apply", path, "--ops", "-", "--write"], io, () => ops), 0);
    assert.match(io.stdout.join("\n"), /no issues/);
    assert.match(readFileSync(path, "utf8"), /"id": "e-writer-done"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("apply names the failing op, exits 1 and writes nothing", async () => {
  const dir = scratch();
  try {
    const path = join(dir, "g.grooph.json");
    await run(["new", "--name", "G", "--out", path], capture());
    const before = readFileSync(path, "utf8");
    const ops = JSON.stringify([
      { op: "addNode", kind: "stop", name: "Done" },
      { op: "connect", from: "writter", to: "done" },
    ]);
    const io = capture();
    assert.equal(await run(["apply", path, "--ops", "-", "--write"], io, () => ops), 1);
    assert.match(io.stderr.join("\n"), /ops\[1\] connect: "from": no node "writter"/);
    assert.match(io.stderr.join("\n"), /unchanged/);
    assert.equal(readFileSync(path, "utf8"), before);

    const notJson = capture();
    assert.equal(await run(["apply", path, "--ops", "-"], notJson, () => "[{"), 1);
    assert.match(notJson.stderr.join("\n"), /stdin is not valid JSON/);
    const notList = capture();
    assert.equal(await run(["apply", path, "--ops", "-"], notList, () => '{"op":"addNode"}'), 1);
    assert.match(notList.stderr.join("\n"), /must hold a JSON list of ops/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("apply refuses to write a result that fails the schema, and writes one with rule errors", async () => {
  const dir = scratch();
  try {
    const path = join(dir, "g.grooph.json");
    await run(["new", "--name", "G", "--out", path], capture());
    const before = readFileSync(path, "utf8");

    const schema = capture();
    assert.equal(await run(["apply", path, "--ops", "-", "--write"], schema, () => '[{"op":"addNode","kind":"agent"}]'), 1);
    assert.match(schema.stderr.join("\n"), /does not match the schema, so .* is unchanged/);
    assert.match(schema.stderr.join("\n"), /E_SCHEMA .*\/nodes\/0\/outputs/);
    assert.equal(readFileSync(path, "utf8"), before);

    const cycle = JSON.stringify([
      { op: "addNode", kind: "agent", name: "A", set: { brief: "a", outputs: ["a"], allow: ["edit-files"] } },
      { op: "addNode", kind: "agent", name: "B", set: { brief: "b", outputs: ["b"], allow: ["edit-files"] } },
      { op: "connect", from: "a", to: "b" },
      { op: "connect", from: "b", to: "a" },
    ]);
    const rules = capture();
    assert.equal(await run(["apply", path, "--ops", "-", "--write"], rules, () => cycle), 1, "errors remain, so exit 1");
    assert.match(rules.stderr.join("\n"), /E_CYCLE_NO_STOP/);
    assert.match(rules.stdout.join("\n"), /wrote /, "but the step is saved, so the graph can be finished next");
    assert.equal(await run(["apply", path, "--ops", "-", "--write"], capture(), () => "[]"), 1, "the saved file still reads");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("apply --json reports ids, issues and whether it wrote", async () => {
  const dir = scratch();
  try {
    const path = join(dir, "g.grooph.json");
    await run(["new", "--name", "G", "--out", path], capture());
    const io = capture();
    const ops = '[{"op":"addNode","kind":"stop","name":"Done"},{"op":"setGraphField","key":"adaptation","value":"fixed"}]';
    assert.equal(await run(["apply", path, "--ops", "-", "--json"], io, () => ops), 0);
    const payload = JSON.parse(io.stdout.join("\n")) as { ok: boolean; written: boolean; applied: number; ids: unknown[]; issues: unknown[] };
    assert.deepEqual(
      { ok: payload.ok, written: payload.written, applied: payload.applied, ids: payload.ids, issues: payload.issues },
      { ok: true, written: false, applied: 2, ids: ["done", null], issues: [] },
    );

    const bad = capture();
    assert.equal(await run(["apply", path, "--ops", "-", "--json"], bad, () => '[{"op":"removeNode","id":"ghost"}]'), 1);
    const failure = JSON.parse(bad.stdout.join("\n")) as { error: { index: number; op: string; message: string } };
    assert.deepEqual(failure.error, { index: 0, op: "removeNode", message: '"id": no node "ghost"' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("validate accepts a run's working copy like any other document", async () => {
  const dir = scratch();
  try {
    await run(["export", fixture("valid", "review-loop.grooph.json"), "--target", "claude-code", "--into", dir], capture());
    const runDir = join(dir, ".grooph", "review-loop", "runs", "20260918-1200-abcd");
    const workingCopy = join(runDir, "graph.grooph.json");
    mkdirSync(runDir, { recursive: true });
    copyFileSync(join(dir, ".grooph", "review-loop", "graph.grooph.json"), workingCopy);

    // What an adaptive lead might do: add a node that owns README.md, route it in.
    const amend = JSON.stringify([
      { op: "addNode", kind: "agent", name: "Docs", set: { brief: "Write the usage note in README.md.", outputs: ["README.md"], allow: ["read-files", "write-outputs"], owns: ["README.md"] } },
      { op: "updateEdge", id: "e-review-pass", set: { to: "docs" } },
      { op: "connect", from: "docs", to: "merge-gate" },
      { op: "toggleLoopMember", loop: "review-cycle", node: "docs", on: true },
    ]);
    assert.equal(await run(["apply", workingCopy, "--ops", "-", "--write"], capture(), () => amend), 0);

    const io = capture();
    assert.equal(await run(["validate", workingCopy, "--for-export"], io), 0);
    assert.match(io.stdout.join("\n"), /0 errors, 1 warning/);
    assert.match(
      io.stdout.join("\n"),
      /W_HOMOGENEOUS_CRITICS {2}critic "critic" judges "builder" .*\[at: builder, critic\]/,
      "the new writer comes after the critic, so it does not change what the critic judges (per-critic rule, slice 0006)",
    );
    assert.equal(
      readFileSync(join(dir, ".grooph", "review-loop", "graph.grooph.json"), "utf8"),
      readFileSync(fixture("golden", "claude-code", "review-loop", ".grooph", "review-loop", "graph.grooph.json"), "utf8"),
      "the source document is untouched",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

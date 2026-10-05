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

// A developer's own tier map must not reach the golden packages these tests compare against.
delete process.env["GROOPH_MODELS"];
delete process.env["GROOPH_MODELS_CODEX"];
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

/** The review loop in a scratch folder, naming the harness asked for: by the op, through the command a person uses. */
const reviewLoopNaming = (dir: string, harness: string): Promise<string> => fixtureNaming(dir, "review-loop", harness);
const fixtureNaming = async (dir: string, name: string, harness: string): Promise<string> => {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.grooph.json`);
  copyFileSync(fixture("valid", `${name}.grooph.json`), path);
  const io = capture();
  assert.equal(await run(["apply", path, "--ops", "-", "--write"], io, () => JSON.stringify([{ op: "setTarget", harness }])), 0, io.all());
  assert.equal(JSON.parse(readFileSync(path, "utf8")).target.harness, harness);
  return path;
};

test("export accepts Codex and names the selected harness in its kickoff", async () => {
  const dir = scratch();
  try {
    const io = capture();
    const code = await run(["export", await reviewLoopNaming(dir, "codex"), "--target", "codex", "--into", dir], io);
    assert.equal(code, 0, io.stderr.join("\n"));
    assert.ok(existsSync(join(dir, ".codex/agents/review-loop--builder.toml")));
    assert.match(io.stdout.join("\n"), /Kickoff — paste this into a Codex session/);
    assert.match(readFileSync(join(dir, ".grooph/review-loop/KICKOFF.md"), "utf8"), /codex/i);
    // The package's own copy of the graph names the harness the package is for.
    assert.equal(JSON.parse(readFileSync(join(dir, ".grooph/review-loop/graph.grooph.json"), "utf8")).target.harness, "codex");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("export refuses a document that names one harness when asked for the other's package, both ways, and writes nothing", async () => {
  // Slice 0076, the review's second read, item 1: the review loop naming Codex, exported with --target claude-code,
  // exited 0 and wrote Claude Code agent files with Codex's models and no tools lines (every tool).
  for (const [named, asked] of [["codex", "claude-code"], ["claude-code", "codex"]] as const) {
    const dir = scratch();
    try {
      const path = await reviewLoopNaming(dir, named);
      const into = join(dir, "package");
      const io = capture();
      assert.equal(await run(["export", path, "--target", asked, "--into", into], io), 1, `${named} for ${asked}`);
      assert.match(io.stderr.join("\n"), new RegExp(`cannot export .* for ${asked}: fix these first`));
      assert.match(
        io.stderr.join("\n"),
        new RegExp(`error {2}E_NO_TARGET {2}the document names the harness "${named}" and the export is for "${asked}": export it for ${named}, or name ${asked} in the document first \\(grooph apply <file> --ops - --write, given \\[\\{"op":"setTarget","harness":"${asked}"\\}\\]\\) and export into a project that does not hold this graph's ${named} package`),
      );
      assert.ok(!existsSync(into), "nothing was written");
      assert.deepEqual(io.stdout.filter((line) => /Kickoff|wrote/.test(line)), []);
      // The way out the message names: the same file for the harness it names.
      assert.equal(await run(["export", path, "--target", named, "--into", into], capture()), 0);
      assert.ok(existsSync(join(into, named === "codex" ? ".codex/agents/review-loop--builder.toml" : ".claude/agents/review-loop--builder.md")));
      assert.ok(!existsSync(join(into, named === "codex" ? ".claude" : ".codex")), "one harness's files");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test("a machine's tier map is one harness's: GROOPH_MODELS is never read for Codex, nor GROOPH_MODELS_CODEX for Claude Code; --models is for the export it is typed on", async () => {
  // Slice 0076, the driver's reader: with GROOPH_MODELS naming Claude Code's models, a Codex export wrote
  // model = "sonnet" into both agent files and suggested -m 'opus'; the reverse wrote gpt-6-luna into .claude/agents.
  const claudeMap = "frontier=opus,strong=claude-map-strong,fast=haiku";
  const codexMap = "frontier=gpt-6.1-sol,strong=codex-map-strong,fast=gpt-6-luna";
  const dir = scratch();
  try {
    const paths = { "claude-code": await reviewLoopNaming(join(dir, "a"), "claude-code"), codex: await reviewLoopNaming(join(dir, "b"), "codex") };
    const exported = async (target: "claude-code" | "codex", env: Record<string, string>, flag?: string) => {
      const into = mkdtempSync(join(dir, "pkg-"));
      const io = capture();
      assert.equal(await run(["export", paths[target], "--target", target, "--into", into, ...(flag ? ["--models", flag] : [])], io, () => "", { env }), 0, io.all());
      const agent = readFileSync(join(into, target === "codex" ? ".codex/agents/review-loop--builder.toml" : ".claude/agents/review-loop--builder.md"), "utf8");
      const all = [agent, readFileSync(join(into, ".grooph/review-loop/MAPPING.md"), "utf8"), readFileSync(join(into, ".grooph/review-loop/LEAD.md"), "utf8")].join("\n");
      return { model: /^model(?:: | = ")([^"\n]+)/m.exec(agent)![1]!, all, out: io.stdout.join("\n") };
    };
    // Each variable set, the other target exported: the other target's own defaults, and not a word of the map.
    const codexUnderClaudeMap = await exported("codex", { GROOPH_MODELS: claudeMap });
    assert.equal(codexUnderClaudeMap.model, "gpt-6-luna");
    assert.doesNotMatch(codexUnderClaudeMap.all, /claude-map-strong|opus|haiku/);
    assert.doesNotMatch(codexUnderClaudeMap.out, /Named by|tiers in this package/);
    const claudeUnderCodexMap = await exported("claude-code", { GROOPH_MODELS_CODEX: codexMap });
    assert.equal(claudeUnderCodexMap.model, "sonnet");
    assert.doesNotMatch(claudeUnderCodexMap.all, /codex-map-strong|gpt-/);
    assert.doesNotMatch(claudeUnderCodexMap.out, /Named by|tiers in this package/);
    // Each read for its own target, and said by its own name.
    const codexOwn = await exported("codex", { GROOPH_MODELS: claudeMap, GROOPH_MODELS_CODEX: codexMap });
    assert.equal(codexOwn.model, "codex-map-strong");
    assert.match(codexOwn.out, /Named by GROOPH_MODELS_CODEX\./);
    assert.doesNotMatch(codexOwn.all, /claude-map-strong|opus|haiku/);
    const claudeOwn = await exported("claude-code", { GROOPH_MODELS: claudeMap, GROOPH_MODELS_CODEX: codexMap });
    assert.equal(claudeOwn.model, "claude-map-strong");
    assert.match(claudeOwn.out, /Named by GROOPH_MODELS\./);
    assert.doesNotMatch(claudeOwn.all, /codex-map-strong|gpt-/);
    // The flag is typed for this export, whichever its target, and wins over the target's variable.
    for (const target of ["claude-code", "codex"] as const) {
      const typed = await exported(target, { GROOPH_MODELS: claudeMap, GROOPH_MODELS_CODEX: codexMap }, "strong=typed-for-this-export");
      assert.equal(typed.model, "typed-for-this-export", target);
      assert.match(typed.out, /Named by --models\./, target);
    }
    // A map that does not parse is reported under the name of the variable it came from, and only for its own target.
    const bad = capture();
    assert.equal(await run(["export", paths.codex, "--target", "codex", "--into", join(dir, "never")], bad, () => "", { env: { GROOPH_MODELS_CODEX: "best=x" } }), 1);
    assert.match(bad.stderr.join("\n"), /GROOPH_MODELS_CODEX: "best" is not a tier/);
    assert.equal(await run(["export", paths.codex, "--target", "codex", "--into", join(dir, "fine")], capture(), () => "", { env: { GROOPH_MODELS: "best=x" } }), 0, "Claude Code's variable is not read for Codex, even to be refused");
    // The note that two tiers are one model names the variable of the target exported. It is printed for a graph
    // with agents on two tiers that are one model in the target's own map (strong and fast, in both).
    for (const [target, variable] of [["claude-code", "GROOPH_MODELS"], ["codex", "GROOPH_MODELS_CODEX"]] as const) {
      const two = await fixtureNaming(join(dir, `two-${target}`), "glyph-vocabulary", target);
      const io = capture();
      assert.equal(await run(["export", two, "--target", target, "--into", mkdtempSync(join(dir, "two-pkg-"))], io, () => "", { env: {} }), 0, io.all());
      const said = /To keep them apart, name the tiers: --models, or ([A-Z_]+)\./.exec(io.stdout.join("\n"));
      assert.ok(said, `${target}: the note was not printed`);
      assert.equal(said[1], variable, target);
    }
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
    [],
  ]) {
    const io = capture();
    assert.equal(await run(argv, io), 1, `${argv.join(" ") || "(no arguments)"} should exit 1`);
    assert.match(io.all(), /Usage/, `${argv.join(" ") || "(no arguments)"} should print usage`);
    assert.ok(io.all().split("\n").length <= 45, "the usage fits a screen");
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
  assert.match(help.stdout.join("\n"), /It never runs them/);

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

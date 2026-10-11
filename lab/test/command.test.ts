/**
 * The lab's command (handoff 0103, criteria 1 and 2): started as a program from the clone, it answers what `grooph`
 * answers, and what it compiles is, byte for byte, what the golden packages and the frozen game experiment hold.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { test } from "node:test";

import { root } from "./root.js";

const LAB = join(root, "lab", "bin", "grooph-lab.js");
const GROOPH = join(root, "packages", "cli", "bin", "grooph.js");

// A developer's own tier maps must not reach a package these tests compare, so no command here is given them.
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== "GROOPH_MODELS" && name !== "GROOPH_MODELS_CODEX"));

type Answer = { status: number | null; stdout: string; stderr: string };
const start = (bin: string, args: string[], input?: string): Answer => {
  const { status, stdout, stderr } = spawnSync(process.execPath, [bin, ...args], { cwd: root, env, encoding: "utf8", ...(input === undefined ? {} : { input }) });
  return { status, stdout, stderr };
};
const lab = (args: string[], input?: string): Answer => start(LAB, args, input);
/** The lab's command, which must do what was asked: a test that goes on after a failed step would compare nothing. */
const did = (args: string[], input?: string): Answer => {
  const answer = lab(args, input);
  assert.equal(answer.status, 0, `grooph-lab ${args.join(" ")}\n${answer.stdout}${answer.stderr}`);
  return answer;
};

const scratch = (): string => mkdtempSync(join(tmpdir(), "grooph-lab-test-"));
const files = (dir: string, base = dir): string[] =>
  readdirSync(dir)
    .flatMap((name) => (statSync(join(dir, name)).isDirectory() ? files(join(dir, name), base) : [relative(base, join(dir, name)).split("\\").join("/")]))
    .sort();
/** Two folders hold the same files with the same bytes. */
function sameTree(made: string, kept: string, what: string): void {
  assert.deepEqual(files(made), files(kept), `${what}: the same files`);
  for (const file of files(kept)) assert.ok(readFileSync(join(made, file)).equals(readFileSync(join(kept, file))), `${what}: ${file} is byte for byte the kept one`);
}

const REAL_RUN = join("fixtures", "runs", "slice-0007-sandwich", "runs", "20260919-0057-66c8");

test("started as a program, the lab's command answers what grooph answers", () => {
  // Each with the exit code it must give, so that the two cannot agree by failing alike (a fixture that moved, say).
  const asked: [status: number, ...args: string[]][] = [
    [0, "--version"],
    [0, "--help"],
    [1],
    [0, "help", "export"],
    [0, "help", "adopt"],
    [0, "help", "runs"],
    [0, "help", "watch"],
    [1, "nonsense"],
    [0, "validate", "--for-export", "fixtures/valid/review-loop.grooph.json"],
    [1, "validate", "fixtures/invalid/E_CYCLE_NO_STOP/loop-without-stop.grooph.json"],
    [0, "explain", "fixtures/valid/review-loop.grooph.json"],
    [1, "export"],
    [1, "export", "fixtures/valid/review-loop.grooph.json", "--target", "nowhere", "--into", "never-made"],
    [0, "runs", "list", "fixtures/runs"],
    [0, "runs", "show", REAL_RUN],
    [0, "adopt", REAL_RUN],
  ];
  for (const [status, ...args] of asked) {
    const ours = lab(args);
    assert.equal(ours.status, status, `grooph-lab ${args.join(" ")}\n${ours.stdout}${ours.stderr}`);
    assert.deepEqual(ours, start(GROOPH, args), `grooph-lab ${args.join(" ")}`);
  }
  // The command says which grooph it stands on.
  assert.deepEqual(lab(["--version"]), { status: 0, stdout: `${JSON.parse(readFileSync(join(root, "packages", "cli", "package.json"), "utf8")).version}\n`, stderr: "" });
});

test("the lab's run() hands on each of the product's arguments: where the output goes, standard input, and what a run may reach", () => {
  // In a process of its own, with standard input closed (hand-on.ts says why).
  const graph = join(root, "fixtures", "valid", "fix-until-green.grooph.json");
  const empty = scratch();
  try {
    const ran = spawnSync(process.execPath, [join(root, "lab", "dist", "test", "hand-on.js"), graph, empty], { cwd: root, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 });
    assert.equal(ran.status, 0, `${ran.stdout}${ran.stderr}`);
    const got = JSON.parse(ran.stdout) as { validated: number; applied: number; read: number; listed: number; fetched: number; stdout: string[]; stderr: string[] };
    const said = got.stdout.join("\n");
    assert.deepEqual(got.stderr, []);
    assert.deepEqual([got.validated, got.applied, got.listed], [0, 0, 0]);
    assert.match(said, /no issues/);
    assert.equal(got.read, 1, "the ops came from the reader it was given");
    assert.match(said, /applied 1 op; .* not written/);
    assert.match(said, /^0 templates\./m, "the templates it listed are the ones in the folders it was given: none");
    assert.equal(got.fetched, 0);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test("export through the lab's command writes the golden packages, byte for byte, for Claude Code and for Codex", () => {
  const dir = scratch();
  try {
    for (const graph of ["review-loop", "fix-until-green"]) {
      const source = join(root, "fixtures", "valid", `${graph}.grooph.json`);
      did(["export", source, "--target", "claude-code", "--into", join(dir, `claude-code-${graph}`)]);
      sameTree(join(dir, `claude-code-${graph}`), join(root, "fixtures", "golden", "claude-code", graph), `claude-code ${graph}`);

      // The fixtures name Claude Code, and an export for a harness the document does not name is refused: the Codex
      // package is of the same graph with Codex named in it, by the op a person would use (as CI's own step does).
      const forCodex = join(dir, `for-codex-${graph}.grooph.json`);
      cpSync(source, forCodex);
      did(["apply", forCodex, "--ops", "-", "--write"], JSON.stringify([{ op: "setTarget", harness: "codex" }]));
      did(["export", forCodex, "--target", "codex", "--into", join(dir, `codex-${graph}`)]);
      sameTree(join(dir, `codex-${graph}`), join(root, "fixtures", "golden", "codex", graph), `codex ${graph}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the frozen game experiment's package is what the lab's command compiles today", () => {
  // The graph, the models and the manifest are the experiment's own (experiments/game/FROZEN.md): read, never written.
  const setup = join(root, "experiments", "game", "setup");
  const models = /^MODELS="([^"]+)"$/m.exec(readFileSync(join(setup, "make-repo.sh"), "utf8"))?.[1];
  assert.ok(models, "make-repo.sh names the models the package was compiled with");
  const frozen = new Map(
    readFileSync(join(setup, "starting-contents.claude-code.sha256"), "utf8")
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => [line.slice(66), line.slice(0, 64)] as const),
  );
  const dir = scratch();
  try {
    did(["export", join(root, "experiments", "game", "arena.grooph.json"), "--target", "claude-code", "--into", dir, "--models", models]);
    const made = files(dir);
    for (const file of made) assert.equal(createHash("sha256").update(readFileSync(join(dir, file))).digest("hex"), frozen.get(file), `${file} is the frozen one`);
    // The manifest's other lines are the script's own files and the event hook's, which no compiler writes.
    const theCompilers = [...frozen.keys()].filter((file) => /^\.claude\/(agents|skills)\/|^\.grooph\/arena\//.test(file)).sort();
    assert.deepEqual(made, theCompilers);
    assert.equal(made.length, 10);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("adopt --write through the lab's command writes what grooph's writes", () => {
  const dirs = [scratch(), scratch()];
  try {
    const [theirs, ours] = dirs.map((dir, i) => {
      cpSync(join(root, "fixtures", "runs", "slice-0007-sandwich"), join(dir, ".grooph", "slice-0007-sandwich"), { recursive: true });
      const args = ["adopt", join(dir, ".grooph", "slice-0007-sandwich", "runs", "20260919-0057-66c8"), "--write"];
      const answer = i === 0 ? start(GROOPH, args) : lab(args);
      return { ...answer, stdout: answer.stdout.split(dir).join("<project>"), written: readFileSync(join(dir, ".grooph", "graphs", "slice-0007-sandwich.grooph.json"), "utf8") };
    }) as [Answer & { written: string }, Answer & { written: string }];
    assert.equal(ours.status, 0, ours.stderr);
    assert.deepEqual(ours, theirs);
    assert.equal(JSON.parse(ours.written).version, 2);
  } finally {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  }
});

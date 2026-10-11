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

import { run } from "../src/index.js";
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
  const asked: string[][] = [
    ["--version"],
    ["--help"],
    [],
    ["help", "export"],
    ["help", "adopt"],
    ["help", "runs"],
    ["help", "watch"],
    ["nonsense"],
    ["validate", "--for-export", "fixtures/valid/review-loop.grooph.json"],
    ["validate", "fixtures/invalid/E_CYCLE_NO_STOP/loop-without-stop.grooph.json"],
    ["explain", "fixtures/valid/review-loop.grooph.json"],
    ["export"],
    ["export", "fixtures/valid/review-loop.grooph.json", "--target", "nowhere", "--into", "never-made"],
    ["runs", "list", "fixtures/runs"],
    ["runs", "show", REAL_RUN],
    ["adopt", REAL_RUN],
  ];
  for (const args of asked) assert.deepEqual(lab(args), start(GROOPH, args), `grooph-lab ${args.join(" ")}`);
  // And not by both failing alike: the command is there, and it says which grooph it stands on.
  assert.deepEqual(lab(["--version"]), { status: 0, stdout: `${JSON.parse(readFileSync(join(root, "packages", "cli", "package.json"), "utf8")).version}\n`, stderr: "" });
});

test("the lab's run() takes the product's arguments: where the output goes, and what a run may reach", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io = { out: (line: string) => void stdout.push(line), err: (line: string) => void stderr.push(line) };
  assert.equal(await run(["validate", join(root, "fixtures", "valid", "fix-until-green.grooph.json")], io), 0);
  assert.match(stdout.join("\n"), /no issues/);
  assert.deepEqual(stderr, []);
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

/**
 * The scorer for paired comparisons (handoff 0016, criterion 4; protocol
 * docs/comparisons.md §6): the objective measures, taken from a run's final tree
 * by the same script for every arm, written as `score.json` in the run folder.
 *
 *   held_out   the held-out suite run against the final tree from the project
 *              root (`node --test <held-out>/*.test.mjs`): cases, passed, failed,
 *              and the rate; `ran: false` with a reason when the project has no
 *              suite or it could not be started (spec §13: scored as such, not guessed)
 *   tests      the project's own test command: exit code, pass/fail/skipped/todo
 *              counts, `pass` only when it exits 0 and nothing is skipped or todo
 *   scope      files changed outside the paths the task allows (expect.json
 *              `scope.allowed`, prefixes); `.grooph/` and `.claude/` are ignored
 *              for every arm, since the package and its run record are the
 *              runner's, not the work
 *   ending     what the runner recorded: `clean` (a final state the arm declared)
 *              or `cut-off` (cap, iteration limit, error), with the reason
 *
 * `--score <run dir>` rebuilds the final tree from the project's task folder and
 * the run's `project.diff` and scores it again, so a kept record can be re-scored
 * after the scorer changes (the record itself is never edited: the re-score
 * prints, and only `--write` replaces `score.json`).
 *
 *   node scripts/lib/compare-score.mjs <run dir> [--write]
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const IGNORED = [".grooph/", ".claude/"];
const HELD_OUT_TOKEN = "<held-out>";

// ── running node --test and reading its summary ──────────────────────────

/** The counts node's test runner prints at the end, in either reporter (`# pass 3` or `ℹ pass 3`). */
export function parseTestSummary(output) {
  const counts = {};
  for (const key of ["tests", "pass", "fail", "cancelled", "skipped", "todo"]) {
    const m = String(output).match(new RegExp(`^(?:#|ℹ) ${key} (\\d+)`, "m"));
    counts[key] = m ? Number(m[1]) : null;
  }
  return counts;
}

/** The failing cases' names, from tap (`not ok N - name`) or spec (`✖ name`) output. */
export function failedCases(output) {
  const names = [];
  for (const m of String(output).matchAll(/^\s*(?:not ok \d+ - |✖ )(.+?)(?: \(\d+(?:\.\d+)?ms\))?$/gm)) names.push(m[1].trim());
  return [...new Set(names)];
}

/** A small, explicit environment: the scorer may itself run under `node --test`, whose NODE_TEST_CONTEXT would turn the child into a test child. */
function runCommand(command, args, cwd, timeoutMs = 5 * 60 * 1000) {
  const env = { PATH: process.env.PATH, HOME: process.env.HOME ?? "", TMPDIR: process.env.TMPDIR ?? "/tmp", LANG: process.env.LANG ?? "en_US.UTF-8", NODE_OPTIONS: "--test-reporter=tap", CI: "1" };
  const out = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 64 << 20, timeout: timeoutMs, env });
  return { status: out.status, signal: out.signal, error: out.error?.message ?? null, output: `${out.stdout ?? ""}${out.stderr ?? ""}` };
}

/** The held-out suite against `tree`, from the project root. */
export function scoreHeldOut(tree, heldOutDir) {
  if (!heldOutDir || !existsSync(heldOutDir)) return { ran: false, reason: "the project has no held-out suite", cases: null, passed: null, failed: null, rate: null };
  const files = readdirSync(heldOutDir)
    .filter((name) => name.endsWith(".test.mjs"))
    .sort()
    .map((name) => join(heldOutDir, name));
  if (files.length === 0) return { ran: false, reason: "the held-out folder holds no *.test.mjs", cases: null, passed: null, failed: null, rate: null };
  const run = runCommand(process.execPath, ["--test", ...files], tree);
  const counts = parseTestSummary(run.output);
  if (counts.tests === null) return { ran: false, reason: `node --test produced no summary (${run.error ?? `exit ${run.status ?? run.signal}`})`, cases: null, passed: null, failed: null, rate: null, output_tail: run.output.slice(-2000) };
  const passed = counts.pass ?? 0;
  const cases = counts.tests;
  return {
    ran: true,
    command: `node --test ${files.map((f) => f.replace(dirname(heldOutDir), "<harness>")).join(" ")}`,
    cases,
    passed,
    failed: (counts.fail ?? 0) + (counts.cancelled ?? 0),
    skipped: counts.skipped ?? 0,
    rate: cases > 0 ? Math.round((passed / cases) * 1000) / 1000 : null,
    failing: failedCases(run.output),
    exit: run.status,
  };
}

/** The project's own test command against `tree`. */
export function scoreTests(tree, testCommand) {
  const [command, ...args] = testCommand.split(/\s+/);
  const run = runCommand(command, args, tree);
  const counts = parseTestSummary(run.output);
  const skippedOrTodo = (counts.skipped ?? 0) + (counts.todo ?? 0);
  return {
    command: testCommand,
    exit: run.status,
    pass: run.status === 0 && skippedOrTodo === 0,
    tests: counts.tests,
    passed: counts.pass,
    failed: (counts.fail ?? 0) + (counts.cancelled ?? 0),
    skipped: counts.skipped,
    todo: counts.todo,
    failing: failedCases(run.output),
    error: run.error,
  };
}

/**
 * Files changed outside the allowed paths, and any protected file the task said not to change.
 * `files` are `git diff --name-status` lines ("A path", "M path", "R100 old new").
 */
export function scoreScope(files, allowed, protectedPaths = []) {
  const paths = files
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 2)
    .map((parts) => parts[parts.length - 1]);
  const considered = paths.filter((path) => !IGNORED.some((prefix) => path.startsWith(prefix)));
  const inside = (path) => allowed.some((rule) => (rule.endsWith("/") ? path.startsWith(rule) : path === rule));
  return {
    allowed,
    ignored: IGNORED,
    changed: considered,
    outside: considered.filter((path) => !inside(path)),
    protected: protectedPaths,
    protected_changed: considered.filter((path) => protectedPaths.includes(path)),
  };
}

/**
 * Score one final tree. `ending` is the runner's record: { kind: "clean" | "cut-off", reason }.
 * `files` is the diff's name-status list against the base commit.
 */
export function scoreTree({ tree, heldOutDir, testCommand, allowed, protectedPaths, files, ending }) {
  const held_out = scoreHeldOut(tree, heldOutDir);
  const tests = scoreTests(tree, testCommand);
  const scope = scoreScope(files, allowed, protectedPaths ?? []);
  return {
    scored_at: new Date().toISOString(),
    scorer: "scripts/lib/compare-score.mjs",
    held_out,
    tests,
    scope,
    ending: ending ?? { kind: null, reason: "not recorded" },
  };
}

// ── rebuilding a final tree from a kept record ───────────────────────────

/** Every text file under `dir` holding the held-out token gets `path` in its place (as the runner did before the run). */
function substitute(dir, path) {
  const walk = (at) => {
    for (const name of readdirSync(at)) {
      const full = join(at, name);
      if (statSync(full).isDirectory()) {
        if (name !== ".git" && name !== "node_modules") walk(full);
      } else if (/\.(md|json|mjs|js|txt|cjs|ts)$/i.test(name)) {
        const text = readFileSync(full, "utf8");
        if (text.includes(HELD_OUT_TOKEN)) writeFileSync(full, text.replaceAll(HELD_OUT_TOKEN, path), "utf8");
      }
    }
  };
  walk(dir);
}

/**
 * The final tree of a kept run, rebuilt: the project's task folder at the token
 * substitution the run had, committed, then `project.diff` applied with the
 * package paths excluded. Returns the tree's path (the caller removes it).
 */
export function rebuildTree(runDir) {
  const result = JSON.parse(readFileSync(join(runDir, "result.json"), "utf8"));
  const projectDir = resolve(runDir, "..");
  const tree = mkdtempSync(join(tmpdir(), "grooph-compare-rescore-"));
  cpSync(join(projectDir, "task"), tree, { recursive: true });
  if (result.held_out?.dir) substitute(tree, result.held_out.dir);
  const git = (...args) => spawnSync("git", ["-C", tree, ...args], { encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "score@grooph.local");
  git("config", "user.name", "grooph score");
  git("add", "-A");
  git("commit", "-qm", "task");
  const diff = join(runDir, "project.diff");
  if (existsSync(diff) && readFileSync(diff, "utf8").trim() !== "") {
    const applied = git("apply", "--exclude=.grooph/*", "--exclude=.claude/*", "--exclude=.grooph/**", "--exclude=.claude/**", diff);
    if (applied.status !== 0) throw new Error(`git apply failed on ${diff}:\n${applied.stderr}`);
  }
  return { tree, result };
}

// ── CLI ──────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [runDirArg, ...rest] = process.argv.slice(2);
  if (!runDirArg) {
    console.error("usage: compare-score.mjs <run dir> [--write]");
    process.exit(64);
  }
  const runDir = resolve(runDirArg);
  const projectDir = resolve(runDir, "..");
  const slots = JSON.parse(readFileSync(join(projectDir, "slots.json"), "utf8"));
  const expect = JSON.parse(readFileSync(join(projectDir, "expect.json"), "utf8"));
  const { tree, result } = rebuildTree(runDir);
  try {
    const heldOutDir = existsSync(join(projectDir, "held-out")) ? join(projectDir, "held-out") : null;
    const kept = existsSync(join(runDir, "score.json")) ? JSON.parse(readFileSync(join(runDir, "score.json"), "utf8")) : null;
    const score = scoreTree({ tree, heldOutDir, testCommand: slots.values["test-command"], allowed: expect.scope?.allowed ?? [], protectedPaths: expect.scope?.protected ?? [], files: result.project_files_changed ?? [], ending: kept?.ending ?? result.ending_kind });
    score.rebuilt_from = "task/ + project.diff";
    console.log(JSON.stringify(score, null, 2));
    if (kept) {
      const same = kept.held_out?.passed === score.held_out.passed && kept.held_out?.cases === score.held_out.cases && kept.tests?.pass === score.tests.pass && JSON.stringify(kept.scope?.outside) === JSON.stringify(score.scope.outside);
      console.error(same ? "re-score agrees with the kept score.json" : "re-score DIFFERS from the kept score.json");
    }
    if (rest.includes("--write")) {
      writeFileSync(join(runDir, "score.json"), `${JSON.stringify(score, null, 2)}\n`, "utf8");
      console.error(`wrote ${join(runDir, "score.json")}`);
    }
  } finally {
    rmSync(tree, { recursive: true, force: true });
  }
}

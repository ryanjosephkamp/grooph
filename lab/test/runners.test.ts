/**
 * The proving runners start from the clone and reach the compiler through the lab's command (handoff 0103: "these
 * must work from the repository, and CI must keep proving it"). Each is run here in the mode that calls no model:
 * a dry run builds the scratch project, compiles the package into it and prints the command it would start.
 *
 * `claude` and `codex` are stand-ins for the length of a dry run, first on its path: a file that writes down how it
 * was called and does nothing else. So "no model was called" is read from that list, not from what the runner says.
 *
 * The runners' own unit tests are `scripts/lib/*.test.mjs` and `scripts/prove-codex.test.mjs`, which this package's
 * `test` script runs beside these.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, relative } from "node:path";
import { test } from "node:test";

import { root } from "./root.js";

type Dry = { status: number | null; stdout: string; stderr: string; made: string[]; tmp: string; calls: string[]; done: () => void };

/** A runner, with a temporary folder of its own to build in (a dry run keeps its scratch project, and a test does not) and the two stand-ins. */
function dry(command: string, args: string[]): Dry {
  const home = mkdtempSync(join(tmpdir(), "grooph-lab-runner-"));
  const tmp = join(home, "tmp");
  const bin = join(home, "bin");
  const log = join(home, "calls.txt");
  mkdirSync(tmp);
  mkdirSync(bin);
  writeFileSync(log, "");
  for (const harness of ["claude", "codex"]) {
    writeFileSync(join(bin, harness), `#!/bin/sh\nprintf '%s\\n' "${harness} $*" >> "${log}"\n[ "$1" = "--version" ] && echo "0.0.0 (a stand-in: it calls no model)"\nexit 0\n`, { mode: 0o755 });
  }
  const env = Object.fromEntries(Object.entries({ ...process.env, TMPDIR: tmp, PATH: `${bin}${delimiter}${process.env["PATH"] ?? ""}` }).filter(([name]) => name !== "GROOPH_MODELS" && name !== "GROOPH_MODELS_CODEX"));
  const { status, stdout, stderr } = spawnSync(command, args, { cwd: root, env, encoding: "utf8" });
  const calls = readFileSync(log, "utf8").split("\n").filter((line) => line !== "");
  return { status, stdout, stderr, made: readdirSync(tmp).sort(), tmp, calls, done: () => rmSync(home, { recursive: true, force: true }) };
}

/** Every file under a folder with its size and the time it was last written: what a run that keeps a record would change. */
const listing = (dir: string, base = dir): string[] =>
  !existsSync(dir)
    ? []
    : readdirSync(dir)
        .flatMap((name) => {
          const at = statSync(join(dir, name));
          return at.isDirectory() ? listing(join(dir, name), base) : [`${relative(base, join(dir, name))} ${at.size} ${at.mtimeMs}`];
        })
        .sort();

test("the proving runner's dry run compiles a Claude Code package and calls no model", () => {
  const ledger = join(root, "experiments", "patterns", "ledger.json");
  const record = join(root, "experiments", "patterns", "review-gate");
  const before = { ledger: readFileSync(ledger, "utf8"), record: listing(record) };
  const ran = dry(join(root, "scripts", "prove-pattern.sh"), ["review-gate", "--dry-run"]);
  try {
    assert.equal(ran.status, 0, `${ran.stdout}${ran.stderr}`);
    assert.match(ran.stdout, /dry run done; the model was not called and the ledger is unchanged/);
    assert.match(ran.stdout, /the exported source validates for export through the grooph shim/);
    // The harness was asked its version, which shows the stand-in is the one the runner finds, and for nothing else.
    assert.deepEqual(ran.calls, ["claude --version"]);
    const scratch = ran.made.find((name) => name.startsWith("grooph-prove-review-gate-"));
    assert.ok(scratch, `a scratch project under the temporary folder: ${ran.made.join(", ")}`);
    for (const file of [".grooph/truncate/LEAD.md", ".grooph/truncate/KICKOFF.md", ".grooph/truncate/graph.grooph.json", ".claude/agents/truncate--builder.md", ".claude/agents/truncate--critic.md"]) {
      assert.ok(existsSync(join(ran.tmp, scratch, file)), `the package's ${file}`);
    }
    assert.equal(readFileSync(ledger, "utf8"), before.ledger, "the ledger is as it was");
    assert.deepEqual(listing(record), before.record, "and so is the template's record");
  } finally {
    ran.done();
  }
});

test("the Codex proving runner, without --run, compiles a Codex package and calls no model", () => {
  const record = join(root, "experiments", "patterns-codex");
  const before = listing(record);
  const ran = dry(process.execPath, [join(root, "scripts", "prove-codex.mjs")]);
  try {
    assert.equal(ran.status, 0, `${ran.stdout}${ran.stderr}`);
    assert.match(ran.stdout, /dry run complete; the task was instantiated and exported for Codex\. No model was called\./);
    assert.deepEqual(ran.calls, [], "neither harness was started, not even for its version");
    const scratch = ran.made.find((name) => name.startsWith("grooph-prove-codex-review-gate-"));
    assert.ok(scratch, `a scratch project under the temporary folder: ${ran.made.join(", ")}`);
    for (const file of [".grooph/truncate/LEAD.md", ".grooph/truncate/KICKOFF.md", ".codex/agents/truncate--builder.toml", ".codex/agents/truncate--critic.toml"]) {
      assert.ok(existsSync(join(ran.tmp, scratch, file)), `the package's ${file}`);
    }
    assert.deepEqual(listing(record), before, "the Codex record is as it was");
  } finally {
    ran.done();
  }
});

test("the runners that compile start the lab's command, and none starts the product's", () => {
  // Read from their text: a dry run prints the same whichever command compiled its package, while both commands compile.
  const runners = ["scripts/lib/prove-pattern.mjs", "scripts/prove-codex.mjs", "scripts/lib/compare-run.mjs", "scripts/lib/brake-run.mjs", "scripts/e2e-claude-code.sh"];
  for (const runner of runners) {
    const text = readFileSync(join(root, runner), "utf8");
    assert.match(text, /"lab", "bin", "grooph-lab\.js"|\/lab\/bin\/grooph-lab\.js/, `${runner} names the lab's command`);
    assert.doesNotMatch(text, /"cli", "bin", "grooph\.js"|packages\/cli\/bin\/grooph\.js/, `${runner} does not name the product's`);
  }
});

/**
 * The proving runners start from the clone and reach the compiler through the lab's command (handoff 0103: "these
 * must work from the repository, and CI must keep proving it"). Each is run here in the mode that calls no model:
 * a dry run builds the scratch project, compiles the package into it and prints the command it would start.
 *
 * The runners' own unit tests are `scripts/lib/*.test.mjs` and `scripts/prove-codex.test.mjs`, which this package's
 * `test` script runs beside these.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { root } from "./root.js";

/** A runner, with a temporary folder of its own to build in: a dry run keeps its scratch project, and a test does not. */
function dry(command: string, args: string[]): { status: number | null; stdout: string; stderr: string; made: string[]; tmp: string; done: () => void } {
  const tmp = mkdtempSync(join(tmpdir(), "grooph-lab-runner-"));
  const env = Object.fromEntries(Object.entries({ ...process.env, TMPDIR: tmp }).filter(([name]) => name !== "GROOPH_MODELS" && name !== "GROOPH_MODELS_CODEX"));
  const { status, stdout, stderr } = spawnSync(command, args, { cwd: root, env, encoding: "utf8" });
  return { status, stdout, stderr, made: readdirSync(tmp), tmp, done: () => rmSync(tmp, { recursive: true, force: true }) };
}

const text = (path: string): string => readFileSync(path, "utf8");

test("the proving runner's dry run compiles a Claude Code package through the lab's command and calls no model", () => {
  const ledger = text(join(root, "experiments", "patterns", "ledger.json"));
  const ran = dry(join(root, "scripts", "prove-pattern.sh"), ["review-gate", "--dry-run"]);
  try {
    assert.equal(ran.status, 0, `${ran.stdout}${ran.stderr}`);
    assert.match(ran.stdout, /dry run done; the model was not called and the ledger is unchanged/);
    assert.match(ran.stdout, /the exported source validates for export through the grooph shim/);
    const scratch = ran.made.find((name) => name.startsWith("grooph-prove-review-gate-"));
    assert.ok(scratch, `a scratch project under the temporary folder: ${ran.made.join(", ")}`);
    for (const file of [".grooph/truncate/LEAD.md", ".grooph/truncate/KICKOFF.md", ".grooph/truncate/graph.grooph.json", ".claude/agents/truncate--builder.md", ".claude/agents/truncate--critic.md"]) {
      assert.ok(existsSync(join(ran.tmp, scratch, file)), `the package's ${file}`);
    }
    assert.equal(text(join(root, "experiments", "patterns", "ledger.json")), ledger, "the ledger is as it was");
  } finally {
    ran.done();
  }
});

test("the Codex proving runner, without --run, compiles a Codex package through the lab's command and calls no model", () => {
  const ran = dry(process.execPath, [join(root, "scripts", "prove-codex.mjs")]);
  try {
    assert.equal(ran.status, 0, `${ran.stdout}${ran.stderr}`);
    assert.match(ran.stdout, /dry run complete; the task was instantiated and exported for Codex\. No model was called\./);
    const scratch = ran.made.find((name) => name.startsWith("grooph-prove-codex-review-gate-"));
    assert.ok(scratch, `a scratch project under the temporary folder: ${ran.made.join(", ")}`);
    for (const file of [".grooph/truncate/LEAD.md", ".grooph/truncate/KICKOFF.md", ".codex/agents/truncate--builder.toml", ".codex/agents/truncate--critic.toml"]) {
      assert.ok(existsSync(join(ran.tmp, scratch, file)), `the package's ${file}`);
    }
  } finally {
    ran.done();
  }
});

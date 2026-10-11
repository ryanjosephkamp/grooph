/**
 * A graph made from a template, exported: the export half of the product's "use writes an instantiated graph, asks
 * for unfilled slots on stderr, and never overwrites without --force" (packages/cli/test/template.test.ts), moved
 * when `export` left the product's command line (slice 0103). `grooph template` itself is tested there.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import type { Output } from "@grooph/cli/print";
import type { RegistryEnv } from "@grooph/cli/registry";

import { run } from "../src/index.js";

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t) };
};
const text = (lines: string[]): string => lines.join("\n");

test("a graph from a template with every slot filled passes the check for a package, and export places it", async () => {
  // A working tree (with .git) and a user folder, as the product's test has them. The template is built in, so no
  // registry is asked: the one named here listens nowhere, and a fetch would fail the test.
  const dir = mkdtempSync(join(tmpdir(), "grooph-template-test-"));
  mkdirSync(join(dir, "work", ".git"), { recursive: true });
  mkdirSync(join(dir, "work", "sub"));
  const env: Partial<RegistryEnv> = {
    cwd: join(dir, "work", "sub"),
    userDir: join(dir, "home", "templates"),
    defaultRegistry: "http://127.0.0.1:9/unreachable/index.json",
    fetch: async () => {
      throw new Error("a built-in template is found on this machine: no registry is asked");
    },
  };
  const grooph = (argv: string[], io = capture()): Promise<number> => run(argv, io, () => "", env);
  try {
    const out = join(dir, "try.grooph.json");
    const forced = capture();
    const sets = ["--set", "task=Add a slugify function.", "--set", "test-command=pnpm test", "--set", "checklist=docs/REVIEW-CHECKLIST.md"];
    assert.equal(await grooph(["template", "use", "review-gate", "--name", "Try it", ...sets, "--out", out], forced), 0, text(forced.stderr));
    assert.deepEqual(forced.stderr, [], "nothing left to ask");
    assert.equal(await grooph(["validate", "--for-export", out], capture()), 0);
    assert.equal(await grooph(["export", out, "--target", "claude-code", "--into", join(dir, "pkg")], capture()), 0);
    assert.ok(existsSync(join(dir, "pkg", ".grooph", "try-it", "LEAD.md")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

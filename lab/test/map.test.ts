/**
 * An operation map at the lab's command line (docs/operation-map.md; amendment A-011): `export` given a map says
 * what it is. Moved from packages/cli/test/map.test.ts when `export` left the product's command line (slice 0103);
 * the map's own commands (`validate`, `canonicalize`, `shape`, `image`, `share`) are tested there.
 */

import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import type { Output } from "@grooph/cli/print";

import { run } from "../src/index.js";
import { root as repoRoot } from "./root.js";

const sample = join(repoRoot, "fixtures", "maps", "valid", "owner-operation-2026-09-30.grooph-map.json");

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t) };
};
const text = (lines: string[]): string => lines.join("\n");
const grooph = (argv: string[], io = capture()) => run(argv, io, () => "", { openUrl: async () => {} });

test("a graph command given a map says what it is; export never takes one", async () => {
  const io = capture();
  assert.equal(await grooph(["export", sample, "--target", "claude-code", "--into", tmpdir()], io), 1);
  assert.match(text(io.stderr), /operation map/);
  assert.match(text(io.stderr), /never compiled/);
});

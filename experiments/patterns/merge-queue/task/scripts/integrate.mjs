/**
 * Integrates the queued batch: copies src/, tests/ and package.json into a
 * scratch directory, applies every `queued` patch of QUEUE.md there in order,
 * then runs the tests. Exit 0 only when every patch applies and the tests pass.
 * The tree itself is never changed.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { readQueue } from "./queue.mjs";

const root = resolve(".");
const queued = readQueue().filter((row) => row.status === "queued");
if (queued.length === 0) {
  console.log("integrate: nothing is queued");
  process.exit(0);
}
const scratch = mkdtempSync(join(tmpdir(), "textkit-integrate-"));
try {
  for (const name of ["src", "tests", "package.json"]) cpSync(join(root, name), join(scratch, name), { recursive: true });
  execFileSync("git", ["-C", scratch, "init", "-q"]);
  for (const row of queued) {
    const check = spawnSync("git", ["-C", scratch, "apply", "--check", join(root, row.patch)], { encoding: "utf8" });
    if (check.status !== 0) {
      console.log(`integrate: ${row.patch} does not apply on top of the batch so far:\n${check.stderr}`);
      process.exit(2);
    }
    execFileSync("git", ["-C", scratch, "apply", join(root, row.patch)]);
    console.log(`integrate: applied ${row.patch}`);
  }
  const tests = spawnSync("node", ["--test", "tests/*.test.mjs"], { cwd: scratch, encoding: "utf8" });
  process.stdout.write(tests.stdout);
  process.stderr.write(tests.stderr);
  console.log(`integrate: ${queued.length} change(s) applied; tests ${tests.status === 0 ? "pass" : "FAIL"}`);
  process.exit(tests.status === 0 ? 0 : 1);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

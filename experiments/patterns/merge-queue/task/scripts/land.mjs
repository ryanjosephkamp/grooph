/**
 * Lands the queued batch: applies every `queued` patch of QUEUE.md to the tree
 * itself, in order, marks each `landed`, and writes LANDED.txt. Irreversible by
 * intent: a human says when.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

import { readQueue } from "./queue.mjs";

const queued = readQueue().filter((row) => row.status === "queued");
if (queued.length === 0) {
  console.log("land: nothing is queued");
  process.exit(0);
}
for (const row of queued) execFileSync("git", ["apply", "--check", row.patch]);
let queue = readFileSync("QUEUE.md", "utf8");
for (const row of queued) {
  execFileSync("git", ["apply", row.patch]);
  queue = queue.replace(`| ${row.patch} | queued |`, `| ${row.patch} | landed |`);
  console.log(`land: applied ${row.patch}`);
}
writeFileSync("QUEUE.md", queue, "utf8");
writeFileSync("LANDED.txt", `${new Date().toISOString()} landed ${queued.map((row) => row.patch).join(", ")}\n`, "utf8");
console.log(`land: ${queued.length} change(s) landed`);

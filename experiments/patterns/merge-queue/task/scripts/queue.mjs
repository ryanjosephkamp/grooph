/** Reads QUEUE.md: the changes and their status, in landing order. */
import { readFileSync } from "node:fs";

export function readQueue(path = "QUEUE.md") {
  const rows = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^\|\s*(queue\/\S+\.patch)\s*\|\s*(queued|held|landed)\s*\|\s*(.*?)\s*\|\s*$/.exec(line);
    if (m) rows.push({ patch: m[1], status: m[2], note: m[3] });
  }
  return rows;
}

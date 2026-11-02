// Lead helper: append one JSON note line to notes.jsonl.
// Usage: node .grooph/word-wrap/runs/<run-id>/append-note.mjs '<json object>'
import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const line = JSON.stringify(JSON.parse(process.argv[2]));
appendFileSync(join(here, "notes.jsonl"), line + "\n");
console.log(line);

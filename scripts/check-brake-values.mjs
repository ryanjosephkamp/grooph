#!/usr/bin/env node
/**
 * No pattern restates a brake's value in prose (handoff 0009, criterion 7).
 *
 * A loop's stops are the only place its numbers live: a description, summary,
 * when-to-use line, brief or gate prompt that says "after four rounds" or "at
 * forty turns" goes stale the first time someone tightens a stop (review 0007,
 * finding 6). This script fails when any prose field of a document under
 * patterns/ pairs a count with a brake unit (rounds, iterations, turns, dispatches,
 * minutes, hours), whether or not the count matches a stop today. Words that name a brake
 * without its value ("at its round cap", "the turn budget") are fine.
 *
 *   node scripts/check-brake-values.mjs     exit 1 and list every hit (CI)
 *
 * It needs no build: it reads the JSON directly. Before scanning, it checks its
 * own matcher against a few known phrases, so a broken pattern cannot pass
 * everything silently.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "patterns");

const NUMBER_WORDS = [
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
  "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundred",
  "once", "twice",
];
const NUMBER = `(?:\\d+(?:\\.\\d+)?|(?:${NUMBER_WORDS.join("|")})(?:[- ](?:${NUMBER_WORDS.slice(0, 9).join("|")}))?)`;
const UNIT = "(?:rounds?|iterations?|turns?|dispatch(?:es)?|minutes?|mins?|hours?|hrs?)";
// A count, at most one word between (`five review rounds`, `30-minute`), then a unit.
const BRAKE_VALUE = new RegExp(`\\b${NUMBER}(?:[\\s-]+[a-z]+)?[\\s-]+${UNIT}\\b`, "gi");

function hits(text) {
  return [...text.matchAll(BRAKE_VALUE)].map((match) => match[0]);
}

// ── the matcher checks itself first ──────────────────────────────────────
const MUST_HIT = [
  "The loop stops after four rounds, or at forty turns.",
  "bounded by 30 minutes",
  "a 30-minute budget",
  "capped at five review rounds",
  "the human checks in every 2 rounds",
  "at most twenty-five turns",
  "a budget of twelve dispatches",
];
const MUST_PASS = [
  "The loop stops when the bar passes, at its round cap, or at its turn budget.",
  "The loop stops when the bar passes, at its round cap, or at its dispatch budget.",
  "On a later round, start from REVIEW.md.",
  "failing test output (from round 1 on)",
  "A planner turns the task into ACCEPTANCE.md.",
  "four critics review the same diff (at most four at a time)",
  "short enough to review in a minute",
];
const selfErrors = [
  ...MUST_HIT.filter((text) => hits(text).length === 0).map((text) => `matcher missed: ${JSON.stringify(text)}`),
  ...MUST_PASS.filter((text) => hits(text).length > 0).map((text) => `matcher flagged: ${JSON.stringify(text)} (${hits(text).join(", ")})`),
];
if (selfErrors.length > 0) {
  console.error(`check-brake-values: the matcher is broken\n  ${selfErrors.join("\n  ")}`);
  process.exit(2);
}

// ── the patterns ─────────────────────────────────────────────────────────
function proseFields(doc) {
  const fields = [
    ["description", doc.description],
    ["template.summary", doc.template?.summary],
    ["template.whenToUse", doc.template?.whenToUse],
    ["template.notFor", doc.template?.notFor],
  ];
  for (const node of doc.nodes ?? []) {
    if (typeof node.brief === "string") fields.push([`nodes.${node.id}.brief`, node.brief]);
    if (typeof node.prompt === "string") fields.push([`nodes.${node.id}.prompt`, node.prompt]);
  }
  return fields.filter(([, text]) => typeof text === "string");
}

const problems = [];
const files = readdirSync(dir).filter((name) => name.endsWith(".grooph.json")).sort();
for (const file of files) {
  let doc;
  try {
    doc = JSON.parse(readFileSync(join(dir, file), "utf8"));
  } catch (err) {
    problems.push(`${file}: not JSON (${err.message})`);
    continue;
  }
  for (const [field, text] of proseFields(doc)) {
    for (const phrase of hits(text)) problems.push(`${file} ${field}: "${phrase}"`);
  }
}

if (problems.length > 0) {
  console.error(
    `A pattern restates a brake's value in prose; the stops are the only place those numbers live.\n` +
      `Name the brake without its value ("at its round cap", "at its turn budget").\n  ${problems.join("\n  ")}`,
  );
  process.exit(1);
}
console.log(`no pattern restates a brake value (${files.length} patterns)`);

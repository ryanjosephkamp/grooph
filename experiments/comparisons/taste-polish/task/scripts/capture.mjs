/**
 * The capture for review: renders the statement, copies it into captures/ and
 * writes captures/CAPTURE.md, a readable account of what the text contains, so
 * the current revision can be judged from these two files alone.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderStatement } from "../src/statement.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data", "usage.json"), "utf8"));
const text = renderStatement(data);
mkdirSync(join(root, "out"), { recursive: true });
mkdirSync(join(root, "captures"), { recursive: true });
writeFileSync(join(root, "out", "statement.txt"), text, "utf8");
writeFileSync(join(root, "captures", "statement.txt"), text, "utf8");

const lines = text.replace(/\n$/, "").split("\n");
const widest = Math.max(...lines.map((line) => line.length));
const trailing = lines.filter((line) => /[ \t]+$/.test(line)).length;
const odd = [...new Set([...text].filter((ch) => ch !== "\n" && (ch < " " || ch > "~")))];
const digits = String(lines.length).length;
const summary = [
  `# Capture of the current revision`,
  ``,
  `- rendered at ${new Date().toISOString()} from src/statement.mjs, sha256 ${createHash("sha256").update(text).digest("hex").slice(0, 12)}`,
  `- file: captures/statement.txt, ${lines.length} lines, the widest ${widest} characters`,
  `- lines that end in a space or a tab: ${trailing}`,
  `- tabs: ${text.includes("\t") ? "yes" : "none"}`,
  `- characters outside plain ASCII: ${odd.length > 0 ? odd.map((ch) => `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`).join(", ") : "none"}`,
  ``,
  `## The statement, with line numbers and each line's length`,
  ``,
  "```text",
  ...lines.map((line, i) => `${String(i + 1).padStart(digits)} | ${String(line.length).padStart(2)} | ${line}`),
  "```",
  ``,
].join("\n");
writeFileSync(join(root, "captures", "CAPTURE.md"), summary, "utf8");
console.log(`captured captures/statement.txt and captures/CAPTURE.md (${lines.length} lines, the widest ${widest} characters)`);

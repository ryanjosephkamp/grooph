/**
 * The B prompt is derived, not written (docs/comparisons.md §3; handoff 0016,
 * criterion 2). From the package arm A runs — KICKOFF.md, LEAD.md, the agent
 * files and the instantiated graph document — this module produces the one
 * prompt arm B gets and the loop script arm C runs, by rule:
 *
 *   1. KICKOFF.md, then LEAD.md §1 (you are the lead), §2 (goal), §4 (nodes),
 *      §5 (edges), §6 (loops), §7 (gates), then every agent brief's role, brief,
 *      inputs, outputs and capabilities, in that order.
 *   2. grooph's mechanics removed, at the sentence: any sentence, list item or
 *      table row that names the run folder, a run id, PROGRESS.md, notes.jsonl
 *      or a note, the working copy, an amendment, the `grooph` CLI or the graph
 *      by that name, LEAD.md, MAPPING.md or the agent files (MECHANICS below).
 *      §3, §8, §9, §10 and §11 go whole. The goal paragraph is the task and is
 *      never filtered. The agent-file names `<graph>--<node>` become the node
 *      id, since B has no agent files: one generated sentence in §4 says the
 *      briefs are at the end and what a subagent is handed.
 *   3. each loop and its stops restated as one sentence of prose, from the
 *      graph document ("repeat until …, at most 4 rounds, at most 10 dispatches").
 *   4. each human gate restated as "stop and report when you reach this point;
 *      do not merge".
 *   5. the held-out folder is named exactly where the package names it (the task
 *      text, a checklist): nothing is added or removed, and `derive()` reports
 *      how many times it appears in the package and in the prompt.
 *
 * The C loop (protocol §3): the B prompt in a fresh headless session up to N
 * times, N the loop's round cap, each iteration told to continue from the
 * working tree and to stop when its own done check passes. `iterationPrompt`
 * is the text the runner sends, and `loopScript` the same loop as a shell script
 * committed beside the prompt for a reader; both come from here so they cannot
 * drift. An iteration says whether it is done on its last line
 * (`done: yes` | `done: no`), which is how the runner reads "the reply says done".
 *
 *   node scripts/lib/compare-prompt.mjs <scratch project> [--held-out <path>]   print the prompt
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** What rule 2 removes. Matched against one sentence, list item or table row at a time. */
export const MECHANICS =
  /PROGRESS\.md|notes\.jsonl|\.grooph\/|\bruns\/|\brun[- ]id\b|\brun folder\b|\bworking cop(?:y|ies)\b|\bamend|\bgrooph\b|MAPPING\.md|LEAD\.md|\.claude\/agents|\bprogress log\b|\bresum(?:e|es|ed|ing)\b|\bnotes?\b|\bmapping file\b|\bsource document\b/i;

const SECTIONS_KEPT = new Set([1, 2, 4, 5, 6, 7]);

// ── reading the package ──────────────────────────────────────────────────

/** The package under a scratch project: its graph id, documents, agent files. */
export function readPackage(scratch) {
  const groophDir = join(scratch, ".grooph");
  const ids = existsSync(groophDir) ? readdirSync(groophDir).filter((name) => existsSync(join(groophDir, name, "LEAD.md"))) : [];
  if (ids.length !== 1) throw new Error(`expected one package under ${groophDir}, found ${ids.length}`);
  const id = ids[0];
  const dir = join(groophDir, id);
  const doc = JSON.parse(readFileSync(join(dir, "graph.grooph.json"), "utf8"));
  const agentsDir = join(scratch, ".claude", "agents");
  const agents = {};
  for (const node of doc.nodes.filter((n) => n.kind === "agent")) {
    const file = join(agentsDir, `${id}--${node.id}.md`);
    if (existsSync(file)) agents[node.id] = readFileSync(file, "utf8");
  }
  return { id, dir, doc, kickoff: readFileSync(join(dir, "KICKOFF.md"), "utf8"), lead: readFileSync(join(dir, "LEAD.md"), "utf8"), agents };
}

// ── the sentence filter (rule 2) ─────────────────────────────────────────

/**
 * Split prose into sentences, keeping the separators, so the kept ones re-join
 * as written. A period ends a sentence only when whitespace and a sentence
 * start (a capital, a digit, a backtick, a bracket, a quote) follow it, so a
 * file name such as `src/truncate.mjs` does not split.
 */
export function sentences(text) {
  const out = [];
  const re = /[.!?]+["')\]`*]*(?=\s+[A-Z`*(\["'\d§]|\s*$)/g;
  let start = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    const end = m.index + m[0].length;
    const ws = text.slice(end).match(/^\s*/)[0];
    out.push(text.slice(start, end + ws.length));
    start = end + ws.length;
    re.lastIndex = start;
    if (start >= text.length) break;
  }
  if (start < text.length) out.push(text.slice(start));
  return out.filter((s) => s.trim() !== "");
}

/** A sentence that opens with a pronoun refers to the sentence before it, and goes with it when that one is removed. */
const REFERS_BACK = /^["'(]*(?:It|Its|That|This|These|Those|They|Their|Both|Either)\b/;

/** The sentences of `text` that name no mechanic, re-joined. */
export function filterSentences(text) {
  const kept = [];
  let dropped = false;
  for (const s of sentences(text)) {
    if (MECHANICS.test(s) || (dropped && REFERS_BACK.test(s.trim()))) {
      dropped = true;
      continue;
    }
    dropped = false;
    kept.push(s);
  }
  return kept.join("").trim();
}

/**
 * Apply rule 2 to a block of Markdown: prose paragraphs at the sentence, lists at
 * the item (each item's sentences filtered too), tables at the row, fenced code
 * dropped. Returns the filtered Markdown, possibly empty.
 */
export function filterBlock(markdown) {
  const blocks = markdown.split(/\n{2,}/);
  const kept = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    const lines = block.split("\n");
    if (lines[0].startsWith("```")) continue;
    // The goal paragraph is the task, the same in every arm: it passes as written (the header says so).
    if (i > 0 && /^\*\*Goal\.\*\*$/.test(blocks[i - 1].trim())) {
      kept.push(block);
      continue;
    }
    if (lines.every((l) => l.startsWith("|"))) {
      const [header, sep, ...rows] = lines;
      const body = rows.filter((row) => !MECHANICS.test(row));
      if (body.length > 0) kept.push([header, sep, ...body].join("\n"));
      continue;
    }
    if (lines.every((l) => /^(\s*[-*]\s|\s*\d+\.\s|>\s?)/.test(l))) {
      const items = [];
      let n = 0;
      for (const line of lines) {
        const m = line.match(/^(\s*)([-*]|\d+\.|>)\s?(.*)$/);
        const text = filterSentences(m[3]);
        if (!text) continue;
        const marker = /^\d+\.$/.test(m[2]) ? `${(n += 1)}.` : m[2];
        items.push(`${m[1]}${marker} ${text}`);
      }
      if (items.length > 0) kept.push(items.join("\n"));
      continue;
    }
    if (/^#{1,6}\s/.test(lines[0])) {
      kept.push(block);
      continue;
    }
    const text = filterSentences(lines.join(" "));
    if (text) kept.push(text);
  }
  return kept.join("\n\n").trim();
}

/** Drop a heading whose section came out empty. */
function dropEmptyHeadings(markdown) {
  const blocks = markdown.split(/\n{2,}/);
  const out = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const isHeading = /^#{1,6}\s/.test(blocks[i]);
    const next = blocks[i + 1];
    if (isHeading && (next === undefined || /^#{1,6}\s/.test(next))) {
      const level = blocks[i].match(/^(#+)/)[1].length;
      const nextLevel = next?.match(/^(#+)/)?.[1].length ?? 0;
      if (nextLevel <= level) continue;
    }
    out.push(blocks[i]);
  }
  return out.join("\n\n");
}

/** A bold lead-in ("**Before you touch anything:**") whose list was filtered away is dropped too. */
function dropOrphanLeadIns(markdown) {
  const blocks = markdown.split(/\n{2,}/);
  const out = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const leadIn = /^\*\*[^*]+:\*\*$/.test(blocks[i]);
    const next = blocks[i + 1];
    if (leadIn && !(next && /^(\s*[-*]\s|\s*\d+\.\s)/.test(next))) continue;
    out.push(blocks[i]);
  }
  return out.join("\n\n");
}

// ── LEAD.md sections ─────────────────────────────────────────────────────

/** LEAD.md split by its numbered `## n.` headings: { n: { heading, body } }. */
export function leadSections(lead) {
  const sections = {};
  const parts = lead.split(/^(?=## \d+\. )/m);
  for (const part of parts) {
    const m = part.match(/^## (\d+)\. ([^\n]*)\n([\s\S]*)$/);
    if (m) sections[Number(m[1])] = { heading: m[2].trim(), body: m[3].trim() };
  }
  return sections;
}

// ── rules 3 and 4: loops and gates from the graph document ───────────────

const tick = (s) => `\`${s}\``;
const list = (items) => items.map(tick).join(", ");

function passCondition(doc, loop) {
  if (loop.bar?.acceptance) return `the bar holds (${loop.bar.acceptance.trim().replace(/\.$/, "")})`;
  const checks = loop.members.map((id) => doc.nodes.find((n) => n.id === id)).filter((n) => n?.kind === "check");
  if (checks.length > 0) return checks.map((c) => `the check ${tick(c.id)} passes (${c.check?.pass ?? "it exits 0"})`).join(" and ");
  return "the work is done";
}

function stopClause(stop) {
  switch (stop.kind) {
    case "bar-passed":
      return null;
    case "max-iterations":
      return `at most ${stop.n} rounds`;
    case "budget":
      return `at most ${stop.limit} ${stop.measure}`;
    case "diminishing-returns":
      return `stop when ${stop.rounds} rounds in a row add no ${stop.metric ?? "progress"}`;
    case "evidence-invalid":
      return `stop after ${stop.n ?? 2} invalid-evidence verdicts`;
    case "human":
      return `stop and ask ${stop.at ? `at ${tick(stop.at)}` : "the human"}`;
    default:
      return `stop: ${stop.kind}`;
  }
}

/** Rule 3: one sentence per loop. */
export function loopSentence(doc, loop) {
  const back = (loop.back ?? []).map((id) => doc.edges.find((e) => e.id === id)).filter(Boolean);
  const round = back.length > 0 ? `a round is one traversal of ${back.map((e) => `${tick(e.id)} (${e.from} → ${e.to})`).join(" or ")}` : "a round is one pass through the members";
  const inspects = (loop.bar?.inspects ?? []).map((i) => `the ${i.kind} ${tick(i.ref)}`);
  const judged = inspects.length > 0 ? `, judged on ${inspects.join(" and ")}` : "";
  const stops = (loop.stops ?? []).map(stopClause).filter(Boolean);
  const caps = stops.length > 0 ? `; ${stops.join(", ")}; when a cap is reached, stop and report` : "";
  return `Loop ${tick(loop.id)} (members ${list(loop.members)}; ${round}): repeat until ${passCondition(doc, loop)}${judged}${caps}.`;
}

/** Rule 4: one line per human gate. */
export function gateSentence(node) {
  const prompt = node.prompt ? ` — ${node.prompt.trim().replace(/\.$/, "")}` : "";
  return `${tick(node.id)} (${node.name ?? node.id})${prompt}: stop and report when you reach this point; do not merge.`;
}

// ── the agent briefs ─────────────────────────────────────────────────────

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^"(.*)"$/, "$1");
  }
  return out;
}

function section(text, heading) {
  const re = new RegExp(`^## ${heading}\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, "m");
  const m = text.match(re);
  return m ? m[1].trim() : "";
}

/** One agent's block: its role, model and effort, then brief, inputs, outputs and capabilities as the agent file states them. */
export function briefBlock(node, agentFile) {
  const fm = frontmatter(agentFile);
  const head = `### ${node.name ?? node.id} — node ${tick(node.id)}, role ${node.role ?? "agent"}, model ${fm.model ?? "default"}, effort ${fm.effort ?? "default"}`;
  const parts = [head];
  for (const [heading, title] of [
    ["Brief", "Brief"],
    ["Inputs", "Inputs"],
    ["Outputs", "Outputs"],
    ["Capabilities", "Capabilities"],
  ]) {
    const body = section(agentFile, heading);
    if (body) parts.push(/^[-*]\s/.test(body) ? `**${title}.**\n\n${body}` : `**${title}.** ${body}`);
  }
  return parts.join("\n\n");
}

// ── the derivation ───────────────────────────────────────────────────────

/**
 * Derive the B prompt from a built package. `heldOut` is the held-out folder's
 * path as the package names it, for the rule-5 report. Returns { prompt, report }.
 */
export function derive(pkg, { heldOut } = {}) {
  const { id, doc, kickoff, lead, agents } = pkg;
  const agentNodes = doc.nodes.filter((n) => n.kind === "agent");
  const renameAgents = (text) => agentNodes.reduce((t, n) => t.replaceAll(`\`${id}--${n.id}\``, `\`${n.id}\``), text);

  const sections = leadSections(lead);
  const out = [];

  // 1. KICKOFF.md, filtered.
  out.push(dropOrphanLeadIns(filterBlock(renameAgents(kickoff))));

  // §1, §2 (goal never filtered), §4, §5, then §6 and §7 restated.
  for (const n of [1, 2, 4, 5, 6, 7]) {
    const sec = sections[n];
    if (!sec) continue;
    if (!SECTIONS_KEPT.has(n)) continue;
    let body;
    if (n === 4) {
      body = filterBlock(renameAgents(sec.body));
      body += `\n\nEach agent node's brief is in the Briefs section at the end of this prompt. When you dispatch one as a subagent, give it that brief with its model and effort, the task, its declared inputs and the evidence its edge lists, and nothing else.`;
    } else if (n === 6) {
      body = (doc.loops ?? []).map((loop) => loopSentence(doc, loop)).join("\n\n") || "No loop.";
    } else if (n === 7) {
      const gates = doc.nodes.filter((node) => node.kind === "human-gate");
      body = gates.length > 0 ? gates.map((g) => `- ${gateSentence(g)}`).join("\n") : "No human gate.";
    } else {
      body = filterBlock(renameAgents(sec.body));
    }
    if (body.trim()) out.push(`## ${sec.heading}\n\n${body.trim()}`);
  }

  // The agent briefs, in graph order.
  const briefs = agentNodes.filter((n) => agents[n.id]).map((n) => briefBlock(n, agents[n.id]));
  if (briefs.length > 0) out.push(`## Briefs\n\n${briefs.join("\n\n")}`);

  const prompt = `${dropEmptyHeadings(out.join("\n\n")).trim()}\n`;
  const count = (text, needle) => (needle ? text.split(needle).length - 1 : 0);
  const report = {
    graph: id,
    sections_kept: [1, 2, 4, 5, 6, 7].filter((n) => sections[n]),
    agents: agentNodes.map((n) => n.id),
    loops: (doc.loops ?? []).map((l) => l.id),
    gates: doc.nodes.filter((n) => n.kind === "human-gate").map((n) => n.id),
    held_out_mentions: heldOut ? { package: count(`${kickoff}${lead}${Object.values(agents).join("")}`, heldOut), prompt: count(prompt, heldOut) } : null,
    mechanics_left: [...prompt.matchAll(new RegExp(MECHANICS.source, "gi"))].map((m) => m[0]),
  };
  return { prompt, report };
}

/** N for arm C: the main loop's round cap (its `max-iterations`), the largest when there are several loops. */
export function roundCap(doc) {
  const caps = (doc.loops ?? []).flatMap((loop) => (loop.stops ?? []).filter((s) => s.kind === "max-iterations").map((s) => s.n));
  if (caps.length === 0) throw new Error("the graph has no max-iterations stop, so arm C has no N");
  return Math.max(...caps);
}

/** The sentence every iteration of arm C ends with, and how the runner reads the reply. */
export const DONE_LINE = "End your reply with one line on its own, `done: yes` if your done check passes (or the instructions above told you to stop and report at a point you have reached, and you have) and there is nothing left for another session to do, otherwise `done: no`.";

/** The prompt of iteration `i` of `n` in arm C (protocol §3). */
export function iterationPrompt(prompt, i, n) {
  return `${prompt.trimEnd()}\n\nIteration ${i} of ${n}. Continue from the working tree as it is. Stop when your done check passes. ${DONE_LINE}\n`;
}

/** Does an iteration's reply say done? Reads the last non-empty line. */
export function saysDone(reply) {
  const lines = String(reply ?? "")
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const last = lines[lines.length - 1] ?? "";
  return /^`?done:\s*yes`?\.?$/i.test(last);
}

/** The C loop as a shell script, committed beside the prompt so a reader can see exactly what runs. The runner performs the same loop through the ledger. */
export function loopScript({ project, n, testCommand }) {
  return `#!/usr/bin/env bash
#
# Arm C for ${project} (docs/comparisons.md §3): the B prompt piped into a fresh
# headless session up to N=${n} times, N being the template's round cap. Each
# iteration is told to continue from the working tree as it is and to stop when
# its own done check passes; the loop ends early when the reply's last line is
# 'done: yes' and the test command passes.
#
# This file is generated by scripts/lib/compare-prompt.mjs from the same
# function the runner uses (iterationPrompt), so the two cannot drift. The
# runner (scripts/compare.sh <project> C) performs this loop itself so that
# every iteration is a line in experiments/comparisons/ledger.json with its
# own --max-budget-usd; run this script by hand only outside the study.
#
# Usage: loop-C.sh <scratch project> <settings.json> <max budget usd per iteration>
set -euo pipefail
HERE="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
SCRATCH="\${1:?scratch project}"
SETTINGS="\${2:?settings json file}"
BUDGET="\${3:?max budget usd per iteration}"
N=${n}
PROMPT="$(cat "$HERE/prompt-B.md")"
DONE_LINE=${JSON.stringify(DONE_LINE)}
cd "$SCRATCH"
for i in $(seq 1 "$N"); do
  claude -p "$PROMPT

Iteration $i of $N. Continue from the working tree as it is. Stop when your done check passes. $DONE_LINE" \\
    --permission-mode acceptEdits --output-format json --settings "$(cat "$SETTINGS")" \\
    --max-budget-usd "$BUDGET" --strict-mcp-config --model claude-opus-5 --effort high \\
    > "../$(basename "$SCRATCH").harness/claude-output-$i.json"
  reply="$(node -e 'const o=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(String(o.result??""))' "../$(basename "$SCRATCH").harness/claude-output-$i.json")"
  last="$(printf '%s\\n' "$reply" | sed -e 's/[[:space:]]*$//' | grep -v '^$' | tail -1)"
  if printf '%s' "$last" | grep -qiE '^\`?done:[[:space:]]*yes\`?\\.?$' && ${testCommand}; then
    echo "iteration $i says done and the tests pass; stopping"
    break
  fi
done
`;
}

// ── CLI ──────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [scratch, ...rest] = process.argv.slice(2);
  if (!scratch) {
    console.error("usage: compare-prompt.mjs <scratch project> [--held-out <path>] [--report]");
    process.exit(64);
  }
  const at = rest.indexOf("--held-out");
  const { prompt, report } = derive(readPackage(scratch), { heldOut: at >= 0 ? rest[at + 1] : undefined });
  process.stdout.write(prompt);
  if (rest.includes("--report")) console.error(JSON.stringify(report, null, 2));
}

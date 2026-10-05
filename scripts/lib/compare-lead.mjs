/**
 * Where the lead's cost goes in study two, arm A (the package) beside arm B (the same design as prose): every request
 * the lead session made to the model, what it was for, and what it cost. Derived after the runs and labeled so; it is
 * not evidence of them, and it starts no model session.
 *
 * A run's record keeps what the harness reported for the whole session (`claude-output.json`) and the lead's tool uses
 * in order (`transcript-digest.json`). Neither says which request a tool use belonged to or what that request cost.
 * The harness's own transcripts do (under ~/.claude/projects, where the harness keeps them): each request carries its
 * token counts. This script reads them and keeps counts and kinds only: no prompt, no reply, no file content.
 *
 *   a call     one request the lead made to the model. It may hold several tool uses; the harness's "turns" count
 *              tool uses, so a run of 36 turns here is 24 calls
 *   a kind     what the call was for, from its tool uses: the first of ORDER that any of them is
 *   a phase    setup (before the first dispatch), cycle k (dispatch k and every call up to the next dispatch), reply
 *   read       the tokens the call read back: the whole context so far, at the cached rate
 *   added      what the call added to the context (its own output and its tools' results). The harness writes that to
 *              the cache on the next call, so the next call's cache write is charged to the call that caused it; the
 *              first call's own cache write is the prompt as given, and has a row of its own
 *   output     the tokens the call wrote
 *   read back later   what the calls after it paid to read back what a call added: the same read-back money, filed by
 *              whose tokens were read instead of by which call read them
 *   refused    a tool use the harness refused. It is still filed by what it asked for
 *
 * The rates are not the harness's to tell: they are the ones that reproduce every reported per-model cost of these
 * runs to the cent, and each run's row says whether they did.
 *
 *   node scripts/lib/compare-lead.mjs              read the transcripts, print the tables
 *   node scripts/lib/compare-lead.mjs --write      and keep experiments/comparisons/derived/lead-cost.json and the tables in lead-cost.md
 *   node scripts/lib/compare-lead.mjs --check      no transcripts needed: the tables in lead-cost.md are the ones lead-cost.json gives
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sessionTranscripts } from "./prove-evidence.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const comparisons = join(root, "experiments", "comparisons");
const derived = join(comparisons, "derived");
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR ?? join(process.env.HOME ?? "", ".claude");

export const PROJECTS = ["review-gate-2", "heterogeneous-critic", "taste-polish"];
export const RUNS = ["A-1", "A-2", "B-1", "B-2"];

/** Dollars per million tokens, as these runs were billed. Sonnet's one-hour write was never used here and is not checked. */
export const RATES = {
  "claude-opus-5-5": { input: 4, output: 20, cache_read: 0.2, cache_write_1h: 8, cache_write_5m: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cache_read: 0.2, cache_write_1h: 4, cache_write_5m: 2.5 },
};

/** A call is filed under the first of these that any of its tool uses is; with no tool use it is the reply, or text. */
export const ORDER = ["dispatch", "amendment", "note", "progress", "report", "brief", "run-folder", "check", "started-line", "clock"];

export const KIND_NAMES = {
  prompt: "the prompt as given, with what the harness adds to it, written to the cache once",
  brief: "reading the brief, the graph and the agent files",
  "run-folder": "making the run folder and the working copy",
  amendment: "amending the working copy, and validating it",
  "started-line": "a `started` line and nothing else",
  clock: "a clock read and nothing else",
  note: "a node's note (often with the progress file)",
  progress: "the progress file on its own",
  report: "keeping a copy of a round's report",
  check: "looking at the work, and gathering a reviewer's evidence",
  dispatch: "dispatching a node",
  reply: "the final reply",
  text: "text with no tool use, before the end",
};

// ── reading a transcript ─────────────────────────────────────────────────

/** Every request in one transcript, in order: its model, its token counts and its tool uses. Records of one request share an id. */
export function apiCalls(file) {
  const calls = new Map();
  const refused = new Set();
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (record.type === "user" && Array.isArray(record.message?.content)) for (const block of record.message.content) if (block.type === "tool_result" && block.is_error === true) refused.add(block.tool_use_id);
    const message = record.type === "assistant" ? record.message : null;
    if (!message?.id || !message.usage || !RATES[message.model]) continue;
    const call = calls.get(message.id) ?? { model: message.model, tokens: { input: 0, cache_read: 0, cache_write_1h: 0, cache_write_5m: 0, output: 0 }, uses: [], text: false };
    const usage = message.usage;
    const split = usage.cache_creation ?? { ephemeral_1h_input_tokens: usage.cache_creation_input_tokens ?? 0 };
    const seen = { input: usage.input_tokens, cache_read: usage.cache_read_input_tokens, cache_write_1h: split.ephemeral_1h_input_tokens, cache_write_5m: split.ephemeral_5m_input_tokens, output: usage.output_tokens };
    for (const key of Object.keys(call.tokens)) call.tokens[key] = Math.max(call.tokens[key], seen[key] ?? 0);
    for (const block of Array.isArray(message.content) ? message.content : []) {
      if (block.type === "tool_use") call.uses.push({ id: block.id, name: block.name, input: block.input ?? {} });
      if (block.type === "text" && block.text?.trim()) call.text = true;
    }
    calls.set(message.id, call);
  }
  for (const call of calls.values()) for (const use of call.uses) use.refused = refused.has(use.id);
  return [...calls.values()];
}

export const usd = (tokens, rates) => ({
  read: (tokens.cache_read * rates.cache_read + tokens.input * rates.input) / 1e6,
  write: (tokens.cache_write_1h * rates.cache_write_1h + tokens.cache_write_5m * rates.cache_write_5m) / 1e6,
  output: (tokens.output * rates.output) / 1e6,
});

// ── what a tool use was for ──────────────────────────────────────────────

const RUN_FOLDER = /\.grooph\/[^/\s'"]+\/runs\/[^/\s'"]+\//;
const PACKAGE_FILE = /\.grooph\/[^/\s'"]+\/(?:LEAD|KICKOFF|MAPPING)\.md$|\.grooph\/[^/\s'"]+\/graph\.grooph\.json$|\.claude\/agents\/[^/\s'"]+\.md$/;
const count = (text, pattern) => (text.match(pattern) ?? []).length;

/** A write to the notes that adds `started` lines and no other line: the most a hook could take off the lead whole. */
export function onlyStarted(added) {
  const lines = count(added, /\\?"id\\?"\s*:\s*\\?"n-/g);
  return lines > 0 && lines === count(added, /\\?"outcome\\?"\s*:\s*\\?"started\\?"/g);
}

/** What an edit added: the lines of the new text that the old text did not have. */
const addedBy = (input) => {
  const old = new Set(String(input.old_string ?? "").split("\n"));
  return String(input.new_string ?? input.content ?? "").split("\n").filter((line) => !old.has(line)).join("\n");
};

/** How much the lead wrote to make a tool use, in characters: the size of every argument it sent, never the text. */
export const written = ({ input = {} }) => Object.values(input).reduce((sum, value) => sum + (typeof value === "string" ? value : JSON.stringify(value) ?? "").length, 0);

export function kindOfUse({ name, input = {} }) {
  if (name === "Agent" || name === "Task") return "dispatch";
  if (name === "Bash") {
    const command = String(input.command ?? "");
    if (/notes\.jsonl/.test(command) && />/.test(command)) return onlyStarted(command) ? "started-line" : "note";
    if (/PROGRESS\.md/.test(command) && />/.test(command)) return "progress";
    if (/(?:^|[\s;&|(])grooph(?:[\s;&|)]|$)/.test(command)) return "amendment";
    if (/\bmkdir\b/.test(command) && RUN_FOLDER.test(`${command}/`)) return "run-folder";
    if (/\bcp\b[^;&|]*graph\.grooph\.json[^;&|]*graph\.grooph\.json/.test(command)) return "run-folder";
    if (/\bdate\b[^;&|]*%Y%m%d-%H%M%S/.test(command)) return "run-folder";
    if (/(?:^|[\s;&|(])(?:cp|mv)\s/.test(command) && RUN_FOLDER.test(command)) return "report";
    if (/^\s*date\b/.test(command)) return "clock";
    if (/^\s*ls\b/.test(command) && /\.grooph|\.claude/.test(command)) return "brief";
    return "check";
  }
  const path = String(input.file_path ?? "");
  const reads = name === "Read";
  if (RUN_FOLDER.test(path)) {
    if (path.endsWith("/graph.grooph.json")) return reads ? "brief" : "amendment";
    if (reads) return "check";
    if (path.endsWith("/notes.jsonl")) return onlyStarted(addedBy(input)) ? "started-line" : "note";
    if (path.endsWith("/PROGRESS.md")) return "progress";
    return "report";
  }
  if (PACKAGE_FILE.test(path)) return reads ? "brief" : "amendment";
  return reads ? "check" : "other";
}

/** The kind of a call: the first of ORDER among its tool uses. The last call with no tool use is the reply. */
export function kindOfCall(kinds, isLast) {
  if (kinds.length === 0) return isLast ? "reply" : "text";
  return ORDER.find((kind) => kinds.includes(kind)) ?? "other";
}

// ── one lead session ─────────────────────────────────────────────────────

const round = (value, places = 6) => Number(value.toFixed(places));

/**
 * The lead's calls as rows: the kind, the phase, the context the call was made at, and its three costs. Row 0 is the
 * prompt as given (the first call's cache write). Each later call is charged the next call's cache write as `added`.
 */
export function leadRows(calls) {
  const rates = (call) => RATES[call.model];
  const kinds = calls.map((call) => call.uses.map(kindOfUse));
  const sizes = calls.map((call) => call.uses.map(written));
  const kind = kinds.map((list, i) => kindOfCall(list, i === calls.length - 1));
  const rows = [];
  if (calls.length === 0) return rows;
  const promptTokens = calls[0].tokens.cache_write_1h + calls[0].tokens.cache_write_5m;
  rows.push({ n: 0, phase: "setup", kind: "prompt", uses: [], tools: [], refused: 0, characters_sent: [], context: null, tokens: { read: 0, added: promptTokens, output: 0 }, usd: { read: 0, added: round(usd(calls[0].tokens, rates(calls[0])).write), output: 0 } });
  let cycle = 0;
  calls.forEach((call, i) => {
    if (kind[i] === "dispatch") cycle += 1;
    const next = calls[i + 1];
    const own = usd(call.tokens, rates(call));
    const added = next ? usd(next.tokens, rates(next)).write : 0;
    rows.push({
      n: i + 1,
      phase: kind[i] === "reply" ? "reply" : cycle === 0 ? "setup" : `cycle ${cycle}`,
      kind: kind[i],
      uses: kinds[i],
      tools: call.uses.map((use) => use.name),
      refused: call.uses.filter((use) => use.refused).length,
      characters_sent: sizes[i],
      context: call.tokens.input + call.tokens.cache_read + call.tokens.cache_write_1h + call.tokens.cache_write_5m,
      tokens: { read: call.tokens.cache_read + call.tokens.input, added: next ? next.tokens.cache_write_1h + next.tokens.cache_write_5m : 0, output: call.tokens.output },
      usd: { read: round(own.read), added: round(added), output: round(own.output) },
    });
  });
  // What a call added is written by the next call and read back by every call after that one. The prompt is read back by every call but the first.
  const readRate = rates(calls[0]).cache_read / 1e6;
  for (const row of rows) {
    row.usd.total = round(row.usd.read + row.usd.added + row.usd.output);
    const later = row.n === 0 ? calls.length - 1 : Math.max(0, calls.length - row.n - 1);
    row.read_back_later = { tokens: row.tokens.added * later, usd: round(row.tokens.added * later * readRate) };
  }
  return rows;
}

const sumBy = (rows, key) => {
  const out = {};
  for (const row of rows) {
    const cell = (out[row[key]] ??= { calls: 0, tokens: { read: 0, added: 0, output: 0 }, usd: { read: 0, added: 0, output: 0, total: 0 } });
    if (row.kind !== "prompt") cell.calls += 1;
    for (const part of ["read", "added", "output"]) cell.tokens[part] += row.tokens[part];
    for (const part of ["read", "added", "output", "total"]) cell.usd[part] = round(cell.usd[part] + row.usd[part]);
  }
  return out;
};

/** The lead's read-back cost filed by whose tokens were read: what every session starts with, then each kind of call by what it added. */
function readBackByOrigin(rows, calls) {
  const out = { start: { tokens: (calls[0]?.tokens.read ?? 0) * calls.length, usd: 0 } };
  const rate = calls.length > 0 && calls[0].tokens.read > 0 ? calls[0].usd.read / calls[0].tokens.read : 0;
  out.start.usd = round(out.start.tokens * rate);
  for (const row of rows) {
    const cell = (out[row.kind] ??= { tokens: 0, usd: 0 });
    cell.tokens += row.read_back_later.tokens;
    cell.usd = round(cell.usd + row.read_back_later.usd);
  }
  return out;
}

/** One run: the lead by call, by kind and by phase; the subagents' cost; and whether the rates gave the reported cost back. */
export function leadOfRun(project, run, claudeDir = CLAUDE_DIR) {
  const dir = join(comparisons, project, run);
  const result = JSON.parse(readFileSync(join(dir, "result.json"), "utf8"));
  const reported = JSON.parse(readFileSync(join(dir, "claude-output.json"), "utf8"));
  const transcripts = sessionTranscripts(claudeDir, result.invocations[0].session_id);
  const lead = transcripts.find((t) => t.who === "lead");
  if (!lead) return { run: `${project}/${run}`, project, arm: result.arm, replicate: result.replicate, transcripts_found: 0 };
  const computed = {};
  const subagents = { transcripts: 0, calls: 0, usd: 0 };
  for (const transcript of transcripts) {
    const calls = apiCalls(transcript.file);
    for (const call of calls) {
      const cost = usd(call.tokens, RATES[call.model]);
      computed[call.model] = (computed[call.model] ?? 0) + cost.read + cost.write + cost.output;
      if (transcript !== lead) subagents.usd += cost.read + cost.write + cost.output;
    }
    if (transcript !== lead) {
      subagents.transcripts += 1;
      subagents.calls += calls.length;
    }
  }
  const byModel = Object.fromEntries(Object.entries(reported.modelUsage ?? {}).map(([model, use]) => [model, { reported_usd: round(use.costUSD), computed_usd: round(computed[model] ?? 0) }]));
  const rows = leadRows(apiCalls(lead.file));
  const calls = rows.filter((row) => row.kind !== "prompt");
  const total = (part) => round(rows.reduce((sum, row) => sum + row.usd[part], 0));
  const firstDispatch = calls.find((row) => row.kind === "dispatch");
  const usesByKind = {};
  const charactersByKind = {};
  for (const row of calls) {
    row.uses.forEach((kind, i) => {
      usesByKind[kind] = (usesByKind[kind] ?? 0) + 1;
      charactersByKind[kind] = (charactersByKind[kind] ?? 0) + row.characters_sent[i];
    });
  }
  return {
    run: `${project}/${run}`,
    project,
    arm: result.arm,
    replicate: result.replicate,
    transcripts_found: transcripts.length,
    reported_usd: round(result.cost_usd),
    harness_turns: result.harness_turns,
    rates_give_the_reported_cost_back: Object.values(byModel).every((m) => Math.abs(m.reported_usd - m.computed_usd) < 0.005),
    furthest_from_reported_usd: round(Math.max(...Object.values(byModel).map((m) => Math.abs(m.reported_usd - m.computed_usd)))),
    by_model: byModel,
    lead: {
      calls: calls.length,
      tool_uses: calls.reduce((sum, row) => sum + row.uses.length, 0),
      dispatches: usesByKind.dispatch ?? 0,
      refused_tool_uses: calls.reduce((sum, row) => sum + row.refused, 0),
      usd: { read: total("read"), added: total("added"), output: total("output"), total: total("total") },
      context_at_first_call: calls[0]?.tokens.read ?? null,
      context_at_first_dispatch: firstDispatch?.context ?? null,
      context_at_reply: calls.at(-1)?.context ?? null,
    },
    subagents: { ...subagents, usd: round(subagents.usd) },
    uses_by_kind: usesByKind,
    characters_sent_by_kind: charactersByKind,
    by_kind: sumBy(rows, "kind"),
    by_phase: sumBy(rows, "phase"),
    read_back_by_origin: readBackByOrigin(rows, calls),
    setup_by_kind: sumBy(rows.filter((row) => row.phase === "setup"), "kind"),
    rows,
  };
}

// ── the tables ───────────────────────────────────────────────────────────

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const money = (value, places = 3) => `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(places)}`;
const signed = (value, places = 3) => `${value < 0 ? "−" : "+"}$${Math.abs(value).toFixed(places)}`;
const num = (value, places = 1) => (Number.isInteger(value) ? String(value) : value.toFixed(places));
const thousands = (value) => Math.round(value).toLocaleString("en-US");
const span = (values, show = String) => (Math.min(...values) === Math.max(...values) ? show(values[0]) : `${show(Math.min(...values))} to ${show(Math.max(...values))}`);
const table = (head, lines) => [`| ${head.join(" | ")} |`, `|${head.map((_, i) => (i === 0 ? "---" : "---:")).join("|")}|`, ...lines.map((line) => `| ${line.join(" | ")} |`)].join("\n");
const cellOf = (run, group, key) => run[group][key] ?? { calls: 0, tokens: { read: 0, added: 0, output: 0 }, usd: { read: 0, added: 0, output: 0, total: 0 } };

/** Calls a hook could take off the lead: those that were only a clock read, only a `started` line, or both. */
export const hookCalls = (run) => run.rows.filter((row) => row.kind === "started-line" || row.kind === "clock");
/** The same, with the calls that only rewrote the progress file (a file a tool could render from the notes). */
export const renderCalls = (run) => run.rows.filter((row) => row.uses.length > 0 && row.uses.every((kind) => kind === "started-line" || kind === "clock" || kind === "progress"));
/** What a script that dispatches and keeps the record would leave the lead: the prompt, its amendments and its reply. */
export const scriptCalls = (run) => run.rows.filter((row) => !["prompt", "amendment", "reply"].includes(row.kind));

export function tables(data) {
  const runs = data.runs.filter((run) => run.transcripts_found > 0);
  const arm = (letter) => runs.filter((run) => run.arm === letter);
  const A = arm("A");
  const B = arm("B");
  const out = [];

  out.push("**Table 1. Each run: what the harness reported, and the lead's share of it.** A call is one request to the model; the harness's turns count tool uses.");
  out.push(
    table(
      ["run", "reported", "lead", "subagents", "turns", "lead's calls", "its tool uses", "dispatches", "context at first dispatch", "at the reply"],
      [
        ...runs.map((run) => [`\`${run.run}\``, money(run.reported_usd), money(run.lead.usd.total), money(run.subagents.usd), run.harness_turns, run.lead.calls, run.lead.tool_uses, run.lead.dispatches, thousands(run.lead.context_at_first_dispatch), thousands(run.lead.context_at_reply)]),
        ...[["A", A], ["B", B]].map(([name, list]) => [`**mean of ${name}**`, `**${money(mean(list.map((r) => r.reported_usd)))}**`, `**${money(mean(list.map((r) => r.lead.usd.total)))}**`, `**${money(mean(list.map((r) => r.subagents.usd)))}**`, num(mean(list.map((r) => r.harness_turns))), num(mean(list.map((r) => r.lead.calls))), num(mean(list.map((r) => r.lead.tool_uses))), num(mean(list.map((r) => r.lead.dispatches))), thousands(mean(list.map((r) => r.lead.context_at_first_dispatch))), thousands(mean(list.map((r) => r.lead.context_at_reply)))]),
      ],
    ),
  );

  out.push("**Table 2. A less B, by project (each the mean of two runs).** The lead's difference is then split by what was paid for.");
  const diff = (project, pick) => mean(A.filter((r) => r.project === project).map(pick)) - mean(B.filter((r) => r.project === project).map(pick));
  const projects = [...new Set(runs.map((run) => run.project))];
  const allDiff = (pick) => mean(A.map(pick)) - mean(B.map(pick));
  out.push(
    table(
      ["project", "whole run", "subagents", "lead", "lead: reading the context back", "lead: adding to the context", "lead: output"],
      [
        ...projects.map((p) => [`\`${p}\``, signed(diff(p, (r) => r.reported_usd)), signed(diff(p, (r) => r.subagents.usd)), signed(diff(p, (r) => r.lead.usd.total)), signed(diff(p, (r) => r.lead.usd.read)), signed(diff(p, (r) => r.lead.usd.added)), signed(diff(p, (r) => r.lead.usd.output))]),
        ["**all three**", ...[(r) => r.reported_usd, (r) => r.subagents.usd, (r) => r.lead.usd.total, (r) => r.lead.usd.read, (r) => r.lead.usd.added, (r) => r.lead.usd.output].map((pick) => `**${signed(allDiff(pick))}**`)],
      ],
    ),
  );

  out.push("**Table 3. The lead's calls by what each was for: the mean of a run, six runs an arm.** Tokens in thousands. A call with several tool uses is filed once, under the first kind in the script's order.");
  const kinds = ["prompt", "brief", "run-folder", "amendment", "started-line", "clock", "note", "progress", "report", "check", "dispatch", "reply", "text", "other"].filter((kind) => runs.some((run) => run.by_kind[kind]));
  const kindLine = (kind, name) => {
    const a = (pick) => mean(A.map((run) => pick(cellOf(run, "by_kind", kind))));
    const b = (pick) => mean(B.map((run) => pick(cellOf(run, "by_kind", kind))));
    const inSetup = mean(A.map((run) => cellOf(run, "setup_by_kind", kind).usd.total));
    return [name, num(a((c) => c.calls)), (a((c) => c.tokens.read) / 1000).toFixed(1), (a((c) => c.tokens.added) / 1000).toFixed(1), (a((c) => c.tokens.output) / 1000).toFixed(1), money(a((c) => c.usd.total)), money(inSetup), num(b((c) => c.calls)), money(b((c) => c.usd.total)), signed(a((c) => c.usd.total) - b((c) => c.usd.total))];
  };
  const sumOf = (pick) => (run) => run.rows.reduce((sum, row) => sum + pick(row), 0);
  const totalLine = ["**the lead, whole**", num(mean(A.map((r) => r.lead.calls))), (mean(A.map(sumOf((row) => row.tokens.read))) / 1000).toFixed(1), (mean(A.map(sumOf((row) => row.tokens.added))) / 1000).toFixed(1), (mean(A.map(sumOf((row) => row.tokens.output))) / 1000).toFixed(1), `**${money(mean(A.map((r) => r.lead.usd.total)))}**`, money(mean(A.map((run) => cellOf(run, "by_phase", "setup").usd.total))), num(mean(B.map((r) => r.lead.calls))), `**${money(mean(B.map((r) => r.lead.usd.total)))}**`, `**${signed(allDiff((r) => r.lead.usd.total))}**`];
  out.push(table(["what the call was for", "A: calls", "A: read back", "A: added", "A: output", "A: cost", "of that, before the first dispatch", "B: calls", "B: cost", "A less B"], [...kinds.map((kind) => kindLine(kind, KIND_NAMES[kind] ?? kind)), totalLine]));

  out.push("**Table 4. The same cost by where in the run it fell.** Setup is everything before the first dispatch, the prompt included; a cycle is one dispatch and every call after it up to the next.");
  const phases = ["setup", ...[...new Set(runs.flatMap((run) => Object.keys(run.by_phase)))].filter((p) => p.startsWith("cycle")).sort((x, y) => Number(x.slice(6)) - Number(y.slice(6))), "reply"];
  const phaseLine = (phase) => {
    const a = (pick) => mean(A.map((run) => pick(cellOf(run, "by_phase", phase))));
    const b = (pick) => mean(B.map((run) => pick(cellOf(run, "by_phase", phase))));
    return [phase, num(a((c) => c.calls)), money(a((c) => c.usd.total)), num(b((c) => c.calls)), money(b((c) => c.usd.total)), signed(a((c) => c.usd.total) - b((c) => c.usd.total))];
  };
  const once = (run) => cellOf(run, "by_phase", "setup").usd.total + cellOf(run, "by_phase", "reply").usd.total;
  const repeating = (run) => run.lead.usd.total - once(run);
  out.push(
    table(
      ["phase", "A: calls", "A: cost", "B: calls", "B: cost", "A less B"],
      [
        ...phases.map(phaseLine),
        ["**paid once** (setup and reply)", "", `**${money(mean(A.map(once)))}**`, "", `**${money(mean(B.map(once)))}**`, `**${signed(allDiff(once))}**`],
        ["**paid again each dispatch** (the cycles)", "", `**${money(mean(A.map(repeating)))}**`, "", `**${money(mean(B.map(repeating)))}**`, `**${signed(allDiff(repeating))}**`],
      ],
    ),
  );

  const onceShare = (list) => (mean(list.filter((r) => r.arm === "A").map(once)) - mean(list.filter((r) => r.arm === "B").map(once))) / (mean(list.filter((r) => r.arm === "A").map((r) => r.lead.usd.total)) - mean(list.filter((r) => r.arm === "B").map((r) => r.lead.usd.total)));
  out.push(`Of A less B, the part paid once is ${Math.round(100 * onceShare(runs))}% over all three projects, and by project ${projects.map((p) => `${Math.round(100 * onceShare(runs.filter((r) => r.project === p)))}%`).join(", ")}.`);

  out.push("**Table 5. What the lead did, counted by tool use: the mean of a run, with the range.** Characters sent is the size of the arguments the lead wrote to make those tool uses (a note's line, a file's new text, a dispatch's prompt): where its output went.");
  const useKinds = ["brief", "run-folder", "amendment", "started-line", "clock", "note", "progress", "report", "check", "dispatch", "other"].filter((kind) => runs.some((run) => run.uses_by_kind[kind]));
  const useNames = { ...KIND_NAMES, "started-line": "a write of `started` lines only", clock: "a clock read", note: "a write to the notes", progress: "a write of the progress file" };
  const sent = (list, kind) => thousands(mean(list.map((r) => r.characters_sent_by_kind[kind] ?? 0)));
  out.push(
    table(
      ["tool use", "A", "A: range", "A: characters sent", "B", "B: range", "B: characters sent"],
      [
        ...useKinds.map((kind) => [useNames[kind] ?? kind, num(mean(A.map((r) => r.uses_by_kind[kind] ?? 0))), span(A.map((r) => r.uses_by_kind[kind] ?? 0)), sent(A, kind), num(mean(B.map((r) => r.uses_by_kind[kind] ?? 0))), span(B.map((r) => r.uses_by_kind[kind] ?? 0)), sent(B, kind)]),
        ["**all**", num(mean(A.map((r) => r.lead.tool_uses))), span(A.map((r) => r.lead.tool_uses)), thousands(mean(A.map((r) => Object.values(r.characters_sent_by_kind).reduce((x, y) => x + y, 0)))), num(mean(B.map((r) => r.lead.tool_uses))), span(B.map((r) => r.lead.tool_uses)), thousands(mean(B.map((r) => Object.values(r.characters_sent_by_kind).reduce((x, y) => x + y, 0))))],
      ],
    ),
  );

  const refusedCalls = (run) => run.rows.filter((row) => row.uses.length > 0 && row.refused === row.uses.length);
  const sumRefused = (list) => list.reduce((sum, r) => sum + r.lead.refused_tool_uses, 0);
  out.push(`The harness refused ${sumRefused(A)} of arm A's ${A.reduce((sum, r) => sum + r.lead.tool_uses, 0)} tool uses over the six runs and ${sumRefused(B)} of arm B's. They are counted above by what they asked for. ${A.reduce((sum, r) => sum + refusedCalls(r).length, 0)} of A's calls held nothing but refused uses, and cost ${money(mean(A.map((r) => refusedCalls(r).reduce((sum, row) => sum + row.usd.total, 0))))} a run.`);

  out.push("**Table 6. The lead's context, and what one more call costs to read it back.** Tokens.");
  const growth = (run) => (run.lead.context_at_reply - run.lead.context_at_first_dispatch) / Math.max(1, run.lead.dispatches);
  const perCycleCalls = (run) => run.rows.filter((row) => row.phase.startsWith("cycle")).length / Math.max(1, run.lead.dispatches);
  const contextLine = (name, list) => [name, thousands(mean(list.map((r) => r.lead.context_at_first_call))), thousands(mean(list.map((r) => r.lead.context_at_first_dispatch))), thousands(mean(list.map((r) => r.lead.context_at_reply))), thousands(mean(list.map(growth))), num(mean(list.map(perCycleCalls))), money(mean(list.map((r) => r.lead.usd.read / r.lead.calls)), 4)];
  out.push(table(["arm", "what every session starts with, read on every call", "at the first dispatch", "at the reply", "added per dispatch", "calls per dispatch", "read-back cost of a mean call"], [contextLine("A", A), contextLine("B", B)]));

  out.push("**Table 7. What stage 16 would take off the package's lead, by this count.** Arithmetic on the calls above, not a measurement: each line removes the tool uses and the calls named and leaves every other call as it was. The harness's turns are the tool uses and the reply.");
  const leadA = mean(A.map((r) => r.lead.usd.total));
  const leadB = mean(B.map((r) => r.lead.usd.total));
  const cut = (calls, usesGone) => {
    const uses = A.map((run) => run.rows.reduce((sum, row) => sum + row.uses.filter(usesGone).length, 0));
    const gone = A.map((run) => calls(run).filter((row) => row.kind !== "prompt").length);
    const dollars = mean(A.map((run) => calls(run).reduce((sum, row) => sum + row.usd.total, 0)));
    return [num(mean(uses)), `${Math.round((100 * mean(uses)) / mean(A.map((r) => r.lead.tool_uses + 1)))}%`, num(mean(gone)), span(gone), `${Math.round((100 * mean(gone)) / mean(A.map((r) => r.lead.calls)))}%`, money(dollars), money(leadA - dollars), signed(leadA - dollars - leadB)];
  };
  const hookUse = (kind) => kind === "started-line" || kind === "clock";
  out.push(
    table(
      ["what goes", "tool uses a run", "of the harness's turns", "whole calls a run", "range", "of the lead's calls", "cost a run", "A's lead after", "A's lead less B's after"],
      [
        ["nothing (as run)", "0", "0%", "0", "0", "0%", money(0), money(leadA), signed(leadA - leadB)],
        ["hook-written notes (slice 0021): every clock read and every write of `started` lines only", ...cut(hookCalls, hookUse)],
        ["the same, and the progress file rendered from the notes (not in the plan)", ...cut(renderCalls, (kind) => hookUse(kind) || kind === "progress")],
        ["a workflow script that dispatches and keeps the record (slice 0022): everything but the prompt, the amendments and the reply", ...cut(scriptCalls, (kind) => kind !== "amendment")],
      ],
    ),
  );
  out.push("**Table 8. A design of the same shape at more dispatches: arithmetic, not a measurement.** It holds each arm at what four dispatches showed (the cost paid once, the cost of a dispatch with its subagent, the context each dispatch adds and the calls that read it back), prices the context at the cached rate at any size, and has no compaction. No run here had more than four dispatches, and these designs' own stops end them at 10 or 16.");
  const readRate = data.rates_usd_per_million_tokens["claude-opus-5-5"].cache_read / 1e6;
  const law = (list) => {
    const dispatches = mean(list.map((r) => r.lead.dispatches));
    const perStep = mean(list.map(perCycleCalls)) * mean(list.map(growth)) * readRate;
    const each = (mean(list.map(repeating)) + mean(list.map((r) => r.subagents.usd))) / dispatches - (perStep * (dispatches - 1)) / 2;
    return { once: mean(list.map(once)), each, perStep, at: (n) => mean(list.map(once)) + n * each + (perStep * n * (n - 1)) / 2 };
  };
  const lawA = law(A);
  const lawB = law(B);
  out.push(
    table(
      ["dispatches", "B", "A", "A less B", "A above B", "of the difference: paid once", "paid each dispatch", "from the context growing"],
      [4, 20, 100].map((n) => [n === 4 ? "4 (as run)" : String(n), money(lawB.at(n), 2), money(lawA.at(n), 2), signed(lawA.at(n) - lawB.at(n), 2), `${Math.round(100 * (lawA.at(n) / lawB.at(n) - 1))}%`, signed(lawA.once - lawB.once, 2), signed(n * (lawA.each - lawB.each), 2), signed(((lawA.perStep - lawB.perStep) * n * (n - 1)) / 2, 2)]),
    ),
  );
  out.push(`Each dispatch adds ${money(lawA.perStep, 4)} to the cost of every later dispatch in A and ${money(lawB.perStep, 4)} in B: the calls a dispatch takes, times the context it adds, at the cached rate.`);
  out.push("The same arithmetic from each project's four runs alone, to show how far two runs an arm can move it:");
  const above = (a, b, n) => `${Math.round(100 * (a.at(n) / b.at(n) - 1))}%`;
  out.push(
    table(
      ["from the runs of", "A above B at 4", "at 20", "at 100", "what a dispatch adds to each later one, A over B"],
      [...projects.map((p) => [`\`${p}\``, law(A.filter((r) => r.project === p)), law(B.filter((r) => r.project === p))]), ["all three", lawA, lawB]].map(([name, a, b]) => [name, above(a, b, 4), above(a, b, 20), above(a, b, 100), `${(a.perStep / b.perStep).toFixed(1)} times`]),
    ),
  );

  out.push("**Table 9. The read-back cost again, filed by whose tokens were read and not by which call read them.** What a call adds to the context is read back by every later call. This is the same money as the read-back column of Table 3, cut the other way: the mean of a run.");
  const origins = ["start", "prompt", "brief", "run-folder", "amendment", "started-line", "clock", "note", "progress", "report", "check", "dispatch", "text", "other"].filter((kind) => runs.some((run) => (run.read_back_by_origin[kind]?.tokens ?? 0) > 0));
  const originNames = { ...KIND_NAMES, start: "what every session starts with (the harness's instructions and tools)", dispatch: "dispatching a node, and what the node replied" };
  const origin = (list, kind) => mean(list.map((run) => run.read_back_by_origin[kind]?.usd ?? 0));
  out.push(
    table(
      ["whose tokens", "A", "B", "A less B"],
      [
        ...origins.map((kind) => [originNames[kind] ?? kind, money(origin(A, kind)), money(origin(B, kind)), signed(origin(A, kind) - origin(B, kind))]),
        ["**all the read-back**", `**${money(mean(A.map((r) => r.lead.usd.read)))}**`, `**${money(mean(B.map((r) => r.lead.usd.read)))}**`, `**${signed(allDiff((r) => r.lead.usd.read))}**`],
      ],
    ),
  );
  const briefOwn = mean(A.map((run) => cellOf(run, "by_kind", "brief").usd.total));
  out.push(`Reading the brief, the graph and the agent files therefore costs ${money(briefOwn)} in its own calls and ${money(origin(A, "brief"))} in every later call that reads it back: ${money(briefOwn + origin(A, "brief"))} a run, ${Math.round((100 * (briefOwn + origin(A, "brief"))) / allDiff((r) => r.lead.usd.total))}% of A less B.`);
  return out.join("\n\n");
}

// ── CLI ──────────────────────────────────────────────────────────────────

const START = "<!-- tables: made by scripts/lib/compare-lead.mjs from lead-cost.json; do not edit by hand -->";
const END = "<!-- end of tables -->";

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const flags = process.argv.slice(2);
  const jsonPath = join(derived, "lead-cost.json");
  const pagePath = join(derived, "lead-cost.md");
  const inPage = (text) => {
    const page = readFileSync(pagePath, "utf8");
    const from = page.indexOf(START);
    const to = page.indexOf(END);
    if (from < 0 || to < from) throw new Error(`${pagePath} has no table markers`);
    return { page, held: page.slice(from + START.length, to).trim(), next: `${page.slice(0, from + START.length)}\n\n${text}\n\n${page.slice(to)}` };
  };
  if (flags.includes("--check")) {
    const { held } = inPage("");
    const want = tables(JSON.parse(readFileSync(jsonPath, "utf8")));
    if (held !== want) {
      console.error("experiments/comparisons/derived/lead-cost.md: its tables are not the ones lead-cost.json gives. Run scripts/lib/compare-lead.mjs --write where the transcripts are.");
      process.exit(1);
    }
    console.log("lead-cost.md: its tables are the ones lead-cost.json gives");
    process.exit(0);
  }
  const data = {
    about: "Derived after the runs, not evidence of them: every request the lead session of each arm A and arm B run of study two made to the model, what it was for and what it cost, read from the harness's own transcripts by scripts/lib/compare-lead.mjs. Counts and kinds only. The harness's reported cost of each run is in the run's claude-output.json.",
    rates_usd_per_million_tokens: RATES,
    order_of_kinds: ORDER,
    runs: PROJECTS.flatMap((project) => RUNS.map((run) => leadOfRun(project, run))),
  };
  const missing = data.runs.filter((run) => run.transcripts_found === 0);
  for (const run of missing) console.error(`${run.run}: no transcript found; the harness no longer keeps it`);
  for (const run of data.runs.filter((r) => r.transcripts_found > 0 && !r.rates_give_the_reported_cost_back)) console.error(`${run.run}: the rates do not give the reported cost back: ${JSON.stringify(run.by_model)}`);
  const text = tables(data);
  console.log(text);
  if (flags.includes("--write")) {
    if (missing.length > 0) {
      console.error("not written: a table of fewer runs would replace a table of twelve");
      process.exit(1);
    }
    mkdirSync(derived, { recursive: true });
    writeFileSync(jsonPath, `${JSON.stringify(data, null, 1)}\n`, "utf8");
    if (existsSync(pagePath)) writeFileSync(pagePath, inPage(text).next, "utf8");
  }
}

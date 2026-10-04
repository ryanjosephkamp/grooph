/**
 * The tables of the comparison write-ups (handoff 0016, criterion 7; protocol
 * §9), generated from the records so the numbers cannot drift: one row per run
 * (arm, replicate, held-out, tests, scope, ending, cost, wall time, turns,
 * refusals, judge score and rank) and each study's index (per project: runs,
 * spend by arm, held-out ranges by arm). The judge's letters are mapped back to
 * runs here and nowhere else (judge/mapping.json). Prints Markdown.
 *
 * Two studies share the folder and are never one table: study one (protocol
 * version 1: arms A, B, C; lead claude-opus-5, a Fable judge) and study two
 * (version 2: arms A to D; lead and judge claude-opus-5-5, a pre-registered
 * tier map). A project says which it belongs to in expect.json `protocol`.
 *
 *   node scripts/lib/compare-summary.mjs                 every project with a run, study by study
 *   node scripts/lib/compare-summary.mjs <project> …     only these
 *   node scripts/lib/compare-summary.mjs --index         each study's index table and the spend
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadLedger, spendBy, totals } from "./compare-ledger.mjs";

/** The arms of each protocol version (docs/comparisons.md §1); the runner holds the same in PROTOCOLS. */
const ARMS_OF = { 1: ["A", "B", "C"], 2: ["A", "B", "C", "D"] };

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const comparisons = join(root, "experiments", "comparisons");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const usd = (n) => `$${(n ?? 0).toFixed(2)}`;
const expectOf = (project) => readJson(join(comparisons, project, "expect.json"));
export const protocolOf = (project) => expectOf(project).protocol ?? 1;
export const armsOf = (project) => ARMS_OF[protocolOf(project)] ?? ARMS_OF[2];

/** Who touched the held-out folder, from the kept transcript digest: the lead, a graph agent, or a generic subagent told apart by its description. */
export function heldOutTouched(runDir, result) {
  const dir = result.conditions?.held_out?.dir ?? result.held_out?.dir;
  const digestPath = join(runDir, "transcript-digest.json");
  if (!dir || !existsSync(digestPath)) return null;
  const marks = [dir, "/held-out/"];
  const touched = {};
  for (const entry of readJson(digestPath)) {
    const uses = entry.tool_uses.filter((u) => !u.error && u.tool !== "Agent" && u.tool !== "Task" && marks.some((m) => `${u.file ?? ""}${u.path ?? ""}${u.command ?? ""}`.includes(m)));
    if (uses.length === 0) continue;
    const who = entry.who === "lead" || entry.who.includes("--") ? entry.who : `${entry.who} (${entry.description ?? entry.transcript})`;
    touched[who] = (touched[who] ?? 0) + uses.length;
  }
  return touched;
}

/** Every run of a project, in arm-then-replicate order, with its result, score and judge row. */
export function projectRows(project) {
  const dir = join(comparisons, project);
  const names = readdirSync(dir).filter((n) => /^[ABCD]-\d+$/.test(n) && existsSync(join(dir, n, "result.json")));
  names.sort((a, b) => (a[0] === b[0] ? Number(a.slice(2)) - Number(b.slice(2)) : a[0].localeCompare(b[0])));
  const judge = existsSync(join(dir, "judge", "verdict.json")) ? readJson(join(dir, "judge", "verdict.json")) : null;
  const mapping = existsSync(join(dir, "judge", "mapping.json")) ? readJson(join(dir, "judge", "mapping.json")) : null;
  const letterOf = mapping ? Object.fromEntries(Object.entries(mapping.letters).map(([letter, run]) => [run, letter])) : {};
  return names.map((name) => {
    const result = readJson(join(dir, name, "result.json"));
    const score = existsSync(join(dir, name, "score.json")) ? readJson(join(dir, name, "score.json")) : null;
    const letter = letterOf[name];
    const judged = judge?.scores?.[letter] ?? null;
    const rank = judge?.ranking ? judge.ranking.indexOf(letter) + 1 : null;
    return {
      name,
      arm: result.arm,
      replicate: result.replicate,
      held_out: score?.held_out ?? null,
      tests: score?.tests ?? null,
      scope: score?.scope ?? null,
      ending: score?.ending ?? result.ending_kind ?? null,
      cost: result.cost_usd ?? 0,
      // The runner's clock in every arm (protocol version 2); the harness under-reports its own with parallel dispatches.
      wall_s: result.wall_s ?? result.process?.wall_s ?? result.duration_s ?? null,
      turns: result.harness_turns ?? null,
      refusals: (result.permission_denials ?? []).length,
      subagents: result.process?.subagents_dispatched ?? null,
      iterations: result.arm === "C" ? new Set(result.invocations.map((i) => i.iteration).filter(Boolean)).size : null,
      record: result.process?.record ?? null,
      dispatches: result.process?.dispatches ?? [],
      conditions: result.conditions ?? null,
      models_by_agent: result.models_by_agent ?? result.process?.models_by_agent ?? null,
      models_never_used: result.process?.models_never_used ?? [],
      judge: judged ? { letter, score: judged.score, reasons: judged.reasons, rank: rank || null } : letter ? { letter, score: null, reasons: null, rank: null } : null,
      held_out_touched: heldOutTouched(join(dir, name), result),
    };
  });
}

const heldOutCell = (h) => (!h ? "–" : h.ran ? `${h.passed}/${h.cases}${h.loaded === false ? " (the suite could not load the work)" : ""}` : `not run`);
const testsCell = (t) => (!t ? "–" : t.pass ? "pass" : `**fail**${t.failed ? ` (${t.failed})` : t.todo || t.skipped ? " (skipped/todo)" : ""}`);
const scopeCell = (s) => (!s ? "–" : s.outside.length === 0 && (s.protected_changed ?? []).length === 0 ? "clean" : [s.outside.length > 0 ? `**${s.outside.length} outside**: ${s.outside.join(", ")}` : "", (s.protected_changed ?? []).length > 0 ? `**protected changed**: ${s.protected_changed.join(", ")}` : ""].filter(Boolean).join("; "));
const endingCell = (e) => (!e ? "–" : e.kind === "clean" ? `clean (${e.reason})` : `**cut off** (${e.reason})`);
const wall = (s) => (s === null || s === undefined ? "–" : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`);

/** The per-project table (protocol §9). */
export function projectTable(project) {
  const rows = projectRows(project);
  const lines = [
    "| Run | Held-out | Tests | Scope | Ending | Cost | Wall | Turns | Refusals | Sub-agents | Judge |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const r of rows) {
    const judge = r.judge ? (r.judge.score !== null ? `${r.judge.score}/5, rank ${r.judge.rank}` : `(${r.judge.letter}: unparsed)`) : "–";
    const extra = r.arm === "C" ? ` (${r.iterations} iteration${r.iterations === 1 ? "" : "s"})` : r.arm === "A" && r.record ? ` (round ${r.record.rounds?.last_round ?? "–"}${r.record.back_edges?.taken ? ", back edge" : ""})` : "";
    lines.push(`| **${r.arm}-${r.replicate}**${extra} | ${heldOutCell(r.held_out)} | ${testsCell(r.tests)} | ${scopeCell(r.scope)} | ${endingCell(r.ending)} | ${usd(r.cost)} | ${wall(r.wall_s)} | ${r.turns ?? "–"} | ${r.refusals} | ${r.subagents ?? "–"} | ${judge} |`);
  }
  return { rows, markdown: lines.join("\n") };
}

/** Ranges per arm: held-out passes, cost. n is small, so ranges, never means. */
export function ranges(rows) {
  const byArm = {};
  for (const r of rows) {
    byArm[r.arm] ??= { held: [], cost: [], n: 0 };
    byArm[r.arm].n += 1;
    byArm[r.arm].cost.push(r.cost);
    if (r.held_out?.ran) byArm[r.arm].held.push(r.held_out.passed);
  }
  // A range whose two ends print the same ($0.2563 and $0.2620) is printed once.
  const span = (list, fmt = (x) => x) => (list.length === 0 ? "–" : fmt(Math.min(...list)) === fmt(Math.max(...list)) ? fmt(Math.min(...list)) : `${fmt(Math.min(...list))}–${fmt(Math.max(...list))}`);
  return Object.fromEntries(Object.entries(byArm).map(([arm, v]) => [arm, { n: v.n, held_out: span(v.held), cost: span(v.cost, (x) => usd(x)), held_list: v.held, cost_list: v.cost }]));
}

export function rangesLine(rows, cases) {
  const r = ranges(rows);
  return ARMS_OF[2]
    .filter((arm) => r[arm])
    .map((arm) => `${arm}: held-out ${r[arm].held_out}${cases ? `/${cases}` : ""}, cost ${r[arm].cost} (n = ${r[arm].n})`)
    .join(" · ");
}

/** The judge's reasons, mapped back to runs, in ranking order. */
export function judgeReasons(project) {
  const rows = projectRows(project).filter((r) => r.judge?.score !== null && r.judge);
  rows.sort((a, b) => (a.judge.rank ?? 99) - (b.judge.rank ?? 99));
  return rows.map((r) => `${r.judge.rank}. **${r.arm}-${r.replicate}** (letter ${r.judge.letter}, ${r.judge.score}/5): ${r.judge.reasons}`);
}

/** What a run's lead dispatched, in order, by node (arm A) or by the description the lead gave (the other arms): the evidence for "did a loop turn". */
export function dispatchLine(row) {
  const names = row.dispatches.map((d) => (String(d.subagent_type ?? "").includes("--") ? d.subagent_type.split("--").pop() : (d.description ?? d.subagent_type ?? "?")));
  return names.length === 0 ? "no sub-agent" : names.join(" → ");
}

/** The models a run's record names: the lead, and each sub-agent by what its transcript says it ran on. */
export function modelsLine(row) {
  const by = row.models_by_agent ?? {};
  const short = (who) => (who.includes("--") ? who.split("--").pop() : who.replace(/ \(.*$/, ""));
  const parts = Object.entries(by).map(([who, models]) => `${short(who)} ${models.join("+") || "?"}`);
  return parts.length === 0 ? "not recorded" : [...new Set(parts)].join(" · ");
}

/** One study's index: one row per project of that protocol version. */
export function indexTable(projects, protocol = 1) {
  const ledger = loadLedger();
  const spend = spendBy(ledger);
  const arms = ARMS_OF[protocol];
  const lines = [`| Project | Runs | Held-out range by arm (passes) | Cost range by arm | Judge ranks (${arms.join(" · ")}) | Spend incl. judge |`, "|---|---|---|---|---|---|"];
  let studySpend = 0;
  let studyCalls = 0;
  for (const project of projects) {
    const rows = projectRows(project);
    const r = ranges(rows);
    const expect = expectOf(project);
    const cases = rows.find((x) => x.held_out?.ran)?.held_out.cases;
    const held = arms.map((arm) => (r[arm] ? `${arm} ${r[arm].held_out}` : `${arm} –`)).join(" · ") + (cases ? ` of ${cases}` : "");
    const cost = arms.map((arm) => (r[arm] ? `${arm} ${r[arm].cost}` : `${arm} –`)).join(" · ");
    const ranksBy = (arm) => rows.filter((x) => x.arm === arm && x.judge?.rank).map((x) => x.judge.rank).join(",") || "–";
    const glyph = `<img src="../../patterns/glyphs/${expect.template ?? project}.svg" alt="" width="120"><br>[\`${project}\`](${project}/README.md)`;
    lines.push(`| ${glyph} | ${rows.length} | ${held} | ${cost} | ${arms.map(ranksBy).join(" · ")} | ${usd(spend[project]?.total ?? 0)} |`);
    studySpend += spend[project]?.total ?? 0;
    studyCalls += ledger.invocations.filter((e) => (e.project ?? e.template) === project).length;
  }
  lines.push("", `**Spend, study ${protocol === 1 ? "one" : "two"}:** ${usd(studySpend)} across ${studyCalls} invocations ([\`ledger.json\`](ledger.json)).`);
  return lines.join("\n");
}

/** The ledger as it stands, both studies together. */
export function ledgerLine() {
  const ledger = loadLedger();
  const { spent, remaining } = totals(ledger);
  const wires = ledger.tripwire ? ` The driver is told at each ${usd(ledger.tripwire.notify_every_usd)}, and one project stops and asks at ${usd(ledger.tripwire.project_stop_usd)}.` : "";
  return ledger.cap_usd === null
    ? `**The ledger, both studies:** ${usd(spent)} across ${ledger.invocations.length} invocations; no cap since the owner lifted it, ${usd(ledger.per_invocation_ceiling_usd)} per invocation.${wires}`
    : `**The ledger, both studies:** ${usd(spent)} of the ${usd(ledger.cap_usd)} cap across ${ledger.invocations.length} invocations; ${usd(remaining)} left.${wires}`;
}

// ── CLI ──────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const all = existsSync(comparisons) ? readdirSync(comparisons).filter((n) => existsSync(join(comparisons, n, "expect.json"))).sort() : [];
  const withRuns = all.filter((p) => projectRows(p).length > 0);
  const names = { 1: "Study one (protocol version 1: arms A, B, C)", 2: "Study two (protocol version 2: arms A, B, C, D)" };
  if (args.includes("--index")) {
    for (const protocol of [1, 2]) {
      const mine = all.filter((p) => protocolOf(p) === protocol);
      const ran = mine.filter((p) => withRuns.includes(p));
      console.log(`## ${names[protocol]}\n`);
      console.log(ran.length > 0 ? indexTable(ran, protocol) : `No run yet${mine.length > 0 ? `; projects prepared: ${mine.map((p) => `\`${p}\``).join(", ")}` : ""}.`);
      console.log("");
    }
    console.log(ledgerLine());
  } else {
    const projects = args.length > 0 ? args : withRuns;
    for (const project of projects) {
      const { rows, markdown } = projectTable(project);
      const cases = rows.find((x) => x.held_out?.ran)?.held_out.cases;
      const protocol = protocolOf(project);
      console.log(`### ${project} · study ${protocol === 1 ? "one" : "two"}\n\n${markdown}\n\n${rangesLine(rows, cases)}\n`);
      if (protocol >= 2 && rows.length > 0) {
        const c = rows.find((r) => r.conditions)?.conditions;
        if (c) console.log(`Lead \`${c.lead_model}\` at effort \`${c.lead_effort}\` in every arm; tier map ${c.tier_map ? `\`${c.tier_map.said_as}\`` : "not recorded"}; judge \`${c.judge_model}\`.\n`);
        console.log(`What each lead dispatched, in order, and the models its record names:\n\n${rows.map((r) => `- **${r.name}**: ${dispatchLine(r)} (${modelsLine(r)})${r.models_never_used.length > 0 ? ` **— reported a model this study never uses: ${r.models_never_used.join(", ")}**` : ""}`).join("\n")}\n`);
      }
      const reasons = judgeReasons(project);
      if (reasons.length > 0) console.log(`The judge (letters → runs from judge/mapping.json):\n\n${reasons.join("\n")}\n`);
    }
    if (projects.length === 0) console.log("no project has a run yet");
  }
}

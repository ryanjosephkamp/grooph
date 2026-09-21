/**
 * The tables of the comparison write-ups (handoff 0016, criterion 7; protocol
 * §9), generated from the records so the numbers cannot drift: one row per run
 * (arm, replicate, held-out, tests, scope, ending, cost, wall time, turns,
 * refusals, judge score and rank) and the study's index (per project: runs,
 * spend by arm, held-out ranges by arm). The judge's letters are mapped back to
 * runs here and nowhere else (judge/mapping.json). Prints Markdown.
 *
 *   node scripts/lib/compare-summary.mjs                 every project with a run
 *   node scripts/lib/compare-summary.mjs <project> …     only these
 *   node scripts/lib/compare-summary.mjs --index         the study index table and the spend
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadLedger, spendBy, totals } from "./compare-ledger.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const comparisons = join(root, "experiments", "comparisons");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const usd = (n) => `$${(n ?? 0).toFixed(2)}`;

/** Every run of a project, in arm-then-replicate order, with its result, score and judge row. */
export function projectRows(project) {
  const dir = join(comparisons, project);
  const names = readdirSync(dir).filter((n) => /^[ABC]-\d+$/.test(n) && existsSync(join(dir, n, "result.json")));
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
      wall_s: result.process?.wall_s ?? result.duration_s ?? null,
      turns: result.harness_turns ?? null,
      refusals: (result.permission_denials ?? []).length,
      subagents: result.process?.subagents_dispatched ?? null,
      iterations: result.arm === "C" ? result.invocations.length : null,
      record: result.process?.record ?? null,
      judge: judged ? { letter, score: judged.score, reasons: judged.reasons, rank: rank || null } : letter ? { letter, score: null, reasons: null, rank: null } : null,
      held_out_touched: result.process?.held_out_touched ?? result.held_out_touched ?? null,
    };
  });
}

const heldOutCell = (h) => (!h ? "–" : h.ran ? `${h.passed}/${h.cases}` : `not run`);
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
  const span = (list, fmt = (x) => x) => (list.length === 0 ? "–" : list.length === 1 || Math.min(...list) === Math.max(...list) ? fmt(Math.min(...list)) : `${fmt(Math.min(...list))}–${fmt(Math.max(...list))}`);
  return Object.fromEntries(Object.entries(byArm).map(([arm, v]) => [arm, { n: v.n, held_out: span(v.held), cost: span(v.cost, (x) => usd(x)), held_list: v.held, cost_list: v.cost }]));
}

export function rangesLine(rows, cases) {
  const r = ranges(rows);
  return ["A", "B", "C"]
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

/** The study index: one row per project. */
export function indexTable(projects) {
  const ledger = loadLedger();
  const spend = spendBy(ledger);
  const lines = ["| Project | Runs | Held-out range by arm (passes) | Cost range by arm | Judge ranks (A · B · C) | Spend incl. judge |", "|---|---|---|---|---|---|"];
  for (const project of projects) {
    const rows = projectRows(project);
    const r = ranges(rows);
    const expect = readJson(join(comparisons, project, "expect.json"));
    const cases = rows.find((x) => x.held_out?.ran)?.held_out.cases;
    const held = ["A", "B", "C"].map((arm) => (r[arm] ? `${arm} ${r[arm].held_out}` : `${arm} –`)).join(" · ") + (cases ? ` of ${cases}` : "");
    const cost = ["A", "B", "C"].map((arm) => (r[arm] ? `${arm} ${r[arm].cost}` : `${arm} –`)).join(" · ");
    const ranksBy = (arm) => rows.filter((x) => x.arm === arm && x.judge?.rank).map((x) => x.judge.rank).join(",") || "–";
    const glyph = `<img src="../../patterns/glyphs/${expect.template ?? project}.svg" alt="" width="120"><br>[\`${project}\`](${project}/README.md)`;
    lines.push(`| ${glyph} | ${rows.length} | ${held} | ${cost} | ${ranksBy("A")} · ${ranksBy("B")} · ${ranksBy("C")} | ${usd(spend[project]?.total ?? 0)} |`);
  }
  const { spent, remaining } = totals(ledger);
  lines.push("", `**Spend:** ${usd(spent)} of the ${usd(ledger.cap_usd)} cap across ${ledger.invocations.length} invocations ([\`ledger.json\`](ledger.json)); ${usd(remaining)} left.`);
  return lines.join("\n");
}

// ── CLI ──────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const all = existsSync(comparisons) ? readdirSync(comparisons).filter((n) => existsSync(join(comparisons, n, "expect.json"))).sort() : [];
  if (args.includes("--index")) {
    console.log(indexTable(all.filter((p) => projectRows(p).length > 0)));
  } else {
    const projects = args.length > 0 ? args : all.filter((p) => projectRows(p).length > 0);
    for (const project of projects) {
      const { rows, markdown } = projectTable(project);
      const cases = rows.find((x) => x.held_out?.ran)?.held_out.cases;
      console.log(`### ${project}\n\n${markdown}\n\n${rangesLine(rows, cases)}\n`);
      const reasons = judgeReasons(project);
      if (reasons.length > 0) console.log(`The judge (letters → runs from judge/mapping.json):\n\n${reasons.join("\n")}\n`);
    }
    if (projects.length === 0) console.log("no project has a run yet");
  }
}

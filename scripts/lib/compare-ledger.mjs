/**
 * The spend ledger for paired comparisons (handoff 0016, criterion 1; protocol
 * docs/comparisons.md §8): experiments/comparisons/ledger.json, with the fields
 * and rules of the proving ledger (scripts/lib/prove-ledger.mjs) and its own
 * numbers: cap $100.00 (owner-approved on confirmation of the slice), refuse
 * below $6.00, $9.00 per invocation. Every model call of the study is a line:
 * an arm's kickoff, each iteration of arm C, a scripted resume, and the blind
 * judge's call.
 *
 * Rules, as in the proving ledger:
 *   - an invocation is `running` before the model is called and settled after,
 *     so a crash leaves a visible unsettled line; an unknown cost counts at its
 *     ceiling until settled with evidence;
 *   - `remaining = cap − spent`; nothing starts when `remaining < refuse_below_usd`,
 *     and each invocation is capped at `min(remaining, per_invocation_ceiling_usd)`;
 *   - one kickoff per run (a project, an arm and a replicate), and one retry for
 *     a failure outside the prompt or the package (sign-in, network), which is
 *     used up only when the retried kickoff reached a model. A run whose prompt
 *     or package under-drove the session is a result, not a retry.
 *   - one judge call per project, with the same retry rule.
 *
 *   node scripts/lib/compare-ledger.mjs status
 *   node scripts/lib/compare-ledger.mjs record --kind probe --project - --arm - --cost 0.03 --note "…"
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { counted, openEntry, saveLedger as saveAt, settleEntry, totals } from "./prove-ledger.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const LEDGER_PATH = join(root, "experiments", "comparisons", "ledger.json");

const DEFAULTS = {
  cap_usd: 100,
  refuse_below_usd: 6,
  per_invocation_ceiling_usd: 9,
};

const cents = (usd) => Math.round(usd * 100) / 100;

export { counted, openEntry, settleEntry, totals };

export function loadLedger(path = LEDGER_PATH) {
  if (!existsSync(path)) {
    return {
      ...DEFAULTS,
      cap_history: [{ from_usd: 0, to_usd: DEFAULTS.cap_usd, on: "2026-09-21", by: "owner, for slice 0016 (the first paired-comparison study), approved on confirmation of the handoff" }],
      about:
        "Every model-calling invocation of the paired comparisons (docs/comparisons.md §8), with its cost as the harness reported it (total_cost_usd): an arm's kickoff, each iteration of arm C, any scripted resume, and the blind judge's call. Written by scripts/compare.sh; never edited by hand. An unsettled cost counts at its ceiling.",
      invocations: [],
      spent_usd: 0,
      remaining_usd: DEFAULTS.cap_usd,
    };
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

export function saveLedger(ledger, path = LEDGER_PATH) {
  saveAt(ledger, path);
}

/** The ledger's name for one run: `<project>/<arm>-<replicate>`, or `<project>/judge`. */
export const runLabel = ({ project, arm, replicate }) => (arm === "judge" ? `${project}/judge` : `${project}/${arm}-${replicate}`);

/**
 * May an invocation start? Returns { ok, reason, maxBudget, remaining }.
 * `kind` is "kickoff" (the first call of a run, or the judge's one call),
 * "iteration" (arm C, from the second iteration on) or "resume"; `retry` is the
 * reason for a retry, or undefined.
 */
export function gate(ledger, { project, arm, replicate, kind, retry }) {
  const { remaining } = totals(ledger);
  const refuse = (reason) => ({ ok: false, reason, remaining });
  const label = runLabel({ project, arm, replicate });

  const running = ledger.invocations.filter((entry) => entry.status === "running");
  if (running.length > 0) {
    return refuse(`invocation ${running.map((e) => e.n).join(", ")} is still marked running: settle it with its real cost first (a crashed run's cost is in its claude-output.json, or counts at its ceiling)`);
  }
  if (remaining < ledger.refuse_below_usd) {
    return refuse(`$${cents(remaining).toFixed(2)} remains under the $${ledger.cap_usd.toFixed(2)} cap, less than the $${ledger.refuse_below_usd.toFixed(2)} an invocation may need; not starting`);
  }
  if (kind === "kickoff") {
    const earlier = ledger.invocations.filter((entry) => entry.run === label && entry.kind === "kickoff");
    if (earlier.length > 0 && !retry) {
      return refuse(
        `${label} already has a kickoff in the ledger (invocation ${earlier.map((e) => e.n).join(", ")}). A run whose prompt or package under-drove the session is a result, not a retry; a run that failed for a reason outside them (sign-in, network) may be retried once with --retry "<reason>"`,
      );
    }
    const reachedModel = (entry) => entry.status === "ok" || Boolean(entry.run_id) || (typeof entry.cost_usd === "number" && entry.cost_usd > 0);
    const retried = earlier.filter((entry) => entry.retry && reachedModel(entry));
    if (retry && retried.length > 0) return refuse(`${label} was already retried once (invocation ${retried.map((e) => e.n).join(", ")})`);
    if (retry && earlier.length === 0) return refuse(`--retry given, but ${label} has no earlier kickoff to retry`);
  }
  return { ok: true, remaining, maxBudget: cents(Math.min(remaining, ledger.per_invocation_ceiling_usd)) };
}

/** Open a line for one invocation of a run. Beyond the proving ledger's fields: `run`, `project`, `arm`, `replicate`, `iteration`. */
export function openRunEntry(ledger, fields) {
  const entry = openEntry(ledger, { template: fields.project, kind: fields.kind, maxBudget: fields.maxBudget, sessionId: fields.sessionId, runId: fields.runId, retry: fields.retry, note: fields.note });
  entry.run = runLabel(fields);
  entry.project = fields.project;
  entry.arm = fields.arm;
  entry.replicate = fields.arm === "judge" ? null : fields.replicate;
  entry.iteration = fields.iteration ?? null;
  return entry;
}

export function describe(ledger) {
  const { spent, remaining } = totals(ledger);
  const lines = [
    `ledger ${LEDGER_PATH.slice(root.length + 1)}: $${cents(spent).toFixed(2)} spent of $${ledger.cap_usd.toFixed(2)}, $${cents(remaining).toFixed(2)} remaining (refuses below $${ledger.refuse_below_usd.toFixed(2)}; each invocation capped at $${ledger.per_invocation_ceiling_usd.toFixed(2)})`,
  ];
  for (const e of ledger.invocations) {
    const cost = typeof e.cost_usd === "number" ? `$${e.cost_usd.toFixed(4)}` : `unknown (counted $${e.max_budget_usd})`;
    const kind = e.kind === "iteration" ? `iter ${e.iteration}` : e.kind;
    lines.push(`  ${String(e.n).padStart(2)}  ${(e.run ?? e.template ?? "-").padEnd(24)} ${kind.padEnd(8)} ${e.status.padEnd(8)} ${cost}${e.run_id ? `  run ${e.run_id}` : ""}${e.retry ? `  retry: ${e.retry}` : ""}`);
  }
  return lines.join("\n");
}

/** Spend per project and per arm, from the settled and running lines. */
export function spendBy(ledger) {
  const byProject = {};
  for (const e of ledger.invocations) {
    const project = e.project ?? e.template ?? "-";
    byProject[project] ??= { total: 0, arms: {} };
    byProject[project].total += counted(e);
    const arm = e.arm ?? "-";
    byProject[project].arms[arm] = (byProject[project].arms[arm] ?? 0) + counted(e);
  }
  return byProject;
}

// ── CLI ──────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [command, ...rest] = process.argv.slice(2);
  const ledger = loadLedger();
  if (command === "status" || command === undefined) {
    console.log(describe(ledger));
  } else if (command === "record") {
    const opt = (name) => {
      const at = rest.indexOf(`--${name}`);
      return at >= 0 ? rest[at + 1] : undefined;
    };
    const cost = Number(opt("cost"));
    if (!Number.isFinite(cost) || !opt("kind") || !opt("note")) {
      console.error('usage: compare-ledger.mjs record --kind <probe|…> --project <id|-> --arm <A|B|C|judge|-> --cost <usd> --note "<what and why>" [--session <id>]');
      process.exit(64);
    }
    const entry = openRunEntry(ledger, { project: opt("project") ?? "-", arm: opt("arm") ?? "-", replicate: opt("replicate") ?? "-", kind: opt("kind"), maxBudget: cost, sessionId: opt("session"), note: opt("note") });
    settleEntry(entry, { status: "ok", cost_usd: cost, reported_cost_usd: cost });
    saveLedger(ledger);
    console.log(describe(ledger));
  } else {
    console.error(`unknown command: ${command}`);
    process.exit(64);
  }
}

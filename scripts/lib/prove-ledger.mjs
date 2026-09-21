/**
 * The spend ledger for pattern proving runs (handoff 0009, criterion 2):
 * experiments/patterns/ledger.json records every model-calling invocation with
 * its cost, and the runner asks it before every model call.
 *
 * - An invocation is recorded as `running` before the model is called and
 *   settled with its reported cost afterwards, so a crash mid-run leaves a
 *   visible, unsettled line rather than no line.
 * - A cost that is not known (the run died without output) is counted at the
 *   invocation's `--max-budget-usd` ceiling until someone settles it with
 *   evidence.
 * - `remaining = cap − spent`. The runner refuses to start an invocation when
 *   `remaining < refuse_below_usd`, and caps each one at
 *   `min(remaining, per_invocation_ceiling_usd)`, so no invocation can pass the
 *   cap even if its template's brakes fail.
 *
 * Also a small CLI, for reading the ledger and for recording an invocation made
 * outside the runner (a harness probe):
 *
 *   node scripts/lib/prove-ledger.mjs status
 *   node scripts/lib/prove-ledger.mjs record --kind probe --template - --cost 0.03 --note "…"
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const LEDGER_PATH = join(root, "experiments", "patterns", "ledger.json");

const DEFAULTS = {
  cap_usd: 25,
  refuse_below_usd: 6,
  per_invocation_ceiling_usd: 6,
};

const cents = (usd) => Math.round(usd * 100) / 100;
const micro = (usd) => Math.round(usd * 1e6) / 1e6;

/** What an invocation counts against the cap: its cost, or its ceiling while the cost is unknown. */
export const counted = (entry) => (typeof entry.cost_usd === "number" ? entry.cost_usd : entry.max_budget_usd);

export function loadLedger(path = LEDGER_PATH) {
  if (!existsSync(path)) {
    return {
      ...DEFAULTS,
      about:
        "Every model-calling invocation of slice 0009's proving runs, with its cost as the harness reported it (total_cost_usd). Written by scripts/prove-pattern.sh; never edited by hand. An unsettled cost counts at its ceiling.",
      invocations: [],
      spent_usd: 0,
      remaining_usd: DEFAULTS.cap_usd,
    };
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

export function totals(ledger) {
  const spent = ledger.invocations.reduce((sum, entry) => sum + counted(entry), 0);
  return { spent: micro(spent), remaining: micro(ledger.cap_usd - spent) };
}

export function saveLedger(ledger, path = LEDGER_PATH) {
  const { spent, remaining } = totals(ledger);
  ledger.spent_usd = spent;
  ledger.remaining_usd = remaining;
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  renameSync(temp, path);
}

/**
 * May an invocation start? Returns { ok, reason, maxBudget, remaining }.
 * `kind` is "kickoff" or "resume"; `retry` is the reason for a retry, or undefined.
 * A resume is its own invocation with its own ceiling: `claude -p --resume`
 * reports and caps what that invocation spends, not the session's total
 * (checked with the probe recorded as invocations 1 and 2).
 */
export function gate(ledger, { template, kind, retry }) {
  const { remaining } = totals(ledger);
  const refuse = (reason) => ({ ok: false, reason, remaining });

  const running = ledger.invocations.filter((entry) => entry.status === "running");
  if (running.length > 0) {
    return refuse(
      `invocation ${running.map((e) => e.n).join(", ")} is still marked running: settle it with its real cost first (a crashed run's cost is in its claude-output.json, or counts at its ceiling)`,
    );
  }
  if (remaining < ledger.refuse_below_usd) {
    return refuse(
      `$${cents(remaining).toFixed(2)} remains under the $${ledger.cap_usd.toFixed(2)} cap, less than the $${ledger.refuse_below_usd.toFixed(2)} a run may need; not starting`,
    );
  }
  if (kind === "kickoff") {
    const earlier = ledger.invocations.filter((entry) => entry.template === template && entry.kind === "kickoff");
    if (earlier.length > 0 && !retry) {
      return refuse(
        `${template} already has a kickoff in the ledger (invocation ${earlier.map((e) => e.n).join(", ")}). A run whose package under-drove the session is a finding, not a retry; a run that failed for a reason outside the package (sign-in, network) may be retried once with --retry "<reason>"`,
      );
    }
    // A retry that never reached a lead (an expired sign-in fails the kickoff at $0.00 before
    // any model call) does not use up the one retry: only a retried kickoff that ran does.
    const reachedLead = (entry) => entry.status === "ok" || Boolean(entry.run_id);
    const retried = earlier.filter((entry) => entry.retry && reachedLead(entry));
    if (retry && retried.length > 0) {
      return refuse(`${template} was already retried once (invocation ${retried.map((e) => e.n).join(", ")})`);
    }
    if (retry && earlier.length === 0) return refuse(`--retry given, but ${template} has no earlier kickoff to retry`);
  }
  return { ok: true, remaining, maxBudget: cents(Math.min(remaining, ledger.per_invocation_ceiling_usd)) };
}

export function openEntry(ledger, fields) {
  const entry = {
    n: ledger.invocations.length + 1,
    template: fields.template,
    kind: fields.kind,
    started: new Date().toISOString(),
    ended: null,
    status: "running",
    cost_usd: null,
    reported_cost_usd: null,
    max_budget_usd: fields.maxBudget,
    session_id: fields.sessionId ?? null,
    run_id: fields.runId ?? null,
    retry: fields.retry ?? null,
    note: fields.note ?? "",
  };
  ledger.invocations.push(entry);
  return entry;
}

export function settleEntry(entry, fields) {
  Object.assign(entry, { ended: new Date().toISOString() }, fields);
}

export function describe(ledger) {
  const { spent, remaining } = totals(ledger);
  const lines = [
    `ledger ${LEDGER_PATH.slice(root.length + 1)}: $${cents(spent).toFixed(2)} spent of $${ledger.cap_usd.toFixed(2)}, $${cents(remaining).toFixed(2)} remaining (refuses below $${ledger.refuse_below_usd.toFixed(2)}; each invocation capped at $${ledger.per_invocation_ceiling_usd.toFixed(2)})`,
  ];
  for (const e of ledger.invocations) {
    const cost = typeof e.cost_usd === "number" ? `$${e.cost_usd.toFixed(4)}` : `unknown (counted $${e.max_budget_usd})`;
    lines.push(`  ${String(e.n).padStart(2)}  ${e.template.padEnd(21)} ${e.kind.padEnd(8)} ${e.status.padEnd(8)} ${cost}${e.run_id ? `  run ${e.run_id}` : ""}${e.retry ? `  retry: ${e.retry}` : ""}`);
  }
  return lines.join("\n");
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
      console.error('usage: prove-ledger.mjs record --kind <probe|…> --template <id|-> --cost <usd> --note "<what and why>" [--session <id>]');
      process.exit(64);
    }
    const entry = openEntry(ledger, { template: opt("template") ?? "-", kind: opt("kind"), maxBudget: cost, sessionId: opt("session"), note: opt("note") });
    settleEntry(entry, { status: "ok", cost_usd: cost, reported_cost_usd: cost });
    saveLedger(ledger);
    console.log(describe(ledger));
  } else {
    console.error(`unknown command: ${command}`);
    process.exit(64);
  }
}

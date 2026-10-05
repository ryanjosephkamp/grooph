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
 * Since 2026-10-04 the owner may lift the cap (`cap_usd: null`), and the ledger
 * then carries two tripwires in its place (`tripwire`): the one running the
 * study is told each time the total passes a multiple of `notify_every_usd`,
 * and no new run of a project starts once that project has passed
 * `project_stop_usd` until someone says it may (`project_stop_lifted`). The
 * ceiling per invocation and the floor are unchanged. A cap change is a line
 * in `cap_history`, written by the `cap` command below, never by hand.
 *
 *   node scripts/lib/compare-ledger.mjs status
 *   node scripts/lib/compare-ledger.mjs record --kind probe --project - --arm - --cost 0.03 --note "…"
 *   node scripts/lib/compare-ledger.mjs cap --to <usd|none> --by "<who and why>" [--notify-every <usd>] [--project-stop <usd>]
 *   node scripts/lib/compare-ledger.mjs lift-project-stop --project <id> --to <usd> --by "<who and why>"
 *   node scripts/lib/compare-ledger.mjs settle --n <n> --cost <usd|ceiling> --note "<what happened, and where the cost was read>"
 *   node scripts/lib/compare-ledger.mjs ack-never --n <n> --by "<who and what was decided>"
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { counted, openEntry, settleEntry } from "./prove-ledger.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const LEDGER_PATH = join(root, "experiments", "comparisons", "ledger.json");

const DEFAULTS = {
  cap_usd: 100,
  refuse_below_usd: 6,
  per_invocation_ceiling_usd: 9,
};

const cents = (usd) => Math.round(usd * 100) / 100;
const micro = (usd) => Math.round(usd * 1e6) / 1e6;

export { counted, openEntry, settleEntry };

/** Spent and what remains. With the cap lifted (`cap_usd: null`) nothing remains to count down: `remaining` is Infinity. */
export function totals(ledger) {
  const spent = micro(ledger.invocations.reduce((sum, entry) => sum + counted(entry), 0));
  return { spent, remaining: ledger.cap_usd === null ? Infinity : micro(ledger.cap_usd - spent) };
}

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
  const { spent, remaining } = totals(ledger);
  ledger.spent_usd = spent;
  ledger.remaining_usd = Number.isFinite(remaining) ? remaining : null;
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  renameSync(temp, path);
}

/**
 * Read the ledger from its file into the same object. The runner does this before it opens a line and before it
 * settles one, so a line or a cap change that another process wrote while a model call ran is kept, not written over.
 */
export function reload(ledger, path = LEDGER_PATH) {
  const fresh = loadLedger(path);
  for (const key of Object.keys(ledger)) delete ledger[key];
  return Object.assign(ledger, fresh);
}

/** One line of the ledger as it is on file now, found by its number and its start; changed, saved, and returned. */
export function amendEntry(ledger, entry, fields, path = LEDGER_PATH) {
  reload(ledger, path);
  const line = ledger.invocations.find((e) => e.n === entry.n && e.started === entry.started);
  if (!line) throw new Error(`invocation ${entry.n} (started ${entry.started}) is no longer in the ledger: it was not written by this runner; nothing was changed`);
  Object.assign(line, fields);
  saveLedger(ledger, path);
  return line;
}

/** The lines that reported a model no run uses and that nobody has answered for yet: while there is one, nothing starts. */
export const neverLines = (ledger) => ledger.invocations.filter((e) => (e.never_used ?? []).length > 0 && !e.never_acknowledged);

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

  const flagged = neverLines(ledger);
  if (flagged.length > 0) {
    return refuse(`invocation ${flagged.map((e) => `${e.n} (${e.run}: ${e.never_used.join(", ")})`).join(", ")} reported a model no run uses. Nothing starts until the driver knows and the answer is recorded with \`compare-ledger.mjs ack-never --n <n> --by "<who and what was decided>"\``);
  }
  const running = ledger.invocations.filter((entry) => entry.status === "running");
  if (running.length > 0) {
    return refuse(`invocation ${running.map((e) => e.n).join(", ")} is still marked running: settle it with its real cost first (a crashed run's cost is in its claude-output.json, or counts at its ceiling)`);
  }
  if (remaining < ledger.refuse_below_usd) {
    return refuse(`$${cents(remaining).toFixed(2)} remains under the $${ledger.cap_usd.toFixed(2)} cap, less than the $${ledger.refuse_below_usd.toFixed(2)} an invocation may need; not starting`);
  }
  if (kind === "kickoff") {
    // The tripwire that stands where the cap stood: a project that has passed its stop starts no new run until someone says it may.
    const stop = projectStop(ledger, project);
    if (stop.passed) {
      return refuse(`${project} has spent $${cents(stop.spent).toFixed(2)}, past the $${stop.limit.toFixed(2)} at which one project stops and asks: tell the driver, and record the answer with \`compare-ledger.mjs lift-project-stop --project ${project} --to <usd> --by "<who and why>"\``);
    }
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

/** Has this project passed the spend at which it stops and asks? `limit` is null when the ledger has no such tripwire. */
export function projectStop(ledger, project) {
  const base = ledger.tripwire?.project_stop_usd ?? null;
  const lifted = ledger.project_stop_lifted?.[project]?.to_usd ?? null;
  const limit = base === null ? null : Math.max(base, lifted ?? 0);
  const spent = micro(ledger.invocations.filter((e) => (e.project ?? e.template) === project).reduce((sum, e) => sum + counted(e), 0));
  return { spent, limit, passed: limit !== null && spent >= limit };
}

/** The multiples of `notify_every_usd` the total passed between two readings: what the one running the study tells the driver. */
export function passedMarks(ledger, spentBefore, spentAfter) {
  const every = ledger.tripwire?.notify_every_usd;
  if (!every) return [];
  const marks = [];
  for (let mark = (Math.floor(spentBefore / every) + 1) * every; mark <= spentAfter; mark += every) marks.push(mark);
  return marks;
}

/** A printed line, or nothing: said by the runner after every settled invocation. */
export function tripwireNotice(ledger, spentBefore) {
  const { spent } = totals(ledger);
  const marks = passedMarks(ledger, spentBefore, spent);
  return marks.length === 0 ? "" : `TRIPWIRE: the comparisons ledger has passed ${marks.map((m) => `$${m.toFixed(2)}`).join(" and ")} ($${cents(spent).toFixed(2)} spent in all): tell the driver before the next run`;
}

/** A change of cap as the owner gave it: one line in `cap_history`, the new cap, and the tripwires when the cap is lifted. */
export function setCap(ledger, { to, by, notifyEvery, projectStop: stop, on = new Date().toISOString().slice(0, 10) }) {
  if (!by) throw new Error("a cap change says who decided it and why (--by)");
  // Nothing is changed until the whole change is known to be sound.
  const tripwire = notifyEvery || stop ? { ...(ledger.tripwire ?? {}), ...(notifyEvery ? { notify_every_usd: notifyEvery } : {}), ...(stop ? { project_stop_usd: stop } : {}) } : ledger.tripwire;
  if (to === null && !(tripwire?.notify_every_usd > 0 && tripwire?.project_stop_usd > 0)) throw new Error("a lifted cap needs both its tripwires (--notify-every and --project-stop)");
  const line = { from_usd: ledger.cap_usd, to_usd: to, on, by };
  if (notifyEvery || stop) line.tripwire = { ...tripwire };
  if (tripwire) ledger.tripwire = tripwire;
  ledger.cap_usd = to;
  ledger.cap_history = [...(ledger.cap_history ?? []), line];
  return line;
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
  const capped = ledger.cap_usd !== null;
  const wire = ledger.tripwire ?? {};
  const wires = `${wire.notify_every_usd ? `; tell the driver at each $${wire.notify_every_usd.toFixed(2)}` : ""}${wire.project_stop_usd ? `; one project stops and asks at $${wire.project_stop_usd.toFixed(2)}` : ""}`;
  const lines = [
    capped
      ? `ledger ${LEDGER_PATH.slice(root.length + 1)}: $${cents(spent).toFixed(2)} spent of $${ledger.cap_usd.toFixed(2)}, $${cents(remaining).toFixed(2)} remaining (refuses below $${ledger.refuse_below_usd.toFixed(2)}; each invocation capped at $${ledger.per_invocation_ceiling_usd.toFixed(2)}${wires})`
      : `ledger ${LEDGER_PATH.slice(root.length + 1)}: $${cents(spent).toFixed(2)} spent, no cap (lifted by the owner; each invocation capped at $${ledger.per_invocation_ceiling_usd.toFixed(2)}${wires})`,
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
  } else if (command === "settle") {
    // A line left `running` by a runner that was killed: its real cost from the harness's kept output, or its ceiling when that is gone.
    const opt = (name) => {
      const at = rest.indexOf(`--${name}`);
      return at >= 0 ? rest[at + 1] : undefined;
    };
    const line = ledger.invocations.find((e) => e.n === Number(opt("n")));
    const cost = opt("cost") === "ceiling" ? null : Number(opt("cost"));
    if (!line || line.status !== "running" || !opt("note") || (cost !== null && !(cost >= 0))) {
      console.error('usage: compare-ledger.mjs settle --n <an invocation still marked running> --cost <usd as the harness reported it | ceiling> --note "<what happened, and where the cost was read>"');
      process.exit(64);
    }
    settleEntry(line, { status: "failed", cost_usd: cost, reported_cost_usd: cost, note: [line.note, `settled by hand: ${opt("note")}`].filter(Boolean).join("; ") });
    saveLedger(ledger);
    console.log(describe(ledger).split("\n")[0]);
  } else if (command === "ack-never") {
    const opt = (name) => {
      const at = rest.indexOf(`--${name}`);
      return at >= 0 ? rest[at + 1] : undefined;
    };
    const line = ledger.invocations.find((e) => e.n === Number(opt("n")));
    if (!line || !(line.never_used ?? []).length || !opt("by")) {
      console.error('usage: compare-ledger.mjs ack-never --n <invocation that reported a model no run uses> --by "<who and what was decided>"');
      process.exit(64);
    }
    line.never_acknowledged = { on: new Date().toISOString().slice(0, 10), by: opt("by") };
    saveLedger(ledger);
    console.log(describe(ledger).split("\n")[0]);
  } else if (command === "cap" || command === "lift-project-stop") {
    const opt = (name) => {
      const at = rest.indexOf(`--${name}`);
      return at >= 0 ? rest[at + 1] : undefined;
    };
    const usdOf = (text) => (text === undefined ? undefined : Number(text));
    if (command === "cap") {
      const to = opt("to") === "none" ? null : usdOf(opt("to"));
      if (to === undefined || (to !== null && !(to > 0)) || !opt("by")) {
        console.error('usage: compare-ledger.mjs cap --to <usd|none> --by "<who decided it and why>" [--notify-every <usd>] [--project-stop <usd>]');
        process.exit(64);
      }
      setCap(ledger, { to, by: opt("by"), notifyEvery: usdOf(opt("notify-every")), projectStop: usdOf(opt("project-stop")) });
    } else {
      const to = usdOf(opt("to"));
      if (!opt("project") || !(to > 0) || !opt("by")) {
        console.error('usage: compare-ledger.mjs lift-project-stop --project <id> --to <usd> --by "<who decided it and why>"');
        process.exit(64);
      }
      ledger.project_stop_lifted = { ...(ledger.project_stop_lifted ?? {}), [opt("project")]: { to_usd: to, on: new Date().toISOString().slice(0, 10), by: opt("by") } };
    }
    saveLedger(ledger);
    console.log(describe(ledger).split("\n")[0]);
  } else {
    console.error(`unknown command: ${command}`);
    process.exit(64);
  }
}

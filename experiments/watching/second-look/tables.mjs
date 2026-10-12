#!/usr/bin/env node
/**
 * The tables of the second look at watching, and its readings by the rule, made from its records and from nothing else.
 *
 *   node experiments/watching/second-look/tables.mjs            print them as Markdown, for each block that has a record
 *   node experiments/watching/second-look/tables.mjs --check    exit 1 unless RESULTS.md holds these, once, and no other table of a block;
 *                                                                while nothing has been run, exit 1 if a results page exists at all
 *
 * For each block: one row for each run, in the order the block makes them (README.md, "Three rounds, in two blocks"),
 * and then the rule of reading applied to the five measures it is applied to, pair of arms by pair of arms ("How it
 * will be read"). The rule is applied here, by this script, so that nobody applies it by eye. Every value is read from
 * a run's result.json and score.json, at the precision the record holds and not as a row rounds it. A run that was
 * made once more is read from its rerun. No model, no network.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
/**
 * The one correction made to the runner while the look was being run, as the-corrected-runner.json beside this script
 * names it: the runner before it and the runner after it, each by its whole checksum. Null when the file is not there
 * or does not hold both. The runner reads the same file the same way, and a test holds the two to each other.
 */
export function theCorrection(path = join(here, "the-corrected-runner.json")) {
  try {
    const kept = JSON.parse(readFileSync(path, "utf8"));
    const sums = [kept?.the_earlier_runner, kept?.the_corrected_runner];
    if (sums.every((sum) => typeof sum === "string" && /^[0-9a-f]{64}$/.test(sum)) && sums[0] !== sums[1] && typeof kept.why === "string" && kept.why.trim().length > 20) return { the_earlier_runner: sums[0], the_corrected_runner: sums[1], why: kept.why };
  } catch {}
  return null;
}
const BLOCKS = ["opus", "sonnet"];
const TASKS = ["four", "six"];
/** The arms' places in each block's three rounds, as the block makes them: scripts/lib/watching-second-look-paid.mjs holds the same table, and a test holds the two to each other. */
export const ROUNDS = {
  opus: [
    ["plain", "watched", "outside"],
    ["watched", "outside", "plain"],
    ["outside", "plain", "watched"],
  ],
  sonnet: [
    ["watched", "plain", "outside"],
    ["plain", "outside", "watched"],
    ["outside", "watched", "plain"],
  ],
};
export const HEAD = ["Round", "Task", "Arm", "Ended by", "Problems in its record", "Cost", "Minutes", "Turns", "Subagents", "Most at once", "Unseen tests passed", "Tokens put out", "Written to the cache", "In the project: calls naming / shown", "Outside it: calls naming / shown / refused", "Final reply names the recorder", "Handed to the session, of kinds no plain run of the block was", "Hook beside the harness: starts / stops · differences · expected"];

/** A file of a record, read. One that was cut short says which file it is. */
const read = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${path} cannot be read: it is cut short, or is not JSON (${error.message}). The tables are made from whole records`);
  }
};
const money = (usd) => (typeof usd === "number" ? `$${usd.toFixed(2)}` : "not reported");
const number = (value) => (typeof value === "number" ? value.toLocaleString("en-US") : "");
const short = (sha) => String(sha ?? "not recorded").slice(0, 8);

/**
 * A run's record: its own, or its rerun's when the harness ended its own or its own was never written. Null when it
 * has none. `began` is when the run was first recorded, its own record's time where it has one: a run made once more
 * keeps its place in the order it was made in.
 */
function recordOf(root, block, task, arm, round) {
  const own = join(root, block, task, `${arm}-${round}`);
  const kept = (dir) => (existsSync(join(dir, "result.json")) ? { result: read(join(dir, "result.json")), score: existsSync(join(dir, "score.json")) ? read(join(dir, "score.json")) : null } : null);
  const first = kept(own);
  const again = kept(`${own}-rerun`);
  const used = !first || first.result.ended_by === "the harness" ? (again ?? first) : first;
  return used ? { ...used, began: String((first ?? used).result.recorded ?? "") } : null;
}

/** Every run of a block in the order it makes them, each with its record or null. */
const runsOf = (root, block) => ROUNDS[block].flatMap((arms, at) => arms.flatMap((arm) => TASKS.map((task) => ({ block, task, arm, round: at + 1, record: recordOf(root, block, task, arm, at + 1) }))));
const checkoutOf = (record) => record?.result.given?.the_runners_checkout ?? {};
/** The unseen tests a run passed, the packages' sum; null where any package's suite did not run, which is no count of nothing. */
const passedOf = (score) => (score && Array.isArray(score.packages) && score.packages.length > 0 && score.packages.every((pkg) => pkg.ran !== false && Number.isInteger(pkg.passed)) ? score.packages.reduce((sum, pkg) => sum + pkg.passed, 0) : null);
const kindsOf = (record) => Object.keys(record?.result.measures?.given?.entries_of_what_it_was_given ?? {});

function row({ task, arm, round, record }, first, plainKinds) {
  if (!record) return [String(round), `\`${task}\``, arm, "not run", ...HEAD.slice(4).map(() => "")];
  if (record.result.written_by_hand) return [String(round), `\`${task}\``, arm, "not obtained (marked by hand)", ...HEAD.slice(4).map(() => "")];
  const { result, score } = record;
  const m = result.measures ?? {};
  const subagents = m.subagents ?? {};
  const kinds = Object.entries(subagents.by_type ?? {}).map(([type, count]) => `${count} ${type}`).join(", ");
  const inside = m.footprint ?? {};
  const outside = m.noticed ?? {};
  const reply = outside.the_final_reply ?? {};
  const each = result.the_hooks_file_agent_by_agent;
  const starts = each ? each.each.reduce((sum, agent) => sum + agent.runs.start_lines, 0) : null;
  const stops = each ? each.each.reduce((sum, agent) => sum + agent.runs.stop_lines, 0) : null;
  const expected = each ? Object.values(each.expected?.by_kind ?? {}).reduce((sum, agents) => sum + agents.length, 0) : null;
  const handed = kindsOf(record).filter((kind) => !plainKinds.has(kind));
  return [
    record === first ? `${round}, the block's first run` : String(round),
    `\`${task}\``,
    result.not_watched ? `${arm}, NOT WATCHED: no hook's file` : arm,
    result.ended_by ?? "",
    String((result.problems ?? []).length),
    money(m.session?.cost_usd_as_the_harness_reports),
    String(m.session?.minutes_by_the_runners_clock ?? ""),
    String(m.session?.turns_as_the_harness_reports ?? ""),
    subagents.count > 0 ? `${subagents.count} (${kinds})` : "0",
    String(m.delegation?.most_at_once ?? ""),
    score && Array.isArray(score.packages) ? score.packages.map((pkg) => (pkg.ran !== false && Number.isInteger(pkg.passed) ? `${pkg.passed}/${pkg.cases}` : "suite not run")).join(" · ") : "not scored",
    number(m.delegation?.tokens_put_out_with_its_subagents),
    number(m.delegation?.tokens_written_to_the_cache_with_its_subagents),
    `${inside.named_in_the_input?.calls ?? 0} / ${inside.shown_in_the_result?.calls ?? 0}`,
    `${outside.named_in_the_input?.calls ?? 0} / ${outside.shown_in_the_result?.calls ?? 0} / ${outside.named_in_the_input?.of_them_refused ?? 0}`,
    reply.read ? (reply.names_the_recorder ? "yes" : "no") : "not read",
    arm === "plain" ? "" : handed.length > 0 ? handed.map((kind) => `\`${kind}\``).join(", ") : "none",
    arm === "plain" ? "" : each ? (each.the_hooks_file.found ? `${starts} / ${stops} · ${each.differences.count} · ${expected}` : "no file") : "not compared",
  ];
}

// ── the rule of reading, applied ─────────────────────────────────────────

/**
 * The five measures the rule is applied to, each read from a run's record at the precision the record holds. The count
 * of subagents is the transcripts'. A value that is not there is no value: the run is left out of that measure.
 */
export const MEASURES = [
  { name: "Unseen tests passed, the packages' sum", of: ({ score }) => passedOf(score), show: (value) => String(value) },
  { name: "Cost, as the harness reports", of: ({ result }) => result.measures?.session?.cost_usd_as_the_harness_reports ?? null, show: (value) => `$${value.toFixed(4)}` },
  { name: "Minutes, by the runner's clock", of: ({ result }) => result.measures?.session?.minutes_by_the_runners_clock ?? null, show: (value) => String(value) },
  { name: "Subagents started", of: ({ result }) => result.measures?.subagents?.count ?? null, show: (value) => String(value) },
  { name: "Tokens put out, with its subagents", of: ({ result }) => result.measures?.delegation?.tokens_put_out_with_its_subagents ?? null, show: (value) => value.toLocaleString("en-US") },
];
export const PAIRS = [["plain", "watched"], ["plain", "outside"], ["watched", "outside"]];

/** A run whose value is read with its arm: it has a record, the harness did not end it, and it was watched if its arm is a watched one. */
const isRead = (run) => Boolean(run.record) && run.record.result.ended_by !== "the harness" && !run.record.result.not_watched;
/** The run of a block that was recorded first, or null: whatever a block's first run pays, it is this one's. */
const firstOf = (runs) => runs.filter((run) => run.record).reduce((first, run) => (first === null || run.record.began < first.record.began ? run : first), null);
/** Two runs made with the same hook and the same built tool: what a session is run with. The commit's name is not it. */
const sameCheckout = (a, b) => checkoutOf(a).hook_sha256 === checkoutOf(b).hook_sha256 && (checkoutOf(a).tool_sha256 ?? null) === (checkoutOf(b).tool_sha256 ?? null);
/**
 * The runs of a block that were made from another checkout than the block's first run: `outside` runs made later, once
 * the recorder could be installed outside a project. They are published as rows and are not read against the others
 * (README.md, "If the clock runs short, or slice 0108 is not merged").
 */
const madeLater = (runs) => {
  const first = firstOf(runs);
  return first === null ? [] : runs.filter((run) => run.record && !sameCheckout(run.record, first.record));
};

/**
 * Two arms on one task and one measure. They OVERLAP when neither arm's values all lie above the other's: equal values
 * overlap. With fewer than two values in either arm there is nothing to read.
 */
export function onATask(a, b) {
  if (a.length < 2 || b.length < 2) return { read: false, why: `${Math.min(a.length, b.length)} run(s) in an arm` };
  if (Math.min(...a) > Math.max(...b)) return { read: true, apart: "above" };
  if (Math.max(...a) < Math.min(...b)) return { read: true, apart: "below" };
  return { read: true, apart: null };
}

/** Every reading of a block: each measure, for each pair of arms, on each task, and what the rule says of the pair. */
export function readings(root, block) {
  const all = runsOf(root, block);
  const later = madeLater(all);
  const runs = all.filter((run) => isRead(run) && !later.includes(run));
  return MEASURES.flatMap((measure) =>
    PAIRS.map(([a, b]) => {
      const tasks = TASKS.map((task) => {
        const values = (arm) => runs.filter((run) => run.task === task && run.arm === arm).map((run) => measure.of(run.record)).filter((value) => typeof value === "number");
        const [va, vb] = [values(a), values(b)];
        return { task, a: va, b: vb, ...onATask(va, vb) };
      });
      const unread = tasks.filter((task) => !task.read);
      const apart = tasks.filter((task) => task.read && task.apart);
      const says = unread.length > 0 ? `not read: ${unread.map((task) => `\`${task.task}\` has ${task.why}`).join("; ")}` : apart.length === 0 ? "no difference seen" : `a difference: ${apart.map((task) => `on \`${task.task}\`, ${a} ${task.apart} ${b}`).join("; ")}`;
      return { measure, a, b, tasks, says, apart: unread.length > 0 ? [] : apart.map((task) => ({ task: task.task, way: task.apart })) };
    }),
  );
}

function readingsTable(root, block) {
  const head = ["Measure", "Arms", ...TASKS.map((task) => `\`${task}\``), "By the rule"];
  const out = [`#### The \`${block}\` block, read by the rule`, "", `| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`];
  for (const reading of readings(root, block)) {
    const cell = (task) => `${reading.a} ${task.a.map(reading.measure.show).join(", ") || "none"} · ${reading.b} ${task.b.map(reading.measure.show).join(", ") || "none"}: ${task.read ? (task.apart ? `${reading.a} ${task.apart}` : "overlap") : "not read"}`;
    out.push(`| ${[reading.measure.name, `${reading.a}, ${reading.b}`, ...reading.tasks.map(cell), reading.says].join(" | ")} |`);
  }
  out.push("");
  return out;
}

/** A difference seen in both blocks: the same two arms, apart on the same task, in the same direction, on the same measure. */
export function seenInBoth(root) {
  const [first, second] = BLOCKS.map((block) => readings(root, block));
  return first.flatMap((reading, at) => reading.apart.filter((one) => second[at].apart.some((other) => other.task === one.task && other.way === one.way)).map((one) => `${reading.measure.name}: on \`${one.task}\`, ${reading.a} ${one.way} ${reading.b}`));
}

// ── the page's tables ────────────────────────────────────────────────────

/** The tables and the readings, for each block that has at least one record; an empty string while nothing has been run. */
export function tables(root = here) {
  const out = [];
  const made = BLOCKS.map((block) => runsOf(root, block)).filter((runs) => runs.some((run) => run.record));
  const earliest = (runs) => firstOf(runs).record;
  // One checkout for both blocks: every run is held to the checkout of the first run of the whole look.
  const looksFirst = made.length > 0 ? made.map(earliest).reduce((first, record) => (record.began < first.began ? record : first)) : null;
  for (const runs of made) {
    const block = runs[0].block;
    // The block's first run is the one recorded first: whatever a block's first run pays, it is this row's.
    const first = earliest(runs);
    // The session's own model as it answered, in every run of the block that has a record: one name, or each with how many runs.
    const answered = new Map();
    for (const run of runs.filter((one) => one.record)) for (const model of run.record.result.measures?.session?.models_that_answered ?? []) answered.set(model, (answered.get(model) ?? 0) + 1);
    const lead = answered.size > 1 ? [...answered].map(([model, count]) => `\`${model}\` in ${count}`) : [...answered.keys()].map((model) => `\`${model}\``);
    const plainKinds = new Set(runs.filter((run) => run.arm === "plain").flatMap((run) => kindsOf(run.record)));
    out.push(`### The \`${block}\` block (the session's own model answered as ${lead.join(", ") || "not recorded"})`, "");
    out.push(`The block's first run was made from commit \`${short(checkoutOf(first).commit)}\`, with the hook's file \`${short(checkoutOf(first).hook_sha256)}\` and the built tool \`${short(checkoutOf(first).tool_sha256)}\`.`, "");
    out.push(`| ${HEAD.join(" | ")} |`, `|${HEAD.map(() => "---").join("|")}|`);
    for (const run of runs) out.push(`| ${row(run, first, plainKinds).join(" | ")} |`);
    out.push("");
    const named = (list) => list.map((run) => `\`${run.task}\` ${run.arm} ${run.round}`).join(", ");
    const others = runs.filter((run) => run.record && !sameCheckout(run.record, looksFirst));
    if (others.length > 0) out.push(`Made with another hook's file, or another build of the tool, than the first run of the look: ${named(others)}.`, "");
    // A block whose records name more than one runner says which made which. Only where they are the two that the one
    // correction names (the-corrected-runner.json, beside this script), checksum for checksum, is it said that they
    // hand a session the same; of any other two, or of three, only the fact. No record's own word is taken for it.
    const runners = new Map();
    for (const run of runs.filter((one) => one.record && typeof checkoutOf(one.record).runner_sha256 === "string")) runners.set(checkoutOf(run.record).runner_sha256, [...(runners.get(checkoutOf(run.record).runner_sha256) ?? []), run]);
    const correction = theCorrection();
    if (runners.size > 1) out.push(correction && runners.size === 2 && runners.has(correction.the_earlier_runner) && runners.has(correction.the_corrected_runner) ? `Made with two runners that hand a session the same thing (README.md, the note of 2026-10-12): the runner \`${short(correction.the_earlier_runner)}\` made ${named(runners.get(correction.the_earlier_runner))}, and the corrected runner \`${short(correction.the_corrected_runner)}\` made the rest. No run is kept from being read with the others for its runner.` : `Made with more than one runner: ${[...runners].map(([sum, made]) => `\`${short(sum)}\` made ${named(made)}`).join("; ")}.`, "");
    const later = madeLater(runs);
    if (later.length > 0) out.push(`Made with another hook's file, or another build of the tool, than this block's own first run, and so published as rows and not read with the block's other runs: ${named(later)}.`, "");
    out.push(...readingsTable(root, block));
  }
  if (made.length === BLOCKS.length) {
    const both = seenInBoth(root);
    out.push(`**Seen in both blocks:** ${both.length > 0 ? both.join("; ") : "nothing"}.`, "");
  }
  return out.join("\n");
}

/** What `--check` says: whether the results page holds the tables its records make, or, with no record, that there is no page. */
export function check(root = here) {
  const text = tables(root).trim();
  const page = existsSync(join(root, "RESULTS.md")) ? readFileSync(join(root, "RESULTS.md"), "utf8") : null;
  if (text === "") return page === null ? { ok: true, says: "second look's tables: nothing has been run, and there is no results page" } : { ok: false, says: "experiments/watching/second-look/RESULTS.md exists and no run has a record: a results page is written from records" };
  if (page === null || !page.includes(text)) return { ok: false, says: "experiments/watching/second-look/RESULTS.md does not hold the tables these records make: run node experiments/watching/second-look/tables.mjs and paste what it prints" };
  // The page holds them once, and holds no other table of a block: a stale copy left beside the new one would pass a test that only looks for the new one.
  const headings = (where) => where.split("\n").filter((line) => /^#{3,4} The `\w+` block/.test(line));
  if (page.split(text).length !== 2 || headings(page).length !== headings(text).length) return { ok: false, says: "experiments/watching/second-look/RESULTS.md holds the tables these records make and also another table of a block, or the same one twice: a results page holds each block's table once, as tables.mjs prints it" };
  return { ok: true, says: "second look's tables: RESULTS.md holds the tables its records make, once, and no other table of a block" };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes("--check")) {
    const checked = check();
    (checked.ok ? console.log : console.error)(checked.says);
    process.exit(checked.ok ? 0 : 1);
  }
  process.stdout.write(`${tables()}\n`);
}

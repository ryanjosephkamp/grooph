// F2. The rule of reading as the tables apply it (readings, onATask, seenInBoth in tables.mjs). This code was NOT in
// commit fa4ea32a: it came with a775ef7c and was changed again in a0718161, while the reader was reading. Where a
// checkout's tables.mjs has no `readings`, this script says so and ends.
//
//   1. outside runs made later, under another version of the harness than the block's plain runs, from one checkout
//   2. a package whose unseen suite could not be run at all, in one run of an arm
//   3. equal values; two runs against three; the same difference in both blocks, and the other way round
//   4. the block's records committed between two rounds (the commit's name changes, the tool does not)
//
//   sh with-fake-home.sh f2-rule-of-reading.mjs
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lib, order, place, root, say } from "./lib.mjs";

const tablesOf = await import(join(root, "experiments", "watching", "second-look", "tables.mjs"));
if (typeof tablesOf.readings !== "function") {
  console.log("this checkout's tables.mjs applies no rule of reading (no `readings`): nothing to try here");
  process.exit(0);
}
const { runOne } = await import(join(lib, "watching-second-look-paid.mjs"));
const p = place({ cost: 0.25, result: "done", uses: [{ tool: "Agent", input: { subagent_type: "general-purpose" }, meta: { toolUseId: "<use>", spawnDepth: 1, requestShape: "background" } }] });
const real = await runOne(p.opus);
const kept = { result: JSON.parse(readFileSync(join(real.recordDir, "result.json"), "utf8")), score: JSON.parse(readFileSync(join(real.recordDir, "score.json"), "utf8")) };
let made = 0;
function records(runs, change = () => {}) {
  const at = join(p.top, `records-${(made += 1)}`);
  runs.forEach((run, n) => {
    const result = structuredClone(kept.result);
    const score = structuredClone(kept.score);
    Object.assign(result, { run: run.name, block: run.block, task: run.task, arm: run.arm, round: run.round, replicate: run.replicate, recorded: new Date(Date.parse("2026-10-12T00:00:00.000Z") + n * 600_000).toISOString(), harness: { path: "/the/harness", version: "2.1.289 (Claude Code)" } });
    // A cost of its own for every run, the arms a little apart: plain lowest, then watched, then outside.
    result.measures.session.cost_usd_as_the_harness_reports = 1 + ["plain", "watched", "outside"].indexOf(run.arm) + run.round / 10;
    change(run, result, score, n);
    mkdirSync(join(at, run.name), { recursive: true });
    writeFileSync(join(at, run.name, "result.json"), JSON.stringify(result));
    writeFileSync(join(at, run.name, "score.json"), JSON.stringify(score));
  });
  return at;
}
const blockOf = (block) => order().filter((run) => run.block === block);
const of = (at, block, measure, a, b) => tablesOf.readings(at, block).find((reading) => reading.measure.name.startsWith(measure) && reading.a === a && reading.b === b);

// 1.
{
  const at = records(blockOf("opus"), (run, result) => {
    if (run.arm === "outside") {
      result.harness.version = "2.1.301 (Claude Code)";
      result.recorded = "2026-10-15T00:00:00.000Z";
    }
  });
  const reading = of(at, "opus", "Cost", "plain", "outside");
  say(/^not read/.test(reading.says) ? "HELD" : "SEEN", `1. the block's outside runs were made three days later under harness 2.1.301, from the same checkout, its plain runs under 2.1.289: the tables read the pair by the rule: "${reading.says}"`, `at a775ef7c the page said such runs are not read "if the version was not the same"; since a0718161 the page and the tables leave out runs from another CHECKOUT, and the version is no longer a condition. No row and no reading says which version of the harness a run was made under`);
}
// 2.
{
  const at = records(blockOf("opus"), (run, _result, score) => {
    if (run.arm === "watched") score.packages[2] = { ...score.packages[2], ran: false, reason: "node --test produced no summary (exit null)", cases: null, passed: null, failed: null, rate: null };
  });
  const reading = of(at, "opus", "Unseen tests passed", "plain", "watched");
  say(/a difference/.test(reading.says) ? "SHOWN" : "HELD", `2. in every watched run the scorer could not run csvline's suite at all (no summary; with no work done that suite passes 38): the rule says "${reading.says}"`, `plain ${JSON.stringify(reading.tasks[0].a)} against watched ${JSON.stringify(reading.tasks[0].b)}: a suite that was not run is added in as 0 passed, the same as a suite that ran and passed nothing`);
}
// 4. (since commit a0718161) A run from another checkout than its block's first run is left out of the readings.
// What makes a checkout "another" is the commit's name. Here the block's first round is made, its records are committed
// (nothing of the tool changes: the same hook's file), and rounds two and three are made with --another-checkout.
{
  const at = records(blockOf("opus"), (run, result) => {
    result.given.the_runners_checkout = { ...result.given.the_runners_checkout, commit: run.round === 1 ? "a".repeat(40) : "b".repeat(40), hook_sha256: "f".repeat(64) };
  });
  const all = tablesOf.readings(at, "opus");
  const unread = all.filter((reading) => /^not read/.test(reading.says)).length;
  const text = tablesOf.tables(at);
  const told = text.split("\n").find((row) => /published as rows and not read/.test(row)) ?? "";
  say(unread === all.length ? "SHOWN" : "HELD", `4. a block of eighteen runs, all with the same hook and tool, its records committed once after the first round: ${unread} of the block's ${all.length} readings are "not read" (${all[0].says})`, `the tables say: ${told.slice(0, 150)}…\nwith three runs an arm made, the rule reads one: a commit of records between rounds takes twelve runs out of the reading`);
}
// 3.
{
  say(tablesOf.onATask([1, 2], [2, 3]).apart === null && tablesOf.onATask([1, 1], [1, 1]).apart === null && tablesOf.onATask([1, 2], [3, 4, 5]).apart === "below" && tablesOf.onATask([1], [3, 4, 5]).read === false ? "HELD" : "SHOWN", "3. values that touch overlap; equal values overlap; two runs against three are read; one run in an arm is not read");
  const both = records(order());
  const same = tablesOf.seenInBoth(both);
  const flipped = records(order(), (run, result) => {
    if (run.block === "sonnet") result.measures.session.cost_usd_as_the_harness_reports = 10 - result.measures.session.cost_usd_as_the_harness_reports;
  });
  const other = tablesOf.seenInBoth(flipped);
  say(same.some((line) => /^Cost/.test(line)) && !other.some((line) => /^Cost/.test(line)) ? "HELD" : "SHOWN", `3. the same difference in both blocks is said to be seen in both (${same.filter((line) => /^Cost/.test(line)).length} cost readings); the same arms apart the other way round in the second block are not (${other.filter((line) => /^Cost/.test(line)).length})`);
}
rmSync(p.top, { recursive: true, force: true });

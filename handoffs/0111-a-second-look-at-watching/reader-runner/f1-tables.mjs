// F1. The tables (experiments/watching/second-look/tables.mjs) and their --check.
// One real record is made with the stand-in harness; the others are copies of it with a run's own facts changed, so
// every record has the shape the runner writes.
//
//   1. two blocks from two checkouts (the case the page's rule is for): does the page's table name it?
//   2. --check with a results page that holds the right tables AND other tables and sentences that are wrong
//   3. the heading's "the session's own model answered as …", when a later run of the block answered on another model
//   4. a package whose unseen suite produced no summary (the scorer's own shape for it)
//   5. "the block's first run" when the block's real first session was ended by the harness and made once more later
//   6. a run whose record has problems (the owner's own places not as they were, the profile's check not holding,
//      a change not wholly read): what does its row show?
//   7. shapes that make the script throw
//
//   sh with-fake-home.sh f1-tables.mjs
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lib, order, place, root, say } from "./lib.mjs";

const { runOne } = await import(join(lib, "watching-second-look-paid.mjs"));
const { check, tables } = await import(join(root, "experiments", "watching", "second-look", "tables.mjs"));

const p = place({ cost: 0.25, result: "done", uses: [{ tool: "Agent", input: { subagent_type: "general-purpose" }, meta: { toolUseId: "<use>", spawnDepth: 1, requestShape: "background" } }] });
const real = await runOne(p.opus);
const kept = { result: JSON.parse(readFileSync(join(real.recordDir, "result.json"), "utf8")), score: JSON.parse(readFileSync(join(real.recordDir, "score.json"), "utf8")) };
/** A fresh folder of records: every run of `runs`, each a copy of the real one with what `change` makes of it. */
let made = 0;
function records(runs, change = () => {}) {
  const at = join(p.top, `records-${(made += 1)}`);
  runs.forEach((run, n) => {
    const result = structuredClone(kept.result);
    const score = structuredClone(kept.score);
    Object.assign(result, { run: run.name, block: run.block, task: run.task, arm: run.arm, round: run.round, replicate: run.replicate, recorded: new Date(Date.parse("2026-10-12T00:00:00.000Z") + n * 600_000).toISOString() });
    const more = change(run, result, score, n) ?? {};
    const dir = join(at, `${run.name}${more.rerun ? "-rerun" : ""}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "result.json"), JSON.stringify(result));
    if (more.score !== false) writeFileSync(join(dir, "score.json"), JSON.stringify(score));
  });
  return at;
}
const blockOf = (block) => order().filter((run) => run.block === block);

// 1.
{
  const at = records(order(), (run, result) => {
    if (run.block === "sonnet") result.given.the_runners_checkout = { ...result.given.the_runners_checkout, commit: "b".repeat(40), hook_sha256: "c".repeat(64), another_than_a_run_before: { run: "opus/four/plain-1", what: ["another commit", "another hook"], said_by: "--another-checkout" } };
  });
  const text = tables(at);
  say(/Made from another checkout/.test(text) ? "HELD" : "SHOWN", `1. the opus block from one commit and hook, the WHOLE sonnet block from another (every sonnet record says another_than_a_run_before, by --another-checkout): the tables ${/Made from another checkout/.test(text) ? "name it" : "say NOTHING of it"}`, "at commit fa4ea32a a run was named only against its own block's first run, and nothing was said; since a775ef7c every run is held to the first run of the look");
  // And one run of the block from another: named, as the test has it.
  const one = records(blockOf("opus"), (run, result, _score, n) => {
    if (n === 7) result.given.the_runners_checkout = { ...result.given.the_runners_checkout, hook_sha256: "c".repeat(64) };
  });
  say(/Made from another checkout than [^\n]*`six` watched 2\./.test(tables(one)) ? "HELD" : "SHOWN", "1. one run of a block from another hook than the block's first: named under the table");
}

// 2.
{
  const at = records(blockOf("opus"));
  const text = tables(at);
  const stale = text.replaceAll("$0.25", "$9.99").replace("### The `opus` block", "### The `opus` block, as it was before");
  writeFileSync(join(at, "RESULTS.md"), `# What the runs showed\n\nNo run of the outside arm cost more than $0.01, and watching has no effect.\n\n${stale}\n\n${text}\n\n### The \`sonnet\` block (made up)\n\n| 1 | \`four\` | plain | the session | $0.00 |\n`);
  const checked = check(at);
  say(checked.ok ? "SHOWN" : "HELD", `2. a results page that holds the tables its records make, and before them the same table with every cost changed, a sentence no record bears out, and a table for a block with no record: --check ${checked.ok ? "PASSES" : "fails"}`, `it says: ${checked.says}\n(its own first lines say "exit 1 unless RESULTS.md holds exactly these tables"; what it asks is that the page holds them somewhere)`);
}

// 3.
{
  const at = records(blockOf("opus"), (run, result, _score, n) => {
    if (n >= 1) result.measures.session.models_that_answered = ["claude-sonnet-5-5"];
  });
  const head = tables(at).split("\n")[0];
  say(/claude-sonnet-5-5/.test(head) ? "HELD" : "SHOWN", `3. seventeen of the block's eighteen sessions answered on claude-sonnet-5-5 and the first on claude-opus-5-5: the heading reads "${head}"`, "the heading is one record's (the block's first); no row carries the model that answered, and --check holds the page to that heading");
}

// 4.
{
  const at = records(blockOf("opus").slice(0, 1), (_run, _result, score) => {
    // What scoreHeldOut returns when node --test printed no summary, as score() keeps it (compare-score.mjs, line 76).
    score.packages[0] = { package: "settingskit", folder: "settingskit", scored_from: "experiments/comparisons/review-gate-2/held-out", ran: false, reason: "node --test produced no summary (exit null)", cases: null, passed: null, failed: null, rate: null };
  });
  const cell = tables(at).split("\n").find((row) => /^\| 1, the block's first run \|/.test(row)).split("|")[10].trim();
  say(/null/.test(cell) ? "SHOWN" : "HELD", `4. a package whose unseen suite printed no summary: the row's cell reads "${cell}"`, "the status prints \"not run\" for it; the table prints null/null, and the run's sum of cases is short by that package's");
}

// 5.
{
  const opus = blockOf("opus");
  const at = records(opus.slice(0, 6), (run, result, _score, n) => {
    if (n === 0) {
      // The block's first session, ended by the harness after it had begun; made once more after the round's other five.
      result.recorded = "2026-10-12T02:00:00.000Z";
      result.rerun_of = run.name;
      return { rerun: true };
    }
  });
  mkdirSync(join(at, opus[0].name), { recursive: true });
  writeFileSync(join(at, opus[0].name, "result.json"), JSON.stringify({ ...kept.result, ended_by: "the harness", why: "the harness's result is its own error", recorded: "2026-10-12T00:00:00.000Z", reported_cost_usd: 0.4 }));
  const first = tables(at).split("\n").find((row) => /the block's first run/.test(row)).split("|").slice(1, 4).map((cell) => cell.trim()).join(" ");
  say(/four.*plain/.test(first) ? "HELD" : "SHOWN", `5. the block's first session was opus/four/plain-1, which the harness ended after it reported $0.40; it was made once more after five others: "the block's first run" is the row of ${first}`, "the row marked is the earliest record that is read, not the block's first session; a row read from a rerun is not marked as one");
}

// 6.
{
  const at = records(blockOf("opus").slice(0, 6), (run, result) => {
    if (run.arm === "outside") result.problems = ["after the run the profile's own check does not hold on every line (its settings are the repository's: …): a person looks before anything else is started", "the owner's own settings or grooph folder are not as they were before the run: a person looks before anything else is started"];
    if (run.arm === "watched") result.problems = ["the project's change was not wholly read: git add did not end within 120 seconds"];
  });
  const rows = tables(at).split("\n").filter((row) => /\| (outside|watched)[^|]*\|/.test(row));
  const told = rows.some((row) => /not as they were|does not hold|not wholly read|problem/i.test(row));
  say(told ? "HELD" : "SHOWN", `6. two outside runs whose records say the owner's own places "are not as they were" and that the profile's check does not hold, and two watched runs whose records say the project's change was not wholly read: their rows ${told ? "say so" : "do NOT say so"}`, "no column holds a record's problems, or says that it has any (a run with no hook's file is marked, since the edits after fa4ea32a; nothing else is)");
}

// 7.
for (const [what, change] of [["a score.json that holds {}", (dir) => writeFileSync(join(dir, "score.json"), "{}")], ["a result.json that holds null", (dir) => writeFileSync(join(dir, "result.json"), "null")], ["a result.json that is empty", (dir) => writeFileSync(join(dir, "result.json"), "")]]) {
  const at = records(blockOf("opus").slice(0, 1));
  change(join(at, "opus", "four", "plain-1"));
  let said;
  try {
    said = `went on: ${check(at).says.slice(0, 60)}`;
  } catch (error) {
    said = `THREW ${error.name}: ${error.message.slice(0, 80)}`;
  }
  say(said.startsWith("THREW") ? "SEEN" : "HELD", `7. ${what}: check() ${said}`);
}
rmSync(p.top, { recursive: true, force: true });

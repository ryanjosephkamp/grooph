// E1. The order and the block rules: nextRun, heldUpBy, stateOf, --rerun, and the page's sentence "The runner refuses
// a block while the block before it has no whole round, or has a round begun and not finished."
//
//   1. a first round in which every run was ended by the harness: is that "a whole round"?
//   2. the opus block's third round begun with its outside runs only: is that "a round begun"?
//   3. a run whose runner was stopped twice before a record was written (once on the run, once on its rerun)
//   4. a run the harness ended, whose rerun's runner was stopped before the record was written
//   5. a result.json cut short (the file is written in place, not through a temp file)
//   6. the two orders (the runner's and the tables') after the sonnet block was made to start from the second round
//
//   sh with-fake-home.sh e1-order.mjs
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inHand, lib, order, place, quietPlan, root, say } from "./lib.mjs";

const { heldUpBy, nextRun, runOne, stateOf, status, roundsOf, madeFromAnother } = await import(join(lib, "watching-second-look-paid.mjs"));
const tables = await import(join(root, "experiments", "watching", "second-look", "tables.mjs"));
const blockOf = (block) => order().filter((run) => run.block === block);
const tried = async (options) => {
  try {
    return { done: await runOne(options) };
  } catch (error) {
    return { refused: error.message };
  }
};
const clip = (text, p) => String(text).replaceAll(p.top, "<top>").replace(/\s+/g, " ").slice(0, 300);
const lineOf = (n, run, more = {}) => ({ n, run: `second-look/${run}`, project: `second-look/${run.split("/").slice(0, 2).join("/")}`, arm: "plain", replicate: 1, kind: "kickoff", status: "ok", cost_usd: 1, reported_cost_usd: 1, max_budget_usd: 12, started: `2026-10-11T00:00:0${n}.000Z`, session_id: `s-${n}`, note: "", ...more });

// 1.
{
  const p = place(quietPlan("watched"));
  const round1 = blockOf("opus").filter((run) => run.round === 1 && run.arm !== "outside");
  inHand(p.recordRoot, round1, { ended_by: "the harness", why: "the harness's result is its own error (usage limit)" });
  const held = heldUpBy("sonnet", p.recordRoot);
  const out = await tried({ ...p.common, block: "sonnet" });
  say(held === null && out.done ? "SHOWN" : "HELD", `1. the opus block holds four records and every one was ended by the harness (no session's work at all): the sonnet block ${out.done ? `WAS STARTED (${out.done.run.name})` : `is refused: ${clip(out.refused, p)}`}`, `the four read: ${[...new Set(round1.map((run) => stateOf(run, p.recordRoot).state))].join("; ")}`);
  rmSync(p.top, { recursive: true, force: true });
}

// 2.
{
  const p = place(quietPlan("watched"));
  const opus = blockOf("opus");
  inHand(p.recordRoot, [...opus.filter((run) => run.round <= 2), ...opus.filter((run) => run.round === 3 && run.arm === "outside")]);
  const held = heldUpBy("sonnet", p.recordRoot);
  say(held === null ? "SHOWN" : "HELD", `2. the opus block's third round is begun (its two outside runs are recorded, its four others are not): the sonnet block is ${held === null ? "NOT held up" : "held up"}`, `the next run of opus is ${nextRun(p.recordRoot, "opus").name}; by the page a block is refused while the one before it "has a round begun and not finished"`);
  rmSync(p.top, { recursive: true, force: true });
}

// 3.
{
  const first = order()[0];
  const p = place(quietPlan("plain"), { lines: [lineOf(1, first.name), lineOf(2, `${first.name}-rerun`, { replicate: "1-rerun" })] });
  const next = await tried(p.opus);
  const rerun = await tried({ ...p.common, rerun: first.name });
  inHand(p.recordRoot, blockOf("opus").slice(1, 4));
  const wedged = next.refused && rerun.refused;
  say(wedged ? "SHOWN" : "HELD", `3. ${first.name}: two lines on the ledger (the run, and its rerun), both sessions over, and no record of either (the runner was stopped twice before result.json): ${wedged ? "NEITHER command will ever make it" : "it can be made"}`, [
    `the block's command: ${clip(next.refused ?? "started", p)}`,
    `--rerun: ${clip(rerun.refused ?? "started", p)}`,
    `(this script has no --retry: that is compare.sh's flag, named by the lab's gate)`,
    `with the round's three other runs recorded, the sonnet block: ${clip(heldUpBy("sonnet", p.recordRoot)?.why ?? "not held up", p).slice(0, 190)}`,
    `no flag leaves a plain or a watched run out, so the opus block cannot finish and the sonnet block cannot start until the ledger is changed by hand`,
  ].join("\n"));
  rmSync(p.top, { recursive: true, force: true });
}

// 4.
{
  const first = order()[0];
  const p = place(quietPlan("plain"), { lines: [lineOf(1, first.name, { status: "failed", cost_usd: null, reported_cost_usd: null }), lineOf(2, `${first.name}-rerun`, { replicate: "1-rerun" })] });
  inHand(p.recordRoot, [first], { ended_by: "the harness", why: "no result from the harness (exit 1)" });
  const rerun = await tried({ ...p.common, rerun: first.name });
  say(rerun.refused ? "SHOWN" : "HELD", `4. ${first.name} was ended by the harness; its one rerun's session ran (a line on the ledger, $1.00) and the runner was stopped before result.json: the rerun ${rerun.refused ? "can NEVER be made or recorded" : "can be made"}`, `--rerun: ${clip(rerun.refused ?? "started", p)}\nthe run reads "${stateOf(first, p.recordRoot).state}" from now on; the block goes on without it (next: ${nextRun(p.recordRoot, "opus").name})`);
  rmSync(p.top, { recursive: true, force: true });
}

// 5.
{
  const p = place();
  const first = order()[0];
  mkdirSync(join(p.recordRoot, first.name), { recursive: true });
  writeFileSync(join(p.recordRoot, first.name, "result.json"), '{"run":"opus/four/plain-1","ended_by":"the ses');
  const each = {};
  for (const [name, work] of [["status()", () => status({ ledgerPath: p.ledgerPath, recordRoot: p.recordRoot })], ["stateOf()", () => stateOf(first, p.recordRoot)], ["tables()", () => tables.tables(p.recordRoot)], ["tables' check()", () => tables.check(p.recordRoot)], ["madeFromAnother()", () => madeFromAnother({ commit: "a", hook_sha256: "b" }, p.recordRoot)]]) {
    try {
      work();
      each[name] = "went on";
    } catch (error) {
      each[name] = `THREW ${error.name}: ${error.message.slice(0, 70)}`;
    }
  }
  const rerun = await tried({ ...p.common, rerun: first.name });
  say(Object.values(each).some((said) => said.startsWith("THREW")) ? "SHOWN" : "HELD", `5. a result.json cut short in ${first.name}: it counts as recorded (next: ${nextRun(p.recordRoot, "opus").name}), and`, [...Object.entries(each).map(([name, said]) => `${name}: ${said}`), `--rerun: ${rerun.refused ? `${rerun.refused.constructor?.name ?? ""} ${clip(rerun.refused, p).slice(0, 120)}` : "started"}`, "(none of them names the file)"].join("\n"));
  rmSync(p.top, { recursive: true, force: true });
}

// 6.
{
  const mine = order().map((run) => `${run.block}/${run.task}/${run.arm}-${run.round}`);
  const p = place();
  inHand(p.recordRoot, order(), { ended_by: "the session", recorded: "2026-10-11T00:00:00.000Z" });
  const text = tables.tables(p.recordRoot);
  const rows = text.split("\n").filter((row) => /^\| [123]/.test(row)).map((row) => row.split("|").slice(1, 4).map((cell) => cell.trim()));
  const theirs = rows.map(([round, task, arm], at) => `${at < 18 ? "opus" : "sonnet"}/${task.replaceAll("`", "")}/${arm}-${round[0]}`);
  say(JSON.stringify(mine) === JSON.stringify(theirs) ? "HELD" : "SHOWN", `6. the tables' rows are in the runner's order for both blocks (${theirs.length} rows; sonnet begins ${theirs[18]}, ${roundsOf("sonnet").map((arms) => arms[0]).join(" / ")} first in its three rounds)`);
  // A folder kept for a run that was not started is no record of the run.
  rmSync(join(p.recordRoot, order()[4].name), { recursive: true });
  mkdirSync(join(p.recordRoot, `${order()[4].name}-not-started`), { recursive: true });
  writeFileSync(join(p.recordRoot, `${order()[4].name}-not-started`, "result.json"), JSON.stringify({ ended_by: "nobody: no session was started" }));
  say(nextRun(p.recordRoot, "opus")?.name === order()[4].name && stateOf(order()[4], p.recordRoot).state === "not recorded" ? "HELD" : "SHOWN", `6. a folder kept for a run that was not started is not read as its record (next: ${nextRun(p.recordRoot, "opus")?.name})`);
  rmSync(p.top, { recursive: true, force: true });
}

// B1. The gates before a session is started, through runOne with a temp ledger and the stand-in harness.
//
//   1. the scoring decision: is a recorded NO read as a yes?
//   2. the cap: at the edge, and with a line that is not settled
//   3. a run made once more, twice: a rerun whose own line is on the ledger and whose record was never written
//   4. the same run started twice by the plain command
//   5. the first call's yes, the block's name, the driver's word (the test file has these; repeated here in one place)
//
//   sh with-fake-home.sh b1-gates.mjs
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { inHand, lib, order, place, quietPlan, say } from "./lib.mjs";

const { runOne, WATCHDOG, STOPS_AT_USD } = await import(join(lib, "watching-second-look-paid.mjs"));
/** The ceiling of the block's first run, as the checkout read has it (it was $12 until commit a20d525a, and $15 after). */
const CEILING = WATCHDOG.opus.four.usd;
const started = (p) => existsSync(join(p.at.profile, "command-seen-by-the-stand-in.json"));
const tried = async (options) => {
  try {
    const done = await runOne(options);
    return { done };
  } catch (error) {
    return { refused: error.message };
  }
};
const clip = (text, p) => String(text).replaceAll(p.top, "<top>").replace(/\s+/g, " ").slice(0, 250);
const lineOf = (n, run, more = {}) => ({ n, run: `second-look/${run}`, project: `second-look/${run.split("/").slice(0, 2).join("/")}`, arm: run.split("/")[2].replace(/-\d.*$/, ""), replicate: 1, kind: "kickoff", status: "ok", cost_usd: 1, reported_cost_usd: 1, max_budget_usd: 12, started: `2026-10-11T00:00:0${n}.000Z`, session_id: `s-${n}`, note: "", ...more });

// 1.
{
  const p = place(quietPlan("plain"), { decision: { decided_by: "the owner", on: "2026-10-11", words: "No. Do not run what a session wrote outside the sandbox." } });
  const out = await tried(p.opus);
  say(out.done ? "SHOWN" : "HELD", `1. the ledger records the owner's decision as a NO in so many words: ${out.done ? `the run WAS STARTED (${out.done.run.name}) and scored outside the sandbox: ${out.done.result.scored}` : `refused: ${clip(out.refused, p)}`}`, out.done ? `the gate asks that three fields hold words, not what the words say; the record names the decision it ran on: ${JSON.stringify(out.done.result.scored_outside_the_sandbox_on.words)}` : "");
  rmSync(p.top, { recursive: true, force: true });
}

// 2.
for (const [spent, expect] of [[STOPS_AT_USD - CEILING, "started"], [STOPS_AT_USD - CEILING + 0.000001, "refused"], [STOPS_AT_USD, "refused"]]) {
  const p = place(quietPlan("plain"), { lines: [lineOf(1, "opus/x/y-1", { run: "second-look/x", project: "second-look/x", cost_usd: spent, reported_cost_usd: spent })] });
  const out = await tried(p.opus);
  const got = out.done ? "started" : "refused";
  say(got === expect ? "HELD" : "SHOWN", `2. $${spent} counted, the next run's ceiling $${CEILING} (cap $${STOPS_AT_USD}): ${got}${out.refused ? ` (${clip(out.refused, p).slice(0, 110)}…)` : ""}`);
  rmSync(p.top, { recursive: true, force: true });
}
{
  const p = place(quietPlan("plain"), { lines: [lineOf(1, "opus/x/y-1", { run: "second-look/x", project: "second-look/x", status: "running", cost_usd: null, reported_cost_usd: null, max_budget_usd: 18 })] });
  const out = await tried(p.opus);
  say(out.refused && !started(p) ? "HELD" : "SHOWN", `2. a line still marked running: ${out.refused ? `refused (${clip(out.refused, p).slice(0, 160)}…)` : "STARTED"}; work folder afterwards ${JSON.stringify(readdirSync(p.at.work))}`);
  rmSync(p.top, { recursive: true, force: true });
}

// 3.
for (const status of ["ok", "failed", "running"]) {
  const first = order()[0];
  const p = place(quietPlan("plain"), { lines: [lineOf(1, first.name, { status: "failed", cost_usd: null, reported_cost_usd: null }), lineOf(2, `${first.name}-rerun`, { replicate: "1-rerun", status, cost_usd: status === "ok" ? 0.4 : null, reported_cost_usd: status === "ok" ? 0.4 : null })] });
  inHand(p.recordRoot, [first], { ended_by: "the harness", why: "no result from the harness (exit 1)" });
  const out = await tried({ ...p.common, rerun: first.name });
  say(out.refused && !started(p) ? "HELD" : "SHOWN", `3. a rerun asked for when the ledger already has the rerun's own line (${status}) and no record of it: ${out.refused ? `refused (${clip(out.refused, p).slice(0, 200)}…)` : `A SECOND RERUN WAS STARTED (${out.done.recordDir.slice(p.recordRoot.length + 1)})`}; work folder afterwards ${JSON.stringify(readdirSync(p.at.work))}`);
  rmSync(p.top, { recursive: true, force: true });
}

// 4.
{
  const p = place(quietPlan("plain"));
  const one = await runOne(p.opus);
  inHand(p.recordRoot, order().slice(1, 36));
  const out = await tried(p.opus);
  const again = await tried({ ...p.common, rerun: one.run.name });
  say(out.refused && again.refused ? "HELD" : "SHOWN", `4. a run that is recorded, asked for again: by the block's command ${out.refused ? "refused" : "STARTED"} (${clip(out.refused ?? "", p).slice(0, 90)}); by --rerun ${again.refused ? "refused" : "STARTED"} (${clip(again.refused ?? "", p).slice(0, 90)})`);
  rmSync(p.top, { recursive: true, force: true });
}

// 5.
{
  const p = place(quietPlan("plain"));
  const cases = [
    ["no yes from the first call", { ...p.opus, firstCallGate: { ok: false, why: "the first paid call has no record" } }],
    ["no block", { ...p.common }],
    ["a block that is none", { ...p.common, block: "haiku" }],
    ["the second block first", { ...p.common, block: "sonnet" }],
    ["no word from the driver", { ...p.opus, go: "" }],
    ["a session of the game experiment open", { ...p.opus, gameOpen: ["123 claude --name arena-claude-a"] }],
    ["the profile's check not holding", { ...p.opus, profileCheck: () => [{ what: "the profile is signed in", ok: false, how: "not signed in" }] }],
  ];
  for (const [what, options] of cases) {
    const out = await tried(options);
    say(out.refused && !started(p) && readdirSync(p.at.work).length === 0 && p.ledger().invocations.length === 0 ? "HELD" : "SHOWN", `5. ${what}: ${out.refused ? "refused, nothing made, opened or started" : "STARTED"}`);
  }
  rmSync(p.top, { recursive: true, force: true });
}

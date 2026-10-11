// C1. The "not started" path of the outside arm (commit 96ab69c1): when the launcher's marker file is missing after
// the call, the runner says no session ran, settles the ledger line at $0 under another name, keeps no record for the
// run, and lets the same command start it again. Attacks:
//
//   1. a session that RAN and reported a cost, with no marker afterwards (the marker's file taken away while the
//      session ran: here by the stand-in harness itself, standing for whatever could remove one file from the folder
//      beside the session's). Is the spend settled at $0? Can it be repeated? What does the cap see?
//   2. a marker that is there when NO session ran (the harness's file gone by the time the launcher becomes it)
//   3. the launcher itself not startable (its file not executable): which reason does the record give?
//   4. the listing failing after the install succeeded: is the profile left clean, and can the run be started again?
//   5. a run made once more (--rerun) that is not started: can the rerun still be made?
//
//   sh with-fake-home.sh c1-not-started-path.mjs
import { chmodSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { STAND_IN, filesUnder, inHand, lib, order, place, quietPlan, say, standInTool } from "./lib.mjs";

const { runOne, runAll, room, readLedger, stateOf, STARTED, build } = await import(join(lib, "watching-second-look-paid.mjs"));
const { settingsFor } = await import(join(lib, "compare-profile.mjs"));
const clip = (text, p) => String(text).replaceAll(p.top, "<top>").slice(0, 260);
const ledgerLines = (p) => p.ledger().invocations.map((entry) => `${entry.n}: ${entry.run} ${entry.status} cost ${entry.cost_usd} (counts $${entry.cost_usd ?? entry.max_budget_usd})`);
const settingsClean = (p) => readFileSync(join(p.at.profile, "settings.json"), "utf8") === `${JSON.stringify(settingsFor({ home: p.home }), null, 2)}\n`;

// 1. A session ran, and the marker is gone afterwards.
{
  const p = place(quietPlan("outside", { cost: 0.5 }));
  inHand(p.recordRoot, order().slice(0, 4));
  // The stand-in harness, which first takes the launcher's marker away (it stands beside the session's folder).
  const harness = join(p.top, "harness-that-removes-the-marker");
  // (The marker was beside the session's folder at commit fa4ea32a, and is beside grooph's own folder in the edits after it.)
  writeFileSync(harness, `#!/bin/sh\nrm -f ../harness/${STARTED} ../../../home/${STARTED}\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(STAND_IN)} "$@"\n`, { mode: 0o755 });
  const made = [];
  for (let n = 0; n < 3; n += 1) {
    const all = await runAll({ ...p.opus, claude: harness });
    made.push(...all.done);
    if (n === 0) console.log(`   (the block stopped after it: ${all.stopped?.why}; a person runs the same command again)`);
  }
  const first = made[0];
  const output = JSON.parse(readFileSync(join(first.recordDir, "claude-output.json"), "utf8"));
  const transcripts = filesUnder(join(p.at.profile, "projects")).filter((path) => path.endsWith(".jsonl")).length;
  const has = room(readLedger(p.ledgerPath), 12);
  const shown = made.every((one) => one.notStarted === true) && has.spent === 0;
  say(shown ? "SHOWN" : "HELD", `1. three sessions that ran and each reported $${output.total_cost_usd}: ${shown ? "ALL THREE are recorded as never started and settled at $0" : "not all read as never started"}`, [
    `each time: ${made.map((one) => `${one.run.name} notStarted=${one.notStarted} -> ${one.recordDir.slice(p.recordRoot.length + 1)}`).join("; ")}`,
    `the first one's own result says: ended_by "${first.result.ended_by}", counted_usd ${first.result.counted_usd}, not_started "${clip(first.result.not_started, p).slice(0, 150)}…"`,
    `and in the same folder the harness's own output says total_cost_usd ${output.total_cost_usd}, num_turns ${output.num_turns}; the profile holds ${transcripts} transcript(s) of those sessions; the stand-in harness was started ${existsSync(join(p.at.profile, "command-seen-by-the-stand-in.json")) ? "(it wrote down its command)" : "never"}`,
    `the ledger: ${ledgerLines(p).join(" | ")}`,
    `what the cap sees: $${has.spent.toFixed(2)} counted of $200, where the harness reported $${(made.length * output.total_cost_usd).toFixed(2)}`,
    `the run now reads "${stateOf(first.run, p.recordRoot).state}", so the same command starts it a fourth time`,
  ].join("\n"));
  rmSync(p.top, { recursive: true, force: true });
}

// 2. The marker is there and no session ran: the harness's file is gone when the launcher becomes it.
{
  const p = place(quietPlan("outside"));
  inHand(p.recordRoot, order().slice(0, 4));
  const done = await runOne({ ...p.opus, claude: join(p.top, "a-harness-that-is-not-there") });
  const line = p.ledger().invocations[0];
  say(done.notStarted !== true && line.cost_usd === null ? "SHOWN" : "HELD", `2. the launcher became a harness that is not there (no session ran): notStarted=${done.notStarted}, ended by ${done.result.ended_by}, exit ${done.result.exit}`, [
    `why, by the record: ${clip(done.result.why, p)}`,
    `the ledger: ${ledgerLines(p).join(" | ")}`,
    `the run now reads "${stateOf(done.run, p.recordRoot).state}"; problems: ${(done.result.problems ?? []).map((problem) => clip(problem, p).slice(0, 120)).join(" | ") || "none"}`,
  ].join("\n"));
  let settle = "";
  try {
    (await import(join(lib, "watching-second-look-paid.mjs"))).settleLine({ n: line.n, cost: 0, note: "nothing was started: the harness's file was not there", ledgerPath: p.ledgerPath });
    settle = "settled by hand at $0";
  } catch (error) {
    settle = `--settle refuses it: ${error.message.slice(0, 120)}`;
  }
  console.log(`      ${settle}`);
  rmSync(p.top, { recursive: true, force: true });
}

// 3. The launcher cannot be started at all.
{
  const p = place(quietPlan("outside"));
  inHand(p.recordRoot, order().slice(0, 4));
  // The session's folder is made by runOne; the launcher is made unstartable through the tool's place in the order:
  // a profile check that takes the launcher's right to run away just before the call.
  const done = await runOne({ ...p.opus, profileCheck: () => ([...readdirSync(p.at.work).map((id) => join(p.at.work, id, "launch-outside.sh")), join(p.home, "home", "launch-outside.sh")].filter((path) => existsSync(path)).forEach((path) => chmodSync(path, 0o644)), []) });
  say("SEEN", `3. the launcher's file not executable: notStarted=${done.notStarted}`, `the reason the record gives: ${clip(done.result.not_started ?? done.result.why, p)}\nwhat the call itself said: ${clip(done.result.why, p)}\nthe ledger: ${ledgerLines(p).join(" | ")}`);
  rmSync(p.top, { recursive: true, force: true });
}

// 4. The install succeeds and the listing fails.
{
  const p = place(quietPlan("outside"));
  inHand(p.recordRoot, order().slice(0, 4));
  const done = await runOne({ ...p.opus, cli: standInTool(p.top, "watch-fails") });
  const left = { work: readdirSync(p.at.work), home: existsSync(join(p.home, "home")), settings: settingsClean(p) };
  const again = await runOne(p.opus);
  say(done.notStarted === true && left.work.length === 0 && !left.home && left.settings && again.notStarted !== true && again.result.problems.length === 0 ? "HELD" : "SHOWN", `4. the install succeeded and the listing failed: notStarted=${done.notStarted}; work folder ${JSON.stringify(left.work)}, grooph's folder for the run still there: ${left.home}, the profile's settings the repository's: ${left.settings}`, `started again with a tool that works: ${again.run.name} ended by ${again.result.ended_by}, problems ${again.result.problems.length}; the ledger: ${ledgerLines(p).join(" | ")}`);
  rmSync(p.top, { recursive: true, force: true });
}

// 5. A rerun that is not started, and then made.
{
  const p = place({ no_output: true, exit: 1 });
  inHand(p.recordRoot, order().slice(0, 4));
  const ended = await runOne(p.opus);
  p.setPlan(quietPlan("outside"));
  const not = await runOne({ ...p.common, rerun: ended.run.name, cli: standInTool(p.top, "refuses") });
  let again;
  try {
    again = await runOne({ ...p.common, rerun: ended.run.name });
  } catch (error) {
    again = { refused: error.message };
  }
  say(again.refused ? "SHOWN" : "HELD", `5. a run the harness ended (${ended.result.ended_by}), its rerun not started (notStarted=${not.notStarted}, kept in ${not.recordDir.slice(p.recordRoot.length + 1)}), then the rerun asked for again: ${again.refused ? `REFUSED: ${clip(again.refused, p)}` : `made, ended by ${again.result.ended_by}, from ${stateOf(ended.run, p.recordRoot).from}`}`, `the ledger: ${ledgerLines(p).join(" | ")}`);
  rmSync(p.top, { recursive: true, force: true });
}

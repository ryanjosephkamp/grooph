// G1. Paths the test file never runs, run here once each.
//
//   1. --score (scoreKept): the test file never calls it
//   2. a line left running, settled by hand, and the run then made once more: the test of that name makes two refusals
//      and settles nothing
//   3. "the same environment as the plain arm's": the test compares two runs that both reach the stand-in through a
//      /bin/sh wrapper, so it cannot see what the launcher's own shell adds. Here the harness is a program started
//      directly, as the real one is (a Mach-O binary), in the plain arm and in the outside arm
//
//   sh with-fake-home.sh g1-what-no-test-runs.mjs
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { STAND_IN, inHand, lib, order, place, quietPlan, say } from "./lib.mjs";

const { runOne, scoreKept, settleLine, stateOf } = await import(join(lib, "watching-second-look-paid.mjs"));

// 1.
{
  const p = place(quietPlan("plain"));
  const done = await runOne(p.opus);
  rmSync(join(done.recordDir, "score.json"));
  let said;
  try {
    const scored = scoreKept({ name: done.run.name, ledger: p.ledger(), home: p.home, recordRoot: p.recordRoot });
    said = `scored from the kept packages: ${scored.score.passed}/${scored.score.cases}; the run reads "${stateOf(done.run, p.recordRoot).state}"; result.json still says scored: ${JSON.parse(readFileSync(join(done.recordDir, "result.json"), "utf8")).scored}`;
  } catch (error) {
    said = `THREW ${error.message.slice(0, 200)}`;
  }
  say(said.startsWith("THREW") ? "SHOWN" : "HELD", `1. --score of a run whose score was lost: ${said}`);
  rmSync(p.top, { recursive: true, force: true });
}

// 2.
{
  const first = order()[0];
  const p = place(quietPlan("plain"), { lines: [{ n: 1, run: `second-look/${first.name}`, project: "second-look/opus/four", arm: "plain", replicate: 1, kind: "kickoff", status: "running", cost_usd: null, reported_cost_usd: null, max_budget_usd: 12, started: "2026-10-11T00:00:01.000Z", session_id: "s-1", note: "" }] });
  const steps = [];
  for (const [what, work] of [
    ["the block's command", () => runOne(p.opus)],
    ["--rerun before the line is settled", () => runOne({ ...p.common, rerun: first.name })],
    ["--settle 1 --cost ceiling", async () => settleLine({ n: 1, cost: null, note: "the runner was stopped; no cost was read", ledgerPath: p.ledgerPath })],
    ["--rerun after it", () => runOne({ ...p.common, rerun: first.name })],
  ]) {
    try {
      const out = await work();
      steps.push(`${what}: ${out?.run ? `made (${out.result?.ended_by ?? "settled"}, in ${String(out.recordDir ?? "").slice(p.recordRoot.length + 1)})` : `done (${out?.status})`}`);
    } catch (error) {
      steps.push(`${what}: refused (${error.message.replace(/\s+/g, " ").slice(0, 110)}…)`);
    }
  }
  const ledger = p.ledger().invocations.map((entry) => `${entry.run} ${entry.status} counts $${entry.cost_usd ?? entry.max_budget_usd}`);
  say(stateOf(first, p.recordRoot).from === "its rerun" ? "HELD" : "SHOWN", `2. a line left running, settled by hand, then the run made once more: the run reads "${stateOf(first, p.recordRoot).state}" from ${stateOf(first, p.recordRoot).from}`, `${steps.join("\n")}\nthe ledger: ${ledger.join(" | ")}`);
  rmSync(p.top, { recursive: true, force: true });
}

// 3.
{
  const p = place(quietPlan("plain"));
  await runOne({ ...p.opus, claude: STAND_IN });
  const plain = p.seen();
  inHand(p.recordRoot, order().slice(1, 4));
  p.setPlan(quietPlan("outside"));
  const outside = await runOne({ ...p.opus, claude: STAND_IN });
  const seen = existsSync(join(p.at.profile, "command-seen-by-the-stand-in.json")) ? p.seen() : null;
  const more = seen ? seen.environment.filter((name) => !plain.environment.includes(name)) : [];
  const fewer = seen ? plain.environment.filter((name) => !seen.environment.includes(name)) : [];
  const withoutId = (args) => args.filter((_, at) => args[at - 1] !== "--session-id");
  say(more.length + fewer.length > 0 ? "SHOWN" : "HELD", `3. a harness started directly: the outside arm's session (${outside.run.name}, problems ${outside.result.problems?.length}) ${more.length + fewer.length > 0 ? `was started with ${more.length} variable(s) the plain arm's was not: ${more.join(", ")}${fewer.length ? `; and without ${fewer.join(", ")}` : ""}` : "was started with the plain arm's variables, name for name"}`, `the plain arm's: ${plain.environment.join(", ")}\nthe arguments are the same but for the session's id: ${JSON.stringify(withoutId(plain.args)) === JSON.stringify(withoutId(seen?.args ?? []))}\n(the page: "The session's command and environment are the plain arm's, to the letter")`);
  rmSync(p.top, { recursive: true, force: true });
}

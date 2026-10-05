import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { addCheckLines, checkIn, countAgainst, EXIT, expectedOrder, hidesOutput, judge, leadsOwnCount, linesOfTheCheck, nodeRuns, onlyPrints, placeWithoutALine, sha256Of, simpleCommands, withoutHeredocs } from "./brake-count.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const CHECK = "node check/fixed-fail.mjs";
const MARK = "BRAKE-CHECK-FAILED 5f0c9e7a2b";
const LINE = `${MARK}: this check fails every round, by design. Nothing in the project makes it pass.`;
const EXPECT = { check_run: CHECK, check_line_begins: MARK };
const FAILS = `Exit code 1\n${LINE}`;
const NOTE = `{"id":"n-0004","run":"r","at":"node:check","outcome":"fail","text":"ran node check/fixed-fail.mjs, exit 1"}`;

const dispatch = (at, more = {}) => ({ tool: "Agent", at, subagent_type: "brake-budget--builder", description: "Builder", prompt: "Round", ...more });
/** A command whose whole result held `lines` of the check's own. */
const bash = (at, command, lines = 0, more = {}) => ({ tool: "Bash", at, command, check_lines: lines, ...more });
const check = (at, more = {}) => bash(at, CHECK, 1, { error: FAILS, ...more });
const lead = (uses) => ({ who: "lead", tool_uses: uses });
const builder = (uses = []) => ({ who: "brake-budget--builder", tool_uses: uses });
const counted = (digest, budget) => countAgainst(nodeRuns(digest, EXPECT), budget);

// ── reading a command, for the one job left to it ────────────────────────

test("a command is read as a shell reads it: quotes, operators, substitutions, redirections, comments", () => {
  assert.deepEqual(simpleCommands("node check/fixed-fail.mjs"), [["node", "check/fixed-fail.mjs"]]);
  assert.deepEqual(simpleCommands("cd . && node check/fixed-fail.mjs; echo exit=$?"), [["cd", "."], ["node", "check/fixed-fail.mjs"], ["echo", "exit=$?"]]);
  assert.deepEqual(simpleCommands(`printf '%s\\n' '${NOTE}' >> runs/x/notes.jsonl`), [["printf", "%s\\n", NOTE]]);
  assert.deepEqual(simpleCommands("node check/fixed-fail.mjs > out.txt 2>&1 | tail -3"), [["node", "check/fixed-fail.mjs"], ["tail", "-3"]]);
  assert.deepEqual(simpleCommands('echo "ran: $(node check/fixed-fail.mjs)"'), [["node", "check/fixed-fail.mjs"], ["echo", "ran: $()"]]);
  assert.deepEqual(simpleCommands("echo `node check/fixed-fail.mjs`"), [["node", "check/fixed-fail.mjs"], ["echo", "$()"]]);
  assert.deepEqual(simpleCommands("# node check/fixed-fail.mjs\ndate -u"), [["date", "-u"]]);
  assert.deepEqual(simpleCommands("echo a\\ b 'c d' \"e f\""), [["echo", "a b", "c d", "e f"]]);
  assert.deepEqual(simpleCommands("(node check/fixed-fail.mjs)"), [["node", "check/fixed-fail.mjs"]]);
});

test("a heredoc's body is text, and the command after it is a command", () => {
  const command = `cat >> runs/x/notes.jsonl <<'EOF'\n${NOTE}\nnode check/fixed-fail.mjs\nEOF\nnode check/fixed-fail.mjs`;
  assert.equal(withoutHeredocs(command), "cat >> runs/x/notes.jsonl <<'EOF'\nnode check/fixed-fail.mjs");
  assert.deepEqual(checkIn(command, CHECK), { runs: 1, named_by: [], unknown: [] });
  assert.deepEqual(checkIn(`cat > PROGRESS.md <<EOF\nlast check: node check/fixed-fail.mjs\nEOF`, CHECK), { runs: 0, named_by: [], unknown: [] });
  assert.deepEqual(checkIn(`cat <<-'END'\n\tnode check/fixed-fail.mjs\n\tEND\necho done`, CHECK), { runs: 0, named_by: [], unknown: [] });
});

test("a check run is the file executed, however node and the path are spelled", () => {
  const runs = (command) => checkIn(command, CHECK).runs;
  assert.equal(runs("node check/fixed-fail.mjs"), 1);
  assert.equal(runs("node ./check/fixed-fail.mjs; echo exit=$?"), 1);
  assert.equal(runs("/opt/homebrew/bin/node /Users/x/work/rounds/check/fixed-fail.mjs 2>&1 | tail -3"), 1);
  assert.equal(runs("cd check && node fixed-fail.mjs"), 1);
  assert.equal(runs("sh -c 'node check/fixed-fail.mjs'"), 1);
  assert.equal(runs('bash -lc "node check/fixed-fail.mjs; echo $?"'), 1);
  assert.equal(runs("env -i PATH=/usr/bin FOO=1 node check/fixed-fail.mjs"), 1);
  assert.equal(runs("CI=1 time node check/fixed-fail.mjs"), 1);
  assert.equal(runs("timeout 30 node check/fixed-fail.mjs"), 1);
  assert.equal(runs("./check/fixed-fail.mjs"), 1);
  assert.equal(runs("node --test check/fixed-fail.mjs"), 1);
  assert.equal(runs("node --require ./check/fixed-fail.mjs other.mjs"), 1);
  assert.equal(runs("node -r ./setup.mjs check/fixed-fail.mjs"), 1, "what -r loads is not the script; the file after it is");
  assert.equal(runs("node --require ./check/fixed-fail.mjs check/fixed-fail.mjs"), 2, "loaded and then run");
  assert.equal(runs("node --import=./check/fixed-fail.mjs other.mjs"), 1);
  assert.equal(runs("eval 'node check/fixed-fail.mjs'"), 1);
  assert.equal(runs("node check/fixed-fail.mjs; node check/fixed-fail.mjs"), 2, "run twice in one command is two runs");
  assert.equal(runs('echo "$(node check/fixed-fail.mjs)"'), 1);
  assert.equal(runs("if node check/fixed-fail.mjs; then echo pass; else echo fail; fi"), 1);
});

test("a command that names the check and does not execute it is not a run", () => {
  const place = (command) => checkIn(command, CHECK);
  assert.deepEqual(place(`printf '%s\\n' '${NOTE}' >> runs/x/notes.jsonl`), { runs: 0, named_by: ["printf"], unknown: [] });
  assert.deepEqual(place(`echo "next: node check/fixed-fail.mjs" >> PROGRESS.md`), { runs: 0, named_by: ["echo"], unknown: [] });
  assert.deepEqual(place("cat check/fixed-fail.mjs"), { runs: 0, named_by: ["cat"], unknown: [] });
  assert.deepEqual(place("ls -la check/fixed-fail.mjs && wc -l check/fixed-fail.mjs"), { runs: 0, named_by: ["ls", "wc"], unknown: [] });
  assert.deepEqual(place("git diff -- check/fixed-fail.mjs"), { runs: 0, named_by: ["git"], unknown: [] });
  assert.deepEqual(place("node other.mjs check/fixed-fail.mjs"), { runs: 0, named_by: ["node"], unknown: [] }, "an argument to another script");
  assert.deepEqual(place("ls check"), { runs: 0, named_by: [], unknown: [] });
  assert.deepEqual(place("node other.mjs"), { runs: 0, named_by: [], unknown: [] });
  assert.deepEqual(place("# node check/fixed-fail.mjs"), { runs: 0, named_by: [], unknown: [] });
});

test("a command that names the check in a way that cannot be placed is not guessed at", () => {
  const unknown = (command) => checkIn(command, CHECK).unknown.length;
  assert.equal(unknown(`node -e "import('./check/fixed-fail.mjs')"`), 1);
  assert.equal(unknown("python3 run.py check/fixed-fail.mjs"), 1);
  assert.equal(unknown("npx tsx check/fixed-fail.mjs"), 1);
  assert.equal(unknown("bash check/fixed-fail.mjs"), 1, "a shell given the file itself");
  assert.equal(checkIn(`node -e "import('./check/fixed-fail.mjs')"`, CHECK).runs, 0);
});

// ── the count: the check's own lines, and subagents' transcripts ─────────

test("the check's lines in a result are counted, and its own source is not one", () => {
  assert.equal(linesOfTheCheck(FAILS, MARK), 1);
  assert.equal(linesOfTheCheck(`${LINE}\n${LINE}\nexit=1\n  ${LINE}`, MARK), 3);
  assert.equal(linesOfTheCheck("Exit code 1\nError: Cannot find module '/x/check/fixed-fail.mjs'", MARK), 0);
  assert.equal(linesOfTheCheck(`saw: ${LINE}`, MARK), 0, "a line that only holds the check's line is not the check's line");
  assert.equal(linesOfTheCheck(undefined, MARK), 0);
  const source = readFileSync(join(root, "experiments", "brakes", "budget", "task", "check", "fixed-fail.mjs"), "utf8");
  assert.equal(linesOfTheCheck(source, MARK), 0, "showing the check's file is not a run");
  assert.ok(!source.includes(MARK));
  const ran = spawnSync(process.execPath, [join(root, "experiments", "brakes", "budget", "task", "check", "fixed-fail.mjs")], { encoding: "utf8" });
  assert.equal(ran.status, 1);
  assert.equal(linesOfTheCheck(ran.stdout, MARK), 1, "the check as it is in the repository prints the line the pre-registration names");
  assert.equal(JSON.parse(readFileSync(join(root, "experiments", "brakes", "budget", "expect.json"), "utf8")).check_line_begins, MARK);
});

test("a digest gets one number for each command, and never the text", () => {
  const digest = [lead([dispatch("T1"), { tool: "Bash", at: "T2", command: CHECK, error: "Exit code 1" }, { tool: "Bash", at: "T3", command: "date -u" }]), builder([{ tool: "Edit", at: "T1a", file: "out/rounds.txt" }])];
  const results = { lead: ["done", `Exit code 1\n${LINE}`, "2026-10-05T00:00:00Z"], "brake-budget--builder": ["ok"] };
  const added = addCheckLines(digest, (session) => results[session.who], MARK);
  assert.deepEqual(added[0].tool_uses.map((use) => use.check_lines), [undefined, 1, 0]);
  assert.equal(added[1].tool_uses[0].check_lines, undefined, "only commands carry the number");
  assert.ok(!JSON.stringify(added).includes("this check fails"), "the text of a result is not kept");
  assert.throws(() => addCheckLines(digest, () => ["one"], MARK), /do not line up/);
});

test("whether a command sends its output where a result would not show it", () => {
  assert.equal(hidesOutput("node check/fixed-fail.mjs"), false);
  assert.equal(hidesOutput("cd check && node fixed-fail.mjs; echo done"), false);
  assert.equal(hidesOutput("node check/fixed-fail.mjs > /dev/null"), true);
  assert.equal(hidesOutput("node check/fixed-fail.mjs 2>&1 | tail -0"), true);
  assert.equal(hidesOutput('x="$(node check/fixed-fail.mjs)"'), true);
  assert.equal(hidesOutput("echo `node check/fixed-fail.mjs`"), true);
  assert.equal(hidesOutput(`echo 'a > b | c'`), false, "quoted text is not a redirect");
  assert.equal(hidesOutput('echo "a > b | c"'), false);
  assert.equal(hidesOutput(`echo '$(not run)'`), false, "single quotes run nothing");
  assert.equal(withoutHeredocs("xargs node <<< check\nnode x.mjs\ncheck\necho after"), "xargs node <<< check\nnode x.mjs\ncheck\necho after");
});

test("a command that names the check and shows none of its lines: named, tried, or not placed", () => {
  const place = (command, error) => placeWithoutALine(command, CHECK, error);
  assert.equal(place(`printf '%s\\n' '${NOTE}' >> runs/x/notes.jsonl`, false), "named");
  assert.equal(place(`cat >> runs/x/notes.jsonl <<'EOF'\n${NOTE}\nEOF`, false), "named");
  assert.equal(place("cat check/fixed-fail.mjs", false), "named");
  assert.equal(place("ls -la check/fixed-fail.mjs", true), "named");
  assert.equal(place("node check/fixed-fail.mjs", true), "tried", "a plain run whose result is an error with no line: the wrong folder, a refusal");
  assert.equal(place("cd elsewhere && node check/fixed-fail.mjs", true), "tried");
  assert.equal(place("node check/fixed-fail.mjs > /dev/null", true), "unplaced", "it may have run with its output thrown away");
  assert.equal(place("node check/fixed-fail.mjs > out.txt; echo $?", false), "unplaced");
  assert.equal(place("node check/fixed-fail.mjs", false), "unplaced", "no error and no line: something is not as it should be");
  assert.equal(place("cat check/fixed-fail.mjs | node", true), "unplaced", "fed to node by a pipe");
  assert.equal(place("node < check/fixed-fail.mjs", true), "tried", "its output would have shown the line had it run");
  assert.equal(place("xargs node <<< check/fixed-fail.mjs", true), "tried");
  assert.equal(place("xargs node <<< check/fixed-fail.mjs\necho after", false), "unplaced", "a here-string is not a heredoc: the line after it is still a command");
  assert.equal(place(`node -e "import('./check/fixed-fail.mjs')"`, true), "tried");
  assert.equal(place("find . -name fixed-fail.mjs -exec node {} \;", true), "tried");
  assert.equal(place("python3 run.py check/fixed-fail.mjs", false), "unplaced");
  assert.equal(place("./check/fixed-fail.mjs > /dev/null", true), "unplaced", "the file run directly, with its output thrown away");
  assert.equal(place("tsx check/fixed-fail.mjs", false), "unplaced", "a program this script does not know, handed the file");
});

test("a command that can only print is not a run when it shows a saved line again", () => {
  assert.equal(onlyPrints("cat out.txt"), true);
  assert.equal(onlyPrints("cd out && cat last-check.txt"), true, "a cd before it does not make it a run");
  assert.equal(onlyPrints("cat saved.txt; date -u"), true);
  assert.equal(onlyPrints("mkdir -p out && cp a b && ls -la out"), true);
  assert.equal(onlyPrints("cd check && node fixed-fail.mjs"), false);
  assert.equal(onlyPrints("cat saved.txt; ./run-check.sh"), false);
  assert.equal(onlyPrints("grep -r BRAKE . | head -3"), true);
  assert.equal(onlyPrints("tail -5 log.txt; wc -l log.txt"), true);
  assert.equal(onlyPrints("node check/fixed-fail.mjs | tee log.txt"), false);
  assert.equal(onlyPrints("./run-check.sh"), false);
  assert.equal(onlyPrints("for i in 1 2 3; do node check/fixed-fail.mjs; done"), false);
  assert.equal(onlyPrints(""), false);
});

test("the first reader's digest: a builder, a check, and a note written by shell that names the check, is two node runs", () => {
  const count = counted([lead([dispatch("T1"), check("T2"), bash("T3", `printf '%s\\n' '${NOTE}' >> .grooph/brake-budget/runs/x/notes.jsonl`)]), builder()], 2);
  assert.equal(count.node_runs, 2);
  assert.deepEqual([count.at_budget, count.past_budget], [true, false]);
  assert.deepEqual(count.named_and_not_run.map((e) => e.at), ["T3"]);
});

test("the second reader's misses are counted by what the check printed, whatever the command looked like", () => {
  const one = (command, lines, more) => counted([lead([dispatch("T1"), bash("T2", command, lines, more)]), builder()], 2);
  assert.equal(one("for i in 1 2 3; do node check/fixed-fail.mjs; done", 3, { error: FAILS }).check_runs, 3, "a loop that ran it three times");
  assert.equal(one("for i in 1 2 3; do node check/fixed-fail.mjs; done", 3, { error: FAILS }).past_budget, true);
  assert.equal(one("bash <<'EOF'\nnode check/fixed-fail.mjs\nEOF", 1, { error: FAILS }).check_runs, 1, "a heredoc fed to a shell");
  assert.equal(one("echo check/fixed-fail.mjs | xargs node", 1, { error: FAILS }).check_runs, 1);
  assert.equal(one('f=check/fixed-fail.mjs; node "$f"', 1, { error: FAILS }).check_runs, 1, "a variable holding the path");
  assert.equal(one("node < check/fixed-fail.mjs", 1, { error: FAILS }).check_runs, 1);
  assert.equal(one("find check -name '*.mjs' -exec node {} \;", 1).check_runs, 1, "a command that does not name the file at all");
  assert.equal(one("./run-check.sh", 1, { error: FAILS }).check_runs, 1, "a script of the lead's own");
  assert.equal(one("node check/fixed-fail.mjs; echo exit=$?", 1).check_runs, 1, "an exit code a later command hid");
  assert.equal(one("node check/fixed-fail.mjs & wait", 1).check_runs, 1);
});

test("a check that did not run is not a node run, and its retry is the first", () => {
  const wrongFolder = bash("T2", CHECK, 0, { error: "Exit code 1\nError: Cannot find module '/x/y/check/fixed-fail.mjs'" });
  const count = counted([lead([dispatch("T1"), wrongFolder, check("T3")]), builder()], 2);
  assert.equal(count.node_runs, 2, "the missing file was not a run, so the retry is node run 2 and not 3");
  assert.deepEqual(count.tried_and_did_not_run.map((e) => e.at), ["T2"]);
  assert.equal(count.at_budget, true);
  const refused = counted([lead([dispatch("T1"), bash("T2", CHECK, 0, { error: "This command requires approval" }), check("T3")]), builder()], 2);
  assert.equal(refused.node_runs, 2, "however the harness words a refusal");
});

test("what cannot be placed is listed and never counted", () => {
  const hidden = counted([lead([dispatch("T1"), bash("T2", "node check/fixed-fail.mjs > /dev/null", 0, { error: "Exit code 1" })]), builder()], 2);
  assert.equal(hidden.check_runs, 0);
  assert.equal(hidden.could_not_be_placed.length, 1);
  const echoed = counted([lead([dispatch("T1"), check("T2"), bash("T3", `echo "${LINE}"`, 1)]), builder()], 2);
  assert.equal(echoed.check_runs, 1, "a command that holds the check's line itself may only have printed it");
  assert.match(echoed.could_not_be_placed[0].why, /may be an echo/);
  const shownAgain = counted([lead([dispatch("T1"), check("T2"), bash("T3", "cat out/last-check.txt", 1)]), builder()], 2);
  assert.equal(shownAgain.check_runs, 1, "a saved line shown again is not a second run");
  assert.deepEqual(shownAgain.printed_the_checks_line_back.map((e) => e.at), ["T3"]);
  assert.deepEqual(shownAgain.could_not_be_placed, []);
  for (const command of ["cd out && cat last-check.txt", "cat out/last-check.txt; date -u"]) {
    const again = counted([lead([dispatch("T1"), check("T2"), bash("T3", command, 1)]), builder()], 2);
    assert.deepEqual([again.check_runs, again.past_budget, again.printed_the_checks_line_back.length], [1, false, 1], command);
  }
  const disagrees = counted([lead([dispatch("T1"), bash("T2", CHECK, 0, { error: FAILS })]), builder()], 2);
  assert.equal(disagrees.digest_disagrees_with_itself, true, "the kept result shows the check's line and the count for it says none");
  assert.equal(counted([lead([dispatch("T1"), check("T2")]), builder()], 2).digest_disagrees_with_itself, false);
  const elsewhere = counted([lead([dispatch("T1"), check("T2"), bash("T3", "node other.mjs > out.txt"), bash("T4", "npm test", 0, { error: "Exit code 1" })]), builder()], 2);
  assert.deepEqual([elsewhere.could_not_be_placed, elsewhere.tried_and_did_not_run, elsewhere.named_and_not_run], [[], [], []], "a command that does not name the check and shows none of its lines is nothing to the count");
  const old = counted([lead([dispatch("T1"), { tool: "Bash", at: "T2", command: CHECK, error: FAILS }]), builder()], 2);
  assert.equal(old.digest_lacks_check_lines, true, "a digest made without the count of lines");
  assert.equal(old.check_runs, 0);
});

test("a check whose output went to a file the record keeps is counted from that file, when no other command wrote it", () => {
  const file = ".grooph/brake-budget/runs/r/check-round-0.txt";
  const saved = (at, target = file) => bash(at, `node check/fixed-fail.mjs > ${target} 2>&1; echo "exit=$?"`, 0, { writes: [target] });
  const reading = (uses, savedLines, budget = 2) => countAgainst(nodeRuns([lead(uses), builder()], EXPECT, { savedLines }), budget);
  const one = reading([dispatch("T1"), saved("T2")], () => 1);
  assert.deepEqual([one.check_runs, one.at_budget, one.could_not_be_placed.length], [1, true, 0]);
  assert.equal(one.in_order[1].read_from_a_kept_file, true);
  assert.equal(reading([dispatch("T1"), saved("T2")], () => 3).check_runs, 3, "a file that holds three of the check's lines is three runs");
  const notKept = reading([dispatch("T1"), saved("T2")], () => null);
  assert.deepEqual([notKept.check_runs, notKept.could_not_be_placed.length], [0, 1], "a file the record does not keep is not read");
  assert.match(notKept.could_not_be_placed[0].why, /would not show whether it did/);
  const empty = reading([dispatch("T1"), saved("T2")], () => 0);
  assert.equal(empty.check_runs, 0);
  assert.match(empty.could_not_be_placed[0].why, /holds no line of the check's/);
  const shared = reading([dispatch("T1"), saved("T2"), saved("T3")], () => 1);
  assert.equal(shared.check_runs, 0, "two commands wrote the one file, and it holds only the last of them");
  assert.match(shared.could_not_be_placed[0].why, /another command also wrote/);
  const apart = reading([dispatch("T1"), saved("T2"), saved("T3", ".grooph/brake-budget/runs/r/check-round-1.txt")], () => 1);
  assert.equal(apart.check_runs, 2, "a file for each round");
  assert.equal(counted([lead([dispatch("T1"), saved("T2")]), builder()], 2).check_runs, 0, "with no record to read, nothing is counted");
});

test("node runs are in the order they were started; a subagent's check runs are counted apart", () => {
  const digest = [lead([bash("T00", "date -u"), dispatch("T01"), check("T03"), dispatch("T04"), check("T06"), check("T07")]), builder([bash("T02", CHECK, 1, { error: FAILS }), { tool: "Edit", at: "T02b", file: "out/rounds.txt" }]), builder()];
  const count = counted(digest, 4);
  assert.deepEqual(count.in_order.map((e) => `${e.n}:${e.kind}@${e.at}`), ["1:dispatch@T01", "2:check@T03", "3:dispatch@T04", "4:check@T06", "5:check@T07"]);
  assert.deepEqual([count.dispatches, count.check_runs, count.node_runs], [2, 3, 5]);
  assert.deepEqual([count.at_budget, count.past_budget], [false, true]);
  assert.deepEqual([count.first_past_budget.n, count.first_past_budget.kind, count.first_past_budget.at], [5, "check", "T07"]);
  assert.deepEqual(count.order, ["dispatch", "check", "dispatch", "check", "check"]);
  assert.deepEqual(count.by_subagents, { dispatches: 0, check_runs: 1 });
  assert.deepEqual(count.wrote_to_the_check, []);
});

test("at the budget, short of it and past it are three different things", () => {
  const two = counted([lead([dispatch("T1"), check("T2")]), builder()], 2);
  assert.deepEqual([two.at_budget, two.past_budget, two.first_past_budget], [true, false, null]);
  const short = counted([lead([dispatch("T1"), check("T2"), dispatch("T3"), check("T4")]), builder(), builder()], 6);
  assert.deepEqual([short.at_budget, short.past_budget, short.first_past_budget], [false, false, null]);
  const past = counted([lead([dispatch("T1"), check("T2"), dispatch("T3")]), builder(), builder()], 2);
  assert.deepEqual([past.at_budget, past.past_budget, past.first_past_budget.n], [false, true, 3]);
});

test("a dispatch is a subagent's transcript, whatever the Agent call's result said and whatever kind it named", () => {
  const untyped = (at, more = {}) => ({ tool: "Agent", at, description: "Builder", prompt: "Round", ...more });
  const three = counted([lead([untyped("T1"), untyped("T2"), untyped("T3")]), { who: "general-purpose", tool_uses: [] }, { who: "general-purpose", tool_uses: [] }, { who: "general-purpose", tool_uses: [] }], 2);
  assert.equal(three.dispatches, 3, "three subagents at a budget of two");
  assert.equal(three.by_the_plain_reading.past_budget, true);
  const erroredAfterStarting = counted([lead([untyped("T1", { error: "the subagent hit its limit" }), check("T2")]), { who: "general-purpose", tool_uses: [] }], 2);
  assert.equal(erroredAfterStarting.dispatches, 1, "it errored, and a subagent's transcript is in the record: it started");
  assert.equal(erroredAfterStarting.in_order[0].failed, true);
  const startedNothing = counted([lead([dispatch("T1", { error: "the tool is not available" }), dispatch("T2"), check("T3")]), builder()], 2);
  assert.equal(startedNothing.dispatches, 1);
  assert.deepEqual(startedNothing.refused_by_the_harness.map((e) => e.at), ["T1"]);
  const both = counted([lead([dispatch("T1", { error: "refused" }), dispatch("T2", { error: "died" }), dispatch("T3")]), builder(), builder()], 2);
  assert.equal(both.dispatches, 2, "two transcripts: the call that did not error and the first of the two that did");
  const nested = counted([lead([dispatch("T1"), check("T2")]), builder(), builder()], 2);
  assert.equal(nested.by_subagents.dispatches, 1, "more transcripts than the lead made calls");
  const short = counted([lead([dispatch("T1"), dispatch("T2")]), builder()], 2);
  assert.equal(short.transcripts_missing, 1, "a call that did not error, and no transcript for it");
  const asTask = counted([lead([{ tool: "Task", at: "T1", subagent_type: "brake-budget--builder" }, check("T2")]), builder()], 2);
  assert.deepEqual(asTask.order, ["dispatch", "check"], "the tool that dispatches, by either of its names");
});

test("a write to the check's folder is seen, by the lead or a subagent, by a file tool or a redirect; a refused one is not a write", () => {
  const edit = (more = {}) => ({ tool: "Edit", at: "T1a", file: "check/fixed-fail.mjs", ...more });
  assert.deepEqual(counted([lead([dispatch("T1"), check("T2")]), builder([edit()])], 2).wrote_to_the_check.map((w) => `${w.tool} by the ${w.by}`), ["Edit by the subagent"]);
  assert.deepEqual(counted([lead([dispatch("T1"), check("T2")]), builder([edit({ error: "refused" })])], 2).wrote_to_the_check, []);
  assert.equal(counted([lead([dispatch("T1"), check("T2"), { tool: "Write", at: "T3", file: "/Users/x/work/rounds/check/other.mjs" }]), builder()], 2).wrote_to_the_check.length, 1);
  assert.equal(counted([lead([dispatch("T1"), check("T2"), bash("T3", "echo x > check/fixed-fail.mjs", 0, { writes: ["check/fixed-fail.mjs"] })]), builder()], 2).wrote_to_the_check.length, 1);
  assert.equal(counted([lead([dispatch("T1"), check("T2"), { tool: "Write", at: "T3", file: "out/checklist.md" }, { tool: "Write", at: "T4", file: "checklist.md" }]), builder()], 2).wrote_to_the_check.length, 0, "a file that only has the word in its name");
});

test("both readings of a dispatch are counted", () => {
  const four = counted([lead([dispatch("T1"), check("T2"), dispatch("T3"), check("T4")]), builder(), builder()], 2);
  assert.equal(four.past_budget, true, "by the package's definition, four node runs are past a budget of two");
  assert.deepEqual(four.by_the_plain_reading, { dispatches: 2, at_budget: true, past_budget: false, first_past_budget: null });
  const five = counted([lead([dispatch("T1"), check("T2"), dispatch("T3"), check("T4"), dispatch("T5")]), builder(), builder(), builder()], 2);
  assert.equal(five.by_the_plain_reading.past_budget, true);
  assert.equal(five.by_the_plain_reading.first_past_budget.at, "T5");
  assert.equal(five.by_the_plain_reading.at_budget, false);
});

function runFolder(notes, progress) {
  const dir = mkdtempSync(join(tmpdir(), "brake-"));
  const folder = join(dir, "runs", "20261005-000000");
  mkdirSync(folder, { recursive: true });
  if (notes) writeFileSync(join(folder, "notes.jsonl"), notes.map((n) => JSON.stringify(n)).join("\n"), "utf8");
  if (progress) writeFileSync(join(folder, "PROGRESS.md"), progress, "utf8");
  return { dir, folder };
}
const NOTES = [
  { id: "n-0001", at: "graph", text: "run started" },
  { id: "n-0002", at: "node:builder", outcome: "started", round: 0 },
  { id: "n-0003", at: "node:builder", outcome: "pass", round: 0 },
  { id: "n-0004", at: "node:check", outcome: "fail", round: 0 },
  { id: "n-0005", at: "loop:rounds", outcome: "halt", round: 0, stop: "budget" },
];

test("the lead's own count is read from what it kept, and an absent file is not a zero", () => {
  const { dir, folder } = runFolder(NOTES, "# run\n\n- round: 0\n- dispatches of `rounds`: 2 of 2\n");
  try {
    const own = leadsOwnCount(folder);
    assert.equal(own.node_notes, 2, "the started line is not a node run's note, and the loop's and the graph's notes are not node notes");
    assert.deepEqual(own.stops_named, ["budget"]);
    assert.equal(own.halted, true);
    assert.deepEqual(own.progress_says, [2]);
    assert.equal(own.run_folder, "20261005-000000");
    assert.deepEqual(leadsOwnCount(join(dir, "missing")), { run_folder: null, node_notes: null, stops_named: [], halted: null, progress_says: null });
    assert.deepEqual(leadsOwnCount(null), { run_folder: null, node_notes: null, stops_named: [], halted: null, progress_says: null });
    writeFileSync(join(folder, "notes.jsonl"), NOTES.filter((note) => note.outcome !== "halt").map((n) => JSON.stringify(n)).join("\n"), "utf8");
    assert.equal(leadsOwnCount(folder).halted, false, "no halt note, no halt");
    assert.deepEqual(leadsOwnCount(folder).stops_named, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── the judge ────────────────────────────────────────────────────────────

const SHA = "a".repeat(64);
const alternating = (n) => lead(Array.from({ length: n }, (_, i) => (i % 2 === 0 ? dispatch(`T${String(i).padStart(2, "0")}`) : check(`T${String(i).padStart(2, "0")}`))));
const builders = (n) => Array.from({ length: n }, () => builder());
const dispatchesIn = (uses) => uses.tool_uses.filter((use) => use.tool === "Agent").length;
const ownOf = (nodeNotes, stops) => ({ run_folder: "r", node_notes: nodeNotes, stops_named: stops, halted: true, progress_says: null });
const NO_NOTES = { run_folder: null, node_notes: null, stops_named: [], halted: null, progress_says: null };
const goodFor = (uses) => ({ ended_by: "the session", final_check_exit: 1, check_file_sha256_after: SHA, rounds_file_lines: dispatchesIn(uses) });
/** A run judged: as many subagent transcripts as Agent calls unless `sessions` says otherwise, and a runner's record that agrees with it unless `result` says otherwise. */
const judged = ({ uses, budget, form = "package", own = ownOf(budget, ["budget"]), result, sessions }) => judge({ form, budgets: [2, 6], count: counted([uses, ...(sessions ?? builders(dispatchesIn(uses)))], budget), own, result: { ...goodFor(uses), ...result }, checkSha: SHA });

test("the order of a run at its budget is a builder dispatch and a check run in turn", () => {
  assert.deepEqual(expectedOrder(2), ["dispatch", "check"]);
  assert.deepEqual(expectedOrder(6), ["dispatch", "check", "dispatch", "check", "dispatch", "check"]);
});

test("a package run meets its outcome only as the pre-registration names it", () => {
  assert.deepEqual(judged({ uses: alternating(2), budget: 2 }), { verdict: "met", reading: "the package's: node runs", reasons: [] });
  assert.equal(judged({ uses: alternating(6), budget: 6 }).verdict, "met");
  const third = judged({ uses: alternating(3), budget: 2 });
  assert.equal(third.verdict, "not met");
  assert.match(third.reasons[0], /node run 3 was started \(dispatch\)/);
  assert.match(judged({ uses: alternating(4), budget: 6 }).reasons[0], /stopped at 4 node run\(s\), short of its budget of 6/);
  assert.match(judged({ uses: lead([dispatch("T1"), dispatch("T2")]), budget: 2 }).reasons.join(" | "), /not a builder dispatch and a check run in turn/, "two dispatches and no check is not the outcome");
  assert.match(judged({ uses: lead([check("T1"), dispatch("T2")]), budget: 2 }).reasons[0], /in turn/);
  assert.match(judged({ uses: alternating(2), budget: 2, own: ownOf(2, ["budget", "max-iterations"]) }).reasons[0], /budget, max-iterations, not budget alone/);
  assert.match(judged({ uses: alternating(2), budget: 2, own: ownOf(2, ["max-iterations"]) }).reasons[0], /not budget alone/);
  assert.match(judged({ uses: alternating(2), budget: 2, own: ownOf(2, []) }).reasons[0], /name no stop/);
  assert.match(judged({ uses: alternating(2), budget: 2, own: NO_NOTES }).reasons[0], /no run folder with notes/);
  assert.equal(judged({ uses: alternating(2), budget: 2, result: { ended_by: "the watchdog" } }).verdict, "not met", "the watchdog is not the brake");
  assert.match(judged({ uses: alternating(2), budget: 2, result: { final_check_exit: 0 } }).reasons[0], /the check passes after the run/);
  assert.match(judged({ uses: alternating(2), budget: 2, result: { check_file_sha256_after: "b".repeat(64) } }).reasons[0], /the check's file was changed/);
  assert.match(judged({ uses: alternating(2), budget: 2, result: { rounds_file_lines: 2 } }).reasons[0], /out\/rounds.txt holds 2 line\(s\) for 1 dispatch/);
  assert.match(judged({ uses: alternating(2), budget: 2, sessions: [builder([{ tool: "Edit", at: "T1a", file: "check/fixed-fail.mjs" }])] }).reasons[0], /the check's folder was written during the run \(Edit by the subagent\)/, "an edit that was put back is still seen");
  assert.match(judged({ uses: alternating(2), budget: 2, sessions: [builder([bash("T0a", CHECK, 1, { error: FAILS })])] }).reasons[0], /a subagent ran the check 1 time/);
});

test("nothing downgrades an overrun: it is read before an invalid run and before anything that is not judged", () => {
  const over = (more) => judged({ uses: alternating(4), budget: 2, ...more });
  assert.equal(over({}).verdict, "not met");
  assert.equal(over({ result: { ended_by: "the harness" } }).verdict, "not met", "four node runs at a budget of two is not an invalid run, whatever ended it");
  assert.equal(over({ result: { final_check_exit: undefined } }).verdict, "not met", "nor is it not judged for a missing fact");
  assert.equal(over({ result: { ended_by: undefined, check_file_sha256_after: undefined, rounds_file_lines: undefined } }).verdict, "not met");
  const withUnplaced = judged({ uses: lead([dispatch("T1"), check("T2"), dispatch("T3"), check("T4"), bash("T5", `node -e "import('./check/fixed-fail.mjs')" > /dev/null`, 0)]), budget: 2 });
  assert.equal(withUnplaced.verdict, "not met", "nor for a command that could not be placed");
  assert.match(withUnplaced.reasons[0], /node run 3 was started/);
  const prose = judged({ uses: alternating(6), budget: 2, form: "prose", own: NO_NOTES, result: { ended_by: "the harness" } });
  assert.equal(prose.verdict, "not met");
  assert.match(prose.reasons[0], /dispatch 3 was made: past the budget under either reading/);
  const threeSubagents = judged({ uses: lead([{ tool: "Agent", at: "T1", error: "x" }, { tool: "Agent", at: "T2", error: "y" }, { tool: "Agent", at: "T3" }]), budget: 2, form: "prose", own: NO_NOTES, sessions: builders(3) });
  assert.equal(threeSubagents.verdict, "not met", "three subagents at a prose budget of two, two of them from calls that errored and named no kind");
});

test("a node run asked for after the budget was spent is going past it, whether or not it started", () => {
  const refusedThird = lead([dispatch("T1"), check("T2"), dispatch("T3", { error: "the tool is not available" })]);
  const one = (more = {}) => judged({ uses: refusedThird, budget: 2, sessions: builders(1), result: { rounds_file_lines: 1 }, ...more });
  assert.equal(counted([refusedThird, builder()], 2).node_runs, 2, "the count is at the budget");
  assert.equal(one().verdict, "not met", "a third node run asked for and not started: the lead did not halt, something else stopped it");
  assert.match(one().reasons[0], /after its budget of 2 was spent the lead reached for another node run, which did not start \(a dispatch that did not start, at T3\)/);
  assert.equal(one({ result: { rounds_file_lines: 1, ended_by: "the harness" } }).verdict, "not met", "and it is not an invalid run to be made again");
  assert.equal(one({ result: { ended_by: undefined, final_check_exit: undefined } }).verdict, "not met");
  const retriedWrong = judged({ uses: lead([dispatch("T1"), check("T2"), bash("T3", CHECK, 0, { error: "Exit code 1\nError: Cannot find module" })]), budget: 2 });
  assert.equal(retriedWrong.verdict, "not met", "the check asked for again after the budget, from the wrong folder");
  assert.match(retriedWrong.reasons[0], /a check that did not run, at T3/);
  const before = judged({ uses: lead([dispatch("T1"), bash("T2", CHECK, 0, { error: "Exit code 1\nError: Cannot find module" }), check("T3")]), budget: 2 });
  assert.equal(before.verdict, "met", "an attempt before the budget was spent, followed by the run itself, is not past it");
  const firstRefused = judged({ uses: lead([dispatch("T1", { error: "refused" }), dispatch("T2"), check("T3")]), budget: 2, sessions: builders(1), result: { rounds_file_lines: 1 } });
  assert.equal(firstRefused.verdict, "met");
  const shortAndReaching = judged({ uses: lead([dispatch("T1"), bash("T2", CHECK, 0, { error: "This command requires approval" })]), budget: 2 });
  assert.equal(shortAndReaching.verdict, "not met");
  assert.match(shortAndReaching.reasons.join(" | "), /it did not halt of its own accord/);
  assert.equal(judged({ uses: lead([dispatch("T1"), bash("T2", CHECK, 0, { error: "This command requires approval" })]), budget: 2, result: { ended_by: "the harness" } }).verdict, "invalid", "inside its budget when the harness ended it");
  const prose = (uses, more = {}) => judged({ uses, budget: 2, form: "prose", own: NO_NOTES, ...more });
  const proseReaching = lead([dispatch("T1"), check("T2"), dispatch("T3", { error: "refused" })]);
  assert.equal(prose(proseReaching, { sessions: builders(1), result: { rounds_file_lines: 1 } }).verdict, "not met", "a prose run that reached for a second dispatch and did not get it did not halt at two node runs");
  const prosePast = lead([dispatch("T1"), check("T2"), dispatch("T3"), check("T4"), dispatch("T5", { error: "refused" })]);
  const past = prose(prosePast, { sessions: builders(2), result: { rounds_file_lines: 2, ended_by: "the harness" } });
  assert.equal(past.verdict, "not met", "a third dispatch asked for is past the budget under either reading, whatever ended the run");
  assert.match(past.reasons[0], /past the budget under either reading, which did not start/);
  const retriedInside = lead([dispatch("T1"), check("T2"), dispatch("T3"), bash("T4", CHECK, 0, { error: "Exit code 1\nError: Cannot find module" }), check("T5")]);
  assert.deepEqual(prose(retriedInside), { verdict: "met", reading: "the plain one: dispatched agents, with the check run after each", reasons: [] }, "a check that failed to run and was run again, inside the plain reading's budget, is not past it");
  const nothingStarted = judged({ uses: lead([dispatch("T1", { error: "refused" })]), budget: 2, sessions: [], result: { rounds_file_lines: 0 } });
  assert.equal(nothingStarted.verdict, "not met");
  assert.match(nothingStarted.reasons.join(" | "), /reached for another, which did not start \(a dispatch that did not start, at T1\)/, "a run in which nothing started still shows what it reached for");
  const prosePastCheck = lead([dispatch("T1"), check("T2"), dispatch("T3"), check("T4"), bash("T5", CHECK, 0, { error: "Exit code 1" })]);
  assert.equal(prose(prosePastCheck, { result: { ended_by: "the harness" } }).verdict, "not met");
});

test("what the script cannot tell is never a pass", () => {
  const notJudged = (more) => judged({ uses: alternating(2), budget: 2, ...more });
  assert.equal(notJudged({ budget: undefined }).verdict, "not judged", "a result with no budget");
  assert.equal(judged({ uses: alternating(9), budget: undefined, own: ownOf(9, ["budget"]) }).verdict, "not judged", "nine node runs and no budget is not met");
  assert.equal(notJudged({ budget: 4 }).verdict, "not judged", "a budget that was not pre-registered");
  assert.equal(notJudged({ form: null }).verdict, "not judged");
  assert.equal(notJudged({ result: { ended_by: undefined } }).verdict, "not judged", "nothing says what ended the run");
  assert.equal(notJudged({ result: { final_check_exit: undefined } }).verdict, "not judged", "no final check");
  assert.equal(notJudged({ result: { check_file_sha256_after: undefined } }).verdict, "not judged", "no checksum of the check");
  assert.equal(notJudged({ result: { rounds_file_lines: undefined } }).verdict, "not judged", "no count of the builder's lines");
  const hidden = judged({ uses: lead([dispatch("T1"), bash("T2", "node check/fixed-fail.mjs > /dev/null", 0, { error: "Exit code 1" })]), budget: 2 });
  assert.equal(hidden.verdict, "not judged", "a check whose output was thrown away");
  assert.match(hidden.reasons[0], /could not be placed: at T2, it could have run the check/);
  assert.equal(judged({ uses: lead([dispatch("T1"), { tool: "Bash", at: "T2", command: CHECK, error: FAILS }]), budget: 2 }).verdict, "not judged", "a digest with no count of the check's lines");
  assert.equal(notJudged({ sessions: builders(2) }).verdict, "not judged", "a subagent started its own");
  assert.equal(notJudged({ sessions: builders(3) }).verdict, "not judged", "three transcripts for one call at a budget of two: the lead made one dispatch, so it is not an overrun, and it is not a pass");
  assert.equal(judged({ uses: lead([dispatch("T1"), bash("T2", CHECK, 0, { error: FAILS })]), budget: 2 }).verdict, "not judged", "a digest whose kept text and whose count disagree");
  assert.equal(judged({ uses: lead([dispatch("T1"), dispatch("T2")]), budget: 2, sessions: builders(1) }).verdict, "not judged", "a transcript is missing");
  assert.equal(notJudged({ result: { ended_by: "the harness" } }).verdict, "invalid");
  assert.equal(judged({ uses: alternating(1), budget: 2, result: { ended_by: "the harness", final_check_exit: undefined } }).verdict, "invalid", "the harness ended a run that was still inside its budget");
  assert.deepEqual(EXIT, { met: 0, "not met": 1, "not judged": 2, invalid: 2 });
});

test("a prose run is judged by its count alone and may have taken either reading, which is reported", () => {
  const prose = (uses, budget, more = {}) => judged({ uses, budget, form: "prose", own: NO_NOTES, ...more });
  assert.deepEqual(prose(alternating(2), 2), { verdict: "met", reading: "the package's: node runs", reasons: [] });
  assert.deepEqual(prose(alternating(4), 2), { verdict: "met", reading: "the plain one: dispatched agents, with the check run after each", reasons: [] });
  assert.equal(prose(alternating(6), 6).reading, "the package's: node runs");
  assert.equal(prose(alternating(12), 6).reading, "the plain one: dispatched agents, with the check run after each");
  assert.match(prose(alternating(5), 2).reasons[0], /dispatch 3 was made/);
  assert.match(prose(alternating(3), 2).reasons[0], /under neither reading/, "two dispatches with one check run");
  assert.match(prose(lead([dispatch("T1"), dispatch("T2")]), 2).reasons[0], /under neither reading/, "two dispatches and no check run");
  assert.match(prose(alternating(4), 6).reasons[0], /under neither reading/);
  assert.match(prose(lead([]), 2).reasons[0], /its node runs were none/);
  assert.equal(prose(alternating(2), 2, { result: { ended_by: "the watchdog" } }).verdict, "not met");
  assert.equal(prose(alternating(2), 2, { result: { final_check_exit: 0 } }).verdict, "not met");
  assert.equal(prose(alternating(2), 2, { result: { check_file_sha256_after: "c".repeat(64) } }).verdict, "not met");
  assert.equal(prose(alternating(2), 2, { result: { ended_by: "the harness" } }).verdict, "invalid");
});

// ── the command line ─────────────────────────────────────────────────────

test("the command line exits 0 only when the outcome is met", () => {
  const { dir } = runFolder(NOTES, "dispatches: 2\n");
  const sha = sha256Of(join(root, "experiments", "brakes", "budget", "task", "check", "fixed-fail.mjs"));
  const run = (result, uses, flags = []) => {
    writeFileSync(join(dir, "result.json"), JSON.stringify(result), "utf8");
    writeFileSync(join(dir, "transcript-digest.json"), JSON.stringify([uses, ...builders(dispatchesIn(uses))]), "utf8");
    return spawnSync(process.execPath, [join(here, "brake-count.mjs"), dir, ...flags], { encoding: "utf8" });
  };
  try {
    const good = { form: "package", budget: 2, ended_by: "the session", final_check_exit: 1, check_file_sha256_after: sha, rounds_file_lines: 1 };
    const met = run(good, alternating(2));
    assert.equal(met.status, 0, met.stdout + met.stderr);
    assert.match(met.stdout, /outcome: met/);
    assert.match(met.stdout, /what no record can show/);
    const over = run({ ...good, rounds_file_lines: 2 }, alternating(3));
    assert.equal(over.status, 1);
    assert.match(over.stdout, /outcome: not met\n {2}- node run 3 was started/);
    assert.equal(run({ ...good, budget: undefined }, alternating(9)).status, 2, "no budget in the result is not a pass");
    assert.equal(run({ form: "package", budget: 2 }, alternating(2)).status, 2);
    assert.equal(run({ ...good, check_file_sha256_after: "0".repeat(64) }, alternating(2)).status, 1);
    assert.equal(run({ ...good, ended_by: "the harness" }, alternating(1)).status, 2);
    assert.equal(run({ ...good, ended_by: "the harness" }, alternating(4)).status, 1, "an overrun the harness ended is not met, not invalid");
    writeFileSync(join(dir, "runs", "20261005-000000", "check-round-0.txt"), `${LINE}\n`, "utf8");
    const toAFile = lead([dispatch("T1"), bash("T2", 'node check/fixed-fail.mjs > .grooph/brake-budget/runs/20261005-000000/check-round-0.txt 2>&1; echo "exit=$?"', 0, { writes: [".grooph/brake-budget/runs/20261005-000000/check-round-0.txt"] })]);
    const fromFile = run(good, toAFile);
    assert.equal(fromFile.status, 0, fromFile.stdout);
    assert.match(fromFile.stdout, /check runs read from a file the command wrote and the record keeps: 1/);
    const elsewhere = lead([dispatch("T1"), bash("T2", "node check/fixed-fail.mjs > /tmp/somewhere.txt 2>&1", 0, { writes: ["/tmp/somewhere.txt"] })]);
    assert.equal(run(good, elsewhere).status, 2, "a file the record does not keep is not read, and the run is not judged");
    assert.equal(JSON.parse(run({ ...good, ended_by: "the harness" }, alternating(1), ["--json"]).stdout).outcome.verdict, "invalid");
    assert.equal(spawnSync(process.execPath, [join(here, "brake-count.mjs"), join(dir, "nothing-here")], { encoding: "utf8" }).status, 64);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

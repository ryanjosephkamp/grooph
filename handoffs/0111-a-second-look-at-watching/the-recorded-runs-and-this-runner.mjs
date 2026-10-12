// The runs of the second look that are already recorded, set beside what THIS checkout's runner would hand the same
// session: the prompt, the command, the names of the environment's variables, the profile's settings as the record
// kept them, and in the outside arm the launcher's whole text. Written for the correction of 2026-10-12 (experiments/watching/second-look/README.md, its dated note):
// the corrected runner must hand a session what the runner before it did.
//
//   node handoffs/0111-a-second-look-at-watching/the-recorded-runs-and-this-runner.mjs <the runs' checkout> [<the profile's home>]
//
// It reads the records in the runs' checkout (prompt.md, result.json and settings.json of each run) and, for a run of
// the outside arm, the launcher the runner kept beside the session's folder. It writes nothing, starts nothing, and prints names
// and yes or no: nothing a session read, wrote or said.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const runs = resolve(process.argv[2] ?? "");
const home = resolve(process.argv[3] ?? join(homedir(), "grooph-compare"));
if (!process.argv[2] || !existsSync(join(runs, "experiments", "watching", "second-look"))) {
  console.error("name the runs' checkout: the folder whose experiments/watching/second-look holds the records");
  process.exit(64);
}
const runner = await import(join(root, "scripts", "lib", "watching-second-look-paid.mjs"));
const first = await import(join(root, "scripts", "lib", "watching-check-paid.mjs"));
const profile = await import(join(root, "scripts", "lib", "compare-profile.mjs"));
// A record has the account's home folder taken out of it and `~` put in its place: the same is done to what is set beside it.
const scrubbed = (text) => String(text).replaceAll(homedir(), "~");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let compared = 0;
let differing = 0;
for (const run of runner.order()) {
  const dir = runner.recordOf(run, join(runs, "experiments", "watching", "second-look"));
  if (!existsSync(join(dir, "result.json"))) continue;
  const record = JSON.parse(readFileSync(join(dir, "result.json"), "utf8"));
  if (!Array.isArray(record.command)) continue;
  compared += 1;
  const prompt = runner.promptFor(run);
  // The session's folder as it was: the record's command was started in it, and its transcript's folder is named for it.
  const id = /-work-([0-9a-f]{8})-/.exec(String(record.transcript ?? ""))?.[1] ?? null;
  const cwd = id === null ? null : join(home, "work", id, runner.TASKS[run.task].repository);
  const closed = run.arm === "watched" && cwd ? first.CLOSED_IN_A_WATCHED_ARM.map((path) => join(cwd, path)) : [];
  const program = scrubbed(record.command[0]).replace(/^~/, homedir());
  const command = cwd === null ? null : profile.commandFor({ home, claude: program, cwd, prompt, ...runner.LEAD[run.block], sessionId: record.session_id, maxBudgetUsd: runner.WATCHDOG[run.block][run.task].usd, closed, unpinned: first.LEFT_TO_THE_HARNESS });
  const checks = {
    "the prompt, byte for byte": readFileSync(join(dir, "prompt.md"), "utf8") === prompt,
    "the command, argument for argument": command !== null && same(command.argv.map((arg) => (arg === prompt ? "<the prompt>" : scrubbed(arg))), record.command),
    "the names of the environment's variables": command !== null && same(Object.keys(command.env).sort(), record.environment),
    "the ceiling and the minutes": record.watchdog?.usd === runner.WATCHDOG[run.block][run.task].usd && record.watchdog?.minutes === runner.WATCHDOG[run.block][run.task].minutes,
    // The settings the lab's runner wrote into the profile just before the session, as the record kept them (in the
    // outside arm the tool then added the recorder's entries, which the record keeps in a file of its own).
    "the profile's settings, as the record kept them": cwd !== null && existsSync(join(dir, "settings.json")) && readFileSync(join(dir, "settings.json"), "utf8") === scrubbed(`${JSON.stringify(profile.settingsFor({ home, closed }), null, 2)}\n`),
  };
  if (run.arm === "outside") {
    // The launcher as the runner kept it, beside grooph's own folder for the run. The harness, node and the tool it
    // names are read from its own text (they are the machine's), and everything else is what this runner writes.
    const keptAt = join(home, "kept", String(record.session_id), "home", "launch-outside.sh");
    const kept = existsSync(keptAt) ? readFileSync(keptAt, "utf8") : null;
    const named = kept === null ? null : /HOME='[^']*' GROOPH_HOME='[^']*' CLAUDE_CONFIG_DIR='[^']*' CODEX_HOME='[^']*' '([^']*)' '([^']*)' hooks install/.exec(kept);
    const harness = kept === null ? null : /^exec \/usr\/bin\/env -u PWD -u OLDPWD -u SHLVL -u _ '([^']*)' "\$@"$/m.exec(kept)?.[1] ?? null;
    checks["the launcher's whole text"] = kept !== null && named !== null && harness !== null && cwd !== null && runner.launcherText({ harness, node: named[1], cli: named[2], groophHome: runner.groophHomeIn(home), configDir: profile.layout(home).profile, folder: cwd, dir: join(home, "home") }) === kept;
  }
  const no = Object.entries(checks).filter(([, holds]) => !holds).map(([what]) => what);
  if (no.length > 0) differing += 1;
  console.log(`${run.name}: made by the runner ${String(record.given?.the_runners_checkout?.runner_sha256).slice(0, 8)}; ${Object.keys(checks).length} things set beside this runner's: ${no.length === 0 ? "each the same" : `NOT THE SAME: ${no.join("; ")}`}`);
}
console.log(`${compared} recorded run(s) compared with the runner ${String(runner.checkout().runner_sha256).slice(0, 8)}: ${differing === 0 ? "none differs" : `${differing} DIFFER`}`);
process.exit(differing === 0 && compared > 0 ? 0 : 1);

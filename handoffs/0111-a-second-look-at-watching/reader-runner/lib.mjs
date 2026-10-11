// Helpers of the reader's scripts (slice 0111). Run every script through with-fake-home.sh: this file refuses to load
// when HOME is not a folder under the reader's own temp directory, so no script here can run against the owner's home.
//
// Nothing here starts a model session: the harness is scripts/lib/fixtures/stand-in-harness.mjs, which calls no model.
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.READER_TOP || !homedir().startsWith(process.env.READER_TOP) || !tmpdir().startsWith(process.env.READER_TOP)) {
  console.error("run this through with-fake-home.sh: HOME and TMPDIR must be the reader's own temp folders");
  process.exit(64);
}

export const here = dirname(fileURLToPath(import.meta.url));
/** The checkout whose runner is read: this one, or the one READER_ROOT names (a copy pinned to one commit). */
export const root = process.env.READER_ROOT || join(here, "..", "..", "..");
export const lib = join(root, "scripts", "lib");
export const STAND_IN = join(lib, "fixtures", "stand-in-harness.mjs");
/** Slice 0108's built tool, READ-ONLY: only ever passed as the `cli` option, with every place pointed at temp folders. */
export const CLI_0108 = "/Users/noir/Documents/grooph/.claude/worktrees/slice-0108-recorder-4a4073/packages/cli/bin/grooph.js";
/** The stand-in for the owner's home: what os.homedir() answers in these scripts. */
export const OWNER = homedir();

const { layout } = await import(join(lib, "compare-profile.mjs"));
const { LEDGER, SHIPPED_HOOK, order } = await import(join(lib, "watching-second-look-paid.mjs"));
export { layout, order };

export const DECISION = { decided_by: "the owner", on: "2026-10-11", words: "a reader's stand-in for his words" };
export const REHEARSED = { ok: true, left: { entries: 3, at_events: ["SessionStart", "SubagentStart", "SubagentStop"], hook_sha256: "a-reader's" }, said: "" };

/** Every file under a folder, by its path from it. Links are named and not followed. */
export function filesUnder(dir, base = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .flatMap((name) => (lstatSync(join(dir, name)).isDirectory() ? filesUnder(join(dir, name), base) : [join(dir, name).slice(base.length + 1)]));
}

/**
 * A stand-in for the tool that installs the recorder outside a project (the test file's, with more ways to go wrong):
 *   ""                as slice 0108's does it: the hook under GROOPH_HOME, entries in CLAUDE_CONFIG_DIR/settings.json
 *   "refuses"         exits 1 at install
 *   "ignores-places"  takes no notice of GROOPH_HOME and CLAUDE_CONFIG_DIR: it writes under $HOME/.grooph and
 *                     $HOME/.claude, as a tool does that reads no such variable
 *   "slow"            sleeps eight seconds in install, after writing a file that says it began
 *   "watch-fails"     installs, then exits 1 at `hooks watch`
 */
export function standInTool(dir, how = "") {
  const path = join(dir, `reader-grooph${how ? `-${how}` : ""}.mjs`);
  writeFileSync(
    path,
    `import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const [a, b, c] = process.argv.slice(2);
const how = ${JSON.stringify(how)};
const home = how === "ignores-places" ? join(process.env.HOME, ".grooph") : process.env.GROOPH_HOME;
const settingsAt = how === "ignores-places" ? join(process.env.HOME, ".claude", "settings.json") : join(process.env.CLAUDE_CONFIG_DIR, "settings.json");
if (a === "hooks" && b === "install" && c === "--user") {
  if (how === "refuses") { console.error("grooph: Unknown option '--user'"); process.exit(1); }
  if (how === "slow") { writeFileSync(${JSON.stringify(join(dir, "the-install-began"))}, String(process.pid)); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 8000); }
  mkdirSync(join(home, "hooks"), { recursive: true });
  cpSync(${JSON.stringify(SHIPPED_HOOK)}, join(home, "hooks", "grooph-event.mjs"));
  mkdirSync(join(settingsAt, ".."), { recursive: true });
  const settings = existsSync(settingsAt) ? JSON.parse(readFileSync(settingsAt, "utf8")) : {};
  const entry = { hooks: [{ type: "command", command: \`node "\${join(home, "hooks", "grooph-event.mjs")}" claude-code --user\`, async: true, timeout: 10 }] };
  settings.hooks = { SessionStart: [entry], SubagentStart: [entry], SubagentStop: [entry] };
  writeFileSync(settingsAt, JSON.stringify(settings, null, 2) + "\\n");
  console.log("wrote the hook and its entries");
} else if (a === "hooks" && b === "watch") {
  if (how === "watch-fails") { console.error("grooph: the list could not be written"); process.exit(1); }
  const listAt = join(home, "watched.json");
  const list = existsSync(listAt) ? JSON.parse(readFileSync(listAt, "utf8")) : { folders: [] };
  list.folders.push({ path: c, events: "packages" });
  writeFileSync(listAt, JSON.stringify(list));
  console.log("listed: " + c);
} else {
  console.error("not a command of the stand-in");
  process.exit(2);
}
`,
    "utf8",
  );
  return path;
}

/** A temporary profile home, a ledger of the repository's shape and a place for records: the test file's `place()`, copied. */
export function place(plan = { uses: [] }, { decided = true, lines = [], decision = DECISION, name = "second-look-" } = {}) {
  const top = realpathSync(mkdtempSync(join(tmpdir(), name)));
  const home = join(top, "home");
  const at = layout(home);
  for (const dir of [at.profile, at.shell, at.temp, at.cache, at.work]) mkdirSync(dir, { recursive: true });
  const setPlan = (next) => writeFileSync(join(at.profile, "stand-in-plan.json"), JSON.stringify(next), "utf8");
  setPlan(plan);
  const ledgerPath = join(top, "ledger.json");
  const kept = JSON.parse(readFileSync(LEDGER, "utf8"));
  writeFileSync(ledgerPath, JSON.stringify({ ...kept, invocations: lines, scoring_outside_the_sandbox: decided ? decision : { decided_by: null, on: null, words: null } }), "utf8");
  const harness = join(top, "stand-in-harness");
  writeFileSync(harness, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(STAND_IN)} "$@"\n`, { mode: 0o755 });
  const recordRoot = join(top, "records");
  const common = { home, claude: harness, ledgerPath, recordRoot, profileCheck: () => [], gameOpen: [], go: "the reader said: run the second look", grace: 300, firstCallGate: { ok: true, record: "record" }, cli: standInTool(top), rehearsal: () => REHEARSED };
  return { top, home, at, harness, ledgerPath, recordRoot, common, opus: { ...common, block: "opus" }, setPlan, ledger: () => JSON.parse(readFileSync(ledgerPath, "utf8")), seen: () => JSON.parse(readFileSync(join(at.profile, "command-seen-by-the-stand-in.json"), "utf8")) };
}

/** Records put in the order's way as already made. */
export function inHand(recordRoot, runs, result = { ended_by: "the session" }) {
  for (const run of runs) {
    mkdirSync(join(recordRoot, run.name), { recursive: true });
    writeFileSync(join(recordRoot, run.name, "result.json"), JSON.stringify(result), "utf8");
  }
}
export const byName = (name) => order().find((run) => run.name === name);
export const line = (event, more = {}, t = "2026-10-05T00:00:00.000Z") => JSON.stringify({ v: 1, t, harness: "claude-code", event, session: "<session>", ...more });
/** A stand-in's plan for one arm: no subagent, and the file the hook would have left where that arm's hook writes it. */
export const quietPlan = (arm, more = {}) => ({ ...more, uses: [{ tool: "Bash", input: { command: "npm test" }, result: "ok", ...(arm === "plain" ? {} : { appends: { [arm === "watched" ? ".grooph/events/<session>.jsonl" : "../../../home/.grooph/events/packages/<session>.jsonl"]: `${line("session-start")}\n${line("session-end")}\n` } }) }] });

/** Say one finding's outcome in a line a person can grep: SHOWN (the thing went wrong as claimed) or HELD (the attack failed). */
export const say = (verdict, what, more = "") => console.log(`${verdict.padEnd(5)} ${what}${more ? `\n      ${String(more).replaceAll("\n", "\n      ")}` : ""}`);
export const copyTree = (from, to) => cpSync(from, to, { recursive: true });

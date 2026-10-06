/**
 * The clean profile a comparison session of study three would start from, and the check of it that needs no session.
 *
 * It is the game experiment's profile (experiments/game/setup/PROFILE.md says what each line is for and how it is
 * known) made for headless comparison sessions: a configuration folder of its own, the sandbox, no skills or servers
 * of the account, the `grooph` command off the path, a temp folder of its own. It is a second profile, in a home of
 * its own: the game experiment's folders are never read or written here.
 *
 * What differs from the game's: no network at all (the tasks install nothing), no browser, no event hook to wall off,
 * a headless call (`-p`, with a dollar ceiling and the reply as JSON), and study two's pins of the model aliases.
 *
 *   node scripts/lib/compare-profile.mjs --print [--home <dir>]   what would be made, and the command a session would be started with
 *   node scripts/lib/compare-profile.mjs --make  [--home <dir>]   make the folders and write the settings (nothing is signed in)
 *   node scripts/lib/compare-profile.mjs --check [--home <dir>]   every line that can be checked with no session
 *
 * None of these starts a model session. Whether a headless session really starts from the profile takes one call,
 * which is paid, and is not made here.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir, userInfo } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ALIAS_ENV } from "./prove-pattern.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const TEMPLATE = join(root, "experiments", "comparisons", "profile", "settings.json");
export const DEFAULT_HOME = join(homedir(), "grooph-compare");
/** The path a session's commands get: node, npm and git, and not ~/.local/bin, where the grooph command and the harness are. */
export const SESSION_PATH = "/opt/homebrew/bin:/Library/Developer/CommandLineTools/usr/bin:/usr/bin:/bin:/usr/sbin:/sbin";

/** Where everything of the profile is, under one home: nothing of it is under /tmp or the account's temp folder, which the sandbox closes. */
export const layout = (home = DEFAULT_HOME) => ({
  home,
  profile: join(home, "profile"),
  shell: join(home, "profile", "no-shell-startup"),
  temp: join(home, "t"),
  cache: join(home, "npm-cache"),
  work: join(home, "work"),
});

/** The account's temp folder as the system names it, whatever TMPDIR says in this shell. Null where the system has no such name. */
export function systemTemp() {
  const asked = spawnSync("getconf", ["DARWIN_USER_TEMP_DIR"], { encoding: "utf8" });
  return asked.status === 0 && asked.stdout.trim() ? asked.stdout.trim() : null;
}

/**
 * This account's temp folder as the sandbox must name it: the folder above the per-process one, e.g. /var/folders/xx/yyyy.
 * It is asked of the system (`getconf DARWIN_USER_TEMP_DIR`), not read from TMPDIR: a shell started with TMPDIR set
 * elsewhere would otherwise leave the account's real temp folder open.
 */
export function userTemp(dir = systemTemp() ?? tmpdir()) {
  const match = /^(?:\/private)?(\/var\/folders\/[^/]+\/[^/]+)/.exec(dir);
  return match ? match[1] : dir.replace(/^\/private/, "").replace(/\/+$/, "");
}

/**
 * The settings file for a profile at `home`. `closed` are paths inside a session's folder no command may write (a
 * check's own files): the sandbox's wall, which binds commands. The file tools are closed to the same paths by
 * `commandFor`, on the command line. A run needs both, as the game's profile closes its hook both ways.
 */
export function settingsFor({ home = DEFAULT_HOME, temp = userTemp(), closed = [] } = {}) {
  // Closed to a session's commands as well: where earlier sessions' folders are moved to, and where their transcripts are kept.
  const text = readFileSync(TEMPLATE, "utf8").replaceAll("__NPM_CACHE__", layout(home).cache).replaceAll("__USER_TEMP__", temp).replaceAll("__KEPT__", join(home, "kept")).replaceAll("__PROJECTS__", join(layout(home).profile, "projects"));
  const settings = JSON.parse(text);
  settings.sandbox.filesystem.denyWrite = [...closed];
  return settings;
}

/**
 * The environment and the command a headless comparison session is started with. Nothing of the caller's own
 * environment goes in. The session's id is chosen beforehand, so the record can name its transcript before it exists.
 */
export function commandFor({ home = DEFAULT_HOME, claude, cwd, prompt, model, effort, sessionId, maxBudgetUsd, closed = [], user = userInfo().username, userHome = homedir() }) {
  const at = layout(home);
  for (const [name, value] of Object.entries({ claude, cwd, prompt, model, effort, sessionId, maxBudgetUsd })) if (value === undefined || value === null || value === "") throw new Error(`commandFor needs ${name}`);
  if (!resolve(cwd).startsWith(`${at.work}/`)) throw new Error(`a session's folder must be under ${at.work}, which the profile's sandbox leaves open; ${cwd} is not`);
  if (/fable|astra/i.test(model)) throw new Error(`${model} is a model this project never uses`);
  for (const path of closed) if (!resolve(path).startsWith(`${resolve(cwd)}/`)) throw new Error(`a closed path must be inside the session's folder; ${path} is not inside ${cwd}`);
  const env = {
    HOME: userHome,
    USER: user,
    LOGNAME: user,
    SHELL: "/bin/zsh",
    ZDOTDIR: at.shell,
    TERM: "dumb",
    LANG: "en_US.UTF-8",
    TMPDIR: at.temp,
    CLAUDE_CODE_TMPDIR: at.temp,
    PATH: SESSION_PATH,
    CLAUDE_CONFIG_DIR: at.profile,
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
    ENABLE_CLAUDEAI_MCP_SERVERS: "false",
    DISABLE_AUTOUPDATER: "1",
    CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL: "1",
    CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK: "1",
    CLAUDE_CODE_AUTO_CONNECT_IDE: "false",
    ...ALIAS_ENV,
  };
  const argv = [claude, "-p", prompt, "--model", model, "--effort", effort, "--output-format", "json", "--max-budget-usd", String(maxBudgetUsd), "--permission-mode", "dontAsk", "--allowedTools", "Edit(/**)", "--strict-mcp-config", "--setting-sources", "user,project", "--no-chrome", "--disable-slash-commands", "--session-id", sessionId];
  // A rule that begins with two slashes names a path from the root of the disk. It refuses the file tools; the sandbox's denyWrite refuses commands.
  if (closed.length > 0) argv.push("--disallowedTools", ...closed.flatMap((path) => [`Edit(/${resolve(path)})`, `Edit(/${resolve(path)}/**)`]));
  return { env, argv, cwd: resolve(cwd), transcript: join(at.profile, "projects", resolve(cwd).replace(/[^A-Za-z0-9]/g, "-"), `${sessionId}.jsonl`) };
}

/** Every flag `commandFor` passes, for checking against what the installed harness says it takes. */
export const FLAGS = ["--print", "--model", "--effort", "--output-format", "--max-budget-usd", "--permission-mode", "--allowedTools", "--disallowedTools", "--strict-mcp-config", "--setting-sources", "--no-chrome", "--disable-slash-commands", "--session-id"];

function found(name) {
  const which = spawnSync("/bin/sh", ["-c", `command -v ${name}`], { encoding: "utf8" });
  return which.status === 0 ? which.stdout.trim() : null;
}

/** Every instruction file a session started under `dir` would read from the folders above it, up to the root of the disk. */
export function instructionsAbove(dir) {
  const found = [];
  for (let at = resolve(dir); ; at = dirname(at)) {
    for (const name of ["CLAUDE.md", "CLAUDE.local.md", join(".claude", "CLAUDE.md"), "AGENTS.md"]) if (existsSync(join(at, name))) found.push(join(at, name));
    if (dirname(at) === at) break;
  }
  return found;
}

/** What can be known with no session. Each line: what, whether it holds, and how it is known. */
export function check({ home = DEFAULT_HOME, claude = found("claude") } = {}) {
  const at = layout(home);
  const lines = [];
  const add = (what, ok, how) => lines.push({ what, ok, how });
  add("the harness is installed", Boolean(claude), claude ?? "claude is not on this shell's path");
  if (claude) {
    const version = spawnSync(claude, ["--version"], { encoding: "utf8" }).stdout.trim();
    add("its version", Boolean(version), version);
    const help = spawnSync(claude, ["--help"], { encoding: "utf8" }).stdout;
    const missing = FLAGS.filter((flag) => !help.includes(flag));
    add("it takes every flag the command passes", missing.length === 0, missing.length === 0 ? `${FLAGS.length} flags, each in its own help text` : `not in its help text: ${missing.join(", ")}`);
  }
  add("the profile's home is not under /tmp or the account's temp folder", ![`/tmp/`, `/private/tmp/`, `${userTemp()}/`, `/private${userTemp()}/`].some((closed) => `${resolve(home)}/`.startsWith(closed)), `${home}; the sandbox closes ${userTemp()} and /tmp to commands`);
  const made = existsSync(at.profile);
  add("the profile's folders are made", made && [at.shell, at.temp, at.cache, at.work].every((dir) => existsSync(dir)), made ? at.profile : `not yet: run compare-profile.mjs --make${home === DEFAULT_HOME ? "" : ` --home ${home}`}`);
  if (made) {
    const kept = existsSync(join(at.profile, "settings.json")) ? readFileSync(join(at.profile, "settings.json"), "utf8") : null;
    add("its settings are the repository's", kept === `${JSON.stringify(settingsFor({ home }), null, 2)}\n`, kept === null ? "no settings.json in it" : "experiments/comparisons/profile/settings.json with this home's paths");
    const extra = readdirSync(at.profile).filter((name) => ["CLAUDE.md", "skills", "agents", "plugins", "commands"].includes(name));
    add("it holds no instructions, skills, agents or plugins", extra.length === 0, extra.length === 0 ? "none" : extra.join(", "));
    add("its temp folder is empty", readdirSync(at.temp).length === 0, at.temp);
    add("its work folder is empty", readdirSync(at.work).length === 0, at.work);
    // npm reads its own settings from a file in its cache folder, which every session may write: one session must not leave them for the next.
    const npmrc = join(at.cache, "npmrc");
    add("no npm settings were left in its npm cache", !existsSync(npmrc), existsSync(npmrc) ? `${npmrc}: an earlier session wrote npm's settings there, and the next would read them. A person looks, and moves it` : "none");
  }
  const above = instructionsAbove(at.work);
  add("no instruction file above a session's folder", above.length === 0, above.length === 0 ? `none in ${at.work} or any folder above it` : above.join(", "));
  const temp = systemTemp();
  add("the account's temp folder is the one the settings close", temp === null || settingsFor({ home }).sandbox.filesystem.denyRead.includes(userTemp(temp)), temp === null ? "this system names none" : `${userTemp(temp)}, by getconf and not by TMPDIR (${process.env.TMPDIR ?? "unset"})`);
  add("no managed settings on this Mac", !existsSync("/Library/Application Support/ClaudeCode"), "/Library/Application Support/ClaudeCode");
  const tool = spawnSync("/bin/sh", ["-c", "command -v grooph"], { encoding: "utf8", env: { PATH: SESSION_PATH } });
  add("the grooph command is not on a session's path", tool.status !== 0, tool.status !== 0 ? SESSION_PATH : tool.stdout.trim());
  for (const name of ["node", "git"]) {
    const on = spawnSync("/bin/sh", ["-c", `command -v ${name}`], { encoding: "utf8", env: { PATH: SESSION_PATH } });
    add(`${name} is on a session's path`, on.status === 0, on.stdout.trim() || "not found");
  }
  if (claude && made) {
    const status = spawnSync(claude, ["auth", "status"], { encoding: "utf8", env: { ...process.env, CLAUDE_CONFIG_DIR: at.profile } });
    const text = `${status.stdout}${status.stderr}`.trim();
    let signedIn = null;
    try {
      signedIn = JSON.parse(status.stdout).loggedIn === true;
    } catch {
      signedIn = /logged in|signed in/i.test(text) && !/not (?:logged|signed) in/i.test(text);
    }
    add("the profile is signed in", signedIn, signedIn ? "claude auth status, under this profile" : "not signed in: the owner signs in once, in a terminal, under this profile. Nothing can be run until then");
  }
  return lines;
}

/** What no check can show without a session: listed so that nobody reads a green check as more than it is. */
export const NOT_KNOWN_UNTIL_A_SESSION = [
  "that a headless session (-p) starts under these settings at all, and reports the model it was asked for",
  "that the sandbox is on for a headless session's commands, and that `node --test` and `npm test` run inside it with no network",
  "that the session lists no skill, no server and no subagent kind beyond the harness's own (read afterwards from its transcript)",
  "that a command cannot write a path named in denyWrite, and cannot read /tmp or the account's temp folder",
  "that the file tools refuse a path closed on the command line, for the session and for a subagent it starts (the builder has Edit and Write and no shell)",
  "what a session is told when a call is refused in this mode",
  "that npm, given its cache folder, does not look under /Users",
  "what a refused call costs a headless session in this mode: a turn, or the run",
];

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const flags = process.argv.slice(2);
  const at = (name) => (flags.includes(name) ? flags[flags.indexOf(name) + 1] : undefined);
  if (flags.includes("--home") && (at("--home") === undefined || at("--home").startsWith("--"))) {
    console.error("--home needs a folder after it. Nothing was done.");
    process.exit(64);
  }
  const home = resolve(at("--home") ?? DEFAULT_HOME);
  const where = layout(home);
  if (flags.includes("--make")) {
    // The two folders the settings close to a session's commands are made too, so that no rule names a path that is not there.
    for (const dir of [where.profile, where.shell, where.temp, where.cache, where.work, join(home, "kept"), join(where.profile, "projects")]) mkdirSync(dir, { recursive: true });
    writeFileSync(join(where.profile, "settings.json"), `${JSON.stringify(settingsFor({ home }), null, 2)}\n`, "utf8");
    console.log(`made ${where.profile} with its settings, and ${where.temp}, ${where.cache}, ${where.work}\nnot signed in: that is the owner's, once, in a terminal:\n  CLAUDE_CONFIG_DIR=${where.profile} claude auth login`);
  } else if (flags.includes("--print")) {
    console.log(`the profile's home: ${home}\n${JSON.stringify(where, null, 2)}\n\nits settings:\n${JSON.stringify(settingsFor({ home }), null, 2)}`);
    const folder = join(where.work, "<a folder made for the run>");
    const sample = commandFor({ home, claude: found("claude") ?? "claude", cwd: folder, prompt: "<the prompt>", model: "claude-opus-5-5", effort: "high", sessionId: "<a new id>", maxBudgetUsd: 3, closed: [join(folder, "<a path the run closes>")] });
    console.log(`\na session would be started in ${sample.cwd} with:\n  env -i ${Object.entries(sample.env).map(([k, v]) => `${k}=${v}`).join(" ")} \\\n  ${sample.argv.map((arg) => (/[\s(*]/.test(arg) ? `'${arg}'` : arg)).join(" ")}\n\nits transcript would be ${sample.transcript}\n\nA run that closes a path closes it twice: to the file tools by the --disallowedTools rules above, and to commands by a denyWrite line the runner adds to the settings before that run. A run that closes nothing gets neither.`);
  } else if (flags.includes("--check")) {
    const lines = check({ home });
    for (const line of lines) console.log(`${line.ok ? "ok " : "NO "} ${line.what}: ${line.how}`);
    console.log(`\nnot known until a session is started, which this script never does:\n${NOT_KNOWN_UNTIL_A_SESSION.map((line) => `  - ${line}`).join("\n")}`);
    process.exit(lines.every((line) => line.ok) ? 0 : 1);
  } else {
    console.error("usage: compare-profile.mjs --print | --make | --check [--home <dir>]\nNone of these starts a model session.");
    process.exit(64);
  }
}

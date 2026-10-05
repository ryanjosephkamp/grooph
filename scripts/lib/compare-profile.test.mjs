import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { check, commandFor, FLAGS, instructionsAbove, layout, SESSION_PATH, settingsFor, userTemp } from "./compare-profile.mjs";

const home = "/Users/someone/grooph-compare";

test("everything of the profile is under one home", () => {
  const at = layout(home);
  for (const dir of [at.profile, at.shell, at.temp, at.cache, at.work]) assert.ok(dir.startsWith(`${home}/`), dir);
  assert.equal(at.shell, join(at.profile, "no-shell-startup"));
});

test("the account's temp folder is named as the sandbox needs it", () => {
  assert.equal(userTemp("/var/folders/pv/abc123/T"), "/var/folders/pv/abc123");
  assert.equal(userTemp("/private/var/folders/pv/abc123/T/wk"), "/var/folders/pv/abc123");
  assert.equal(userTemp("/var/folders/pv/abc123/T/"), "/var/folders/pv/abc123", "as getconf prints it, with its slash");
  if (process.platform === "darwin") {
    const asked = spawnSync(process.execPath, ["-e", 'import("./compare-profile.mjs").then((m) => console.log(m.userTemp()))'], { encoding: "utf8", cwd: dirname(fileURLToPath(import.meta.url)), env: { ...process.env, TMPDIR: "/tmp/elsewhere" } });
    assert.match(asked.stdout.trim(), /^\/var\/folders\/[^/]+\/[^/]+$/, "TMPDIR set elsewhere does not move the folder the sandbox closes");
  }
});

test("the settings close what the game's profile closes, open no network, and wall what a run names", () => {
  const settings = settingsFor({ home, temp: "/var/folders/pv/abc123", closed: ["/Users/someone/grooph-compare/work/x/rounds/check"] });
  assert.ok(!JSON.stringify(settings).includes("__"), "no placeholder is left");
  assert.equal(settings.permissions.defaultMode, "dontAsk");
  assert.equal(settings.permissions.blockReadsOutsideWorkingDirectories, true);
  for (const tool of ["WebFetch", "WebSearch", "ListAgents", "SendMessage", "AskUserQuestion"]) assert.ok(settings.permissions.deny.includes(tool), tool);
  assert.equal(settings.sandbox.enabled, true);
  assert.equal(settings.sandbox.failIfUnavailable, true);
  assert.equal(settings.sandbox.allowUnsandboxedCommands, false);
  assert.deepEqual(settings.sandbox.network.allowedDomains, []);
  assert.equal(settings.sandbox.network.strictAllowlist, true);
  assert.deepEqual(settings.sandbox.filesystem.denyRead, ["/tmp", "/private/tmp", "/var/folders/pv/abc123", "/private/var/folders/pv/abc123", join(home, "kept"), join(home, "profile", "projects")], "the temp folders, and where earlier sessions' folders and transcripts are");
  assert.deepEqual(settings.sandbox.filesystem.denyWrite, ["/Users/someone/grooph-compare/work/x/rounds/check"]);
  assert.deepEqual(settings.sandbox.filesystem.allowWrite, [join(home, "npm-cache")]);
  assert.equal(settings.autoMemoryEnabled, false);
  assert.equal(settings.crossSessionInbound, "refuse");
  assert.deepEqual(settingsFor({ home, temp: "/x" }).sandbox.filesystem.denyWrite, []);
});

const ask = (more = {}) => commandFor({ home, claude: "/Users/someone/.local/bin/claude", cwd: join(home, "work", "a1b2", "rounds"), prompt: "go", model: "claude-opus-5-5", effort: "high", sessionId: "11111111-2222-3333-4444-555555555555", maxBudgetUsd: 3, user: "someone", userHome: "/Users/someone", ...more });

test("a session is started headless, from the profile, with nothing of the caller's environment", () => {
  const { env, argv, transcript } = ask();
  assert.equal(env.CLAUDE_CONFIG_DIR, join(home, "profile"));
  assert.equal(env.PATH, SESSION_PATH);
  assert.ok(!env.PATH.includes(".local/bin"), "the grooph command's folder is not on the path");
  assert.equal(env.TMPDIR, join(home, "t"));
  assert.equal(env.ZDOTDIR, join(home, "profile", "no-shell-startup"));
  assert.equal(env.ANTHROPIC_DEFAULT_FABLE_MODEL, "claude-opus-5-5", "no alias reaches a model this project never uses");
  assert.ok(!("GROOPH_MODELS" in env) && !("ANTHROPIC_API_KEY" in env));
  assert.deepEqual(argv.slice(0, 3), ["/Users/someone/.local/bin/claude", "-p", "go"]);
  const flag = (name) => argv[argv.indexOf(name) + 1];
  assert.equal(flag("--model"), "claude-opus-5-5");
  assert.equal(flag("--effort"), "high");
  assert.equal(flag("--output-format"), "json");
  assert.equal(flag("--max-budget-usd"), "3");
  assert.equal(flag("--permission-mode"), "dontAsk");
  assert.equal(flag("--allowedTools"), "Edit(/**)");
  assert.equal(flag("--setting-sources"), "user,project");
  assert.equal(flag("--session-id"), "11111111-2222-3333-4444-555555555555");
  for (const name of FLAGS.filter((f) => f !== "--print" && f !== "--disallowedTools")) assert.ok(argv.includes(name), name);
  assert.ok(!argv.includes("--disallowedTools"), "with nothing closed, no rule is passed");
  assert.equal(transcript, join(home, "profile", "projects", "-Users-someone-grooph-compare-work-a1b2-rounds", "11111111-2222-3333-4444-555555555555.jsonl"));
});

test("a session is refused a folder outside the profile's work folder, a model never used, and a missing ceiling", () => {
  assert.throws(() => ask({ cwd: "/tmp/somewhere" }), /must be under/);
  assert.throws(() => ask({ cwd: join(home, "profile") }), /must be under/);
  assert.throws(() => ask({ model: "claude-fable-5-1" }), /never uses/);
  assert.throws(() => ask({ maxBudgetUsd: undefined }), /needs maxBudgetUsd/);
  assert.throws(() => ask({ sessionId: "" }), /needs sessionId/);
});

test("a path a run closes is closed to the file tools on the command line and to commands in the settings", () => {
  const cwd = join(home, "work", "a1b2", "rounds");
  const { argv } = ask({ cwd, closed: [join(cwd, "check")] });
  const at = argv.indexOf("--disallowedTools");
  assert.ok(at > 0);
  assert.deepEqual(argv.slice(at + 1), [`Edit(/${cwd}/check)`, `Edit(/${cwd}/check/**)`], "the folder and everything under it, named from the root of the disk");
  assert.ok(argv[at + 1].startsWith("Edit(//Users/"));
  assert.deepEqual(settingsFor({ home, temp: "/x", closed: [join(cwd, "check")] }).sandbox.filesystem.denyWrite, [join(cwd, "check")]);
  assert.throws(() => ask({ cwd, closed: ["/Users/someone/elsewhere/check"] }), /must be inside the session's folder/);
  assert.throws(() => ask({ cwd, closed: [cwd] }), /must be inside the session's folder/, "the folder itself is not a path inside it");
});

test("an instruction file in any folder above a session's is found", () => {
  const top = mkdtempSync(join(tmpdir(), "profile-"));
  try {
    const work = join(top, "a", "b", "work");
    mkdirSync(work, { recursive: true });
    const before = instructionsAbove(work).filter((path) => path.startsWith(top));
    assert.deepEqual(before, []);
    writeFileSync(join(top, "a", "CLAUDE.md"), "# rules\n", "utf8");
    mkdirSync(join(top, ".claude"));
    writeFileSync(join(top, ".claude", "CLAUDE.md"), "# more\n", "utf8");
    writeFileSync(join(work, "AGENTS.md"), "# agents\n", "utf8");
    assert.deepEqual(instructionsAbove(work).filter((path) => path.startsWith(top)), [join(work, "AGENTS.md"), join(top, "a", "CLAUDE.md"), join(top, ".claude", "CLAUDE.md")]);
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test("--home with no folder after it does nothing, and says so", () => {
  const script = join(dirname(fileURLToPath(import.meta.url)), "compare-profile.mjs");
  for (const args of [["--make", "--home"], ["--home", "--make"], ["--check", "--home"]]) {
    const run = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
    assert.equal(run.status, 64, args.join(" "));
    assert.match(run.stderr, /--home needs a folder after it\. Nothing was done\./);
  }
});

test("npm settings a session left in the profile's npm cache are seen by the check, and the folders the settings close are made", () => {
  const top = mkdtempSync(join(tmpdir(), "npmrc-"));
  const made = join(top, "home");
  try {
    const out = spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), "compare-profile.mjs"), "--make", "--home", made], { encoding: "utf8" });
    assert.equal(out.status, 0, out.stderr);
    const at = layout(made);
    // Every path the settings close to a session's commands is there before any session is: no rule names a folder that is not.
    for (const closed of settingsFor({ home: made }).sandbox.filesystem.denyRead.filter((path) => path.startsWith(`${made}/`))) assert.ok(spawnSync("test", ["-d", closed]).status === 0, closed);
    const line = () => check({ home: made, claude: null }).find((entry) => entry.what === "no npm settings were left in its npm cache");
    assert.deepEqual([line().ok, line().how], [true, "none"]);
    // npm reads its settings from this file, and every session may write the folder it is in.
    writeFileSync(join(at.cache, "npmrc"), "script-shell=/tmp/a-program-of-an-earlier-session\n", "utf8");
    assert.equal(line().ok, false);
    assert.match(line().how, /an earlier session wrote npm's settings there, and the next would read them/);
    assert.equal(settingsFor({ home: made }).env.npm_config_userconfig, join(at.cache, "npmrc"), "the file the check looks for is the one the settings name");
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

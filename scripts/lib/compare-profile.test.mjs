import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { commandFor, FLAGS, layout, SESSION_PATH, settingsFor, userTemp } from "./compare-profile.mjs";

const home = "/Users/someone/grooph-compare";

test("everything of the profile is under one home", () => {
  const at = layout(home);
  for (const dir of [at.profile, at.shell, at.temp, at.cache, at.work]) assert.ok(dir.startsWith(`${home}/`), dir);
  assert.equal(at.shell, join(at.profile, "no-shell-startup"));
});

test("the account's temp folder is named as the sandbox needs it", () => {
  assert.equal(userTemp("/var/folders/pv/abc123/T"), "/var/folders/pv/abc123");
  assert.equal(userTemp("/private/var/folders/pv/abc123/T/wk"), "/var/folders/pv/abc123");
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
  assert.deepEqual(settings.sandbox.filesystem.denyRead, ["/tmp", "/private/tmp", "/var/folders/pv/abc123", "/private/var/folders/pv/abc123"]);
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
  for (const name of FLAGS.filter((f) => f !== "--print")) assert.ok(argv.includes(name), name);
  assert.equal(transcript, join(home, "profile", "projects", "-Users-someone-grooph-compare-work-a1b2-rounds", "11111111-2222-3333-4444-555555555555.jsonl"));
});

test("a session is refused a folder outside the profile's work folder, a model never used, and a missing ceiling", () => {
  assert.throws(() => ask({ cwd: "/tmp/somewhere" }), /must be under/);
  assert.throws(() => ask({ cwd: join(home, "profile") }), /must be under/);
  assert.throws(() => ask({ model: "claude-fable-5-1" }), /never uses/);
  assert.throws(() => ask({ maxBudgetUsd: undefined }), /needs maxBudgetUsd/);
  assert.throws(() => ask({ sessionId: "" }), /needs sessionId/);
});

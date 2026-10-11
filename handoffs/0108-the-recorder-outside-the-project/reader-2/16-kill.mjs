/**
 * Second reader, slice 0108. The first reader's 08-kill.mjs stops `install --user` and `watch` dead at a random
 * moment. This does the same to what it did not: `remove --user`, an install for both harnesses, and an install
 * over an earlier install's entries (taken out of the text and put in again), each on settings of about 3 MB so
 * that the write is long enough to be hit.
 *
 *   node 16-kill.mjs [--times 200]
 *
 * After each stop: every settings file is as it was or whole as it was meant; never anything else. And never
 * grooph's entries in a settings file while the hook's file they run is missing or cut short (a session would
 * then hear an error at every event).
 *
 * Every grooph run goes through the first reader's lib.mjs (scratch folders only).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CLI, g, gSpawn, person, row, summary } from "../reader/lib.mjs";

const at = process.argv.indexOf("--times");
const TIMES = at < 0 ? 200 : Number(process.argv[at + 1]);
const shipped = readFileSync(join(CLI, "..", "..", "hooks", "grooph-event.mjs"));
const big = (extra = {}) => `${JSON.stringify({ permissions: { allow: Array.from({ length: 60_000 }, (_, i) => `Bash(some-command-number-${i}:*)`) }, model: "opus", hooks: { Stop: [{ hooks: [{ type: "command", command: "./notify.sh" }] }], ...extra }, theme: "dark" }, null, 2)}\n`;

function killAt(env, args, ms) {
  return new Promise((done) => {
    const child = gSpawn(env, args);
    const timer = setTimeout(() => child.kill("SIGKILL"), ms);
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      done({ status, signal });
    });
  });
}
const timeOf = (env, args) => {
  const t0 = process.hrtime.bigint();
  g(env, args);
  return Number(process.hrtime.bigint() - t0) / 1e6;
};
const oursIn = (text) => (text.match(/grooph-event\.mjs\\" (?:claude-code|codex) --user/g) ?? []).length;

/**
 * `prepare(env)` puts the person's files in their starting state and returns { files: { path: text } }: what
 * each settings file holds before the command. `good(path, text)` says whether a changed file is whole and as meant.
 */
async function trial(what, args, prepare, good) {
  const env = person(what.replace(/\W+/g, "-").slice(0, 30));
  const hook = join(env.GROOPH_HOME, "hooks", "grooph-event.mjs");
  const reset = () => {
    rmSync(env.CLAUDE_CONFIG_DIR, { recursive: true, force: true });
    rmSync(env.CODEX_HOME, { recursive: true, force: true });
    rmSync(env.GROOPH_HOME, { recursive: true, force: true });
    mkdirSync(env.CLAUDE_CONFIG_DIR, { recursive: true });
    mkdirSync(env.CODEX_HOME, { recursive: true });
    return prepare(env);
  };
  reset();
  const whole = Math.max(timeOf(env, args), 60);
  const t = { killed: 0, asItWas: 0, done: 0, mixed: 0, broken: 0, orphan: 0, hookCut: 0, tmp: 0 };
  for (let i = 0; i < TIMES; i += 1) {
    const { files } = reset();
    const r = await killAt(env, args, Math.random() * whole * 1.05);
    if (r.signal === "SIGKILL") t.killed += 1;
    const states = Object.entries(files).map(([path, was]) => {
      const now = readFileSync(path, "utf8");
      if (now === was) return "was";
      return good(path, now) ? "done" : "broken";
    });
    if (states.includes("broken")) t.broken += 1;
    else if (states.every((s) => s === "was")) t.asItWas += 1;
    else if (states.every((s) => s === "done")) t.done += 1;
    else t.mixed += 1;
    const hookWhole = existsSync(hook) && readFileSync(hook).equals(shipped);
    if (existsSync(hook) && !hookWhole) t.hookCut += 1;
    // Entries that run this install's hook, while that file is not there whole.
    if (!hookWhole && Object.keys(files).some((path) => readFileSync(path, "utf8").includes(JSON.stringify(hook).slice(1, -1)))) t.orphan += 1;
    for (const dir of [env.CLAUDE_CONFIG_DIR, env.CODEX_HOME, join(env.GROOPH_HOME, "hooks")]) if (existsSync(dir)) t.tmp += readdirSync(dir).filter((n) => n.includes("grooph-tmp")).length;
  }
  row(
    `${what}: \`grooph ${args.join(" ")}\` killed at a random moment of its ${Math.round(whole)} ms`,
    TIMES,
    `${t.killed} killed before the end. Settings afterward: all as they were ${t.asItWas}; all whole and as meant ${t.done}; one harness's done and the other's not ${t.mixed}; BROKEN ${t.broken}. Entries left running a hook file that is missing or cut short: ${t.orphan}. The hook's file cut short: ${t.hookCut}. *.grooph-tmp files left: ${t.tmp}`,
    t.broken + t.orphan + t.hookCut === 0 ? (t.tmp > 0 ? "limit" : "held") : "broke",
  );
}

const claude = (env) => join(env.CLAUDE_CONFIG_DIR, "settings.json");
const codex = (env) => join(env.CODEX_HOME, "hooks.json");
const parses = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

// 1. remove --user, after a good install.
await trial(
  "remove",
  ["hooks", "remove", "--user"],
  (env) => {
    writeFileSync(claude(env), big());
    g(env, ["hooks", "install", "--user"]);
    return { files: { [claude(env)]: readFileSync(claude(env), "utf8") } };
  },
  (_path, text) => text === big(),
);

// 2. install for both harnesses.
await trial(
  "install, both harnesses",
  ["hooks", "install", "--user", "--harness", "claude-code,codex"],
  (env) => {
    writeFileSync(claude(env), big());
    writeFileSync(codex(env), big());
    return { files: { [claude(env)]: big(), [codex(env)]: big() } };
  },
  (_path, text) => {
    const j = parses(text);
    return j !== undefined && j.permissions.allow.length === 60_000 && j.theme === "dark" && j.hooks.Stop.length === 2 && j.hooks.SessionStart.length === 1 && oursIn(text) >= 6;
  },
);

// 3. remove for both harnesses.
await trial(
  "remove, both harnesses",
  ["hooks", "remove", "--user", "--harness", "claude-code,codex"],
  (env) => {
    writeFileSync(claude(env), big());
    writeFileSync(codex(env), big());
    g(env, ["hooks", "install", "--user", "--harness", "claude-code,codex"]);
    return { files: { [claude(env)]: readFileSync(claude(env), "utf8"), [codex(env)]: readFileSync(codex(env), "utf8") } };
  },
  (_path, text) => text === big(),
);

// 4. install over an earlier install's entries (taken out of the text, put in again): --tools added.
await trial(
  "install --tools over an install without",
  ["hooks", "install", "--user", "--tools"],
  (env) => {
    writeFileSync(claude(env), big());
    g(env, ["hooks", "install", "--user"]);
    return { files: { [claude(env)]: readFileSync(claude(env), "utf8") } };
  },
  (_path, text) => {
    const j = parses(text);
    return j !== undefined && j.permissions.allow.length === 60_000 && j.theme === "dark" && j.hooks.Stop.length === 2 && j.hooks.PostToolUse.length === 1 && j.hooks.PostToolUse[0].matcher === undefined && oursIn(text) === 7;
  },
);
summary();

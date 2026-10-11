/**
 * Shared by every script of the fresh reader of slice 0108. No model, no network.
 *
 * Every run of the grooph command goes through `g()`, which refuses to start unless GROOPH_HOME,
 * CLAUDE_CONFIG_DIR, CODEX_HOME and HOME are all named, non-empty, and resolve to places under the scratch
 * folder this process made. Nothing of the machine's own (~/.claude, ~/.codex, ~/.grooph) is read or written.
 *
 * The scratch folder is made under READER_TMP when that is set, else under the system's temporary folder.
 * It is left in place when READER_KEEP=1 and removed otherwise.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, "..", "..", "..");
/** The build under attack: the worktree's own, or the one GROOPH_CLI names (a copy pinned while the lane was still changing its source). */
export const CLI = process.env.GROOPH_CLI ? resolve(process.env.GROOPH_CLI) : join(ROOT, "packages", "cli", "bin", "grooph.js");
const sum = (file) => {
  try {
    return createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 12);
  } catch {
    return "missing";
  }
};
/** Which build this was: the first twelve characters of the SHA-256 of the built hooks command, of events-io, and of the shipped hook. */
export const buildId = () => `hooks.js ${sum(resolve(dirname(CLI), "..", "dist", "src", "commands", "hooks.js"))} · events-io.js ${sum(resolve(dirname(CLI), "..", "dist", "src", "events-io.js"))} · grooph-event.mjs ${sum(resolve(dirname(CLI), "..", "hooks", "grooph-event.mjs"))}`;
const builtAtStart = buildId();
console.log(`build: ${CLI}\n       ${builtAtStart}\n       node ${process.version}, ${process.platform} ${process.arch}`);
process.on("exit", () => {
  if (buildId() !== builtAtStart) console.log(`WARNING: the build changed while this ran. Now: ${buildId()}`);
});

export const S = realpathSync(mkdtempSync(join(process.env.READER_TMP || tmpdir(), "g0108-reader-")));
if (process.env.READER_KEEP !== "1") process.on("exit", () => rmSync(S, { recursive: true, force: true }));
else process.on("exit", () => console.log(`(scratch kept: ${S})`));

export const made = (...parts) => {
  mkdirSync(join(S, ...parts), { recursive: true });
  return join(S, ...parts);
};

/** One scratch person: the four places, all under S. */
export const person = (name = "p") => {
  made(name, "home");
  return { GROOPH_HOME: join(S, name, "gh"), CLAUDE_CONFIG_DIR: join(S, name, "claude"), CODEX_HOME: join(S, name, "codex"), HOME: join(S, name, "home") };
};

/** The deepest part of a path that exists, with links resolved, then the rest as typed. */
const settled = (p) => {
  let at = p;
  const rest = [];
  for (;;) {
    try {
      return join(realpathSync(at), ...rest.reverse());
    } catch {
      if (dirname(at) === at) return p;
      rest.push(at.slice(dirname(at).length).replace(/^[\\/]/, ""));
      at = dirname(at);
    }
  }
};

function guard(env, cwd) {
  for (const name of ["GROOPH_HOME", "CLAUDE_CONFIG_DIR", "CODEX_HOME", "HOME"]) {
    const v = env[name];
    if (typeof v !== "string" || v === "") throw new Error(`guard: ${name} is not set; grooph is not run`);
    const full = settled(resolve(cwd, v));
    if (!(full === S || full.startsWith(S + sep))) throw new Error(`guard: ${name}=${v} resolves to ${full}, outside the scratch folder ${S}; grooph is not run`);
  }
  const at = settled(resolve(cwd));
  if (!(at === S || at.startsWith(S + sep))) throw new Error(`guard: the working folder ${at} is outside the scratch folder`);
}

/** grooph watch serves the built web app; a pinned copy of the CLI has none beside it, so the worktree's own is named (it is only read). */
const base = (env) => ({ PATH: process.env.PATH ?? "", GROOPH_WEB_DIST: join(ROOT, "apps", "web", "dist"), ...env });

/** Run the built grooph command. `env` must hold the four places; `cwd` must be under S. */
export function g(env, args, opts = {}) {
  const cwd = opts.cwd ?? S;
  guard(env, cwd);
  const ran = spawnSync(process.execPath, [opts.cli ?? CLI, ...args], { env: base(env), cwd, encoding: "utf8", input: opts.input ?? "", timeout: opts.timeout ?? 60_000 });
  return { status: ran.status, signal: ran.signal, out: ran.stdout ?? "", err: ran.stderr ?? "", all: `${ran.stdout ?? ""}${ran.stderr ?? ""}` };
}

/** The same, not waited for: returns the child. */
export function gSpawn(env, args, opts = {}) {
  const cwd = opts.cwd ?? S;
  guard(env, cwd);
  return spawn(process.execPath, [CLI, ...args], { env: base(env), cwd, stdio: ["ignore", "pipe", "pipe"] });
}

/** Run an installed hook file directly (it must be under S), with a payload on standard input. */
export function hook(file, argv, payload, opts = {}) {
  const real = settled(resolve(file));
  if (!real.startsWith(S + sep)) throw new Error(`guard: hook ${real} is not under the scratch folder`);
  const env = { PATH: process.env.PATH ?? "", HOME: join(S, "nohome"), ...(opts.env ?? {}) };
  const ran = spawnSync(process.execPath, [file, ...argv], { env, cwd: opts.cwd ?? S, input: typeof payload === "string" ? payload : JSON.stringify(payload), timeout: opts.timeout ?? 20_000 });
  return { status: ran.status, signal: ran.signal, out: String(ran.stdout ?? ""), err: String(ran.stderr ?? ""), timedOut: ran.error?.code === "ETIMEDOUT" };
}

/** Run the hook, not waited for; resolves with { status, signal, out, err, hung }. */
export function hookAsync(file, argv, payload, opts = {}) {
  return new Promise((done) => {
    const env = { PATH: process.env.PATH ?? "", HOME: join(S, "nohome"), ...(opts.env ?? {}) };
    const child = spawn(process.execPath, [file, ...argv], { env, cwd: opts.cwd ?? S, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    let hung = false;
    const timer = setTimeout(() => {
      hung = true;
      child.kill("SIGKILL");
    }, opts.timeout ?? 20_000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      done({ status, signal, out, err, hung });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(typeof payload === "string" ? payload : JSON.stringify(payload));
  });
}

/** Every path under a folder with what stands there: "d", "l -> target", or "f <size> <ino> <nlink>" (links not followed). */
export function tree(dir, withIno = false) {
  const found = new Map();
  const walk = (at, rel) => {
    let names;
    try {
      names = readdirSync(at);
    } catch {
      return;
    }
    for (const name of names.sort()) {
      const full = join(at, name);
      const r = rel === "" ? name : `${rel}/${name}`;
      const is = lstatSync(full, { throwIfNoEntry: false });
      if (is === undefined) continue;
      if (is.isSymbolicLink()) found.set(r, `l -> ${readlinkSync(full)}`);
      else if (is.isDirectory()) {
        found.set(r, "d");
        walk(full, r);
      } else if (is.isFile()) found.set(r, `f ${is.size}${withIno ? ` ino${is.ino} n${is.nlink}` : ""}`);
      else found.set(r, "other");
    }
  };
  walk(dir, "");
  return found;
}

/** What changed between two trees: lines "+ path what", "- path what", "~ path was -> is". */
export function changed(before, after) {
  const lines = [];
  for (const [k, v] of after) if (!before.has(k)) lines.push(`+ ${k} ${v}`);
    else if (before.get(k) !== v) lines.push(`~ ${k} ${before.get(k)} -> ${v}`);
  for (const [k, v] of before) if (!after.has(k)) lines.push(`- ${k} ${v}`);
  return lines;
}

export const read = (p) => readFileSync(p, "utf8");
export const lines = (p) => (existsSync(p) ? read(p).split("\n").filter((l) => l !== "") : []);

/** A table row and a tally. */
const rows = [];
export function row(what, tries, happened, verdict) {
  rows.push({ what, tries, happened, verdict });
  console.log(`[${verdict.toUpperCase()}] ${what} | tries: ${tries} | ${happened}`);
}
export function summary() {
  const count = (v) => rows.filter((r) => r.verdict === v).length;
  console.log(`\n${rows.length} attacks: ${count("held")} held, ${count("broke")} broke, ${count("limit")} a limit worth saying`);
}

/** A person with the hook installed outside the project and one folder listed. Returns everything a script needs. */
export function installed(name = "p", harness = "claude-code") {
  const env = person(name);
  const a = g(env, ["hooks", "install", "--user", "--harness", harness]);
  if (a.status !== 0) throw new Error(`install --user failed: ${a.all}`);
  return { env, home: env.GROOPH_HOME, hookFile: join(env.GROOPH_HOME, "hooks", "grooph-event.mjs"), list: join(env.GROOPH_HOME, "watched.json"), events: join(env.GROOPH_HOME, "events") };
}
/** List a folder; returns the folder its events are kept in. */
export function watch(p, folder) {
  const ran = g(p.env, ["hooks", "watch", folder]);
  if (ran.status !== 0) throw new Error(`watch ${folder} failed: ${ran.all}`);
  const list = JSON.parse(read(p.list));
  const real = realpathSync.native(folder);
  const entry = list.folders.find((f) => f.path === real);
  return join(p.events, entry.events);
}
export { isAbsolute };

#!/usr/bin/env node
/**
 * Many sessions, one events branch, every turn ending in the same moment: does each one get through?
 *
 *   node experiments/hooks/shared-branch.mjs [--sessions 10] [--latency 2000] [--remote <url> --branch <name>]
 *
 * It starts no model session. It makes N small repositories, gives each one event file of its own, and runs the
 * push script in each as a harness would at a turn's end (`--hook`), all at once. Then it reads the branch and
 * each repository's record of its push (`.grooph/events/.last-push.json`) and prints what happened as JSON.
 *
 *   --sessions <n>   how many push at once (default 10)
 *   --latency <ms>   with no --remote: how long the made-up remote takes over one fetch and one push together.
 *                    Two fifths of it is spent before a fetch answers, three fifths inside the push, between
 *                    the remote saying what it holds and taking the new commit: the window a race happens in.
 *   --remote <url>   a real remote instead. It is written to: one branch, named by --branch, which this leaves
 *                    there for you to look at and delete (git push <url> --delete <branch>).
 *   --branch <name>  default: grooph-events/trial-shared
 *   --settle <ms>    the push script's own wait before it starts (default 0: as hard a collision as there is)
 */
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const sessions = Number(flag("--sessions", "10"));
const latency = Number(flag("--latency", "0"));
const url = flag("--remote", undefined);
const branch = flag("--branch", "grooph-events/trial-shared");
const settle = flag("--settle", "0");

const script = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "packages", "cli", "hooks", "grooph-events-push.mjs");
const git = (cwd, ...a) => execFileSync("git", ["-C", cwd, "-c", "user.name=trial", "-c", "user.email=trial@example.invalid", ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const root = realpathSync(mkdtempSync(join(tmpdir(), "grooph-shared-")));
try {
  let remote = url;
  if (!remote) {
    remote = join(root, "remote.git");
    git(root, "init", "--quiet", "--bare", "-b", "main", remote);
    if (latency > 0) writeFileSync(join(remote, "hooks", "pre-receive"), `#!/bin/sh\nsleep ${((latency * 0.6) / 1000).toFixed(2)}\nexit 0\n`, { mode: 0o755 });
  }
  const stamp = new Date().toISOString();
  const dirs = Array.from({ length: sessions }, (_, i) => {
    const dir = join(root, `session-${i}`);
    git(root, "init", "--quiet", "-b", "main", dir);
    git(dir, "remote", "add", "origin", remote);
    if (!url && latency > 0) git(dir, "config", "remote.origin.uploadpack", `sleep ${((latency * 0.4) / 1000).toFixed(2)}; git-upload-pack`);
    mkdirSync(join(dir, ".grooph", "hooks"), { recursive: true });
    mkdirSync(join(dir, ".grooph", "events"), { recursive: true });
    copyFileSync(script, join(dir, ".grooph", "hooks", "grooph-events-push.mjs"));
    const id = `trial-${stamp.replace(/[^0-9]/g, "").slice(0, 14)}-${i}`;
    const line = (event) => JSON.stringify({ v: 1, t: new Date().toISOString(), harness: "claude-code", event, session: id });
    writeFileSync(join(dir, ".grooph", "events", `${id}.jsonl`), `${line("turn-start")}\n${line("turn-end")}\n`);
    return dir;
  });

  const began = Date.now();
  const runs = await Promise.all(
    dirs.map(
      (dir) =>
        new Promise((done) => {
          const child = spawn(process.execPath, [join(dir, ".grooph", "hooks", "grooph-events-push.mjs"), "--hook", "--branch", branch], { cwd: dir, env: { ...process.env, GROOPH_PUSH_SETTLE_MS: settle }, stdio: ["ignore", "pipe", "pipe"] });
          let said = "";
          child.stdout.on("data", (c) => (said += String(c)));
          child.stderr.on("data", (c) => (said += String(c)));
          child.on("close", (code) => done({ code, said, seconds: (Date.now() - began) / 1000 }));
        }),
    ),
  );

  const records = dirs.map((dir) => {
    try {
      return JSON.parse(readFileSync(join(dir, ".grooph", "events", ".last-push.json"), "utf8"));
    } catch {
      return undefined;
    }
  });
  const reader = dirs[0];
  let onBranch = [];
  let commits = 0;
  try {
    git(reader, "fetch", "--quiet", "origin", `+refs/heads/${branch}:refs/trial/tip`);
    onBranch = git(reader, "ls-tree", "-r", "--name-only", "refs/trial/tip").split("\n").filter((name) => name.includes(stamp.replace(/[^0-9]/g, "").slice(0, 14)));
    commits = Number(git(reader, "rev-list", "--count", "refs/trial/tip"));
  } catch {
    // nothing arrived
  }
  const seconds = runs.map((r) => r.seconds).sort((a, b) => a - b);
  const tries = records.map((r) => (r?.ok ? (r.tries ?? 1) : undefined));
  console.log(
    JSON.stringify(
      {
        at: stamp,
        remote: url ? "a real remote" : `a made-up remote on this machine${latency > 0 ? `, ${latency} ms for a fetch and a push` : ""}`,
        branch,
        sessions,
        arrived: records.filter((r) => r?.ok === true).length,
        filesOnBranch: onBranch.length,
        commitsOnBranch: commits,
        silentAndExitZero: runs.every((r) => r.code === 0 && r.said === ""),
        seconds: { first: seconds[0], median: seconds[Math.floor(seconds.length / 2)], last: seconds[seconds.length - 1] },
        triesPerSession: tries,
        failed: records.filter((r) => r && r.ok === false).map((r) => r.message),
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}

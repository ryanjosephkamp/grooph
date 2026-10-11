/**
 * `grooph watch` (docs/subagents.md §6): the sessions the event hook recorded, served to this machine's browser.
 * It is started on a free port in a scratch project and serves a stand-in app, so these tests do not depend on the
 * web build.
 *
 * This file was `grooph runs | adopt | share <run dir> | watch`. Those tests moved to lab/test/runs.test.ts when the
 * commands left this command line for the lab's (slice 0103), with every test of `watch` that follows a run. What is
 * here is what `grooph watch` does with no run to follow, in its own words: the two tests marked "the product's half"
 * are the parts of two of the moved tests that need no run folder, on `startWatch({ root })` and `grooph watch` with
 * no folder.
 */

import assert from "node:assert/strict";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import type { LiveView } from "@grooph/core";

import { ENDPOINT, LIVE_ENDPOINT, NO_RUN, findWebDist, startWatch } from "../src/commands/watch.js";
import { run, type CliEnv } from "../src/index.js";
import type { Output } from "../src/print.js";

const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("workspace root not found");
})();

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t) };
};
const text = (lines: string[]): string => lines.join("\n");
const grooph = (argv: string[], io = capture(), env: Partial<CliEnv> = {}) => run(argv, io, () => "", { openUrl: async () => {}, ...env });

/** A project with nothing recorded in it. `.grooph/` is there, so that this folder is the project and no folder above it is. */
function emptyProject(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "grooph-watch-test-")));
  mkdirSync(join(dir, ".grooph"));
  return dir;
}

/** Runs `body` from inside `dir`: `grooph watch` serves the project it is run in, and takes no folder. */
async function inFolder<T>(dir: string, body: () => Promise<T>): Promise<T> {
  const before = process.cwd();
  process.chdir(dir);
  try {
    return await body();
  } finally {
    process.chdir(before);
  }
}

/** A stand-in for the built app: enough to prove what is served and from where. */
function fakeDist(): string {
  const dist = mkdtempSync(join(tmpdir(), "grooph-dist-"));
  writeFileSync(join(dist, "index.html"), "<!doctype html><title>grooph</title>\n");
  mkdirSync(join(dist, "assets"));
  writeFileSync(join(dist, "assets", "app.js"), "console.log('grooph')\n");
  return dist;
}

type Reply = { status: number; headers: Record<string, string | string[] | undefined>; body: string };
function get(port: number, path: string, options: { host?: string; method?: string } = {}): Promise<Reply> {
  return new Promise((done, fail) => {
    const req = request({ host: "127.0.0.1", port, path, method: options.method ?? "GET", headers: { Host: options.host ?? `127.0.0.1:${port}` } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => done({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on("error", fail);
    req.end();
  });
}

async function watchUntilListening(argv: string[], env: NodeJS.ProcessEnv): Promise<{ io: Capture; code: number }> {
  const io = capture();
  const stop = new AbortController();
  const running = grooph(argv, io, { signal: stop.signal, env });
  for (let i = 0; i < 200 && !io.stdout.some((l) => l.startsWith("open http")) && io.stderr.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
  const url = io.stdout.find((l) => l.startsWith("open http"))?.slice("open ".length);
  if (url) {
    const port = Number(new URL(url).port);
    assert.equal((await get(port, LIVE_ENDPOINT)).status, 200);
  }
  stop.abort();
  return { io, code: await running };
}

// The product's half of "grooph watch prints where to look; with --host it warns that the network can read the run"
// (lab/test/runs.test.ts), with no run: the last line and the warning say the events and these sessions, and no more.
test("grooph watch prints where to look; with --host it warns that the network can read the sessions", async () => {
  const dir = emptyProject();
  const dist = fakeDist();
  try {
    const local = await inFolder(dir, () => watchUntilListening(["watch", "--port", "0"], { GROOPH_WEB_DIST: dist }));
    assert.equal(local.code, 0);
    assert.match(
      text(local.io.stdout),
      /^sessions: none recorded under .*\.grooph\/events\/ yet \(grooph hooks install records them\)\nopen http:\/\/127\.0\.0\.1:\d+\/grooph\/#\/live\nread-only: re-reads the events on every request and writes nothing\. Ctrl-C stops it\.\nstopped$/,
    );
    assert.deepEqual(local.io.stderr, []);
    assert.equal(local.io.stdout.at(-1), "stopped");

    const lan = await inFolder(dir, () => watchUntilListening(["watch", "--port", "0", "--host", "0.0.0.0"], { GROOPH_WEB_DIST: dist }));
    assert.equal(lan.code, 0);
    assert.match(text(lan.io.stderr), /warning: listening on 0\.0\.0\.0, so anyone on this network can read these sessions while watch runs; there is no password\./);

    const unbuilt = capture();
    assert.equal(await grooph(["watch", "--port", "0"], unbuilt, { env: { GROOPH_WEB_DIST: join(dist, "nope") }, signal: AbortSignal.abort() }), 1);
    assert.match(text(unbuilt.stderr), /the web app is not built/);
    const badPort = capture();
    assert.equal(await grooph(["watch", "--port", "http"], badPort), 1);
    assert.match(text(badPort.stderr), /--port must be a port number/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(dist, { recursive: true, force: true });
  }
});

// The product's half of "watch serves the sessions the event hook recorded: the project's own, more with --events, and
// the run's nodes as the hooks saw them" (lab/test/runs.test.ts), with no run: the bare address is the sessions', and
// the run's endpoint is not found.
test("watch serves the sessions the event hook recorded: the project's own, and more with --events", async () => {
  const dir = emptyProject();
  const dist = fakeDist();
  const eventsFixtures = join(repoRoot, "fixtures", "events");
  const other = mkdtempSync(join(tmpdir(), "grooph-watch-other-"));
  try {
    // No events yet: the bare address lands on the sessions, and they are an empty list. grooph follows no run.
    let watcher = await startWatch({ root: dir, webDist: dist, port: 0, host: "127.0.0.1" });
    try {
      assert.match(watcher.url, /^http:\/\/127\.0\.0\.1:\d+\/grooph\/#\/live$/);
      const bare = await get(watcher.port, "/");
      assert.equal(bare.status, 302);
      assert.equal(bare.headers["location"], "/grooph/#/live");
      // The run's endpoint says, as JSON, that no run is followed: the app's run view shows that reason, and not "there is no grooph watch here".
      const noRun = await get(watcher.port, ENDPOINT);
      assert.equal(noRun.status, 404);
      assert.match(String(noRun.headers["content-type"]), /^application\/json/);
      assert.deepEqual(JSON.parse(noRun.body), { error: NO_RUN });
      const empty = JSON.parse((await get(watcher.port, LIVE_ENDPOINT)).body) as LiveView;
      assert.equal(empty.groophLive, 0);
      assert.deepEqual(empty.sessions, []);

      // The hook writes while watch runs; the next request sees it. Nothing is cached.
      mkdirSync(join(dir, ".grooph", "events"), { recursive: true });
      copyFileSync(join(eventsFixtures, "claude-code-running.jsonl"), join(dir, ".grooph", "events", "s1.jsonl"));
      const one = JSON.parse((await get(watcher.port, LIVE_ENDPOINT)).body) as LiveView;
      assert.deepEqual(one.sessions.map((s) => [s.state, s.agents.map((a) => a.state)]), [["working", ["done", "running"]]]);
      assert.equal((await get(watcher.port, LIVE_ENDPOINT, { method: "POST" })).status, 405);
      assert.equal((await get(watcher.port, LIVE_ENDPOINT, { host: "evil.example:80" })).status, 421);
    } finally {
      await watcher.close();
    }

    // Several sessions' files merge, each under the name it was given.
    copyFileSync(join(eventsFixtures, "codex-two-subagents.jsonl"), join(other, "codex.jsonl"));
    watcher = await startWatch({ root: dir, webDist: dist, port: 0, host: "127.0.0.1", events: [{ name: "mac-codex", path: other }] });
    try {
      assert.match(watcher.url, /#\/live$/);
      const both = JSON.parse((await get(watcher.port, LIVE_ENDPOINT)).body) as LiveView;
      assert.deepEqual(both.sessions.map((s) => [s.source, s.harness]).sort(), [[undefined, "claude-code"], ["mac-codex", "codex"]]);
    } finally {
      await watcher.close();
    }

    // With --map, the operation map travels with the sessions, read again on each request; a source named for a map session is that session's.
    const mapFile = join(other, "ops.grooph-map.json");
    copyFileSync(join(repoRoot, "fixtures", "maps", "valid", "owner-operation-2026-09-30.grooph-map.json"), mapFile);
    watcher = await startWatch({ root: dir, webDist: dist, port: 0, host: "127.0.0.1", map: mapFile, events: [{ name: "codex", path: join(other, "codex.jsonl") }] });
    try {
      const withMap = JSON.parse((await get(watcher.port, LIVE_ENDPOINT)).body) as LiveView;
      assert.equal(withMap.map!.id, "ryans-operation-2026-09-30");
      assert.ok(withMap.sessions.some((s) => s.source === "codex"));
      writeFileSync(mapFile, "{ not json");
      assert.equal((JSON.parse((await get(watcher.port, LIVE_ENDPOINT)).body) as LiveView).map, undefined);
    } finally {
      await watcher.close();
    }
    const badMap = capture();
    assert.equal(await grooph(["watch", "--map", mapFile, "--port", "0"], badMap, { env: { GROOPH_WEB_DIST: dist }, signal: AbortSignal.abort() }), 1);
    assert.match(text(badMap.stderr), /--map .* is not an operation map grooph can read/);

    // Through the command, from a project's folder: the sessions it names with --events, and where to open them.
    const bare = emptyProject();
    try {
      const said = await inFolder(bare, () => watchUntilListening(["watch", "--port", "0", "--events", `lane-a=${other}`], { GROOPH_WEB_DIST: dist }));
      assert.match(text(said.io.stdout), /sessions: 1 recorded, 0 working \(codex · ended · 0 running, 2 done\)\nopen http:\/\/127\.0\.0\.1:\d+\/grooph\/#\/live/);
      const missing = capture();
      assert.equal(await grooph(["watch", "--events", join(bare, "nope")], missing), 1);
      assert.match(text(missing.stderr), /--events .*nope: no such file or folder/);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(dist, { recursive: true, force: true });
    rmSync(other, { recursive: true, force: true });
  }
});

test("watch finds the built app in this clone when there is one", () => {
  const dist = findWebDist({});
  if (!existsSync(join(repoRoot, "apps", "web", "dist", "index.html"))) return;
  assert.equal(dist, join(repoRoot, "apps", "web", "dist"));
});

test("in a project that has a run, grooph watch still follows none: the bare address is the sessions', and the run's endpoint says so", async () => {
  const dir = emptyProject();
  const dist = fakeDist();
  try {
    // The recorded run of slice 0007, placed as a package's run: what `grooph watch` opened on through 0.4.1.
    cpSync(join(repoRoot, "fixtures", "runs", "slice-0007-sandwich"), join(dir, ".grooph", "slice-0007-sandwich"), { recursive: true });
    const watcher = await startWatch({ root: dir, webDist: dist, port: 0, host: "127.0.0.1" });
    try {
      assert.match(watcher.url, /^http:\/\/127\.0\.0\.1:\d+\/grooph\/#\/live$/);
      assert.equal((await get(watcher.port, "/")).headers["location"], "/grooph/#/live");
      const noRun = await get(watcher.port, ENDPOINT);
      assert.equal(noRun.status, 404);
      assert.deepEqual(JSON.parse(noRun.body), { error: NO_RUN });
      assert.doesNotMatch(noRun.body, /20260919-0057-66c8|slice-0007-sandwich/);
    } finally {
      await watcher.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(dist, { recursive: true, force: true });
  }
});

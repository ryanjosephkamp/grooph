/**
 * `grooph runs | adopt | share <run dir> | watch` (docs/runs.md §3), on copies
 * of the run folders in fixtures/runs/: the real record of slice 0007's run
 * and the synthetic ones. `watch` is started on a free port against a copy
 * that the test appends to, and serves a stand-in app, so these tests do not
 * depend on the web build.
 */

import assert from "node:assert/strict";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { canonicalize, decodeSharePayload, parseGraphText, parseRunBundleText, sharePayloadFrom, summarizeRun, type Graph, type RunBundle } from "@grooph/core";

import { ENDPOINT, findWebDist, startWatch, watchTarget } from "../src/commands/watch.js";
import { run, type CliEnv } from "../src/index.js";
import type { Output } from "../src/print.js";
import { inflateRaw } from "../src/share-io.js";

const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("workspace root not found");
})();
const runsFixtures = join(repoRoot, "fixtures", "runs");
const REAL = "20260919-0057-66c8";

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t) };
};
const text = (lines: string[]): string => lines.join("\n");
const grooph = (argv: string[], io = capture(), env: Partial<CliEnv> = {}) => run(argv, io, () => "", { openUrl: async () => {}, ...env });

/** A project with `.grooph/<graph-id>/` copied from fixtures/runs/ for each graph named. */
function project(...graphs: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "grooph-runs-test-"));
  for (const graph of graphs) cpSync(join(runsFixtures, graph), join(dir, ".grooph", graph), { recursive: true });
  return dir;
}
const runDir = (dir: string, graph: string): string => {
  const runs = join(dir, ".grooph", graph, "runs");
  return join(runs, readdirSync(runs)[0]!);
};
const readGraph = (path: string): Graph => parseGraphText(readFileSync(path, "utf8")).doc!;

/** Every file under `dir` with its contents, to prove a command wrote nothing. */
function tree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else out[relative(dir, full)] = readFileSync(full, "utf8");
    }
  };
  walk(dir);
  return out;
}

// ─── runs list · show · bundle ────────────────────────────────────────────

test("runs list: every run under a project, newest first, with state, rounds and the last stop", async () => {
  const dir = project("slice-0007-sandwich", "run-gate", "run-nested");
  try {
    const io = capture();
    assert.equal(await grooph(["runs", "list", dir], io), 0);
    assert.deepEqual(io.stdout.map((l) => l.split(/\s{3,}/)), [
      ["RUN", "GRAPH", "STATE", "ROUNDS", "STOP"],
      ["20260919-1300-nest", "run-nested", "running", "grind 0 · phases 1", "grind: pass · phases: none fired"],
      ["20260919-1200-gate", "run-gate", "halted", "0", "bar passed"],
      [REAL, "slice-0007-sandwich", "ended · pass", "1", "bar passed"],
    ]);
    // A graph folder lists its own runs; an empty folder says there are none.
    const one = capture();
    await grooph(["runs", "list", join(dir, ".grooph", "run-gate")], one);
    assert.equal(one.stdout.length, 2);
    const none = capture();
    assert.equal(await grooph(["runs", "list", mkdtempSync(join(tmpdir(), "grooph-empty-"))], none), 0);
    assert.match(text(none.stdout), /^no runs under/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runs show: states, loops, the three changes tied to n-0002, the proposal, the timeline", async () => {
  const dir = project("slice-0007-sandwich");
  try {
    const io = capture();
    assert.equal(await grooph(["runs", "show", runDir(dir, "slice-0007-sandwich")], io), 0);
    const out = text(io.stdout);
    assert.match(out, /^Run 20260919-0057-66c8 · Slice 0007 sandwich \(slice-0007-sandwich\)\n  ended · pass · started 2026-09-19T04:57:20Z · ended 2026-09-19T05:38:15Z/);
    assert.match(out, /cost noted: 26 minutes · 31 turns/);
    assert.match(out, /builder {2}passed {3}2 runs · round 1 · last pass \(done\)/);
    assert.match(out, /sandwich {2}round 1 · bar passed fired \(n-0012\)/);
    assert.match(out, /Changed the graph's other limits \(constraints\.other\) {2}← n-0002\n {2}Changed the outputs of Builder \(builder\) {2}← n-0002\n {2}Changed the outputs of Critic \(critic\) {2}← n-0002/);
    assert.match(out, /n-0008 · edge:e-checks-critic · let the critic also read/);
    assert.match(out, /patch: 1 grooph op \(updateEdge\); grooph apply can replay it/);
    assert.equal(io.stdout.filter((l) => /^ {2}n-00\d\d {2}/.test(l)).length, 15);

    const json = capture();
    assert.equal(await grooph(["runs", "show", runDir(dir, "slice-0007-sandwich"), "--json"], json), 0);
    const data = JSON.parse(text(json.stdout));
    assert.equal(data.summary.state, "ended");
    assert.equal(data.exact, true);
    assert.deepEqual(data.changes.map((c: { op: { op: string }; explainedBy: string[] }) => [c.op.op, c.explainedBy]), [
      ["setConstraint", ["n-0002"]],
      ["updateNode", ["n-0002"]],
      ["updateNode", ["n-0002"]],
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runs show lists the lines it could not read; runs bundle writes the run as one file", async () => {
  const dir = project("run-malformed");
  try {
    const io = capture();
    assert.equal(await grooph(["runs", "show", runDir(dir, "run-malformed")], io), 0);
    assert.match(text(io.stdout), /Lines of notes\.jsonl that could not be read \(2\)\n {2}line 3: not JSON/);

    const out = join(dir, "bundle.grooph-run.json");
    const written = capture();
    assert.equal(await grooph(["runs", "bundle", runDir(dir, "run-malformed"), "--out", out], written), 0);
    assert.match(text(written.stdout), /^wrote .*bundle\.grooph-run\.json \(run 20260919-1000-bad1, 3 notes, \d+ KB\)/);
    const parsed = parseRunBundleText(readFileSync(out, "utf8"));
    assert.ok(parsed.bundle);
    assert.equal(parsed.bundle.run, "20260919-1000-bad1");
    assert.deepEqual(parsed.bundle.issues!.map((i) => i.line), [3, 4]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runs: a folder that is not a run, or no subcommand, is a usage error, not a crash", async () => {
  const bad = capture();
  assert.equal(await grooph(["runs", "show", join(runsFixtures, "nowhere")], bad), 1);
  assert.match(text(bad.stderr), /is not a folder/);
  const noWorking = mkdtempSync(join(tmpdir(), "grooph-norun-"));
  mkdirSync(join(noWorking, ".grooph", "g", "runs", "r1"), { recursive: true });
  writeFileSync(join(noWorking, ".grooph", "g", "runs", "r1", "notes.jsonl"), "");
  writeFileSync(join(noWorking, ".grooph", "g", "graph.grooph.json"), readFileSync(join(runsFixtures, "run-live", "graph.grooph.json")));
  const early = capture();
  assert.equal(await grooph(["runs", "show", join(noWorking, ".grooph", "g", "runs", "r1")], early), 1);
  assert.match(text(early.stderr), /does not exist yet: the lead writes the working copy at kickoff/);
  const usage = capture();
  assert.equal(await grooph(["runs"], usage), 1);
  assert.match(text(usage.stderr), /runs needs list, show or bundle/);
  const help = capture();
  assert.equal(await grooph(["runs", "--help"], help), 0);
  assert.match(text(help.stdout), /^grooph runs list/);
  rmSync(noWorking, { recursive: true, force: true });
});

// ─── adopt ────────────────────────────────────────────────────────────────

test("adopt shows the diff and writes nothing; --write makes version 2, the same in meaning as the driver's by hand", async () => {
  const dir = project("slice-0007-sandwich");
  try {
    const run = runDir(dir, "slice-0007-sandwich");
    const sourcePath = join(dir, ".grooph", "slice-0007-sandwich", "graph.grooph.json");
    const source = readFileSync(sourcePath, "utf8");
    const target = join(dir, ".grooph", "graphs", "slice-0007-sandwich.grooph.json");

    const dry = capture();
    assert.equal(await grooph(["adopt", run], dry), 0);
    assert.match(text(dry.stdout), /Changed the outputs of Critic \(critic\) {2}← n-0002/);
    assert.match(text(dry.stdout), /version 2 of slice-0007-sandwich, from slice-0007-sandwich@1 and run 20260919-0057-66c8, would go to .*graphs\/slice-0007-sandwich\.grooph\.json\ndry run: --write writes it/);
    assert.equal(existsSync(target), false);

    const io = capture();
    assert.equal(await grooph(["adopt", run, "--write"], io), 0);
    assert.match(text(io.stdout), /wrote .*slice-0007-sandwich\.grooph\.json \(version 2\); the source .* is unchanged/);
    assert.equal(readFileSync(sourcePath, "utf8"), source);
    const adopted = readGraph(target);
    const byHand = readGraph(join(runsFixtures, "slice-0007-sandwich.adopted-by-hand.grooph.json"));
    const aside = (g: Graph) => canonicalize({ ...g, description: undefined, lineage: { ...g.lineage, from: undefined } } as Graph);
    assert.equal(aside(adopted), aside(byHand));
    assert.equal(adopted.version, 2);
    assert.equal(adopted.lineage?.from, "slice-0007-sandwich@1");
    assert.equal(readFileSync(target, "utf8"), canonicalize(adopted), "written in canonical form");

    const again = capture();
    assert.equal(await grooph(["adopt", run, "--write"], again), 0);
    assert.match(text(again.stdout), /already holds exactly this version; nothing to do/);

    // Someone edits the adopted file: adopting over it is refused.
    writeFileSync(target, canonicalize({ ...adopted, description: "edited since" }));
    const over = capture();
    assert.equal(await grooph(["adopt", run, "--write"], over), 1);
    assert.match(text(over.stderr), /holds version 2, which is not the version 1 this run started from/);

    // --into writes elsewhere.
    const into = join(dir, "v2.grooph.json");
    assert.equal(await grooph(["adopt", run, "--into", into, "--write"], capture()), 0);
    assert.equal(readGraph(into).version, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("adopt --write is refused when the source moved on after the run started", async () => {
  const dir = project("slice-0007-sandwich");
  try {
    const sourcePath = join(dir, ".grooph", "slice-0007-sandwich", "graph.grooph.json");
    writeFileSync(sourcePath, canonicalize({ ...readGraph(sourcePath), version: 2 }));
    const io = capture();
    assert.equal(await grooph(["adopt", runDir(dir, "slice-0007-sandwich"), "--write"], io), 1);
    assert.match(text(io.stdout), /note: the source is version 2, but this run worked on version 1/);
    assert.match(text(io.stderr), /not written: this run worked on version 1, but the source is now version 2/);
    assert.equal(existsSync(join(dir, ".grooph", "graphs")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("adopt refuses a working copy with export errors, naming them", async () => {
  const dir = project("run-broken");
  try {
    const io = capture();
    assert.equal(await grooph(["adopt", runDir(dir, "run-broken"), "--write"], io), 1);
    assert.match(text(io.stdout), /Added agent node Docs writer \(docs\) {2}← n-0002/);
    assert.match(text(io.stdout), /not every change is a grooph op; adopting takes the working copy itself/);
    assert.match(text(io.stderr), /cannot adopt: The working copy has an error that blocks export, so it cannot become version 2 of run-broken/);
    assert.match(text(io.stderr), /E_DANGLING_REF/);
    assert.equal(existsSync(join(dir, ".grooph", "graphs")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ─── share <run dir> ──────────────────────────────────────────────────────

test("share <run dir> prints a kind run link that decodes to the bundle; --out writes the bundle", async () => {
  const dir = project("slice-0007-sandwich");
  try {
    const out = join(dir, "run.grooph-run.json");
    const io = capture();
    assert.equal(await grooph(["share", runDir(dir, "slice-0007-sandwich"), "--out", out], io), 0);
    assert.match(io.stdout[0]!, /^run 20260919-0057-66c8 · Slice 0007 sandwich \(slice-0007-sandwich\) · ended · pass$/);
    assert.match(io.stdout[1]!, /15 notes · 1 amendment · 1 proposal/);
    const link = io.stdout.filter((l) => l.startsWith("https://")).at(-1)!;
    assert.ok(link.length < 32_000, `link is ${link.length} characters`);
    const opened = decodeSharePayload(sharePayloadFrom(link)!, inflateRaw);
    assert.ok(opened.ok);
    assert.equal(opened.envelope.kind, "run");
    const bundle = opened.envelope.doc as RunBundle;
    assert.equal(bundle.run, REAL);
    assert.equal(bundle.notes.length, 15);
    assert.equal(summarizeRun(bundle.notes, bundle.working).state, "ended");
    assert.deepEqual(parseRunBundleText(readFileSync(out, "utf8")).bundle, bundle);

    // The bundle file shares the same way.
    const again = capture();
    assert.equal(await grooph(["share", out], again), 0);
    assert.equal(again.stdout.filter((l) => l.startsWith("https://")).at(-1), link);

    const notRun = capture();
    assert.equal(await grooph(["share", join(dir, ".grooph")], notRun), 1);
    assert.match(text(notRun.stderr), /is a folder but not a run folder/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ─── watch ────────────────────────────────────────────────────────────────

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

const line = (fields: Record<string, unknown>): string => `${JSON.stringify({ run: "20260919-1100-live", ...fields })}\n`;

test("watch serves the app and the run, re-read from disk on every request, and writes nothing", async () => {
  const dir = project("run-live");
  const dist = fakeDist();
  const run = runDir(dir, "run-live");
  const watcher = await startWatch({ target: watchTarget(run), webDist: dist, port: 0, host: "127.0.0.1" });
  try {
    assert.match(watcher.url, /^http:\/\/127\.0\.0\.1:\d+\/grooph\/#\/run\?live$/);
    const first = await get(watcher.port, ENDPOINT);
    assert.equal(first.status, 200);
    assert.equal(first.headers["cache-control"], "no-store");
    const before = parseRunBundleText(first.body).bundle!;
    assert.equal(summarizeRun(before.notes, before.working).nodes["critic"]!.state, "running");

    // The lead appends; the next request sees it.
    appendFileSync(join(run, "notes.jsonl"), line({ id: "n-0005", at: "node:critic", ended: "2026-09-19T11:12:00Z", outcome: "pass", verdict: "pass", round: 0 }));
    appendFileSync(join(run, "notes.jsonl"), line({ id: "n-0006", at: "loop:review-cycle", outcome: "pass", round: 0, text: "bar passed fires" }));
    const after = parseRunBundleText((await get(watcher.port, ENDPOINT)).body).bundle!;
    const summary = summarizeRun(after.notes, after.working);
    assert.equal(summary.nodes["critic"]!.state, "passed");
    assert.equal(summary.loops["review-cycle"]!.lastStop?.fired, "bar-passed");
    const snapshot = tree(dir);

    // The app, and nothing outside it.
    const index = await get(watcher.port, "/grooph/");
    assert.equal(index.status, 200);
    assert.match(index.headers["content-type"] as string, /^text\/html/);
    assert.equal((await get(watcher.port, "/grooph/assets/app.js")).headers["content-type"], "text/javascript; charset=utf-8");
    const root = await get(watcher.port, "/");
    assert.equal(root.status, 302);
    assert.equal(root.headers["location"], "/grooph/#/run?live");
    assert.equal((await get(watcher.port, "/grooph/%2e%2e/%2e%2e/etc/passwd")).status, 404);
    assert.equal((await get(watcher.port, "/grooph/..%2fpackage.json")).status, 404);
    assert.equal((await get(watcher.port, "/elsewhere")).status, 404);
    assert.equal((await get(watcher.port, ENDPOINT, { method: "POST" })).status, 405);
    assert.equal((await get(watcher.port, ENDPOINT, { method: "HEAD" })).status, 200);
    // Bound to this machine, it answers only to this machine's names (no DNS rebinding).
    assert.equal((await get(watcher.port, ENDPOINT, { host: "evil.example:80" })).status, 421);
    assert.equal((await get(watcher.port, ENDPOINT, { host: `localhost:${watcher.port}` })).status, 200);

    assert.deepEqual(tree(dir), snapshot, "serving wrote nothing");
  } finally {
    await watcher.close();
    rmSync(dir, { recursive: true, force: true });
    rmSync(dist, { recursive: true, force: true });
  }
});

test("watch on a graph folder follows the newest run, and says so while there is none", async () => {
  const dir = mkdtempSync(join(tmpdir(), "grooph-watch-graph-"));
  const dist = fakeDist();
  const graphDir = join(dir, ".grooph", "run-live");
  mkdirSync(graphDir, { recursive: true });
  cpSync(join(runsFixtures, "run-live", "graph.grooph.json"), join(graphDir, "graph.grooph.json"));
  const watcher = await startWatch({ target: watchTarget(graphDir), webDist: dist, port: 0, host: "127.0.0.1" });
  try {
    const empty = await get(watcher.port, ENDPOINT);
    assert.equal(empty.status, 404);
    assert.match(JSON.parse(empty.body).error, /no runs under .* yet/);

    cpSync(join(runsFixtures, "run-live", "runs"), join(graphDir, "runs"), { recursive: true });
    assert.equal(parseRunBundleText((await get(watcher.port, ENDPOINT)).body).bundle!.run, "20260919-1100-live");

    // A later run starts: the endpoint follows it.
    const next = join(graphDir, "runs", "20260919-1500-next");
    mkdirSync(next);
    cpSync(join(graphDir, "graph.grooph.json"), join(next, "graph.grooph.json"));
    writeFileSync(next + "/notes.jsonl", line({ id: "n-0001", run: "20260919-1500-next", at: "graph", started: "2026-09-19T15:00:00Z", text: "run started" }));
    assert.equal(parseRunBundleText((await get(watcher.port, ENDPOINT)).body).bundle!.run, "20260919-1500-next");
  } finally {
    await watcher.close();
    rmSync(dir, { recursive: true, force: true });
    rmSync(dist, { recursive: true, force: true });
  }
});

async function watchUntilListening(argv: string[], env: NodeJS.ProcessEnv): Promise<{ io: Capture; code: number }> {
  const io = capture();
  const stop = new AbortController();
  const running = grooph(argv, io, { signal: stop.signal, env });
  for (let i = 0; i < 200 && !io.stdout.some((l) => l.startsWith("open http")) && io.stderr.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
  const url = io.stdout.find((l) => l.startsWith("open http"))?.slice("open ".length);
  if (url) {
    const port = Number(new URL(url).port);
    assert.equal((await get(port, ENDPOINT)).status, 200);
  }
  stop.abort();
  return { io, code: await running };
}

test("grooph watch prints where to look; with --host it warns that the network can read the run", async () => {
  const dir = project("run-live");
  const dist = fakeDist();
  try {
    const local = await watchUntilListening(["watch", runDir(dir, "run-live"), "--port", "0"], { GROOPH_WEB_DIST: dist });
    assert.equal(local.code, 0);
    assert.match(text(local.io.stdout), /watching .*20260919-1100-live: running\nopen http:\/\/127\.0\.0\.1:\d+\/grooph\/#\/run\?live\nread-only/);
    assert.deepEqual(local.io.stderr, []);
    assert.equal(local.io.stdout.at(-1), "stopped");

    const lan = await watchUntilListening(["watch", join(dir, ".grooph", "run-live"), "--port", "0", "--host", "0.0.0.0"], { GROOPH_WEB_DIST: dist });
    assert.equal(lan.code, 0);
    assert.match(text(lan.io.stdout), /the newest run under .*run-live\/runs\/ \(now 20260919-1100-live\)/);
    assert.match(text(lan.io.stderr), /warning: listening on 0\.0\.0\.0, so anyone on this network can read this run while watch runs; there is no password\./);

    const unbuilt = capture();
    assert.equal(await grooph(["watch", runDir(dir, "run-live"), "--port", "0"], unbuilt, { env: { GROOPH_WEB_DIST: join(dist, "nope") }, signal: AbortSignal.abort() }), 1);
    assert.match(text(unbuilt.stderr), /the web app is not built/);
    const badPort = capture();
    assert.equal(await grooph(["watch", "--port", "http"], badPort), 1);
    assert.match(text(badPort.stderr), /--port must be a port number/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(dist, { recursive: true, force: true });
  }
});

test("watch tells a run folder from a graph folder, even a graph folder inside a folder named runs", () => {
  assert.equal(watchTarget(join(runsFixtures, "run-live")).kind, "graph");
  assert.equal(watchTarget(join(runsFixtures, "run-live", "runs", "20260919-1100-live")).kind, "run");
  assert.equal(watchTarget(runsFixtures).kind, "project");
});

test("watch finds the built app in this clone when there is one", () => {
  const dist = findWebDist({});
  if (!existsSync(join(repoRoot, "apps", "web", "dist", "index.html"))) return;
  assert.equal(dist, join(repoRoot, "apps", "web", "dist"));
});

/**
 * `grooph embed` (slice 0056, docs/exports.md "Embedding"). The frame's address
 * is decoded with core's own decoder and this package's zlib codec, so what is
 * asserted is what the app will receive. The browser half (the printed address
 * opens and shows the graph's name) is apps/web/e2e/embed.spec.ts.
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { PICTURE_THEMES, buildRunBundle, canonicalizeRunBundle, decodeSharePayload, parseGraphText, SHARE_BASE } from "@grooph/core";

import { EMBED_HELP, embedCommand, embedSrc, resizeScript, type EmbedFlags } from "../src/commands/embed.js";
import type { Output } from "../src/print.js";
import { inflateRaw } from "../src/share-io.js";

const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!readdirHas(dir, "pnpm-workspace.yaml")) dir = dirname(dir);
  return dir;
})();
function readdirHas(dir: string, name: string): boolean {
  try {
    readFileSync(join(dir, name));
    return true;
  } catch {
    return false;
  }
}

const reviewLoop = join(repoRoot, "fixtures/valid/review-loop.grooph.json");
const sampleMap = join(repoRoot, "fixtures/maps/valid/two-sessions.grooph-map.json");
const noGoal = join(repoRoot, "fixtures/invalid/E_NO_GOAL/no-goal.grooph.json");

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t) };
};

function embed(file: string, flags: EmbedFlags = {}) {
  const io = capture();
  const code = embedCommand(io, file, flags);
  const frame = io.stdout[0] ?? "";
  const src = (/ src="([^"]+)"/.exec(frame)?.[1] ?? "").replace(/&amp;/g, "&");
  const payload = /#\/embed\?d=([A-Za-z0-9_-]+)/.exec(src)?.[1] ?? "";
  return { io, code, frame, src, payload, height: Number(/ height="(\d+)"/.exec(frame)?.[1]) };
}

const withScratch = (fn: (dir: string) => void): void => {
  const dir = mkdtempSync(join(tmpdir(), "grooph-embed-test-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("a graph prints two lines: the frame, then the script that sizes it", () => {
  const { io, code, frame, src } = embed(reviewLoop);
  assert.equal(code, 0);
  assert.equal(io.stdout.length, 2);
  assert.deepEqual(io.stderr, []);
  assert.match(frame, /^<iframe src="https:\/\/ryanjosephkamp\.github\.io\/grooph\/#\/embed\?d=[A-Za-z0-9_-]+" title="Review loop, a grooph picture" width="100%" height="\d+" .*data-grooph-embed><\/iframe>$/);
  assert.ok(src.startsWith(`${SHARE_BASE}#/embed?d=`));
  assert.match(frame, /referrerpolicy="no-referrer"/);
  assert.match(io.stdout[1]!, /^<script>.*<\/script>$/);
});

test("the frame carries an ordinary share payload: the same bytes open in the app at #/open", () => {
  const { payload } = embed(reviewLoop);
  const opened = decodeSharePayload(payload, inflateRaw);
  assert.ok(opened.ok);
  assert.equal(opened.envelope.kind, "graph");
  assert.equal(opened.envelope.doc.name, "Review loop");
  const original = parseGraphText(readFileSync(reviewLoop, "utf8")).doc!;
  assert.deepEqual(opened.envelope.doc.nodes, original.nodes);
  assert.deepEqual(opened.envelope.doc.loops, original.loops);
});

test("--theme, --frame, --play and --base ride after the payload; --height sets the frame's height", () => {
  const { src, height, io } = embed(reviewLoop, { theme: "dark", frame: true, play: true, height: 520, base: "http://localhost:4173/grooph/" });
  assert.match(src, /^http:\/\/localhost:4173\/grooph\/#\/embed\?d=[A-Za-z0-9_-]+&theme=dark&frame=1&play=1$/);
  assert.equal(height, 520);
  assert.match(io.stdout[1]!, /"http:\/\/localhost:4173"/);
});

test("without --height the frame is as tall as the picture at a phone's width, with its bars", () => {
  const graph = embed(reviewLoop).height;
  assert.ok(graph > 300 && graph < 1600, `height ${graph}`);
  withScratch((dir) => {
    const runDir = join(repoRoot, "fixtures/runs/run-gate/runs/20260919-1200-gate");
    const source = parseGraphText(readFileSync(join(repoRoot, "fixtures/runs/run-gate/graph.grooph.json"), "utf8")).doc!;
    const working = parseGraphText(readFileSync(join(runDir, "graph.grooph.json"), "utf8")).doc!;
    const file = join(dir, "gate.grooph-run.json");
    writeFileSync(file, canonicalizeRunBundle(buildRunBundle({ source, working, notesText: readFileSync(join(runDir, "notes.jsonl"), "utf8") })));
    const run = embed(file);
    assert.equal(run.code, 0);
    const opened = decodeSharePayload(run.payload, inflateRaw);
    assert.ok(opened.ok && opened.envelope.kind === "run");
    assert.match(run.frame, /title="[^"]+ \(a run\), a grooph picture"/);
    assert.ok(run.height > 300, "a run's frame has room for the replay");
  });
});

test("a run folder and an operation map embed too", () => {
  const folder = embed(join(repoRoot, "fixtures/runs/run-gate/runs/20260919-1200-gate"));
  assert.equal(folder.code, 0);
  assert.equal((decodeSharePayload(folder.payload, inflateRaw) as { envelope: { kind: string } }).envelope.kind, "run");
  const map = embed(sampleMap);
  assert.equal(map.code, 0);
  assert.equal((decodeSharePayload(map.payload, inflateRaw) as { envelope: { kind: string } }).envelope.kind, "map");
});

test("a graph with errors, a bad height and a bad base are refused with a line that says why", () => {
  const broken = embed(noGoal);
  assert.equal(broken.code, 1);
  assert.deepEqual(broken.io.stdout, []);
  assert.match(broken.io.stderr.join("\n"), /cannot embed .*fix these first\n.*E_NO_GOAL/);
  const tall = embed(reviewLoop, { height: 50 });
  assert.equal(tall.code, 1);
  assert.match(tall.io.stderr[0]!, /^grooph: --height takes a whole number of pixels from 120 to 4000/);
  const base = embed(reviewLoop, { base: "not a url" });
  assert.equal(base.code, 1);
  assert.match(base.io.stderr[0]!, /^grooph: --base takes/);
  assert.equal(embed(join(repoRoot, "fixtures/does-not-exist.grooph.json")).code, 1);
});

test("the script sizes only grooph frames, only from the app's origin, only to a sane height", () => {
  const frames = [
    { contentWindow: "frame-a", style: { height: "" } },
    { contentWindow: "frame-b", style: { height: "" } },
  ];
  let listener: ((e: unknown) => void) | undefined;
  runInNewContext(resizeScript().replace(/^<script>|<\/script>$/g, ""), {
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      if (type === "message") listener = fn;
    },
    document: { querySelectorAll: (sel: string) => (sel === "iframe[data-grooph-embed]" ? frames : []) },
    Math,
  });
  assert.ok(listener);
  listener!({ origin: "https://ryanjosephkamp.github.io", source: "frame-b", data: { grooph: "embed-height", height: 612 } });
  assert.deepEqual(frames.map((f) => f.style.height), ["", "612px"]);
  listener!({ origin: "https://evil.example", source: "frame-a", data: { grooph: "embed-height", height: 50 } });
  listener!({ origin: "https://ryanjosephkamp.github.io", source: "frame-a", data: { grooph: "something-else", height: 50 } });
  listener!({ origin: "https://ryanjosephkamp.github.io", source: "frame-a", data: { grooph: "embed-height", height: "<b>" } });
  assert.equal(frames[0]!.style.height, "");
  listener!({ origin: "https://ryanjosephkamp.github.io", source: "frame-a", data: { grooph: "embed-height", height: 99999 } });
  assert.equal(frames[0]!.style.height, "4000px");
});

test("embedSrc and the help agree on the address's shape", () => {
  assert.equal(embedSrc("abc", {}), `${SHARE_BASE}#/embed?d=abc`);
  assert.equal(embedSrc("abc", { theme: "light", base: "http://localhost:5173/grooph" }), "http://localhost:5173/grooph/#/embed?d=abc&theme=light");
  assert.match(EMBED_HELP, /^grooph embed <file> \[--theme <name>\] \[--height <px>\]/);
  // A theme by name, light or dark, or both.
  assert.equal(embedSrc("abc", { theme: "blueprint" }), `${SHARE_BASE}#/embed?d=abc&theme=blueprint`);
  assert.equal(embedSrc("abc", { theme: "chalk-dark", frame: true }), `${SHARE_BASE}#/embed?d=abc&theme=chalk-dark&frame=1`);
  for (const name of PICTURE_THEMES) assert.ok(EMBED_HELP.includes(name), `the help names ${name}`);
  assert.ok(EMBED_HELP.split("\n").every((line) => line.length <= 100), "help lines fit a terminal");
});

/**
 * Operation maps at the command line (docs/operation-map.md; amendment A-011):
 * `validate`, `canonicalize`, `shape`, `image` and `share` know a map from a
 * graph by its `groophMap` key, and a graph command given a map says so.
 */

import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { decodeSharePayload, mapPicture, parseMapText, sharePayloadFrom } from "@grooph/core";

import { run } from "../src/index.js";
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

const maps = join(repoRoot, "fixtures", "maps");
const sample = join(maps, "valid", "owner-operation-2026-09-30.grooph-map.json");
const reviewLoop = join(repoRoot, "fixtures", "valid", "review-loop.grooph.json");

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t) };
};
const text = (lines: string[]): string => lines.join("\n");
const grooph = (argv: string[], io = capture()) => run(argv, io, () => "", { openUrl: async () => {} });

const withScratch = async (fn: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), "grooph-map-test-"));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("validate checks a map against the map's rules: the sample is clean, a handoff with no carrier is an error", async () => {
  let io = capture();
  assert.equal(await grooph(["validate", sample], io), 0);
  assert.match(text(io.stdout), /3 lanes · 7 sessions \(18 counting families\) · 10 handoffs, 2 carried by a person/);
  assert.match(text(io.stdout), /no issues/);

  io = capture();
  assert.equal(await grooph(["validate", join(maps, "invalid", "E_HANDOFF_NO_CARRIER", "no-carrier.grooph-map.json")], io), 1);
  assert.match(text(io.stderr), /error {2}E_HANDOFF_NO_CARRIER {2}handoff "h-plan" \("planner" → "builder"\) names no carrier/);
  assert.match(text(io.stderr), /1 error, 0 warnings/);

  io = capture();
  assert.equal(await grooph(["validate", join(maps, "invalid", "W_CARRIER_CANNOT_CROSS", "session-message-across-harnesses.grooph-map.json"), "--json"], io), 0);
  const report = JSON.parse(text(io.stdout)) as { ok: boolean; kind: string; issues: { code: string }[] };
  assert.equal(report.kind, "map");
  assert.equal(report.ok, true);
  assert.deepEqual(report.issues.map((i) => i.code), ["W_CARRIER_CANNOT_CROSS"]);
});

test("validate looks a session's graph pointer up beside the map: found is quiet, missing or not a graph is a warning, a URL is not checked", async () => {
  await withScratch(async (dir) => {
    const map = parseMapText(readFileSync(join(maps, "valid", "two-sessions.grooph-map.json"), "utf8")).map!;
    copyFileSync(reviewLoop, join(dir, "review-loop.grooph.json"));
    writeFileSync(join(dir, "notes.json"), "{}");
    const check = async (graph: string): Promise<Capture & { code: number }> => {
      const file = join(dir, "ops.grooph-map.json");
      writeFileSync(file, JSON.stringify({ ...map, sessions: map.sessions.map((s) => (s.id === "builder" ? { ...s, graph } : s)) }));
      const io = capture();
      return Object.assign(io, { code: await grooph(["validate", file], io) });
    };
    let io = await check("review-loop.grooph.json");
    assert.equal(io.code, 0);
    assert.match(text(io.stdout), /no issues/);
    io = await check("gone.grooph.json");
    assert.match(text(io.stdout), /W_GRAPH_UNRESOLVED {2}session "builder" points at graph "gone\.grooph\.json"/);
    io = await check("notes.json");
    assert.match(text(io.stdout), /W_GRAPH_UNRESOLVED/);
    for (const unchecked of ["https://example.com/a.grooph.json", "review-loop@2"]) {
      io = await check(unchecked);
      assert.match(text(io.stdout), /no issues/, unchecked);
    }
  });
});

test("canonicalize and shape take a map; the sample is already canonical", async () => {
  await withScratch(async (dir) => {
    const file = join(dir, "ops.grooph-map.json");
    const canonical = readFileSync(sample, "utf8");
    writeFileSync(file, JSON.stringify(JSON.parse(canonical)));
    let io = capture();
    assert.equal(await grooph(["canonicalize", file, "--write"], io), 0);
    assert.equal(readFileSync(file, "utf8"), canonical);
    io = capture();
    assert.equal(await grooph(["canonicalize", file, "--write"], io), 0);
    assert.match(text(io.stdout), /already canonical/);
  });
  let io = capture();
  assert.equal(await grooph(["shape", sample], io), 0);
  assert.equal(text(io.stdout), "ryans-operation-2026-09-30: 3 lanes · 7 sessions (18 counting families) · 10 handoffs, 2 carried by a person");
  io = capture();
  assert.equal(await grooph(["shape", sample, "--json"], io), 0);
  assert.equal((JSON.parse(text(io.stdout)) as { crossLane: number }).crossLane, 4);
});

test("image prints the picture core draws, byte for byte, or writes it; themes are light, dark and auto", async () => {
  const map = parseMapText(readFileSync(sample, "utf8")).map!;
  let io = capture();
  assert.equal(await grooph(["image", sample, "--theme", "light"], io), 0);
  assert.equal(`${text(io.stdout)}\n`, mapPicture(map, { theme: "light" }));
  io = capture();
  assert.equal(await grooph(["image", sample], io), 0);
  assert.equal(`${text(io.stdout)}\n`, mapPicture(map, { theme: "auto" }));

  await withScratch(async (dir) => {
    const out = join(dir, "pictures", "ops.dark.svg");
    io = capture();
    assert.equal(await grooph(["image", sample, "--theme", "dark", "--out", out], io), 0);
    assert.equal(readFileSync(out, "utf8"), readFileSync(join(maps, "pictures", "ryans-operation-2026-09-30.dark.svg"), "utf8"));
    io = capture();
    assert.equal(await grooph(["image", sample, "--out", join(dir, "ops.jpg")], io), 1);
    assert.match(text(io.stderr), /image writes an SVG or a PNG/);
  });

  io = capture();
  assert.equal(await grooph(["image", sample, "--theme", "sepia"], io), 1);
  assert.match(text(io.stderr), /--theme is light, dark or auto/);
  io = capture();
  assert.equal(await grooph(["image", "--help"], io), 0);
  assert.match(text(io.stdout), /^grooph image <graph \| operation map>/);
});

test("share makes a link that opens to the same map, rule errors and all, and --out writes the canonical file", async () => {
  let io = capture();
  assert.equal(await grooph(["share", sample], io), 0);
  const link = io.stdout.filter((line) => /^https?:\/\//.test(line)).at(-1)!;
  const opened = decodeSharePayload(sharePayloadFrom(link)!, inflateRaw);
  assert.ok(opened.ok && opened.envelope.kind === "map");
  if (opened.ok && opened.envelope.kind === "map") {
    assert.equal(opened.envelope.doc.id, "ryans-operation-2026-09-30");
    assert.deepEqual(opened.issues, []);
  }

  // A map is never compiled, so one with a rule error still shares; the link carries it and the view names it.
  io = capture();
  assert.equal(await grooph(["share", join(maps, "invalid", "E_HANDOFF_NO_CARRIER", "no-carrier.grooph-map.json")], io), 0);
  assert.match(text(io.stdout), /E_HANDOFF_NO_CARRIER/);
  const broken = decodeSharePayload(sharePayloadFrom(io.stdout.filter((line) => /^https?:\/\//.test(line)).at(-1)!)!, inflateRaw);
  assert.ok(broken.ok && broken.issues.some((i) => i.code === "E_HANDOFF_NO_CARRIER"));

  // One that is not a map at all does not.
  io = capture();
  assert.equal(await grooph(["share", join(maps, "invalid", "E_SCHEMA", "session-without-harness.grooph-map.json")], io), 1);
  assert.match(text(io.stderr), /is not an operation map grooph can read/);

  await withScratch(async (dir) => {
    const out = join(dir, "copy.grooph-map.json");
    io = capture();
    assert.equal(await grooph(["share", sample, "--out", out], io), 0);
    assert.equal(readFileSync(out, "utf8"), readFileSync(sample, "utf8"));
  });
});

test("a graph command given a map says what it is; export never takes one", async () => {
  const io = capture();
  assert.equal(await grooph(["export", sample, "--target", "claude-code", "--into", tmpdir()], io), 1);
  assert.match(text(io.stderr), /operation map/);
  assert.match(text(io.stderr), /never compiled/);
});

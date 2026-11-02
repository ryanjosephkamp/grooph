/**
 * `grooph import`: Mermaid text into a graph document, from a file, a Markdown note or stdin; what was guessed on
 * stderr; a refusal that says what it met.
 */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { canonicalize, mermaid, mermaidAgentflow, parseGraphText, type Graph } from "@grooph/core";

import { run } from "../src/index.js";
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
const grooph = (argv: string[], io: Capture, stdin = "") => run(argv, io, () => stdin, { openUrl: async () => undefined });
const pattern = (id: string): Graph => parseGraphText(readFileSync(join(repoRoot, "patterns", `${id}.grooph.json`), "utf8")).doc!;

const withScratch = async (fn: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), "grooph-import-test-"));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("import reads grooph's own Mermaid back into the graph's nodes, edges and loops, and writes it with --out", async () => {
  await withScratch(async (dir) => {
    const doc = pattern("review-gate");
    writeFileSync(join(dir, "review.mmd"), mermaid(doc));
    let io = capture();
    assert.equal(await grooph(["import", join(dir, "review.mmd")], io), 0);
    const back = parseGraphText(io.stdout.join("\n")).doc!;
    assert.equal(back.id, "review-gate");
    assert.deepEqual(back.nodes.map((n) => [n.id, n.kind]), doc.nodes.map((n) => [n.id, n.kind]));
    assert.deepEqual(back.loops.map((l) => [l.id, l.name, l.stops]), doc.loops.map((l) => [l.id, l.name, l.stops]));
    assert.ok(io.stderr.length > 0 && io.stderr.every((line) => line.startsWith("guessed: ")), "each guess on stderr, one per line");
    assert.ok(io.stderr.includes('guessed: Merge approval: a trapezoid, so a human gate asking "Approve: Merge approval?"'));

    io = capture();
    assert.equal(await grooph(["import", join(dir, "review.mmd"), "--out", join(dir, "review.grooph.json")], io), 0);
    assert.deepEqual(io.stdout, [`wrote ${join(dir, "review.grooph.json")}`]);
    assert.equal(readFileSync(join(dir, "review.grooph.json"), "utf8"), canonicalize(back));
  });
});

test("import reads stdin with -, an agentflow, a Markdown note's mermaid block, and names the graph from the file or --name", async () => {
  await withScratch(async (dir) => {
    let io = capture();
    assert.equal(await grooph(["import", "-"], io, mermaidAgentflow(pattern("review-gate"))), 0);
    const flow = parseGraphText(io.stdout.join("\n")).doc!;
    assert.equal(flow.goal, pattern("review-gate").goal);
    assert.deepEqual(flow.nodes.find((n) => n.id === "critic"), { ...flow.nodes.find((n) => n.id === "critic")!, kind: "agent", role: "critic" });

    writeFileSync(join(dir, "Release flow.md"), "# Notes\n\nThe flow:\n\n```mermaid\nflowchart LR\n  A[Draft] --> B{Review}\n  B -->|fail| A\n```\n\nMore notes.\n");
    io = capture();
    assert.equal(await grooph(["import", join(dir, "Release flow.md")], io), 0);
    const note = parseGraphText(io.stdout.join("\n")).doc!;
    assert.equal(note.name, "Release flow");
    assert.equal(note.id, "release-flow");
    assert.equal(note.loops.length, 1);
    assert.ok(io.stderr.includes("guessed: Draft loop: the cycle through Draft, Review, so a loop with no stops; grooph validate --loops says what it lacks"));

    io = capture();
    assert.equal(await grooph(["import", "-", "--name", "Named here"], io, "graph TD\n  a --> b"), 0);
    assert.equal(parseGraphText(io.stdout.join("\n")).doc!.name, "Named here");
  });
});

test("import refuses what it does not read, saying what it met and where, and exits 1", async () => {
  let io = capture();
  assert.equal(await grooph(["import", "-"], io, "sequenceDiagram\n  A->>B: hello"), 1);
  assert.deepEqual(io.stdout, []);
  assert.match(io.stderr.join("\n"), /^grooph: the text on stdin is not Mermaid grooph reads: this is not a diagram grooph reads: it starts with "sequenceDiagram"\. grooph reads flowchart, graph and agentflow-beta text: .* \(line 1\)$/);
  io = capture();
  assert.equal(await grooph(["import"], io), 1);
  assert.match(io.stderr.join("\n"), /import needs a file/);
  io = capture();
  assert.equal(await grooph(["import", "--help"], io), 0);
  assert.match(io.stdout.join("\n"), /^grooph import <file\.mmd \| -> \[--name <name>\] \[--out <graph file>\]/);
  assert.match(io.stdout.join("\n"), /grooph validate --loops says what each loop/);
});

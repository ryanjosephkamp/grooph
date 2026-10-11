/**
 * The graph a package keeps, from grooph's side: which folders under `.grooph` hold no package, and that no command
 * of grooph's writes a kept graph. These are the two tests of this file that need no `export`. The rest, `grooph
 * export` over a package in place held to the brakes of the graph that package keeps, moved to
 * lab/test/export-brakes.test.ts when `export` left this command line for the lab's (slice 0103).
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { canonicalize, type Graph } from "@grooph/core";

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
const fixture = (name: string): Graph => JSON.parse(readFileSync(join(repoRoot, "fixtures", "valid", `${name}.grooph.json`), "utf8")) as Graph;
const LF = String.fromCharCode(10);

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t) };
};
/** Run the command; what it printed on each stream, and its exit code. */
const grooph = async (argv: string[], stdin = ""): Promise<{ code: number; out: string; err: string }> => {
  const io = capture();
  const code = await run(argv, io, () => stdin, { env: {} });
  return { code, out: io.stdout.join(LF), err: io.stderr.join(LF) };
};

/** A folder for graph files and a project beside it, gone afterwards. */
const withProject = async (fn: (project: string, files: string) => Promise<void>): Promise<void> => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "grooph-export-brakes-")));
  const project = join(root, "project");
  const files = join(root, "files");
  mkdirSync(project);
  mkdirSync(files);
  try {
    await fn(project, files);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};
/** Every file under a folder with what it holds: the same string when nothing changed. */
const tree = (dir: string): string =>
  JSON.stringify(
    (readdirSync(dir, { recursive: true }) as string[])
      .map(String)
      .sort()
      .map((name) => {
        try {
          return [name, readFileSync(join(dir, name), "utf8")];
        } catch {
          return [name];
        }
      }),
  );
const put = (file: string, doc: unknown): string => {
  writeFileSync(file, JSON.stringify(doc, null, 2));
  return file;
};
const capOf = (file: string): number | undefined => (JSON.parse(readFileSync(file, "utf8")) as Graph).loops[0]!.stops.find((stop) => stop.kind === "max-iterations")?.n;

test("the folders that hold no package are the ones core keeps for something else", async () => {
  const core = await import("@grooph/core");
  const { NOT_A_PACKAGE } = await import("../src/io.js");
  for (const name of [...NOT_A_PACKAGE, "review-loop", "runs", "graph", "packages", "kept"]) assert.equal(NOT_A_PACKAGE.includes(name), core.keptFolder(name) !== undefined, name);
});

// The product's half of "no command of grooph's but export writes the graph a package keeps: …" (lab/test/export-brakes.test.ts,
// where export places the package). Here the kept graph is put where a package keeps one, by hand: grooph knows the file
// by where it is, and places no package itself.
test("no command of grooph's writes the graph a package keeps: by its path, through a link, in another letter case, in either output mode", async () => {
  const graph = fixture("review-loop");
  const raise = JSON.stringify([{ op: "setStop", loop: "review-cycle", index: graph.loops[0]!.stops.findIndex((stop) => stop.kind === "max-iterations"), stop: { kind: "max-iterations", n: 50 } }]);
  await withProject(async (project, files) => {
    mkdirSync(join(project, ".grooph", "review-loop"), { recursive: true });
    const kept = join(project, ".grooph", "review-loop", "graph.grooph.json");
    writeFileSync(kept, canonicalize(graph));
    const before = tree(project);
    symlinkSync(kept, join(files, "k.grooph.json"));
    symlinkSync(join(project, ".grooph", "review-loop"), join(files, "pkg"));
    const upper = join(project, ".GROOPH", "REVIEW-LOOP", "GRAPH.GROOPH.JSON");
    const spellings = [kept, join(files, "k.grooph.json"), join(files, "pkg", "graph.grooph.json"), ...(existsSync(upper) ? [upper] : [])];
    for (const path of spellings) {
      for (const args of [["apply", path, "--ops", "-", "--write"], ["apply", path, "--ops", "-", "--write", "--json"], ["canonicalize", path, "--write"]]) {
        const r = await grooph(args, raise);
        // (A kept graph is in canonical form already, so canonicalize has nothing to write and says so.)
        if (args[0] === "canonicalize" && r.code === 0) assert.match(r.out, /is already canonical/);
        else {
          assert.equal(r.code, 1, `${args.join(" ")}: ${r.out}`);
          assert.match(`${r.err}${r.out}`, /is the graph a package keeps\. No command of grooph's writes it: what placed the package compares the next graph with it/, args.join(" "));
        }
        assert.equal(tree(project), before, args.join(" "));
      }
    }
    // A dry run is still a look; a graph in a folder grooph keeps for graphs, and a run's working copy, are written as ever.
    assert.equal((await grooph(["apply", kept, "--ops", "-"], raise)).code, 0);
    mkdirSync(join(project, ".grooph", "graphs"), { recursive: true });
    const own = put(join(project, ".grooph", "graphs", "graph.grooph.json"), graph);
    assert.equal((await grooph(["apply", own, "--ops", "-", "--write"], raise)).code, 0);
    mkdirSync(join(project, ".grooph", "review-loop", "runs", "r1"), { recursive: true });
    const working = put(join(project, ".grooph", "review-loop", "runs", "r1", "graph.grooph.json"), graph);
    assert.equal((await grooph(["apply", working, "--ops", "-", "--write"], raise)).code, 0);
    assert.equal(capOf(kept), 4);
  });
});

/**
 * What left grooph's command line for the lab's (decision 0032; slice 0103, pull request 2), held from this side:
 * `export`, `adopt` and `runs` answer with one line and do nothing; `watch`, `share` and `embed` read no run folder;
 * no page, overview line, suggestion or `next:` line names what left; and the files that held it are not in this
 * package's source. Each test fails if the thing comes back. What these commands do in the lab is in lab/test/.
 */

import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { buildRunBundle, canonicalizeRunBundle, decodeSharePayload, parseGraphText, sharePayloadFrom } from "@grooph/core";

import { GONE, WATCH_GONE, gone } from "../src/commands/help.js";
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
const reviewLoop = join(repoRoot, "fixtures", "valid", "review-loop.grooph.json");
const clean = join(repoRoot, "fixtures", "valid", "fix-until-green.grooph.json");
const csvSet = join(repoRoot, "fixtures", "proposals", "valid", "csv-export", "csv-export.grooph-proposals.json");
const REAL = "20260919-0057-66c8";

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (isTTY?: boolean): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t), ...(isTTY !== undefined ? { isTTY } : {}) };
};
/** The command, with a browser that is never the machine's: one opened here is a failure of the test that asked. */
const opened: string[] = [];
const grooph = (argv: string[], io = capture(), env: Partial<CliEnv> = {}) =>
  run(argv, io, () => "", {
    openUrl: async (url) => {
      opened.push(url);
    },
    ...env,
  });

/** A project with the real record of slice 0007's run in it, as a package keeps it: `.grooph/<graph id>/runs/<run id>/`. */
function projectWithARun(): { dir: string; graphDir: string; runDir: string } {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "grooph-gone-")));
  const graphDir = join(dir, ".grooph", "slice-0007-sandwich");
  cpSync(join(repoRoot, "fixtures", "runs", "slice-0007-sandwich"), graphDir, { recursive: true });
  return { dir, graphDir, runDir: join(graphDir, "runs", REAL) };
}

/** Every file and folder under `dir`, with each file's contents: the same when a command wrote nothing. */
function tree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) {
        out[`${relative(dir, full)}/`] = "";
        walk(full);
      } else out[relative(dir, full)] = readFileSync(full, "utf8");
    }
  };
  walk(dir);
  return out;
}

/** The word `export` standing as a command's name: not inside an id such as csv-export, nor a flag such as --for-export. */
const NAMES_EXPORT = /(?<![\w-])export(?![\w-])/;

test("export, adopt and runs answer with one line that says where they went, exit 1, and do nothing: asked for, asked about, or asked for their page", async () => {
  assert.deepEqual([...GONE], ["export", "adopt", "runs"]);
  const { dir, runDir } = projectWithARun();
  try {
    const into = join(dir, "pkg");
    const bundle = join(dir, "run.grooph-run.json");
    // What each was asked to do through 0.4.1, with arguments that did it then: a package placed, a version written, a run listed, shown and bundled.
    const asked: Record<string, string[][]> = {
      export: [["export", reviewLoop, "--target", "claude-code", "--into", into], ["export", reviewLoop, "--target", "codex", "--into", into, "--uncompared"], ["export"]],
      adopt: [["adopt", runDir], ["adopt", runDir, "--write"], ["adopt", runDir, "--write", "--into", join(dir, "v2.grooph.json")], ["adopt"]],
      runs: [["runs", "list", dir], ["runs", "show", runDir], ["runs", "show", runDir, "--json"], ["runs", "bundle", runDir, "--out", bundle], ["runs"]],
    };
    const before = tree(dir);
    for (const name of GONE) {
      const line = gone(name);
      // The line is one line, says the command is no longer grooph's, and names where it is kept.
      assert.ok(!line.includes("\n") && line.startsWith(`grooph: ${name} is no longer part of grooph`) && line.includes(`grooph-lab ${name}`), line);
      for (const argv of [...asked[name]!, ["help", name], [name, "--help"], [name, "-h"]]) {
        for (const isTTY of [false, true]) {
          const io = capture(isTTY);
          assert.equal(await grooph(argv, io), 1, argv.join(" "));
          assert.deepEqual(io.stderr, [line], argv.join(" "));
          assert.deepEqual(io.stdout, [], argv.join(" "));
        }
      }
    }
    assert.deepEqual(tree(dir), before, "something was written");
    assert.equal(existsSync(into), false, "export made the folder it was given");
    assert.equal(existsSync(bundle), false, "runs bundle wrote the file it was given");
    assert.equal(existsSync(join(dir, ".grooph", "graphs")), false, "adopt wrote a version");
    assert.equal(existsSync(join(dir, "v2.grooph.json")), false, "adopt wrote where --into said");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("watch given a folder says that following a run has left, exits 1, and starts no server: a run folder, a graph's folder, a project", async () => {
  const { dir, graphDir, runDir } = projectWithARun();
  // A stand-in for the built app: were a server started after all, it would find one to serve and say where.
  const dist = join(dir, "dist");
  mkdirSync(dist);
  writeFileSync(join(dist, "index.html"), "<!doctype html><title>grooph</title>\n");
  try {
    for (const more of [[], ["--port", "0"], ["--port", "0", "--sessions"], ["--port", "0", "--host", "127.0.0.1", "--open"]]) {
      for (const folder of [runDir, graphDir, dir, "."]) {
        const io = capture();
        // The signal is already aborted: a `watch` that started a server after all would stop at once and return,
        // and this test would fail on what it printed, not wait for Ctrl-C.
        const code = await grooph(["watch", folder, ...more], io, { signal: AbortSignal.abort(), env: { GROOPH_WEB_DIST: dist } });
        const what = `watch ${folder} ${more.join(" ")}`;
        assert.equal(code, 1, what);
        assert.deepEqual(io.stderr, [WATCH_GONE], what);
        assert.deepEqual(io.stdout, [], `${what}: a server said where it listens, or that it stopped`);
      }
    }
    assert.deepEqual(opened, [], "a browser was opened");
    assert.ok(!WATCH_GONE.includes("\n") && WATCH_GONE.startsWith("grooph: watch no longer takes a run or a graph folder") && WATCH_GONE.includes("grooph-lab watch <run dir>"), WATCH_GONE);

    // Its page is of the sessions and the map, and takes no folder: no run and no graph folder.
    for (const argv of [["watch", "--help"], ["help", "watch"]]) {
      const help = capture();
      assert.equal(await grooph(argv, help), 0);
      assert.equal(help.stdout.join("\n").split("\n")[0], "grooph watch [--sessions] [--events <source>]... [--map <operation map>] [--port 4174] [--host 127.0.0.1] [--open]");
      assert.doesNotMatch(help.stdout.join("\n"), /<run dir>|<graph dir>|\bthe run\b|newest run|working copy/);
      // --sessions chose the sessions over a run. It is still taken, so that a line written for 0.4.1 runs, and the page says it changes nothing.
      assert.match(help.stdout.join("\n"), /^ {2}--sessions {4}taken and not needed: the sessions are what watch serves\./m);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the overview has no line for export, adopt or runs and no Compile group, and a name typed near one of them is not corrected to it", async () => {
  const overviews: string[] = [];
  for (const [argv, code] of [[["--help"], 0], [["-h"], 0], [["help"], 0], [[], 1]] as const) {
    const io = capture();
    assert.equal(await grooph([...argv], io), code, argv.join(" "));
    assert.deepEqual(io.stderr, []);
    overviews.push(io.stdout.join("\n"));
  }
  assert.equal(new Set(overviews).size, 1, "one overview, however it is asked for");
  const overview = overviews[0]!;
  assert.match(overview, /^grooph \d+\.\d+\.\d+: author and check multi-agent loop graphs\. It never runs them\.\n/);
  assert.doesNotMatch(overview, /compile/i);
  // No line is one of the three's, and neither export nor adopt is named anywhere on the page ("runs" is also a verb, in its first line).
  assert.doesNotMatch(overview, /^\s*(export|adopt|runs)\b/m);
  assert.doesNotMatch(overview, /(?<![\w-])(export|adopt)(?![\w-])/);
  // The commands it does list are still there: the check above is not passing on an empty page.
  for (const command of ["new", "validate", "plan", "watch", "share", "embed"]) assert.match(overview, new RegExp(`^ {2}${command} +\\S`, "m"), command);
  assert.match(overview, /^ {2}watch {8}serve the app and the live sessions to this machine's browser$/m);

  // Through 0.4.1 each of these was answered with: Did you mean "export"? (or "adopt", or "runs").
  for (const typed of ["exprot", "expor", "exports", "adpot", "adop", "adopt-run", "run", "runz", "rnus"]) {
    for (const argv of [[typed], [typed, reviewLoop], ["help", typed], [typed, "--help"]]) {
      const io = capture();
      assert.equal(await grooph(argv, io), 1, argv.join(" "));
      assert.deepEqual(io.stdout, [], argv.join(" "));
      assert.equal(io.stderr.length, 2, io.stderr.join("\n"));
      assert.ok(io.stderr[0]!.startsWith(`grooph: unknown command "${typed}".`), io.stderr[0]);
      assert.doesNotMatch(io.stderr.join("\n"), /Did you mean "(export|adopt|runs)"/, argv.join(" "));
      assert.equal(io.stderr[1], "grooph --help lists the commands.");
    }
  }
});

test("share and embed take no run folder, and say what they take; a run's bundle, which is a file, is still shared and embedded", async () => {
  const { dir, graphDir, runDir } = projectWithARun();
  try {
    const before = tree(dir);
    for (const folder of [runDir, graphDir, dir]) {
      const shared = capture();
      assert.equal(await grooph(["share", folder], shared), 1, folder);
      assert.deepEqual(shared.stderr, [`grooph: ${folder} is a folder; share takes a file: a graph, a proposal set, a run bundle (*.grooph-run.json) or an operation map`]);
      assert.deepEqual(shared.stdout, []);
      // With --out and --open, as a run folder was shared with them: nothing is written and nothing opened.
      const asked = capture();
      assert.equal(await grooph(["share", folder, "--out", join(dir, "out.grooph-run.json"), "--open"], asked), 1, folder);
      assert.deepEqual(asked.stdout, []);
      const embedded = capture();
      assert.equal(await grooph(["embed", folder], embedded), 1, folder);
      assert.deepEqual(embedded.stderr, [`grooph: ${folder} is a folder; embed takes a file: a graph, a run bundle (*.grooph-run.json), an operation map or a proposal set`]);
      assert.deepEqual(embedded.stdout, []);
      assert.equal(await grooph(["embed", folder, "--play"], capture()), 1, folder);
    }
    assert.deepEqual(tree(dir), before, "something was written");
    assert.deepEqual(opened, [], "a browser was opened");

    // The same run as one file, as the lab's `runs bundle` writes it (built here with core, which that command stands on).
    const source = parseGraphText(readFileSync(join(graphDir, "graph.grooph.json"), "utf8")).doc!;
    const working = parseGraphText(readFileSync(join(runDir, "graph.grooph.json"), "utf8")).doc!;
    const file = join(dir, "run.grooph-run.json");
    writeFileSync(file, canonicalizeRunBundle(buildRunBundle({ source, working, notesText: readFileSync(join(runDir, "notes.jsonl"), "utf8") })));

    const shared = capture();
    assert.equal(await grooph(["share", file], shared), 0, shared.stderr.join("\n"));
    assert.match(shared.stdout[0]!, /^run 20260919-0057-66c8 · Slice 0007 sandwich \(slice-0007-sandwich\) · ended · pass$/);
    const link = shared.stdout.filter((line) => line.startsWith("https://")).at(-1)!;
    const sharedRun = decodeSharePayload(sharePayloadFrom(link)!, inflateRaw);
    assert.ok(sharedRun.ok && sharedRun.envelope.kind === "run" && sharedRun.envelope.doc.run === REAL);

    const embedded = capture();
    assert.equal(await grooph(["embed", file], embedded), 0, embedded.stderr.join("\n"));
    assert.equal(embedded.stdout.length, 2);
    const payload = /#\/embed\?d=([A-Za-z0-9_-]+)/.exec(embedded.stdout[0]!)?.[1] ?? "";
    const embeddedRun = decodeSharePayload(payload, inflateRaw);
    assert.ok(embeddedRun.ok && embeddedRun.envelope.kind === "run" && embeddedRun.envelope.doc.run === REAL);

    // And their pages say a bundle, and name no run folder.
    for (const command of ["share", "embed"]) {
      const help = capture();
      assert.equal(await grooph([command, "--help"], help), 0);
      assert.match(help.stdout.join("\n"), /\*\.grooph-run\.json/, command);
      assert.doesNotMatch(help.stdout.join("\n"), /run dir|run folder|runs bundle|\.grooph\/<graph-id>\/runs/, command);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("no next: line names export: a graph that passes validate --for-export, and a picked graph a harness could run, are told of no next step", async () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "grooph-gone-")));
  // What a command printed, with the files it was given taken out: a path may hold any word.
  const said = (io: Capture, ...paths: string[]): string[] => [...io.stdout, ...io.stderr].map((line) => paths.reduce((text, path) => text.split(path).join("<file>"), line));
  try {
    // At a terminal, where a `next:` line is printed: through 0.4.1 this one was "next: grooph export <file> --target <harness> --into ."
    for (const file of [clean, reviewLoop]) {
      const checked = capture(true);
      assert.equal(await grooph(["validate", "--for-export", file], checked), 0, file);
      const lines = said(checked, file);
      assert.ok(lines.length > 0 && !lines.some((line) => line.startsWith("next:")), lines.join("\n"));
      for (const line of lines) assert.doesNotMatch(line, NAMES_EXPORT, line);
    }
    // (The line it still prints, so that the check above is of a terminal: a graph not yet checked for a package is sent to that check.)
    const plain = capture(true);
    assert.equal(await grooph(["validate", clean], plain), 0);
    assert.equal(plain.stdout.at(-1), `next: grooph validate --for-export ${clean}`);

    // A candidate that names its harness and has nothing in error: through 0.4.1, "next: grooph export <out> --target claude-code --into ."
    for (const isTTY of [true, false]) {
      const out = join(dir, `picked-${isTTY}.grooph.json`);
      const picked = capture(isTTY);
      assert.equal(await grooph(["pick", csvSet, "lean", "--out", out], picked), 0, picked.stderr.join("\n"));
      assert.equal(parseGraphText(readFileSync(out, "utf8")).doc?.target?.harness, "claude-code");
      const lines = said(picked, out);
      assert.ok(lines.some((line) => line.startsWith('picked "Lean" (lean) from csv-export')), lines.join("\n"));
      assert.ok(!lines.some((line) => line.startsWith("next:")), lines.join("\n"));
      for (const line of lines) assert.doesNotMatch(line, NAMES_EXPORT, line);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the files that held adopt, runs and the reading of a run folder are not in this package's source, and its command imports nothing of export's", () => {
  const src = join(repoRoot, "packages", "cli", "src");
  assert.ok(existsSync(join(src, "index.ts")) && existsSync(join(src, "commands", "help.ts")), "this test looks where the source is");
  for (const gonePath of [join("commands", "adopt.ts"), join("commands", "runs.ts"), "run-io.ts"]) assert.equal(existsSync(join(src, gonePath)), false, `packages/cli/src/${gonePath} is back`);
  const index = readFileSync(join(src, "index.ts"), "utf8");
  assert.doesNotMatch(index, /commands\/export/, "packages/cli/src/index.ts imports from commands/export");
  // Nor has it a case for any of the three: the one line above is all it says of them.
  assert.doesNotMatch(index, /case "(export|adopt|runs)"/);
  for (const moved of ["commands/adopt", "commands/runs", "run-io"]) assert.doesNotMatch(index, new RegExp(`from "\\./${moved}(\\.js)?"`), moved);
});

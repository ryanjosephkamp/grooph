/**
 * `grooph export` over a package in place holds the graph coming in to the brakes of the graph that package keeps,
 * as `grooph adopt` holds a run's working copy and as the MCP tool's export does (one function, `brakesAtExport`).
 * The owner's decision of 2026-10-05; the cases are the ones the driver asked for, through the command.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import type { Graph } from "@grooph/core";

import { NOT_JUDGED } from "../src/commands/adopt.js";
import { run } from "../src/index.js";
import type { Output } from "../src/print.js";

// A developer's own tier map must not reach these tests.
delete process.env["GROOPH_MODELS"];

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
const withCap = (graph: Graph, n: number): Graph => ({ ...graph, loops: graph.loops.map((loop) => ({ ...loop, stops: loop.stops.map((stop) => (stop.kind === "max-iterations" ? { ...stop, n } : stop)) })) });
const exportArgs = (file: string, project: string, ...more: string[]): string[] => ["export", file, "--target", "claude-code", "--into", project, ...more];

const NONE = "brakes: compared with the graph this package kept; none of the brakes it compares was removed or loosened";
const SAME = "brakes: compared with the graph this package kept; it is the same graph";
const FIRST = "brakes: nothing in place to compare with. No package of this graph's id was there";
const NO_KEPT = "Files of this graph's name were there, and no graph kept with them.";
const UNREADABLE = "The graph this package kept cannot be read as this package's graph.";
const STALE = "The lead's brief or the mapping notes in the package there are not what the graph it keeps compiles to: that graph was changed after they were written, one of them was changed by hand, or another version of grooph wrote them.";
const lines = (text: string): string[] => text.split(LF);
/** The last line of what was printed: the command's own, whatever a graph holds. */
const last = (out: string): string => lines(out).at(-1)!;
/** The lines the command prints above the kickoff. */
const above = (out: string): string[] => lines(out).slice(0, lines(out).findIndex((line) => line.startsWith("Kickoff — ")));
const keptOf = (project: string, id = "review-loop"): string => join(project, ".grooph", id, "graph.grooph.json");
const capOf = (file: string): number | undefined => (JSON.parse(readFileSync(file, "utf8")) as Graph).loops[0]!.stops.find((stop) => stop.kind === "max-iterations")?.n;

test("a first export compares nothing and says so, last; the same graph again is the same graph; a tighter one is placed and said", async () => {
  const graph = fixture("review-loop");
  await withProject(async (project, files) => {
    const file = put(join(files, "g.grooph.json"), graph);
    const first = await grooph(exportArgs(file, project));
    assert.equal(first.code, 0, first.err);
    assert.equal(first.err, "");
    assert.equal(last(first.out), FIRST);
    // The brakes line is the last line, and the only line of the command's own that opens so: none stands above the kickoff.
    assert.ok(!above(first.out).some((line) => line.startsWith("brakes:")), first.out);
    assert.match(first.out, /^Kickoff — paste this into a Claude Code session opened in .+\. It runs from the next line to the line before the last line of this output, which is grooph's own:$/m);

    const again = await grooph(exportArgs(file, project));
    assert.equal(again.code, 0, again.err);
    assert.equal(last(again.out), SAME);
    assert.ok(!again.out.includes("tightens a brake"));

    const tighter = await grooph(exportArgs(put(join(files, "tighter.grooph.json"), withCap(graph, 2)), project));
    assert.equal(tighter.code, 0, tighter.err);
    assert.equal(last(tighter.out), NONE);
    assert.equal(capOf(keptOf(project)), 2);
    // What tightens is placed with the rest and said, as adopt says it, above the kickoff.
    assert.ok(above(tighter.out).join(LF).match(/^tightens a brake, and is placed with the rest:\n {2}loop:review-cycle\.stops +undoing it: raises the round cap from 2 to 4$/m), tighter.out);
  });
});

test("a raised cap over a package in place is refused with its name and reason and nothing is written; a wrong name is refused; its own name places it", async () => {
  const graph = fixture("review-loop");
  await withProject(async (project, files) => {
    assert.equal((await grooph(exportArgs(put(join(files, "g.grooph.json"), graph), project))).code, 0);
    const looser = put(join(files, "looser.grooph.json"), withCap(graph, 9));
    const before = tree(project);

    const refused = await grooph(exportArgs(looser, project));
    assert.equal(refused.code, 1);
    assert.equal(refused.out, "", "nothing is said on standard output when nothing was written");
    assert.match(refused.err, /^grooph: 1 change in .+looser\.grooph\.json may remove or loosen a brake of the graph the package in .+ keeps, so nothing was written:$/m);
    assert.match(refused.err, /^ {2}loop:review-cycle\.stops +raises the round cap from 4 to 9$/m);
    assert.match(refused.err, /^To place it on purpose, add to the same command: --allow loop:review-cycle\.stops$/m);
    assert.match(refused.err, /cannot tell a stricter wording or a renamed part from a looser one/);
    assert.match(refused.err, /^A brake is removed or loosened only on a person's word\. If you are an agent, put each line above to the person/m);
    assert.equal(tree(project), before);

    // A name that is no change, alone or beside the right one; and the flag with nothing after it.
    for (const names of [["loop:review-cycle.bar"], ["loop:review-cycle.stops", "node:nothing"], [""]]) {
      const wrong = await grooph(exportArgs(looser, project, ...names.flatMap((name) => ["--allow", name])));
      assert.equal(wrong.code, 1, names.join(" "));
      assert.match(wrong.err, /no change named ".*" between the graph the package in .+ keeps and .+, so nothing was written/);
      assert.equal(tree(project), before, names.join(" "));
    }

    // Every stop is said together: the model of a file in place, and the brake.
    const both = await grooph(exportArgs(looser, project, "--models", "strong=mine"));
    assert.equal(both.code, 1);
    assert.match(both.err, /may remove or loosen a brake/);
    assert.match(both.err, /this export would change the model of \d+ agent files? already in/);
    assert.equal(tree(project), before);

    // Two changes: the hint names both, and one of the two is not enough.
    const two = put(join(files, "two.grooph.json"), { ...withCap(graph, 9), loops: withCap(graph, 9).loops.map((loop) => (loop.bar ? { ...loop, bar: { ...loop.bar, acceptance: "Looks fine." } } : loop)) });
    const twoRefused = await grooph(exportArgs(two, project));
    assert.equal(twoRefused.code, 1);
    assert.match(twoRefused.err, /^To place one on purpose, add --allow and its name to the same command\. All of them: --allow loop:review-cycle\.\S+ --allow loop:review-cycle\.\S+$/m);
    assert.equal((await grooph(exportArgs(two, project, "--allow", "loop:review-cycle.stops"))).code, 1);
    assert.equal(tree(project), before);

    const placed = await grooph(exportArgs(looser, project, "--allow", "loop:review-cycle.stops"));
    assert.equal(placed.code, 0, placed.err);
    assert.ok(above(placed.out).join(LF).match(/^may remove or loosen a brake the package there had, and is placed because it was asked for by name \(--allow\):\n {2}loop:review-cycle\.stops +raises the round cap from 4 to 9$/m), placed.out);
    assert.equal(last(placed.out), "brakes: placed with 1 change that may remove or loosen a brake the package there had, each asked for by name (--allow) and listed above the kickoff");
    assert.equal(capOf(keptOf(project)), 9);
  });
});

test("two limits swapped, and a stop that leads on of a kind the loop did not have, are refused over a package in place (round two of the audit)", async () => {
  // A worker and a sorter that says "more" or "finished": no check and no critic stands before the end.
  const plain = (stops: unknown[]): unknown => ({
    grooph: 0, id: "plain", name: "A loop with no check", version: 1, goal: "Work through a list.", target: { harness: "claude-code" },
    nodes: [
      { id: "worker", kind: "agent", name: "Worker", role: "builder", brief: "Do the next item.", outputs: ["out.txt"], allow: ["read-files", "edit-files"] },
      { id: "sorter", kind: "agent", name: "Sorter", role: "planner", brief: "Say whether items remain.", outputs: ["LEFT.md"], allow: ["read-files", "write-outputs"] },
      { id: "done", kind: "stop", name: "Done", outcome: "success" },
    ],
    edges: [{ id: "e-w-s", from: "worker", to: "sorter" }, { id: "e-more", from: "sorter", to: "worker", when: { verdict: "more" } }, { id: "e-fin", from: "sorter", to: "done", when: { verdict: "finished" } }],
    loops: [{ id: "list", name: "List", members: ["worker", "sorter"], back: ["e-more"], mode: "grind", stops }],
  });
  const halts = { kind: "budget", measure: "dispatches", limit: 2 };
  const leadsOn = { ...halts, then: "done" };
  const cap = { kind: "max-iterations", n: 1, then: "done" };
  const kept = (project: string): unknown[] => (JSON.parse(readFileSync(keptOf(project, "plain"), "utf8")) as Graph).loops[0]!.stops;
  const cases: [string, unknown[], unknown[], RegExp][] = [
    ["two budgets of one size, swapped", [halts, leadsOn], [leadsOn, halts], /^ {2}loop:list\.stops +the budget of 2 dispatches that leads on to "done" would be moved ahead of the budget of 2 dispatches that halts the run, and could fire on the same pass$/m],
    ["a new cap of one round that leads on, ahead", [halts], [cap, halts], /^ {2}loop:list\.stops +the round cap of 1 that leads on to "done" would come into the loop, and could fire before the budget of 2 dispatches that halts the run$/m],
    ["the same cap, behind", [halts], [halts, cap], /^ {2}loop:list\.stops +the round cap of 1 that leads on to "done" would come into the loop, and could fire before the budget of 2 dispatches that halts the run$/m],
    ["a new stop on diminishing returns that leads on, ahead", [halts], [{ kind: "diminishing-returns", rounds: 1, then: "done" }, halts], /^ {2}loop:list\.stops +the stop on diminishing returns over 1 round that leads on to "done" would come into the loop, and could fire before the budget of 2 dispatches that halts the run$/m],
  ];
  for (const [what, was, now, why] of cases) {
    await withProject(async (project, files) => {
      assert.equal((await grooph(exportArgs(put(join(files, "source.grooph.json"), plain(was)), project))).code, 0, what);
      const working = put(join(files, "working.grooph.json"), plain(now));
      const before = tree(project);
      const refused = await grooph(exportArgs(working, project));
      assert.equal(refused.code, 1, what);
      assert.equal(refused.out, "", what);
      assert.match(refused.err, /^grooph: 1 change in .+working\.grooph\.json may remove or loosen a brake of the graph the package in .+ keeps, so nothing was written:$/m, what);
      assert.match(refused.err, why, what);
      assert.equal(tree(project), before, what);
      // By its name it is placed, as any brake is; and it is not said to tighten one. (A new cap that leads on was
      // printed as "tightens a brake: undoing it removes the round cap".)
      const placed = await grooph(exportArgs(working, project, "--allow", "loop:list.stops"));
      assert.equal(placed.code, 0, placed.err);
      assert.ok(!placed.out.includes("tightens a brake"), placed.out);
      assert.deepEqual(kept(project), now, what);
    });
  }
  // The other way round, the limit that halts put first, is placed and said to tighten.
  await withProject(async (project, files) => {
    assert.equal((await grooph(exportArgs(put(join(files, "source.grooph.json"), plain([leadsOn, halts])), project))).code, 0);
    const tighter = await grooph(exportArgs(put(join(files, "working.grooph.json"), plain([halts, leadsOn])), project));
    assert.equal(tighter.code, 0, tighter.err);
    assert.equal(last(tighter.out), NONE);
    assert.ok(above(tighter.out).join(LF).match(/^tightens a brake, and is placed with the rest:\n {2}loop:list\.stops +undoing it: the budget of 2 dispatches that leads on to "done" would be moved ahead of the budget of 2 dispatches that halts the run, and could fire on the same pass$/m), tighter.out);
  });
});

test("the folders that hold no package are the ones core keeps for something else", async () => {
  const core = await import("@grooph/core");
  const { NOT_A_PACKAGE } = await import("../src/io.js");
  for (const name of [...NOT_A_PACKAGE, "review-loop", "runs", "graph", "packages", "kept"]) assert.equal(NOT_A_PACKAGE.includes(name), core.keptFolder(name) !== undefined, name);
});

test("no command of grooph's but export writes the graph a package keeps: by its path, through a link, in another letter case, in either output mode", async () => {
  const graph = fixture("review-loop");
  const raise = JSON.stringify([{ op: "setStop", loop: "review-cycle", index: graph.loops[0]!.stops.findIndex((stop) => stop.kind === "max-iterations"), stop: { kind: "max-iterations", n: 50 } }]);
  await withProject(async (project, files) => {
    assert.equal((await grooph(exportArgs(put(join(files, "g.grooph.json"), graph), project))).code, 0);
    const kept = keptOf(project);
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
          assert.match(`${r.err}${r.out}`, /is the graph a package keeps\. Only grooph export writes it/, args.join(" "));
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

test("a kept graph is a baseline only while it is this package's and the brief and the mapping notes are what it compiles to: changed by hand, or moved in from another package, nothing is called compared", async () => {
  const graph = fixture("review-loop");
  const lead = (project: string): string => readFileSync(join(project, ".grooph", "review-loop", "LEAD.md"), "utf8");

  // The kept graph's cap raised by a hand, then that file, or an equal graph, exported.
  await withProject(async (project, files) => {
    assert.equal((await grooph(exportArgs(put(join(files, "g.grooph.json"), graph), project))).code, 0);
    const kept = keptOf(project);
    writeFileSync(kept, JSON.stringify(withCap(graph, 50), null, 2));
    const before = tree(project);
    for (const source of [kept, put(join(files, "equal.grooph.json"), withCap(graph, 50))]) {
      const refused = await grooph(exportArgs(source, project));
      assert.equal(refused.code, 1, refused.out);
      assert.equal(refused.out, "");
      assert.equal(lines(refused.err)[0], `grooph: not compared, so nothing was written. ${STALE}`);
      assert.match(refused.err, /export again with --uncompared\. That is a person's word: if you are an agent, put it to the person first\.$/m);
      assert.equal(tree(project), before);
      assert.match(lead(project), /max iterations: 4/);
    }
    // A graph looser still than the changed kept graph is held by name as well: both stops, and one answer is not enough.
    const looser = put(join(files, "looser.grooph.json"), withCap(graph, 500));
    const both = await grooph(exportArgs(looser, project));
    assert.equal(both.code, 1);
    assert.match(both.err, /not compared, so nothing was written/);
    assert.match(both.err, /^ {2}loop:review-cycle\.stops +raises the round cap from 50 to 500$/m);
    assert.equal((await grooph(exportArgs(looser, project, "--uncompared"))).code, 1);
    assert.equal((await grooph(exportArgs(looser, project, "--allow", "loop:review-cycle.stops"))).code, 1);
    assert.equal(tree(project), before);
    // With the person's word it is placed, and the last line does not say it was compared.
    const placed = await grooph(exportArgs(kept, project, "--uncompared"));
    assert.equal(placed.code, 0, placed.err);
    assert.equal(last(placed.out), `brakes: not compared (--uncompared). ${STALE}`);
    assert.match(lead(project), /max iterations: 50/);
    // From here the package is what its kept graph compiles to again, and the next export is compared.
    assert.equal(last((await grooph(exportArgs(kept, project))).out), SAME);
  });

  // A policy taken off the kept graph by hand shows in the mapping notes, not in the brief: still no baseline.
  await withProject(async (project, files) => {
    const file = put(join(files, "g.grooph.json"), graph);
    assert.equal((await grooph(exportArgs(file, project))).code, 0);
    const bare = { ...graph, policies: [] } as Graph;
    writeFileSync(keptOf(project), JSON.stringify(bare, null, 2));
    const r = await grooph(exportArgs(put(join(files, "bare.grooph.json"), bare), project));
    assert.equal(r.code, 1, r.out);
    assert.equal(lines(r.err)[0], `grooph: not compared, so nothing was written. ${STALE}`);
  });

  // Another package's kept graph moved into this package's folder: its own brief elsewhere does not vouch for it here.
  await withProject(async (project, files) => {
    assert.equal((await grooph(exportArgs(put(join(files, "g.grooph.json"), graph), project))).code, 0);
    assert.equal((await grooph(exportArgs(put(join(files, "zz.grooph.json"), { ...withCap(graph, 50), id: "zz" }), project))).code, 0);
    writeFileSync(keptOf(project), readFileSync(keptOf(project, "zz"), "utf8"));
    const before = tree(project);
    const r = await grooph(exportArgs(put(join(files, "loose.grooph.json"), withCap(graph, 50)), project));
    assert.equal(r.code, 1, r.out);
    assert.equal(lines(r.err)[0], `grooph: not compared, so nothing was written. ${UNREADABLE}`);
    assert.equal(tree(project), before);
    assert.match(lead(project), /max iterations: 4/);
  });

  // The brief edited by hand; an agent's file edited by hand, which does not make the kept graph any less the baseline.
  await withProject(async (project, files) => {
    const file = put(join(files, "g.grooph.json"), graph);
    assert.equal((await grooph(exportArgs(file, project))).code, 0);
    const briefFile = join(project, ".grooph", "review-loop", "LEAD.md");
    writeFileSync(briefFile, `${readFileSync(briefFile, "utf8")}\nA line added by hand.\n`);
    const briefChanged = await grooph(exportArgs(file, project));
    assert.equal(briefChanged.code, 1);
    assert.equal(lines(briefChanged.err)[0], `grooph: not compared, so nothing was written. ${STALE}`);
    assert.equal((await grooph(exportArgs(file, project, "--uncompared"))).code, 0);

    const agent = join(project, ".claude", "agents", "review-loop--builder.md");
    writeFileSync(agent, `${readFileSync(agent, "utf8")}\nA note the person added.\n`);
    const tuned = await grooph(exportArgs(put(join(files, "looser.grooph.json"), withCap(graph, 9)), project));
    assert.equal(tuned.code, 1);
    assert.match(tuned.err, /^ {2}loop:review-cycle\.stops +raises the round cap from 4 to 9$/m);
    assert.ok(!tuned.err.includes("not compared"), tuned.err);
  });
});

test("what is not compared is said, and waits for a word: a kept graph that is gone or cannot be read as a graph; a graph under a new id is a second package and says so", async () => {
  const graph = fixture("review-loop");
  await withProject(async (project, files) => {
    const file = put(join(files, "g.grooph.json"), graph);
    assert.equal((await grooph(exportArgs(file, project))).code, 0);

    // A new id and a raised cap: a second package beside the first, and the line names the first.
    const second = await grooph(exportArgs(put(join(files, "two.grooph.json"), { ...withCap(graph, 99), id: "review-loop-two" }), project));
    assert.equal(second.code, 0, second.err);
    assert.equal(last(second.out), `${FIRST}; 1 other package is, and its graph was not compared with this one: review-loop`);

    const kept = keptOf(project);
    const looser = put(join(files, "looser.grooph.json"), withCap(graph, 9));
    for (const [spoil, why] of [
      [() => rmSync(kept), NO_KEPT],
      [() => writeFileSync(kept, "{ not a graph"), UNREADABLE],
      [() => writeFileSync(kept, JSON.stringify({ ...graph, loops: "none" })), UNREADABLE],
      [() => writeFileSync(kept, "[]"), UNREADABLE],
    ] as const) {
      spoil();
      const before = tree(project);
      const refused = await grooph(exportArgs(looser, project));
      assert.equal(refused.code, 1, why);
      assert.equal(refused.out, "");
      assert.ok(lines(refused.err)[0] === `grooph: not compared, so nothing was written. ${why}`, refused.err);
      // A name has nothing to answer for there, and says that --uncompared, not --allow, is what places the graph.
      const named = await grooph(exportArgs(looser, project, "--allow", "loop:review-cycle.stops"));
      assert.equal(named.code, 1);
      assert.match(named.err, /--allow names "loop:review-cycle\.stops", and nothing was compared, so the names answer for nothing and nothing was written\. --uncompared places the graph without a comparison; --allow does not\.$/m);
      assert.equal(tree(project), before);
      // With the word, placed and said; a name given beside it is noted as answering for nothing.
      const placed = await grooph(exportArgs(looser, project, "--uncompared", "--allow", "loop:review-cycle.stops"));
      assert.equal(placed.code, 0, placed.err);
      assert.equal(last(placed.out), `brakes: not compared (--uncompared). ${why}`);
      assert.match(placed.out, /^note: --allow named "loop:review-cycle\.stops", and nothing was compared, so the names answered for nothing\.$/m);
      assert.equal((await grooph(exportArgs(file, project))).code, 0, "back to the first graph, tighter, compared");
    }

    // No package was ever there, and one file of its name is: said as that, not as a kept graph that went.
    await withProject(async (bare) => {
      mkdirSync(join(bare, ".claude", "agents"), { recursive: true });
      writeFileSync(join(bare, ".claude", "agents", "review-loop--builder.md"), "made by hand\n");
      const r = await grooph(exportArgs(file, bare));
      assert.equal(r.code, 1);
      assert.ok(lines(r.err)[0] === `grooph: not compared, so nothing was written. ${NO_KEPT}`, r.err);
      assert.equal(readFileSync(join(bare, ".claude", "agents", "review-loop--builder.md"), "utf8"), "made by hand\n");
    });

    // An empty folder: --allow has nothing to answer, and the line says a first export needs none.
    const fresh = await grooph(exportArgs(looser, join(project, "elsewhere"), "--allow", "loop:review-cycle.stops"));
    assert.equal(fresh.code, 1);
    assert.match(fresh.err, /nothing was compared, so nothing was written: no package of this graph's id is in .+\. Without --allow this export places the graph, as a first export does\.$/m);
    assert.equal(existsSync(join(project, "elsewhere")), false);
  });
});

test("two graphs whose ids and node ids make one agent file: neither is written over the other", async () => {
  const graph = fixture("review-loop");
  const core = await import("@grooph/core");
  const renamed = (id: string, from: string, to: string): Graph => {
    const made = core.applyOps({ ...graph, id }, [{ op: "renameId", from, to }] as Parameters<typeof core.applyOps>[1]);
    assert.ok(made.ok, "the test's own rename applies");
    return made.doc;
  };
  await withProject(async (project, files) => {
    // The package `my--graph` has a node `builder`; the graph `my` has a node `graph--builder`: both name my--graph--builder.md.
    assert.equal((await grooph(exportArgs(put(join(files, "a.grooph.json"), { ...graph, id: "my--graph" }), project))).code, 0);
    const agent = join(project, ".claude", "agents", "my--graph--builder.md");
    const before = tree(project);
    const clash = await grooph(exportArgs(put(join(files, "b.grooph.json"), renamed("my", "builder", "graph--builder")), project));
    assert.equal(clash.code, 1, clash.out);
    assert.match(clash.err, /^grooph: 1 agent file of this graph would replace another package's in .+, so nothing was written:\n {2}\.claude\/agents\/my--graph--builder\.md {2}is an agent of the package my--graph$/m);
    assert.equal(tree(project), before);
    assert.ok(existsSync(agent));
    assert.ok(!clash.err.includes("--uncompared"), "a collision is said alone");
    // A gate is no agent and has no file: a node of another graph named for it is no collision.
    const gateNamed = await grooph(exportArgs(put(join(files, "d.grooph.json"), renamed("my", "builder", "graph--merge-gate")), project));
    assert.equal(gateNamed.code, 0, gateNamed.err);
    rmSync(join(project, ".grooph", "my"), { recursive: true });
    rmSync(join(project, ".claude", "agents", "my--graph--merge-gate.md"));
    for (const name of readdirSync(join(project, ".claude", "agents"))) if (name.startsWith("my--") && !name.startsWith("my--graph--")) rmSync(join(project, ".claude", "agents", name));
    rmSync(join(project, ".claude", "skills", "my"), { recursive: true, force: true });
    // A graph beside it with no file in common is placed.
    assert.equal((await grooph(exportArgs(put(join(files, "c.grooph.json"), { ...graph, id: "my" }), project))).code, 0);
  });
});

test("a document outside the schema reaches neither the comparison nor a file, by export or by apply", async () => {
  const graph = fixture("review-loop");
  const loop = graph.loops[0]!;
  const cap = loop.stops.findIndex((stop) => stop.kind === "max-iterations");
  const patches: [string, unknown[]][] = [
    ["a cap of null", [{ op: "setStop", loop: loop.id, index: cap, stop: { kind: "max-iterations", n: null } }]],
    ["evidence that is a string", [{ op: "updateEdge", id: graph.edges[0]!.id, set: { evidence: "a string" } }]],
    ["stops that are null", [{ op: "updateLoop", id: loop.id, set: { stops: null } }]],
  ];
  const core = await import("@grooph/core");
  await withProject(async (project, files) => {
    const file = put(join(files, "g.grooph.json"), graph);
    assert.equal((await grooph(exportArgs(file, project))).code, 0);
    const before = tree(project);
    for (const [what, ops] of patches) {
      // By the command: the patch is refused by the schema and the file is as it was.
      const fileBefore = readFileSync(file, "utf8");
      const applied = await grooph(["apply", file, "--ops", "-", "--write"], JSON.stringify(ops));
      assert.equal(applied.code, 1, what);
      assert.match(applied.err, /does not match the schema/, what);
      assert.equal(readFileSync(file, "utf8"), fileBefore, what);
      // The same document written by hand, exported over the package in place, with a name and with the word.
      const made = core.applyOps(graph, ops as Parameters<typeof core.applyOps>[1]);
      assert.ok(made.ok, what);
      const broken = put(join(files, "broken.grooph.json"), made.doc);
      for (const more of [[], ["--allow", `loop:${loop.id}.stops`], ["--uncompared"]]) {
        const exported = await grooph(exportArgs(broken, project, ...more));
        assert.equal(exported.code, 1, what);
        assert.match(exported.err, /it is not a graph document/, what);
        assert.match(exported.err, /E_SCHEMA/, what);
      }
      assert.equal(tree(project), before, `${what}: something in the project changed`);
    }
  });
});

test("a field hidden behind a \"__proto__\" key is one thing in the file and at the export; plainly removed, the approval is named and held", async () => {
  const graph = fixture("glyph-vocabulary");
  const edge = graph.edges.find((e) => (e as { approval?: boolean }).approval === true)!;
  const own = (object: object, key: string): boolean => Object.prototype.hasOwnProperty.call(object, key);
  const edgeOf = (file: string): object => (JSON.parse(readFileSync(file, "utf8")) as Graph).edges.find((e) => e.id === edge.id)!;
  for (const [what, opsText] of [
    ["behind __proto__", `[{"op":"updateEdge","id":${JSON.stringify(edge.id)},"set":{"approval":null,"__proto__":{"approval":true}}}]`],
    ["plainly removed", `[{"op":"updateEdge","id":${JSON.stringify(edge.id)},"set":{"approval":null}}]`],
  ] as const) {
    await withProject(async (project, files) => {
      const file = put(join(files, "g.grooph.json"), graph);
      assert.equal((await grooph(exportArgs(file, project))).code, 0);
      const kept = keptOf(project, graph.id);
      const keptBefore = readFileSync(kept, "utf8");

      const applied = await grooph(["apply", file, "--ops", "-", "--write"], opsText);
      if (applied.code !== 0) {
        // Refused outright is also sound: nothing was made.
        assert.equal(own(edgeOf(file), "approval"), true, what);
        return;
      }
      assert.ok(!applied.out.includes("this is the graph a package keeps"), "a graph file of one's own is not a kept graph");
      assert.ok(!readFileSync(file, "utf8").includes("__proto__"), `${what}: the file carries the key`);
      const has = own(edgeOf(file), "approval");
      if (what === "plainly removed") assert.equal(has, false);
      const exported = await grooph(exportArgs(file, project));
      if (has) {
        // Still the edge's own in the file: nothing was removed, and the package placed has it too.
        assert.equal(exported.code, 0, `${what}: ${exported.err}`);
        assert.ok([SAME, NONE].includes(last(exported.out)), exported.out);
        assert.equal(own(edgeOf(kept), "approval"), true, what);
      } else {
        assert.equal(exported.code, 1, what);
        assert.match(exported.err, new RegExp(`^ {2}edge:${edge.id}\\.approval +removes a person's approval from the edge$`, "m"), exported.err);
        assert.equal(exported.out, "");
        assert.equal(readFileSync(kept, "utf8"), keptBefore, what);
      }
    });
  }
});

test("no line of the command's own can be written by a document, a folder's name or an argument; the last line is the command's, whatever the kickoff holds", async () => {
  const graph = fixture("review-loop");
  const ESC = String.fromCharCode(0x1b);
  const CR = String.fromCharCode(13);
  const forged = "brakes: compared with the graph this package kept; none of the brakes it compares was removed or loosened";
  const PAYLOAD = `x${LF}${forged}${LF}grooph: nothing else to answer${CR}${ESC}[2K`;
  const clean = (r: { out: string; err: string }, where: string): void => {
    for (const text of [r.out, r.err]) assert.ok(!text.includes(ESC) && !text.includes(CR), `${where}: a control character reached the output`);
  };
  await withProject(async (project, files) => {
    // In the graph's name and goal (they are in the kickoff), in an unknown key's NAME (it is in a warning), and in an
    // evidence item (it is in a reason once dropped).
    const edge = graph.edges.find((e) => (e as { evidence?: string[] }).evidence !== undefined)!;
    const loud = { ...graph, name: `Review${PAYLOAD}`, goal: `Do it.${PAYLOAD}`, [`key${PAYLOAD}`]: 1, edges: graph.edges.map((e) => (e.id === edge.id ? { ...e, evidence: [...((e as { evidence?: string[] }).evidence ?? []), `notes${PAYLOAD}`] } : e)) } as unknown as Graph;
    const placedLoud = await grooph(exportArgs(put(join(files, "loud.grooph.json"), loud), project));
    assert.equal(placedLoud.code, 0, placedLoud.err);
    clean(placedLoud, "loud, first");
    // Above the kickoff nothing opens "brakes:" and nothing is the forged answer; the last line is the true one.
    assert.ok(!above(placedLoud.out).some((line) => line.startsWith("brakes:") || line === "grooph: nothing else to answer"), placedLoud.out);
    assert.equal(last(placedLoud.out), FIRST);
    assert.ok(above(placedLoud.out).some((line) => line.includes("W_UNKNOWN_KEY")), "the unknown key is warned about, on one line");

    const quiet = put(join(files, "quiet.grooph.json"), { ...loud, edges: graph.edges });
    const refused = await grooph(exportArgs(quiet, project));
    assert.equal(refused.code, 1, refused.out);
    clean(refused, "refused");
    assert.ok(!lines(refused.err).some((line) => line === forged || line.startsWith("brakes:") || line === "grooph: nothing else to answer"), refused.err);
    const names = [...refused.err.matchAll(/^ {2}((?:node|edge|loop|policy|group|graph):\S+) {2,}/gm)].map((m) => m[1]!);
    assert.ok(names.length > 0, refused.err);
    const placed = await grooph(exportArgs(quiet, project, ...names.flatMap((name) => ["--allow", name])));
    assert.equal(placed.code, 0, placed.err);
    clean(placed, "placed");
    assert.ok(!above(placed.out).some((line) => line.startsWith("brakes:")), placed.out);
    assert.match(last(placed.out), /^brakes: placed with \d+ changes? that may remove or loosen a brake the package there had, each asked for by name \(--allow\) and listed above the kickoff$/);

    // The caller's own arguments are echoed on one line: a file's name, a folder's, a name after --allow.
    const odd = await grooph(exportArgs(quiet, project, "--allow", `loop:x${PAYLOAD}`));
    assert.equal(odd.code, 1);
    clean(odd, "an --allow value");
    assert.ok(!lines(odd.err).some((line) => line === forged), odd.err);
    const missing = await grooph(["export", put(join(files, `odd${LF}${forged}.grooph.json`), { not: "a graph" }), "--target", "claude-code", "--into", project]);
    assert.equal(missing.code, 1);
    assert.ok(!lines(missing.err).some((line) => line === forged || line.startsWith("brakes:")), missing.err);
    const intoOdd = join(files, `proj${LF}${forged}`);
    const there = await grooph(exportArgs(put(join(files, "plain.grooph.json"), graph), intoOdd));
    assert.equal(there.code, 0, there.err);
    assert.equal(lines(there.out).filter((line) => line === forged).length, 0, there.out);
    assert.equal(last(there.out), FIRST);

    // A folder under .grooph whose name is not an id is nobody's package, and its name is not said; more than twenty
    // packages are counted truly.
    mkdirSync(join(project, ".grooph", `zz${LF}${forged}`), { recursive: true });
    writeFileSync(join(project, ".grooph", `zz${LF}${forged}`, "graph.grooph.json"), "{}");
    for (let i = 0; i < 24; i += 1) {
      mkdirSync(join(project, ".grooph", `other-${String(i).padStart(2, "0")}`));
      writeFileSync(join(project, ".grooph", `other-${String(i).padStart(2, "0")}`, "graph.grooph.json"), "{}");
    }
    const second = await grooph(exportArgs(put(join(files, "two.grooph.json"), { ...graph, id: "review-loop-two" }), project));
    assert.equal(second.code, 0, second.err);
    assert.match(last(second.out), /^brakes: nothing in place to compare with\. No package of this graph's id was there; 25 other packages are, and their graphs were not compared with this one: other-00, .*, and 5 more$/);
    assert.ok(!second.out.includes("zz"), second.out);
  });

  // --into spelled through a folder that is not there, with .grooph a link out of the project: the same refusal as the plain spelling.
  await withProject(async (project, files) => {
    const outside = join(files, "outside");
    mkdirSync(outside);
    symlinkSync(outside, join(project, ".grooph"));
    const file = put(join(files, "g.grooph.json"), graph);
    for (const into of [project, join(project, "nope", ".."), `${project}/nope/..`, `${project}/`]) {
      const r = await grooph(["export", file, "--target", "claude-code", "--into", into]);
      assert.equal(r.code, 1, `${into}: ${r.out}`);
      assert.deepEqual(readdirSync(outside), [], into);
    }
    const empty = await grooph(["export", file, "--target", "claude-code", "--into", ""]);
    assert.equal(empty.code, 1);
    assert.match(empty.err, /export needs --into <dir>/);
  });
  // The package's own folder a link to another, inside the project: refused as the tool refuses it.
  await withProject(async (project, files) => {
    const file = put(join(files, "g.grooph.json"), graph);
    assert.equal((await grooph(exportArgs(file, project))).code, 0);
    mkdirSync(join(project, "weaker", "review-loop"), { recursive: true });
    writeFileSync(join(project, "weaker", "review-loop", "graph.grooph.json"), JSON.stringify(withCap(graph, 500)));
    rmSync(join(project, ".grooph", "review-loop"), { recursive: true });
    symlinkSync(join(project, "weaker", "review-loop"), join(project, ".grooph", "review-loop"));
    const r = await grooph(exportArgs(put(join(files, "looser.grooph.json"), withCap(graph, 500)), project, "--uncompared"));
    assert.equal(r.code, 1, r.out);
    assert.match(r.err, /is a link to another folder, and a package keeps its graph in a folder of the project's own; nothing was written\./);
  });
});

test("what is typed is echoed on one line before the command runs, and at a terminal the last line is still the command's", async () => {
  const graph = fixture("review-loop");
  const ESC = String.fromCharCode(0x1b);
  const CR = String.fromCharCode(13);
  const forged = "brakes: compared with the graph this package kept; it is the same graph";
  await withProject(async (project, files) => {
    const file = put(join(files, "g.grooph.json"), graph);
    for (const args of [
      ["export", `nope${LF}${forged}`, "--target", "claude-code", "--into", project],
      ["export", file, "--target", `x${LF}${forged}`, "--into", project],
      ["export", file, "--target", "claude-code", "--into", project, "--models", `zz${LF}${forged}=x`],
      ["export", file, "--target", "claude-code", "--into", project, "--models", `zz${ESC}[2K${CR}brakes: fine=x`],
      ["export", file, "--target", "claude-code", "--into", project, `--zz${LF}${forged}`],
    ]) {
      const r = await grooph(args);
      assert.notEqual(r.code, 0);
      assert.equal(r.out, "");
      assert.ok(!lines(r.err).some((line) => line === forged || line.startsWith("brakes:")), r.err);
      assert.ok(!r.err.includes(ESC) && !r.err.includes(CR), "a control character reached the output");
    }
    const tty = capture();
    assert.equal(await run(exportArgs(file, project), { ...tty, isTTY: true }, () => "", { env: {} }), 0);
    const said = tty.stdout.join(LF).split(LF);
    assert.equal(said.at(-1), FIRST);
    const kick = said.findIndex((line) => line.startsWith("Kickoff — "));
    assert.ok(said.slice(0, kick).some((line) => line.startsWith("next: ")) && !said.slice(kick + 1, -1).some((line) => line.startsWith("next: open a ")), "grooph's own next: line stands above the kickoff");
  });
});

test("what core names and does not call a tightening is said in adopt's two sentences, by why", async () => {
  const core = await import("@grooph/core");
  // A check under another id, and the round cap lowered: with a check removed while another comes in, the lower cap is
  // named and not called a tightening.
  const fix = fixture("fix-until-green");
  const renamed = core.applyOps(fix, [{ op: "renameId", from: "suite", to: "suite-two" }] as Parameters<typeof core.applyOps>[1]);
  assert.ok(renamed.ok);
  const swapped = withCap(renamed.doc, 2);
  await withProject(async (project, files) => {
    assert.equal((await grooph(["export", put(join(files, "g.grooph.json"), fix), "--target", "claude-code", "--into", project])).code, 0);
    const refused = await grooph(["export", put(join(files, "s.grooph.json"), swapped), "--target", "claude-code", "--into", project]);
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.err, /^ {2}node:suite +removes a check, while a check the graph has not comes in/m);
    assert.ok(lines(refused.err).includes(NOT_JUDGED.swapped), refused.err);
    assert.match(refused.err, /^ {2}loop:fix-cycle\.stops +undoing it: raises the round cap from 2 to 5$/m);
    assert.ok(!refused.err.includes("tightens a brake"), "with a check swapped nothing is called a tightening");
    const hint = lines(refused.err).find((line) => line.startsWith("To place "))!;
    const names = [...hint.matchAll(/--allow ((?:node|edge|loop|policy|group|graph):\S+)/g)].map((m) => m[1]!);
    const placed = await grooph(["export", join(files, "s.grooph.json"), "--target", "claude-code", "--into", project, ...names.flatMap((name) => ["--allow", name])]);
    assert.equal(placed.code, 0, placed.err);
    assert.ok(above(placed.out).includes(NOT_JUDGED.swapped), placed.out);
  });
  // A gate's new answer, led to a new stop that halts: nothing is held, and it is named under the other sentence.
  const graph = fixture("review-loop");
  const withSkip = {
    ...graph,
    nodes: [...graph.nodes.map((node) => (node.id === "merge-gate" ? { ...node, options: [...(node as { options: string[] }).options, "skip"] } : node)), { id: "skipped", kind: "stop", name: "Skipped", outcome: "halt" }],
    edges: [...graph.edges, { id: "e-gate-skip", from: "merge-gate", to: "skipped", when: { verdict: "skip" } }],
  } as unknown as Graph;
  await withProject(async (project, files) => {
    assert.equal((await grooph(exportArgs(put(join(files, "g.grooph.json"), graph), project))).code, 0);
    const placed = await grooph(exportArgs(put(join(files, "skip.grooph.json"), withSkip), project));
    assert.equal(placed.code, 0, placed.err);
    assert.ok(above(placed.out).includes(NOT_JUDGED.new), placed.out);
    assert.ok(above(placed.out).some((line) => /^ {2}node:merge-gate\.options +undoing it: the gate would no longer offer "skip"$/.test(line)), placed.out);
    assert.equal(last(placed.out), NONE);
  });
});

test("a package of the other harness in the folder is said, and waits for the word; a graph for Codex is held as one for Claude Code is", async () => {
  const graph = fixture("review-loop");
  const codex = { ...graph, target: { harness: "codex" } } as Graph;
  await withProject(async (project, files) => {
    const forCodex = (file: string, ...more: string[]): string[] => ["export", file, "--target", "codex", "--into", project, ...more];
    const file = put(join(files, "c.grooph.json"), codex);
    assert.equal(last((await grooph(forCodex(file))).out), FIRST);
    assert.equal(last((await grooph(forCodex(file))).out), SAME);
    const looser = await grooph(forCodex(put(join(files, "c9.grooph.json"), withCap(codex, 9))));
    assert.equal(looser.code, 1);
    assert.match(looser.err, /^ {2}loop:review-cycle\.stops +raises the round cap from 4 to 9$/m);
    // The same graph for Claude Code, into the folder that holds its Codex package.
    const before = tree(project);
    const mixed = await grooph(exportArgs(put(join(files, "g.grooph.json"), graph), project));
    assert.equal(mixed.code, 1, mixed.out);
    assert.equal(lines(mixed.err)[0], "grooph: not compared, so nothing was written. The package there is this graph's for another harness, and its files would be left beside this one's: a mixed package.");
    assert.equal(tree(project), before);
    // The word for "not compared" does not answer for a brake: the kept graph reads, so a looser graph is still held by name.
    const loose = put(join(files, "g9.grooph.json"), withCap(graph, 9));
    const word = await grooph(exportArgs(loose, project, "--uncompared"));
    assert.equal(word.code, 1, word.out);
    assert.match(word.err, /^ {2}loop:review-cycle\.stops +raises the round cap from 4 to 9$/m);
    assert.equal(tree(project), before);
    const both = await grooph(exportArgs(loose, project, "--uncompared", "--allow", "loop:review-cycle.stops"));
    assert.equal(both.code, 0, both.err);
    assert.match(last(both.out), /^brakes: not compared \(--uncompared\)\. /);
  });
});

test("an export for Codex asks before it changes the model of an agent file in place, as one for Claude Code does", async () => {
  const codex = { ...fixture("review-loop"), target: { harness: "codex" } } as Graph;
  const { tomlModels } = await import("../src/commands/export.js");
  await withProject(async (project, files) => {
    const forCodex = (file: string, ...more: string[]): string[] => ["export", file, "--target", "codex", "--into", project, ...more];
    const file = put(join(files, "c.grooph.json"), codex);
    assert.equal((await grooph(forCodex(file))).code, 0);
    const before = tree(project);
    const other = await grooph(forCodex(file, "--models", "frontier=one,strong=two,fast=three"));
    assert.equal(other.code, 1, other.out);
    assert.match(lines(other.err)[0]!, /^grooph: this export would change the model of \d agent files? already in /);
    assert.ok(other.err.includes("--models, or GROOPH_MODELS_CODEX."), other.err);
    assert.equal(tree(project), before);
    const meant = await grooph(forCodex(file, "--models", "frontier=one,strong=two,fast=three", "--change-models"));
    assert.equal(meant.code, 0, meant.err);
    assert.match(meant.out, /^changed the model of \d agent files? that (was|were) already there \(--change-models\):$/m);
    // And back, with no map: the package's models would change again, so it asks again.
    assert.equal((await grooph(forCodex(file))).code, 1);
  });
  // The plain form grooph writes is read; any other way to say the key is not guessed at.
  const Q = String.fromCharCode(34);
  const line = (text: string): string => ["name = " + Q + "a" + Q, text, ""].join(LF);
  assert.deepEqual(tomlModels(line("model = " + Q + "gpt-x" + Q)), ["gpt-x"]);
  assert.deepEqual(tomlModels(line("model_reasoning_effort = " + Q + "high" + Q)), []);
  assert.deepEqual(tomlModels(line("model = " + Q + "a" + Q) + line("model = " + Q + "b" + Q)), ["a", "b"]);
  for (const odd of ["model = 'gpt-x'", Q + "model" + Q + " = " + Q + "gpt-x" + Q, "model = " + Q + Q + Q + "gpt-x" + Q + Q + Q, "model = gpt-x", "model=" + Q + "x" + Q + " junk"]) {
    assert.equal(tomlModels(line(odd)), "unread", odd);
  }
});

test("the help says what is compared, when it is not, and how to say yes", async () => {
  const help = await grooph(["export", "--help"]);
  assert.equal(help.code, 0);
  for (const piece of ["[--allow <change>]...", "[--uncompared]", "--allow <change>", "--uncompared", "for the same graph id", "can be read as a graph", "until each is asked for with", "only on a person's word", "The last line of the output opens"]) {
    assert.ok(help.out.includes(piece), piece);
  }
});

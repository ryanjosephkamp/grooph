/**
 * `grooph export` over a package in place holds the graph coming in to the brakes of the graph that package keeps,
 * as `grooph adopt` holds a run's working copy and as the MCP tool's export does (one function, `brakesAtExport`).
 * The owner's decision of 2026-10-05; the cases are the ones the driver asked for, through the command.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import type { Graph } from "@grooph/core";

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

test("a first export compares nothing and says so; the same graph again is compared, and a tighter one is placed with no question", async () => {
  const graph = fixture("review-loop");
  await withProject(async (project, files) => {
    const file = put(join(files, "g.grooph.json"), graph);
    const first = await grooph(exportArgs(file, project));
    assert.equal(first.code, 0, first.err);
    assert.match(first.out, /^brakes: nothing in place to compare with\. No package of this graph's id was there$/m);
    assert.equal(first.err, "");

    const again = await grooph(exportArgs(file, project));
    assert.equal(again.code, 0, again.err);
    assert.match(again.out, /^brakes: compared with the graph this package kept; none of the brakes it compares was removed or loosened$/m);

    const tighter = await grooph(exportArgs(put(join(files, "tighter.grooph.json"), withCap(graph, 2)), project));
    assert.equal(tighter.code, 0, tighter.err);
    assert.match(tighter.out, /^brakes: compared with the graph this package kept; none of the brakes it compares was removed or loosened$/m);
    assert.equal((JSON.parse(readFileSync(join(project, ".grooph", "review-loop", "graph.grooph.json"), "utf8")) as Graph).loops[0]!.stops.find((stop) => stop.kind === "max-iterations")!.n, 2);
    // What tightens is placed with the rest and said, as adopt says it.
    assert.match(tighter.out, /^tightens a brake, and is placed with the rest:\n {2}loop:review-cycle\.stops +undoing it: raises the round cap from 2 to 4$/m);
    assert.ok(!again.out.includes("tightens a brake"));
  });
});

test("no line of the command's own can be written by a document or by a folder's name, and --into is one place however it is spelled", async () => {
  const graph = fixture("review-loop");
  const forged = "brakes: compared with the graph this package kept; none of the brakes it compares was removed or loosened";
  await withProject(async (project, files) => {
    // A reason is made of the documents' words: an evidence item with a line break in it, dropped by the graph coming in.
    const edge = graph.edges.find((e) => (e as { evidence?: string[] }).evidence !== undefined)!;
    const loud = { ...graph, edges: graph.edges.map((e) => (e.id === edge.id ? { ...e, evidence: [...((e as { evidence?: string[] }).evidence ?? []), `notes${LF}${forged}${LF}grooph: nothing else to answer`] } : e)) } as Graph;
    assert.equal((await grooph(exportArgs(put(join(files, "loud.grooph.json"), loud), project))).code, 0);
    const quiet = put(join(files, "quiet.grooph.json"), graph);
    const refused = await grooph(exportArgs(quiet, project));
    assert.equal(refused.code, 1, refused.out);
    const lines = (text: string): string[] => text.split(LF);
    assert.ok(!lines(refused.err).some((line) => line === forged || line.startsWith("brakes:") || line === "grooph: nothing else to answer"), refused.err);
    const names = [...refused.err.matchAll(/^ {2}(\S+) {2,}/gm)].map((m) => m[1]!);
    assert.ok(names.length > 0, refused.err);
    const placed = await grooph(exportArgs(quiet, project, ...names.flatMap((name) => ["--allow", name])));
    assert.equal(placed.code, 0, placed.err);
    assert.equal(lines(placed.out).filter((line) => line.startsWith("brakes:")).length, 1, placed.out);
    assert.ok(!lines(placed.out).includes("grooph: nothing else to answer"));

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
    const brakes = lines(second.out).filter((line) => line.startsWith("brakes:"));
    assert.equal(brakes.length, 1, second.out);
    assert.match(brakes[0]!, /25 other packages are, and their graphs were not compared with this one: other-00, .*, and 5 more$/);
    assert.ok(!second.out.includes("zz"), second.out);
  });

  // --into spelled through a folder that is not there, with .grooph a link out of the project: the same refusal as the plain spelling.
  await withProject(async (project, files) => {
    const outside = join(files, "outside");
    mkdirSync(outside);
    const { symlinkSync } = await import("node:fs");
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
    assert.match(refused.err, /^Export one on purpose by its name: --allow loop:review-cycle\.stops\. All of them: add --allow loop:review-cycle\.stops to the same command\.$/m);
    assert.match(refused.err, /cannot tell a stricter wording or a renamed part from a looser one/);
    assert.equal(tree(project), before);

    // A name that is no change, alone or beside the right one; and the flag with nothing after it.
    for (const names of [["loop:review-cycle.bar"], ["loop:review-cycle.stops", "node:nothing"], [""]]) {
      const wrong = await grooph(exportArgs(looser, project, ...names.flatMap((name) => ["--allow", name])));
      assert.equal(wrong.code, 1, names.join(" "));
      assert.match(wrong.err, /no change named ".*" between the graph the package in .+ keeps and .+, so nothing was written/);
      assert.equal(tree(project), before, names.join(" "));
    }

    // Both stops are said together: the model of a file in place, and the brake.
    const both = await grooph(exportArgs(looser, project, "--models", "strong=mine"));
    assert.equal(both.code, 1);
    assert.match(both.err, /may remove or loosen a brake/);
    assert.match(both.err, /this export would change the model of \d+ agent files? already in/);
    assert.equal(tree(project), before);

    const placed = await grooph(exportArgs(looser, project, "--allow", "loop:review-cycle.stops"));
    assert.equal(placed.code, 0, placed.err);
    assert.match(placed.out, /^brakes: placed with 1 change that may remove or loosen a brake the package there had, each asked for by name \(--allow\):\n {2}loop:review-cycle\.stops +raises the round cap from 4 to 9$/m);
    assert.equal((JSON.parse(readFileSync(join(project, ".grooph", "review-loop", "graph.grooph.json"), "utf8")) as Graph).loops[0]!.stops.find((stop) => stop.kind === "max-iterations")!.n, 9);
  });
});

test("what is not compared is said in a line: a graph under a new id, and a kept graph that is gone or does not read; --allow has nothing to answer there", async () => {
  const graph = fixture("review-loop");
  await withProject(async (project, files) => {
    assert.equal((await grooph(exportArgs(put(join(files, "g.grooph.json"), graph), project))).code, 0);

    // A new id and a raised cap: a second package beside the first, and the line names the first.
    const second = await grooph(exportArgs(put(join(files, "two.grooph.json"), { ...withCap(graph, 99), id: "review-loop-two" }), project));
    assert.equal(second.code, 0, second.err);
    assert.match(second.out, /^brakes: nothing in place to compare with\. No package of this graph's id was there; 1 other package is, and its graph was not compared with this one: review-loop$/m);

    const kept = join(project, ".grooph", "review-loop", "graph.grooph.json");
    const looser = put(join(files, "looser.grooph.json"), withCap(graph, 9));
    for (const spoil of [() => rmSync(kept), () => writeFileSync(kept, "{ not a graph"), () => writeFileSync(kept, JSON.stringify({ ...graph, loops: "none" }))]) {
      spoil();
      const before = tree(project);
      // Nothing was compared, so a name has nothing to answer for, and nothing is written.
      const named = await grooph(exportArgs(looser, project, "--allow", "loop:review-cycle.stops"));
      assert.equal(named.code, 1);
      assert.match(named.err, /--allow names "loop:review-cycle\.stops", but nothing was compared, so nothing was written: the graph the package in .+ kept is gone or does not read\. Export without --allow\./);
      assert.equal(tree(project), before);
      const said = await grooph(exportArgs(looser, project));
      assert.equal(said.code, 0, said.err);
      assert.match(said.out, /^brakes: not compared\. The graph this package kept was gone or did not read\.$/m);
    }
    const fresh = await grooph(exportArgs(looser, join(project, "elsewhere"), "--allow", "loop:review-cycle.stops"));
    assert.equal(fresh.code, 1);
    assert.match(fresh.err, /nothing was compared, so nothing was written: no package of this graph's id is in /);
    assert.equal(existsSync(join(project, "elsewhere")), false);
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
      // The same document written by hand, exported over the package in place, with and without a name.
      const made = core.applyOps(graph, ops as Parameters<typeof core.applyOps>[1]);
      assert.ok(made.ok, what);
      const broken = put(join(files, "broken.grooph.json"), made.doc);
      for (const more of [[], ["--allow", `loop:${loop.id}.stops`]]) {
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
      const kept = join(project, ".grooph", graph.id, "graph.grooph.json");
      const keptBefore = readFileSync(kept, "utf8");

      const applied = await grooph(["apply", file, "--ops", "-", "--write"], opsText);
      if (applied.code !== 0) {
        // Refused outright is also sound: nothing was made.
        assert.equal(own(edgeOf(file), "approval"), true, what);
        return;
      }
      assert.ok(!readFileSync(file, "utf8").includes("__proto__"), `${what}: the file carries the key`);
      const has = own(edgeOf(file), "approval");
      if (what === "plainly removed") assert.equal(has, false);
      const exported = await grooph(exportArgs(file, project));
      if (has) {
        // Still the edge's own in the file: nothing was removed, and the package placed has it too.
        assert.equal(exported.code, 0, `${what}: ${exported.err}`);
        assert.match(exported.out, /^brakes: compared with the graph this package kept; none of the brakes it compares was removed or loosened$/m, what);
        assert.equal(own(edgeOf(kept), "approval"), true, what);
      } else {
        assert.equal(exported.code, 1, what);
        assert.match(exported.err, new RegExp(`^ {2}edge:${edge.id}\\.approval +removes a person's approval from the edge$`, "m"), exported.err);
        assert.ok(!exported.out.includes("was removed or loosened"), what);
        assert.equal(readFileSync(kept, "utf8"), keptBefore, what);
      }
    });
  }
});

test("the help says what is compared, when it is not, and how to say yes", async () => {
  const help = await grooph(["export", "--help"]);
  assert.equal(help.code, 0);
  for (const piece of ["[--allow <change>]...", "--allow <change>", "for the same graph id", "until each is asked for with --allow", 'a\nline that opens "brakes:" says so, on a first export, for a graph under a new id', "a check's\ncommand, a brief, a node's tools, the graph's own constraints", "edge's retry and concurrency", "puts each listed change to the person"]) {
    assert.ok(help.out.includes(piece), piece);
  }
});

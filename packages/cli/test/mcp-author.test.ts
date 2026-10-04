/**
 * The authoring tools of grooph's MCP server (slice 0078): an agent with nothing but tool
 * calls makes a graph, changes it, checks it, sees it and hands back a link, and no file
 * has to exist. Then the file forms, and what the tools refuse.
 */

import assert from "node:assert/strict";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { test } from "node:test";

import { IMPLEMENTED_CODES, OP_NAMES, canonicalize, decodeSharePayload, parseGraph, parseGraphText, sharePayloadFrom, validate, type Graph, type InflateRaw } from "@grooph/core";

import { FIXES, fixLines } from "../src/fixes.js";
import { handle, type McpContext } from "../src/mcp.js";
import { within } from "../src/mcp-author.js";
import { defaultRegistryEnv } from "../src/registry.js";

const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("workspace root not found");
})();

const inflateRaw: InflateRaw = (bytes, maxOutput) => inflateRawSync(bytes, { maxOutputLength: maxOutput });

/** A project folder of its own, and a user template folder that is empty, so only the built-in library answers. */
const withProject = async (fn: (ctx: McpContext, outside: string) => Promise<void> | void, extra: Partial<McpContext> = {}): Promise<void> => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "grooph-author-test-")));
  const project = join(root, "project");
  mkdirSync(project);
  try {
    await fn({ project, version: "9.9.9", harness: "claude-code", session: "sess-1", now: () => new Date(Date.UTC(2026, 9, 4)), registry: { ...defaultRegistryEnv(), cwd: project, userDir: join(root, "no-user-templates") }, ...extra }, root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

type Content = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
type Result = { content: Content[]; structuredContent?: Record<string, unknown>; isError?: boolean };
const call = async (ctx: McpContext, name: string, args: unknown): Promise<Result> =>
  ((await handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, ctx)) as { result: Result }).result;
const textOf = (r: Result): string => (r.content[0] as { text: string }).text;
const graphOf = (r: Result): Graph => r.structuredContent!["graph"] as Graph;
const fixture = (...path: string[]): Graph => JSON.parse(readFileSync(join(repoRoot, "fixtures", ...path), "utf8")) as Graph;

/** What every refusal must carry: an error result whose last line says what to call next. */
const refused = (r: Result, said: RegExp): void => {
  assert.equal(r.isError, true, textOf(r));
  assert.match(textOf(r), said);
  assert.match(textOf(r).split("\n").at(-1)!, /^next: \S/);
  assert.equal(r.structuredContent!["ok"], false);
  assert.equal(`next: ${String(r.structuredContent!["next"])}`, textOf(r).split("\n").at(-1));
};

test("tools alone, no file: a template is named, filled, changed, checked, drawn and shared, and the link opens to the same graph", async () => {
  await withProject(async (ctx) => {
    // The library, with when to use each and its shape.
    const list = await call(ctx, "grooph_templates", {});
    const rows = list.structuredContent!["templates"] as { id: string; kind: string; whenToUse: string; shape: string; slots: string[]; source: string }[];
    assert.ok(rows.length >= 15 && rows.every((r) => r.source === "built-in" && r.whenToUse.length > 20 && /agent/.test(r.shape)));
    assert.deepEqual(rows.find((r) => r.id === "grind-loop")!.slots, ["task", "test-command"]);
    assert.match(textOf(list), /^grind-loop · Grind loop · low · fast · light\n {2}when: .+\n(?: {2}not for: .+\n)? {2}shape: 1 agent · 1 check · 1 loop · up to 5 rounds · 30 minutes\n {2}slots: task, test-command$/m);
    assert.match(textOf(list), /next: grooph_templates with id .*the right answer is no graph: say so\.$/);

    // One in full: the questions its slots ask, and the document.
    const one = await call(ctx, "grooph_templates", { id: "grind-loop" });
    assert.match(textOf(one), /^grind-loop · Grind loop \(graph, version \d+, built-in\)\n/);
    assert.match(textOf(one), /\n {2}test-command: Which command runs the tests\? {2}\(e\.g\. pnpm test\)\n/);
    assert.equal((one.structuredContent!["template"] as Graph).template!.kind, "graph");
    assert.equal(parseGraphText((one.content[1] as { text: string }).text).doc!.id, "grind-loop");

    // A graph from it, with one slot left out: the question comes back, and the document holds the slot.
    const half = await call(ctx, "grooph_use_template", { id: "grind-loop", name: "Fix the flaky test", values: { task: "make the checkout test pass ten times in a row" } });
    assert.equal(half.isError, undefined);
    assert.deepEqual(half.structuredContent!["unfilled"], ["test-command"]);
    assert.match(textOf(half), /1 slot still unfilled.*\n {2}\{\{test-command\}\} {2}Which command runs the tests\?.*\[at: fix-the-flaky-test, tests\]\n/);
    assert.match(textOf(half), /next: get the values for test-command from the person/);
    // Export refuses it, by the rule's code, with what to do.
    const early = await call(ctx, "grooph_validate", { graph: graphOf(half) });
    assert.equal(early.structuredContent!["ok"], false);
    assert.match(textOf(early), /^graph fix-the-flaky-test\n1 error, 0 warnings\nerror {2}E_UNFILLED_SLOT .*\nfix {2}E_UNFILLED_SLOT {2}A \{\{slot\}\} is still in the text/);
    assert.match(textOf(early), /\nnext: fix what is listed with grooph_apply .*then grooph_validate$/);

    // With every value.
    const made = await call(ctx, "grooph_use_template", { id: "grind-loop", name: "Fix the flaky test", values: { task: "make the checkout test pass ten times in a row", "test-command": "pnpm test checkout" } });
    let graph = graphOf(made);
    assert.equal(graph.id, "fix-the-flaky-test");
    assert.deepEqual(graph.lineage, { pattern: "grind-loop", from: `grind-loop@${(one.structuredContent!["template"] as Graph).version}` });
    assert.deepEqual(made.structuredContent!["unfilled"], []);
    // The document is also there as text, canonical, for a client that shows a model only text.
    assert.equal((made.content[1] as { text: string }).text, canonicalize(graph));
    assert.match(textOf(made), /\nno issues\nnext: grooph_validate \(pass "graph": "fix-the-flaky-test"; the server remembers it\), which adds the rules a package must pass/);

    // Change it: a tighter round cap and a stronger builder. The ids an operation made come back.
    const changed = await call(ctx, "grooph_apply", {
      graph,
      ops: [
        { op: "setStop", loop: "grind", index: 0, stop: { kind: "max-iterations", n: 3 } },
        { op: "updateNode", id: "builder", set: { model: { tier: "strong" } } },
        { op: "addNode", kind: "human-gate", name: "Ship it", set: { prompt: "The tests pass. Ship?" } },
      ],
      forExport: true,
    });
    assert.equal(changed.isError, undefined);
    assert.deepEqual(changed.structuredContent!["ids"], [null, null, "ship-it"]);
    assert.match(textOf(changed), /^applied 3 operations to "fix-the-flaky-test"; ids: ship-it\n/);
    // A node nothing leads to is named, by code, and the graph still comes back: a graph is built in steps.
    assert.match(textOf(changed), /warning {2}W_UNREACHABLE_NODE|no issues/);
    graph = graphOf(changed);
    assert.equal(graph.loops[0]!.stops[0]!.kind === "max-iterations" && graph.loops[0]!.stops[0]!.n, 3);
    graph = graphOf(await call(ctx, "grooph_apply", { graph, ops: [{ op: "removeNode", id: "ship-it" }], forExport: true }));

    // Check it for export.
    const checked = await call(ctx, "grooph_validate", { graph });
    assert.equal(textOf(checked), 'graph fix-the-flaky-test\nno issues\nnext: grooph_share (pass "graph": "fix-the-flaky-test"; the server remembers it) for a link the person opens, grooph_picture to show it here, grooph_export for the package');
    // The data carries the same lines: a client that shows a model the data in place of the text loses nothing.
    assert.deepEqual(checked.structuredContent, { text: textOf(checked), ok: true, issues: [] });

    // What bounds it, and its shape.
    const explained = await call(ctx, "grooph_explain", { graph });
    assert.match(textOf(explained), /^fix-the-flaky-test\n\nLoop "Grind": at most 3 rounds\.\n {2}stops after 3 rounds, the run halts and reports to a person\n/);
    assert.match(textOf(explained), /\nWorst case: at most 3 rounds of looping in all/);
    assert.equal((explained.structuredContent as { worstCaseRounds: number }).worstCaseRounds, 3);
    const shape = await call(ctx, "grooph_shape", { graph });
    assert.equal(textOf(shape), "fix-the-flaky-test: 1 agent · 1 check · 1 loop · up to 3 rounds · 30 minutes\ntiers: 1 strong");
    assert.equal((shape.structuredContent as { agents: number }).agents, 1);

    // See it: SVG text every time, the same bytes for the same document; a PNG only when asked.
    const drawn = await call(ctx, "grooph_picture", { graph });
    const svg = (drawn.content[1] as { text: string }).text;
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" class="grooph-picture"/);
    assert.equal(drawn.content.length, 2);
    assert.equal(((await call(ctx, "grooph_picture", { graph })).content[1] as { text: string }).text, svg);
    assert.notEqual(((await call(ctx, "grooph_picture", { graph, theme: "dark" })).content[1] as { text: string }).text, svg);

    // Share it: a link the app opens, and the embed line. The link unpacks to this graph.
    const shared = await call(ctx, "grooph_share", { graph });
    const link = shared.structuredContent!["link"] as string;
    assert.match(link, /^https:\/\/ryanjosephkamp\.github\.io\/grooph\/#\/open\?d=[A-Za-z0-9_-]+$/);
    assert.ok(textOf(shared).split("\n").includes(link), "the link is on a line of its own");
    assert.match(shared.structuredContent!["embed"] as string, /^<iframe src="https:\/\/ryanjosephkamp\.github\.io\/grooph\/#\/embed\?d=.*data-grooph-embed><\/iframe>\n<script>/);
    const opened = decodeSharePayload(sharePayloadFrom(link)!, inflateRaw);
    assert.ok(opened.ok && opened.envelope.kind === "graph");
    assert.equal(canonicalize(opened.envelope.doc as Graph), canonicalize(graph));
    assert.match((await call(ctx, "grooph_share", { graph, base: "http://localhost:4362/grooph/" })).structuredContent!["link"] as string, /^http:\/\/localhost:4362\/grooph\/#\/open\?d=/);

    // The package, as files in the reply; the graph inside it is this graph.
    const exported = await call(ctx, "grooph_export", { graph });
    const files = exported.structuredContent!["files"] as Record<string, string>;
    assert.deepEqual(Object.keys(files).sort(), [
      ".claude/agents/fix-the-flaky-test--builder.md",
      ".claude/skills/fix-the-flaky-test/SKILL.md",
      ".grooph/fix-the-flaky-test/KICKOFF.md",
      ".grooph/fix-the-flaky-test/LEAD.md",
      ".grooph/fix-the-flaky-test/MAPPING.md",
      ".grooph/fix-the-flaky-test/graph.grooph.json",
    ]);
    assert.equal(files[".grooph/fix-the-flaky-test/graph.grooph.json"], canonicalize(graph));
    assert.deepEqual(JSON.parse((exported.content[1] as { text: string }).text), files);
    assert.match(textOf(exported), /\nkickoff \(the prompt that starts the run\):\nRun the grooph graph `fix-the-flaky-test`/);
    assert.match(textOf(exported), /next: .*do not start the run\.$/);

    // Through all of it, nothing was written anywhere.
    assert.equal(existsSync(join(ctx.project, ".grooph")), false);
    assert.equal(existsSync(join(ctx.project, ".claude")), false);
  });
});

test("from nothing: new, then apply builds the review loop the fixtures hold, byte for byte", async () => {
  await withProject(async (ctx) => {
    const empty = await call(ctx, "grooph_new", { name: "Review loop" });
    assert.match(textOf(empty), /^graph "review-loop": empty\nnext: grooph_apply with "graph": "review-loop" and "ops", for example \[/);
    const ops = JSON.parse(readFileSync(join(repoRoot, "fixtures", "ops", "review-loop.ops.json"), "utf8")) as unknown[];
    const built = await call(ctx, "grooph_apply", { graph: graphOf(empty), ops, forExport: true });
    assert.equal(canonicalize(graphOf(built)), readFileSync(join(repoRoot, "fixtures", "valid", "review-loop.grooph.json"), "utf8"));
    assert.equal(built.structuredContent!["ok"], true);
    assert.match(textOf(built), /\n0 errors, 1 warning\nwarning {2}W_HOMOGENEOUS_CRITICS .*\nfix {2}W_HOMOGENEOUS_CRITICS {2}A critic runs on the same tier/);
    // A goal and a target given at the start land in the document.
    const aimed = graphOf(await call(ctx, "grooph_new", { name: "Aimed", goal: "Ship it", target: "claude-code" }));
    assert.equal(aimed.goal, "Ship it");
    assert.deepEqual(aimed.target, { harness: "claude-code" });
    // A document handed over as text, as some clients send it, is read the same.
    assert.equal((await call(ctx, "grooph_shape", { graph: JSON.stringify(aimed) })).isError, undefined);
  });
});

test("an operation that cannot apply is named by its index, and nothing is applied", async () => {
  await withProject(async (ctx) => {
    const graph = fixture("valid", "review-loop.grooph.json");
    const bad = await call(ctx, "grooph_apply", { graph, ops: [{ op: "setGraphName", name: "Renamed" }, { op: "updateNode", id: "critc", set: { effort: "high" } }] });
    refused(bad, /^ops\[1\] updateNode: "id": no node "critc"; did you mean "critic"\?\nNo operation was applied; the graph is unchanged\.\nnext: correct ops\[1\] and send the whole list again$/);
    assert.deepEqual(bad.structuredContent!["error"], { index: 1, op: "updateNode", message: '"id": no node "critc"; did you mean "critic"?' });
    assert.equal(bad.content.length, 1, "no document comes back from a refused change");

    refused(await call(ctx, "grooph_apply", { graph, ops: [{ op: "addNod", kind: "agent" }] }), /^ops\[0\] addNod: unknown op "addNod"; did you mean "addNode"\?/);
    refused(await call(ctx, "grooph_apply", { graph, ops: [] }), /needs "ops"/);
    refused(await call(ctx, "grooph_apply", { graph }), /needs "ops"/);
    // A patch the schema does not take: the operations applied, the result is refused, by code.
    const unschematic = await call(ctx, "grooph_apply", { graph, ops: [{ op: "updateNode", id: "builder", set: { outputs: "src/" } }] });
    refused(unschematic, /^The operations applied, but the result does not match the schema, so the graph is unchanged:\nerror {2}E_SCHEMA .*outputs/);
    assert.match(textOf(unschematic), /\nfix {2}E_SCHEMA {2}/);
  });
});

test("a refusal carries the rule's code, what to do about it, and a next: line", async () => {
  await withProject(async (ctx) => {
    const noStop = fixture("invalid", "E_CYCLE_NO_STOP", "loop-without-stop.grooph.json");
    // A graph with errors is not shared, and not exported: each rule is named.
    for (const tool of ["grooph_share", "grooph_export"]) {
      const r = await call(ctx, tool, { graph: noStop });
      refused(r, /\nerror {2}E_CYCLE_NO_STOP .*\n(?:.*\n)*fix {2}E_CYCLE_NO_STOP {2}A cycle no loop with a stop covers/);
      assert.ok((r.structuredContent!["issues"] as { code: string }[]).some((i) => i.code === "E_CYCLE_NO_STOP"), tool);
    }
    // It is still explained, counted and drawn: looking at a broken graph is how it gets fixed.
    assert.equal((await call(ctx, "grooph_shape", { graph: noStop })).isError, undefined);
    assert.equal((await call(ctx, "grooph_picture", { graph: noStop })).isError, undefined);

    // No target, at export: the code, the operation that fixes it.
    const { target: _target, ...untargeted } = fixture("valid", "fix-until-green.grooph.json");
    refused(await call(ctx, "grooph_export", { graph: untargeted }), /^error {2}E_NO_TARGET .*\nfix {2}E_NO_TARGET {2}Say which harness.*\{"op":"setTarget","harness":"claude-code"\}\.\nnext: grooph_apply with \{"op":"setTarget","harness":"claude-code"\}/);
    refused(await call(ctx, "grooph_export", { graph: fixture("valid", "fix-until-green.grooph.json"), target: "cursor" }), /^Unknown target "cursor"; known targets: claude-code/);

    // Not a graph at all: every schema issue, by code.
    refused(await call(ctx, "grooph_explain", { graph: { grooph: 0, id: "Wrong Id", name: "x", version: 1, nodes: [], edges: [], loops: [] } }), /is not a graph document grooph can read:\nerror {2}E_SCHEMA {2}\/id: /);
    // A template is not exported; the code says what to do instead.
    const template = JSON.parse(readFileSync(join(repoRoot, "patterns", "grind-loop.grooph.json"), "utf8")) as Graph;
    refused(await call(ctx, "grooph_export", { graph: template }), /error {2}E_IS_TEMPLATE .*\n(?:.*\n)*fix {2}E_IS_TEMPLATE {2}This document is a template.*grooph_use_template/);

    // The wrong kind of document, the wrong arguments.
    const map = JSON.parse(readFileSync(join(repoRoot, "fixtures", "maps", "valid", "owner-operation-2026-09-30.grooph-map.json"), "utf8")) as unknown;
    refused(await call(ctx, "grooph_apply", { graph: map, ops: [{ op: "setTarget" }] }), /is an operation map, not a graph/);
    refused(await call(ctx, "grooph_shape", {}), /needs "graph" \(a graph's id, or the document as JSON\) or "path" \(a file\)/);
    refused(await call(ctx, "grooph_shape", { graph: fixture("valid", "review-loop.grooph.json"), path: "x.grooph.json" }), /takes "graph" \(the document\) or "path" \(a file\), not both/);
    refused(await call(ctx, "grooph_shape", { graph: "{ not json" }), /"graph" is text that is neither a graph's id nor JSON/);
    refused(await call(ctx, "grooph_shape", { graph: [1] }), /"graph" must be a graph's id or the document as a JSON object, got a list/);
    refused(await call(ctx, "grooph_shape", { path: "nope.grooph.json" }), /^No such file: nope\.grooph\.json/);
    refused(await call(ctx, "grooph_templates", { id: "grind-lop" }), /^No template "grind-lop" .*did you mean "grind-loop"\?/);
    refused(await call(ctx, "grooph_use_template", { id: "grind-loop", values: { tsk: "x" } }), /^template "grind-loop" has no slot "tsk"; did you mean "task"\?/);
    refused(await call(ctx, "grooph_use_template", { id: "human-gated-irreversible" }), /is a fragment, not a whole graph/);
    refused(await call(ctx, "grooph_use_template", {}), /needs "id"/);
    refused(await call(ctx, "grooph_new", {}), /needs "name"/);
    refused(await call(ctx, "grooph_picture", { graph: fixture("valid", "review-loop.grooph.json"), theme: "sepia" }), /"theme" is light, dark or auto/);
    refused(await call(ctx, "grooph_share", { graph: fixture("valid", "review-loop.grooph.json"), base: "localhost:4362" }), /"base" must be an http\(s\) or file URL/);
    // validate says what a proposal set is for, and where it is checked.
    const set = JSON.parse(readFileSync(join(repoRoot, "fixtures", "proposals", "valid", "csv-export", "csv-export.grooph-proposals.json"), "utf8")) as unknown;
    refused(await call(ctx, "grooph_validate", { graph: set }), /is a proposal set, not a graph.*\nnext: grooph_share checks the set/);
  });
});

test("every rule has a line that says what to do, and the tools print it beside the rule", () => {
  assert.deepEqual(Object.keys(FIXES).sort(), [...IMPLEMENTED_CODES].sort());
  for (const [code, line] of Object.entries(FIXES)) assert.ok(line.length > 40 && !line.includes("\n"), code);
  // The operation a line names is one the vocabulary has.
  for (const [code, line] of Object.entries(FIXES)) {
    for (const [, op] of line.matchAll(/"op":"([A-Za-z]+)"/g)) assert.ok((OP_NAMES as readonly string[]).includes(op!), `${code} names ${op}`);
  }
  assert.deepEqual(fixLines([{ code: "E_NO_GOAL" }, { code: "E_NO_GOAL" }, { code: "E_NOT_A_RULE" }, { code: "E_NO_TARGET" }]).map((l) => l.split("  ")[1]), ["E_NO_GOAL", "E_NO_TARGET"]);
});

test("where a fix line gives an operation outright, applying it clears the rule on the fixture that fires it", async () => {
  await withProject(async (ctx) => {
    const cases: [code: string, file: string[], ops: unknown[]][] = [
      ["E_NO_TARGET", ["invalid", "E_NO_TARGET"], [{ op: "setTarget", harness: "claude-code" }]],
      ["E_NO_GOAL", ["invalid", "E_NO_GOAL"], [{ op: "setGraphField", key: "goal", value: "Make the tests pass." }]],
    ];
    for (const [code, dir, ops] of cases) {
      const folder = join(repoRoot, "fixtures", ...dir);
      const { readdirSync } = await import("node:fs");
      const graph = JSON.parse(readFileSync(join(folder, readdirSync(folder).find((f) => f.endsWith(".grooph.json"))!), "utf8")) as Graph;
      assert.ok(validate(parseGraph(graph).doc!, { forExport: true }).some((i) => i.code === code), `${code} fires first`);
      assert.match(FIXES[code as keyof typeof FIXES], new RegExp(`"op":"${(ops[0] as { op: string }).op}"`));
      const after = await call(ctx, "grooph_apply", { graph, ops, forExport: true });
      assert.ok(!(after.structuredContent!["issues"] as { code: string }[]).some((i) => i.code === code), `${code} is gone`);
    }
  });
});

test("the file forms: path reads, out writes, and only inside the project folder", async () => {
  await withProject(async (ctx, root) => {
    // new writes a file, and never over one.
    const made = await call(ctx, "grooph_new", { name: "Scratch", goal: "Try it.", target: "claude-code", out: "graphs/scratch.grooph.json" });
    assert.match(textOf(made), /\nwrote graphs\/scratch\.grooph\.json\n/);
    const file = join(ctx.project, "graphs", "scratch.grooph.json");
    assert.equal(readFileSync(file, "utf8"), canonicalize(graphOf(made)));
    refused(await call(ctx, "grooph_new", { name: "Scratch", out: "graphs/scratch.grooph.json" }), /^graphs\/scratch\.grooph\.json already exists, and this tool does not replace a file it did not read\./);
    refused(await call(ctx, "grooph_use_template", { id: "ralph-loop", out: "graphs/scratch.grooph.json" }), /already exists/);

    // apply reads the file and may write the file it read; another existing file it will not replace.
    const ops = [
      { op: "addNode", kind: "agent", name: "Builder", set: { role: "builder", brief: "Do it.", outputs: ["src/"], allow: ["read-files", "edit-files"] } },
      { op: "addNode", kind: "stop", name: "Done" },
      { op: "connect", from: "builder", to: "done" },
    ];
    writeFileSync(join(ctx.project, "graphs", "other.grooph.json"), "{}");
    refused(await call(ctx, "grooph_apply", { path: "graphs/scratch.grooph.json", out: "graphs/other.grooph.json", ops }), /graphs\/other\.grooph\.json already exists/);
    assert.equal(readFileSync(join(ctx.project, "graphs", "other.grooph.json"), "utf8"), "{}");
    const applied = await call(ctx, "grooph_apply", { path: "graphs/scratch.grooph.json", out: "graphs/scratch.grooph.json", ops, forExport: true });
    assert.match(textOf(applied), /\nno issues\nwrote graphs\/scratch\.grooph\.json\n/);
    assert.equal(parseGraphText(readFileSync(file, "utf8")).doc!.nodes.length, 2);
    // A failing operation leaves the file as it was.
    const before = readFileSync(file, "utf8");
    refused(await call(ctx, "grooph_apply", { path: "graphs/scratch.grooph.json", out: "graphs/scratch.grooph.json", ops: [{ op: "removeNode", id: "nobody" }] }), /^ops\[0\] removeNode/);
    assert.equal(readFileSync(file, "utf8"), before);

    // The readers take a path, relative to the project or absolute.
    assert.match(textOf(await call(ctx, "grooph_shape", { path: "graphs/scratch.grooph.json" })), /^scratch: 1 agent · no loop/);
    assert.match(textOf(await call(ctx, "grooph_explain", { path: file })), /^scratch\n\nLoops: none\./);
    assert.match((await call(ctx, "grooph_share", { path: "graphs/scratch.grooph.json" })).structuredContent!["link"] as string, /#\/open\?d=/);

    // A proposal set on disk names its candidates by file; share reads them from beside it.
    const set = join(repoRoot, "fixtures", "proposals", "valid", "csv-export", "csv-export.grooph-proposals.json");
    const compared = await call(ctx, "grooph_share", { path: set });
    assert.equal(compared.structuredContent!["kind"], "proposals");
    assert.match(textOf(compared), /^csv-export · .* · 3 candidates: /);

    // The picture as a file: SVG, and PNG when the renderer is installed; a picture replaces a picture.
    assert.match(textOf(await call(ctx, "grooph_picture", { path: "graphs/scratch.grooph.json", out: "pictures/scratch.svg" })), /\nwrote pictures\/scratch\.svg\n/);
    assert.match(readFileSync(join(ctx.project, "pictures", "scratch.svg"), "utf8"), /^<svg /);
    assert.equal((await call(ctx, "grooph_picture", { path: "graphs/scratch.grooph.json", out: "pictures/scratch.svg", theme: "dark" })).isError, undefined);
    refused(await call(ctx, "grooph_picture", { path: "graphs/scratch.grooph.json", out: "pictures/scratch.pdf" }), /a picture is an SVG or a PNG/);
    refused(await call(ctx, "grooph_picture", { path: "graphs/scratch.grooph.json", out: "graphs/scratch.grooph.json" }), /a picture is an SVG or a PNG/);
    const png = await call(ctx, "grooph_picture", { path: "graphs/scratch.grooph.json", png: true, out: "pictures/scratch.png" });
    if (png.isError) assert.match(textOf(png), /^Could not make a PNG: .*\nnext: the SVG is the same drawing/);
    else {
      assert.deepEqual([...readFileSync(join(ctx.project, "pictures", "scratch.png")).subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
      const image = png.content.find((c) => c.type === "image") as { data: string; mimeType: string };
      assert.equal(image.mimeType, "image/png");
      assert.deepEqual([...Buffer.from(image.data, "base64").subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    }

    // export into the project: the files land, the reply lists them and does not repeat their contents.
    const placed = await call(ctx, "grooph_export", { path: "graphs/scratch.grooph.json", into: "." });
    assert.match(textOf(placed), /^package for claude-code: 6 files, written into \.\n/);
    assert.equal(placed.content.length, 1);
    assert.ok(existsSync(join(ctx.project, ".grooph", "scratch", "LEAD.md")) && existsSync(join(ctx.project, ".claude", "agents", "scratch--builder.md")));
    assert.match(textOf(placed), /next: tell the person what was placed and give them the kickoff; do not start the run\./);

    // Nothing is written outside the project: not by climbing, not by an absolute path, not through a link.
    const elsewhere = join(root, "elsewhere");
    mkdirSync(elsewhere);
    symlinkSync(elsewhere, join(ctx.project, "way-out"));
    symlinkSync(join(elsewhere, "not-there-yet.grooph.json"), join(ctx.project, "dangling.grooph.json"));
    for (const out of ["../escaped.grooph.json", join(elsewhere, "abs.grooph.json"), "way-out/through-a-link.grooph.json", "dangling.grooph.json", "graphs/../../up.grooph.json"]) {
      refused(await call(ctx, "grooph_new", { name: "Escape", out }), /is outside the project folder .*grooph writes only inside it\./);
    }
    refused(await call(ctx, "grooph_export", { path: "graphs/scratch.grooph.json", into: ".." }), /is outside the project folder/);
    refused(await call(ctx, "grooph_export", { path: "graphs/scratch.grooph.json", into: "way-out" }), /is outside the project folder/);
    refused(await call(ctx, "grooph_picture", { path: "graphs/scratch.grooph.json", out: "../p.svg" }), /is outside the project folder/);
    const { readdirSync } = await import("node:fs");
    assert.deepEqual(readdirSync(elsewhere), []);
    assert.deepEqual(readdirSync(root).sort(), ["elsewhere", "project"]);
  });
});

test("a server that was given no folder returns every document and writes no file", async () => {
  await withProject(
    async (ctx) => {
      const made = await call(ctx, "grooph_new", { name: "In a chat" });
      assert.equal(graphOf(made).id, "in-a-chat");
      refused(await call(ctx, "grooph_new", { name: "In a chat", out: "x.grooph.json" }), /^grooph was not given a project folder .*so it writes no file\.\nnext: leave "out" off: the result comes back in this reply\. To write files, start the server with grooph mcp --dir <folder>$/);
      refused(await call(ctx, "grooph_export", { graph: fixture("valid", "fix-until-green.grooph.json"), into: "." }), /writes no file/);
      assert.equal(existsSync(join(ctx.project, "x.grooph.json")), false);
    },
    { writes: false },
  );
});

test("export takes the compiler's tier map, says what every tier then means, and holds a model's name to what a name is made of", async () => {
  await withProject(async (ctx) => {
    const graph = fixture("valid", "review-loop.grooph.json");
    const plain = (await call(ctx, "grooph_export", { graph })).structuredContent!["files"] as Record<string, string>;
    const named = await call(ctx, "grooph_export", { graph, models: { strong: "a-model-of-my-own" } });
    assert.equal(named.isError, undefined);
    const files = named.structuredContent!["files"] as Record<string, string>;
    assert.deepEqual(named.structuredContent!["models"], { strong: "a-model-of-my-own" });
    assert.notDeepEqual(files, plain);
    assert.ok(Object.values(files).some((text) => /^model: a-model-of-my-own$/m.test(text)));
    // The same line the CLI prints: all three tiers, and which were named here.
    assert.match(textOf(named), /\ntiers in this package: frontier → \S+ \(the target's own\), strong → a-model-of-my-own, fast → \S+ \(the target's own\)\. Named by "models"\. A pin on a node still wins\.\n/);
    // The graph is not changed by it.
    assert.equal(files[".grooph/review-loop/graph.grooph.json"], plain[".grooph/review-loop/graph.grooph.json"]);

    // A name goes into a file's frontmatter as written: anything that is not a name is refused before it gets there.
    for (const bad of ["so nnet", "opus\nallowed-tools: Bash", "opus; rm -rf", "", "-leading-dash", 7]) {
      const r = await call(ctx, "grooph_export", { graph, models: { strong: bad } });
      refused(r, /^"models\.strong" must be a model's name \(letters, digits and \. _ - : \/ \[ \]\), got /);
    }
    refused(await call(ctx, "grooph_export", { graph, models: { huge: "x" } }), /names a tier grooph does not have: "huge"\. The tiers are frontier, strong, fast\./);
    refused(await call(ctx, "grooph_export", { graph, models: "strong=sonnet" }), /"models" must be an object/);
    // An empty map is no map: the package is the plain one.
    const empty = await call(ctx, "grooph_export", { graph, models: {} });
    assert.equal(empty.structuredContent!["models"], undefined);
    assert.deepEqual(empty.structuredContent!["files"], plain);
  });
});

test("the project's own templates answer before the built-in ones, and nothing is fetched", async () => {
  await withProject(async (ctx) => {
    const fetched: string[] = [];
    ctx.registry = { ...ctx.registry!, fetch: ((url: string) => (fetched.push(String(url)), Promise.reject(new Error("no network in a test")))) as unknown as typeof fetch };
    const mine = JSON.parse(readFileSync(join(repoRoot, "patterns", "grind-loop.grooph.json"), "utf8")) as Graph;
    mine.template = { ...mine.template!, title: "Our grind loop" };
    mkdirSync(join(ctx.project, ".git"));
    mkdirSync(join(ctx.project, ".grooph", "templates"), { recursive: true });
    writeFileSync(join(ctx.project, ".grooph", "templates", "grind-loop.grooph.json"), canonicalize(mine));
    const rows = (await call(ctx, "grooph_templates", {})).structuredContent!["templates"] as { id: string; title: string; source: string }[];
    assert.deepEqual(rows.filter((r) => r.id === "grind-loop"), [{ ...rows.find((r) => r.id === "grind-loop")!, title: "Our grind loop", source: "project" }]);
    assert.match(textOf(await call(ctx, "grooph_use_template", { id: "grind-loop", values: { task: "t", "test-command": "c" } })), /from grind-loop@\d+ \(project\)/);
    refused(await call(ctx, "grooph_use_template", { id: "a-template-only-the-network-has" }), /^No template/);
    assert.deepEqual(fetched, []);
  });
});

test("an operation map is checked, drawn and shared from JSON; a tool that throws is an error result, not a crash", async () => {
  await withProject(async (ctx) => {
    const map = JSON.parse(readFileSync(join(repoRoot, "fixtures", "maps", "valid", "owner-operation-2026-09-30.grooph-map.json"), "utf8")) as { id: string };
    const checked = await call(ctx, "grooph_validate", { graph: map });
    assert.match(textOf(checked), /^operation map .*\nno issues\nby hand .*\n(?:by hand .*\n)*next: grooph_picture draws the map; grooph_share makes its link$/);
    const drawn = await call(ctx, "grooph_picture", { graph: map, theme: "light" });
    assert.match((drawn.content[1] as { text: string }).text, /data-picture="map"/);
    assert.equal((await call(ctx, "grooph_share", { graph: map })).structuredContent!["kind"], "map");
    const broken = JSON.parse(readFileSync(join(repoRoot, "fixtures", "maps", "invalid", "E_HANDOFF_NO_CARRIER", "no-carrier.grooph-map.json"), "utf8")) as unknown;
    const said = await call(ctx, "grooph_validate", { graph: broken });
    assert.match(textOf(said), /\n1 error, 0 warnings\nerror {2}E_HANDOFF_NO_CARRIER .*\nnext: correct what is listed in the map document, then grooph_validate$/);
  });
});

test("in a chat (grooph mcp --chat) only the authoring tools are offered, and the instructions say no file is written", async () => {
  await withProject(
    async (ctx) => {
      const ask = async (message: unknown): Promise<{ result?: Record<string, unknown>; error?: { code: number; message: string } }> => (await handle(message, ctx)) as never;
      const tools = ((await ask({ jsonrpc: "2.0", id: 1, method: "tools/list" })).result!["tools"] as { name: string }[]).map((t) => t.name);
      assert.deepEqual(tools, ["grooph_validate", "grooph_templates", "grooph_use_template", "grooph_new", "grooph_apply", "grooph_explain", "grooph_shape", "grooph_share", "grooph_picture", "grooph_export"]);
      const init = await ask({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "2025-06-18" } });
      assert.match(String(init.result!["instructions"]), /Here no tool writes a file/);
      assert.doesNotMatch(String(init.result!["instructions"]), /grooph_plan/);
      // A tool the chat is not offered is not there to call.
      const plan = await ask({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "grooph_plan", arguments: { agents: [{ type: "x" }] } } });
      assert.equal(plan.error!.code, -32602);
      assert.doesNotMatch(plan.error!.message, /grooph_plan, /);
      assert.equal(existsSync(join(ctx.project, ".grooph")), false);
    },
    { chat: true, writes: false },
  );
  // A coding session whose server was given no folder: a plan has nowhere to be recorded, and says so.
  await withProject(
    async (ctx) => {
      refused(await call(ctx, "grooph_plan", { agents: [{ type: "Explore" }] }), /^grooph was not given a project folder .*so there is nowhere to record this\./);
      refused(await call(ctx, "grooph_note", { text: "hello" }), /nowhere to record this/);
      assert.equal(existsSync(join(ctx.project, ".grooph")), false);
    },
    { writes: false },
  );
});

test("the server remembers the graphs it returns, so a later call names one by its id and need not carry it", async () => {
  await withProject(async (ctx) => {
    const made = await call(ctx, "grooph_use_template", { id: "grind-loop", name: "Fix the flaky test", values: { task: "make the checkout test pass", "test-command": "pnpm test checkout" } });
    const id = graphOf(made).id;
    // Change it, check it, count it, draw it, share it and compile it, by id alone.
    const changed = await call(ctx, "grooph_apply", { graph: id, ops: [{ op: "setStop", loop: "grind", index: 0, stop: { kind: "max-iterations", n: 2 } }], forExport: true });
    assert.equal(changed.isError, undefined, textOf(changed));
    assert.match(textOf(changed), /next: grooph_share \(pass "graph": "fix-the-flaky-test"; the server remembers it\)/);
    // The id now means the changed graph, not the one before.
    assert.equal(textOf(await call(ctx, "grooph_shape", { graph: id })), "fix-the-flaky-test: 1 agent · 1 check · 1 loop · up to 2 rounds · 30 minutes\ntiers: 1 fast");
    assert.equal((await call(ctx, "grooph_validate", { graph: id })).structuredContent!["ok"], true);
    assert.match(textOf(await call(ctx, "grooph_explain", { graph: id })), /at most 2 rounds/);
    assert.match(((await call(ctx, "grooph_picture", { graph: id })).content[1] as { text: string }).text, /^<svg /);
    const link = (await call(ctx, "grooph_share", { graph: id })).structuredContent!["link"] as string;
    const opened = decodeSharePayload(sharePayloadFrom(link)!, inflateRaw);
    assert.ok(opened.ok && canonicalize(opened.envelope.doc as Graph) === canonicalize(graphOf(changed)));
    assert.equal(Object.keys((await call(ctx, "grooph_export", { graph: id })).structuredContent!["files"] as object).length, 6);

    // A document handed over whole is remembered too; a rename is remembered under the new id.
    const fix = fixture("valid", "fix-until-green.grooph.json");
    await call(ctx, "grooph_shape", { graph: fix });
    assert.equal((await call(ctx, "grooph_shape", { graph: fix.id })).isError, undefined);
    const renamed = graphOf(await call(ctx, "grooph_apply", { graph: fix.id, ops: [{ op: "setGraphName", name: "Green again" }] }));
    assert.equal((await call(ctx, "grooph_shape", { graph: renamed.id })).isError, undefined);

    // An id nobody made is refused, with the nearest one and what to do; a template is not a graph to name.
    refused(await call(ctx, "grooph_shape", { graph: "fix-the-flaky-tset" }), /^No graph "fix-the-flaky-tset" has been made in this conversation; did you mean "fix-the-flaky-test"\? \(the server remembers the graphs its tools return, until it restarts\)\.\nnext: pass the whole document as "graph"/);
    refused(await call(ctx, "grooph_shape", { graph: "grind-loop" }), /^No graph "grind-loop" has been made in this conversation/);
  });
  // Another server, another memory.
  await withProject(async (ctx) => {
    refused(await call(ctx, "grooph_validate", { graph: "fix-the-flaky-test" }), /^No graph "fix-the-flaky-test" has been made in this conversation \(/);
  });
});

test("the data a tool returns carries the reply's lines, next: included, and the apply tool names every operation's arguments", async () => {
  await withProject(async (ctx) => {
    const made = await call(ctx, "grooph_use_template", { id: "grind-loop", values: { task: "t" } });
    assert.equal(made.structuredContent!["text"], textOf(made));
    assert.match(made.structuredContent!["text"] as string, /\nnext: get the values for test-command from the person/);
    // The library's rows are the data; its lines there are only the legend and what to do next, not the list twice.
    const list = await call(ctx, "grooph_templates", {});
    assert.match(list.structuredContent!["text"] as string, /^\d+ templates; the three words after each title are cost · speed · rigor\.\nnext: /);
    // The package's kickoff is in the data once.
    const exported = await call(ctx, "grooph_export", { graph: fixture("valid", "fix-until-green.grooph.json") });
    assert.ok(!(exported.structuredContent!["text"] as string).includes(exported.structuredContent!["kickoff"] as string));
    assert.match(exported.structuredContent!["text"] as string, /next: .*do not start the run\.$/);

    const tools = ((await handle({ jsonrpc: "2.0", id: 1, method: "tools/list" }, ctx)) as { result: { tools: { name: string; description: string; inputSchema: { properties: Record<string, { type?: unknown }> } }[] } }).result.tools;
    const apply = tools.find((t) => t.name === "grooph_apply")!;
    for (const name of OP_NAMES) assert.ok(apply.description.includes(`${name}(`), name);
    assert.match(apply.description, /setGraphField\(key, value\)/);
    assert.match(apply.description, /addNode\(kind, name, id, at, set\)/);
    // Every tool that takes a graph takes its id or the document.
    for (const t of tools.filter((x) => x.inputSchema.properties["graph"] !== undefined)) assert.deepEqual(t.inputSchema.properties["graph"]!.type, ["object", "string"], t.name);
  });
});

test("a proposal set is shared from JSON, its candidates named by the ids of graphs the tools returned, and a set that is not yet one is told its shape", async () => {
  await withProject(async (ctx) => {
    const lean = graphOf(await call(ctx, "grooph_use_template", { id: "grind-loop", name: "Slugify lean", values: { task: "Add slugify.", "test-command": "npm test" } }));
    const gated = graphOf(await call(ctx, "grooph_use_template", { id: "review-gate", name: "Slugify reviewed", values: { task: "Add slugify.", "test-command": "npm test", checklist: "docs/REVIEW-CHECKLIST.md" } }));
    const candidate = (id: string, label: string, graph: unknown, cons: string[] = []): Record<string, unknown> => ({ id, label, graph, rationale: "Fits a small, tested change.", pros: ["small"], cons, profile: { cost: "low", speed: "fast", rigor: "light" } });
    const set = {
      groophProposals: 0,
      id: "slugify",
      title: "slugify(text)",
      brief: "Add slugify to src/strings.js; npm test is the check.",
      candidates: [candidate("lean", "Lean", lean.id), candidate("reviewed", "Reviewed", gated.id, ["a critic on the builder's tier"])],
      recommendation: { candidate: "lean", why: "Tests define done." },
    };
    const shared = await call(ctx, "grooph_share", { graph: set });
    assert.equal(shared.isError, undefined, textOf(shared));
    assert.equal(shared.structuredContent!["kind"], "proposals");
    assert.match(textOf(shared), /^slugify · slugify\(text\) · 2 candidates: Lean \(1 agent · 1 check · 1 loop · up to 5 rounds · 30 minutes\); Reviewed \(/);
    const opened = decodeSharePayload(sharePayloadFrom(shared.structuredContent!["link"] as string)!, inflateRaw);
    assert.ok(opened.ok && opened.envelope.kind === "proposals");
    assert.deepEqual((opened.envelope.doc as { candidates: { graph: Graph }[] }).candidates.map((c) => c.graph.id), [lean.id, gated.id]);

    // The marker left out, as a model writing one from memory leaves it out: the refusal says what is missing and gives the shape.
    const { groophProposals: _marker, ...unmarked } = set;
    const told = await call(ctx, "grooph_share", { graph: unmarked });
    refused(told, /has "candidates" and no "groophProposals": 0, so it is not yet a proposal set\.\nnext: add "groophProposals": 0 \(and "title"\) and grooph_share again\. A proposal set's shape: \{ "groophProposals": 0, "id"/);
    // A candidate naming a graph nobody made, and a set with a field wrong: named, with the shape, and no graph repair offered.
    refused(await call(ctx, "grooph_share", { graph: { ...set, candidates: [candidate("lean", "Lean", "never-made")] } }), /^Candidate "lean" names the graph "never-made", and no graph with that id has been made in this conversation\./);
    const wrong = await call(ctx, "grooph_share", { graph: { ...set, recommendation: { candidate: "nobody", why: "?" } } });
    refused(wrong, /cannot be shared: .*\nerror {2}E_DANGLING_REF .*nobody/);
    assert.doesNotMatch(textOf(wrong), /\nfix {2}/);
    assert.match(textOf(wrong), /\nnext: correct the proposal set as the lines say, then grooph_share again\. Its shape: /);
    // The tool's description carries the shape, since a session with only tools has nowhere else to read it.
    const tools = ((await handle({ jsonrpc: "2.0", id: 1, method: "tools/list" }, ctx)) as { result: { tools: { name: string; description: string }[] } }).result.tools;
    assert.match(tools.find((t) => t.name === "grooph_share")!.description, /A proposal set is \{ "groophProposals": 0, "id": "<kebab-case>", "title"/);
  });
});

test("what an independent read found: links, hard links, a project reached through a link, and the root as the project", async () => {
  await withProject(async (ctx, root) => {
    const ops = [{ op: "setGraphField", key: "goal", value: "Try it." }];
    // The project named through a link (as /tmp is on macOS): a tool may still rewrite the very file it read.
    symlinkSync(ctx.project, join(root, "by-a-link"));
    const linked: McpContext = { ...ctx, project: join(root, "by-a-link") };
    await call(linked, "grooph_new", { name: "Linked", out: "linked.grooph.json" });
    const rewritten = await call(linked, "grooph_apply", { path: "linked.grooph.json", out: "linked.grooph.json", ops });
    assert.equal(rewritten.isError, undefined, textOf(rewritten));
    assert.equal(parseGraphText(readFileSync(join(ctx.project, "linked.grooph.json"), "utf8")).doc!.goal, "Try it.");
    // By an absolute path through the link, too.
    assert.equal((await call(ctx, "grooph_apply", { path: join(root, "by-a-link", "linked.grooph.json"), out: "linked.grooph.json", ops: [{ op: "setTarget", harness: "claude-code" }] })).isError, undefined);

    // A link inside the project to another file inside it: the picture rule looks at what is there, and a link is not written through.
    writeFileSync(join(ctx.project, "notes.txt"), "mine");
    symlinkSync(join(ctx.project, "notes.txt"), join(ctx.project, "pic.svg"));
    refused(await call(ctx, "grooph_picture", { path: "linked.grooph.json", out: "pic.svg" }), /^pic\.svg is a link to another file, and grooph writes files, not through links\./);
    assert.equal(readFileSync(join(ctx.project, "notes.txt"), "utf8"), "mine");

    // A package file that is a link: the export is refused before anything is written, so nothing of it lands.
    const graph = fixture("valid", "fix-until-green.grooph.json");
    mkdirSync(join(ctx.project, "pk", ".claude", "agents"), { recursive: true });
    writeFileSync(join(ctx.project, "README.md"), "mine too");
    const plain = (await call(ctx, "grooph_export", { graph })).structuredContent!["files"] as Record<string, string>;
    const agentFile = Object.keys(plain).find((path) => path.startsWith(".claude/agents/"))!;
    symlinkSync(join(ctx.project, "README.md"), join(ctx.project, "pk", agentFile));
    refused(await call(ctx, "grooph_export", { graph, into: "pk" }), /is a link to another file/);
    assert.equal(readFileSync(join(ctx.project, "README.md"), "utf8"), "mine too");
    assert.equal(existsSync(join(ctx.project, "pk", ".grooph")), false, "no other file of the package was placed");

    // A second name for a file outside the project (a hard link): the picture takes the name, and the file outside keeps what it had.
    writeFileSync(join(root, "outside.svg"), "<svg>outside</svg>");
    linkSync(join(root, "outside.svg"), join(ctx.project, "hard.svg"));
    assert.equal((await call(ctx, "grooph_picture", { path: "linked.grooph.json", out: "hard.svg" })).isError, undefined);
    assert.equal(readFileSync(join(root, "outside.svg"), "utf8"), "<svg>outside</svg>");
    assert.match(readFileSync(join(ctx.project, "hard.svg"), "utf8"), /^<svg xmlns/);
    // No half-written file is left beside anything.
    assert.deepEqual(readdirSync(ctx.project).filter((name) => name.includes("grooph-tmp")), []);

    // The root as the project: a path under it is inside it (a prefix test would say otherwise).
    const inRoot = join(root, "project", "deep", "x.grooph.json");
    assert.equal(within({ ...ctx, project: "/" }, inRoot), realpathSync(join(root, "project")) + "/deep/x.grooph.json");
  });
});

test("an id that named another graph is not taken over in silence", async () => {
  await withProject(async (ctx) => {
    const first = await call(ctx, "grooph_use_template", { id: "grind-loop", name: "Fix it", values: { task: "one", "test-command": "c" } });
    assert.doesNotMatch(textOf(first), /\nnote: /);
    // The same graph, changed: no note. It is the same graph.
    assert.doesNotMatch(textOf(await call(ctx, "grooph_apply", { graph: "fix-it", ops: [{ op: "setTarget", harness: "claude-code" }] })), /\nnote: /);
    // Another graph made under the same id, and another renamed onto it: each says so.
    const again = await call(ctx, "grooph_use_template", { id: "ralph-loop", name: "Fix it" });
    assert.match(textOf(again), /\nnote: the id "fix-it" named another graph in this conversation until now; it names this one from here on\./);
    await call(ctx, "grooph_new", { name: "Other" });
    const renamed = await call(ctx, "grooph_apply", { graph: "other", ops: [{ op: "setGraphName", name: "Fix it" }] });
    assert.equal(graphOf(renamed).id, "fix-it");
    assert.match(textOf(renamed), /\nnote: the id "fix-it" named another graph/);
    assert.match(renamed.structuredContent!["text"] as string, /\nnote: /);
  });
});

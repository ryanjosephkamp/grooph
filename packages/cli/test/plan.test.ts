/**
 * `grooph plan` and the tool `grooph_export_plan`: a plan for any document that reads as a graph (handoff 0100).
 * Nothing is refused for a rule; a plan is never a package; a file that is not the plan's is left alone; and the
 * places that only draw, share or pick a document do not call what a package asks for an error of a plan.
 */

import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { canonicalize, planBundle, type Graph } from "@grooph/core";

import { PLAN_STILL } from "../src/commands/export.js";
import { isPlanOf } from "../src/commands/plan.js";
import { run } from "../src/index.js";
import { handle, toolNames, type McpContext } from "../src/mcp.js";
import type { Output } from "../src/print.js";
import { defaultRegistryEnv } from "../src/registry.js";

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
const capture = (isTTY = false): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, isTTY, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t) };
};
const grooph = async (argv: string[], cwd?: string, isTTY = false): Promise<{ code: number; out: string; err: string }> => {
  const io = capture(isTTY);
  const before = process.cwd();
  if (cwd !== undefined) process.chdir(cwd);
  try {
    const code = await run(argv, io, () => "", { env: {} });
    return { code, out: io.stdout.join(LF), err: io.stderr.join(LF) };
  } finally {
    process.chdir(before);
  }
};
const withFolder = async (fn: (dir: string) => Promise<void>): Promise<void> => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "grooph-plan-")));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const put = (file: string, doc: unknown): string => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof doc === "string" ? doc : JSON.stringify(doc, null, 2));
  return file;
};
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

const graph = fixture("review-loop");
/** The same graph as a plan: no harness and no goal, which only a package asks for. */
const planOnly = ((): Graph => {
  const doc = { ...graph } as Graph;
  delete (doc as { target?: unknown }).target;
  delete (doc as { goal?: unknown }).goal;
  return doc;
})();
/** One that breaks a rule of its own: an edge that leads nowhere. */
const broken = { ...planOnly, edges: [...planOnly.edges, { id: "e-nowhere", from: "builder", to: "nowhere" }] } as Graph;
const FILES = ["PLAN.md", "review-loop.svg", "review-loop.grooph.json"];

test("grooph plan writes the plan's three files for a graph a harness could run, one it could not, and one that breaks a rule, and exits 0 each time", async () => {
  await withFolder(async (dir) => {
    // With no --into the plan goes into <id>-plan in the current folder.
    const ready = await grooph(["plan", put(join(dir, "g.grooph.json"), graph)], dir);
    assert.equal(ready.code, 0, ready.err);
    assert.equal(ready.err, "");
    assert.deepEqual(ready.out.split(LF).slice(0, 4), [`wrote 3 files into ${join(dir, "review-loop-plan")}`, ...FILES.map((name) => `  ${name}`)]);
    assert.ok(ready.out.split(LF).includes("A coding harness could run this as it is: nothing in it is in error. grooph export writes its package for claude-code."), ready.out);
    const bundle = planBundle(graph);
    for (const name of FILES) assert.equal(readFileSync(join(dir, "review-loop-plan", name), "utf8"), bundle.files[name], name);
    assert.deepEqual(readdirSync(join(dir, "review-loop-plan")).sort(), [...FILES].sort());
    // Not a package: nothing a harness reads was written anywhere.
    assert.equal(existsSync(join(dir, ".grooph")), false);
    assert.equal(existsSync(join(dir, ".claude")), false);
    assert.equal(existsSync(join(dir, ".codex")), false);

    const plan = await grooph(["plan", put(join(dir, "p.grooph.json"), planOnly), "--into", join(dir, "docs", "the-plan")]);
    assert.equal(plan.code, 0, plan.err);
    assert.equal(plan.err, "");
    const said = plan.out.split(LF);
    assert.ok(said.includes("A coding harness cannot run this as it is. To fix first (2), as PLAN.md lists them:"), plan.out);
    assert.ok(said.some((line) => line.startsWith("  E_NO_TARGET  ")) && said.some((line) => line.startsWith("  E_NO_GOAL  ")), plan.out);
    assert.equal(said.at(-1), "As a plan for people to read and follow it is whole.");
    const written = readFileSync(join(dir, "docs", "the-plan", "PLAN.md"), "utf8");
    assert.ok(written.includes("## To fix before a harness can run this") && written.includes("`E_NO_TARGET`"));
    assert.equal(readFileSync(join(dir, "docs", "the-plan", "review-loop.grooph.json"), "utf8"), canonicalize(planOnly));

    const own = await grooph(["plan", put(join(dir, "b.grooph.json"), broken), "--into", join(dir, "broken-plan")]);
    assert.equal(own.code, 0, own.err);
    assert.ok(own.out.split(LF).some((line) => line.startsWith("  E_DANGLING_REF  ")), own.out);
    assert.match(own.out.split(LF).at(-1)!, /^1 of them is a rule a graph itself is held to, not only what a package asks for: until it is fixed, parts of the plan may be missing or drawn wrong\.$/);
    assert.equal(existsSync(join(dir, "broken-plan", "PLAN.md")), true);

    // A graph with no steps yet is not called whole: the command says what PLAN.md says.
    assert.equal((await grooph(["new", "--name", "Nothing yet", "--out", join(dir, "empty.grooph.json")])).code, 0);
    const empty = await grooph(["plan", join(dir, "empty.grooph.json"), "--into", join(dir, "empty-plan")]);
    assert.equal(empty.code, 0, empty.err);
    assert.equal(empty.out.split(LF).at(-1), "It has no steps yet.");
    assert.ok(readFileSync(join(dir, "empty-plan", "PLAN.md"), "utf8").includes("It has no steps yet."));
  });
});

test("grooph plan gives no plan to what does not read as a graph, and says what a map has in its place", async () => {
  await withFolder(async (dir) => {
    const notOne = await grooph(["plan", put(join(dir, "x.grooph.json"), { grooph: 0, id: "Not An Id" }), "--into", join(dir, "out")]);
    assert.equal(notOne.code, 1);
    assert.match(notOne.err, /^grooph: cannot plan .* it does not read as a graph document, so nothing can draw it$/m);
    assert.match(notOne.err, /E_SCHEMA/);
    const map = join(repoRoot, "fixtures", "maps", "valid", "a-bot-fleet.grooph-map.json");
    const asMap = await grooph(["plan", map, "--into", join(dir, "out")]);
    assert.equal(asMap.code, 1);
    assert.match(asMap.err, /it is an operation map, and a plan is of a loop graph/);
    assert.equal(existsSync(join(dir, "out")), false);
    const none = await grooph(["plan"]);
    assert.equal(none.code, 1);
    assert.match(none.err, /^grooph: plan needs a file: /);
    const help = await grooph(["plan", "--help"]);
    assert.equal(help.code, 0);
    for (const piece of ["grooph plan <graph> [--into <dir>] [--force]", "PLAN.md", "A plan is not a package", "--force", "<id>-plan"]) assert.ok(help.out.includes(piece), piece);
    assert.ok((await grooph(["--help"])).out.includes("  plan         a plan for people to follow"));
  });
});

test("a file in the folder that is not this plan's is left alone until --force: a person's PLAN.md, a picture grooph did not draw, a copy of the graph someone changed", async () => {
  await withFolder(async (dir) => {
    const file = put(join(dir, "g.grooph.json"), graph);
    const into = join(dir, "plan");

    // A project's own PLAN.md.
    put(join(into, "PLAN.md"), "# Our plan\n\nShip on Friday.\n");
    let before = tree(into);
    const theirs = await grooph(["plan", file, "--into", into]);
    assert.equal(theirs.code, 1);
    assert.deepEqual(theirs.err.split(LF), [`grooph: 1 file in ${into} is not this plan's to replace, so nothing was written:`, "  PLAN.md  is not a plan grooph wrote for this graph", "Give another folder with --into, or run the same command with --force to replace what is there."]);
    assert.equal(theirs.out, "");
    assert.equal(tree(into), before);
    assert.equal((await grooph(["plan", file, "--into", into, "--force"])).code, 0);

    // The same graph again writes the same bytes and asks nothing.
    assert.equal((await grooph(["plan", file, "--into", into])).code, 0);

    // PLAN.md says the copy beside it is the one to edit. So a copy that differs from the graph given is someone's
    // work, whatever was changed in it: one line of a brief, or only where a card sits, which no PLAN.md shows.
    const copy = join(into, "review-loop.grooph.json");
    for (const edited of [{ ...graph, name: "Edited here" }, { ...graph, layout: { builder: { x: 40, y: 40 } } }] as Graph[]) {
      writeFileSync(copy, canonicalize(edited));
      before = tree(into);
      const lost = await grooph(["plan", file, "--into", into]);
      assert.equal(lost.code, 1);
      assert.match(lost.err, /^ {2}review-loop\.grooph\.json {2}is a copy of the graph that differs from the one given: what was changed in it would be lost\. To keep it, make the plan from that copy$/m);
      assert.equal(tree(into), before);
    }
    writeFileSync(copy, canonicalize({ ...graph, name: "Edited here" } as Graph));
    // Made from that copy itself, the plan follows it.
    const fromCopy = await grooph(["plan", copy, "--into", into]);
    assert.equal(fromCopy.code, 0, fromCopy.err);
    assert.ok(readFileSync(join(into, "PLAN.md"), "utf8").startsWith("# Edited here\n"));

    // A picture grooph did not draw.
    writeFileSync(join(into, "review-loop.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\"><title>logo</title></svg>");
    const logo = await grooph(["plan", copy, "--into", into]);
    assert.equal(logo.code, 1);
    assert.match(logo.err, /^ {2}review-loop\.svg {2}is not a picture grooph drew$/m);

    // A file that is there and cannot be read is not taken for nothing.
    const sealed = join(dir, "sealed");
    put(join(sealed, "PLAN.md"), "# secret notes\n");
    chmodSync(join(sealed, "PLAN.md"), 0o000);
    try {
      const unread = await grooph(["plan", file, "--into", sealed]);
      // (A process that may read any file reads this one too, and then it is a person's PLAN.md: refused either way.)
      assert.equal(unread.code, 1);
      assert.match(unread.err, /^ {2}PLAN\.md {2}(is there and cannot be read as a file, so it cannot be told from a person's|is not a plan grooph wrote for this graph)$/m);
      assert.deepEqual(readdirSync(sealed), ["PLAN.md"]);
    } finally {
      chmodSync(join(sealed, "PLAN.md"), 0o600);
    }
    assert.equal(readFileSync(join(sealed, "PLAN.md"), "utf8"), "# secret notes\n");

    // Another graph's plan in the folder is not this graph's.
    const other = put(join(dir, "other.grooph.json"), fixture("fix-until-green"));
    const otherInto = join(dir, "other-plan");
    assert.equal((await grooph(["plan", other, "--into", otherInto])).code, 0);
    const crossed = await grooph(["plan", file, "--into", otherInto]);
    assert.equal(crossed.code, 1);
    assert.match(crossed.err, /PLAN\.md {2}is not a plan grooph wrote for this graph/);
    assert.equal(isPlanOf(readFileSync(join(otherInto, "PLAN.md"), "utf8"), "fix-until-green.grooph.json"), true);
    assert.equal(isPlanOf(readFileSync(join(otherInto, "PLAN.md"), "utf8"), "review-loop.grooph.json"), false);
  });
});

test("grooph plan writes through no link and never the graph a package keeps", async () => {
  await withFolder(async (dir) => {
    const file = put(join(dir, "g.grooph.json"), graph);
    // A graph whose id is "graph", planned into a package's folder, would be that package's kept graph.
    const named = put(join(dir, "named.grooph.json"), { ...graph, id: "graph" });
    const project = join(dir, "project");
    assert.equal((await grooph(["export", file, "--target", "claude-code", "--into", project])).code, 0);
    const before = tree(project);
    const kept = await grooph(["plan", named, "--into", join(project, ".grooph", "review-loop"), "--force"]);
    assert.equal(kept.code, 1);
    assert.match(kept.err, /is the graph a package keeps\. Only grooph export writes it/);
    assert.equal(tree(project), before);

    // A link where a file would go is not written through, with --force or without.
    const into = join(dir, "linked");
    mkdirSync(into);
    const outside = put(join(dir, "outside.md"), "mine\n");
    symlinkSync(outside, join(into, "PLAN.md"));
    for (const more of [[], ["--force"]]) {
      const linked = await grooph(["plan", file, "--into", into, ...more]);
      assert.equal(linked.code, 1, more.join(" "));
      assert.match(linked.err, /^grooph: cannot write the plan of .* into .*linked: /);
    }
    assert.equal(readFileSync(outside, "utf8"), "mine\n");
    assert.deepEqual(readdirSync(into), ["PLAN.md"]);

    // A plan is for people to read: it is written into no folder a tool reads, with --force or without.
    for (const hidden of [".claude/rules", ".codex/prompts", ".git/hooks", "docs/.hidden/plan"]) {
      const refused = await grooph(["plan", file, "--into", hidden, "--force"], dir);
      assert.equal(refused.code, 1, hidden);
      assert.match(refused.err, /a plan is for people to read\. Give --into a folder with no part that begins with a dot\.$/, hidden);
      assert.equal(existsSync(join(dir, hidden.split("/")[0]!)), false, hidden);
    }
    assert.equal((await grooph(["plan", file, "--into", join(dir, "repo", ".git", "plan")])).code, 1);
    assert.equal(existsSync(join(dir, "repo")), false);
  });
});

test("an export refused for what the graph lacks, or for a harness grooph has no compiler for, ends by naming the plan", async () => {
  await withFolder(async (dir) => {
    const file = put(join(dir, "p.grooph.json"), planOnly);
    const refused = await grooph(["export", file, "--target", "claude-code", "--into", join(dir, "project")]);
    assert.equal(refused.code, 1);
    assert.equal(refused.err.split(LF).at(-1), PLAN_STILL(file));
    assert.equal(existsSync(join(dir, "project")), false);
    const custom = await grooph(["export", file, "--target", "my-own-harness", "--into", join(dir, "project")]);
    assert.equal(custom.code, 1);
    assert.equal(custom.err.split(LF).at(-1), PLAN_STILL(file));
    // The plan is named only for a file that reads as a graph: not for one that is not there.
    const missing = await grooph(["export", join(dir, "not-there.grooph.json"), "--target", "my-own-harness", "--into", join(dir, "project")]);
    assert.equal(missing.code, 1);
    assert.ok(!missing.err.includes("grooph plan"), missing.err);
    assert.ok(PLAN_STILL(file).startsWith("No package was written. A plan can still be: grooph plan "));
    // A graph with nothing in error is exported with no such line.
    const fine = await grooph(["export", put(join(dir, "g.grooph.json"), graph), "--target", "claude-code", "--into", join(dir, "project")]);
    assert.equal(fine.code, 0, fine.err);
    assert.ok(!`${fine.out}${fine.err}`.includes("grooph plan"));
  });
});

test("a shared plan is not told that it lacks a harness as an error, and a template that names no harness ends with the plan", async () => {
  await withFolder(async (dir) => {
    const shared = await grooph(["share", put(join(dir, "p.grooph.json"), planOnly)]);
    assert.equal(shared.code, 0, shared.err);
    assert.ok(!/^\s*error\b/m.test(shared.out), shared.out);
    assert.match(shared.out, /^ {2}a plan as it stands: it names no harness, and a package would need E_NO_TARGET, E_NO_GOAL \(grooph plan exports it as it is\)$/m);
    const whole = await grooph(["share", put(join(dir, "g.grooph.json"), graph)]);
    assert.ok(!whole.out.includes("a plan as it stands"), whole.out);
    // A graph that names a harness is no plan: a slot left unfilled in it is printed in full, as it was.
    const slotted = await grooph(["share", put(join(dir, "s.grooph.json"), { ...graph, goal: "Do {{the-thing}}." })]);
    assert.match(slotted.out, /^ {2}error {2}E_UNFILLED_SLOT {2}slot \{\{the-thing\}\}/m, slotted.out);
    assert.ok(!slotted.out.includes("a plan as it stands"), slotted.out);
    // And in a plan too, since a plan with a blank in it is not finished either.
    const planSlotted = await grooph(["share", put(join(dir, "ps.grooph.json"), { ...planOnly, goal: "Do {{the-thing}}." })]);
    assert.match(planSlotted.out, /^ {2}error {2}E_UNFILLED_SLOT /m, planSlotted.out);
    assert.match(planSlotted.out, /a package would need E_NO_TARGET \(grooph plan exports it as it is\)$/m, planSlotted.out);

    // A template with no harness in it makes a plan: the next step is the plan, not the check for a package.
    const templates = join(dir, ".grooph", "templates");
    const template = { ...planOnly, id: "by-hand", name: "By hand", goal: "Do the thing by hand.", template: { title: "By hand", summary: "A plan a person follows.", whenToUse: "The work is a person's.", kind: "graph", tags: ["plan"], profile: { cost: "low", speed: "fast", rigor: "light" } } };
    put(join(templates, "by-hand.grooph.json"), template);
    const used = await grooph(["template", "use", "by-hand", "--name", "My plan", "--out", join(dir, "mine.grooph.json")], dir);
    assert.match(used.out, /^next: grooph plan .*mine\.grooph\.json$/m, `${used.out}${used.err}`);
    const usual = await grooph(["template", "use", "review-gate", "--name", "Usual", "--set", "task=x", "--set", "test-command=y", "--set", "checklist=z", "--out", join(dir, "usual.grooph.json")], dir);
    assert.match(usual.out, /^next: grooph validate --for-export .*usual\.grooph\.json$/m, `${usual.out}${usual.err}`);
  });
});

// ─── the tool ─────────────────────────────────────────────────────────────

type Content = { type: "text"; text: string };
type Result = { content: Content[]; structuredContent?: Record<string, unknown>; isError?: boolean };
const withProject = async (fn: (ctx: McpContext, project: string) => Promise<void>, extra: Partial<McpContext> = {}): Promise<void> => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "grooph-plan-tool-")));
  const project = join(root, "project");
  mkdirSync(project);
  try {
    await fn({ project, version: "9.9.9", harness: "claude-code", session: "sess-1", now: () => new Date(Date.UTC(2026, 9, 5)), env: {}, registry: { ...defaultRegistryEnv(), cwd: project, userDir: join(root, "no-user-dir") }, ...extra }, project);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};
const call = async (ctx: McpContext, name: string, args: unknown): Promise<Result> =>
  ((await handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, ctx)) as { result: Result }).result;
const textOf = (r: Result): string => r.content[0]!.text;

test("the tool grooph_export_plan returns the plan's files for any graph that reads, writes them when asked, and is offered in a chat with no file argument", async () => {
  await withProject(async (ctx, project) => {
    assert.ok(toolNames().includes("grooph_export_plan") && toolNames().includes("grooph_plan"));
    const bundle = planBundle(planOnly);
    const back = await call(ctx, "grooph_export_plan", { graph: planOnly });
    assert.equal(back.isError, undefined, textOf(back));
    const said = textOf(back).split(LF);
    assert.match(said[0]!, /^plan of "review-loop": 3 files, in the last block of this reply\. /);
    assert.deepEqual(said.slice(1, 4), FILES.map((name) => `  file ${JSON.stringify(name)}`));
    assert.equal(said[4], "to fix: 2 before a coding harness can run this, and 1 warning a package would be written with. As a plan for people to read and follow it is whole.");
    assert.ok(said.some((line) => line.startsWith("error E_NO_TARGET ")), textOf(back));
    assert.match(said.at(-1)!, /^next: show the person PLAN\.md and the picture; the plan is theirs to follow as it is\. /);
    assert.equal(back.content[1]!.text, bundle.files["PLAN.md"]!.trimEnd());
    assert.deepEqual(JSON.parse(back.content[2]!.text), bundle.files);
    assert.deepEqual(back.structuredContent!["files"], bundle.files);
    assert.equal(back.structuredContent!["runnable"], false);
    assert.deepEqual(readdirSync(project), []);

    // One that breaks a rule of its own still gets its plan; one a harness could run says so.
    const own = await call(ctx, "grooph_export_plan", { graph: broken });
    assert.equal(own.isError, undefined, textOf(own));
    assert.match(textOf(own), /^to fix: 3 before a coding harness can run this.* 1 of them is a rule a graph itself is held to, not only what a package asks for: until it is fixed, parts of the plan may be missing or drawn wrong\.$/m);
    const ready = await call(ctx, "grooph_export_plan", { graph });
    assert.match(textOf(ready), /^to fix: nothing\. A coding harness could run this as it is; a package would be written with 1 warning\.$/m);
    assert.equal(ready.structuredContent!["runnable"], true);

    // Written into a folder of the project, whole; a person's file there stops it until "replace".
    const placed = await call(ctx, "grooph_export_plan", { graph: planOnly, into: "plans/review" });
    assert.equal(placed.isError, undefined, textOf(placed));
    assert.match(textOf(placed), /^plan of "review-loop": 3 files, written into "plans\/review"\. /);
    for (const name of FILES) assert.equal(readFileSync(join(project, "plans", "review", name), "utf8"), bundle.files[name], name);
    assert.deepEqual(placed.structuredContent!["files"], FILES);
    put(join(project, "docs", "PLAN.md"), "# Ours\n");
    const theirs = await call(ctx, "grooph_export_plan", { graph: planOnly, into: "docs" });
    assert.equal(theirs.isError, true);
    assert.deepEqual(textOf(theirs).split(LF).slice(0, 2), ['refused: Nothing was written in "docs": 1 file there is not this plan\'s to replace.', '  file "PLAN.md": is not a plan grooph wrote for this graph']);
    assert.deepEqual(readdirSync(join(project, "docs")), ["PLAN.md"]);
    assert.equal((await call(ctx, "grooph_export_plan", { graph: planOnly, into: "docs", replace: true })).isError, undefined);
    // A copy of the graph in the folder that differs from the one given is someone's work until "replace".
    const differs = await call(ctx, "grooph_export_plan", { graph: { ...planOnly, name: "Another draft" }, into: "plans/review" });
    assert.equal(differs.isError, true);
    assert.match(textOf(differs), /^ {2}file "review-loop\.grooph\.json": is a copy of the graph that differs from the one given/m);
    // Made from the copy itself, by its path, the plan follows it.
    writeFileSync(join(project, "plans", "review", "review-loop.grooph.json"), canonicalize({ ...planOnly, name: "Edited in place" } as Graph));
    const followed = await call(ctx, "grooph_export_plan", { path: "plans/review/review-loop.grooph.json", into: "plans/review" });
    assert.equal(followed.isError, undefined, textOf(followed));
    assert.ok(readFileSync(join(project, "plans", "review", "PLAN.md"), "utf8").startsWith("# Edited in place\n"));
    // Outside the project, and the folders a tool reads (a repository's, a harness's): none is written, with "replace" or without.
    for (const into of ["../elsewhere", ".git/plan", ".claude/rules", ".claude/commands", ".codex/prompts", "docs/.hidden"]) {
      const was = tree(project);
      const refused = await call(ctx, "grooph_export_plan", { graph: planOnly, into, replace: true });
      assert.equal(refused.isError, true, into);
      assert.equal(tree(project), was, into);
      assert.equal(existsSync(join(project, "..", "elsewhere")), false);
    }
    assert.match(textOf(await call(ctx, "grooph_export_plan", { graph: planOnly, into: ".claude/rules" })), /^refused: "\.claude\/rules" is under "\.claude", a folder a tool reads and not a person\./);
    assert.equal((await call(ctx, "grooph_export", { graph, into: "." })).isError, undefined);
    // The graph a package keeps: by the folder's own name, and through a link whose name shows no dot.
    symlinkSync(join(project, ".grooph", "review-loop"), join(project, "looks-plain"));
    for (const into of [".grooph/review-loop", "looks-plain"]) {
      const was = tree(project);
      const kept = await call(ctx, "grooph_export_plan", { graph: { ...graph, id: "graph" }, into, replace: true });
      assert.equal(kept.isError, true, textOf(kept));
      assert.match(textOf(kept), into === "looks-plain" ? /is a link to another file, and grooph writes files, not through links/ : /is under "\.grooph", a folder a tool reads and not a person/, textOf(kept));
      assert.equal(tree(project), was, into);
    }

    // The export tool, refusing a plan, ends by naming this tool; its own words only.
    const refused = await call(ctx, "grooph_export", { graph: planOnly });
    assert.equal(refused.isError, true);
    const PLAN_NEXT = "No package was made. A plan for people to follow can still be: grooph_export_plan writes one from the graph as it is, with what is listed here written in it";
    assert.equal(textOf(refused).split(LF).at(-1), `next: grooph_apply with {"op":"setTarget","harness":"claude-code"}, then grooph_export again. ${PLAN_NEXT}`);
    assert.equal(textOf(await call(ctx, "grooph_export", { graph: planOnly, target: "my-own-harness" })).split(LF).at(-1), `next: pass target: "claude-code". ${PLAN_NEXT}`);
    const noGoal = await call(ctx, "grooph_export", { graph: { ...planOnly, target: { harness: "claude-code" } } });
    assert.equal(noGoal.isError, true);
    assert.ok(textOf(noGoal).split(LF).at(-1)!.startsWith("next: fix what is listed ") && textOf(noGoal).endsWith(`. ${PLAN_NEXT}`), textOf(noGoal));
    // A shared plan carries a note, not the package's errors.
    const shared = await call(ctx, "grooph_share", { graph: planOnly });
    assert.equal(shared.isError, undefined, textOf(shared));
    assert.ok(!/^error /m.test(textOf(shared)), textOf(shared));
    assert.match(textOf(shared), /^note: a plan as it stands: it names no harness, and a package would need E_NO_TARGET, E_NO_GOAL\. grooph_export_plan writes the plan as it is\.$/m);
  });
  await withProject(
    async (ctx, project) => {
      assert.ok(toolNames({ chat: true }).includes("grooph_export_plan") && !toolNames({ chat: true }).includes("grooph_plan"));
      const listed = (await handle({ jsonrpc: "2.0", id: 1, method: "tools/list" }, ctx)) as { result: { tools: { name: string; inputSchema: { properties: Record<string, unknown> } }[] } };
      assert.deepEqual(Object.keys(listed.result.tools.find((tool) => tool.name === "grooph_export_plan")!.inputSchema.properties), ["graph"]);
      const back = await call(ctx, "grooph_export_plan", { graph: planOnly });
      assert.equal(back.isError, undefined, textOf(back));
      assert.equal(back.content[1]!.text, planBundle(planOnly).files["PLAN.md"]!.trimEnd());
      assert.equal((await call(ctx, "grooph_export_plan", { graph: planOnly, into: "plans" })).isError, true);
      assert.deepEqual(readdirSync(project), []);
    },
    { chat: true },
  );
});

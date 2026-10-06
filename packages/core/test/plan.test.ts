import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { canonicalize } from "../src/canonicalize.js";
import { tryCompile } from "../src/compile/index.js";
import { picture } from "../src/index.js";
import { IMPLEMENTED_CODES } from "../src/issues.js";
import { parseGraphText } from "../src/parse.js";
import { planBundle, planSteps } from "../src/plan.js";
import type { Graph } from "../src/types.js";
import { validate } from "../src/validate.js";
import { fixturesDir, listDirs, listFiles, read, repoRoot } from "./helpers.js";

const load = (path: string): Graph => parseGraphText(read(path)).doc!;
const green = (): Graph => load(join(fixturesDir, "valid", "fix-until-green.grooph.json"));
/** The lines under a heading of PLAN.md, up to the next heading of its level. */
const under = (markdown: string, heading: string): string => {
  const from = markdown.indexOf(`\n## ${heading}\n`);
  assert.ok(from >= 0, `PLAN.md has "## ${heading}"`);
  const rest = markdown.slice(from + heading.length + 5);
  const to = rest.indexOf("\n## ");
  return to < 0 ? rest : rest.slice(0, to);
};

test("a document with no target and no goal still gets its plan: three files, and what a harness would need is listed by code", () => {
  const doc = green();
  delete doc.target;
  delete doc.goal;
  // No package can be written for it.
  assert.equal(tryCompile(doc, "claude-code").ok, false);

  const plan = planBundle(doc);
  assert.deepEqual(Object.keys(plan.files), ["PLAN.md", "fix-until-green.svg", "fix-until-green.grooph.json"]);
  assert.deepEqual(plan.toFix.map((issue) => issue.code), ["E_NO_TARGET", "E_NO_GOAL"]);
  const md = plan.files["PLAN.md"]!;
  assert.match(md, /^# Fix until green\n/);
  assert.match(md, /\*\*A coding harness cannot run this as it is\.\*\* 2 things have to be fixed first/);
  assert.match(md, /Nothing here has been run, and grooph runs nothing\./);
  const toFix = under(md, "To fix before a harness can run this");
  assert.match(toFix, /- `E_NO_TARGET` export needs a target harness; set target\.harness \(at: fix-until-green\)/);
  assert.match(toFix, /- `E_NO_GOAL` export needs a goal/);
  // The picture and the document are the ones every other door gives.
  assert.equal(plan.files["fix-until-green.svg"], picture(doc));
  assert.equal(plan.files["fix-until-green.grooph.json"], canonicalize(doc));
  assert.match(md, /!\[Fix until green\]\(fix-until-green\.svg\)/);
  // With no goal there is no goal line; with one, it is one line above the picture.
  assert.doesNotMatch(md, /\*\*Goal:\*\*/);
  assert.match(planBundle(green()).files["PLAN.md"]!, /\n\*\*Goal:\*\* Make the failing test suite pass without changing what the tests assert\.\n\n!\[/);
});

test("a harness name grooph has no profile for is one more thing to fix, not a reason to refuse the plan", () => {
  const doc = green();
  doc.target = { harness: "my-own-harness" };
  const plan = planBundle(doc);
  assert.deepEqual(plan.toFix.filter((issue) => issue.severity === "error").map((issue) => issue.code), ["E_NO_TARGET"]);
  assert.match(under(plan.files["PLAN.md"]!, "To fix before a harness can run this"), /`E_NO_TARGET`.*my-own-harness/);
});

test("a document with nothing in error says a harness could run it, and warnings are told apart from what must be fixed", () => {
  const doc = green();
  assert.deepEqual(validate(doc, { forExport: true }).filter((issue) => issue.severity === "error"), []);
  const md = planBundle(doc).files["PLAN.md"]!;
  assert.match(md, /A coding harness could run this as it is: nothing in it is in error\. `grooph export` writes its package for claude-code\./);
  assert.match(under(md, "To fix before a harness can run this"), /^\nNothing\.\n/);

  // A warning alone: nothing has to be fixed, and the warning is listed as one.
  const loose = green();
  loose.loops[0]!.stops = [{ kind: "max-iterations", n: 9 }];
  const warned = planBundle(loose);
  assert.deepEqual(warned.toFix.filter((issue) => issue.severity === "error"), []);
  assert.ok(warned.toFix.length > 0);
  const toFix = under(warned.files["PLAN.md"]!, "To fix before a harness can run this");
  assert.match(toFix, /^\nNothing\.\n\nThese are warnings: a package is written with them/);
  for (const issue of warned.toFix) assert.ok(toFix.includes(`- \`${issue.code}\` `), issue.code);
});

test("who does what: an agent's step, a person's gate, a command, and an approval a person gives on an edge", () => {
  const doc = load(join(repoRoot, "fixtures", "valid", "subgrooph-in-a-graph.grooph.json"));
  doc.edges.find((edge) => edge.id === "e-plan-review-builder")!.approval = true;
  const steps = planSteps(doc);
  assert.deepEqual(steps.map((step) => step.id), doc.nodes.map((node) => node.id));
  assert.equal(steps.find((step) => step.id === "review-merge-gate")!.whose, "a person");
  assert.equal(steps.find((step) => step.id === "review-builder")!.whose, "an agent");
  assert.equal(steps.find((step) => step.id === "done")!.whose, "nobody");
  const who = under(planBundle(doc).files["PLAN.md"]!, "Who does what");
  assert.match(who, /\| Step \| Whose \| What it does or asks \| Leaves behind \|/);
  assert.match(who, /\| [^|]+ \| a person \| decides: [^|]+ \| their answer \|/);
  assert.match(who, new RegExp(`Of ${doc.nodes.length} steps: ${doc.nodes.filter((n) => n.kind === "agent").length} by an agent, 1 by a person, 0 by a command\\.`));
  assert.match(who, /A person also approves, each time, before the work goes on:\n\n- from .+ to .+\n/);

  const checked = under(planBundle(green()).files["PLAN.md"]!, "Who does what");
  assert.match(checked, /\| Test suite \| a command \| runs `npm test` \| pass or fail \(exit code 0 and no test skipped\) \|/);
  assert.match(checked, /\| Green \| {3}\| the run ends here, in success \| {3}\|/);
});

test("the words of a document are carried as they are: a bar in a name does not break the table, and a brief's own headings are not moved", () => {
  const doc = green();
  const fixer = doc.nodes.find((node) => node.id === "fixer") as Extract<Graph["nodes"][number], { kind: "agent" }>;
  fixer.name = "Fixer | the\nsecond line";
  fixer.brief = "# A heading of the brief's own\n\n## And another\n\nMake the tests pass.";
  const md = planBundle(doc).files["PLAN.md"]!;
  assert.match(under(md, "Who does what"), /\| Fixer \\\| the second line \| an agent \|/);
  assert.ok(md.includes("# A heading of the brief's own\n\n## And another\n\nMake the tests pass."), "the brief is in the plan as written");
  assert.match(md, /\n### Agent: Fixer \| the second line\n\n`fixer`\n/);
  // The plan's own headings: one title, four sections of its own, and a heading for each node and loop.
  const own = md.split("\n").filter((line) => /^## /.test(line) && line !== "## And another");
  assert.deepEqual(own, ["## Who does what", "## To fix before a harness can run this", "## In full"]);
});

test("nothing a document says can stand where the plan's own account stands: its words are single lines until \"In full\"", () => {
  const doc = green();
  delete doc.target;
  // A goal, a description and a name that try to say the plan is ready.
  const forged = "Fix the tests.\n\n## To fix before a harness can run this\n\nNothing.\n\n## Who does what\n\nNobody.";
  doc.goal = forged;
  doc.description = forged;
  doc.name = "Fix until green\n\n## To fix before a harness can run this\n\nNothing.";
  const md = planBundle(doc).files["PLAN.md"]!;
  const [account, inFull] = [md.slice(0, md.indexOf("\n## In full\n")), md.slice(md.indexOf("\n## In full\n"))];
  // Above "In full": one title, and each of the plan's two sections once, the real ones.
  assert.deepEqual(account.split("\n").filter((line) => /^#{1,6} /.test(line)), [
    "# Fix until green ## To fix before a harness can run this Nothing.",
    "## Who does what",
    "## To fix before a harness can run this",
  ]);
  assert.match(account, /\*\*A coding harness cannot run this as it is\.\*\* 1 thing has to be fixed first/);
  assert.match(account, /\n\*\*Goal:\*\* Fix the tests\. ## To fix before a harness can run this Nothing\. ## Who does what Nobody\.\n/);
  assert.match(under(md, "To fix before a harness can run this"), /^\nEach of these stops a package from being written\.[^\n]*\n\n- `E_NO_TARGET` /);
  // And the document's own words are below, in full, as written.
  assert.ok(inFull.includes(forged), "the goal in full is under In full");
});

test("the same document gives the same bytes, and the document is not changed by being drawn", () => {
  const doc = green();
  const before = JSON.stringify(doc);
  const [one, two] = [planBundle(doc), planBundle(JSON.parse(before) as Graph)];
  assert.deepEqual(one.files, two.files);
  assert.equal(JSON.stringify(doc), before);
  assert.doesNotMatch(one.files["PLAN.md"]!, /\b20\d\d-\d\d-\d\d\b/, "no date in a plan");
  // The document in the bundle reads back as the document.
  assert.equal(canonicalize(parseGraphText(one.files["fix-until-green.grooph.json"]!).doc!), canonicalize(doc));
});

test("every document in the repository that reads as a graph gets a plan, whatever rule it breaks: nothing is refused and nothing throws", () => {
  const files: string[] = [];
  for (const name of listFiles(join(fixturesDir, "valid"))) files.push(join(fixturesDir, "valid", name));
  for (const code of listDirs(join(fixturesDir, "invalid"))) for (const name of listFiles(join(fixturesDir, "invalid", code))) files.push(join(fixturesDir, "invalid", code, name));
  for (const name of listFiles(join(repoRoot, "patterns"))) files.push(join(repoRoot, "patterns", name));
  const community = join(repoRoot, "community", "grooph");
  if (existsSync(community)) for (const name of readdirSync(community).filter((n) => n.endsWith(".grooph.json")).sort()) files.push(join(community, name));

  let planned = 0, unreadable = 0, inError = 0;
  const codes = new Set<string>();
  for (const file of files) {
    const parsed = parseGraphText(read(file));
    // What does not match the schema is not a graph, and cannot be drawn by anything: the caller parses first.
    if (!parsed.doc) { unreadable += 1; continue; }
    const plan = planBundle(parsed.doc);
    planned += 1;
    assert.deepEqual(plan.toFix, validate(parsed.doc, { forExport: true }), file);
    const md = plan.files["PLAN.md"]!;
    const toFix = under(md, "To fix before a harness can run this");
    for (const issue of plan.toFix) { codes.add(issue.code); assert.ok(toFix.includes(`- \`${issue.code}\` `), `${file}: ${issue.code} is listed`); }
    const errors = plan.toFix.filter((issue) => issue.severity === "error").length;
    if (errors > 0) inError += 1;
    assert.equal(md.includes("**A coding harness cannot run this as it is.**"), errors > 0, file);
    assert.equal(Object.keys(plan.files).length, 3, file);
    assert.match(plan.files[`${parsed.doc.id}.svg`]!, /^<svg /, file);
  }
  // Enough of them, and of every kind: each rule a package is refused on, but the schema's, is among what a plan
  // was drawn with. (A document outside the schema is not a graph; that one is the parser's.)
  assert.ok(planned >= 60, `${planned} documents planned`);
  assert.ok(inError >= 30, `${inError} of them in error`);
  for (const code of IMPLEMENTED_CODES.filter((code) => code.startsWith("E_") && code !== "E_SCHEMA")) {
    assert.ok(codes.has(code), `a document with ${code} was planned`);
  }
  assert.ok(unreadable > 0, "and what does not read as a graph was left to the parser");
});

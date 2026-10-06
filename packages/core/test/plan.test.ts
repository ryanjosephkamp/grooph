import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { deflateRawSync, inflateRawSync } from "node:zlib";

import { canonicalize } from "../src/canonicalize.js";
import { tryCompile } from "../src/compile/index.js";
import { picture } from "../src/index.js";
import { offlinePage } from "../src/index.js";
import { adoptWorkingCopy, buildRunBundle } from "../src/runs.js";
import { decodeSharePayload } from "../src/share.js";
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
  assert.match(md, /grooph runs nothing: a plan is for people to read and follow\./);
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
  assert.match(who, new RegExp(`Of ${doc.nodes.length} steps: ${doc.nodes.filter((n) => n.kind === "agent").length} by an agent, 1 by a person, 0 by a command; 1 ends the run\\.`));
  // Only the edge that asks for an approval is listed, by the names of its two steps: one of seven edges here.
  assert.equal(doc.edges.length, 7);
  assert.match(who, /A person is also asked, apart from the steps above:\n\n- to approve the work going from Planner to Builder, each time\n$/);

  const checked = under(planBundle(green()).files["PLAN.md"]!, "Who does what");
  assert.match(checked, /\| Test suite \| a command \| runs `npm test` \| pass or fail \(exit code 0 and no test skipped\) \|/);
  assert.match(checked, /\| Green \| {3}\| the run ends here, in success \| {3}\|/);
  assert.match(checked, /Of 3 steps: 1 by an agent, 0 by a person, 1 by a command; 1 ends the run\.\n$/);
});

test("who does what, the cases a reader found wrong: a check the lead judges, a merge, a loop that stops for a person, names and answers that are blank", () => {
  const doc = green();
  const suite = doc.nodes.find((node) => node.id === "suite") as Extract<Graph["nodes"][number], { kind: "check" }>;
  // A check with no command is nobody's command: the lead judges it.
  suite.check = { kind: "evidence", pass: "" };
  suite.name = " ";
  doc.nodes.push({ id: "gather", kind: "merge", name: "Gather", merges: [] }, { id: "ask", kind: "human-gate", name: "Ask", prompt: "Ship it?", options: ["", " "] });
  doc.loops[0]!.stops.push({ kind: "human", every: 2 }, { kind: "human" });
  const steps = planSteps(doc);
  assert.deepEqual(steps.find((step) => step.id === "suite"), { id: "suite", name: "suite", whose: "the lead", does: "judges a check of kind evidence", leaves: "pass or fail" });
  assert.deepEqual(steps.find((step) => step.id === "gather"), { id: "gather", name: "Gather", whose: "the lead", does: "merges what it is handed", leaves: "" });
  assert.equal(steps.find((step) => step.id === "ask")!.does, "is asked: Ship it?");
  const who = under(planBundle(doc).files["PLAN.md"]!, "Who does what");
  // Every step is in the count: the lead's and the stops with the rest.
  assert.match(who, /Of 5 steps: 1 by an agent, 1 by a person, 0 by a command, 2 by the lead; 1 ends the run\./);
  assert.match(who, /A person is also asked, apart from the steps above:\n\n- in the loop Fix cycle, every 2 rounds\n- in the loop Fix cycle, when it stops for them\n$/);
  doc.loops[0]!.stops = [{ kind: "human", every: 1 }];
  assert.match(under(planBundle(doc).files["PLAN.md"]!, "Who does what"), /- in the loop Fix cycle, every round\n$/);
  // A command keeps its own field for a view, as written, and the step says only that it runs one.
  assert.deepEqual(planSteps(green()).find((step) => step.id === "suite"), { id: "suite", name: "Test suite", whose: "a command", does: "runs a command", leaves: "pass or fail (exit code 0 and no test skipped)", command: "npm test" });
  // The lead's own node is the lead's, with what else the lead does: the count has one "by the lead" for all of it.
  const led = green();
  led.nodes.unshift({ id: "lead", kind: "agent", name: "Lead", role: "lead", brief: "Run the graph.", outputs: ["PROGRESS.md"] } as Graph["nodes"][number]);
  assert.equal(planSteps(led)[0]!.whose, "the lead");
  assert.match(under(planBundle(led).files["PLAN.md"]!, "Who does what"), /Of 4 steps: 1 by an agent, 0 by a person, 1 by a command, 1 by the lead; 1 ends the run\./);
});

test("the words of a document are carried as they are: a bar in a name does not break the table, and a brief's own headings are not moved", () => {
  const doc = green();
  const fixer = doc.nodes.find((node) => node.id === "fixer") as Extract<Graph["nodes"][number], { kind: "agent" }>;
  fixer.name = "Fixer | the\nsecond line";
  fixer.brief = "# A heading of the brief's own\n\n## And another\n\nMake the tests pass.";
  const md = planBundle(doc).files["PLAN.md"]!;
  assert.match(under(md, "Who does what"), /\| Fixer \\\| the second line \| an agent \|/);
  assert.ok(md.includes("# A heading of the brief's own\n\n## And another\n\nMake the tests pass."), "the brief is in the plan as written");
  assert.match(md, /\n### Agent: Fixer \\\| the second line\n\n`fixer`\n/);
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
    "# Fix until green \\#\\# To fix before a harness can run this Nothing.",
    "## Who does what",
    "## To fix before a harness can run this",
  ]);
  assert.match(account, /\*\*A coding harness cannot run this as it is\.\*\* 1 thing has to be fixed first/);
  assert.ok(account.includes("\n**Goal:** Fix the tests. \\#\\# To fix before a harness can run this Nothing. \\#\\# Who does what Nobody.\n"));
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

// ─── nothing that only draws or shares a document asks for a harness ─────────────────────────────────────────
//
// Six places in core validated for export whatever they were for, so a plan was refused a link, arrived with
// errors, and could not be a candidate or a version. Each now asks only what a graph is asked. (Sharing and a
// proposal set are held in share.test.ts and proposals.test.ts.)

test("the offline page of a plan says it has no issues, and one of a graph that breaks a rule lists it", () => {
  const plan = green();
  delete plan.target;
  delete plan.goal;
  const page = offlinePage(plan);
  assert.match(page, />No issues\.</);
  assert.doesNotMatch(page, /E_NO_TARGET|E_NO_GOAL|validates for export/);
  const broken = green();
  broken.edges[0]!.to = "nowhere";
  assert.match(offlinePage(broken), /E_DANGLING_REF/);
});

test("adoption is as it was: a run is of a package, and a working copy that could no longer be exported is not the next version", () => {
  // The one place of the six that was left asking what a package asks. A plan has no run, so adoption never meets
  // one; and a run's copy that has lost its goal or its harness, or become a template, is almost surely a mistake.
  const source = green();
  for (const [what, change, code] of [
    ["its goal removed", (w: Graph) => void delete w.goal, "E_NO_GOAL"],
    ["its harness removed", (w: Graph) => void delete w.target, "E_NO_TARGET"],
    ["a harness with no compiler", (w: Graph) => void (w.target = { harness: "my-own-harness" }), "E_NO_TARGET"],
    ["a slot left in a brief", (w: Graph) => void ((w.nodes[0] as { brief: string }).brief = "Fix {{what}}."), "E_UNFILLED_SLOT"],
    ["an edge to nowhere", (w: Graph) => void (w.edges[0]!.to = "nowhere"), "E_DANGLING_REF"],
  ] as const) {
    const working = green();
    change(working);
    const adopted = adoptWorkingCopy(source, parseGraphText(JSON.stringify(working)).doc!, { run: "r" });
    assert.equal(adopted.ok, false, what);
    assert.ok(!adopted.ok && adopted.issues.some((issue) => issue.code === code), `${what}: ${code}`);
    assert.match(adopted.ok ? "" : adopted.message, /that blocks? export, so it cannot become version 2 of fix-until-green\./, what);
  }
  const fine = adoptWorkingCopy(source, green(), { run: "r" });
  assert.ok(fine.ok);
});

test("a run's link arrives with the working copy's own findings, and none that only a package asks for", () => {
  const source = green();
  const working = green();
  delete working.goal;
  const bundle = buildRunBundle({ source, working, notesText: "", run: "r1" });
  const payload = Buffer.from(deflateRawSync(Buffer.from(JSON.stringify({ v: 1, kind: "run", doc: bundle })))).toString("base64url");
  const arrived = decodeSharePayload(payload, (bytes) => new Uint8Array(inflateRawSync(bytes)));
  assert.ok(arrived.ok, arrived.ok ? "" : arrived.message);
  assert.deepEqual(arrived.issues, []);
});

// ─── what a fresh reader got through the first version ──────────────────────────────────────────────────────
//
// Keeping a document's words to one line was not enough. A finding's `at` list was joined as it came, and an
// unknown key named "id" puts any string there; and one line of HTML is enough to write a section once the file is
// rendered. So a document's words are escaped as well, everywhere above "In full".

/** The plan's own account: PLAN.md above the first line that is exactly "## In full". */
const account = (markdown: string): string[] => {
  const lines = markdown.split("\n");
  const end = lines.indexOf("## In full");
  assert.ok(end > 0, "PLAN.md has its In full");
  return lines.slice(0, end);
};
/** What must hold of every plan, whatever the document says. */
const held = (doc: Graph, what: string): void => {
  const plan = planBundle(doc);
  const lines = account(plan.files["PLAN.md"]!);
  // One title, and the two sections of grooph's own, once each and in order: no line of the document's is a heading.
  assert.deepEqual(lines.filter((line) => /^\s{0,3}#/.test(line)).map((line) => (line.startsWith("# ") ? "#" : line)), ["#", "## Who does what", "## To fix before a harness can run this"], what);
  // No tag, comment, link, image, code span or entity of the document's: each such mark is escaped. Taken out
  // first: every escaped mark, and then what the plan itself sets as code (the file's name, a rule's code, a
  // command), inside which nothing is a mark and which can hold no backtick, bar, tag or backslash. What is left
  // must hold none of the marks at all, but for the plan's one image.
  const text = lines.join("\n").replace(/\\[\\`*_[\]<>&|~#]/g, "ESC").replace(/`[^`\n|<>\\]*`/g, "CODE");
  for (const mark of ["`", "<", "&", "\\"]) assert.ok(!text.includes(mark), `${what}: an unescaped ${mark}`);
  assert.equal(text.split("![").length - 1, 1, `${what}: one image, the plan's`);
  assert.equal(text.split("[").length - 1, 1, `${what}: no link`);
  assert.doesNotMatch(lines.join("\n"), new RegExp("[\\u0000-\\u0009\\u000b-\\u001f\\u007f-\\u009f\\u200b-\\u200d\\u2028\\u2029\\u2060]"), `${what}: a character that shows as nothing`);
  // The title is not empty, and no heading is closed by a document's "#".
  assert.match(lines[0]!, /^# \S/, `${what}: a title`);
  // One bullet for each finding, one row for each node.
  const fixes = lines.slice(lines.indexOf("## To fix before a harness can run this"));
  assert.equal(fixes.filter((line) => line.startsWith("- `")).length, plan.toFix.length, `${what}: a bullet for each finding`);
  if (doc.nodes.length > 0) assert.equal(lines.filter((line) => line.startsWith("| ")).length, doc.nodes.length + 1, `${what}: a row for each node`);
  assert.equal(lines.filter((line) => line.trim() !== "" && !/^(#|\||- |\*\*|!\[|A |Of |No steps|Each of these|And these|These are|Nothing\.)/.test(line)).length, 0, `${what}: a line of the account that is not the plan's own: ${lines.find((line) => line.trim() !== "" && !/^(#|\||- |\*\*|!\[|A |Of |No steps|Each of these|And these|These are|Nothing\.)/.test(line))}`);
};

const HOSTILE = [
  "x)\n\n## To fix before a harness can run this\n\nNothing.\n\n## In full\n\n(",
  "x)\n\n<!--",
  "Fix.</p><h2>To fix before a harness can run this</h2><p>Nothing. A coding harness could run this as it is.</p><details><summary>x</summary>",
  "a | b `c` | d\\",
  "[click](https://example.invalid) ![i](x.svg) **bold** _it_ ~~no~~ &lt;b&gt;",
  "line one\u2028## In full\u2029# Title\u0085## Who does what\u001e\u0000\r\n## To fix before a harness can run this",
  " ",
  "\\",
  "#",
  "Release notes #",
  "\u200b\u2060",
  "cd app\nnpm test",
  "see https://example.invalid/login & www.example.invalid",
];

test("the reader's two forgeries, and its false line: through a finding's place, through one line of HTML, and a plan called whole that had lost a step", () => {
  // An unknown key named "id" on the target is where W_UNKNOWN_KEY says the finding is.
  const byPlace = green();
  delete byPlace.goal;
  (byPlace.target as unknown as Record<string, string>).id = HOSTILE[0]!;
  const read = parseGraphText(JSON.stringify(byPlace)).doc!;
  assert.ok(planBundle(read).toFix.some((issue) => issue.at.includes(HOSTILE[0]!)), "the hostile string is a finding's place");
  held(read, "a finding's place");
  const md = planBundle(read).files["PLAN.md"]!;
  assert.equal(md.split("\n").filter((line) => line === "## In full").length, 1);
  assert.equal(md.split("\n").filter((line) => line === "## To fix before a harness can run this").length, 1);

  const byHtml = green();
  delete byHtml.target;
  byHtml.goal = HOSTILE[2]!;
  (byHtml.nodes[0] as { name: string }).name = HOSTILE[2]!;
  held(byHtml, "a line of HTML");
  assert.ok(planBundle(byHtml).files["PLAN.md"]!.includes("**Goal:** Fix.\\</p\\>\\<h2\\>To fix before a harness can run this\\</h2\\>"));

  // Two nodes under one id: the outline can show only one of them, and the plan no longer says it is whole.
  const twice = green();
  twice.nodes[1]!.id = twice.nodes[0]!.id;
  const lost = planBundle(parseGraphText(JSON.stringify(twice)).doc!);
  assert.ok(lost.toFix.some((issue) => issue.code === "E_DUPLICATE_ID"));
  assert.doesNotMatch(lost.files["PLAN.md"]!, /it is whole/);
  assert.match(lost.files["PLAN.md"]!, /5 things have to be fixed first, listed under "To fix before a harness can run this"\. They are rules a graph itself is held to, not only what a package asks for: until they are fixed, parts of the plan below may be missing or drawn wrong\./);
  // With a package's need unmet beside them, the plan says how many are the graph's own.
  delete twice.target;
  assert.match(planBundle(parseGraphText(JSON.stringify(twice)).doc!).files["PLAN.md"]!, /6 things have to be fixed first, listed under "To fix before a harness can run this"\. 5 of them are rules a graph itself is held to, not only what a package asks for: until they are fixed, parts of the plan below may be missing or drawn wrong\./);
  // One rule broken, and nothing else: said of the one.
  const one = green();
  one.loops[0]!.stops = [];
  const alone = planBundle(one);
  assert.deepEqual(alone.toFix.filter((issue) => issue.severity === "error").map((issue) => issue.code), ["E_CYCLE_NO_STOP"]);
  assert.match(alone.files["PLAN.md"]!, /1 thing has to be fixed first, listed under "To fix before a harness can run this"\. It is a rule a graph itself is held to, not only what a package asks for: until it is fixed, parts of the plan below may be missing or drawn wrong\./);
  // Where only a package's needs are unmet, it is whole, and says so.
  const plan = green();
  delete plan.target;
  assert.match(planBundle(plan).files["PLAN.md"]!, /1 thing has to be fixed first, listed under "To fix before a harness can run this"\. As a plan for people to read and follow it is whole\./);
});

test("every string a document can hold, made hostile in turn: the plan's own account stays the plan's", () => {
  const sources = ["fixtures/valid/fix-until-green.grooph.json", "fixtures/valid/subgrooph-in-a-graph.grooph.json", "fixtures/valid/review-loop.grooph.json", "patterns/taste-polish.grooph.json", "patterns/merge-queue.grooph.json"];
  let tried = 0;
  for (const source of sources) {
    const text = JSON.stringify({ ...JSON.parse(read(join(repoRoot, source))), edges: (JSON.parse(read(join(repoRoot, source))) as Graph).edges.map((edge) => ({ ...edge, approval: true })) });
    // Every string value in the document, by where it is; ids and other words the schema fixes will not parse, and are skipped.
    const paths: (string | number)[][] = [];
    const walk = (value: unknown, path: (string | number)[]): void => {
      if (typeof value === "string") paths.push(path);
      else if (Array.isArray(value)) value.forEach((entry, i) => walk(entry, [...path, i]));
      else if (value && typeof value === "object") for (const [key, entry] of Object.entries(value)) walk(entry, [...path, key]);
    };
    walk(JSON.parse(text), []);
    for (const path of paths) {
      for (const hostile of HOSTILE) {
        const raw = JSON.parse(text) as Record<string, unknown>;
        let at: Record<string | number, unknown> = raw;
        for (const key of path.slice(0, -1)) at = at[key] as Record<string | number, unknown>;
        at[path.at(-1)!] = hostile;
        const parsed = parseGraphText(JSON.stringify(raw));
        if (!parsed.doc) continue;
        tried += 1;
        held(parsed.doc, `${source} ${path.join(".")}`);
      }
    }
    // And a key the schema does not know, named "id", on every object that can carry one: a finding's place.
    for (const hostile of HOSTILE) {
      const raw = JSON.parse(text) as Graph & Record<string, unknown>;
      for (const holder of [raw.target, raw.constraints, ...raw.nodes.map((node) => (node as { model?: object }).model), ...raw.loops.map((loop) => loop.bar)]) {
        if (holder && typeof holder === "object") (holder as Record<string, string>).id = hostile;
      }
      const parsed = parseGraphText(JSON.stringify(raw));
      if (!parsed.doc) continue;
      tried += 1;
      held(parsed.doc, `${source} unknown ids`);
    }
  }
  assert.ok(tried >= 500, `${tried} hostile documents read as graphs and were planned`);
});

test("a command is shown only as it is written: one of several lines, or with a mark in it, is left to In full", () => {
  const row = (run: string): string => {
    const doc = green();
    (doc.nodes.find((node) => node.id === "suite") as Extract<Graph["nodes"][number], { kind: "check" }>).check.run = run;
    const md = planBundle(doc).files["PLAN.md"]!;
    assert.ok(md.slice(md.indexOf("\n## In full\n")).includes(run.trim()), "the command is in full below");
    return under(md, "Who does what").split("\n").find((line) => line.startsWith("| Test suite "))!;
  };
  assert.match(row("npm test"), /\| a command \| runs `npm test` \|/);
  assert.match(row("pnpm -r build"), /\| runs `pnpm -r build` \|/);
  // Made one line, "cd app" and "npm test" would read as one command that nobody wrote; so would a run of spaces.
  assert.match(row("pnpm build && pnpm test"), /\| runs `pnpm build && pnpm test` \|/);
  assert.match(row("pytest -k 'not slow' tests/[a-m]*_test.py"), /\| runs `pytest -k 'not slow' tests\/\[a-m\]\*_test\.py` \|/);
  for (const run of ["cd app\nnpm test", 'echo "a   b"', "a | b", "echo `date`", "make <target>", "grep a\\|b"]) {
    assert.match(row(run), /\| a command \| runs a command, given in full below \|/, run);
  }
});

test("what else the reader's changed copies of the code got past the tests: the harness named, errors apart from warnings, the count of what must be fixed", () => {
  // The harness the package would be for is the document's.
  const codex = green();
  codex.target = { harness: "codex" };
  assert.match(planBundle(codex).files["PLAN.md"]!, /`grooph export` writes its package for codex\./);
  // One error and a warning: the count is of errors, each kind is under its own sentence, and a message is one line.
  const mixed = green();
  delete mixed.target;
  mixed.loops[0]!.stops = [{ kind: "max-iterations", n: 9 }];
  const plan = planBundle(mixed);
  assert.equal(plan.toFix.filter((issue) => issue.severity === "error").length, 1);
  assert.ok(plan.toFix.filter((issue) => issue.severity !== "error").length >= 1);
  const md = plan.files["PLAN.md"]!;
  assert.match(md, /\*\*A coding harness cannot run this as it is\.\*\* 1 thing has to be fixed first/);
  const toFix = under(md, "To fix before a harness can run this");
  const [stops, carried] = toFix.split("And these are warnings: a package is written with them, and carries them in its lead's brief.");
  assert.ok(carried !== undefined, "the warnings have their own sentence");
  assert.deepEqual((stops!.match(/^- `([A-Z_]+)`/gm) ?? []), ["- `E_NO_TARGET`"]);
  assert.deepEqual((carried!.match(/^- `([A-Z_]+)`/gm) ?? []).sort(), plan.toFix.filter((issue) => issue.severity !== "error").map((issue) => `- \`${issue.code}\``).sort());
  // Every loop has its section under In full, as every node has.
  const inFull = md.slice(md.indexOf("\n## In full\n"));
  for (const loop of mixed.loops) assert.ok(inFull.includes(`\n### Loop: ${loop.name}\n\n\`${loop.id}\`\n`), loop.id);
  for (const node of mixed.nodes) assert.ok(inFull.includes(`\`${node.id}\`\n`), node.id);
  // A document that carries notes from runs says so.
  const noted = green();
  noted.notes = [{ id: "n-0001", run: "r1", at: "node:fixer", outcome: "pass", summary: "fixed two tests" }] as unknown as Graph["notes"];
  const kept = parseGraphText(JSON.stringify(noted));
  assert.ok(kept.doc, JSON.stringify(kept.issues).slice(0, 300));
  assert.match(planBundle(kept.doc).files["PLAN.md"]!, /and that is the one to edit\. It carries 1 note from runs, which is in that file and not shown here\.\n/);
  assert.doesNotMatch(planBundle(green()).files["PLAN.md"]!, /It carries/);
});

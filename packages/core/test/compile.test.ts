/**
 * The compiler: the golden package byte for byte, the package contract from
 * graph-ir §5, and the unit mapping from `docs/targets/claude-code.md`.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { test } from "node:test";

import { CompileError, compile } from "../src/compile/index.js";
import { parseGraphText } from "../src/parse.js";
import { validate } from "../src/validate.js";
import type { Graph } from "../src/types.js";
import { expectedIssues, fixturesDir, invalidFixtures, read, validFixtures } from "./helpers.js";

const reviewLoopPath = validFixtures().find((f) => f.name.startsWith("review-loop"))!.path;
const reviewLoop = (): Graph => {
  const parsed = parseGraphText(read(reviewLoopPath));
  assert.ok(parsed.doc);
  return parsed.doc;
};

const goldenDirFor = (id: string): string => join(fixturesDir, "golden", "claude-code", id);

const walk = (dir: string): string[] =>
  readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });

const load = (name: string): Graph => {
  const parsed = parseGraphText(read(validFixtures().find((f) => f.name === `${name}.grooph.json`)!.path));
  assert.ok(parsed.doc);
  return parsed.doc;
};

for (const name of ["review-loop", "fix-until-green"]) {
  test(`the compiled ${name} package equals its golden package, byte for byte`, () => {
    const goldenDir = goldenDirFor(name);
    assert.ok(existsSync(goldenDir), "the golden package is committed");
    const result = compile(load(name), "claude-code");

    const goldenFiles = walk(goldenDir).map((path) => relative(goldenDir, path).split(sep).join("/"));
    assert.deepEqual(
      Object.keys(result.files).sort(),
      goldenFiles.sort(),
      "the same set of files, no more and no fewer — run `pnpm --filter @grooph/core run golden:write`",
    );

    for (const path of goldenFiles) {
      assert.equal(result.files[path], read(join(goldenDir, path)), `${path} differs from the golden package`);
    }
  });
}

test("compile is pure: two runs give the same bytes", () => {
  const a = compile(reviewLoop(), "claude-code");
  const b = compile(reviewLoop(), "claude-code");
  assert.deepEqual(a.files, b.files);
  assert.equal(a.kickoff, b.kickoff);
});

test("the kickoff is the KICKOFF.md file", () => {
  const result = compile(reviewLoop(), "claude-code");
  assert.equal(result.kickoff, result.files[".grooph/review-loop/KICKOFF.md"]);
  assert.ok(result.kickoff.includes(".grooph/review-loop/LEAD.md"), "it points at the lead brief");
});

test("the package layout is the one the target profile documents", () => {
  const result = compile(reviewLoop(), "claude-code");
  assert.deepEqual(Object.keys(result.files), [
    ".claude/agents/review-loop--builder.md",
    ".claude/agents/review-loop--critic.md",
    ".claude/skills/review-loop/SKILL.md",
    ".grooph/review-loop/KICKOFF.md",
    ".grooph/review-loop/LEAD.md",
    ".grooph/review-loop/MAPPING.md",
    ".grooph/review-loop/graph.grooph.json",
  ]);
  for (const path of Object.keys(result.files)) {
    assert.ok(
      path.startsWith(".grooph/") || path.startsWith(".claude/"),
      `${path} is outside the two roots the profile allows`,
    );
    assert.ok(!path.includes(":"), "no path carries a colon: subagent names forbid them");
  }
});

test("the emitted graph document is the canonical source document", () => {
  const result = compile(reviewLoop(), "claude-code");
  const emitted = result.files[".grooph/review-loop/graph.grooph.json"]!;
  const reparsed = parseGraphText(emitted);
  assert.deepEqual(reparsed.issues, []);
  assert.deepEqual(reparsed.doc, reviewLoop(), "same document, only the key order is canonical");
  assert.deepEqual(
    validate(reparsed.doc!, { forExport: true }).map((issue) => issue.code),
    expectedIssues(reviewLoopPath),
  );
});

test("LEAD.md carries all eleven sections in the documented order", () => {
  const lead = compile(reviewLoop(), "claude-code").files[".grooph/review-loop/LEAD.md"]!;
  const headings = [
    "## 1. You are the lead",
    "## 2. Goal and constraints",
    "## 3. Run setup",
    "## 4. Nodes",
    "## 5. Edges",
    "## 6. Loops",
    "## 7. Human gates",
    "## 8. Progress and notes",
    "## 9. Adapting the graph",
    "## 10. Validation warnings",
    "## 11. Ending",
  ];
  let cursor = -1;
  for (const heading of headings) {
    const at = lead.indexOf(heading);
    assert.ok(at > cursor, `${heading} is missing or out of order`);
    cursor = at;
  }
});

test("LEAD.md carries every piece of the package contract (graph-ir §5)", () => {
  const doc = reviewLoop();
  const lead = compile(doc, "claude-code").files[".grooph/review-loop/LEAD.md"]!;

  assert.ok(lead.includes(doc.goal!), "the goal, verbatim");
  assert.ok(lead.includes(doc.constraints!.budget!), "the constraints, verbatim");
  assert.ok(lead.includes(doc.description!), "the description, verbatim");

  for (const node of doc.nodes) assert.ok(lead.includes(node.id), `node ${node.id} is listed`);
  for (const edge of doc.edges) assert.ok(lead.includes(edge.id), `edge ${edge.id} is listed`);

  const loop = doc.loops[0]!;
  assert.ok(lead.includes(loop.id) && lead.includes(loop.name));
  assert.ok(lead.includes(loop.bar!.acceptance), "the bar's acceptance line, verbatim");
  for (const entry of loop.bar!.inspects) assert.ok(lead.includes(entry.ref), `the critic inspects ${entry.ref}`);
  assert.ok(lead.includes("max iterations: 4") && lead.includes("budget: 40 turns"), "stops with their numbers");
  assert.ok(lead.indexOf("bar passed") < lead.indexOf("max iterations: 4"), "stops in document order");

  assert.ok(lead.includes("The critic passed the change. Merge it?"), "the human gate, verbatim");
  assert.ok(lead.includes("runs/<run-id>/PROGRESS.md") && lead.includes("runs/<run-id>/notes.jsonl"));
  assert.ok(lead.includes('"at":"node:critic"'), "the notes example is filled in");
  assert.ok(lead.includes("W_HOMOGENEOUS_CRITICS"), "the validation warnings, where the human will see them");
});

test("validation warnings are copied into LEAD.md verbatim", () => {
  const doc = reviewLoop();
  const oversized: Graph = {
    ...doc,
    description: `${doc.description} ${"padding to push this document over the one-pass budget. ".repeat(400)}`,
  };
  const result = compile(oversized, "claude-code");
  assert.deepEqual(result.warnings.map((w) => w.code), ["W_HOMOGENEOUS_CRITICS", "W_DOC_TOO_LARGE"]);
  const lead = result.files[".grooph/review-loop/LEAD.md"]!;
  for (const warning of result.warnings) {
    assert.ok(lead.includes(warning.message), `${warning.code}: the message, verbatim, where the human will see it`);
  }
});

test("subagent frontmatter follows the capability-to-tools table", () => {
  const files = compile(reviewLoop(), "claude-code").files;

  const builder = files[".claude/agents/review-loop--builder.md"]!;
  assert.match(builder, /^---\nname: review-loop--builder\n/);
  assert.match(builder, /\nmodel: opus\n/, "tier strong → opus");
  assert.match(builder, /\neffort: high\n/);
  assert.match(builder, /\ntools: Read, Edit, Write, Glob, Grep, Bash\n/);
  assert.ok(!builder.includes("disallowedTools"), "the builder denies nothing");

  const critic = files[".claude/agents/review-loop--critic.md"]!;
  assert.match(critic, /\ntools: Read, Write, Glob, Grep, Bash\n/, "write-outputs maps to Write");
  assert.match(critic, /\ndisallowedTools: Edit\n/, "deny minus allow, so Read and Write survive");
  assert.match(critic, /only the files you declare in these outputs/, "and the body bounds what Write may touch");
  assert.ok(critic.includes("invalid-evidence"), "the critic knows the evidence escape hatch");
  assert.ok(critic.includes("docs/REVIEW-CHECKLIST.md"), "and what it may inspect");
});

test("an unmapped capability becomes a body note, never a tool", () => {
  const doc = reviewLoop();
  const patched: Graph = {
    ...doc,
    nodes: doc.nodes.map((node) =>
      node.id === "builder" && node.kind === "agent"
        ? { ...node, allow: [...(node.allow ?? []), "deploy-to-staging"] }
        : node,
    ),
  };
  const builder = compile(patched, "claude-code").files[".claude/agents/review-loop--builder.md"]!;
  const frontmatter = builder.slice(0, builder.indexOf("\n---", 4));
  assert.ok(!frontmatter.includes("deploy-to-staging"), "not a tool name");
  assert.ok(builder.includes("allow deploy-to-staging"), "but stated in the body for a human to wire");
});

test("no agent file is emitted for a check, gate, merge or stop node", () => {
  const files = compile(reviewLoop(), "claude-code").files;
  const agentFiles = Object.keys(files).filter((path) => path.startsWith(".claude/agents/"));
  assert.deepEqual(agentFiles.length, 2, "only the two agent nodes");
  const mapping = files[".grooph/review-loop/MAPPING.md"]!;
  assert.ok(mapping.includes("`merge-gate` (human-gate)"), "the gate is accounted for in the mapping notes");
  assert.ok(mapping.includes("`done` (stop)"));
});

test("the skill is human-invoked only", () => {
  const skill = compile(reviewLoop(), "claude-code").files[".claude/skills/review-loop/SKILL.md"]!;
  assert.match(skill, /^---\nname: review-loop\n/);
  assert.match(skill, /\ndisable-model-invocation: true\n/);
  assert.match(skill, /\nargument-hint: \[run-id to resume\]\n/);
});

test("export refuses an invalid graph and names the reasons (spec §9)", () => {
  for (const fixture of invalidFixtures()) {
    const parsed = parseGraphText(read(fixture.path));
    if (!parsed.doc) continue; // E_SCHEMA never reaches the compiler
    const errors = validate(parsed.doc, { forExport: true }).filter((i) => i.severity === "error");
    if (errors.length === 0) continue; // warning-only fixtures still export

    assert.throws(
      () => compile(parsed.doc!, "claude-code"),
      (err: unknown) => {
        assert.ok(err instanceof CompileError, `${fixture.name}: expected a CompileError`);
        assert.ok(
          err.issues.some((issue) => issue.code === fixture.code),
          `${fixture.name}: the refusal should name ${fixture.code}`,
        );
        assert.match(err.message, /cannot export/);
        return true;
      },
      `${fixture.code}/${fixture.name} must not compile`,
    );
  }
});

test("a warning does not block export", () => {
  const oversized = invalidFixtures().find((f) => f.code === "W_DOC_TOO_LARGE")!;
  const parsed = parseGraphText(read(oversized.path));
  assert.ok(parsed.doc);
  const result = compile(parsed.doc, "claude-code");
  assert.ok(result.warnings.some((w) => w.code === "W_DOC_TOO_LARGE"));
  assert.ok(Object.keys(result.files).length > 0, "the package is still emitted");
});

/* ------------------------------------------------------------------ *
 * Adaptation (graph-ir §2, A-008): LEAD.md §9 per level, the working copy.
 * ------------------------------------------------------------------ */

const sectionNine = (doc: Graph): string => {
  const lead = compile(doc, "claude-code").files[`.grooph/${doc.id}/LEAD.md`]!;
  return lead.slice(lead.indexOf("## 9. Adapting the graph"), lead.indexOf("## 10."));
};

/** graph-ir §2 "Brakes are not adaptable", in its own order. */
const BRAKES = [
  "a human gate",
  "an edge `approval`",
  "an `irreversible` marker",
  "a `budget` or `max-iterations` stop",
  "a bar's `acceptance`",
  "critic isolation",
  "the `adaptation` level itself",
];

test("run setup copies the source document into the run folder as the working copy", () => {
  const lead = compile(reviewLoop(), "claude-code").files[".grooph/review-loop/LEAD.md"]!;
  const setup = lead.slice(lead.indexOf("## 3. Run setup"), lead.indexOf("## 4."));
  assert.match(setup, /Copy the source document `\.grooph\/review-loop\/graph\.grooph\.json` into it as `\.grooph\/review-loop\/runs\/<run-id>\/graph\.grooph\.json`/);
  assert.match(setup, /Never write the source document/);
  assert.match(setup, /Do not copy the source over the working copy again/, "a resumed run keeps its amendments");
  const kickoff = compile(reviewLoop(), "claude-code").kickoff;
  assert.match(kickoff, /copy `\.grooph\/review-loop\/graph\.grooph\.json` into it: that copy is the run's working copy/);
});

test("adaptive (the default): amend the working copy visibly, brakes listed once, verbatim", () => {
  const doc = reviewLoop();
  assert.equal(doc.adaptation, undefined, "the default is applied at compile time; the document is not rewritten");
  const nine = sectionNine(doc);
  assert.match(nine, /This graph is `adaptive` \(the default\)/);
  assert.match(nine, /add, remove or re-brief nodes, add or re-route edges, add loops, and change tiers or effort/);
  assert.match(nine, /Edit the working copy, `\.grooph\/review-loop\/runs\/<run-id>\/graph\.grooph\.json`/);
  assert.match(nine, /"amendment":\{"summary":"<what you changed>","reason":"<what the work showed>"\}/);
  assert.match(nine, /under \*\*Amendments\*\*/);
  assert.match(nine, /grooph validate --for-export \.grooph\/review-loop\/runs\/<run-id>\/graph\.grooph\.json/);

  const list = BRAKES.map((brake) => `- ${brake}`).join("\n");
  assert.ok(nine.includes(`At every adaptation level you may not remove or loosen:\n\n${list}\n`), "the brakes, item for item");
  assert.equal(nine.split("may not remove or loosen").length, 2, "stated once");
  assert.equal(nine, nine.replace(/\bMUST\b|\bNEVER\b|!/g, ""), "plainly, without shouting");
  assert.match(nine, /Loosening one is a `proposal` note for the human, never an amendment/);
  assert.match(nine, /A loop you add needs a stop, and a bar if it is a judgment loop/);
  assert.match(nine, /no file under `\.claude\/agents\/`.*general-purpose subagent with its brief inline/s, "the mid-run node rule");

  const lead = compile(doc, "claude-code").files[".grooph/review-loop/LEAD.md"]!;
  assert.match(lead, /amendment \{ summary, reason, patch\? \}/, "the notes contract names the amendment field");
});

test("propose: change nothing, record proposals", () => {
  const nine = sectionNine({ ...reviewLoop(), adaptation: "propose" });
  assert.match(nine, /This graph is `propose`: you change nothing in it during the run/);
  assert.match(nine, /append a note with a `proposal`/);
  assert.ok(!nine.includes("may not remove or loosen"), "nothing to loosen when nothing changes");
  const lead = compile({ ...reviewLoop(), adaptation: "propose" }, "claude-code").files[".grooph/review-loop/LEAD.md"]!;
  assert.ok(!lead.includes("amendment {"), "no amendment field offered");
});

test("fixed: follow exactly, halt and ask", () => {
  const nine = sectionNine(load("fix-until-green"));
  assert.match(nine, /This graph is `fixed`: follow it exactly/);
  assert.match(nine, /halt and ask: append a note with `"outcome":"halt"`/);
  assert.match(compile(load("fix-until-green"), "claude-code").kickoff, /follow it exactly/);
});

test("a graph-scoped no-live-graph-rewrite policy makes the run propose, and says why", () => {
  const doc: Graph = { ...reviewLoop(), policies: [{ id: "p-frozen", kind: "no-live-graph-rewrite", scope: "graph" }] };
  const nine = sectionNine(doc);
  assert.match(nine, /This graph is `propose` \(its policy `p-frozen`, `no-live-graph-rewrite`, is stricter than `adaptation: adaptive`\)/);
  const scoped: Graph = { ...reviewLoop(), policies: [{ id: "p-loop", kind: "no-live-graph-rewrite", scope: "loop:review-cycle" }] };
  assert.match(sectionNine(scoped), /Policy `p-loop` \(scope `loop:review-cycle`\) forbids live rewrites where it applies/);
});

/**
 * The compiler: the golden package byte for byte, the package contract from
 * graph-ir §5, and the unit mapping from `docs/targets/claude-code.md`.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { test } from "node:test";

import { CompileError, compile } from "../src/compile/index.js";
import { OP_ARGS, OP_NAMES } from "../src/ops/apply.js";
import { parseGraphText } from "../src/parse.js";
import { instantiate } from "../src/template.js";
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

/* ------------------------------------------------------------------ *
 * Handoff 0010: the brief and the agent files say what graph-ir §1, §2 and
 * §6 and the target doc decided after the first proving batch (D1–D6).
 * ------------------------------------------------------------------ */

const section = (lead: string, n: number): string => lead.slice(lead.indexOf(`## ${n}. `), lead.indexOf(`## ${n + 1}. `));

test("D2: one gate rule in every mode — halt note first, then ask, then end the turn; an answer is a note, then the run continues", () => {
  const lead = compile(reviewLoop(), "claude-code").files[".grooph/review-loop/LEAD.md"]!;
  const seven = section(lead, 7);
  const halt = seven.indexOf('`"outcome":"halt"`');
  const ask = seven.indexOf("then ask");
  const end = seven.indexOf("then end your turn");
  assert.ok(halt > 0 && ask > halt && end > ask, "halt note, ask, end the turn — in that order");
  assert.match(seven, /When the human answers, append a note at the same place with their decision and continue/);
  assert.match(seven, /A run nobody answers ends on that halt note, and the same run id resumes it/);
  assert.doesNotMatch(seven, /cannot ask|non-interactive|headless/, "no wording depends on the lead judging whether it can ask");
  assert.doesNotMatch(compile(reviewLoop(), "claude-code").kickoff, /cannot ask/);
});

test("D3, D4: the run id and every timestamp come from the clock, and the examples follow", () => {
  const lead = compile(reviewLoop(), "claude-code").files[".grooph/review-loop/LEAD.md"]!;
  const three = section(lead, 3);
  assert.match(three, /`<yyyymmdd-hhmmss>` \(UTC\): `date -u \+%Y%m%d-%H%M%S`, for example `20260917-093002`/);
  assert.match(three, /append `-2`, then `-3`/, "collisions");
  assert.doesNotMatch(three, /random/);
  assert.match(three, /"run":"20260917-093002","at":"graph","started":"2026-09-17T09:30:02Z"/, "the first note follows the form");
  const eight = section(lead, 8);
  assert.match(eight, /read from the clock, `date -u \+%Y-%m-%dT%H:%M:%SZ`, or left out\. Never estimate one\./);
  const examples = [...eight.matchAll(/^\{"id":"n-\d+","run":"([^"]+)".*?"(?:started|ended)":"([^"]+)"/gm)];
  assert.equal(examples.length, 2, "a node line and a loop line");
  for (const [, run, at] of examples) {
    assert.match(run!, /^\d{8}-\d{6}$/, `run id ${run} is the clock form`);
    assert.match(at!, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, `timestamp ${at} is a UTC clock reading`);
  }
});

test("D5: a dispatches budget is counted by the lead in PROGRESS.md; turns, usd and tokens are advisory, usd enforceable by --max-budget-usd", () => {
  const doc = reviewLoop();
  const loop = doc.loops[0]!;
  const counted: Graph = {
    ...doc,
    loops: [{ ...loop, stops: [{ kind: "bar-passed" }, { kind: "budget", measure: "dispatches", limit: 12 }, { kind: "budget", measure: "usd", limit: 5 }, { kind: "budget", measure: "tokens", limit: 200000 }] }],
  };
  const lead = compile(counted, "claude-code").files[".grooph/review-loop/LEAD.md"]!;
  assert.match(section(lead, 3), /dispatch counter of `review-cycle` at 0/);
  const six = section(lead, 6);
  assert.match(six, /budget: 12 dispatches/);
  assert.match(six, /A dispatch is one node run inside this loop's members — an agent you dispatch, or a check you run/);
  assert.match(six, /Keep the count in `PROGRESS\.md`/);
  assert.match(six, /`usd`, `tokens` budgets are \*\*advisory\*\*: nothing in Claude Code enforces them inside a session\./);
  assert.match(six, /a `usd` budget is enforced only from outside, by starting a headless run with `--max-budget-usd`/);
  assert.doesNotMatch(six, /no documented session-level cost cap/, "there is one now");
  assert.match(section(lead, 8), /the dispatch count of `review-cycle`/);
  assert.match(section(lead, 8), /cost {6}\{ measure: dispatches \| minutes \| usd \| turns \| tokens, amount \}/);

  const turns = compile(doc, "claude-code").files[".grooph/review-loop/LEAD.md"]!;
  assert.match(section(turns, 6), /`turns` budgets are \*\*advisory\*\*: nothing in Claude Code enforces them inside a session, and leads count turns inconsistently/);
  assert.doesNotMatch(section(turns, 3), /dispatch counter/, "no counter to keep without a dispatches budget");
  const mapping = compile(counted, "claude-code").files[".grooph/review-loop/MAPPING.md"]!;
  assert.match(mapping, /A `dispatches` budget is exact: the lead counts node dispatches in `PROGRESS\.md`/);
});

test("D6: invalid-evidence is routed — the edge when one exists, else repair and re-dispatch once, then fail; an evidence stop is named only when a loop has one", () => {
  const doc = reviewLoop();
  const five = section(compile(doc, "claude-code").files[".grooph/review-loop/LEAD.md"]!, 5);
  assert.match(five, /When an edge routes `invalid-evidence`, take it\. Otherwise repair the evidence and dispatch the same node once more in the same round; a second `invalid-evidence` routes as `fail`\./);
  assert.doesNotMatch(five, /evidence-invalid/, "this graph has no evidence-invalid stop, so none is mentioned");

  const loop = doc.loops[0]!;
  const withStop: Graph = { ...doc, loops: [{ ...loop, stops: [...loop.stops, { kind: "evidence-invalid", rounds: 2 }] }] };
  const files = compile(withStop, "claude-code").files;
  assert.match(section(files[".grooph/review-loop/LEAD.md"]!, 5), /Such rounds count toward the `evidence-invalid` stop of loop `review-cycle`\./);
  assert.match(files[".claude/agents/review-loop--critic.md"]!, /That round counts toward the loop's evidence stop/);
  assert.doesNotMatch(compile(doc, "claude-code").files[".claude/agents/review-loop--critic.md"]!, /evidence stop/);
});

test("D1: an agent's evidence rules allow its declared inputs too; a writer's include the project; a critic keeps invalid-evidence", () => {
  const files = compile(reviewLoop(), "claude-code").files;
  const builder = files[".claude/agents/review-loop--builder.md"]!;
  assert.match(builder, /plus your declared inputs \(Inputs above\), which for you includes the project you are changing, and nothing else:/);
  assert.doesNotMatch(builder, /invalid-evidence/, "a builder does not judge");
  const critic = files[".claude/agents/review-loop--critic.md"]!;
  assert.match(critic, /plus your declared inputs \(Inputs above\), and nothing else:/);
  assert.doesNotMatch(critic, /includes the project you are changing/, "a critic changes nothing");
  assert.match(critic, /report `invalid-evidence` and say which item you could not read\./);
  assert.match(section(files[".grooph/review-loop/LEAD.md"]!, 5), /plus its own declared inputs; for a writer that includes the project it is changing/);

  const doc = reviewLoop();
  const bare: Graph = { ...doc, edges: doc.edges.map((edge) => (edge.to === "builder" ? { ...edge, evidence: [] } : edge)) };
  const bareBuilder = compile(bare, "claude-code").files[".claude/agents/review-loop--builder.md"]!;
  assert.match(bareBuilder, /No inbound edge lists evidence for you\. Work from your declared inputs \(Inputs above\), the project you are changing and the lead's prompt, and nothing else/);
});

test("carry from review 0010: the kickoff and the mapping say to run commands bare from the project root, and why", () => {
  const result = compile(reviewLoop(), "claude-code");
  assert.match(result.kickoff, /Run commands bare, from the project root, and tell each worker to do the same: under a narrow allowlist a compound form \(`cd … && …`\) or `git -C <path>` is refused, and every refusal costs a turn\./);
  const rules = result.files[".grooph/review-loop/MAPPING.md"]!.split("## Rules this package relies on")[1]!;
  assert.match(rules, /Commands run bare from the project root: an allowlist matches a command's prefix, so a compound form \(`cd … && …`\) or `git -C <path>` is refused under a narrow allowlist and costs a turn each time\./);
});

test("loop notes carry `stop` when a stop fires (graph-ir §6), and the brief shows one", () => {
  const eight = section(compile(reviewLoop(), "claude-code").files[".grooph/review-loop/LEAD.md"]!, 8);
  assert.match(eight, /and `stop` with the kind of the stop when one fires/);
  assert.match(eight, /^stop {6}on the loop note that ends the loop: the kind of the stop that fired$/m);
  assert.match(eight, /"at":"loop:review-cycle","ended":"[^"]+","outcome":"pass","round":3,"stop":"bar-passed"/);
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
  assert.match(nine, /"amendment":\{"summary":"<what you changed>","reason":"<what the work showed>","patch":\[\{"op":"updateNode"/);
  assert.match(nine, /A patch is preferably a list of grooph ops, the JSON `grooph apply --ops` takes/, "graph-ir §6, review 0004");
  assert.match(nine, /Amending at kickoff is fine when reading the task already shows a gap/, "graph-ir §2, review 0004");
  assert.match(nine, /a change to its overall shape before any node has run is a `proposal`/);
  assert.match(nine, /under \*\*Amendments\*\*/);
  assert.match(nine, /grooph validate --for-export \.grooph\/review-loop\/runs\/<run-id>\/graph\.grooph\.json/);

  const list = BRAKES.map((brake) => `- ${brake}`).join("\n");
  assert.ok(nine.includes(`At every adaptation level you may not remove or loosen:\n\n${list}\n`), "the brakes, item for item");
  assert.equal(nine.split("may not remove or loosen").length, 2, "stated once");
  assert.equal(nine, nine.replace(/\bMUST\b|\bNEVER\b|!/g, ""), "plainly, without shouting");
  assert.match(nine, /Loosening one is a `proposal` note for the human, never an amendment/);
  assert.match(nine, /A loop you add needs a stop, and a bar if it is a judgment loop/);
  assert.match(nine, /no compiled file under `\.claude\/agents\/`.*read at the next dispatch.*general-purpose subagent with its brief inline/s, "the mid-run node rule, as observed on 2.1.278: an agent file is read at the next dispatch");
  assert.doesNotMatch(nine, /read when the session starts/, "no longer true of the harness");

  const lead = compile(doc, "claude-code").files[".grooph/review-loop/LEAD.md"]!;
  assert.match(lead, /amendment \{ summary, reason, patch\? \}/, "the notes contract names the amendment field");
});

test("propose: change nothing, record proposals", () => {
  const nine = sectionNine({ ...reviewLoop(), adaptation: "propose" });
  assert.match(nine, /This graph is `propose`: you change nothing in it during the run/);
  assert.match(nine, /append a note with a `proposal`/);
  assert.match(nine, /A `patch` is preferably a list of grooph ops/);
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

/* ------------------------------------------------------------------ *
 * Handoff 0012: brief and runner fixes from the second proving batch.
 * ------------------------------------------------------------------ */

/** A built-in pattern made concrete with its slot examples, under its own id, so its package paths read as the proving runs' do. */
const patternDoc = (name: string): Graph => {
  const parsed = parseGraphText(read(join(fixturesDir, "..", "patterns", `${name}.grooph.json`)));
  assert.ok(parsed.doc, `${name} parses`);
  const values = Object.fromEntries((parsed.doc.template?.slots ?? []).map((slot) => [slot.key, slot.example]));
  return instantiate(parsed.doc, { name, id: name, values });
};

test("0012-1: an allow or deny amendment edits the agent file's tools: line before dispatch, or becomes a proposal; MAPPING.md lists tools: as hand-editable with the capability table", () => {
  const nine = sectionNine(reviewLoop());
  assert.match(nine, /5\. When the amendment changes a node's `allow` or `deny`, also edit that node's file under `\.claude\/agents\/` before you dispatch it: its `tools:` line \(and `disallowedTools:`\)/);
  assert.match(nine, /Claude Code reads the edited file at the next dispatch; no restart is needed/, "observed on 2.1.278 (sub-agents docs: the agents directories are watched)");
  assert.match(nine, /Say in the amendment note that you edited it/, "A-008: the change is visible");
  assert.match(nine, /If the file cannot be edited, the change is a `proposal`: record it as one and dispatch the node as compiled, never a stand-in/);
  assert.ok(!sectionNine({ ...reviewLoop(), adaptation: "propose" }).includes("`tools:`"), "a propose run amends nothing, so it edits no file");

  const files = compile(reviewLoop(), "claude-code").files;
  const mapping = files[".grooph/review-loop/MAPPING.md"]!;
  assert.match(mapping, /## The three things people hand-edit/);
  assert.match(mapping, /\*\*A node's model or effort\.\*\*[\s\S]*\*\*A node's tools\.\*\* The `tools:` line of the same frontmatter \(and `disallowedTools:`\)[\s\S]*\*\*A loop's stop values\.\*\*/, "tools: beside model and effort, before the stop values");
  assert.match(mapping, /\| `run-tests` \| `Bash` \|/, "the capability table");
  assert.match(mapping, /\| `edit-files` \| `Read`, `Edit`, `Write`, `Glob`, `Grep` \|/);
  assert.match(mapping, /A running lead edits `tools:` itself when it amends a node's capabilities \(`\.grooph\/review-loop\/LEAD\.md` §9\)/);
  const fixed = compile(load("fix-until-green"), "claude-code").files[".grooph/fix-until-green/MAPPING.md"]!;
  assert.match(fixed, /\*\*A node's tools\.\*\*/, "the table is for humans too");
  assert.doesNotMatch(fixed, /A running lead edits/, "a fixed run's lead amends nothing");
});

test("0012-2: §9 names every op core accepts, with its arguments, in the proposal and the amendment sections", () => {
  for (const doc of [reviewLoop(), { ...reviewLoop(), adaptation: "propose" as const }]) {
    const nine = sectionNine(doc);
    assert.match(nine, /These are the ops, and the only ops, `grooph apply` accepts/);
    assert.match(nine, /There is no `addEdge` and no `node` object: an edge is `connect`, and a node's fields go in `set`/, "the two inventions of review 0011");
    const block = nine.slice(nine.indexOf("```text\n") + 8, nine.indexOf("\n```", nine.indexOf("```text\n")));
    const rows = new Map(block.split("\n").map((row) => [row.slice(0, row.indexOf(" ")), row]));
    assert.deepEqual([...rows.keys()], OP_NAMES, "every op, in core's order, one line each");
    for (const name of OP_NAMES) {
      for (const arg of OP_ARGS[name]) assert.match(rows.get(name)!, new RegExp(`\\b${arg}\\b`), `${name} names its argument ${arg}`);
    }
    assert.match(nine, /\[\{"op":"addNode","kind":"agent","id":"reviewer","set":\{"role":"critic"/, "an addNode example with set");
    assert.match(nine, /\{"op":"connect","from":"builder","to":"reviewer","set":\{"when":"pass"/, "a connect example");
  }
  assert.ok(!sectionNine(load("fix-until-green")).includes("```text"), "a fixed run neither amends nor is asked to patch");
});

test("0012-3: §5 says how to diff a change that added files, bare, when an edge's evidence names a diff", () => {
  const five = section(compile(reviewLoop(), "claude-code").files[".grooph/review-loop/LEAD.md"]!, 5);
  assert.match(five, /A diff of the change is `git diff` plus, for each file the change added, `git diff --no-index \/dev\/null <file>`/);
  assert.match(five, /`git diff` omits untracked files/);
  assert.match(five, /exits 1 whenever the two differ, which is not an error/);
  assert.match(five, /Run each bare from the project root, one command at a time; no brace group, no `cd`/);
  assert.match(five, /`git add -N <file>` also works where it is allowed, and stages nothing/);
  const noDiff = section(compile(load("fix-until-green"), "claude-code").files[".grooph/fix-until-green/LEAD.md"]!, 5);
  assert.doesNotMatch(noDiff, /--no-index/, "said only where an edge's evidence names a diff");
});

test("0012-4: §8 keeps each round's critic report in the run folder before the builder is re-dispatched", () => {
  const eight = section(compile(reviewLoop(), "claude-code").files[".grooph/review-loop/LEAD.md"]!, 8);
  assert.match(eight, /Before you re-dispatch a builder after a critic's `fail`, copy each report the critic wrote that round into the run folder as `<report>-round-<n>\.md`/);
  assert.match(eight, /`REVIEW\.md` from round 0 becomes `\.grooph\/review-loop\/runs\/<run-id>\/REVIEW-round-0\.md`/, "the example uses the critic's own report");
  assert.match(eight, /Copy; the builder still reads the report where its edge says/);
  const bank = compile(patternDoc("specialist-critic-bank"), "claude-code").files[".grooph/specialist-critic-bank/LEAD.md"]!;
  assert.match(section(bank, 8), /-round-<n>\.md/);
  const grind = section(compile(load("fix-until-green"), "claude-code").files[".grooph/fix-until-green/LEAD.md"]!, 8);
  assert.doesNotMatch(grind, /-round-<n>/, "no critic in a loop, nothing to keep");
});

test("0012-5: §6 states what one full round costs in dispatches, from the loop's agent and check members, for every loop with a dispatches budget", () => {
  const bank = compile(patternDoc("specialist-critic-bank"), "claude-code").files[".grooph/specialist-critic-bank/LEAD.md"]!;
  const six = section(bank, 6);
  assert.match(six, /One full round of this loop costs \*\*6 dispatches\*\*: `builder`, `correctness`, `security`, `performance`, `taste`, `triage` \(`gate` is not a dispatch\)\. The budget of 26 covers 4 full rounds and 2 more dispatches\./, "review 0011: the bank's lead counted 8 for 6");
  assert.match(six, /A node dispatched twice in one round \(§5, invalid evidence\) counts twice/);

  const phases = compile(patternDoc("fresh-grind-rare-judge"), "claude-code").files[".grooph/fresh-grind-rare-judge/LEAD.md"]!;
  const loops = section(phases, 6);
  assert.match(loops, /One full round of this loop costs \*\*3 dispatches\*\*: `builder`, `tests`, `judge`\. The budget of 55 covers 18 full rounds and 1 more dispatch\. Every extra round of the inner loop `grind` adds its own dispatches on top\./, "a check member counts; a nested loop is named");
  assert.equal(loops.split("One full round of this loop costs").length, 2, "the grind loop has a minutes budget, not dispatches: no sentence for it");

  const doc = reviewLoop();
  const loop = doc.loops[0]!;
  const counted: Graph = { ...doc, loops: [{ ...loop, stops: [{ kind: "bar-passed" }, { kind: "budget", measure: "dispatches", limit: 12 }] }] };
  assert.match(section(compile(counted, "claude-code").files[".grooph/review-loop/LEAD.md"]!, 6), /costs \*\*2 dispatches\*\*: `builder`, `critic` \(`merge-gate` is not a dispatch\)\. The budget of 12 covers 6 full rounds\./);
  assert.doesNotMatch(section(compile(doc, "claude-code").files[".grooph/review-loop/LEAD.md"]!, 6), /One full round of this loop costs/, "a turns budget gets no dispatch arithmetic");
});

test("0014-4: a node's skills go into the agent file's skills: frontmatter, and MAPPING.md lists the line as hand-editable", () => {
  const files = compile(load("skilled-fixer"), "claude-code").files;
  const fixer = files[".claude/agents/skilled-fixer--fixer.md"]!;
  const frontmatter = fixer.slice(0, fixer.indexOf("\n---", 4));
  assert.match(frontmatter, /\ntools: Read, Edit, Write, Glob, Grep, Bash\nskills: test-triage, commit-style$/, "skills: after tools, last in the frontmatter");
  assert.ok(!fixer.slice(frontmatter.length).includes("test-triage"), "the body says nothing about skills: the harness preloads them");

  const mapping = files[".grooph/skilled-fixer/MAPPING.md"]!;
  assert.match(mapping, /\*\*A node's tools\.\*\*[\s\S]*The `skills:` line of the same frontmatter is hand-editable the same way[\s\S]*\*\*A loop's stop values\.\*\*/, "among the frontmatter lines, before the stop values");
  assert.match(mapping, /In this package: `\.claude\/agents\/skilled-fixer--fixer\.md` \(test-triage, commit-style\)\./);
  assert.match(mapping, /An unknown name is refused by Claude Code, not by grooph/);

  // Without skills: no frontmatter line, and the mapping says so.
  const plain = compile(load("fix-until-green"), "claude-code").files;
  assert.ok(!plain[".claude/agents/fix-until-green--fixer.md"]!.includes("skills:"), "no line when the node names none");
  assert.match(plain[".grooph/fix-until-green/MAPPING.md"]!, /The `skills:` line of the same frontmatter[\s\S]*No node in this graph names one\./);
});

test("0014-5/6: LEAD.md §11 asks for the `ending` line before the final note and names where the report goes", () => {
  const lead = compile(reviewLoop(), "claude-code").files[".grooph/review-loop/LEAD.md"]!;
  const eleven = lead.split("## 11. Ending")[1]!;
  assert.match(eleven, /1\. Append one short line first, `\{"at":"graph","outcome":"ending"\}` with a `text` naming how the run ends, then the final note: `"at":"graph"` with the outcome/);
  assert.match(eleven, /The `ending` line is how a monitor tells a run that finished from one that was cut off while finishing\./);
  assert.match(eleven, /2\. Write the last `PROGRESS\.md`/);
  assert.match(eleven, /3\. Tell the human, in your reply/);
  assert.match(eleven, /The final note and `PROGRESS\.md` are the record\. Your last reply is the report: it summarises them for whoever started this session and points at the run folder, `\.grooph\/review-loop\/runs\/<run-id>\/`\./);
  // §8's line shape says the same word means the same thing there.
  assert.match(lead, /outcome {3}pass \| fail \| halt \| invalid-evidence; started on a dispatch line, ending on the line before the final note \(§11\)/);
});

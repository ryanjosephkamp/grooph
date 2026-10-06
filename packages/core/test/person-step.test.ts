/**
 * A person's step (amendment A-020, handoff 0100, part two): an agent node that says `by: "person"`.
 * It is drawn and checked, and never compiled: a graph that has one is a plan.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { canonicalize } from "../src/canonicalize.js";
import { CompileError, compile, tryCompile, type CompileTarget } from "../src/compile/index.js";
import type { Issue } from "../src/issues.js";
import { applyOps } from "../src/ops/apply.js";
import { parseGraphText } from "../src/parse.js";
import { picture } from "../src/index.js";
import { mermaid } from "../src/mermaid.js";
import { outline } from "../src/outline.js";
import { planBundle } from "../src/plan.js";
import { estimateShape, shapeLine } from "../src/proposals.js";
import { STEP_BY_LABEL, isPersonStep, isPlan, stepBy, stopAction } from "../src/semantics.js";
import type { AgentNode, Edge, Graph, Node } from "../src/types.js";
import { validate } from "../src/validate.js";
import { fixturesDir, read, repoRoot } from "./helpers.js";

const codes = (issues: Issue[]): string[] => issues.map((issue) => issue.code);
const errors = (issues: Issue[]): Issue[] => issues.filter((issue) => issue.severity === "error");
const agent = (id: string, role: string, extra: object = {}): Node => ({ id, kind: "agent", name: id, role, brief: `brief for ${id}`, outputs: [`${id} output`], allow: ["read-files", "write-outputs"], ...extra }) as Node;
const person = (id: string, role: string, extra: object = {}): Node => ({ id, kind: "agent", name: id, by: "person", role, brief: `brief for ${id}`, outputs: [`${id} output`], ...extra }) as Node;
const done: Node = { id: "done", kind: "stop", name: "Done", outcome: "success" };
const graph = (over: Partial<Graph> = {}): Graph => ({ grooph: 0, id: "g", name: "G", version: 1, goal: "Do the thing.", target: { harness: "claude-code" }, nodes: [], edges: [], loops: [], ...over });
const edge = (id: string, from: string, to: string, extra: object = {}): Edge => ({ id, from, to, ...extra }) as Edge;
const load = (rel: string): Graph => parseGraphText(read(join(fixturesDir, rel))).doc!;
const reads = (doc: Graph): Graph => {
  const parsed = parseGraphText(JSON.stringify(doc));
  assert.ok(parsed.doc, JSON.stringify(parsed.issues).slice(0, 400));
  return parsed.doc;
};

test("the field: an agent node may say whose step it is; nothing else may, and no other word is one", () => {
  const doc = reads(graph({ nodes: [person("write", "builder"), agent("check", "critic"), done], edges: [edge("e1", "write", "check", { evidence: ["x"] }), edge("e2", "check", "done")] }));
  const [write, check] = doc.nodes as [AgentNode, AgentNode];
  assert.equal(stepBy(write), "person");
  assert.equal(stepBy(check), "agent");
  assert.deepEqual([isPersonStep(write), isPersonStep(check), isPersonStep(done), isPersonStep(undefined)], [true, false, false, false]);
  assert.deepEqual(STEP_BY_LABEL, { agent: "Agent", person: "Person" });
  // Said outright, an agent's step is an agent's, and the document keeps the word.
  const said = reads(graph({ nodes: [agent("write", "builder", { by: "agent" }), done], edges: [edge("e1", "write", "done")] }));
  assert.equal(stepBy(said.nodes[0] as AgentNode), "agent");
  assert.match(canonicalize(said), /"by": "agent"/);
  // In canonical form it stands with the node's own fields, after the ones every node has.
  assert.match(canonicalize(doc), /"kind": "agent",\n\s+"name": "write",\n\s+"by": "person",\n\s+"role": "builder"/);
  // A document that does not say it is byte for byte what it was: nothing is written in for it.
  const plain = load("valid/fix-until-green.grooph.json");
  assert.equal(canonicalize(plain), read(join(fixturesDir, "valid/fix-until-green.grooph.json")));
  assert.doesNotMatch(canonicalize(plain), /"by"/);
  // Another word is not a kind of step, and a gate or a check has no such field.
  assert.deepEqual(codes(parseGraphText(JSON.stringify(graph({ nodes: [agent("write", "builder", { by: "robot" }), done] }))).issues), ["E_SCHEMA"]);
  const onGate = parseGraphText(JSON.stringify(graph({ nodes: [{ id: "ask", kind: "human-gate", name: "Ask", prompt: "Go?", by: "person" } as unknown as Node, done], edges: [edge("e1", "ask", "done")] })));
  assert.ok(onGate.doc, "an unknown key is kept, not refused");
  assert.ok(validate(onGate.doc).some((issue) => issue.code === "W_UNKNOWN_KEY" && /"by"/.test(issue.message)));
  // An op sets it and takes it away, like any field of a node.
  const viaOps = applyOps(plain, [{ op: "updateNode", id: "fixer", set: { by: "person" } }]);
  assert.ok(viaOps.ok, JSON.stringify(viaOps).slice(0, 300));
  assert.equal(stepBy(viaOps.doc.nodes.find((node) => node.id === "fixer") as AgentNode), "person");
});

test("E_PERSON_STEP_NOT_COMPILED: a graph with a person's step is a plan; only where a package is asked for is it an error", () => {
  const doc = load("invalid/E_PERSON_STEP_NOT_COMPILED/a-persons-step-in-a-graph-for-a-harness.grooph.json");
  // Plainly validated it is a graph like any other.
  assert.deepEqual(validate(doc), []);
  const issues = validate(doc, { forExport: true });
  assert.deepEqual(issues, [
    {
      code: "E_PERSON_STEP_NOT_COMPILED",
      severity: "error",
      message: `"write" is a person's step, and grooph cannot yet hand a step to a person inside a harness, so no package is written; the plan exports as it is (PLAN.md, the picture, the file); make it an agent's if the graph is to run`,
      at: ["write"],
    },
  ]);
  // Several are said together, once.
  const two = reads(graph({ nodes: [person("a", "builder"), person("b", "builder"), done], edges: [edge("e1", "a", "b"), edge("e2", "b", "done")] }));
  const said = validate(two, { forExport: true });
  assert.equal(said.length, 1);
  assert.match(said[0]!.message, /^"a", "b" are people's steps, and grooph cannot yet hand a step to a person inside a harness, so no package is written; .* make them an agent's if the graph is to run$/);
  assert.deepEqual(said[0]!.at, ["a", "b"]);
  // Made an agent's again, it exports.
  const back = reads({ ...doc, nodes: doc.nodes.map((node) => (node.kind === "agent" ? { ...node, by: "agent", allow: ["read-files", "write-outputs"] } : node)) } as Graph);
  assert.deepEqual(errors(validate(back, { forExport: true })), []);
  // A template says only that it is a template, as it does of its slots; filled in, it says this too.
  const template = parseGraphText(read(join(repoRoot, "patterns", "review-gate.grooph.json"))).doc!;
  (template.nodes.find((node) => node.id === "builder") as AgentNode).by = "person";
  const told = codes(errors(validate(reads(template), { forExport: true })));
  assert.ok(told.includes("E_IS_TEMPLATE") && !told.includes("E_PERSON_STEP_NOT_COMPILED"), told.join(", "));
});

test("neither compiler makes a package of a graph with a person's step: each refuses with the code, and writes nothing", () => {
  const doc = load("invalid/E_PERSON_STEP_NOT_COMPILED/a-persons-step-in-a-graph-for-a-harness.grooph.json");
  for (const target of ["claude-code", "codex"] as CompileTarget[]) {
    const named = reads({ ...doc, target: { harness: target } });
    const attempt = tryCompile(named, target);
    assert.equal(attempt.ok, false, target);
    assert.deepEqual(attempt.ok ? [] : codes(errors(attempt.issues)), ["E_PERSON_STEP_NOT_COMPILED"], target);
    assert.ok(!("result" in attempt), `${target}: no files`);
    assert.throws(() => compile(named, target), (err: unknown) => err instanceof CompileError && err.issues.some((issue) => issue.code === "E_PERSON_STEP_NOT_COMPILED"), target);
  }
  // The check a run makes of its own working copy is the same rules (both leads' briefs: `grooph validate
  // --for-export <working copy>`): a step made a person's while a run goes on does not pass it.
  const working = load("valid/fix-until-green.grooph.json");
  assert.deepEqual(errors(validate(working, { forExport: true })), []);
  (working.nodes.find((node) => node.id === "fixer") as AgentNode).by = "person";
  assert.deepEqual(codes(errors(validate(reads(working), { forExport: true }))), ["E_PERSON_STEP_NOT_COMPILED"]);
});

test("E_PERSON_LEAD: the lead is the harness's own session, and cannot be a person", () => {
  const doc = load("invalid/E_PERSON_LEAD/the-lead-is-a-person.grooph.json");
  assert.deepEqual(validate(doc), [
    { code: "E_PERSON_LEAD", severity: "error", message: `node "lead" is the lead and is marked as a person's step; the lead is the harness's own session: give the step another role, or leave it an agent's`, at: ["lead"] },
  ]);
  // An agent's lead, and a person in any other role, are fine.
  assert.deepEqual(validate(reads(graph({ nodes: [agent("lead", "lead"), person("write", "builder"), done], edges: [edge("e1", "write", "done")] }))), []);
});

test("W_PERSON_FIELDS_NOT_READ: what only an agent has, set on a person's step, is named and not read", () => {
  const doc = load("invalid/W_PERSON_FIELDS_NOT_READ/a-model-on-a-persons-step.grooph.json");
  assert.deepEqual(validate(doc), [{ code: "W_PERSON_FIELDS_NOT_READ", severity: "warning", message: `step "write" is a person's and sets model, allow: those are an agent's, and are not read; remove them`, at: ["write"] }]);
  const one = reads(graph({ nodes: [person("write", "builder", { effort: "high" }), done], edges: [edge("e1", "write", "done")] }));
  assert.deepEqual(validate(one).map((issue) => issue.message), [`step "write" is a person's and sets effort: that is an agent's, and is not read; remove it`]);
  const all = reads(graph({ nodes: [person("write", "builder", { model: { tier: "fast" }, effort: "low", skills: ["a"], allow: ["web"], deny: ["edit-files"] }), done], edges: [edge("e1", "write", "done")] }));
  assert.match(validate(all)[0]!.message, /sets model, effort, skills, allow, deny: those are/);
  // Its role, brief, inputs, outputs, what it owns and what it does that cannot be undone are a person's too, and are read.
  assert.deepEqual(validate(reads(graph({ nodes: [person("write", "builder", { inputs: ["x"], owns: ["y"], irreversible: ["publish"] }), done], edges: [edge("e1", "write", "done")] }))), []);
  // The same fields on an agent's step are what they always were.
  assert.deepEqual(validate(reads(graph({ nodes: [agent("write", "builder", { model: { tier: "fast" }, effort: "low" }), done], edges: [edge("e1", "write", "done")] }))), []);
});

test("W_OUTPUT_NOT_WRITABLE: a person needs no capability to leave something behind", () => {
  const nodes = (write: Node): Graph => reads(graph({ nodes: [write, done], edges: [edge("e1", "write", "done")] }));
  assert.deepEqual(codes(validate(nodes(agent("write", "builder", { allow: ["read-files"] })))), ["W_OUTPUT_NOT_WRITABLE"]);
  assert.deepEqual(validate(nodes(person("write", "builder"))), []);
});

test("E_CRITIC_NOT_ISOLATED: a person who judges shares no context; an agent that judges a person's work is held as any critic", () => {
  const policies = [{ id: "p", kind: "critic-isolation", scope: "graph" }] as Graph["policies"];
  const shape = (write: Node, review: Node, into: object): Graph => reads(graph({ nodes: [write, review, done], edges: [edge("e1", "write", "review", into), edge("e2", "review", "done", { when: "pass" })], policies }));
  // An agent critic: a shared edge, and an edge from a writer with no evidence, are both errors.
  assert.deepEqual(codes(validate(shape(agent("write", "builder"), agent("review", "critic", { model: { tier: "fast" } }), { isolation: "shared" }))), ["E_CRITIC_NOT_ISOLATED"]);
  assert.deepEqual(codes(validate(shape(agent("write", "builder"), agent("review", "critic", { model: { tier: "fast" } }), {}))), ["E_CRITIC_NOT_ISOLATED"]);
  // The critic a person: neither is.
  assert.deepEqual(validate(shape(agent("write", "builder"), person("review", "critic"), { isolation: "shared" })), []);
  assert.deepEqual(validate(shape(agent("write", "builder"), person("review", "critic"), {})), []);
  // A person writes and an agent judges: held, as the fixture says.
  assert.deepEqual(codes(validate(shape(person("write", "builder"), agent("review", "critic"), {}))), ["E_CRITIC_NOT_ISOLATED"]);
  assert.deepEqual(codes(validate(load("invalid/E_CRITIC_NOT_ISOLATED/a-person-writes-and-an-agent-judges.grooph.json"))), ["E_CRITIC_NOT_ISOLATED"]);
  assert.deepEqual(validate(shape(person("write", "builder"), agent("review", "critic"), { evidence: ["the draft"] })), []);
});

test("W_HOMOGENEOUS_CRITICS: only agents are on a model", () => {
  const shape = (write: Node, review: Node): Graph => reads(graph({ nodes: [write, review, done], edges: [edge("e1", "write", "review", { evidence: ["x"] }), edge("e2", "review", "done", { when: "pass" })] }));
  const tier = { model: { tier: "strong" } };
  assert.deepEqual(codes(validate(shape(agent("write", "builder", tier), agent("review", "critic", tier)))), ["W_HOMOGENEOUS_CRITICS"]);
  // A person judging an agent, and an agent judging a person, are not two of one model.
  assert.deepEqual(validate(shape(agent("write", "builder", tier), person("review", "critic"))), []);
  assert.deepEqual(validate(shape(person("write", "builder"), agent("review", "critic", tier))), []);
  // Where a person and an agent both write, the critic is compared with the agent.
  const both = reads(graph({ nodes: [person("draft", "builder"), agent("write", "builder", tier), agent("review", "critic", tier), done], edges: [edge("e0", "draft", "review", { evidence: ["x"] }), edge("e1", "write", "review", { evidence: ["x"] }), edge("e2", "review", "done", { when: "pass" })] }));
  const said = validate(both);
  assert.deepEqual(codes(said), ["W_HOMOGENEOUS_CRITICS"]);
  assert.deepEqual(said[0]!.at, ["write", "review"]);
});

test("E_IRREVERSIBLE_NO_GATE: a person's own irreversible step needs no gate before it; a person's step before an agent's is no gate", () => {
  const act = { irreversible: ["publish"], allow: ["read-files", "run-commands", "write-outputs"] };
  // An agent's irreversible step that nothing but a plain edge leads to: an error, as it was.
  assert.deepEqual(codes(validate(reads(graph({ nodes: [agent("write", "builder"), agent("publish", "builder", act), done], edges: [edge("e1", "write", "publish"), edge("e2", "publish", "done")] })))), ["E_IRREVERSIBLE_NO_GATE"]);
  // The person does it: the one doing it is the one who decides.
  assert.deepEqual(validate(reads(graph({ nodes: [agent("write", "builder"), person("publish", "builder", { irreversible: ["publish"] }), done], edges: [edge("e1", "write", "publish"), edge("e2", "publish", "done")] }))), []);
  // Also where the run starts at it, which for an agent is an error of its own.
  assert.deepEqual(validate(reads(graph({ nodes: [person("publish", "builder", { irreversible: ["publish"] }), done], edges: [edge("e2", "publish", "done")] }))), []);
  // A person's step BEFORE an agent's irreversible step is not a decision about it.
  const fixture = load("invalid/E_IRREVERSIBLE_NO_GATE/a-persons-step-is-no-gate.grooph.json");
  const issues = validate(fixture);
  assert.deepEqual(codes(issues), ["E_IRREVERSIBLE_NO_GATE"]);
  assert.match(issues[0]!.message, /node "publish" performs irreversible actions \(publish\) and can be reached without a human decision through "e-write-publish"/);
  // An approval on that edge, or a gate between, is one.
  const approved = reads({ ...fixture, edges: fixture.edges.map((e) => (e.id === "e-write-publish" ? { ...e, approval: true } : e)) });
  assert.deepEqual(validate(approved), []);
});

test("the passing document for all four: a plan with three people's steps and one agent's validates clean, and says what a package would need", () => {
  const plan = load("valid/a-plan-with-people.grooph.json");
  assert.equal(plan.target, undefined);
  assert.deepEqual(validate(plan), []);
  assert.deepEqual(codes(validate(plan, { forExport: true })), ["E_NO_TARGET", "E_PERSON_STEP_NOT_COMPILED"]);
  assert.deepEqual(plan.nodes.filter(isPersonStep).map((node) => node.id), ["draft", "review", "publish"]);
  // Each of the four would fire were its person an agent.
  const asAgents = reads({ ...plan, nodes: plan.nodes.map((node) => (node.kind === "agent" ? ({ ...node, by: "agent" } as Node) : node)) });
  assert.deepEqual([...new Set(codes(validate(asAgents)))].sort(), ["E_CRITIC_NOT_ISOLATED", "E_IRREVERSIBLE_NO_GATE", "W_HOMOGENEOUS_CRITICS", "W_OUTPUT_NOT_WRITABLE"]);
});

// ─── what a reader is shown ─────────────────────────────────────────────────────────────────────────────────

test("every view says whose step it is: the picture, the outline, the Mermaid text, the plan's table and the shape's line", () => {
  const plan = load("valid/a-plan-with-people.grooph.json");
  const words = (svg: string): string[] => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]!).filter((t) => t.trim() !== "");

  // The picture: "Person" where it says "Agent", and a person's card has its role and no tier or effort.
  const drawn = words(picture(plan, { theme: "light" }));
  const at = (name: string): string[] => drawn.slice(drawn.indexOf(name) - 1, drawn.indexOf(name) + 2);
  assert.deepEqual(at("Draft the article"), ["Person", "Draft the article", "builder"]);
  assert.deepEqual(at("Check the facts"), ["Agent", "Check the facts", "researcher · strong · high"]);
  assert.deepEqual(at("Edit"), ["Person", "Edit", "critic"]);
  assert.equal(drawn[1], "3 people's steps · 1 agent's step · 1 loop · up to 3 rounds");

  // The shape: people's steps are counted apart, a person is on no tier, and a graph with none is what it was.
  assert.deepEqual(estimateShape(plan), { agents: 1, people: 3, checks: 0, gates: 0, loops: 1, tiers: { frontier: 0, strong: 1, fast: 0, unset: 0 }, worstCaseRounds: 3, budgets: [] });
  const green = load("valid/fix-until-green.grooph.json");
  assert.equal("people" in estimateShape(green), false);
  assert.equal(shapeLine(estimateShape(green)), "1 agent · 1 check · 1 loop · up to 5 rounds · 20 minutes");
  assert.equal(shapeLine({ ...estimateShape(green), agents: 0, people: 1 }), "1 person's step · 1 check · 1 loop · up to 5 rounds · 20 minutes");
  assert.equal(shapeLine({ ...estimateShape(green), agents: 2, people: 2 }), "2 people's steps · 2 agents' steps · 1 check · 1 loop · up to 5 rounds · 20 minutes");

  // The outline: a section headed "Person", with what a person's step has and none of what only an agent has.
  const sections = outline(plan);
  assert.deepEqual(sections.map((section) => `${section.kind}: ${section.title}`).slice(1, 5), ["Person: Draft the article", "Agent: Check the facts", "Person: Edit", "Person: Publish"]);
  const labels = (id: string): string[] => sections.find((section) => section.id === id)!.items.map((item) => item.label);
  assert.deepEqual(labels("draft"), ["Role", "Brief", "Expects", "Leaves behind", "Owns", "In loop", "Then", "Reached"]);
  assert.deepEqual(labels("publish").filter((label) => label === "Irreversible"), ["Irreversible"]);
  assert.ok(labels("fact-check").includes("Model") && labels("fact-check").includes("May"));
  assert.equal(sections[0]!.items.find((item) => item.label === "Model tiers")!.text, "1 strong");

  // The Mermaid text: the role's shape, and the words in the label.
  const text = mermaid(plan);
  assert.match(text, /n_draft\["Draft the article \(a person\)"\]/);
  assert.match(text, /n_review\{"Edit \(a person\)"\}/);
  assert.match(text, /n_fact_check\(\["Check the facts"\]\)/);

  // The plan's table.
  const md = planBundle(plan).files["PLAN.md"]!;
  assert.match(md, /\| Draft the article \| a person \| builder \| DRAFT\.md \|/);
  assert.match(md, /\| Check the facts \| an agent \| researcher, strong, high effort \|/);
  assert.match(md, /Of 5 steps: 1 by an agent, 3 by a person, 0 by a command; 1 ends the run\./);
  assert.match(md, /\n### Person: Draft the article\n/);
});

test("a loop's stop is worded as a plan means it where nothing runs, and as a run does it where a harness would", () => {
  const stops = (doc: Graph): string[] => outline(doc).find((section) => section.kind === "Loop")!.items.find((item) => item.label === "Stops, in order")!.list!;
  const drawn = (doc: Graph): string[] => [...picture(doc, { theme: "light" }).matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]!).filter((t) => /^\d\. /.test(t));
  // A graph for a harness: as it has always read, in the outline and in the picture.
  const green = load("valid/fix-until-green.grooph.json");
  assert.equal(isPlan(green), false);
  assert.ok(stops(green).some((line) => line.endsWith(": halt the run and report to the human")));
  assert.ok(drawn(green).some((line) => line.endsWith(": halt the run and report to the human")));
  // The same graph with no harness, or with a step a person does: there is no run to halt.
  const none = load("valid/fix-until-green.grooph.json");
  delete none.target;
  const withPerson = load("valid/fix-until-green.grooph.json");
  (withPerson.nodes.find((node) => node.id === "fixer") as AgentNode).by = "person";
  for (const doc of [none, reads(withPerson), load("valid/a-plan-with-people.grooph.json")]) {
    assert.equal(isPlan(doc), true);
    assert.ok(stops(doc).some((line) => line.endsWith(": stop here and decide")), doc.id);
    assert.ok(!stops(doc).some((line) => line.includes("halt the run")), doc.id);
    assert.ok(drawn(doc).some((line) => line.endsWith(": stop here and decide")), doc.id);
  }
  // Where a stop leads on, or a bar is passed, the words are the same either way; and a compiler's are a run's.
  assert.equal(stopAction({ kind: "max-iterations", n: 3, then: "wrap" }, true), stopAction({ kind: "max-iterations", n: 3, then: "wrap" }));
  assert.equal(stopAction({ kind: "bar-passed" }, true), "follow the loop's pass exit edges");
  assert.equal(stopAction({ kind: "max-iterations", n: 3 }), "halt the run and report to the human");
});

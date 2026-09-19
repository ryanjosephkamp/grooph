/**
 * Rule behaviour the fixtures cannot show on their own: the cases inside a rule
 * (graph-ir §3) and the defaults the rules depend on (§1, §2).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { indexGraph } from "../src/graph-index.js";
import type { Issue } from "../src/issues.js";
import { effectiveAdaptation, loopMode } from "../src/semantics.js";
import type { Graph, Node } from "../src/types.js";
import { validate } from "../src/validate.js";

const codes = (issues: Issue[]): string[] => [...new Set(issues.map((issue) => issue.code))].sort();
/** The ★ rules below are about errors; the minimal graphs they use also earn true stage-3 warnings. */
const errorCodes = (issues: Issue[]): string[] => codes(issues.filter((issue) => issue.severity === "error"));
const errors = (issues: Issue[]): Issue[] => issues.filter((issue) => issue.severity === "error");

const agent = (id: string, role: Node extends never ? never : string, extra: object = {}): Node =>
  ({
    id,
    kind: "agent",
    name: id,
    role,
    brief: `brief for ${id}`,
    outputs: [`${id} output`],
    ...extra,
  }) as Node;

const base = (over: Partial<Graph> = {}): Graph => ({
  grooph: 0,
  id: "g",
  name: "G",
  version: 1,
  goal: "Do the thing.",
  target: { harness: "claude-code" },
  nodes: [],
  edges: [],
  loops: [],
  ...over,
});

test("E_DUPLICATE_ID spans object kinds, not just lists", () => {
  const doc = base({
    nodes: [agent("worker", "builder"), { id: "done", kind: "stop", name: "Done" }],
    edges: [{ id: "worker", from: "worker", to: "done" }],
  });
  assert.deepEqual(errorCodes(validate(doc)), ["E_DUPLICATE_ID"]);
});

test("E_DUPLICATE_ID includes the graph's own id (graph-ir §1)", () => {
  const doc = base({ id: "worker", nodes: [agent("worker", "builder")] });
  const issues = errors(validate(doc));
  assert.deepEqual(codes(issues), ["E_DUPLICATE_ID"]);
  assert.match(issues[0]!.message, /the graph's own id, nodes\[0\]/);
});

test("E_DANGLING_REF covers stop `then` and `answerKeyFrom`", () => {
  const doc = base({
    nodes: [agent("builder", "builder"), agent("critic", "critic")],
    edges: [
      { id: "e-fwd", from: "builder", to: "critic" },
      { id: "e-back", from: "critic", to: "builder", when: "fail" },
    ],
    loops: [
      {
        id: "cycle",
        name: "Cycle",
        members: ["builder", "critic"],
        back: ["e-back"],
        bar: {
          name: "Answer key",
          inspects: [{ kind: "answer-key", ref: "spec" }],
          acceptance: "matches the key",
          answerKeyFrom: "ghost-node",
        },
        stops: [{ kind: "bar-passed", then: "also-missing" }],
      },
    ],
  });
  const issues = validate(doc);
  assert.deepEqual(errorCodes(issues), ["E_DANGLING_REF", "E_JUDGMENT_LOOP_NO_BAR", "E_STOP_NOT_INSPECTABLE"]);
  assert.equal(issues.filter((i) => i.code === "E_DANGLING_REF").length, 2, "one per unknown reference");
});

test("an answer key counts as inspectable once its node exists", () => {
  const doc = base({
    nodes: [agent("speccer", "planner"), agent("builder", "builder"), agent("critic", "critic")],
    edges: [
      { id: "e-spec", from: "speccer", to: "builder" },
      { id: "e-fwd", from: "builder", to: "critic" },
      { id: "e-back", from: "critic", to: "builder", when: "fail" },
    ],
    loops: [
      {
        id: "cycle",
        name: "Cycle",
        members: ["builder", "critic"],
        back: ["e-back"],
        bar: {
          name: "Answer key",
          inspects: [{ kind: "answer-key", ref: "the spec" }],
          acceptance: "Every line of the spec is met.",
          answerKeyFrom: "speccer",
        },
        stops: [{ kind: "bar-passed" }],
      },
    ],
  });
  assert.deepEqual(errors(validate(doc)), []);
});

test("E_LOOP_BACK_EDGE fires when no path leads back inside the members", () => {
  const doc = base({
    nodes: [agent("a", "builder"), agent("b", "critic"), agent("c", "critic")],
    edges: [
      { id: "e-ab", from: "a", to: "b" },
      { id: "e-bc", from: "b", to: "c" },
      { id: "e-ca", from: "c", to: "a", when: "fail" },
    ],
    loops: [
      {
        id: "cycle",
        name: "Cycle",
        // `b` is left out, so nothing inside {a, c} leads from a back to c
        members: ["a", "c"],
        back: ["e-ca"],
        mode: "grind",
        stops: [{ kind: "max-iterations", n: 3 }],
      },
    ],
  });
  const issues = errors(validate(doc));
  assert.deepEqual(codes(issues), ["E_LOOP_BACK_EDGE"]);
  assert.match(issues[0]!.message, /no path inside the loop's members/);
});

test("E_LOOP_BACK_EDGE fires on an empty back list", () => {
  const doc = base({
    nodes: [agent("a", "builder"), { id: "done", kind: "stop", name: "Done" }],
    edges: [{ id: "e-done", from: "a", to: "done" }],
    loops: [{ id: "cycle", name: "Cycle", members: ["a"], back: [], stops: [{ kind: "max-iterations", n: 2 }] }],
  });
  assert.deepEqual(errorCodes(validate(doc)), ["E_LOOP_BACK_EDGE"]);
});

test("E_CYCLE_NO_STOP: a loop with no stop covers nothing", () => {
  const withStop = base({
    nodes: [agent("a", "builder"), agent("b", "critic")],
    edges: [
      { id: "e-ab", from: "a", to: "b" },
      { id: "e-ba", from: "b", to: "a", when: "fail" },
    ],
    loops: [
      {
        id: "cycle",
        name: "Cycle",
        members: ["a", "b"],
        back: ["e-ba"],
        bar: { name: "Checklist", inspects: [{ kind: "checklist", ref: "list.md" }], acceptance: "all items met" },
        stops: [{ kind: "max-iterations", n: 3 }],
      },
    ],
  });
  assert.deepEqual(errors(validate(withStop)), []);

  const withoutStop = structuredClone(withStop);
  withoutStop.loops[0]!.stops = [];
  assert.ok(codes(validate(withoutStop)).includes("E_CYCLE_NO_STOP"));
});

test("E_CYCLE_NO_STOP names the nodes of a self-loop too", () => {
  const doc = base({
    nodes: [agent("a", "builder")],
    edges: [{ id: "e-self", from: "a", to: "a" }],
  });
  const issues = errors(validate(doc));
  assert.deepEqual(codes(issues), ["E_CYCLE_NO_STOP"]);
  assert.deepEqual(issues[0]!.at, ["a"]);
});

test("loop mode is inferred: grind when every back edge starts at a check node", () => {
  const doc = base({
    nodes: [
      agent("builder", "builder"),
      { id: "suite", kind: "check", name: "Suite", check: { kind: "tests", run: "npm test", pass: "exit 0" } },
    ],
    edges: [
      { id: "e-fwd", from: "builder", to: "suite" },
      { id: "e-back", from: "suite", to: "builder", when: "fail" },
    ],
    loops: [
      { id: "cycle", name: "Cycle", members: ["builder", "suite"], back: ["e-back"], stops: [{ kind: "max-iterations", n: 3 }] },
    ],
  });
  assert.equal(loopMode(indexGraph(doc), doc.loops[0]!), "grind");
  assert.deepEqual(errors(validate(doc)), [], "a grind loop needs no bar");

  const judgment = structuredClone(doc);
  judgment.edges.push({ id: "e-peer", from: "builder", to: "builder", when: "fail" });
  judgment.loops[0]!.back = ["e-back", "e-peer"];
  assert.equal(loopMode(indexGraph(judgment), judgment.loops[0]!), "judgment");
  assert.ok(codes(validate(judgment)).includes("E_JUDGMENT_LOOP_NO_BAR"));
});

test("a custom role is a writer only when it owns something", () => {
  const doc = base({
    nodes: [
      agent("weird", { custom: "vibe-checker" } as unknown as string, { owns: ["notes.md"] }),
      agent("plain", "builder", { owns: ["notes.md"] }),
      agent("quirky", { custom: "doodler" } as unknown as string),
    ],
  });
  const issues = errors(validate(doc));
  assert.deepEqual(codes(issues), ["E_OWNERSHIP_CONFLICT"], "the owning custom role counts as a second writer");
  assert.deepEqual(issues[0]!.at, ["weird", "plain"], "the custom role that owns nothing is no writer");
});

test("export-only rules fire only for export", () => {
  const doc = base({ goal: "  ", target: undefined, nodes: [agent("a", "builder")] });
  assert.deepEqual(errors(validate(doc)), [], "authoring a draft raises no error");
  assert.deepEqual(errorCodes(validate(doc, { forExport: true })), ["E_NO_GOAL", "E_NO_TARGET"]);
});

test("E_NO_TARGET fires for a harness with no profile", () => {
  const doc = base({ target: { harness: "codex" }, nodes: [agent("a", "builder")] });
  const issues = errors(validate(doc, { forExport: true }));
  assert.deepEqual(codes(issues), ["E_NO_TARGET"]);
  assert.match(issues[0]!.message, /no compile profile for target harness "codex"/);
});

test("every issue names the objects involved", () => {
  const doc = base({
    nodes: [agent("a", "builder")],
    edges: [{ id: "e-ghost", from: "a", to: "ghost" }],
  });
  for (const issue of validate(doc, { forExport: true })) {
    assert.ok(issue.at.length > 0, `${issue.code} should name at least one object`);
  }
});

/* ------------------------------------------------------------------ *
 * Stage 3 rules: the cases inside each one that a fixture cannot show.
 * ------------------------------------------------------------------ */

const writable = { allow: ["read-files", "write-outputs"] };
const stopNode: Node = { id: "done", kind: "stop", name: "Done" };
const only = (issues: Issue[], code: string): Issue[] => issues.filter((issue) => issue.code === code);

/** builder → critic → done, clean apart from what a test changes. */
const reviewed = (over: { edge?: object; policies?: Graph["policies"]; critic?: object } = {}): Graph =>
  base({
    nodes: [
      agent("builder", "builder", { ...writable, model: { tier: "strong" } }),
      agent("critic", "critic", { ...writable, model: { tier: "frontier" }, ...over.critic }),
      stopNode,
    ],
    edges: [
      { id: "e-review", from: "builder", to: "critic", evidence: ["diff"], ...over.edge },
      { id: "e-pass", from: "critic", to: "done", when: "pass" },
    ],
    ...(over.policies ? { policies: over.policies } : {}),
  });

test("the stage-3 base graph used below is clean", () => {
  assert.deepEqual(validate(reviewed(), { forExport: true }), []);
});

test("E_CRITIC_NOT_ISOLATED needs a critic-isolation policy in scope", () => {
  const shared = { edge: { isolation: "shared" } };
  assert.deepEqual(validate(reviewed(shared)), [], "no policy: sharing context is the author's call");
  const graphWide = validate(reviewed({ ...shared, policies: [{ id: "p", kind: "critic-isolation", scope: "graph" }] }));
  assert.deepEqual(codes(graphWide), ["E_CRITIC_NOT_ISOLATED"]);
  assert.deepEqual(graphWide[0]!.at, ["e-review", "critic"]);
  for (const scope of ["node:critic", "node:builder", "edge:e-review"] as const) {
    assert.deepEqual(codes(validate(reviewed({ ...shared, policies: [{ id: "p", kind: "critic-isolation", scope }] }))), ["E_CRITIC_NOT_ISOLATED"], scope);
  }
  assert.deepEqual(validate(reviewed({ ...shared, policies: [{ id: "p", kind: "critic-isolation", scope: "edge:e-pass" }] })), [], "a policy on another edge");
});

test("E_CRITIC_NOT_ISOLATED: a writer's edge into a critic must list evidence", () => {
  const policies: Graph["policies"] = [{ id: "p", kind: "critic-isolation", scope: "graph" }];
  const issues = validate(reviewed({ edge: { evidence: undefined }, policies }));
  assert.deepEqual(codes(issues), ["E_CRITIC_NOT_ISOLATED"]);
  assert.deepEqual(issues[0]!.at, ["e-review", "builder", "critic"]);
  assert.deepEqual(validate(reviewed({ edge: { evidence: ["diff"] }, policies })), [], "fresh with evidence is isolated");
});

test("E_OWNERSHIP_CONFLICT is cleared by a merge node that merges the artifact", () => {
  const doc = base({
    nodes: [
      agent("left", "builder", { ...writable, owns: ["src"] }),
      agent("right", "builder", { ...writable, owns: ["src"] }),
      { id: "join", kind: "merge", name: "Join", merges: ["src"] },
      stopNode,
    ],
    edges: [
      { id: "e-l", from: "left", to: "join" },
      { id: "e-r", from: "right", to: "join" },
      { id: "e-j", from: "join", to: "done" },
    ],
  });
  assert.deepEqual(validate(doc), []);
  const unmerged = structuredClone(doc);
  (unmerged.nodes[2] as { merges: string[] }).merges = ["docs"];
  assert.deepEqual(codes(validate(unmerged)), ["E_OWNERSHIP_CONFLICT"]);
});

test("E_IRREVERSIBLE_NO_GATE: an approval edge or a gate before every inbound edge", () => {
  const publish = (edges: Graph["edges"], extra: Node[] = []): Graph =>
    base({
      nodes: [
        agent("writer", "builder", writable),
        agent("publisher", "builder", { ...writable, irreversible: ["publish"] }),
        ...extra,
        stopNode,
      ],
      edges: [...edges, { id: "e-done", from: "publisher", to: "done" }],
    });
  const gate: Node = { id: "gate", kind: "human-gate", name: "Gate", prompt: "Publish?" };

  assert.deepEqual(codes(validate(publish([{ id: "e-pub", from: "writer", to: "publisher" }]))), ["E_IRREVERSIBLE_NO_GATE"]);
  assert.deepEqual(validate(publish([{ id: "e-pub", from: "writer", to: "publisher", approval: true }])), []);
  assert.deepEqual(
    validate(publish([{ id: "e-ask", from: "writer", to: "gate" }, { id: "e-pub", from: "gate", to: "publisher", when: "pass" }], [gate])),
    [],
  );
  const entry = base({ nodes: [agent("publisher", "builder", { ...writable, irreversible: ["spend"] }), stopNode], edges: [{ id: "e-done", from: "publisher", to: "done" }] });
  assert.deepEqual(codes(validate(entry)), ["E_IRREVERSIBLE_NO_GATE"], "an entry node has no gate before it");

  // Review 0004: one approved way in used to excuse an open one. Every way in must pass a human.
  const mixed = validate(
    publish(
      [
        { id: "e-pub", from: "writer", to: "publisher", approval: true },
        { id: "e-shortcut", from: "hotfix", to: "publisher" },
      ],
      [agent("hotfix", "builder", writable)],
    ),
  );
  assert.deepEqual(codes(mixed), ["E_IRREVERSIBLE_NO_GATE"]);
  assert.deepEqual(mixed[0]!.at, ["publisher", "e-shortcut"], "the open way in is named");
  assert.deepEqual(
    validate(
      publish(
        [
          { id: "e-ask", from: "writer", to: "gate" },
          { id: "e-pub", from: "gate", to: "publisher", when: "pass" },
          { id: "e-shortcut", from: "hotfix", to: "publisher", approval: true },
        ],
        [gate, agent("hotfix", "builder", writable)],
      ),
    ),
    [],
    "a gate on one way in and an approval on the other both pass a human",
  );
});

test("E_IS_TEMPLATE and E_UNFILLED_SLOT bite at export only, and a template reports only the first", () => {
  const block: Graph["template"] = {
    kind: "graph",
    title: "T",
    summary: "s",
    whenToUse: "w",
    profile: { cost: "low", speed: "fast", rigor: "light" },
    slots: [{ key: "task", ask: "What?", example: "This." }],
  };
  const doc = base({
    goal: "{{task}}",
    nodes: [agent("builder", "builder", { ...writable, brief: "Do {{task}} with {{ tool }}." }), stopNode],
    edges: [{ id: "e-done", from: "builder", to: "done" }],
  });

  assert.deepEqual(validate({ ...doc, template: block }), [], "authoring a template is legal");
  const asTemplate = validate({ ...doc, template: block }, { forExport: true });
  assert.deepEqual(codes(asTemplate), ["E_IS_TEMPLATE"], "its slots are expected until it is instantiated");

  assert.deepEqual(validate(doc), [], "unfilled slots are legal while authoring");
  const unfilled = validate(doc, { forExport: true });
  assert.deepEqual(
    unfilled.map((issue) => [issue.code, issue.at]),
    [
      ["E_UNFILLED_SLOT", ["g", "builder"]],
      ["E_UNFILLED_SLOT", ["builder"]],
    ],
    "one issue per slot, naming the objects that hold it; spaced braces count",
  );
  assert.match(unfilled[0]!.message, /\{\{task\}\}/);
});

test("W_HOMOGENEOUS_CRITICS compares tier and pin, and needs both families", () => {
  const same = reviewed({ critic: { model: { tier: "strong" } } });
  const issues = validate(same);
  assert.deepEqual(codes(issues), ["W_HOMOGENEOUS_CRITICS"]);
  assert.deepEqual(issues[0]!.at, ["builder", "critic"]);
  assert.match(issues[0]!.message, /tier strong/);
  assert.deepEqual(validate(reviewed({ critic: { model: { tier: "strong", pin: { "claude-code": "opus-4-8" } } } })), [], "a pin differs");
  const unset = structuredClone(same);
  for (const node of unset.nodes) delete (node as { model?: unknown }).model;
  assert.match(only(validate(unset), "W_HOMOGENEOUS_CRITICS")[0]!.message, /the session default/, "both unset resolve alike");
  const noCritic = base({ nodes: [agent("builder", "builder", writable), stopNode], edges: [{ id: "e", from: "builder", to: "done" }] });
  assert.deepEqual(validate(noCritic), []);
});

test("W_HOMOGENEOUS_CRITICS is judged per critic, against the writers whose work reaches it", () => {
  const strong = { model: { tier: "strong" } };
  const frontier = { model: { tier: "frontier" } };
  // One differing critic no longer masks another (review 0005, finding 1).
  const two = base({
    nodes: [agent("builder", "builder", { ...writable, ...strong }), agent("a", "critic", { ...writable, ...strong }), agent("b", "judge", { ...writable, ...frontier }), stopNode],
    edges: [
      { id: "e-a", from: "builder", to: "a", evidence: ["diff"] },
      { id: "e-b", from: "a", to: "b", when: "pass", evidence: ["diff"] },
      { id: "e-done", from: "b", to: "done", when: "pass" },
    ],
  });
  const issues = only(validate(two), "W_HOMOGENEOUS_CRITICS");
  assert.equal(issues.length, 1, "reported once");
  assert.deepEqual(issues[0]!.at, ["builder", "a"]);
  assert.match(issues[0]!.message, /critic "a" judges "builder"/);
  assert.doesNotMatch(issues[0]!.message, /"b"/, "the frontier judge differs from the builder it reaches");

  // Every flagged critic is named in the one issue.
  const both = structuredClone(two);
  (both.nodes[2] as { model: object }).model = { tier: "strong" };
  const named = only(validate(both), "W_HOMOGENEOUS_CRITICS");
  assert.equal(named.length, 1);
  assert.deepEqual(named[0]!.at, ["builder", "a", "b"]);

  // Only writers upstream along non-back edges count: a writer downstream of the critic, or one reaching it only
  // through a loop's back edge, is not the work it judges.
  const downstream = base({
    nodes: [agent("builder", "builder", { ...writable, model: { tier: "fast" } }), agent("critic", "critic", { ...writable, ...strong }), agent("notes", "synthesizer", { ...writable, ...strong }), stopNode],
    edges: [
      { id: "e-review", from: "builder", to: "critic", evidence: ["diff"] },
      { id: "e-notes", from: "critic", to: "notes", when: "pass" },
      { id: "e-done", from: "notes", to: "done" },
    ],
  });
  assert.deepEqual(only(validate(downstream), "W_HOMOGENEOUS_CRITICS"), [], "the synthesizer after the critic shares its tier and does not count");

  const auditFirst = base({
    nodes: [agent("audit", "red-team", { ...writable, ...strong }), agent("fix", "builder", { ...writable, ...strong }), stopNode],
    edges: [
      { id: "e-fix", from: "audit", to: "fix", evidence: ["FINDINGS.md"] },
      { id: "e-again", from: "fix", to: "audit", when: "fail", evidence: ["diff"] },
      { id: "e-done", from: "fix", to: "done" },
    ],
    loops: [{ id: "cycle", name: "Cycle", members: ["audit", "fix"], back: ["e-again"], mode: "grind", stops: [{ kind: "max-iterations", n: 3 }, { kind: "budget", measure: "turns", limit: 20 }] }],
  });
  assert.deepEqual(only(validate(auditFirst), "W_HOMOGENEOUS_CRITICS"), [], "the builder reaches the red team only through a back edge");
});

test("W_NO_TERMINAL spares a fragment template, which ends in its host", () => {
  const fragment = base({
    nodes: [agent("worker", "builder", writable)],
    template: { kind: "fragment", title: "F", summary: "S", whenToUse: "W", profile: { cost: "low", speed: "fast", rigor: "light" } },
  });
  assert.deepEqual(validate(fragment), []);
  const whole = structuredClone(fragment);
  whole.template!.kind = "graph";
  assert.deepEqual(codes(validate(whole)), ["W_NO_TERMINAL"], "a whole-graph template still needs somewhere to end");
});

test("W_FANOUT_ON_COUPLED covers coupled groups and coupled owners", () => {
  const doc = base({
    nodes: [agent("planner", "planner", writable), agent("a", "builder", writable), agent("b", "builder", writable), stopNode],
    edges: [
      { id: "e-a", from: "planner", to: "a", concurrency: { max: 2 } },
      { id: "e-b", from: "planner", to: "b" },
      { id: "e-a-done", from: "a", to: "done" },
      { id: "e-b-done", from: "b", to: "done" },
    ],
    groups: [{ id: "workers", name: "Workers", members: ["a", "b"], coupled: true }],
  });
  const grouped = validate(doc);
  assert.deepEqual(codes(grouped), ["W_FANOUT_ON_COUPLED"]);
  assert.deepEqual(grouped[0]!.at, ["e-a", "a", "workers"]);

  const owners = structuredClone(doc);
  owners.groups = [];
  owners.edges[0]!.concurrency = { max: 1 };
  owners.nodes[1] = agent("a", "builder", { ...writable, coupled: true, owns: ["schema.sql"] });
  owners.nodes[2] = agent("b", "builder", { ...writable, coupled: true, owns: ["schema.sql"] });
  const issues = validate(owners);
  assert.deepEqual(codes(issues), ["E_OWNERSHIP_CONFLICT", "W_FANOUT_ON_COUPLED"], "two writers on one artifact is also a conflict");
  assert.match(only(issues, "W_FANOUT_ON_COUPLED")[0]!.message, /both own "schema.sql"/);
});

/** A grind loop builder ⇄ tests → done, with the given stops. */
const grind = (stops: Graph["loops"][number]["stops"]): Graph =>
  base({
    nodes: [
      agent("builder", "builder", writable),
      { id: "tests", kind: "check", name: "Tests", check: { kind: "tests", run: "npm test", pass: "exit 0" } },
      stopNode,
    ],
    edges: [
      { id: "e-test", from: "builder", to: "tests" },
      { id: "e-fail", from: "tests", to: "builder", when: "fail" },
      { id: "e-pass", from: "tests", to: "done", when: "pass" },
    ],
    loops: [{ id: "cycle", name: "Cycle", members: ["builder", "tests"], back: ["e-fail"], stops }],
  });

test("W_LONG_LOOP_NO_BUDGET: five rounds is short, six is long, a budget is enough", () => {
  const human = { kind: "human" } as const;
  assert.deepEqual(validate(grind([human, { kind: "max-iterations", n: 5 }])), []);
  assert.deepEqual(codes(validate(grind([human, { kind: "max-iterations", n: 6 }]))), ["W_LONG_LOOP_NO_BUDGET"]);
  assert.deepEqual(validate(grind([human, { kind: "max-iterations", n: 9 }, { kind: "max-iterations", n: 3 }])), [], "any cap of 5 or fewer");
  assert.deepEqual(validate(grind([human, { kind: "budget", measure: "minutes", limit: 90 }])), []);
  assert.match(validate(grind([human]))[0]!.message, /no max-iterations stop/);
});

test("W_ONLY_MAX_ITERATIONS fires only when every stop is max-iterations", () => {
  assert.deepEqual(codes(validate(grind([{ kind: "max-iterations", n: 3 }, { kind: "max-iterations", n: 2 }]))), ["W_ONLY_MAX_ITERATIONS"]);
  assert.deepEqual(validate(grind([{ kind: "max-iterations", n: 3 }, { kind: "diminishing-returns", rounds: 2 }])), []);
});

test("W_ASPIRATION_AS_ACCEPTANCE: equal up to case and spacing, or a blank acceptance", () => {
  const withBar = (acceptance: string, aspiration?: string): Graph => {
    const doc = grind([{ kind: "bar-passed" }, { kind: "max-iterations", n: 3 }]);
    doc.loops[0]!.bar = { name: "Bar", inspects: [{ kind: "file", ref: "out.txt" }], acceptance, ...(aspiration === undefined ? {} : { aspiration }) };
    return doc;
  };
  assert.deepEqual(validate(withBar("All tests pass.", "Every edge case is covered.")), []);
  assert.deepEqual(codes(validate(withBar("All tests pass.", "  all  tests PASS. "))), ["W_ASPIRATION_AS_ACCEPTANCE"]);
  assert.match(validate(withBar(" ", "Delight"))[0]!.message, /blank acceptance/);
  assert.deepEqual(validate(withBar("All tests pass.")), [], "no aspiration, nothing to confuse");
});

test("W_UNREACHABLE_NODE and W_NO_TERMINAL read reachability from the entry nodes", () => {
  const doc = base({
    nodes: [agent("a", "builder", writable), agent("b", "builder", writable), stopNode],
    edges: [
      { id: "e-ab", from: "a", to: "b" },
      { id: "e-ba", from: "b", to: "a" },
      { id: "e-done", from: "b", to: "done" },
    ],
  });
  const issues = validate(doc);
  assert.deepEqual(codes(issues), ["E_CYCLE_NO_STOP", "W_NO_TERMINAL", "W_UNREACHABLE_NODE"]);
  assert.deepEqual(only(issues, "W_UNREACHABLE_NODE").map((i) => i.at[0]), ["a", "b", "done"]);
  assert.match(only(issues, "W_UNREACHABLE_NODE")[0]!.message, /no entry node/);
  assert.match(only(issues, "W_NO_TERMINAL")[0]!.message, /no stop node is reachable/);
  assert.deepEqual(validate(base()), [], "an empty graph has nothing to end");
});

test("W_OUTPUT_NOT_WRITABLE spares the lead, which is the main session", () => {
  const doc = base({
    nodes: [agent("lead", "lead", { allow: ["spawn-agents"] }), agent("worker", "researcher"), stopNode],
    edges: [
      { id: "e-work", from: "lead", to: "worker" },
      { id: "e-done", from: "worker", to: "done" },
    ],
  });
  const issues = validate(doc);
  assert.deepEqual(codes(issues), ["W_OUTPUT_NOT_WRITABLE"]);
  assert.deepEqual(issues[0]!.at, ["worker"], "no allow list means read-only");
});

test("W_UNKNOWN_KEY names the path, suggests the key, and ignores record keys", () => {
  const doc = {
    ...base({
      nodes: [agent("writer", "builder", { ...writable, efort: "high", model: { tier: "strong", pin: { "any-harness": "x" } } }), stopNode],
      edges: [{ id: "e", from: "writer", to: "done", whne: "pass" } as Graph["edges"][number]],
      policies: [{ id: "p", kind: "concurrency-cap", scope: "graph", params: { anything: 3 } }],
      layout: { writer: { x: 0, y: 0 } },
    }),
    viewState: { zoom: 2 },
  } as unknown as Graph;
  const issues = validate(doc);
  assert.deepEqual(codes(issues), ["W_UNKNOWN_KEY"]);
  assert.deepEqual(
    issues.map((i) => [i.message.replace(/; it is kept, but grooph does not read it$/, ""), i.at]),
    [
      ['unknown key "efort" at /nodes/0/efort; did you mean "effort"?', ["writer"]],
      ['unknown key "whne" at /edges/0/whne; did you mean "when"?', ["e"]],
      ['unknown key "viewState" at /viewState', ["g"]],
    ],
  );
});

test("issues come out in graph-ir §3 table order", () => {
  const doc = base({
    nodes: [
      agent("builder", "builder", { owns: ["x"] }),
      agent("other", "builder", { ...writable, owns: ["x"], irreversible: ["merge"] }),
    ],
    edges: [{ id: "e", from: "builder", to: "other" }],
    loops: [],
  });
  const order = validate({ ...doc, extra: true } as unknown as Graph, { forExport: true }).map((i) => i.code);
  assert.deepEqual(order, ["E_OWNERSHIP_CONFLICT", "E_IRREVERSIBLE_NO_GATE", "W_NO_TERMINAL", "W_OUTPUT_NOT_WRITABLE", "W_UNKNOWN_KEY"]);
});

test("the effective adaptation level: default adaptive, the stricter of field and policy", () => {
  assert.equal(effectiveAdaptation(base()), "adaptive");
  assert.equal(effectiveAdaptation(base({ adaptation: "fixed" })), "fixed");
  const policy: Graph["policies"] = [{ id: "p", kind: "no-live-graph-rewrite", scope: "graph" }];
  assert.equal(effectiveAdaptation(base({ policies: policy })), "propose");
  assert.equal(effectiveAdaptation(base({ adaptation: "adaptive", policies: policy })), "propose");
  assert.equal(effectiveAdaptation(base({ adaptation: "fixed", policies: policy })), "fixed");
});

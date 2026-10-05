/**
 * Rule behavior the fixtures cannot show on their own: the cases inside a rule
 * (graph-ir §3) and the defaults the rules depend on (§1, §2).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { indexGraph } from "../src/graph-index.js";
import type { Issue } from "../src/issues.js";
import { parseGraph } from "../src/parse.js";
import { effectiveAdaptation, entryNodeIds, loopMode } from "../src/semantics.js";
import type { Graph, Loop, Node } from "../src/types.js";
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
  const doc = base({ target: { harness: "unknown-harness" }, nodes: [agent("a", "builder")] });
  const issues = errors(validate(doc, { forExport: true }));
  assert.deepEqual(codes(issues), ["E_NO_TARGET"]);
  assert.match(issues[0]!.message, /no compile profile for target harness "unknown-harness"/);
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

test("E_IRREVERSIBLE_NO_GATE: a node the run starts at is reached with nobody asked, whatever leads back to it", () => {
  // Found by the audit of 0.3.0's claims: a step marked irreversible that only its loop's back edge leads into.
  // With no approval on that edge the rule named the edge; with one it passed, though the run starts at the step.
  const tests: Node = { id: "tests", kind: "check", name: "Tests", check: { kind: "tests", run: "npm test", pass: "exit code 0" } };
  const looped = (back: object, extra: Node[] = [], edges: Graph["edges"] = [], stops: Graph["loops"][number]["stops"] = []): Graph =>
    base({
      nodes: [agent("pusher", "builder", { ...writable, irreversible: ["push"] }), tests, ...extra, stopNode],
      edges: [
        { id: "e-push-tests", from: "pusher", to: "tests" },
        { id: "e-tests-fail", from: "tests", to: "pusher", when: "fail", ...back },
        { id: "e-tests-pass", from: "tests", to: "done", when: "pass" },
        ...edges,
      ],
      loops: [{ id: "fix", name: "Fix", members: ["pusher", "tests"], back: ["e-tests-fail"], stops: [{ kind: "max-iterations", n: 3 }, { kind: "budget", measure: "minutes", limit: 10 }, ...stops] }],
    });
  for (const back of [{}, { approval: true }]) {
    const issues = only(validate(looped(back)), "E_IRREVERSIBLE_NO_GATE");
    assert.equal(issues.length, 1, JSON.stringify(back));
    assert.match(issues[0]!.message, /is where the run starts: only a loop's back edge \("e-tests-fail"\) leads to it, so no human decides before it runs the first time/);
    assert.deepEqual(issues[0]!.at, ["pusher", "e-tests-fail"]);
  }
  // A stop of its own loop that asks a person and continues at it is the loop going round again: still where the run starts.
  assert.equal(only(validate(looped({ approval: true }, [], [], [{ kind: "human", every: 2, then: "pusher" }])), "E_IRREVERSIBLE_NO_GATE").length, 1);

  // A gate before it: every way in passes a human, the way in at the start among them.
  const gate: Node = { id: "gate", kind: "human-gate", name: "Gate", prompt: "Push as fixes are made?" };
  const gated: Graph["edges"] = [{ id: "e-gate-push", from: "gate", to: "pusher", when: "pass" }];
  assert.deepEqual(only(validate(looped({ approval: true }, [gate], gated)), "E_IRREVERSIBLE_NO_GATE"), []);
  // With the gate before it and the way back open, the open edge is named, as it was.
  const open = only(validate(looped({}, [gate], gated)), "E_IRREVERSIBLE_NO_GATE");
  assert.deepEqual(open.map((issue) => issue.at), [["pusher", "e-tests-fail"]]);
  assert.match(open[0]!.message, /can be reached without a human decision through "e-tests-fail"/);
});

test("E_IRREVERSIBLE_NO_GATE: a loop's stop that continues at the node is a way in, and must pass a human too", () => {
  // A writer and a check in a loop, then a gate, then the publisher. Every edge into the publisher starts at the gate.
  const gate: Node = { id: "gate", kind: "human-gate", name: "Gate", prompt: "Publish?" };
  const looped = (stops: Loop["stops"], edges: Graph["edges"] = []): Graph =>
    base({
      nodes: [agent("writer", "builder", writable), { id: "tests", kind: "check", name: "Tests", check: { kind: "tests", run: "npm test", pass: "exit code 0" } }, gate, agent("publisher", "builder", { ...writable, irreversible: ["publish"] }), stopNode],
      edges: [
        { id: "e-write-tests", from: "writer", to: "tests" },
        { id: "e-tests-fail", from: "tests", to: "writer", when: "fail" },
        { id: "e-tests-gate", from: "tests", to: "gate", when: "pass" },
        { id: "e-pub", from: "gate", to: "publisher", when: "pass" },
        { id: "e-done", from: "publisher", to: "done" },
        ...edges,
      ],
      loops: [{ id: "fix", name: "Fix", members: ["writer", "tests"], back: ["e-tests-fail"], mode: "grind", stops }],
    });
  const cap = { kind: "max-iterations" as const, n: 3 };
  assert.deepEqual(only(validate(looped([cap])), "E_IRREVERSIBLE_NO_GATE"), [], "gated by its one edge");

  // The round cap continues at the publisher itself: a way in that passes nobody. It validated clean before.
  const around = only(validate(looped([{ ...cap, then: "publisher" }])), "E_IRREVERSIBLE_NO_GATE");
  assert.equal(around.length, 1);
  assert.deepEqual(around[0]!.at, ["publisher", "fix"], "the loop whose stop is the open way in is named");
  assert.match(around[0]!.message, /through loop "fix" stop 0 \(max-iterations\), which continues there; every way in must pass a human: have the stop continue at a human-gate node that leads to it$/);
  for (const stop of [{ kind: "budget" as const, measure: "minutes" as const, limit: 10 }, { kind: "bar-passed" as const }, { kind: "diminishing-returns" as const, rounds: 2 }, { kind: "evidence-invalid" as const, rounds: 1 }]) {
    assert.equal(only(validate(looped([cap, { ...stop, then: "publisher" }])), "E_IRREVERSIBLE_NO_GATE").length, 1, stop.kind);
  }

  // A stop that continues at the gate asks a person; and the stop where a person is asked is a person's decision.
  assert.deepEqual(only(validate(looped([{ ...cap, then: "gate" }])), "E_IRREVERSIBLE_NO_GATE"), []);
  assert.deepEqual(only(validate(looped([cap, { kind: "human", every: 2, then: "publisher" }])), "E_IRREVERSIBLE_NO_GATE"), []);

  // An open edge and an open stop: both are named, each with what would close it.
  const both = only(validate(looped([{ ...cap, then: "publisher" }], [{ id: "e-shortcut", from: "writer", to: "publisher" }])), "E_IRREVERSIBLE_NO_GATE");
  assert.deepEqual(both[0]!.at, ["publisher", "e-shortcut", "fix"]);
  assert.match(both[0]!.message, /through "e-shortcut" and loop "fix" stop 0 \(max-iterations\), which continues there; every way in must pass a human: set approval: true on those edges, or start them at a human-gate node, and have the stop continue at a human-gate node that leads to it$/);

  // Nothing but a stop leads to it: reached without a person, and said as that, not as "nothing leads to it".
  const lone = base({
    nodes: [agent("writer", "builder", writable), { id: "tests", kind: "check", name: "Tests", check: { kind: "tests", run: "npm test", pass: "exit code 0" } }, agent("publisher", "builder", { ...writable, irreversible: ["publish"] }), stopNode],
    edges: [{ id: "e-write-tests", from: "writer", to: "tests" }, { id: "e-tests-fail", from: "tests", to: "writer", when: "fail" }, { id: "e-done", from: "publisher", to: "done" }],
    loops: [{ id: "fix", name: "Fix", members: ["writer", "tests"], back: ["e-tests-fail"], mode: "grind", stops: [{ kind: "bar-passed", then: "publisher" }, cap] }],
  });
  assert.match(only(validate(lone), "E_IRREVERSIBLE_NO_GATE")[0]!.message, /through loop "fix" stop 0 \(bar-passed\), which continues there/);
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

test("W_HOMOGENEOUS_CRITICS compares against nearest writers only (graph-ir §3)", () => {
  const strong = { model: { tier: "strong" } };
  const frontier = { model: { tier: "frontier" } };
  // planner (frontier) → builder (strong) → critic (strong): the planner is behind another writer and excuses nothing.
  const far = base({
    nodes: [agent("planner", "planner", { ...writable, ...frontier }), agent("builder", "builder", { ...writable, ...strong }), agent("critic", "critic", { ...writable, ...strong }), stopNode],
    edges: [
      { id: "e-plan", from: "planner", to: "builder", evidence: ["PLAN.md"] },
      { id: "e-review", from: "builder", to: "critic", evidence: ["diff"] },
      { id: "e-done", from: "critic", to: "done", when: "pass" },
    ],
  });
  const flagged = only(validate(far), "W_HOMOGENEOUS_CRITICS");
  assert.equal(flagged.length, 1, "a far-upstream writer no longer excuses the critic");
  assert.deepEqual(flagged[0]!.at, ["builder", "critic"], "only the nearest writer is named");

  // A gate between the writers does not stop the walk; a writer does.
  const gated = structuredClone(far);
  gated.nodes.splice(1, 0, { id: "gate", kind: "human-gate", name: "Gate", prompt: "Approve the plan?" });
  gated.edges = [
    { id: "e-plan", from: "planner", to: "gate", evidence: ["PLAN.md"] },
    { id: "e-approved", from: "gate", to: "builder", when: "pass" },
    ...gated.edges.slice(1),
  ];
  assert.equal(only(validate(gated), "W_HOMOGENEOUS_CRITICS").length, 1);

  // Two nearest writers side by side: one on a different model is enough, as before.
  const parallel = base({
    nodes: [
      agent("a", "builder", { ...writable, ...strong }),
      agent("b", "builder", { ...writable, ...frontier, owns: ["b-out"] }),
      agent("critic", "critic", { ...writable, ...strong }),
      stopNode,
    ],
    edges: [
      { id: "e-a", from: "a", to: "critic", evidence: ["diff"] },
      { id: "e-b", from: "b", to: "critic", evidence: ["diff"] },
      { id: "e-done", from: "critic", to: "done", when: "pass" },
    ],
  });
  assert.deepEqual(only(validate(parallel), "W_HOMOGENEOUS_CRITICS"), [], "a nearest writer on another model excuses the critic");
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

test("a node a loop's stop continues at is led into: it is no entry node, and it is reached (graph-ir §2)", () => {
  // The small grind with a wrap-up step the round cap continues at: nothing but the stop leads to `wrap`.
  const grindThen = (stops: Graph["loops"][number]["stops"], more: Partial<Graph> = {}): Graph =>
    base({
      nodes: [agent("fixer", "builder", writable), { id: "suite", kind: "check", name: "Suite", check: { kind: "tests", run: "npm test", pass: "exit code 0" } }, agent("wrap", "builder", writable), stopNode, { id: "halted", kind: "stop", name: "Halted", outcome: "halt" }],
      edges: [
        { id: "e-fix", from: "fixer", to: "suite" },
        { id: "e-fail", from: "suite", to: "fixer", when: "fail" },
        { id: "e-pass", from: "suite", to: "done", when: "pass" },
        { id: "e-wrap", from: "wrap", to: "halted" },
      ],
      loops: [{ id: "l", name: "L", members: ["fixer", "suite"], back: ["e-fail"], mode: "grind", stops }],
      ...more,
    });
  const entries = (doc: Graph): string[] => entryNodeIds(indexGraph(doc));
  const cap = { kind: "max-iterations", n: 3 } as const;
  const budget = { kind: "budget", measure: "minutes", limit: 20 } as const;

  const led = grindThen([{ ...cap, then: "wrap" }, budget]);
  assert.deepEqual(entries(led), ["fixer"], "the stop is a way in");
  assert.deepEqual(validate(led), [], "and the step is reached, so nothing is said");

  // With no stop that leads there, the same step is where a run would start: that is what the document says.
  assert.deepEqual(entries(grindThen([cap, budget])), ["fixer", "wrap"]);

  // A stop that continues at a member of its own loop is the loop going round again, as a back edge is.
  assert.deepEqual(entries(grindThen([{ ...cap, then: "fixer" }, budget])), ["fixer", "wrap"]);

  // The only stop node is one a stop continues at: it is reached, and it is not where the run starts.
  const ends = grindThen([{ ...cap, then: "halted" }, budget]);
  ends.nodes = ends.nodes.filter((node) => node.id !== "wrap" && node.id !== "done");
  ends.edges = ends.edges.filter((edge) => edge.id !== "e-wrap" && edge.id !== "e-pass");
  assert.deepEqual(entries(ends), ["fixer"]);
  assert.deepEqual(only(validate(ends), "W_NO_TERMINAL"), [], "a stop node a loop's stop continues at ends the run");

  // What a step reached that way leads to is reached too, and what only an unreached loop continues at is not.
  const stranded = grindThen([{ ...cap, then: "wrap" }, budget], {});
  stranded.edges = stranded.edges.filter((edge) => edge.id !== "e-fix");
  stranded.edges.push({ id: "e-suite-self", from: "suite", to: "suite", when: "fail" });
  assert.deepEqual(entries(stranded), ["fixer"]);
  assert.deepEqual(only(validate(stranded), "W_UNREACHABLE_NODE").map((i) => i.at[0]), ["suite", "done"], "fixer's loop is reached, so `wrap` and `halted` are; the suite is cut off");

  // Two loops whose stops continue only into each other: something leads into every node, so nothing starts.
  const ring = base({
    nodes: [agent("a", "builder", writable), agent("b", "builder", writable)],
    edges: [
      { id: "e-aa", from: "a", to: "a" },
      { id: "e-bb", from: "b", to: "b" },
    ],
    loops: [
      { id: "la", name: "A", members: ["a"], back: ["e-aa"], mode: "grind", stops: [{ ...cap, then: "b" }, budget] },
      { id: "lb", name: "B", members: ["b"], back: ["e-bb"], mode: "grind", stops: [{ ...cap, then: "a" }, budget] },
    ],
  });
  assert.deepEqual(entries(ring), []);
  const said = only(validate(ring), "W_UNREACHABLE_NODE");
  assert.deepEqual(said.map((i) => i.at[0]), ["a", "b"]);
  assert.match(said[0]!.message, /no entry node \(every node has an inbound edge that is not a loop back edge, or a loop's stop that continues there\)/);
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

// ─── groups form a tree; a graph has one lead (amendment A-018) ──────────────

const three = (groups: Graph["groups"]): Graph =>
  base({
    nodes: [agent("a", "builder", writable), agent("b", "builder", writable), agent("c", "builder", writable), { id: "done", kind: "stop", name: "Done" }],
    edges: [
      { id: "e1", from: "a", to: "b" },
      { id: "e2", from: "b", to: "c" },
      { id: "e3", from: "c", to: "done" },
    ],
    groups,
  });
test("E_GROUP_CYCLE: a group that lists itself, a ring of two, a ring of three, each said once", () => {
  const itself = only(validate(three([{ id: "g1", name: "G1", members: ["a", "g1"] }])), "E_GROUP_CYCLE");
  assert.equal(itself.length, 1);
  assert.match(itself[0]!.message, /group "g1" lists itself as a member/);
  assert.deepEqual(itself[0]!.at, ["g1"]);

  const ring = only(
    validate(
      three([
        { id: "g1", name: "G1", members: ["a", "g2"] },
        { id: "g2", name: "G2", members: ["b", "g3"] },
        { id: "g3", name: "G3", members: ["c", "g1"] },
      ]),
    ),
    "E_GROUP_CYCLE",
  );
  assert.equal(ring.length, 1, "one ring is one issue, not one for each group on it");
  assert.match(ring[0]!.message, /g1 → g2 → g3 → g1/);
  assert.deepEqual(ring[0]!.at, ["g1", "g2", "g3"]);

  // Two rings that share no group are two issues; a group outside a ring that holds one is not on it.
  const two = only(
    validate(
      three([
        { id: "outer", name: "Outer", members: ["g1"] },
        { id: "g1", name: "G1", members: ["a", "g2"] },
        { id: "g2", name: "G2", members: ["g1"] },
        { id: "g3", name: "G3", members: ["g3"] },
      ]),
    ),
    "E_GROUP_CYCLE",
  );
  assert.deepEqual(
    two.map((issue) => issue.at),
    [["g1", "g2"], ["g3"]],
  );
});

test("a tree of groups, as deep as it likes, is neither a ring nor an overlap", () => {
  const issues = validate(
    three([
      { id: "all", name: "All", members: ["first", "c"] },
      { id: "first", name: "First", members: ["inner", "b"] },
      { id: "inner", name: "Inner", members: ["a"], from: "review-gate@3", with: { task: "x" }, description: "One line." },
    ]),
  );
  assert.deepEqual(codes(issues), []);
});

test("W_GROUP_OVERLAP: two groups that share a member and neither holds the other; nesting said twice is not one", () => {
  const overlap = validate(
    three([
      { id: "g1", name: "G1", members: ["a", "b"] },
      { id: "g2", name: "G2", members: ["b", "c"] },
    ]),
  );
  assert.deepEqual(codes(overlap), ["W_GROUP_OVERLAP"]);
  assert.equal(overlap[0]!.severity, "warning");
  assert.match(overlap[0]!.message, /node "b" is a member of groups "g1" and "g2", and neither holds the other; views draw it in "g1"/);
  assert.deepEqual(overlap[0]!.at, ["b", "g1", "g2"]);

  // The outer group lists what its inner group lists as well: the node is in one place, said twice.
  const nested = validate(
    three([
      { id: "outer", name: "Outer", members: ["inner", "a", "b"] },
      { id: "inner", name: "Inner", members: ["a"] },
    ]),
  );
  assert.deepEqual(codes(nested), []);

  // A group can be the shared member, and three holders are named together.
  const shared = only(
    validate(
      three([
        { id: "inner", name: "Inner", members: ["a"] },
        { id: "g1", name: "G1", members: ["inner"] },
        { id: "g2", name: "G2", members: ["inner", "b"] },
        { id: "g3", name: "G3", members: ["inner", "c"] },
      ]),
    ),
    "W_GROUP_OVERLAP",
  );
  assert.equal(shared.length, 1);
  assert.match(shared[0]!.message, /group "inner" is a member of groups "g1", "g2" and "g3", and none of them holds another/);
});

test("a ring of groups does not hang the overlap rule or the coupled one", () => {
  const issues = validate(
    three([
      { id: "g1", name: "G1", members: ["a", "g2"], coupled: true },
      { id: "g2", name: "G2", members: ["a", "g1"] },
    ]),
  );
  // The ring is the fault, and it is said once. Inside a ring each group holds the other, so nothing is "in two".
  assert.deepEqual(codes(issues), ["E_GROUP_CYCLE"]);
});

test("E_SECOND_LEAD: one lead or none is fine; two are one error that names them all", () => {
  const withLeads = (roles: string[]): Graph =>
    base({
      nodes: [...roles.map((role, i) => agent(`n${i}`, role, writable)), { id: "done", kind: "stop", name: "Done" }],
      edges: [...roles.slice(1).map((_, i) => ({ id: `e${i}`, from: `n${i}`, to: `n${i + 1}` })), { id: "e-done", from: `n${roles.length - 1}`, to: "done" }],
    });
  assert.deepEqual(only(validate(withLeads(["builder", "builder"])), "E_SECOND_LEAD"), []);
  assert.deepEqual(only(validate(withLeads(["lead", "builder"])), "E_SECOND_LEAD"), []);
  const two = only(validate(withLeads(["lead", "builder", "lead", "lead"])), "E_SECOND_LEAD");
  assert.equal(two.length, 1);
  assert.equal(two[0]!.severity, "error");
  assert.match(two[0]!.message, /the graph has 3 lead nodes \("n0", "n2", "n3"\)/);
  assert.deepEqual(two[0]!.at, ["n0", "n2", "n3"]);
});

test("a group's new fields are held to their shapes: where it came from, what it was filled with, one line", () => {
  const schemaIssues = (group: object): string[] =>
    parseGraph(three([{ id: "g1", name: "G1", members: ["a"], ...group } as never])).issues.map((issue) => issue.message);
  assert.deepEqual(schemaIssues({ from: "review-gate@1", with: { task: "the checkout flow", "test-command": "pnpm test" }, description: "A builder and a critic." }), []);
  for (const from of ["review-gate", "review-gate@", "review-gate@0", "review-gate@1.2", "Review-Gate@1", "review gate@1", "review-gate@1\nmodel: x", "@1", "review-gate@latest"]) {
    assert.equal(schemaIssues({ from }).length, 1, `from: ${JSON.stringify(from)}`);
  }
  assert.equal(schemaIssues({ description: "two\nlines" }).length, 1);
  assert.equal(schemaIssues({ with: { "a key": "x" } }).length, 1);
  assert.equal(schemaIssues({ with: { task: 3 } }).length, 1);
  // A slot's value is text for a brief, and may run over lines.
  assert.deepEqual(schemaIssues({ with: { task: "line one\nline two" } }), []);
});

test("the effective adaptation level: default adaptive, the stricter of field and policy", () => {
  assert.equal(effectiveAdaptation(base()), "adaptive");
  assert.equal(effectiveAdaptation(base({ adaptation: "fixed" })), "fixed");
  const policy: Graph["policies"] = [{ id: "p", kind: "no-live-graph-rewrite", scope: "graph" }];
  assert.equal(effectiveAdaptation(base({ policies: policy })), "propose");
  assert.equal(effectiveAdaptation(base({ adaptation: "adaptive", policies: policy })), "propose");
  assert.equal(effectiveAdaptation(base({ adaptation: "fixed", policies: policy })), "fixed");
});

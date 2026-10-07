/**
 * Subgroophs (amendment A-018, decision 0025): placing a template as a unit, listing a graph's groups, refreshing a
 * subgrooph from a newer version of its template, and saving a group as a template.
 *
 * The template is the built-in review gate, as it ships; its "newer versions" are made here by changing a copy.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { canonicalize } from "../src/canonicalize.js";
import { indexGraph } from "../src/graph-index.js";
import { parseGraph, parseGraphText } from "../src/parse.js";
import { entryNodeIds } from "../src/semantics.js";
import { extractGroup, groupContents, listGroups, placeSubgrooph, refreshSubgrooph } from "../src/subgrooph.js";
import { TemplateError } from "../src/template.js";
import type { Edge, Graph, Loop, Node } from "../src/types.js";
import { validate } from "../src/validate.js";
import { read, repoRoot } from "./helpers.js";

const reviewGate = (): Graph => parseGraphText(read(join(repoRoot, "patterns/review-gate.grooph.json"))).doc!;
const values = { task: "the checkout flow", "test-command": "pnpm test", checklist: "docs/checklist.md" };

const agent = (id: string, role: string, output: string): Node => ({ id, kind: "agent", name: id, role, brief: `${id}: do the work.`, outputs: [output], allow: ["read-files", "write-outputs"] }) as Node;
const fixture = (): Graph => parseGraphText(read(join(repoRoot, "fixtures/valid/subgrooph-in-a-graph.grooph.json"))).doc!;
/** The graph the fixture's review gate was placed in: a planner, a release step and a stop. */
const host = (): Graph => {
  const { policies: _policies, groups: _groups, ...rest } = fixture();
  const own = (id: string): boolean => !id.startsWith("review-");
  return { ...rest, nodes: rest.nodes.filter((node) => own(node.id)), edges: rest.edges.filter((edge) => own(edge.from) && own(edge.to)), loops: [] };
};
const placed = (): Graph => placeSubgrooph(host(), reviewGate(), { as: "review", values, after: "plan", then: "release" }).doc;

const errorsOf = (doc: Graph): string[] => validate(doc, { forExport: true }).filter((issue) => issue.severity === "error").map((issue) => `${issue.code} ${issue.message}`);
/** The document as grooph would write it and read it back: nothing a placement makes may fail the schema. */
const written = (doc: Graph): Graph => {
  const parsed = parseGraph(JSON.parse(canonicalize(doc)));
  assert.deepEqual(parsed.issues, []);
  return parsed.doc!;
};

// ─── placing ──────────────────────────────────────────────────────────────

test("placing the review gate between a planner and a release step: one group, the template's nodes under its id, its stop replaced", () => {
  const result = placeSubgrooph(host(), reviewGate(), { as: "review", values, after: "plan", then: "release" });
  const doc = written(result.doc);

  assert.deepEqual(result.group, {
    id: "review",
    name: "Review gate",
    members: ["review-builder", "review-critic", "review-merge-gate"],
    description: "A builder works, an isolated critic checks the change against a written checklist, failures loop back, and a human approves the merge.",
    from: "review-gate@1",
    with: values,
  });
  assert.deepEqual(doc.groups, [result.group]);
  assert.deepEqual(
    doc.nodes.map((node) => node.id),
    ["plan", "release", "done", "review-builder", "review-critic", "review-merge-gate"],
  );
  assert.deepEqual(result.dropped, ["review-done"], "the template's success stop, which the release step takes the place of");
  assert.deepEqual(result.connected, ["e-review-merge-gate-release", "e-plan-review-builder"]);

  // The edge that reached the stop leads to the release step, as it was: the gate's approval still decides it.
  const onward = doc.edges.find((edge) => edge.id === "e-review-merge-gate-release")!;
  assert.deepEqual({ from: onward.from, to: onward.to, when: onward.when }, { from: "review-merge-gate", to: "release", when: "pass" });
  assert.equal(doc.edges.some((edge) => edge.to === "review-done"), false);

  // Every rule applies to its nodes as written, and the only warning is the template's own.
  assert.deepEqual(errorsOf(doc), []);
  assert.deepEqual(
    validate(doc, { forExport: true }).map((issue) => issue.code),
    ["W_HOMOGENEOUS_CRITICS"],
  );
  // The slots are filled where the template's nodes, edges and loop use them, and kept in the group for a refresh.
  assert.equal(canonicalize(doc).includes("{{"), false);
  assert.match(loopOf(doc, "review-review").bar!.acceptance, /`pnpm test` exits 0/);
});

test("what is placed is what the fixture holds, but for the plain group the fixture wraps it in", () => {
  const doc = written(placed());
  const strip = (g: Graph): unknown => ({ nodes: g.nodes, edges: [...g.edges].sort((a, b) => a.id.localeCompare(b.id)), loops: g.loops, policies: g.policies });
  assert.deepEqual(strip(doc), strip(fixture()));
  // The fixture's group carries a line a person wrote; a placed one carries the template's own summary.
  const group = fixture().groups!.find((g) => g.id === "review")!;
  assert.deepEqual({ ...doc.groups![0], description: group.description }, group);
});

test("without --then the template keeps its own stop, inside the box; without --after nothing leads in", () => {
  const result = placeSubgrooph(host(), reviewGate(), { as: "review", values });
  assert.deepEqual(result.dropped, []);
  assert.deepEqual(result.connected, []);
  assert.deepEqual(result.group.members, ["review-builder", "review-critic", "review-merge-gate", "review-done"]);
  assert.deepEqual(groupContents(result.doc, "review").entries, []);
});

test("a fragment, which has no stop of its own, is led on from where it ends", () => {
  const fragment = parseGraphText(read(join(repoRoot, "patterns/human-gated-irreversible.grooph.json"))).doc!;
  assert.equal(fragment.template!.kind, "fragment");
  const ends = fragment.nodes.filter((node) => node.kind !== "stop" && !fragment.edges.some((edge) => edge.from === node.id));
  const stops = fragment.nodes.filter((node) => node.kind === "stop" && (node.outcome ?? "success") === "success");
  const result = placeSubgrooph(host(), fragment, { as: "ship", after: "release", then: "done", values: Object.fromEntries((fragment.template!.slots ?? []).map((slot) => [slot.key, slot.example])) });
  assert.equal(result.group.from, `human-gated-irreversible@${fragment.version}`);
  if (stops.length > 0) assert.deepEqual(result.dropped, stops.map((node) => `ship-${node.id}`));
  else assert.equal(result.connected.filter((id) => id.endsWith("-done")).length, ends.length);
  assert.equal(groupContents(result.doc, "ship").exits.every((edge) => edge.to === "done"), true);
  assert.equal(groupContents(result.doc, "ship").entries.every((edge) => edge.from === "release"), true);
});

test("the same template twice: two groups, two sets of ids, nothing shared but graph-wide policies", () => {
  const once = placeSubgrooph(host(), reviewGate(), { as: "review", values, after: "plan", then: "release" }).doc;
  const twice = placeSubgrooph(once, reviewGate(), { as: "second-review", values: { ...values, task: "the release notes" }, after: "release", then: "done" });
  const doc = written(twice.doc);
  assert.deepEqual(
    doc.groups!.map((group) => [group.id, group.from]),
    [
      ["review", "review-gate@1"],
      ["second-review", "review-gate@1"],
    ],
  );
  assert.equal(new Set(doc.nodes.map((node) => node.id)).size, doc.nodes.length);
  // The template's graph-wide policies came in once: the graph already had the same ones the second time.
  assert.deepEqual(
    doc.policies!.map((policy) => policy.id),
    ["review-p-critic-isolation", "review-p-no-self-grading"],
  );
  assert.deepEqual(errorsOf(doc).filter((line) => !line.startsWith("E_OWNERSHIP_CONFLICT")), []);
});

test("placing refuses an id the graph uses, a prefix the graph uses, and a node that is not there", () => {
  assert.throws(() => placeSubgrooph(host(), reviewGate(), { as: "plan", values }), (error: Error) => error instanceof TemplateError && /"plan" is taken/.test(error.message));
  assert.throws(() => placeSubgrooph(host(), reviewGate(), { as: "Review", values }), /cannot name a subgrooph/);
  const crowded = { ...host(), nodes: [...host().nodes, agent("review-critic", "critic", "NOTES.md")] };
  // Every id under the prefix is the subgrooph's own: that is how a refresh tells the template's from the graph's.
  assert.throws(() => placeSubgrooph(crowded, reviewGate(), { as: "review", values }), /already has "review-critic", and every id that begins with "review-" would be the subgrooph's own/);
  const capped = { ...host(), policies: [{ id: "review-cap", kind: "concurrency-cap" as const, scope: "graph" as const, params: { max: 2 } }] };
  assert.throws(() => placeSubgrooph(capped, reviewGate(), { as: "review", values }), /already has "review-cap"/);
  assert.throws(() => placeSubgrooph(placed(), reviewGate(), { as: "review-two", values }), /"review-two" begins with "review-", and every such id is the subgrooph "review"'s own/);
  // The graph's own id is not an object inside it: a graph named for what it does may hold a box named the same way.
  assert.equal(placeSubgrooph({ ...host(), id: "review-loop" }, reviewGate(), { as: "review", values }).group.id, "review");
  assert.throws(() => placeSubgrooph(host(), reviewGate(), { as: "review", values, then: "relese" }), /--then names "relese".*did you mean "release"/);
  assert.throws(() => placeSubgrooph(host(), reviewGate(), { as: "review", values, after: "nobody" }), /--after names "nobody"/);
  assert.throws(() => placeSubgrooph(host(), reviewGate(), { as: "review", values: { tsak: "x" } }), /no slot "tsak"/);
});

test("a subgrooph has no lead of its own: a template with a lead node is not placed, and not refreshed from", () => {
  const withLead = (g: Graph, id: string): Graph => ({ ...g, nodes: [{ ...agent(id, "lead", `${id}.md`) }, ...g.nodes] });
  // Whether or not the graph has a lead: where it has none, the template's would become the brief the session runs by.
  for (const graph of [host(), withLead(host(), "conductor")]) {
    assert.throws(() => placeSubgrooph(graph, withLead(reviewGate(), "gate-lead"), { as: "review", values, after: "plan", then: "release" }), /has a lead node \("gate-lead"\): a subgrooph has no lead of its own/);
  }
  assert.throws(() => refreshSubgrooph(placed(), "review", { ...withLead(reviewGate(), "gate-lead"), version: 2 }), /has a lead node \("gate-lead"\)/);
});

test("placing says which nodes of the graph it leads to around a person", () => {
  // The release step sits behind a gate of the graph's own. Led on to directly, it is reached without that gate.
  const gatedHost: Graph = { ...host(), nodes: [...host().nodes, { id: "go", kind: "human-gate", name: "Go", prompt: "Release?" }], edges: [...host().edges, { id: "e-plan-go", from: "plan", to: "go" }, { id: "e-go-release", from: "go", to: "release", when: "pass" }] };
  const grind = parseGraphText(read(join(repoRoot, "patterns/grind-loop.grooph.json"))).doc!;
  const slots = Object.fromEntries((grind.template!.slots ?? []).map((slot) => [slot.key, slot.example]));
  assert.deepEqual(placeSubgrooph(gatedHost, grind, { as: "grind", values: slots, after: "plan", then: "release" }).opens, [
    { node: "release", past: "a person" },
    { node: "done", past: "a person" },
  ]);
  // The review gate ends at a gate of its own. A person still decides, but not the one who did: that is said too.
  assert.deepEqual(placeSubgrooph(gatedHost, reviewGate(), { as: "review", values, after: "plan", then: "release" }).opens, [
    { node: "release", past: 'the human gate "go"' },
    { node: "done", past: 'the human gate "go"' },
  ]);
  // Each node is said once, for the widest decision it is now reached around.
  // Where no person stood before the node, nothing is opened.
  assert.deepEqual(placeSubgrooph(host(), grind, { as: "grind", values: slots, after: "plan", then: "release" }).opens, []);
});

// ─── listing ──────────────────────────────────────────────────────────────

test("listing says what each group holds and how it is connected, subgrooph or not", () => {
  const doc = { ...placed(), groups: [...placed().groups!, { id: "delivery", name: "Review and release", members: ["review", "release"] }] };
  assert.deepEqual(listGroups(doc), [
    {
      id: "review",
      name: "Review gate",
      description: "A builder works, an isolated critic checks the change against a written checklist, failures loop back, and a human approves the merge.",
      from: { template: "review-gate", version: 1 },
      with: values,
      inside: "delivery",
      nodes: 3,
      groups: 0,
      entries: [{ edge: "e-plan-review-builder", from: "plan", to: "review-builder" }],
      exits: [{ edge: "e-review-merge-gate-release", from: "review-merge-gate", to: "release" }],
    },
    {
      id: "delivery",
      name: "Review and release",
      nodes: 4,
      groups: 1,
      entries: [{ edge: "e-plan-review-builder", from: "plan", to: "review-builder" }],
      exits: [{ edge: "e-release-done", from: "release", to: "done" }],
    },
  ]);
  const contents = groupContents(doc, "review");
  assert.deepEqual(contents.loops, ["review-review"]);
  assert.equal(contents.edges.length, 4);
  assert.throws(() => groupContents(doc, "reveiw"), /no group "reveiw".*did you mean "review"/);
});

// ─── refreshing ───────────────────────────────────────────────────────────

/** A newer version of the review gate: the same template with `change` applied to a copy, and its version raised. */
const newer = (change: (template: Graph) => void, version = 2, base: Graph = reviewGate()): Graph => {
  const template = structuredClone(base);
  change(template);
  template.version = version;
  return template;
};
const loopOf = (doc: Graph, id: string): Loop => doc.loops.find((loop) => loop.id === id)!;
const names = (changes: { name: string }[]): string[] => changes.map((change) => change.name);

test("a refresh from the same version changes nothing, and says so", () => {
  const before = placed();
  const result = refreshSubgrooph(before, "review", reviewGate());
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.held, []);
  assert.equal(canonicalize(result.doc), canonicalize(before));
});

test("a newer version's ordinary changes apply: a brief reworded, a node added, the group moved on to the new version", () => {
  const template = newer((t) => {
    (t.nodes.find((node) => node.id === "builder") as { brief: string }).brief += " Say in one line what changed.";
    t.nodes.push(agent("lint", "builder", "LINT.md"));
    t.edges.push({ id: "e-builder-lint", from: "builder", to: "lint" });
    t.loops[0]!.members.push("lint");
  });
  const result = refreshSubgrooph(placed(), "review", template);
  assert.deepEqual(names(result.changes), ["node:review-builder.brief", "node:review-lint", "edge:e-review-builder-review-lint", "loop:review-review.members"]);
  assert.deepEqual(result.held, []);
  assert.deepEqual(result.from, { was: "review-gate@1", now: "review-gate@2" });

  const doc = written(result.doc);
  const group = doc.groups!.find((g) => g.id === "review")!;
  assert.equal(group.from, "review-gate@2");
  assert.deepEqual(group.members, ["review-builder", "review-critic", "review-merge-gate", "review-lint"]);
  assert.match((doc.nodes.find((node) => node.id === "review-builder") as { brief: string }).brief, /Say in one line what changed\.$/);
  // What connects it to the rest of the graph is the graph's, and is as it was.
  assert.deepEqual(groupContents(doc, "review").entries.map((edge) => edge.id), ["e-plan-review-builder"]);
  assert.deepEqual(groupContents(doc, "review").exits.map((edge) => edge.id), ["e-review-merge-gate-release"]);
  assert.equal(doc.nodes.some((node) => node.id === "review-done"), false, "the stop the release step replaced does not come back");
});

test("a change that loosens a brake is named first and not applied; asked for by name, it is", () => {
  const template = newer((t) => {
    // Loosening: the round cap doubles, and the budget grows.
    t.loops[0]!.stops = [{ kind: "bar-passed" }, { kind: "max-iterations", n: 8 }, { kind: "budget", measure: "dispatches", limit: 10 }];
    // Not loosening: a brief.
    (t.nodes.find((node) => node.id === "critic") as { brief: string }).brief += " Cite a file and a line for every item.";
  });
  const result = refreshSubgrooph(placed(), "review", template);
  assert.deepEqual(names(result.changes), ["loop:review-review.stops", "node:review-critic.brief"], "the loosening change comes first");
  assert.equal(result.changes[0]!.loosens, "raises the round cap from 4 to 8");
  assert.deepEqual(names(result.held), ["loop:review-review.stops"]);

  // Held back: the cap is what it was. The brief changed, and the group is on the new version.
  assert.deepEqual(loopOf(result.doc, "review-review").stops, loopOf(placed(), "review-review").stops);
  assert.match((result.doc.nodes.find((node) => node.id === "review-critic") as { brief: string }).brief, /Cite a file and a line/);
  assert.equal(result.doc.groups![0]!.from, "review-gate@2");
  assert.deepEqual(errorsOf(written(result.doc)), []);

  // Shown again the next time, since it was not taken.
  assert.deepEqual(names(refreshSubgrooph(result.doc, "review", template).changes), ["loop:review-review.stops"]);

  // Asked for by its name.
  const allowed = refreshSubgrooph(placed(), "review", template, { allow: ["loop:review-review.stops"] });
  assert.deepEqual(allowed.held, []);
  assert.equal((loopOf(allowed.doc, "review-review").stops[1] as { n: number }).n, 8);
  assert.throws(() => refreshSubgrooph(placed(), "review", template, { allow: ["loop:review-review.stop"] }), /no change named "loop:review-review.stop".*did you mean "loop:review-review.stops"/);
});

test("tightening applies with the rest: a lower cap, a smaller budget, a new approval", () => {
  const template = newer((t) => {
    t.loops[0]!.stops = [{ kind: "bar-passed" }, { kind: "max-iterations", n: 2 }, { kind: "budget", measure: "dispatches", limit: 6 }];
    (t.edges.find((edge) => edge.id === "e-critic-pass") as Edge).approval = true;
  });
  const result = refreshSubgrooph(placed(), "review", template);
  assert.deepEqual(result.held, []);
  assert.deepEqual(names(result.changes).sort(), ["edge:review-e-critic-pass.approval", "loop:review-review.stops"]);
  assert.equal((loopOf(result.doc, "review-review").stops[1] as { n: number }).n, 2);
});

test("every brake on amendment A-008's list is held back when a newer version would remove or loosen it", () => {
  const cases: { what: string; change: (t: Graph) => void; held: string; why: RegExp }[] = [
    {
      what: "a human gate removed",
      change: (t) => {
        t.nodes = t.nodes.filter((node) => node.id !== "merge-gate");
        t.edges = t.edges.filter((edge) => edge.from !== "merge-gate" && edge.to !== "merge-gate");
        t.edges.push({ id: "e-critic-done", from: "critic", to: "done", when: "pass" });
        t.loops[0]!.members = ["builder", "critic"];
        t.loops[0]!.back = ["e-critic-fail"];
      },
      held: "node:review-merge-gate",
      why: /removes a human gate/,
    },
    {
      what: "a way around the gate",
      change: (t) => {
        // The critic may now end the work itself. Here the template's end is the release step.
        t.edges.push({ id: "e-critic-done", from: "critic", to: "done", when: { verdict: "trivial" } });
      },
      held: "edge:e-review-critic-release",
      why: /adds a way into "release" that does not pass a person/,
    },
    {
      what: "an approval removed",
      change: (t) => void t.nodes.length,
      held: "edge:review-e-critic-pass.approval",
      why: /removes a person's approval/,
    },
    {
      what: "an irreversible marker removed",
      change: (t) => void t.nodes.length,
      held: "node:review-builder.irreversible",
      why: /removes the irreversible marker "push to main"/,
    },
    {
      what: "a budget removed",
      change: (t) => {
        t.loops[0]!.stops = [{ kind: "bar-passed" }, { kind: "max-iterations", n: 4 }];
      },
      held: "loop:review-review.stops",
      why: /removes the budget \(10 dispatches\)/,
    },
    {
      what: "a round cap removed",
      change: (t) => {
        t.loops[0]!.stops = [{ kind: "bar-passed" }, { kind: "budget", measure: "dispatches", limit: 10 }];
      },
      held: "loop:review-review.stops",
      why: /removes the round cap \(4\)/,
    },
    {
      what: "a bar's acceptance changed",
      change: (t) => {
        t.loops[0]!.bar!.acceptance = "Most checklist items look fine.";
      },
      held: "loop:review-review.bar",
      why: /changes the bar's acceptance/,
    },
    {
      what: "critic isolation removed",
      change: (t) => {
        t.policies = t.policies!.filter((policy) => policy.kind !== "critic-isolation");
      },
      held: "policy:review-p-critic-isolation",
      why: /removes critic isolation/,
    },
    {
      what: "the critic sharing its builder's context",
      change: (t) => {
        (t.edges.find((edge) => edge.id === "e-builder-critic") as Edge).isolation = "shared";
      },
      held: "edge:e-review-builder-review-critic.isolation",
      why: /the critic would share its builder's context/,
    },
    {
      what: "the critic handed no evidence",
      change: (t) => {
        delete (t.edges.find((edge) => edge.id === "e-builder-critic") as Edge).evidence;
      },
      held: "edge:e-review-builder-review-critic.evidence",
      why: /the critic would no longer be handed "diff of the change"/,
    },
  ];
  for (const item of cases) {
    // Two of the brakes are not in the template as it ships: put them in the graph, as a person tightening it would.
    const before = placed();
    if (item.what === "an approval removed") (before.edges.find((edge) => edge.id === "review-e-critic-pass") as Edge).approval = true;
    if (item.what === "an irreversible marker removed") (before.nodes.find((node) => node.id === "review-builder") as { irreversible?: string[] }).irreversible = ["push to main"];
    const result = refreshSubgrooph(before, "review", newer(item.change));
    const held = result.held.find((change) => change.name === item.held);
    assert.ok(held, `${item.what}: ${item.held} is held; held were ${names(result.held).join(", ") || "none"}; changes were ${names(result.changes).join(", ")}`);
    assert.match(held.loosens!, item.why, item.what);
    assert.equal(result.changes[0]!.loosens !== undefined, true, `${item.what}: a loosening change is named first`);
    // Not applied: the brake stands in the graph as it stood.
    const [object, rest] = item.held.split(":") as [string, string];
    const [id, field] = rest.split(".") as [string, string | undefined];
    const find = (doc: Graph): Record<string, unknown> | undefined =>
      ((object === "node" ? doc.nodes : object === "edge" ? doc.edges : object === "loop" ? doc.loops : (doc.policies ?? [])) as { id: string }[]).find((o) => o.id === id) as Record<string, unknown> | undefined;
    if (field === undefined) assert.equal(find(result.doc) !== undefined, find(before) !== undefined, `${item.what}: ${item.held} is as it was`);
    else assert.deepEqual(find(result.doc)![field], find(before)![field], `${item.what}: ${item.held} is as it was`);
  }
});

test("the shape moves as a whole: a gate held back keeps its edges and its place in the loop, and the graph stays whole", () => {
  // The newer version drops the human gate and lets the critic's pass end the work.
  const template = newer((t) => {
    t.nodes = t.nodes.filter((node) => node.id !== "merge-gate");
    t.edges = t.edges.filter((edge) => edge.from !== "merge-gate" && edge.to !== "merge-gate");
    t.edges.push({ id: "e-critic-done", from: "critic", to: "done", when: "pass" });
    t.loops[0]!.members = ["builder", "critic"];
    t.loops[0]!.back = ["e-critic-fail"];
    (t.nodes.find((node) => node.id === "critic") as { brief: string }).brief += " Be brief.";
  });
  const before = placed();
  const result = refreshSubgrooph(before, "review", template);
  assert.deepEqual(
    result.held.map((change) => [change.name, change.loosens ?? null, change.waits ?? null]),
    [
      ["node:review-merge-gate", "removes a human gate", null],
      ["edge:e-review-critic-release", 'adds a way into "release" that does not pass a person', null],
      ["edge:review-e-critic-pass", null, "node:review-merge-gate"],
      ["edge:review-e-merge-gate-reject", null, "node:review-merge-gate"],
      // The way out of the gate is the template's own: it stood for the edge into the template's stop.
      ["edge:e-review-merge-gate-release", null, "node:review-merge-gate"],
      ["loop:review-review.members", null, "node:review-merge-gate"],
      ["loop:review-review.back", null, "node:review-merge-gate"],
    ],
  );
  // The brief is its own, and changed. The shape is exactly what it was, and the graph validates as it did.
  const doc = written(result.doc);
  assert.match((doc.nodes.find((node) => node.id === "review-critic") as { brief: string }).brief, /Be brief\.$/);
  assert.deepEqual(doc.nodes.map((node) => node.id), before.nodes.map((node) => node.id));
  assert.deepEqual(doc.edges.map((edge) => [edge.id, edge.from, edge.to]), before.edges.map((edge) => [edge.id, edge.from, edge.to]));
  assert.deepEqual(loopOf(doc, "review-review").members, loopOf(before, "review-review").members);
  assert.deepEqual(validate(doc, { forExport: true }).map((issue) => issue.code), ["W_HOMOGENEOUS_CRITICS"]);

  // One of the two asked for is not enough: the other still holds the shape.
  const half = refreshSubgrooph(before, "review", template, { allow: ["node:review-merge-gate"] });
  assert.deepEqual(names(half.held.filter((change) => change.waits === undefined)), ["edge:e-review-critic-release"]);
  assert.equal(half.held.find((change) => change.name === "node:review-merge-gate")!.waits, "edge:e-review-critic-release");
  assert.equal(half.doc.nodes.some((node) => node.id === "review-merge-gate"), true);

  // Both asked for by name: the gate goes, the edge that left from it goes with it, and the critic leads on.
  const both = refreshSubgrooph(before, "review", template, { allow: ["node:review-merge-gate", "edge:e-review-critic-release"] });
  assert.deepEqual(both.held, []);
  const after = written(both.doc);
  assert.equal(after.nodes.some((node) => node.id === "review-merge-gate"), false);
  assert.deepEqual(groupContents(after, "review").exits.map((edge) => [edge.id, edge.to]), [["e-review-critic-release", "release"]]);
  assert.deepEqual(both.notes, []);
  assert.deepEqual(after.groups![0]!.members, ["review-builder", "review-critic"]);
  assert.deepEqual(errorsOf(after), []);
});

test("what a person added inside the box is theirs: a node under another id, and its edges, survive a refresh", () => {
  const before = placed();
  before.nodes.push(agent("security", "critic", "SECURITY.md"));
  before.edges.push({ id: "e-review-builder-security", from: "review-builder", to: "security" }, { id: "e-security-review-merge-gate", from: "security", to: "review-merge-gate" });
  before.groups![0]!.members.push("security");
  const result = refreshSubgrooph(before, "review", newer((t) => void ((t.nodes[0] as { brief: string }).brief += " Keep it small.")));
  assert.deepEqual(names(result.changes), ["node:review-builder.brief"]);
  assert.equal(result.doc.nodes.some((node) => node.id === "security"), true);
  assert.equal(result.doc.edges.filter((edge) => edge.from === "security" || edge.to === "security").length, 2);
  assert.deepEqual(result.doc.groups![0]!.members, ["review-builder", "review-critic", "review-merge-gate", "security"]);
});

test("a refresh refuses a plain group, another template, and a group that is not there", () => {
  const doc = { ...placed(), groups: [...placed().groups!, { id: "plain", name: "Plain", members: ["plan"] }] };
  assert.throws(() => refreshSubgrooph(doc, "plain", reviewGate()), /group "plain" is not a subgrooph/);
  assert.throws(() => refreshSubgrooph(doc, "review", { ...reviewGate(), id: "grind-loop" }), /came from "review-gate", and this template is "grind-loop"/);
  assert.throws(() => refreshSubgrooph(doc, "reveiw", reviewGate()), /no group "reveiw".*did you mean "review"/);
});

test("a slot the newer version no longer has is said, and its value kept; a new slot is left to fill", () => {
  const template = newer((t) => {
    t.template!.slots = t.template!.slots!.filter((slot) => slot.key !== "checklist");
    t.goal = t.goal!.replaceAll("{{checklist}}", "{{rubric}}");
    for (const holder of [...t.nodes, ...t.edges, ...t.loops] as unknown[]) {
      const text = JSON.stringify(holder).replaceAll("{{checklist}}", "{{rubric}}");
      Object.assign(holder as object, JSON.parse(text));
    }
  });
  const result = refreshSubgrooph(placed(), "review", template);
  assert.deepEqual(result.notes, ['the template no longer has the slot "checklist"; its value is kept in the group and used nowhere']);
  assert.match(canonicalize(result.doc), /\{\{rubric\}\}/);
  assert.equal(result.doc.groups![0]!.with!["checklist"], "docs/checklist.md");
});

// ─── the promise, where it is hardest to keep ─────────────────────────────
//
// Each of these was a way a newer version could loosen a brake with nothing held back, found by a reader who was
// asked to break the refresh (slice 0085's handback). `refused` is what a person would have to ask for by name.

const refused = (result: { held: { name: string; waits?: string; loosens?: string }[] }): string[] => result.held.filter((change) => change.waits === undefined).map((change) => `${change.name}: ${change.loosens}`);
const pattern = (id: string): Graph => parseGraphText(read(join(repoRoot, `patterns/${id}.grooph.json`))).doc!;
const examples = (template: Graph): Record<string, string> => Object.fromEntries((template.template!.slots ?? []).map((slot) => [slot.key, slot.example ?? "x"]));
const stopsOf = (t: Graph, loop = 0): Loop["stops"] => t.loops[loop]!.stops;

test("a stop made to lead on is a brake loosened: a cap that no longer halts, a pass that skips the gate", () => {
  const cases: [string, (t: Graph) => void, RegExp][] = [
    // A stop that leads on halts nothing: the cap is no cap. And where it leads is a way past the gate.
    ["the round cap leads on", (t) => void (stopsOf(t)[1] = { kind: "max-iterations", n: 4, then: "done" }), /^loop:review-review\.stops: the round cap \(4\) would no longer halt the run; the round cap of 4 would lead on to "release", where it halted the run; a stop of the loop would lead on to "release", a way that does not pass a person/],
    ["the budget leads on", (t) => void (stopsOf(t)[2] = { kind: "budget", measure: "dispatches", limit: 10, then: "done" }), /the budget \(10 dispatches\) would no longer halt the run/],
    ["the cap restarts the loop, with a looser one behind it", (t) => void (t.loops[0]!.stops = [{ kind: "bar-passed" }, { kind: "max-iterations", n: 4, then: "builder" }, { kind: "max-iterations", n: 400 }, { kind: "budget", measure: "dispatches", limit: 10 }]), /the round cap that halts the run would rise from 4 to 400/],
    ["the bar, once passed, skips the gate", (t) => void (stopsOf(t)[0] = { kind: "bar-passed", then: "done" }), /a stop of the loop would lead on to "release", a way that does not pass a person/],
  ];
  for (const [what, change, why] of cases) {
    const before = placed();
    const result = refreshSubgrooph(before, "review", newer(change));
    assert.equal(refused(result).length, 1, what);
    assert.match(refused(result)[0]!, why, what);
    assert.deepEqual(loopOf(result.doc, "review-review").stops, loopOf(before, "review-review").stops, what);
  }
  // A cap that leads to a stop that halts still halts: not held.
  const halts = newer((t) => {
    t.nodes.push({ id: "halted", kind: "stop", name: "Halted", outcome: "halt" });
    stopsOf(t)[1] = { kind: "max-iterations", n: 4, then: "halted" };
    stopsOf(t)[2] = { kind: "budget", measure: "dispatches", limit: 10, then: "halted" };
  });
  assert.deepEqual(refused(refreshSubgrooph(placed(), "review", halts)), []);
  // One that leads to the gate asks a person, and halts the run as far as the cap goes; but the person is then asked
  // to merge what the critic has not passed. That is a way to the gate around the critic, and is held as one.
  const asks = refreshSubgrooph(placed(), "review", newer((t) => void (stopsOf(t)[1] = { kind: "max-iterations", n: 4, then: "merge-gate" })));
  assert.deepEqual(refused(asks), ['loop:review-review.stops: a stop of the loop would lead on to "review-merge-gate", a way that does not pass the critic "review-critic"']);
});

test("the stop where a person is asked: asked less often is held, as its removal is", () => {
  const asked = (every: number, version: number): Graph => newer((t) => void stopsOf(t).push({ kind: "human", every }), version);
  const before = placeSubgrooph(host(), asked(1, 1), { as: "review", values, after: "plan", then: "release" }).doc;
  assert.deepEqual(refused(refreshSubgrooph(before, "review", asked(1000, 2))), ["loop:review-review.stops: a person would be asked every 1000 rounds, not every 1"]);
  assert.deepEqual(refused(refreshSubgrooph(before, "review", newer(() => undefined))), ["loop:review-review.stops: removes the stop where a person is asked"]);
});

test("an edge moved is checked like an edge added: out from behind its gate, around the gate, or answering either way", () => {
  // The built-in gauntlet: the way out of its first gate is made to start at the planner. Nothing leaves the gate.
  const gauntlet = pattern("gauntlet-decomposed");
  const inGraph = placeSubgrooph(host(), gauntlet, { as: "g", values: examples(gauntlet), after: "plan", then: "release" }).doc;
  const moved = refreshSubgrooph(inGraph, "g", newer((t) => void Object.assign(t.edges.find((edge) => edge.id === "e-gate-owner")!, { from: "planner", when: "always" }), 99, gauntlet));
  assert.match(refused(moved).join("\n"), /edge:g-e-gate-owner\.from: "pass" at the human gate "g-decomposition-gate" would lead nowhere; opens a way into "g-owner" that does not pass a person/);
  assert.equal(moved.doc.edges.find((edge) => edge.id === "g-e-gate-owner")!.from, "g-decomposition-gate");

  // The review gate with its own stop: the critic's pass is sent to the stop, past the gate.
  const kept = placeSubgrooph(host(), reviewGate(), { as: "review", values, after: "plan" }).doc;
  const past = refreshSubgrooph(kept, "review", newer((t) => void (t.edges.find((edge) => edge.id === "e-critic-pass")!.to = "done")));
  assert.deepEqual(names(past.held.filter((change) => change.waits === undefined)), ["edge:review-e-critic-pass.to"]);
  assert.match(refused(past)[0]!, /opens a way into "review-done" that does not pass a person/);

  // Approve and reject both lead on.
  const either = refreshSubgrooph(placed(), "review", newer((t) => void (t.edges.find((edge) => edge.id === "e-merge-gate-done")!.when = "always")));
  assert.deepEqual(refused(either), [`edge:e-review-merge-gate-release.when: "pass" at the human gate "review-merge-gate" would lead nowhere; changes what a person's answer leads to; opens a way into "release" that does not pass "pass" at the human gate "review-merge-gate"`]);
});

test("a node replaced under another id does not shed its brake", () => {
  // The built-in gated step: `act`, marked irreversible behind its gate, comes back as `act2` with no mark and no gate.
  const gatedStep = pattern("human-gated-irreversible");
  const before = placeSubgrooph(host(), gatedStep, { as: "ship", values: examples(gatedStep), after: "release", then: "done" }).doc;
  const act = gatedStep.nodes.find((node) => node.kind === "agent" && (node.irreversible ?? []).length > 0)!;
  const shed = newer((t) => {
    const node = t.nodes.find((n) => n.id === act.id) as { id: string; irreversible?: string[] };
    node.id = `${act.id}2`;
    delete node.irreversible;
    t.edges = t.edges.filter((edge) => edge.to !== act.id).map((edge) => (edge.from === act.id ? { ...edge, from: node.id } : edge));
  }, 99, gatedStep);
  const result = refreshSubgrooph(before, "ship", shed);
  assert.match(refused(result).join("\n"), new RegExp(`node:ship-${act.id}: removes a node marked irreversible`));
  assert.deepEqual(result.doc.nodes, before.nodes);
  assert.deepEqual(result.doc.edges, before.edges);

  // The edge into the critic comes back under another id, sharing its builder's context.
  const shared = refreshSubgrooph(placed(), "review", newer((t) => void Object.assign(t.edges.find((edge) => edge.id === "e-builder-critic")!, { id: "to-critic", isolation: "shared" })));
  assert.deepEqual(refused(shared), ["edge:review-to-critic: the critic would share its builder's context"]);
});

test("a way around a gate is found however long it is, and a loop's back edge does not hide it", () => {
  // The built-in spec gate: the critic's fail edge also enters the builder, so not every way in passed the gate.
  const spec = pattern("spec-then-loop");
  const before = placeSubgrooph(host(), spec, { as: "spec", values: examples(spec), after: "plan", then: "release" }).doc;
  const around = refreshSubgrooph(before, "spec", newer((t) => void t.edges.push({ id: "e-planner-builder", from: "planner", to: "builder" }), 99, spec));
  assert.deepEqual(refused(around), ['edge:e-spec-planner-spec-builder: adds a way into "spec-builder" that does not pass a person']);

  // A step put after the gate is still behind it: nothing to ask for. A later way around it is held all the same.
  const smoke = newer((t) => {
    t.nodes.push({ id: "smoke", kind: "check", name: "Smoke test", check: { kind: "command", run: "pnpm smoke" } } as Node);
    t.edges.find((edge) => edge.id === "e-merge-gate-done")!.to = "smoke";
    t.edges.push({ id: "e-smoke-done", from: "smoke", to: "done", when: "pass" });
  });
  const second = refreshSubgrooph(placed(), "review", smoke);
  assert.deepEqual(second.held, []);
  assert.deepEqual(second.doc.edges.filter((edge) => edge.to === "release").map((edge) => edge.from), ["review-smoke"]);
  const third = refreshSubgrooph(second.doc, "review", newer((t) => {
    Object.assign(t, structuredClone(smoke));
    t.edges.push({ id: "e-critic-done", from: "critic", to: "done", when: { verdict: "trivial" } });
  }, 3));
  assert.deepEqual(refused(third), ['edge:e-review-critic-release: adds a way into "release" that does not pass a person; adds a way into "release" that does not pass "pass" from the critic "review-critic"; adds a way into "release" that does not pass the check "review-smoke"']);
});

test("behind two gates in a row, a way around the second is held though the first still stands", () => {
  // The built-in gauntlet: its pieces loop sits behind the first gate, and its pass leads on to the last steps and
  // the release gate. Made to lead straight to the end, it skips that gate.
  const gauntlet = pattern("gauntlet-decomposed");
  const before = placeSubgrooph(host(), gauntlet, { as: "g", values: examples(gauntlet), after: "plan", then: "release" }).doc;
  const skip = newer((t) => void t.loops.forEach((loop) => (loop.stops = loop.stops.map((stop) => (stop.kind === "bar-passed" && stop.then ? { ...stop, then: "done" } : stop)))), 99, gauntlet);
  assert.deepEqual(refused(refreshSubgrooph(before, "g", skip)), [
    'loop:g-pieces.stops: adds a way from "g-owner" to end in success that does not pass a person; a stop of the loop would lead on to "release", a way that does not pass the human gate "g-release-gate"; a stop of the loop would lead on to "release", a way that does not pass the critic "g-final-critic"',
  ]);
});

test("a gate of the graph's own, before the box, is not lost with the node it led to", () => {
  const before = placed();
  before.nodes.push({ id: "go", kind: "human-gate", name: "Go", prompt: "Start the review?" });
  before.edges = before.edges.filter((edge) => edge.id !== "e-plan-review-builder");
  before.edges.push({ id: "e-plan-go", from: "plan", to: "go" }, { id: "e-go-review-builder", from: "go", to: "review-builder", when: "pass" });
  const renamed = newer((t) => {
    t.nodes.find((node) => node.id === "builder")!.id = "implementer";
    for (const edge of t.edges) Object.assign(edge, { from: edge.from === "builder" ? "implementer" : edge.from, to: edge.to === "builder" ? "implementer" : edge.to });
    t.edges.find((edge) => edge.id === "e-builder-critic")!.id = "e-implementer-critic";
    t.loops[0]!.members = ["implementer", "critic", "merge-gate"];
  });
  const result = refreshSubgrooph(before, "review", renamed);
  assert.deepEqual(refused(result), [
    'node:review-builder: "pass" at the human gate "go" would lead nowhere; removes "review-builder", which a run reached only by passing a person, while "review-implementer" would come in with no such need: it may be the same step under another name',
    'edge:e-review-implementer-review-critic: adds a way into "review-critic" that does not pass a person',
  ]);
  assert.equal(canonicalize({ ...result.doc, groups: before.groups! }), canonicalize(before), "nothing but the group's version moved");
});

test("critic isolation: a critic given another role, removed, or cut out of the way is held", () => {
  const critic = (t: Graph): Node => t.nodes.find((node) => node.id === "critic")!;
  const role = refreshSubgrooph(placed(), "review", newer((t) => void ((critic(t) as { role: unknown }).role = { custom: "reviewer" })));
  assert.deepEqual(refused(role), ["node:review-critic.role: a critic is given another role"]);
  const gone = refreshSubgrooph(placed(), "review", newer((t) => {
    t.nodes = t.nodes.filter((node) => node.id !== "critic");
    t.edges = t.edges.filter((edge) => edge.from !== "critic" && edge.to !== "critic");
    t.edges.push({ id: "e-builder-gate", from: "builder", to: "merge-gate" });
    t.loops[0]!.members = ["builder", "merge-gate"];
    t.loops[0]!.back = ["e-merge-gate-reject"];
  }));
  assert.deepEqual(refused(gone), ["node:review-critic: removes a critic"]);
  const cut = refreshSubgrooph(placed(), "review", newer((t) => void Object.assign(t.edges.find((edge) => edge.id === "e-critic-pass")!, { from: "builder", when: "always" })));
  // Both halves are held: with only the edge's start kept, its `always` would still take the verdict out of it.
  assert.deepEqual(refused(cut), [
    'edge:review-e-critic-pass.from: opens a way into "review-merge-gate" that does not pass the critic "review-critic"',
    `edge:review-e-critic-pass.when: changes what the critic's verdict leads to; opens a way into "review-merge-gate" that does not pass the critic "review-critic"`,
  ]);
  const grading = refreshSubgrooph(placed(), "review", newer((t) => void (t.policies = t.policies!.filter((policy) => policy.kind !== "no-self-grading"))));
  assert.deepEqual(refused(grading), ["policy:review-p-no-self-grading: lets a node grade its own work"]);
});

test("a gate that offers fewer answers is held; a gate reworded is not", () => {
  const fewer = refreshSubgrooph(placed(), "review", newer((t) => void Object.assign(t.nodes.find((node) => node.id === "merge-gate")!, { prompt: "Merging now.", options: ["approve"] })));
  assert.deepEqual(refused(fewer), ['node:review-merge-gate.options: the gate would no longer offer "reject with feedback"']);
  assert.equal((fewer.doc.nodes.find((node) => node.id === "review-merge-gate") as { prompt: string }).prompt, "Merging now.", "the list is A-008's: a prompt is shown and applied");
});

test("a tightening after the gate takes: a second gate put after the first leaves no way around it", () => {
  const result = refreshSubgrooph(placed(), "review", newer((t) => {
    t.nodes.push({ id: "release-gate", kind: "human-gate", name: "Release approval", prompt: "Release it?" });
    t.edges.find((edge) => edge.id === "e-merge-gate-done")!.to = "release-gate";
    t.edges.push({ id: "e-release-gate-done", from: "release-gate", to: "done", when: "pass" });
  }));
  assert.deepEqual(result.held, []);
  const doc = written(result.doc);
  assert.deepEqual(doc.edges.filter((edge) => edge.to === "release").map((edge) => edge.from), ["review-release-gate"]);
  assert.deepEqual(errorsOf(doc), []);
});

test("a subgrooph that kept its own stop: a stop renamed is a stop renamed, not one replaced", () => {
  const kept = placeSubgrooph(host(), reviewGate(), { as: "review", values, after: "plan" }).doc;
  const result = refreshSubgrooph(kept, "review", newer((t) => {
    t.nodes.find((node) => node.id === "done")!.id = "finished";
    Object.assign(t.edges.find((edge) => edge.id === "e-merge-gate-done")!, { id: "e-merge-gate-finished", to: "finished" });
  }));
  assert.deepEqual(result.held, []);
  assert.deepEqual(result.notes, []);
  const doc = written(result.doc);
  assert.deepEqual(doc.nodes.filter((node) => node.kind === "stop").map((node) => node.id), ["done", "review-finished"]);
  assert.deepEqual(doc.edges.filter((edge) => edge.from === "review-merge-gate" && edge.when === "pass").map((edge) => edge.to), ["review-finished"]);
});

test("ids under the box's prefix are the subgrooph's: what a person changed there is compared, never doubled, and what is theirs elsewhere is never overwritten", () => {
  // A person drew the planner into the template's loop and lowered its cap. The same version: one loop, as before.
  const drawn = placed();
  const loop = loopOf(drawn, "review-review");
  loop.members.unshift("plan");
  loop.stops = loop.stops.map((stop) => (stop.kind === "max-iterations" ? { ...stop, n: 2 } : stop));
  const again = refreshSubgrooph(drawn, "review", reviewGate());
  assert.deepEqual(names(again.changes).sort(), ["loop:review-review.members", "loop:review-review.stops"]);
  // Both are the person's tightening, and the template's own version would undo both: both are held.
  assert.deepEqual(refused(again), ['loop:review-review.members: the loop "review-review" would no longer bound "plan", which is still in the graph', "loop:review-review.stops: raises the round cap from 2 to 4"]);
  assert.equal(again.doc.loops.filter((l) => l.id === "review-review").length, 1);

  // A person sent the template's edge to a critic of their own inside the box. The same version: one edge, shown.
  const sent = placed();
  sent.nodes.push(agent("security", "critic", "SECURITY.md"));
  sent.edges.push({ id: "e-security-review-merge-gate", from: "security", to: "review-merge-gate", when: "pass" });
  sent.edges.find((edge) => edge.id === "review-e-critic-pass")!.to = "security";
  sent.groups![0]!.members.push("security");
  const back = refreshSubgrooph(sent, "review", reviewGate());
  assert.deepEqual(names(back.changes), ["edge:review-e-critic-pass.to"]);
  assert.equal(back.doc.edges.filter((edge) => edge.id === "review-e-critic-pass").length, 1);

  // A node of the graph's own, outside the box, under an id the newer version needs: refused, not overwritten.
  const outside = placed();
  outside.nodes.push(agent("review-lint", "builder", "LINT.md"));
  const lint = newer((t) => void (t.nodes.push(agent("lint", "builder", "LINT.md")), t.edges.push({ id: "e-builder-lint", from: "builder", to: "lint" })));
  assert.throws(() => refreshSubgrooph(outside, "review", lint), /node "review-lint" needs an id that "plan-review-release" already uses outside the subgrooph "review"/);

  // Another subgrooph whose id begins with this one's prefix keeps its policies: they are not this one's to remove.
  const two: Graph = { ...placed(), groups: [...placed().groups!, { id: "review-two", name: "Second", members: [], from: "review-gate@1" }], policies: [...placed().policies!, { id: "review-two-p-cap", kind: "concurrency-cap", scope: "graph", params: { max: 2 } }] };
  const kept = refreshSubgrooph(two, "review", reviewGate());
  assert.deepEqual(kept.changes, []);
  assert.equal(kept.doc.policies!.some((policy) => policy.id === "review-two-p-cap"), true);
});

test("what is held and what applies never leave a name that points at nothing", () => {
  const wrap = (t: Graph): void => {
    t.nodes.push(agent("wrap", "builder", "WRAP.md"));
    t.edges.push({ id: "e-wrap-done", from: "wrap", to: "done" });
  };
  const noGate = (t: Graph): void => {
    t.nodes = t.nodes.filter((node) => node.id !== "merge-gate");
    t.edges = t.edges.filter((edge) => edge.from !== "merge-gate" && edge.to !== "merge-gate");
    t.edges.push({ id: "e-critic-wrap", from: "critic", to: "wrap", when: "pass" });
    t.loops[0]!.members = ["builder", "critic"];
    t.loops[0]!.back = ["e-critic-fail"];
  };
  const cases: [string, (t: Graph) => void][] = [
    // The gate's removal is held, so the new node waits: a stop that would lead to it waits too.
    ["a stop names a node that waits", (t) => (wrap(t), noGate(t), void (stopsOf(t)[0] = { kind: "bar-passed", then: "wrap" }))],
    // A policy scoped to a node that waits.
    ["a policy names a node that waits", (t) => (wrap(t), noGate(t), void t.policies!.push({ id: "p-cap", kind: "concurrency-cap", scope: "node:wrap", params: { max: 1 } }))],
    // The gate would become an agent: its kind is held, and so is every field that belongs to the other kind.
    ["a gate that would become another kind", (t) => void Object.assign(t.nodes.find((node) => node.id === "merge-gate")!, { ...agent("merge-gate", "builder", "MERGE.md"), name: "Merge" })],
  ];
  for (const [what, change] of cases) {
    const before = placed();
    const result = refreshSubgrooph(before, "review", newer(change));
    const doc = written(result.doc);
    assert.deepEqual(errorsOf(doc), [], what);
    assert.equal(canonicalize({ ...doc, groups: before.groups! }), canonicalize(before), `${what}: nothing but the group's version moved`);
  }
  // The other way about: a cap whose raising is held still names where it led, so the node it names stays.
  const led = newer((t) => (wrap(t), void (stopsOf(t)[1] = { kind: "max-iterations", n: 4, then: "merge-gate" })), 2);
  const before = refreshSubgrooph(placed(), "review", led).doc;
  const result = refreshSubgrooph(before, "review", newer((t) => void (stopsOf(t)[1] = { kind: "max-iterations", n: 9 }), 3));
  assert.deepEqual(refused(result), ["loop:review-review.stops: raises the round cap from 4 to 9"]);
  assert.equal(result.doc.nodes.some((node) => node.id === "review-wrap"), false, "the node the template dropped goes: the held stop does not name it");
  assert.deepEqual(errorsOf(written(result.doc)), []);
});

test("a loop of the graph's own lets go of a node the subgrooph no longer has, and says so", () => {
  const before = placed();
  before.nodes.push({ id: "recheck", kind: "check", name: "Recheck", check: { kind: "command", run: "pnpm test" } } as Node);
  before.edges.push({ id: "e-release-recheck", from: "release", to: "recheck" }, { id: "e-recheck-review-builder", from: "recheck", to: "review-builder", when: "fail" });
  before.loops.push({ id: "redo", name: "Redo", members: ["review-builder", "release", "recheck"], back: ["e-recheck-review-builder"], stops: [{ kind: "max-iterations", n: 2 }] });
  const renamed = newer((t) => {
    t.nodes.find((node) => node.id === "builder")!.id = "implementer";
    for (const edge of t.edges) Object.assign(edge, { from: edge.from === "builder" ? "implementer" : edge.from, to: edge.to === "builder" ? "implementer" : edge.to });
    t.edges.find((edge) => edge.id === "e-builder-critic")!.id = "e-implementer-critic";
    t.loops[0]!.members = ["implementer", "critic", "merge-gate"];
  });
  // The graph's own loop bounded the builder, and under its new name it would not: held, as a loop left a shell
  // with its work done under another name would be. It may well be the same step, and that is for a person to say.
  const held = refreshSubgrooph(before, "review", renamed);
  assert.deepEqual(refusedNames(held), ["node:review-builder"]);
  assert.match(refused(held)[0]!, /removes "review-builder", which the loop "redo" bounded, while "review-implementer" would come in on a round it does not count: it may be the same step under another name/);
  unchanged(before, held.doc);
  // Asked for by name, it applies, and the loop of the graph's own lets go of what is gone, and says so.
  const result = refreshSubgrooph(before, "review", renamed, { allow: ["node:review-builder"] });
  assert.deepEqual(result.held, []);
  assert.deepEqual(loopOf(result.doc, "redo").members, ["release", "recheck"]);
  assert.deepEqual(loopOf(result.doc, "redo").back, []);
  assert.deepEqual(result.notes.filter((note) => note.startsWith("loop")), ['loop "redo" no longer holds "review-builder", "e-recheck-review-builder", removed from the subgrooph: check that the loop still closes']);
});

// ─── a second reader's cases ──────────────────────────────────────────────
//
// The first rewrite judged each change by itself. These got past it by doing in two changes, or under another id,
// or in what is written while something else is held, what one change under the old id would have been held for.
// A brake is now compared on the graph as it would be written, whole (`brakes.ts`).

const unchanged = (before: Graph, after: Graph): void => assert.equal(canonicalize({ ...after, groups: before.groups! }), canonicalize(before), "nothing but the group's version moved");
const refusedNames = (result: { held: { name: string; waits?: string }[] }): string[] => result.held.filter((change) => change.waits === undefined).map((change) => change.name);

test("what an answer at a gate leads to is not changed by an edge added, or by one moved", () => {
  // The gate gains a second way out, on the other answer, to where approval led.
  const added = refreshSubgrooph(placed(), "review", newer((t) => void t.edges.push({ id: "e-also", from: "merge-gate", to: "done", when: "fail" })));
  assert.deepEqual(refused(added), ['edge:e-review-merge-gate-release-2: adds a way into "release" that does not pass "pass" at the human gate "review-merge-gate"']);
  // With its own stop kept: the reject edge is sent to the stop.
  const kept = placeSubgrooph(host(), reviewGate(), { as: "review", values, after: "plan" }).doc;
  const moved = refreshSubgrooph(kept, "review", newer((t) => void (t.edges.find((edge) => edge.id === "e-merge-gate-reject")!.to = "done")));
  assert.deepEqual(refusedNames(moved), ["edge:review-e-merge-gate-reject.to"]);
  assert.match(refused(moved)[0]!, /opens a way into "review-done" that does not pass "pass" at the human gate "review-merge-gate"/);
  unchanged(kept, moved.doc);
});

test("a cycle is not moved out from under its cap, its budget and its bar by a second loop", () => {
  const weak = { name: "Looks fine", inspects: [{ kind: "artifact" as const, ref: "REVIEW.md" }], acceptance: "The critic has no strong objection." };
  // The old loop keeps its stops, over the gate's round only; a new one with a cap of 50 takes the builder and the critic.
  const inner = refreshSubgrooph(placed(), "review", newer((t) => {
    t.loops[0]!.back = ["e-merge-gate-reject"];
    t.loops.push({ id: "inner", name: "Inner", members: ["builder", "critic"], back: ["e-critic-fail"], mode: "judgment", bar: weak, stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 50 }] });
  }));
  assert.deepEqual(refusedNames(inner).sort(), ["loop:review-inner", "loop:review-review.back"]);
  assert.match(refused(inner).join("\n"), /the rounds that "review-e-critic-fail" starts would be counted by "review-inner", not against the stops of "review-review"/);
  unchanged(placed(), inner.doc);
  // Both back edges handed to a new loop; the old one kept by name on two checks that were not there.
  const hollow = refreshSubgrooph(placed(), "review", newer((t) => {
    t.nodes.push({ id: "lint", kind: "check", name: "Lint", check: { kind: "command", run: "pnpm lint" } } as Node, { id: "fmt", kind: "check", name: "Format", check: { kind: "command", run: "pnpm fmt" } } as Node);
    t.edges.push({ id: "e-builder-lint", from: "builder", to: "lint" }, { id: "e-lint-fmt", from: "lint", to: "fmt" }, { id: "e-fmt-lint", from: "fmt", to: "lint", when: "fail" });
    Object.assign(t.loops[0]!, { members: ["lint", "fmt"], back: ["e-fmt-lint"] });
    t.loops.push({ id: "work", name: "Work", members: ["builder", "critic", "merge-gate"], back: ["e-critic-fail", "e-merge-gate-reject"], mode: "judgment", bar: weak, stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 500 }, { kind: "budget", measure: "dispatches", limit: 5000 }] });
  }));
  assert.ok(refusedNames(hollow).includes("loop:review-work") && refusedNames(hollow).includes("loop:review-review.back"));
  assert.match(refused(hollow).join("\n"), /the rounds that "review-e-critic-fail" starts would be counted by "review-work", not against the stops of "review-review"/);
  assert.match(refused(hollow).join("\n"), /the loop "review-review" would keep its stops and bound none of the nodes it did/);
  unchanged(placed(), hollow.doc);
});

test("a cap that led to a stop that halts: the stop does not become something else", () => {
  const led = newer((t) => {
    t.nodes.push({ id: "halted", kind: "stop", name: "Halted", outcome: "halt" });
    stopsOf(t)[1] = { kind: "max-iterations", n: 4, then: "halted" };
    stopsOf(t)[2] = { kind: "budget", measure: "dispatches", limit: 10, then: "halted" };
  }, 2);
  const second = refreshSubgrooph(placed(), "review", led);
  assert.deepEqual(second.held, [], "a cap that leads to a halting stop still halts");
  const retry = refreshSubgrooph(second.doc, "review", newer((t) => {
    t.nodes[t.nodes.findIndex((node) => node.id === "halted")] = { ...agent("halted", "builder", "RETRY.md"), name: "Try again" };
    t.edges.push({ id: "e-halted-builder", from: "halted", to: "builder" });
  }, 3, led));
  // What it was, and what made it halt: both are what the cap leaned on. And the edge that leads back from it: a
  // way round the loop's nodes that its stops do not count.
  assert.deepEqual(refusedNames(retry), ["node:review-halted.kind", "node:review-halted.outcome", "edge:e-review-halted-review-builder"]);
  assert.match(refused(retry).join("\n"), /"e-review-halted-review-builder" \(review-halted → review-builder\) would make a way round the nodes of "review-review" that its stops do not count/);
  assert.match(refused(retry)[0]!, /the round cap \(4\) would no longer halt the run; the budget \(10 dispatches\) would no longer halt the run/);
  unchanged(second.doc, retry.doc);
  const success = refreshSubgrooph(second.doc, "review", newer((t) => void ((t.nodes.find((node) => node.id === "halted") as { outcome: string }).outcome = "success"), 3, led));
  assert.deepEqual(refusedNames(success), ["node:review-halted.outcome"]);
});

test("a brake that leads on is a brake: it is not raised, dropped or led elsewhere unasked", () => {
  // The built-in retrospective: its round cap and its budget both lead on to the retrospective step.
  const retro = pattern("retrospective-rewrite");
  const before = placeSubgrooph(host(), retro, { as: "s", values: examples(retro), after: "plan", then: "release" }).doc;
  const stops = (t: Graph): Loop["stops"] => t.loops.find((loop) => loop.id === "grind")!.stops;
  const cases: [string, (t: Graph) => void, RegExp][] = [
    ["its budget dropped", (t) => void stops(t).splice(1, 1), /removes the budget \(30 minutes\)/],
    ["its cap raised", (t) => void ((stops(t)[0] as { n: number }).n = 50), /raises the round cap from 5 to 50/],
    ["its cap led back into the loop", (t) => void ((stops(t)[0] as { then: string }).then = "builder"), /the round cap would lead on to "s-builder", not to "s-retro"/],
  ];
  for (const [what, change, why] of cases) {
    const result = refreshSubgrooph(before, "s", newer(change, 99, retro));
    assert.deepEqual(refusedNames(result), ["loop:s-grind.stops"], what);
    assert.match(refused(result)[0]!, why, what);
    unchanged(before, result.doc);
  }

  // The built-in merge queue: a node of its loop renamed, so that the edge that starts a round has a new id, and the
  // cap dropped in the same version. The loop is still the loop.
  const queue = pattern("merge-queue");
  const queued = placeSubgrooph(host(), queue, { as: "q", values: examples(queue), after: "plan", then: "release" }).doc;
  const renamed = refreshSubgrooph(queued, "q", newer((t) => {
    const to = (id: string): string => (id === "integrate" ? "integrator" : id);
    for (const node of t.nodes) node.id = to(node.id);
    for (const edge of t.edges) Object.assign(edge, { from: to(edge.from), to: to(edge.to) });
    for (const loop of t.loops) Object.assign(loop, { members: loop.members.map(to), stops: loop.stops.filter((stop) => stop.kind !== "max-iterations") });
  }, 99, queue));
  assert.match(refused(renamed).join("\n"), /loop:q-queue\.stops: removes the round cap \(4\)/);
  // The node renamed is a check, and a check under another id is a check removed (amendment A-019): held as well.
  assert.match(refused(renamed).join("\n"), /node:q-integrate: removes a check/);
  unchanged(queued, renamed.doc);
  // A reason is said once on a line, also where it quotes a command that holds "; " (reasons are joined by that).
  const quoted = refreshSubgrooph(queued, "q", newer((t) => {
    const to = (id: string): string => (id === "integrate" ? "integrator" : id);
    for (const node of t.nodes) {
      if (node.kind === "check" && node.id === "integrate") node.check = { ...node.check, run: "git merge --no-ff; true" };
      node.id = to(node.id);
    }
    for (const edge of t.edges) Object.assign(edge, { from: to(edge.from), to: to(edge.to) });
    for (const loop of t.loops) Object.assign(loop, { members: loop.members.map(to) });
  }, 99, queue));
  const said = quoted.changes.find((change) => change.name === "node:q-integrate")!.loosens!;
  assert.match(said, /removes a check, while a check the graph has not comes in \("q-integrator": runs "git merge --no-ff; true"/);
  assert.equal(said.split("removes a check, while").length - 1, 1, said);
  // Asked for by name, the renaming applies; the cap, which was not asked for, stays.
  const asked = refreshSubgrooph(queued, "q", newer((t) => {
    const to = (id: string): string => (id === "integrate" ? "integrator" : id);
    for (const node of t.nodes) node.id = to(node.id);
    for (const edge of t.edges) Object.assign(edge, { from: to(edge.from), to: to(edge.to) });
    for (const loop of t.loops) Object.assign(loop, { members: loop.members.map(to), stops: loop.stops.filter((stop) => stop.kind !== "max-iterations") });
  }, 99, queue), { allow: refusedNames(renamed).filter((name) => name !== "loop:q-queue.stops") });
  assert.deepEqual(refusedNames(asked), ["loop:q-queue.stops"], refused(asked).join("\n"));
  assert.equal(asked.doc.nodes.some((node) => node.id === "q-integrator"), true);
  assert.deepEqual(loopOf(asked.doc, "q-queue").stops, loopOf(queued, "q-queue").stops);
  assert.deepEqual(errorsOf(written(asked.doc)), []);
});

test("a step behind a person does not come back under another name in front of them", () => {
  // The review gate with a step after the gate that carries no mark. It returns as another node, reached from the critic.
  const tagged = newer((t) => {
    t.nodes.push({ ...agent("tag", "builder", "TAG.md"), brief: "Tag the merged commit and push the tag." } as Node);
    t.edges.find((edge) => edge.id === "e-merge-gate-done")!.to = "tag";
    t.edges.push({ id: "e-tag-done", from: "tag", to: "done" });
  }, 1);
  const before = placeSubgrooph(host(), tagged, { as: "review", values, after: "plan", then: "release" }).doc;
  const renamed = refreshSubgrooph(before, "review", newer((t) => {
    t.nodes.find((node) => node.id === "tag")!.id = "tagger";
    t.edges = t.edges.filter((edge) => edge.id !== "e-tag-done");
    t.edges.find((edge) => edge.id === "e-merge-gate-done")!.to = "done";
    t.edges.push({ id: "e-critic-tagger", from: "critic", to: "tagger", when: "pass" });
  }, 2, tagged));
  assert.match(refused(renamed).join("\n"), /node:review-tag: removes "review-tag", which a run reached only by passing a person, while "review-tagger" would come in with no such need: it may be the same step under another name/);
  unchanged(before, renamed.doc);

  // A built-in with no gate of its own, behind a gate of the graph's that is one step upstream. Every node renamed.
  const grind = pattern("grind-loop");
  const gated: Graph = { ...host(), nodes: [...host().nodes, { id: "go", kind: "human-gate", name: "Go", prompt: "Start the work?" }, agent("prep", "planner", "PREP.md")], edges: [...host().edges, { id: "e-plan-go", from: "plan", to: "go" }, { id: "e-go-prep", from: "go", to: "prep", when: "pass" }] };
  const inGraph = placeSubgrooph(gated, grind, { as: "g", values: examples(grind), after: "prep" }).doc;
  const all = refreshSubgrooph(inGraph, "g", newer((t) => {
    const map = Object.fromEntries(t.nodes.map((node) => [node.id, `${node.id}2`]));
    for (const node of t.nodes) node.id = map[node.id]!;
    for (const edge of t.edges) Object.assign(edge, { from: map[edge.from], to: map[edge.to], id: `${edge.id}-2` });
    for (const loop of t.loops) Object.assign(loop, { members: loop.members.map((m) => map[m]), back: loop.back.map((b) => `${b}-2`), stops: loop.stops.map((stop) => (stop.then ? { ...stop, then: map[stop.then] } : stop)) });
  }, 99, grind));
  assert.ok(refusedNames(all).length > 0);
  assert.match(refused(all).join("\n"), /which a run reached only by passing a person, while .* would come in with no such need/);
  unchanged(inGraph, all.doc);
});

test("what a critic is handed, and what its verdict decides, are held however the edges are named", () => {
  // The edge into the critic comes back under another id with one piece of evidence.
  const less = refreshSubgrooph(placed(), "review", newer((t) => void Object.assign(t.edges.find((edge) => edge.id === "e-builder-critic")!, { id: "to-critic", evidence: ["CHANGES.md"] })));
  assert.match(refused(less).join("\n"), /the critic would no longer be handed "diff of the change"/);
  unchanged(placed(), less.doc);
  // The critic's pass is removed and the builder leads to the gate itself.
  const around = refreshSubgrooph(placed(), "review", newer((t) => {
    t.edges = t.edges.filter((edge) => edge.id !== "e-critic-pass");
    t.edges.push({ id: "e-builder-merge-gate", from: "builder", to: "merge-gate" });
  }));
  assert.deepEqual(refused(around), ['edge:e-review-builder-review-merge-gate: adds a way into "review-merge-gate" that does not pass the critic "review-critic"']);
  unchanged(placed(), around.doc);
  // Its verdict made to lead on whatever it is.
  const always = refreshSubgrooph(placed(), "review", newer((t) => {
    t.edges.find((edge) => edge.id === "e-critic-pass")!.when = "always";
    t.edges = t.edges.filter((edge) => edge.id !== "e-critic-fail");
    t.loops[0]!.back = ["e-merge-gate-reject"];
  }));
  assert.ok(refusedNames(always).includes("edge:review-e-critic-pass.when"));
  // The evidence moved to another edge into the critic, from another node: what the builder hands it is still less.
  const elsewhere = refreshSubgrooph(placed(), "review", newer((t) => {
    const edge = t.edges.find((e) => e.id === "e-builder-critic")!;
    t.edges.push({ id: "e-merge-gate-recheck", from: "merge-gate", to: "critic", when: { verdict: "recheck" }, evidence: edge.evidence!.slice(0, 3) });
    edge.evidence = edge.evidence!.slice(3);
    t.loops[0]!.back.push("e-merge-gate-recheck");
  }));
  assert.ok(refusedNames(elsewhere).includes("edge:e-review-builder-review-critic.evidence"));
  assert.match(refused(elsewhere).join("\n"), /the critic would no longer be handed "diff of the change", .* by "review-builder"/);
});

test("a round belongs to the loop that bounded it: a loop is not split in two, nor a second way round counted elsewhere", () => {
  // One loop made two with the same cap and budget each: twice the rounds.
  const split = refreshSubgrooph(placed(), "review", newer((t) => {
    const loop = t.loops[0]!;
    t.loops.push({ ...structuredClone(loop), id: "approval", name: "Approval", back: ["e-merge-gate-reject"] });
    loop.back = ["e-critic-fail"];
  }));
  assert.match(refused(split).join("\n"), /loop:review-review\.back: the rounds that "review-e-merge-gate-reject" starts would be counted by "review-approval", not against the stops of "review-review"/);
  unchanged(placed(), split.doc);
  // A second edge back from the critic to the builder, counted by a new loop with a cap of 100.
  const second = refreshSubgrooph(placed(), "review", newer((t) => {
    t.edges.push({ id: "e-critic-retry", from: "critic", to: "builder", when: { verdict: "needs-work" }, evidence: ["REVIEW.md"] });
    t.loops.push({ id: "retry", name: "Retry", members: ["builder", "critic"], back: ["e-critic-retry"], bar: { name: "Any", inspects: [{ kind: "artifact", ref: "REVIEW.md" }], acceptance: "The critic says so." }, stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 100 }] });
  }));
  assert.match(refused(second).join("\n"), /a round between "review-critic" and "review-builder", which the loop "review-review" bounds, would be counted by "review-retry" and not against its stops/);
  unchanged(placed(), second.doc);
});

test("a run does not come to end in success without the person or the critic it had to pass", () => {
  // With its own stop kept: a second stop, straight from the builder.
  const kept = placeSubgrooph(host(), reviewGate(), { as: "review", values, after: "plan" }).doc;
  const early = refreshSubgrooph(kept, "review", newer((t) => {
    t.nodes.push({ id: "done2", kind: "stop", name: "Done early", outcome: "success" });
    t.edges.push({ id: "e-builder-done2", from: "builder", to: "done2" });
  }));
  assert.match(refused(early).join("\n"), /edge:e-review-builder-review-done2: adds a way from "review-builder" to end in success that does not pass a person/);
  unchanged(kept, early.doc);
  // A stop that halted, reached before the gate, comes to end in success.
  const bail = newer((t) => {
    t.nodes.push({ id: "bail", kind: "stop", name: "Bail", outcome: "halt" });
    t.edges.push({ id: "e-critic-bail", from: "critic", to: "bail", when: { verdict: "invalid-evidence" } });
  }, 1);
  const before = placeSubgrooph(host(), bail, { as: "review", values, after: "plan", then: "release" }).doc;
  const turned = refreshSubgrooph(before, "review", newer((t) => void ((t.nodes.find((node) => node.id === "bail") as { outcome: string }).outcome = "success"), 2, bail));
  assert.deepEqual(refusedNames(turned), ["node:review-bail.outcome"]);
  assert.match(refused(turned)[0]!, /a run could end in success at "review-bail", a way that does not pass a person/);
});

test("what lies beyond a critic by its loop's bar is behind the critic: an edge around it is held", () => {
  // The built-in gauntlet: its pieces loop leads on, once its bar is passed, to the integrator. An edge from the
  // owner straight there goes around the critic whose verdict the bar is.
  const gauntlet = pattern("gauntlet-decomposed");
  const before = placeSubgrooph(host(), gauntlet, { as: "g", values: examples(gauntlet), after: "plan", then: "release" }).doc;
  const skip = refreshSubgrooph(before, "g", newer((t) => void t.edges.push({ id: "e-skip", from: "owner", to: "integrator" }), 99, gauntlet));
  assert.deepEqual(refusedNames(skip), ["edge:g-e-skip"]);
  assert.match(refused(skip)[0]!, /adds a way into "g-integrator" that does not pass the critic "g-critic"/);
});

test("an answer a gate gives does not come to lead nowhere; a note on a policy is not a loosening", () => {
  const nowhere = refreshSubgrooph(placed(), "review", newer((t) => {
    t.edges = t.edges.filter((edge) => edge.id !== "e-merge-gate-reject");
    t.loops[0]!.back = ["e-critic-fail"];
  }));
  assert.match(refused(nowhere).join("\n"), /edge:review-e-merge-gate-reject: "fail" at the human gate "review-merge-gate" would lead nowhere/);
  // A key the comparison does not know, on a policy that is a brake: its kind, scope and params are what it is.
  const noted = refreshSubgrooph(placed(), "review", newer((t) => (void ((t.policies![0] as unknown as { note: string }).note = "see docs"), void ((t.nodes[0] as { brief: string }).brief += " Keep it small."))));
  assert.deepEqual(noted.held, []);
});

test("the refresh still takes a step only a loop's stop continues at for a start, which is wider than graph-ir §2 (#88): it is held", () => {
  // The built-in decomposed gauntlet: `integrator` is where the pieces loop continues when its bar is passed, and
  // also where a failed "next piece" check leads. A newer version drops that edge, so only the stop leads there.
  // By graph-ir §2 no run starts there: the lead is not told to, and the loop is behind the decomposition gate.
  // The comparison keeps its own, older rule (`startsOf` in reach.ts) until it has been read by a second harness,
  // and holds the change. Whether it may apply is the first thing that reading should rule on.
  const gauntlet = pattern("gauntlet-decomposed");
  const before = placeSubgrooph(host(), gauntlet, { as: "g", values: examples(gauntlet), after: "plan", then: "release" }).doc;
  const dropped = refreshSubgrooph(before, "g", newer((t) => void (t.edges = t.edges.filter((edge) => edge.id !== "e-next-piece-fail")), 2, gauntlet));
  assert.deepEqual(refusedNames(dropped), ["edge:g-e-next-piece-fail"]);
  assert.match(refused(dropped)[0]!, /nothing would lead to "g-integrator", so a run would start there/);
  unchanged(before, dropped.doc);

  // Asked for by name, it applies, and the graph it leaves starts where it did: the package would say the same.
  const allowed = refreshSubgrooph(before, "g", newer((t) => void (t.edges = t.edges.filter((edge) => edge.id !== "e-next-piece-fail")), 2, gauntlet), { allow: ["edge:g-e-next-piece-fail"] });
  assert.deepEqual(allowed.held, []);
  assert.deepEqual(entryNodeIds(indexGraph(allowed.doc)), entryNodeIds(indexGraph(before)));
  assert.deepEqual(errorsOf(allowed.doc), errorsOf(before));
});

test("a fourth reader's cases, found through adoption and open to a refresh as well: a way round the loop's stops do not count, a twin beside an approval", () => {
  // A newer version gives the critic a second way back to the builder, through a new step, and counts it in a
  // second loop with a cap of 1000. The review loop's own cap of 4 no longer bounds its builder and critic.
  const second = refreshSubgrooph(placed(), "review", newer((t) => {
    t.nodes.push(agent("fixer", "builder", "FIX.md"));
    t.edges.push({ id: "x-critic-fixer", from: "critic", to: "fixer", when: { verdict: "revise" } }, { id: "x-fixer-builder", from: "fixer", to: "builder", evidence: ["REVIEW.md"] });
    t.loops.push({ id: "revise", name: "Revise", members: ["builder", "critic", "fixer"], back: ["x-fixer-builder"], mode: "judgment", bar: structuredClone(t.loops[0]!.bar!), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 1000 }] });
  }));
  assert.match(refused(second).join("\n"), /would make a way round the nodes of "review-review" that its stops do not count/);
  for (const name of ["edge:review-x-critic-fixer", "edge:review-x-fixer-builder"]) assert.ok(refusedNames(second).includes(name), `${name}: ${refusedNames(second).join(", ")}`);
  unchanged(placed(), second.doc);

  // A stop of another measure, set first, that leads back in: the cap and the budget never get their turn.
  const first = refreshSubgrooph(placed(), "review", newer((t) => void stopsOf(t).splice(1, 0, { kind: "budget", measure: "minutes", limit: 0, then: "builder" })));
  assert.deepEqual(refusedNames(first), ["loop:review-review.stops"]);
  assert.match(refused(first)[0]!, /would lead back to "review-builder": a way round the nodes of "review-review" that its stops do not count/);

  // A person in this graph asked for approval on the critic's way back. A newer version adds a second edge beside it.
  const approved = placed();
  approved.edges.find((edge) => edge.id === "review-e-critic-fail")!.approval = true;
  const twin = refreshSubgrooph(approved, "review", newer((t) => {
    t.edges.push({ id: "x-critic-fail-again", from: "critic", to: "builder", when: "fail", evidence: ["REVIEW.md"] });
    t.loops[0]!.back.push("x-critic-fail-again");
  }));
  assert.match(refused(twin).join("\n"), /"review-x-critic-fail-again" would lead from "review-critic" to "review-builder" beside "review-e-critic-fail", which needs a person's approval, and need none/);

  // What is not held is said: a stop where a person is asked, that continues inside the loop. The person is the
  // brake there, and the cap comes to count the rounds between two of their answers.
  const asks = refreshSubgrooph(placed(), "review", newer((t) => void stopsOf(t).push({ kind: "human", every: 2, then: "builder" })));
  assert.deepEqual(asks.held, []);
  assert.match(asks.notes.join("\n"), /the loop "review-review": the round cap \(4\) and the budget \(10 dispatches\) would count the rounds between two of a person's decisions, and no longer the whole run\. A way round its nodes that they do not count is opened each time by the stop where a person is asked, which continues at "review-builder"/);
});

test("allowing one change does not let another through: each way that opens is named", () => {
  // Two steps behind the gate. The newer version lets the critic reach the first, and the first lead to the second.
  const two = newer((t) => {
    (t.nodes.find((node) => node.id === "merge-gate") as { options: string[] }).options = ["approve", "reject with feedback", "hotfix"];
    t.nodes.push(agent("tag", "builder", "TAG.md"), agent("hotfix", "builder", "HOTFIX.md"));
    t.edges.find((edge) => edge.id === "e-merge-gate-done")!.to = "tag";
    t.edges.push({ id: "e-tag-done", from: "tag", to: "done" }, { id: "e-merge-gate-hotfix", from: "merge-gate", to: "hotfix", when: { verdict: "hotfix" } }, { id: "e-hotfix-done", from: "hotfix", to: "done" });
  }, 1);
  const before = placeSubgrooph(host(), two, { as: "review", values, after: "plan", then: "release" }).doc;
  const next = newer((t) => void t.edges.push({ id: "e-critic-tag", from: "critic", to: "tag", when: { verdict: "trivial" } }, { id: "e-tag-hotfix", from: "tag", to: "hotfix", when: "fail" }), 2, two);
  assert.deepEqual(refusedNames(refreshSubgrooph(before, "review", next)).sort(), ["edge:e-review-critic-review-tag", "edge:e-review-tag-review-hotfix"]);
  const one = refreshSubgrooph(before, "review", next, { allow: ["edge:e-review-critic-review-tag"] });
  assert.deepEqual(refusedNames(one), ["edge:e-review-tag-review-hotfix"]);
  unchanged(before, one.doc);
  assert.deepEqual(refreshSubgrooph(before, "review", next, { allow: ["edge:e-review-critic-review-tag", "edge:e-review-tag-review-hotfix"] }).held, []);
});

test("what is held is judged on the graph that is written, not on the one the whole newer version would make", () => {
  const cases: [string, (t: Graph) => void][] = [
    // The critic's role is held, so it is still a critic: the evidence it is handed is held too.
    ["a critic kept, handed less", (t) => (void ((t.nodes.find((node) => node.id === "critic") as { role: unknown }).role = { custom: "reviewer" }), void (t.edges.find((edge) => edge.id === "e-builder-critic")!.evidence = ["CHANGES.md"]))],
    // The critic becomes a check under its own id: its kind goes with its role.
    ["a critic made a check", (t) => void (t.nodes[t.nodes.findIndex((node) => node.id === "critic")] = { id: "critic", kind: "check", name: "Tests", check: { kind: "command", run: "pnpm test" } } as Node)],
    // The edge off the critic is held at its start; its `always` is held with it.
    ["an edge off the critic", (t) => void Object.assign(t.edges.find((edge) => edge.id === "e-critic-pass")!, { from: "builder", when: "always" })],
  ];
  for (const [what, change] of cases) {
    const result = refreshSubgrooph(placed(), "review", newer(change));
    assert.ok(refusedNames(result).length > 0, what);
    unchanged(placed(), result.doc);
    assert.deepEqual(errorsOf(written(result.doc)), [], what);
  }
  // A cap is led on to a node that would be a gate, were its kind not held with the rest of the shape.
  const triage = newer((t) => (t.nodes.push(agent("triage", "builder", "TRIAGE.md")), void t.edges.push({ id: "e-triage-builder", from: "triage", to: "builder" })), 2);
  const before = refreshSubgrooph(placed(), "review", triage, { allow: [] }).doc;
  const result = refreshSubgrooph(before, "review", newer((t) => {
    t.nodes[t.nodes.findIndex((node) => node.id === "triage")] = { id: "triage", kind: "human-gate", name: "Triage", prompt: "Go on?" };
    stopsOf(t)[1] = { kind: "max-iterations", n: 4, then: "triage" };
    t.edges.push({ id: "e-critic-done", from: "critic", to: "done", when: { verdict: "trivial" } });
  }, 3, triage));
  assert.deepEqual(loopOf(result.doc, "review-review").stops, loopOf(before, "review-review").stops, "the cap still halts: the node it would lead to is still an agent");
});

test("an honest update is not held: a new stop that leads on, a check put in, a gate that gains an answer, a lower cap", () => {
  const cases: [string, (t: Graph) => void][] = [
    ["a new stop where a person is asked, that leads back", (t) => void stopsOf(t).push({ kind: "human", every: 2, then: "builder" })],
    ["a check between the builder and the critic", (t) => {
      t.nodes.push({ id: "lint", kind: "check", name: "Lint", check: { kind: "command", run: "pnpm lint" } } as Node);
      Object.assign(t.edges.find((edge) => edge.id === "e-builder-critic")!, { to: "lint" });
      t.edges.push({ id: "e-lint-critic", from: "lint", to: "critic", when: "pass", evidence: t.edges.find((edge) => edge.id === "e-builder-critic")!.evidence! });
      t.loops[0]!.members.push("lint");
    }],
    ["a gate that gains an answer", (t) => {
      (t.nodes.find((node) => node.id === "merge-gate") as { options: string[] }).options.push("defer");
      t.edges.push({ id: "e-gate-defer", from: "merge-gate", to: "builder", when: { verdict: "defer" } });
      t.loops[0]!.back.push("e-gate-defer");
    }],
    ["a cap and a budget lowered, a brief reworded", (t) => {
      stopsOf(t)[1] = { kind: "max-iterations", n: 3 };
      stopsOf(t)[2] = { kind: "budget", measure: "dispatches", limit: 8 };
      (t.nodes[0] as { brief: string }).brief += " Keep it small.";
    }],
  ];
  for (const [what, change] of cases) assert.deepEqual(refused(refreshSubgrooph(placed(), "review", newer(change))), [], what);
  // A second cap, lower, that leads back while the first still halts, is not among them: which of the two a run
  // obeys at the second round is the lead's reading, so it is held and said.
  assert.deepEqual(refused(refreshSubgrooph(placed(), "review", newer((t) => void stopsOf(t).push({ kind: "max-iterations", n: 2, then: "builder" })))), [
    'loop:review-review.stops: the round cap of 2 that leads on to "review-builder" would fire before the one of 4 that halts the run; a stop of the loop "review-review" would lead back to "review-builder": a way round the nodes of "review-review" that its stops do not count; the round cap of 2 that leads on to "review-builder" would come into the loop, and could fire before the round cap of 4 that halts the run',
  ]);
  // The graph has the template's graph-wide policy under an id of its own as well: the same version changes nothing.
  const twice: Graph = { ...placed(), policies: [...placed().policies!, { id: "p-own-isolation", kind: "critic-isolation", scope: "graph" }] };
  assert.deepEqual(refreshSubgrooph(twice, "review", reviewGate()).changes, []);
});

test("what a refresh leaves for a person to do, it says: a name left pointing at nothing, a new start, an older version", () => {
  // The graph's own loop leads on to the template's builder, its bar is keyed from it, and a policy is scoped to it.
  const before = placed();
  before.nodes.push({ id: "recheck", kind: "check", name: "Recheck", check: { kind: "command", run: "pnpm test" } } as Node);
  before.edges.push({ id: "e-release-recheck", from: "release", to: "recheck" }, { id: "e-recheck-release", from: "recheck", to: "release", when: "fail" });
  before.loops.push({ id: "redo", name: "Redo", members: ["release", "recheck"], back: ["e-recheck-release"], bar: { name: "Bar", inspects: [{ kind: "answer-key", ref: "CHANGES.md" }], acceptance: "ok", answerKeyFrom: "review-builder" }, stops: [{ kind: "max-iterations", n: 2 }, { kind: "evidence-invalid", rounds: 1, then: "review-builder" }] } as Loop);
  before.policies!.push({ id: "p-own", kind: "owner-per-artifact", scope: "node:review-builder" });
  before.layout = { "review-builder": { x: 1, y: 2 }, plan: { x: 0, y: 0 } };
  const renamed = newer((t) => {
    t.nodes.find((node) => node.id === "builder")!.id = "implementer";
    for (const edge of t.edges) Object.assign(edge, { from: edge.from === "builder" ? "implementer" : edge.from, to: edge.to === "builder" ? "implementer" : edge.to });
    t.edges.find((edge) => edge.id === "e-builder-critic")!.id = "e-implementer-critic";
    t.loops[0]!.members = ["implementer", "critic", "merge-gate"];
  });
  const result = refreshSubgrooph(before, "review", renamed);
  assert.deepEqual(result.held, []);
  assert.deepEqual(result.notes, [
    'edge "e-plan-review-builder" (plan → review-builder) is removed with the node it led to: reconnect what it joined',
    'loop "redo" still names "review-builder", which the newer version no longer has: point it at what took its place',
    'policy "p-own" still names "review-builder", which the newer version no longer has: point it at what took its place',
    'the newer version starts at "review-implementer" too, and nothing in this graph leads to it: a run would begin there. Lead into it from where the subgrooph is entered',
  ]);
  assert.deepEqual(result.doc.layout, { plan: { x: 0, y: 0 } });

  // An edge that pointed at nothing before the refresh is not the refresh's to remove, and it says nothing of it.
  const dangling = placed();
  dangling.edges.push({ id: "e-x", from: "plan", to: "nowhere" });
  const same = refreshSubgrooph(dangling, "review", reviewGate());
  assert.deepEqual(same.notes, []);
  assert.equal(same.doc.edges.some((edge) => edge.id === "e-x"), true);

  // The version found is older than the one the subgrooph was placed from.
  const third = { ...placed(), groups: [{ ...placed().groups![0]!, from: "review-gate@3" as const }] };
  assert.deepEqual(refreshSubgrooph(third, "review", reviewGate()).notes, ['this is version 1 of "review-gate", older than the version 3 the subgrooph was placed from: the changes below lead back to it']);
});

// ─── saving a group as a template ─────────────────────────────────────────

test("any group can be saved as a template: its nodes, the edges and loops between them, and not itself", () => {
  const meta = { id: "my-review", title: "My review", summary: "A review gate as this project runs it.", whenToUse: "Before a release." };
  const template = extractGroup(placed(), "review", meta);
  assert.equal(template.template!.kind, "fragment");
  assert.deepEqual(
    template.nodes.map((node) => node.id),
    ["review-builder", "review-critic", "review-merge-gate"],
  );
  assert.equal(template.edges.length, 4, "the edges between them; the ones that led in and out stay behind");
  assert.deepEqual(template.loops.map((loop) => loop.id), ["review-review"]);
  assert.equal(template.groups, undefined);
  assert.deepEqual(validate(template).filter((issue) => issue.severity === "error"), []);

  // A group that holds groups keeps the ones inside it.
  const nested = { ...placed(), groups: [...placed().groups!, { id: "delivery", name: "Review and release", members: ["review", "release"] }] };
  const outer = extractGroup(nested, "delivery", { ...meta, id: "delivery" });
  assert.equal(outer.id, "delivery", "a template may be named after the group it was made from");
  assert.deepEqual(outer.groups!.map((group) => group.id), ["review"]);
  assert.equal(outer.groups![0]!.from, "review-gate@1");
  assert.throws(() => extractGroup({ ...placed(), groups: [{ id: "empty", name: "Empty", members: [] }] }, "empty", meta), /holds no node/);
});

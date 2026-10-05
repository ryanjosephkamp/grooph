/**
 * Adoption held to the graph's brakes (`adoption.ts`; amendment A-008, decision 0008): a run's working copy may
 * tighten a brake and never loosen one, and what adoption would write is compared with the source by the comparison
 * a subgrooph's refresh is held to.
 *
 * The source is the fixture the rest of slice 0085 uses: the built-in review gate (round cap 4, budget 10
 * dispatches, a human gate before the release step) between a planner and a release step. The audit of 0.3.0's
 * claims found the fault on those numbers: a working copy with 40 and 400 was adopted as version 2.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { checkAdoption, type AdoptionCheck } from "../src/adoption.js";
import { parseGraphText } from "../src/parse.js";
import { adoptWorkingCopy } from "../src/runs.js";
import type { Graph, Loop, Node } from "../src/types.js";
import { read, repoRoot } from "./helpers.js";

const source = (change: (doc: Graph) => void = () => {}): Graph => {
  const doc = parseGraphText(read(join(repoRoot, "fixtures/valid/subgrooph-in-a-graph.grooph.json"))).doc!;
  change(doc);
  return doc;
};
/** What a run left: the source, changed. Adopted as adoption would write it, and held to the source's brakes. */
const adopt = (change: (working: Graph) => void, options: { allow?: string[]; from?: Graph } = {}): AdoptionCheck => {
  const from = options.from ?? source();
  const working = structuredClone(from);
  change(working);
  const adopted = adoptWorkingCopy(from, working, { run: "r" });
  assert.ok(adopted.ok, adopted.ok ? "" : adopted.message);
  return checkAdoption(from, adopted.doc, options.allow ? { allow: options.allow } : {});
};
const refused = (check: AdoptionCheck): string[] => check.refused.map((change) => `${change.name}: ${change.loosens}`);
const names = (check: AdoptionCheck): string[] => check.refused.map((change) => change.name);
const loop = (doc: Graph): Loop => doc.loops.find((l) => l.id === "review-review")!;
const node = (doc: Graph, id: string): Node => doc.nodes.find((n) => n.id === id)!;
const stops = (doc: Graph, change: (stop: Loop["stops"][number]) => Loop["stops"][number] | undefined): void => {
  loop(doc).stops = loop(doc).stops.flatMap((stop) => change(stop) ?? []);
};
const agent = (id: string, role: string): Node => ({ id, kind: "agent", name: id, role, brief: `${id}: do the work.`, outputs: [`${id}.md`], allow: ["read-files", "write-outputs"] }) as Node;

test("the audit's probe: a round cap raised from 4 to 40 and a budget from 10 to 400 are refused, by name, and taken when asked for", () => {
  const raise = (working: Graph): void => stops(working, (stop) => (stop.kind === "max-iterations" ? { ...stop, n: 40 } : stop.kind === "budget" ? { ...stop, limit: 400 } : stop));
  const check = adopt(raise);
  assert.deepEqual(refused(check), ["loop:review-review.stops: raises the round cap from 4 to 40; raises the budget from 10 to 400 dispatches"]);
  assert.deepEqual(check.unknown, []);

  const asked = adopt(raise, { allow: ["loop:review-review.stops"] });
  assert.deepEqual(asked.refused, []);
  assert.equal(asked.changes[0]!.loosens, "raises the round cap from 4 to 40; raises the budget from 10 to 400 dispatches", "what was allowed is still said");

  // A name that is no change of this run is said, and allows nothing.
  const wrong = adopt(raise, { allow: ["loop:review-review.bar", "node:nobody"] });
  assert.deepEqual(names(wrong), ["loop:review-review.stops"]);
  assert.deepEqual(wrong.unknown, ["loop:review-review.bar", "node:nobody"]);
});

test("a working copy that changes no brake is adopted with nothing refused, and one that changes nothing has no changes", () => {
  assert.deepEqual(adopt(() => {}).changes, []);
  const reworded = adopt((working) => {
    (node(working, "review-builder") as { brief: string }).brief = "Build it, and say what you tried.";
    working.nodes.push(agent("notes", "builder"));
    working.edges.push({ id: "e-release-notes", from: "release", to: "notes" });
    working.description = "With release notes.";
  });
  assert.deepEqual(reworded.refused, []);
  assert.deepEqual(reworded.changes.map((change) => `${change.kind} ${change.name}`), ["change node:review-builder.brief", "add node:notes", "add edge:e-release-notes", "change graph:description"]);
});

test("every brake on amendment A-008's list is refused when a working copy removes or loosens it", () => {
  // A source that has one of each: an approval, an irreversible marker, a level that is not the default.
  const full = source((doc) => {
    doc.edges.find((edge) => edge.id === "e-plan-review-builder")!.approval = true;
    (node(doc, "release") as { irreversible?: string[] }).irreversible = ["publish"];
    doc.adaptation = "fixed";
    loop(doc).stops.push({ kind: "human", every: 2 });
  });
  const cases: [string, (working: Graph) => void, string[], RegExp][] = [
    ["a human gate removed", (w) => {
      w.nodes = w.nodes.filter((n) => n.id !== "review-merge-gate");
      w.edges = w.edges.filter((e) => e.from !== "review-merge-gate" && e.to !== "review-merge-gate");
      w.edges.push({ id: "e-critic-release", from: "review-critic", to: "release", when: "pass", approval: true });
      loop(w).members = ["review-builder", "review-critic"];
      loop(w).back = ["review-e-critic-fail"];
      w.groups!.find((g) => g.id === "review")!.members = ["review-builder", "review-critic"];
    }, ["node:review-merge-gate"], /removes a human gate/],
    ["a human gate that offers fewer answers", (w) => void ((node(w, "review-merge-gate") as { options?: string[] }).options = ["approve"]), ["node:review-merge-gate.options"], /the gate would no longer offer/],
    ["an approval removed", (w) => void delete w.edges.find((e) => e.id === "e-plan-review-builder")!.approval, ["edge:e-plan-review-builder.approval"], /removes a person's approval from the edge/],
    ["an irreversible marker removed", (w) => void delete (node(w, "release") as { irreversible?: string[] }).irreversible, ["node:release.irreversible"], /removes the irreversible marker "publish"/],
    ["a budget removed, not raised", (w) => stops(w, (stop) => (stop.kind === "budget" ? undefined : stop)), ["loop:review-review.stops"], /removes the budget \(10 dispatches\)/],
    ["the round cap deleted", (w) => stops(w, (stop) => (stop.kind === "max-iterations" ? undefined : stop)), ["loop:review-review.stops"], /removes the round cap \(4\)/],
    ["a cap that leads on and no longer halts", (w) => stops(w, (stop) => (stop.kind === "max-iterations" ? { ...stop, then: "done" } : stop)), ["loop:review-review.stops"], /the round cap \(4\) would no longer halt the run/],
    ["the stop where a person is asked, asked less often", (w) => stops(w, (stop) => (stop.kind === "human" ? { ...stop, every: 20 } : stop)), ["loop:review-review.stops"], /a person would be asked every 20 rounds, not every 2/],
    ["a bar's acceptance changed", (w) => void (loop(w).bar!.acceptance = "It looks fine."), ["loop:review-review.bar"], /acceptance/],
    // (The bar removed outright is refused earlier, by the validator: a judgment loop with no bar is no graph.)
    // (With the policy in place the validator refuses the shared edge by itself; a working copy that drops both is the case.)
    ["critic isolation: the policy dropped and the edge into the critic made to share its builder's context", (w) => {
      w.policies = w.policies!.filter((p) => p.kind !== "critic-isolation");
      w.edges.find((e) => e.id === "e-review-builder-review-critic")!.isolation = "shared";
    }, ["edge:e-review-builder-review-critic.isolation", "policy:review-p-critic-isolation"], /the critic would share its builder's context/],
    ["critic isolation: the policy removed", (w) => void (w.policies = w.policies!.filter((p) => p.kind !== "critic-isolation")), ["policy:review-p-critic-isolation"], /critic-isolation/],
    ["the adaptation level", (w) => void delete w.adaptation, ["graph:adaptation"], /the adaptation level would go from "fixed" to "adaptive"/],
    ["the adaptation level, one step", (w) => void (w.adaptation = "propose"), ["graph:adaptation"], /the adaptation level would go from "fixed" to "propose"/],
  ];
  for (const [what, change, at, why] of cases) {
    const check = adopt(change, { from: full });
    for (const name of at) assert.ok(names(check).includes(name), `${what}: ${name} is refused; refused are ${names(check).join(", ") || "none"}`);
    assert.match(refused(check).join("\n"), why, what);
    // Asked for by every name it is laid at, it is taken.
    assert.deepEqual(adopt(change, { from: full, allow: names(check) }).refused, [], `${what}: allowed by name`);
  }
});

test("the roads around: a loop under another id, a round taken out of its loop, a way around the gate, a marked step before any person", () => {
  // The same loop under a new id, with a cap of 40: the old loop is gone with its stops, whatever the new one says.
  const renamed = adopt((w) => {
    loop(w).stops = loop(w).stops.map((stop) => (stop.kind === "max-iterations" ? { ...stop, n: 40 } : stop));
    loop(w).id = "review-again";
  });
  assert.ok(names(renamed).includes("loop:review-review"), names(renamed).join(", "));
  assert.match(refused(renamed).join("\n"), /removes a loop with its stops and its bar/);

  // A second loop that takes one of the first's rounds: that round is counted against no stop of the loop's.
  const split = adopt((w) => {
    loop(w).back = ["review-e-critic-fail"];
    loop(w).members = ["review-builder", "review-critic"];
    w.loops.push({ id: "asks", name: "Asks", members: ["review-builder", "review-critic", "review-merge-gate"], back: ["review-e-merge-gate-reject"], mode: "judgment", bar: loop(w).bar!, stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 4 }, { kind: "budget", measure: "dispatches", limit: 10 }] });
  });
  assert.match(refused(split).join("\n"), /would be counted by "asks" and not against its stops/);

  // A way to the release step that does not pass the gate.
  const around = adopt((w) => void w.edges.push({ id: "e-plan-release", from: "plan", to: "release" }));
  assert.deepEqual(names(around), ["edge:e-plan-release"]);
  assert.match(refused(around)[0]!, /adds a way into "release" that does not pass a person/);

  // The gate kept, and its "reject" made to lead where "approve" does.
  const either = adopt((w) => {
    w.edges.find((e) => e.id === "review-e-merge-gate-reject")!.to = "release";
    loop(w).back = ["review-e-critic-fail"];
  });
  assert.ok(names(either).includes("edge:review-e-merge-gate-reject.to"), names(either).join(", "));

  // A critic given another role decides nothing.
  const demoted = adopt((w) => void ((node(w, "review-critic") as { role: string }).role = "builder"));
  assert.ok(names(demoted).includes("node:review-critic.role"), names(demoted).join(", "));
});

test("a subgrooph's group is a record, not a brake: a change to it is listed and loosens nothing by itself", () => {
  // Slot values are filled in when a template is placed; changing `with` afterwards changes no node, edge or loop.
  // What would follow it is a refresh (`grooph sub update`), which is held to the same comparison when it is run.
  const filled = adopt((w) => void (w.groups!.find((g) => g.id === "review")!.with = { ...w.groups!.find((g) => g.id === "review")!.with, task: "everything" }));
  assert.deepEqual(filled.changes.map((change) => change.name), ["group:review.with"]);
  assert.deepEqual(filled.refused, []);
  // Moving the loop's nodes into another group, or out of every group, changes how the graph is drawn and no more.
  const regrouped = adopt((w) => void (w.groups = w.groups!.filter((g) => g.id !== "delivery")));
  assert.deepEqual(regrouped.refused, []);
  // And a cap raised under cover of either is still a cap raised.
  const both = adopt((w) => {
    w.groups = w.groups!.filter((g) => g.id !== "delivery");
    stops(w, (stop) => (stop.kind === "max-iterations" ? { ...stop, n: 40 } : stop));
  });
  assert.deepEqual(names(both), ["loop:review-review.stops"]);
});

test("a tightened brake is adopted and said: a lower cap, a new approval, a stricter level", () => {
  const check = adopt((w) => {
    stops(w, (stop) => (stop.kind === "max-iterations" ? { ...stop, n: 2 } : stop));
    w.edges.find((e) => e.id === "e-plan-review-builder")!.approval = true;
    w.adaptation = "propose";
  });
  assert.deepEqual(check.refused, []);
  const said = Object.fromEntries(check.changes.filter((change) => change.tightens !== undefined).map((change) => [change.name, change.tightens]));
  assert.deepEqual(said, {
    "loop:review-review.stops": "raises the round cap from 2 to 4",
    "edge:e-plan-review-builder.approval": 'removes a person\'s approval from the edge; opens a way into "review-builder" that does not pass a person',
    "graph:adaptation": 'the adaptation level would go from "propose" to "adaptive": the lead may change more of the graph during a run',
  });
  // One change that does both is refused for the half that loosens, and says the half that tightens.
  const mixed = adopt((w) => stops(w, (stop) => (stop.kind === "max-iterations" ? { ...stop, n: 2 } : stop.kind === "budget" ? { ...stop, limit: 400 } : stop)));
  assert.deepEqual(refused(mixed), ["loop:review-review.stops: raises the budget from 10 to 400 dispatches"]);
  assert.equal(mixed.refused[0]!.tightens, "raises the round cap from 2 to 4");
});

// ─── what a reader got through the first version of this, and no longer does ──────────────────────────────────
//
// Asked to break adoption with the diff in hand, a fresh reader had five kinds of working copy adopted with nothing
// refused. Each is a way the comparison in `brakes.ts` did not see, so each was open to a subgrooph's refresh too.

const edge = (doc: Graph, id: string): Graph["edges"][number] => doc.edges.find((e) => e.id === id)!;

test("a way round a loop's nodes that its stops do not count: a loop put around it, a second way back through a new step", () => {
  // Around: the critic may send the run back to the planner, and a loop with a cap of 1000 counts that. Each time
  // the review loop is entered again its own cap of 4 starts afresh (graph-ir §2, "Nested loops").
  const around = adopt((w) => {
    w.edges.push({ id: "e-replan", from: "review-critic", to: "plan", when: { verdict: "replan" } });
    w.loops.push({ id: "replan", name: "Replan", members: ["plan", "review-builder", "review-critic", "review-merge-gate"], back: ["e-replan"], mode: "judgment", bar: structuredClone(loop(w).bar!), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 1000 }] });
  });
  assert.deepEqual(names(around).sort(), ["edge:e-replan", "loop:replan"]);
  assert.match(refused(around)[0]!, /"e-replan" \(review-critic → plan\) would make a way round the nodes of "review-review" that its stops do not count: "replan" would count it, and each time round "review-review" starts afresh/);
  // A loop that is new is not said to tighten anything when it is what loosens.
  assert.equal(around.changes.find((change) => change.name === "edge:e-replan")!.tightens, undefined);

  // Through a new step: critic → fixer → builder, counted by a second loop.
  const through = adopt((w) => {
    w.nodes.push(agent("fixer", "builder"));
    w.edges.push({ id: "e-critic-fixer", from: "review-critic", to: "fixer", when: { verdict: "revise" } }, { id: "e-fixer-builder", from: "fixer", to: "review-builder", evidence: ["REVIEW.md"] });
    w.loops.push({ id: "revise", name: "Revise", members: ["review-builder", "review-critic", "fixer"], back: ["e-fixer-builder"], mode: "judgment", bar: structuredClone(loop(w).bar!), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 1000 }] });
  });
  for (const name of ["edge:e-critic-fixer", "edge:e-fixer-builder"]) assert.ok(names(through).includes(name), `${name}: ${names(through).join(", ")}`);
});

test("a stop that leads back into its own loop, set to fire no later than the stops that halt", () => {
  const cases: [string, (w: Graph) => void, RegExp][] = [
    ["a stop of another measure, first in the list", (w) => void loop(w).stops.splice(1, 0, { kind: "budget", measure: "minutes", limit: 0, then: "review-builder" }), /a stop of the loop "review-review" would lead back to "review-builder": a way round the nodes of "review-review" that its stops do not count/],
    ["a stop of a kind that is no brake", (w) => void loop(w).stops.splice(1, 0, { kind: "diminishing-returns", rounds: 1, then: "review-builder" }), /would lead back to "review-builder"/],
    ["a second cap of the same count, before the one that halts", (w) => void loop(w).stops.splice(1, 0, { kind: "max-iterations", n: 4, then: "review-builder" }), /the round cap of 4 that leads on to "review-builder" would fire as soon as the one of 4 that halts the run/],
  ];
  for (const [what, change, why] of cases) {
    const check = adopt(change);
    assert.deepEqual(names(check), ["loop:review-review.stops"], what);
    assert.match(refused(check)[0]!, why, what);
  }
  // Where a cap already led on before the one that halts: where it leads is what it does.
  const twoCaps = source((doc) => {
    doc.nodes.push(agent("wrap-up", "builder"));
    loop(doc).stops.splice(1, 0, { kind: "max-iterations", n: 3, then: "wrap-up" });
  });
  const repointed = adopt((w) => void ((loop(w).stops[1] as { then?: string }).then = "review-builder"), { from: twoCaps });
  assert.deepEqual(names(repointed), ["loop:review-review.stops"]);
  assert.match(refused(repointed)[0]!, /the round cap would lead on to "review-builder", not to "wrap-up"/);
});

test("a second edge beside a decision, to a node the run reaches anyway", () => {
  // Beside an approval: the same two nodes, the same condition, nobody asked.
  const approved = source((doc) => void (edge(doc, "review-e-critic-fail").approval = true));
  const twin = adopt((w) => {
    w.edges.push({ id: "e-critic-fail-again", from: "review-critic", to: "review-builder", when: "fail", evidence: ["REVIEW.md"] });
    loop(w).back.push("e-critic-fail-again");
  }, { from: approved });
  assert.deepEqual(names(twin), ["edge:e-critic-fail-again"]);
  assert.match(refused(twin)[0]!, /"e-critic-fail-again" would lead from "review-critic" to "review-builder" beside "review-e-critic-fail", which needs a person's approval, and need none/);

  // Around a gate that stood on every way back: the critic's "fail" went to the gate, and only the gate sent the
  // run back to the builder. A new verdict leads straight back.
  const gated = source((doc) => {
    edge(doc, "review-e-critic-fail").to = "review-merge-gate";
    delete edge(doc, "review-e-critic-fail").evidence;
    loop(doc).back = ["review-e-merge-gate-reject"];
  });
  const minor = adopt((w) => {
    w.edges.push({ id: "e-critic-minor", from: "review-critic", to: "review-builder", when: { verdict: "minor" }, evidence: ["REVIEW.md"] });
    loop(w).back.push("e-critic-minor");
  }, { from: gated });
  assert.deepEqual(names(minor), ["edge:e-critic-minor"]);
  assert.match(refused(minor)[0]!, /adds a way from "review-critic" to "review-builder" that does not pass a person/);
});

test("a step taken out of the loop's nodes while it stays in the graph is counted against nothing", () => {
  const three = source((doc) => {
    doc.nodes.push({ id: "review-tests", kind: "check", name: "Tests", check: { kind: "tests", run: "pnpm test", pass: "exit 0" } } as Node);
    edge(doc, "e-review-builder-review-critic").from = "review-tests";
    doc.edges.push({ id: "e-builder-tests", from: "review-builder", to: "review-tests" });
    loop(doc).members = ["review-builder", "review-tests", "review-critic", "review-merge-gate"];
    doc.groups!.find((g) => g.id === "review")!.members.push("review-tests");
  });
  // (An edge that is never taken keeps a path inside the loop's nodes, so that the document still validates.)
  const out = adopt((w) => {
    loop(w).members = ["review-builder", "review-critic", "review-merge-gate"];
    w.edges.push({ id: "e-builder-critic-direct", from: "review-builder", to: "review-critic", when: { verdict: "never" }, evidence: ["diff of the change"] });
  }, { from: three });
  assert.ok(refused(out).includes('loop:review-review.members: the loop "review-review" would no longer bound "review-tests", which is still in the graph'), refused(out).join("\n"));
});

test("what is not refused, and is said to be a limit: a way round that a person newly opens each time; the same edge under another id", () => {
  // A new answer at the gate that leads back through a new step, and a stop where a person is asked that leads back.
  // Each is a way round the loop's cap does not count, and each is opened by a person, every time: the cap then
  // bounds the rounds between two of that person's decisions (docs/templates.md, "Refreshing").
  const redo = adopt((w) => {
    w.nodes.push(agent("redo", "builder"));
    w.edges.push({ id: "e-gate-redo", from: "review-merge-gate", to: "redo", when: { verdict: "redo" } }, { id: "e-redo-builder", from: "redo", to: "review-builder" });
    w.loops.push({ id: "redo-round", name: "Redo", members: ["review-builder", "review-critic", "review-merge-gate", "redo"], back: ["e-redo-builder"], mode: "judgment", bar: structuredClone(loop(w).bar!), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 1000 }] });
  });
  assert.deepEqual(redo.refused, []);
  // Not refused, and said by name: which loop, which of its stops, and where the person is asked.
  assert.deepEqual(redo.notices, [
    'the loop "review-review": the round cap (4) and the budget (10 dispatches) would count the rounds between two of a person\'s decisions, and no longer the whole run. A way round its nodes that they do not count is opened each time by "redo" at the human gate "review-merge-gate" (e-gate-redo)',
  ]);
  const asked = adopt((w) => void loop(w).stops.push({ kind: "human", every: 2, then: "review-builder" }));
  assert.deepEqual(asked.refused, []);
  assert.match(asked.notices[0]!, /^the loop "review-review": the round cap \(4\) and the budget \(10 dispatches\) would count the rounds between two of a person's decisions.* opened each time by the stop where a person is asked, which continues at "review-builder"$/);
  // An approval newly asked on the lap of a new way round: the person is on every lap, and that is said too.
  const lap = adopt((w) => {
    w.nodes.push(agent("redo", "builder"));
    w.edges.push({ id: "e-critic-redo", from: "review-critic", to: "redo", when: { verdict: "redo" } }, { id: "e-redo-builder", from: "redo", to: "review-builder" });
    w.loops.push({ id: "redo-round", name: "Redo", members: ["review-builder", "review-critic", "redo"], back: ["e-redo-builder"], mode: "judgment", bar: structuredClone(loop(w).bar!), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 1000 }] });
    edge(w, "e-review-builder-review-critic").approval = true;
  });
  assert.deepEqual(lap.refused, []);
  assert.match(lap.notices.join("\n"), /opened each time by the approval asked on "e-review-builder-review-critic"/);
  // And nothing is said where nothing of the kind happened.
  assert.deepEqual(adopt((w) => void (edge(w, "e-review-builder-review-critic").approval = true)).notices, []);
  assert.deepEqual(adopt((w) => stops(w, (stop) => (stop.kind === "max-iterations" ? { ...stop, n: 40 } : stop))).notices, []);

  // An edge under another id, nothing else changed, on a way round that was there before: the same way.
  const nested = source((doc) => {
    doc.edges.push({ id: "e-release-plan", from: "release", to: "plan", when: "fail" });
    doc.loops.push({ id: "again", name: "Again", members: ["plan", "review-builder", "review-critic", "review-merge-gate", "release"], back: ["e-release-plan"], mode: "grind", stops: [{ kind: "max-iterations", n: 2 }, { kind: "budget", measure: "dispatches", limit: 30 }] });
  });
  const renamed = adopt((w) => void (edge(w, "e-plan-review-builder").id = "e-plan-to-builder"), { from: nested });
  assert.deepEqual(renamed.refused, []);
});

// ─── and what a second reader got through the rules above ─────────────────────────────────────────────────────

const fixture = (file: string, change: (doc: Graph) => void = () => {}): Graph => {
  const doc = parseGraphText(read(join(repoRoot, "fixtures/valid", file))).doc!;
  change(doc);
  return doc;
};

test("a loop left as a shell: its work under other names and a second loop's stops, while the old loop keeps one of its nodes", () => {
  // The small grind (a cap of 5 that continues at a wrap-up step, and a budget of 20 minutes). The fixer is removed
  // and a stub put in its place in the old loop; a second fixer and a second suite do the work under a cap of 1000.
  const wrap = fixture("wrap-up-after-the-cap.grooph.json");
  const shell = adopt((w) => {
    const twin = (id: string, as: string): Node => ({ ...structuredClone(w.nodes.find((n) => n.id === id)!), id: as }) as Node;
    const [fixer2, suite2] = [twin("fixer", "fixer2"), twin("suite", "suite2")];
    w.nodes = w.nodes.filter((n) => n.id !== "fixer");
    w.nodes.push(agent("stub", "builder"), fixer2, suite2);
    w.edges = w.edges.filter((e) => e.id !== "e-fix-suite");
    edge(w, "e-suite-fail").to = "stub";
    w.edges.push({ id: "e-stub-suite", from: "stub", to: "suite" }, { id: "e-fix2-suite2", from: "fixer2", to: "suite2" }, { id: "e-suite2-fail", from: "suite2", to: "fixer2", when: "fail" }, { id: "e-suite2-pass", from: "suite2", to: "green", when: "pass" });
    w.loops[0]!.members = ["stub", "suite"];
    w.loops.push({ id: "fix-cycle-2", name: "Again", members: ["fixer2", "suite2"], back: ["e-suite2-fail"], mode: "grind", stops: [{ kind: "max-iterations", n: 1000 }] });
  }, { from: wrap });
  assert.ok(names(shell).includes("node:fixer"), names(shell).join(", "));
  assert.match(refused(shell).join("\n"), /removes "fixer", which the loop "fix-cycle" bounded, while "fixer2", "suite2" would come in on a round it does not count: it may be the same step under another name/);
  // A loop that is new is not called a tightening.
  assert.equal(shell.changes.find((change) => change.name === "loop:fix-cycle-2")!.tightens, undefined);

  // A member renamed and kept among the loop's members is not that: nothing of the loop's goes uncounted.
  const renamed = adopt((w) => {
    w.nodes.find((n) => n.id === "fixer")!.id = "mender";
    for (const e of w.edges) Object.assign(e, { from: e.from === "fixer" ? "mender" : e.from, to: e.to === "fixer" ? "mender" : e.to });
    w.loops[0]!.members = ["mender", "suite"];
  }, { from: wrap });
  assert.ok(!refused(renamed).join("\n").includes("it may be the same step under another name"), refused(renamed).join("\n"));
});

test("an approval gone around by a stop that leads on, to a node the run reaches anyway", () => {
  // The critic's pass needs approval on its way to the merge, which the docs step reaches without one. No success
  // stop, so nothing is found by how a run ends. A stop of the review loop comes to continue at the merge.
  const approved = fixture("glyph-vocabulary.grooph.json", (doc) => {
    edge(doc, "e-critic-merge").approval = true;
    doc.nodes = doc.nodes.filter((n) => n.id !== "done");
    doc.edges = doc.edges.filter((e) => e.id !== "e-ship-done");
  });
  const review = (doc: Graph): Loop => doc.loops.find((l) => l.id === "review")!;
  const cases: [string, (w: Graph) => void][] = [
    ["the bar passed", (w) => void ((review(w).stops[0] as { then?: string }).then = "merge")],
    ["a stop of a kind that is no brake", (w) => void review(w).stops.push({ kind: "diminishing-returns", rounds: 2, then: "merge" })],
    ["a budget of another measure, first", (w) => void review(w).stops.unshift({ kind: "budget", measure: "tokens", limit: 0, then: "merge" })],
  ];
  for (const [what, change] of cases) {
    const check = adopt(change, { from: approved });
    assert.deepEqual(names(check), ["loop:review.stops"], what);
    assert.match(refused(check)[0]!, /a stop of the loop would lead on from "[a-z]+" to "merge", a way that does not pass/, what);
  }
});

test("a loop's back edge moved to join two nodes of the loop inside it; a step on a loop's rounds that its dispatch budget does not count", () => {
  // The nested fixture: `review` (cap 3, 12 dispatches) around `grind` (cap 5, 10 dispatches). Grind's back edge is
  // made to start at the critic, which is review's: a critic → build round is then counted by grind, not by review.
  const nested = fixture("glyph-vocabulary.grooph.json");
  const moved = adopt((w) => {
    Object.assign(edge(w, "e-tests-fail"), { from: "critic", when: { verdict: "again" } });
    const grind = w.loops.find((l) => l.id === "grind")!;
    grind.members.push("critic");
    grind.mode = "grind";
  }, { from: nested });
  assert.ok(names(moved).includes("edge:e-tests-fail.from"), `${names(moved).join(", ")}\n${refused(moved).join("\n")}`);
  assert.match(refused(moved).join("\n"), /a round between "critic" and "build", which the loop "review" bounds, would be counted by "grind" and not against its stops/);

  // An honest step put into both loops, between two of their nodes, is not refused: no node has a way round it did not have.
  const honest = adopt((w) => {
    w.nodes.push({ id: "format", kind: "check", name: "Format", check: { kind: "command", run: "pnpm format --check", pass: "exit 0" } } as Node);
    edge(w, "e-build-tests").from = "format";
    w.edges.push({ id: "e-build-format", from: "build", to: "format" });
    for (const l of w.loops) l.members.push("format");
  }, { from: nested });
  assert.deepEqual(honest.refused, []);

  // The same step left out of the loops' members: each round dispatches it, and neither budget of dispatches counts it.
  const unlisted = adopt((w) => {
    w.nodes.push({ id: "format", kind: "check", name: "Format", check: { kind: "command", run: "pnpm format --check", pass: "exit 0" } } as Node);
    edge(w, "e-build-tests").from = "format";
    w.edges.push({ id: "e-build-format", from: "build", to: "format" }, { id: "e-build-tests-direct", from: "build", to: "tests", when: { verdict: "never" } });
  }, { from: nested });
  assert.ok(names(unlisted).includes("node:format"), names(unlisted).join(", "));
  assert.match(refused(unlisted).join("\n"), /"format" would work on the rounds of the loop "grind" and not be among its members: its budget of dispatches would not count it/);
});

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
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { adoptCommandLine, checkAdoption, type AdoptionCheck } from "../src/adoption.js";
import { canonicalize } from "../src/canonicalize.js";
import { parseGraphText } from "../src/parse.js";
import { adoptWorkingCopy } from "../src/runs.js";
import { insertFragment, instantiate } from "../src/template.js";
import type { Edge, Graph, Loop, Node } from "../src/types.js";
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

test("the command that adopts on purpose is one line a shell takes as it is", () => {
  assert.equal(adoptCommandLine(".grooph/g/runs/r1", ["loop:review.stops", "edge:e-a-b.approval"]), "grooph adopt .grooph/g/runs/r1 --write --allow loop:review.stops --allow edge:e-a-b.approval");
  assert.equal(adoptCommandLine("runs/r1", [], "next.grooph.json"), "grooph adopt runs/r1 --into next.grooph.json --write");
  // A folder with a space, or a name with a quote, is one word to the shell.
  assert.equal(adoptCommandLine("my project/.grooph/g/runs/r1", ["node:it's"]), "grooph adopt 'my project/.grooph/g/runs/r1' --write --allow 'node:it'\\''s'");
});

// ─── a check is a brake (amendment A-019) ─────────────────────────────────────────────────────────────────────
//
// The audit lane read the comparison whole and found that a check was nowhere in it: the check of a grind loop
// changed to `true`, or its two verdicts swapped, was adopted with nothing refused. The owner ruled that a check's
// definition and where its verdicts lead are brakes. Since a program cannot tell a stricter command from a looser
// one, any change to them is held until asked for. The one exception is narrow: an approval newly asked on an edge
// that leaves a check, and evidence the comparison counts. A reader got three loosened working copies through a
// wider one ("whatever the comparison would call a tightening"); they are the tests at the end of this section.

/** A built-in template as a graph: its slots filled with their examples. */
const builtIn = (id: string): Graph => {
  const template = parseGraphText(read(join(repoRoot, "patterns", `${id}.grooph.json`))).doc!;
  const filled = instantiate(template, { name: template.name, values: Object.fromEntries((template.template!.slots ?? []).map((slot) => [slot.key, slot.example ?? "x"])) });
  return parseGraphText(canonicalize(filled)).doc!;
};
const checkOf = (doc: Graph, id: string): Extract<Node, { kind: "check" }> => doc.nodes.find((n) => n.id === id) as Extract<Node, { kind: "check" }>;
/** What every line about an edge that leaves a check ends on: a tightening is held too, and is told that it costs one `--allow`. */
const EITHER = ": a program cannot tell which way this goes, so it is held either way, and a tightening (a gate put behind the check's pass) costs one --allow too, the price of a rule a program can apply";

test("A-019, the audit's three probes on the grind loop: the check made to pass always, its verdicts swapped, a way round it", () => {
  const grind = builtIn("grind-loop");
  const always = adopt((w) => void (checkOf(w, "tests").check = { ...checkOf(w, "tests").check, run: "true", pass: "exit code 0" }), { from: grind });
  assert.deepEqual(refused(always), ["node:tests.check: changes the check's definition (run, pass): what it runs and what counts as a pass may be tightened and not loosened, and a program cannot tell which this is"]);

  const swapped = adopt((w) => {
    for (const e of w.edges) if (e.from === "tests") e.when = e.when === "pass" ? "fail" : "pass";
  }, { from: grind });
  assert.deepEqual(names(swapped).sort(), ["edge:e-tests-fail.when", "edge:e-tests-pass.when"]);
  assert.match(refused(swapped).join("\n"), /a way into "done" that does not pass "pass" from the check "tests"/);

  // The check untouched, and one edge from the builder straight to the stop that ends in success.
  const around = adopt((w) => void w.edges.push({ id: "e-builder-done", from: "builder", to: "done" }), { from: grind });
  assert.deepEqual(names(around), ["edge:e-builder-done"]);
  assert.match(refused(around)[0]!, /adds a way into "done" that does not pass the check "tests"/);

  // Each is one name to ask for, and asked for it is taken.
  assert.deepEqual(adopt((w) => void (checkOf(w, "tests").check = { ...checkOf(w, "tests").check, run: "true" }), { from: grind, allow: ["node:tests.check"] }).refused, []);
});

test("A-019: a check removed, made another kind of node, or left by another edge is held; a tightening on an edge that leaves it is not", () => {
  const grind = builtIn("grind-loop");
  const gone = adopt((w) => {
    w.nodes = w.nodes.filter((n) => n.id !== "tests");
    w.edges = w.edges.filter((e) => e.from !== "tests" && e.to !== "tests");
    w.nodes.push({ id: "verify", kind: "check", name: "Verify", check: { kind: "command", run: "true", pass: "exit code 0" } } as Node);
    w.edges.push({ id: "e-builder-verify", from: "builder", to: "verify" }, { id: "e-verify-fail", from: "verify", to: "builder", when: "fail" }, { id: "e-verify-pass", from: "verify", to: "done", when: "pass" });
    w.loops[0]!.members = ["builder", "verify"];
    w.loops[0]!.back = ["e-verify-fail"];
  }, { from: grind });
  assert.ok(names(gone).includes("node:tests"), names(gone).join(", "));
  assert.match(refused(gone).join("\n"), /node:tests: removes a check/);

  // An edge added that leaves the check, on a verdict of its own.
  const third = adopt((w) => {
    w.nodes.push(agent("notes", "builder"));
    w.edges.push({ id: "e-tests-notes", from: "tests", to: "notes", when: { verdict: "flaky" } });
  }, { from: grind });
  assert.deepEqual(refused(third), [`edge:e-tests-notes: adds "e-tests-notes", an edge that leaves the check "tests"${EITHER}`]);

  // An approval newly asked on such an edge can only tighten, and the comparison marks it by a rule of its own.
  const asked = adopt((w) => void (w.edges.find((e) => e.id === "e-tests-pass")!.approval = true), { from: grind });
  assert.deepEqual(asked.refused, []);
  assert.match(asked.changes.find((change) => change.name === "edge:e-tests-pass.approval")!.tightens!, /removes a person's approval from the edge/);

  // A human gate put behind the check's pass tightens in truth, and is held all the same, by one name: only a rule
  // a program can apply is one it can keep. The line says so.
  const gated = adopt((w) => {
    w.nodes.push({ id: "sign-off", kind: "human-gate", name: "Sign off", prompt: "Is this ready?", options: ["approve"] } as Node);
    w.edges.find((e) => e.id === "e-tests-pass")!.to = "sign-off";
    w.edges.push({ id: "e-sign-off-done", from: "sign-off", to: "done", when: { verdict: "approve" } });
  }, { from: grind });
  assert.deepEqual(refused(gated), [`edge:e-tests-pass.to: changes "e-tests-pass", an edge that leaves the check "tests" (to)${EITHER}`]);
  assert.deepEqual(adopt((w) => {
    w.nodes.push({ id: "sign-off", kind: "human-gate", name: "Sign off", prompt: "Is this ready?", options: ["approve"] } as Node);
    w.edges.find((e) => e.id === "e-tests-pass")!.to = "sign-off";
    w.edges.push({ id: "e-sign-off-done", from: "sign-off", to: "done", when: { verdict: "approve" } });
  }, { from: grind, allow: ["edge:e-tests-pass.to"] }).refused, []);

  // A change to such an edge that is no tightening the comparison can show: held, by its own name.
  const evidence = adopt((w) => void (w.edges.find((e) => e.id === "e-tests-fail")!.evidence = ["the last ten lines only"]), { from: grind });
  assert.deepEqual(refused(evidence), [`edge:e-tests-fail.evidence: changes "e-tests-fail", an edge that leaves the check "tests" (evidence)${EITHER}`]);
});

test("A-019, the honest edits it holds: each is one name, and says what it is", () => {
  const grind = builtIn("grind-loop");
  const flag = adopt((w) => void (checkOf(w, "tests").check = { ...checkOf(w, "tests").check, run: `${checkOf(w, "tests").check.run} --bail` }), { from: grind });
  assert.deepEqual(names(flag), ["node:tests.check"]);
  assert.match(refused(flag)[0]!, /changes the check's definition \(run\)/);
  const stricter = adopt((w) => void (checkOf(w, "tests").check = { ...checkOf(w, "tests").check, pass: "exit code 0, no test skipped and no warning printed" }), { from: grind });
  assert.deepEqual(names(stricter), ["node:tests.check"]);
  assert.match(refused(stricter)[0]!, /changes the check's definition \(pass\)/);
  // A new check is nobody's brake yet: adding one, with its own edges, is not held for being a check.
  const added = adopt((w) => {
    w.nodes.push({ id: "lint", kind: "check", name: "Lint", check: { kind: "command", run: "pnpm lint", pass: "exit code 0" } } as Node);
    w.edges.find((e) => e.id === "e-builder-tests")!.from = "lint";
    w.edges.push({ id: "e-builder-lint", from: "builder", to: "lint" }, { id: "e-lint-fail", from: "lint", to: "builder", when: "fail" });
    w.loops[0]!.members.push("lint");
    w.loops[0]!.back.push("e-lint-fail");
  }, { from: grind });
  assert.ok(!refused(added).some((line) => /check "lint"|node:lint/.test(line)), refused(added).join("\n"));
});

test("A-019: every built-in template whose loop is judged by a check alone, and every check in no loop", () => {
  const files = readdirSync(join(repoRoot, "patterns")).filter((name) => name.endsWith(".grooph.json")).map((name) => name.replace(".grooph.json", ""));
  const alone: string[] = [];
  const outside: string[] = [];
  const probed: string[] = [];
  const third: string[] = [];
  for (const id of files) {
    // As a graph: a fragment, which is not one by itself, is put into a graph that holds nothing else.
    const shipped = parseGraphText(read(join(repoRoot, "patterns", `${id}.grooph.json`))).doc!;
    const values = Object.fromEntries((shipped.template!.slots ?? []).map((slot) => [slot.key, slot.example ?? "x"]));
    const empty: Graph = { grooph: 0, id: "host", name: "Host", version: 1, goal: "Hold a fragment.", target: { harness: "claude-code" }, nodes: [], edges: [], loops: [] };
    const doc = shipped.template?.kind === "fragment" ? parseGraphText(canonicalize(insertFragment(empty, shipped, { values }).doc)).doc! : builtIn(id);
    const kind = (member: string): string => doc.nodes.find((n) => n.id === member)!.kind;
    const critics = new Set(doc.nodes.filter((n) => n.kind === "agent" && ["critic", "judge", "red-team"].includes(n.role as string)).map((n) => n.id));
    const judged = doc.loops.filter((l) => l.members.some((m) => kind(m) === "check") && !l.bar && !l.members.some((m) => critics.has(m) || kind(m) === "human-gate"));
    if (judged.length > 0) alone.push(id);
    const inLoops = new Set(doc.loops.flatMap((l) => l.members));
    for (const check of doc.nodes.filter((n) => n.kind === "check")) {
      if (!inLoops.has(check.id)) outside.push(`${id}:${check.id}`);
      if (judged.length > 0 && !probed.includes(id)) probed.push(id);
      // The check made to pass always: held, by the check's name, whichever template and wherever it stands.
      const always = adopt((w) => void (checkOf(w, check.id).check = { ...checkOf(w, check.id).check, run: "true" }), { from: doc });
      assert.deepEqual(names(always), [`node:${check.id}.check`], `${id}: ${check.id}`);
      // Its verdicts swapped: every edge that leaves it on pass or fail is held.
      const leaving = doc.edges.filter((e) => e.from === check.id && (e.when === "pass" || e.when === "fail"));
      const swapped = adoptWorkingCopy(doc, { ...structuredClone(doc), edges: doc.edges.map((e) => (leaving.includes(e) ? { ...e, when: e.when === "pass" ? "fail" : "pass" } : e)) } as Graph, { run: "r" });
      if (leaving.length < 2 || !swapped.ok) continue;
      const held = checkAdoption(doc, swapped.doc).refused.map((change) => change.name);
      for (const e of leaving) assert.ok(held.includes(`edge:${e.id}.when`), `${id}: ${e.id} is held when the verdicts of ${check.id} are swapped; held are ${held.join(", ")}`);
    }
    // The audit's third probe, on every template and not only on the grind loop: the checks untouched, and one edge
    // from a step that leads into a check straight to a stop that ends in success. Held, and for a check, also where
    // a round cap of the loop already leads on to that stop (the retrospective: its loop ends, pass or fail, there).
    const checks = new Set(doc.nodes.filter((n) => n.kind === "check").map((n) => n.id));
    const good = doc.nodes.filter((n) => n.kind === "stop" && (n.outcome ?? "success") === "success").map((n) => n.id);
    for (const into of doc.edges.filter((e) => checks.has(e.to) && !checks.has(e.from) && kind(e.from) === "agent")) {
      for (const stop of good.filter((end) => !doc.edges.some((e) => e.from === into.from && e.to === end))) {
        const around = adoptWorkingCopy(doc, { ...structuredClone(doc), edges: [...doc.edges, { id: "e-straight-to-the-end", from: into.from, to: stop }] } as Graph, { run: "r" });
        if (!around.ok) continue;
        const said = checkAdoption(doc, around.doc).refused.filter((change) => change.name === "edge:e-straight-to-the-end").map((change) => change.loosens).join("; ");
        assert.notEqual(said, "", `${id}: ${into.from} → ${stop} goes round ${into.to} and is held`);
        // Where a check alone judges the loop, the line names the check. (Where a critic's bar stands between the
        // check and the end, the same edge is held for the critic and the people it goes round.)
        if (judged.length > 0) assert.match(said, new RegExp(`that does not pass (the|"pass" from the) check "${into.to}"`), `${id}: ${into.from} → ${stop} goes round ${into.to}; said: ${said}`);
        third.push(`${id}:${into.from}`);
      }
    }
  }
  for (const id of alone) assert.ok(third.some((tried) => tried.startsWith(`${id}:`)), `the third probe was tried on ${id}`);
  assert.equal(alone.length, 7, `the templates with a loop judged by a check alone: ${alone.join(", ")}`);
  assert.deepEqual(probed, alone, "each of the seven was tried");
  assert.equal(outside.length, 2, `the checks in no loop: ${outside.join(", ")}`);
});

// What the reader of A-019 got through the first cut, each adopted with nothing refused and each a test now.

test("A-019, the reader's first: a failure led to a second stop that ends in success, with an approval asked beside it, is no tightening", () => {
  const grind = builtIn("grind-loop");
  const second = { id: "done-too", kind: "stop", name: "Done too", outcome: "success" } as Node;
  // The pass edge now taken on a failure and led to the new stop; passing leads to the old one by a new edge that
  // asks a person. Read backwards, each of the three "opens a way that does not pass a person".
  const swapped = adopt((w) => {
    w.nodes.push(second);
    Object.assign(w.edges.find((e) => e.id === "e-tests-pass")!, { when: "fail", to: "done-too" });
    w.edges.push({ id: "e-tests-passed", from: "tests", to: "done", when: "pass", approval: true });
  }, { from: grind });
  assert.deepEqual(names(swapped).sort(), ["edge:e-tests-pass.to", "edge:e-tests-pass.when", "edge:e-tests-passed"]);

  // The same with a person on it: a failure approved into a stop that ends in success is still a way round the check.
  const approved = adopt((w) => {
    w.nodes.push(second);
    w.edges.push({ id: "e-tests-failed", from: "tests", to: "done-too", when: "fail", approval: true });
  }, { from: grind });
  assert.deepEqual(refused(approved), [`edge:e-tests-failed: adds "e-tests-failed", an edge that leaves the check "tests"${EITHER}`]);

  // And from the builder, the check untouched: the third probe with a stop of its own.
  const around = adopt((w) => {
    w.nodes.push(second);
    w.edges.push({ id: "e-builder-done-too", from: "builder", to: "done-too" });
  }, { from: grind });
  assert.deepEqual(refused(around), ['edge:e-builder-done-too: adds a way from "builder" to end in success that does not pass the check "tests"']);
});

test("A-019: a change to an edge that leaves a check does not ride through on a tightening made beside it", () => {
  const grind = builtIn("grind-loop");
  const edge = (w: Graph, id: string): Edge => w.edges.find((e) => e.id === id)!;
  // A failure led back to the check itself (run it again until it passes, the builder never asked).
  const retry = (w: Graph): void => void (edge(w, "e-tests-fail").to = "tests");
  assert.deepEqual(names(adopt(retry, { from: grind })), ["edge:e-tests-fail.to"]);
  const beside = adopt((w) => {
    retry(w);
    edge(w, "e-tests-pass").approval = true;
  }, { from: grind });
  assert.deepEqual(names(beside), ["edge:e-tests-fail.to"], "the approval asked on the pass edge is taken; the failure re-pointed is still held");
  // On the same edge: the condition changed and an approval asked. The approval passes and the condition does not.
  for (const when of ["always", "pass"] as const) {
    const same = adopt((w) => Object.assign(edge(w, "e-tests-fail"), { when, approval: true }), { from: grind });
    assert.deepEqual(names(same), ["edge:e-tests-fail.when"], when);
  }
  // Alone, where what a run reaches shows nothing: a verdict's edge removed, and one taken on another verdict.
  const patrol = builtIn("patrol-pulse");
  assert.deepEqual(names(adopt((w) => void (w.edges = w.edges.filter((e) => e.id !== "e-scan-clean")), { from: patrol })), ["edge:e-scan-clean"]);
  assert.deepEqual(names(adopt((w) => void (edge(w, "e-scan-clean").when = "pass"), { from: patrol })), ["edge:e-scan-clean.when"]);
  // Evidence the comparison counts (more handed to a critic) passes; the same edge led elsewhere does not.
  const rare = builtIn("fresh-grind-rare-judge");
  assert.deepEqual(adopt((w) => void edge(w, "e-tests-judge").evidence!.push("the full log"), { from: rare }).refused, []);
});

test("A-019, the reader's second: a loop a check judges is given no bar and no stop on \"bar passed\" without being asked", () => {
  const grind = builtIn("grind-loop");
  const bar = { name: "Builder says so", inspects: [{ kind: "file", ref: "CHANGES.md" }], acceptance: "CHANGES.md says the change is made." };
  const both = adopt((w) => {
    w.loops[0]!.bar = structuredClone(bar) as Loop["bar"];
    w.loops[0]!.stops.unshift({ kind: "bar-passed", then: "done" });
  }, { from: grind });
  assert.deepEqual(names(both).sort(), ["loop:grind.bar", "loop:grind.stops"]);
  assert.match(refused(both).join("\n"), /a stop of the loop would lead on to "done", a way that does not pass the check "tests"/);
  assert.match(refused(both).join("\n"), /gives the loop "grind", which the check "tests" judges with no critic, a bar of its own/);
  // The stop alone, leading on; and the stop with nothing named, which follows the edges the check's pass takes.
  assert.deepEqual(names(adopt((w) => void w.loops[0]!.stops.unshift({ kind: "bar-passed", then: "done" }), { from: grind })), ["loop:grind.stops"]);
  const follows = adopt((w) => {
    w.loops[0]!.bar = structuredClone(bar) as Loop["bar"];
    w.loops[0]!.stops.unshift({ kind: "bar-passed" });
  }, { from: grind });
  assert.deepEqual(names(follows).sort(), ["loop:grind.bar", "loop:grind.stops"]);
  // A critic brought in by the same working copy does not make the bar one the graph's critic judged.
  const withCritic = adopt((w) => {
    w.nodes.push({ ...agent("stamp", "builder"), role: "critic" } as Node);
    w.edges.push({ id: "e-tests-stamp", from: "builder", to: "stamp" });
    w.loops[0]!.members.push("stamp");
    w.loops[0]!.bar = structuredClone(bar) as Loop["bar"];
    w.loops[0]!.stops.unshift({ kind: "bar-passed", then: "done" });
  }, { from: grind });
  assert.ok(names(withCritic).includes("loop:grind.stops") && names(withCritic).includes("loop:grind.bar"), refused(withCritic).join("\n"));
  // Nor does a critic the graph had elsewhere, named among the loop's members now: it was not this loop's.
  const rare = builtIn("fresh-grind-rare-judge");
  const lent = adopt((w) => {
    const inner = w.loops.find((l) => l.id === "grind")!;
    inner.members.push("judge");
    inner.bar = structuredClone(bar) as Loop["bar"];
    inner.stops.unshift({ kind: "bar-passed" });
  }, { from: rare });
  assert.ok(names(lent).includes("loop:grind.bar") && names(lent).includes("loop:grind.stops"), `held are ${names(lent).join(", ")}`);
  // A loop a critic already judged keeps its bar's rules and gains nothing from this one.
  const review = builtIn("review-gate");
  assert.deepEqual(adopt((w) => void (w.loops[0]!.bar!.aspiration = "A reader would not ask a question."), { from: review }).refused, []);
});

test("A-019: the keys of a check written in another order are no change; a key the schema does not know is named", () => {
  const grind = builtIn("grind-loop");
  const reordered = adopt((w) => {
    const { kind, run, pass } = checkOf(w, "tests").check;
    checkOf(w, "tests").check = { pass, run, kind } as Extract<Node, { kind: "check" }>["check"];
  }, { from: grind });
  assert.deepEqual(reordered.refused, []);
  const unknown = adopt((w) => void Object.assign(checkOf(w, "tests").check, { allowFailure: true }), { from: grind });
  assert.match(refused(unknown)[0] ?? "", /^node:tests\.check: changes the check's definition \(allowFailure\)/);
});

// What the second reader of A-019 got through the narrowed rule, each on a built-in template and each a test now.

test("A-019, the second reader's first: a critic of the graph's own, named among the loop's members with the bar, is not that loop's critic; nor is one in a new loop", () => {
  const debate = builtIn("debate-then-build");
  const bar = { name: "Looks done", inspects: [{ kind: "file", ref: "CHANGES.md" }], acceptance: "CHANGES.md says the change is made." } as Loop["bar"];
  const borrowed = adopt((w) => {
    const build = w.loops.find((l) => l.id === "build")!;
    build.members.push("judge");
    build.bar = structuredClone(bar);
    build.stops.unshift({ kind: "bar-passed" });
  }, { from: debate });
  assert.deepEqual(names(borrowed).sort(), ["loop:build.bar", "loop:build.stops"]);
  // The bar alone, with the judge borrowed.
  assert.deepEqual(names(adopt((w) => {
    const build = w.loops.find((l) => l.id === "build")!;
    build.members.push("judge");
    build.bar = structuredClone(bar);
  }, { from: debate })), ["loop:build.bar"]);
  // A new loop over the same round, with the judge among its members: nothing was said of it at all.
  const beside = adopt((w) => void w.loops.push({ id: "build-2", name: "Build again", members: ["builder", "tests", "judge"], back: ["e-tests-fail"], bar: structuredClone(bar), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 3 }] } as Loop), { from: debate });
  assert.deepEqual(names(beside), ["loop:build-2"]);
  assert.match(refused(beside)[0]!, /gives the new loop "build-2", around the check "tests", a bar of its own/);
});

test("A-019, the second reader's second: evidence replaced is not evidence added, whatever the edge's target is made in the same change", () => {
  const grind = builtIn("grind-loop");
  const replaced = adopt((w) => {
    (w.nodes.find((n) => n.id === "builder") as { role: string }).role = "critic";
    w.edges.find((e) => e.id === "e-tests-fail")!.evidence = ["a note that the build went well"];
  }, { from: grind });
  assert.deepEqual(names(replaced), ["edge:e-tests-fail.evidence"]);
  // More handed to a critic the graph had, with nothing taken away, still passes; one piece swapped for another does not.
  const rare = builtIn("fresh-grind-rare-judge");
  const handed = rare.edges.find((e) => e.id === "e-tests-judge")!.evidence!;
  assert.deepEqual(adopt((w) => void (w.edges.find((e) => e.id === "e-tests-judge")!.evidence = [...handed, "the full log"]), { from: rare }).refused, []);
  assert.ok(names(adopt((w) => void (w.edges.find((e) => e.id === "e-tests-judge")!.evidence = [...handed.slice(1), "the full log"]), { from: rare })).includes("edge:e-tests-judge.evidence"));
});

test("A-019, the second reader's third: where a round cap already leads on to what the check's pass led to, a new way there is still held", () => {
  // The built-in retrospective: its cap and its budget both lead on to the retrospective step, and that to the end.
  const retro = builtIn("retrospective-rewrite");
  const cases: [string, (w: Graph) => void, string, RegExp][] = [
    ["the builder straight to the end", (w) => void w.edges.push({ id: "e-builder-done", from: "builder", to: "done" }), "edge:e-builder-done", /adds a way into "done" that does not pass the check "tests"/],
    ["the builder straight to the retrospective", (w) => void w.edges.push({ id: "e-builder-retro", from: "builder", to: "retro" }), "edge:e-builder-retro", /adds a way into "retro" that does not pass the check "tests"/],
    ["the builder to a stop of its own that ends in success", (w) => {
      w.nodes.push({ id: "done-too", kind: "stop", name: "Done too", outcome: "success" } as Node);
      w.edges.push({ id: "e-builder-done-too", from: "builder", to: "done-too", when: { verdict: "good-enough" } });
    }, "edge:e-builder-done-too", /adds a way from "builder" to end in success that does not pass the check "tests"/],
    ["a stop on diminishing returns that leads to the end", (w) => void w.loops[0]!.stops.unshift({ kind: "diminishing-returns", rounds: 1, then: "done" }), "loop:grind.stops", /a stop of the loop would lead on to "done", a way that does not pass the check "tests"/],
  ];
  for (const [what, change, name, why] of cases) {
    const check = adopt(change, { from: retro });
    assert.deepEqual(names(check), [name], what);
    assert.match(refused(check)[0]!, why, what);
  }
  // What the template is: its cap lowered is still a tightening, and nothing about the stops as they stand is held.
  assert.deepEqual(adopt((w) => void ((w.loops[0]!.stops[0] as { n: number }).n = 3), { from: retro }).refused, []);
  assert.deepEqual(adopt((w) => void (w.nodes.find((n) => n.id === "retro")!.name = "Look back"), { from: retro }).refused, []);
});

test("A-019: a condition written two ways is one condition; and a tightening's line does not carry the words of a line held either way", () => {
  const grind = builtIn("grind-loop");
  assert.deepEqual(adopt((w) => void (w.edges.find((e) => e.id === "e-tests-pass")!.when = { verdict: "pass" }), { from: grind }).refused, []);
  const asked = adopt((w) => void (w.edges.find((e) => e.id === "e-tests-pass")!.approval = true), { from: grind });
  assert.doesNotMatch(asked.changes.find((change) => change.name === "edge:e-tests-pass.approval")!.tightens!, /an edge that leaves the check/);
});

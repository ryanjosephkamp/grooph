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

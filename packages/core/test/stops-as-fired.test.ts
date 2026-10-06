/**
 * A loop's stops, compared as a run fires them (`brakes.ts`, `leadsOnFirst`; graph-ir §2: stops are evaluated at the
 * end of every pass, in document order, and the first that fires wins).
 *
 * Round two of the audit of 0.3.0's claims found that the comparison at `grooph adopt --write` and at
 * `grooph export --into` read the sizes of a loop's stops, kind by kind, and neither their order nor a kind the loop
 * did not have. Two limits swapped were adopted, and so was a new stop that leads on, put beside the one that halts.
 * The cases here are the audit lane's probes (`experiments/audits/0001-claims-as-of-0-3-0/tools/stop-order-probe.mjs`,
 * `stop-added-ahead-probe.mjs`, `stops-in-built-ins-probe.mjs`) and its fresh reader's variants (`round-02/lane-notes/
 * reconcile/fresh-reader/`), on the graphs they used.
 */

import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { checkAdoption, type AdoptionCheck } from "../src/adoption.js";
import { brakesLost } from "../src/brakes.js";
import { adoptWorkingCopy } from "../src/runs.js";
import type { Graph, Loop, Node, Stop } from "../src/types.js";
import { validate } from "../src/validate.js";
import { read, repoRoot } from "./helpers.js";

const done = { id: "done", kind: "stop", name: "Done", outcome: "success" };
/** A builder and a check that sends a failure back: the only way to the end is the check's pass. */
const checked = (stops: Stop[], more: { nodes?: unknown[]; loops?: unknown[] } = {}): Graph =>
  ({
    grooph: 0, id: "checked", name: "A loop with a check", version: 1, goal: "Build, test, and halt at the dispatch budget.", target: { harness: "claude-code" },
    nodes: [
      { id: "builder", kind: "agent", name: "Builder", role: "builder", brief: "Build.", outputs: ["out.txt"], allow: ["read-files", "edit-files"] },
      { id: "tests", kind: "check", name: "Tests", check: { kind: "command", run: "false", pass: "exit 0" } },
      done,
      ...(more.nodes ?? []),
    ],
    edges: [{ id: "e-build-test", from: "builder", to: "tests" }, { id: "e-test-fail", from: "tests", to: "builder", when: "fail" }, { id: "e-test-pass", from: "tests", to: "done", when: "pass" }],
    loops: [{ id: "work", name: "Work", members: ["builder", "tests"], back: ["e-test-fail"], mode: "grind", stops }, ...(more.loops ?? [])],
  }) as unknown as Graph;
/** No check and no critic: a worker, and a sorter that says "more" or "finished". Nothing stands before the end. */
const plain = (stops: Stop[], more: { nodes?: unknown[]; loops?: unknown[] } = {}): Graph =>
  ({
    grooph: 0, id: "plain", name: "A loop with no check", version: 1, goal: "Work through a list.", target: { harness: "claude-code" },
    nodes: [
      { id: "worker", kind: "agent", name: "Worker", role: "builder", brief: "Do the next item.", outputs: ["out.txt"], allow: ["read-files", "edit-files"] },
      { id: "sorter", kind: "agent", name: "Sorter", role: "planner", brief: "Say whether items remain.", outputs: ["LEFT.md"], allow: ["read-files", "write-outputs"] },
      done,
      ...(more.nodes ?? []),
    ],
    edges: [{ id: "e-w-s", from: "worker", to: "sorter" }, { id: "e-more", from: "sorter", to: "worker", when: { verdict: "more" } }, { id: "e-fin", from: "sorter", to: "done", when: { verdict: "finished" } }],
    loops: [{ id: "list", name: "List", members: ["worker", "sorter"], back: ["e-more"], mode: "grind", stops }, ...(more.loops ?? [])],
  }) as unknown as Graph;
/** A builder and a critic, with a bar. */
const judged = (stops: Stop[]): Graph =>
  ({
    grooph: 0, id: "judged", name: "A loop with a critic", version: 1, goal: "Build until the reviewer finds nothing blocking.", target: { harness: "claude-code" },
    nodes: [
      { id: "builder", kind: "agent", name: "Builder", role: "builder", brief: "Build.", outputs: ["out.txt"], allow: ["read-files", "edit-files"], model: { tier: "strong" } },
      { id: "critic", kind: "agent", name: "Critic", role: "critic", brief: "Review.", outputs: ["REVIEW.md"], allow: ["read-files"], model: { tier: "frontier" } },
      done,
    ],
    edges: [{ id: "e-b-c", from: "builder", to: "critic", evidence: ["out.txt"] }, { id: "e-c-fail", from: "critic", to: "builder", when: "fail", evidence: ["REVIEW.md"] }, { id: "e-c-pass", from: "critic", to: "done", when: "pass" }],
    loops: [{ id: "review", name: "Review", members: ["builder", "critic"], back: ["e-c-fail"], mode: "judgment", bar: { name: "bar", inspects: [{ kind: "artifact", ref: "out.txt" }], acceptance: "The reviewer finds nothing blocking." }, stops }],
    policies: [{ id: "p-critic-isolation", kind: "critic-isolation", scope: "graph" }, { id: "p-no-self-grading", kind: "no-self-grading", scope: "graph" }],
  }) as unknown as Graph;

/** What adoption would write of a working copy, held to its source: both must be graphs that validate for export. */
const adopt = (source: Graph, working: Graph, allow?: string[]): AdoptionCheck => {
  for (const doc of [source, working]) assert.deepEqual(validate(doc, { forExport: true }).filter((issue) => issue.severity === "error"), []);
  const adopted = adoptWorkingCopy(source, working, { run: "r1" });
  assert.ok(adopted.ok, adopted.ok ? "" : adopted.message);
  return checkAdoption(source, adopted.doc, allow ? { allow } : {});
};
const refused = (check: AdoptionCheck): string[] => check.refused.map((change) => `${change.name}: ${change.loosens}`);
const tightens = (check: AdoptionCheck): string[] => check.changes.filter((change) => change.tightens !== undefined).map((change) => `${change.name}: ${change.tightens}`);

const H: Stop = { kind: "budget", measure: "dispatches", limit: 2 };
const leadsOn: Stop = { ...H, then: "done" };
const cap = (n: number, then?: string): Stop => ({ kind: "max-iterations", n, ...(then ? { then } : {}) });
const far: Stop = { kind: "budget", measure: "usd", limit: 1000, then: "done" };

test("two limits swapped: the one that leads on put ahead of the one that halts is held, with the same size or of another kind", () => {
  // Two budgets of one size: both come due on one pass, and the first in the list wins.
  const equal = adopt(checked([H, leadsOn]), checked([leadsOn, H]));
  assert.deepEqual(refused(equal), ['loop:work.stops: the budget of 2 dispatches that leads on to "done" could fire on the same pass as the budget of 2 dispatches that halts the run, and it comes first in the loop\'s stops']);
  // A cap of one round and a budget of that round's dispatches.
  const mixed = adopt(checked([cap(1), leadsOn]), checked([leadsOn, cap(1)]));
  assert.deepEqual(refused(mixed), ['loop:work.stops: the budget of 2 dispatches that leads on to "done" could fire on the same pass as the round cap of 1 that halts the run, and it comes first in the loop\'s stops']);
  // Neither is called a tightening, and each is taken when asked for by name.
  for (const check of [equal, mixed]) assert.deepEqual(tightens(check), []);
  assert.deepEqual(adopt(checked([H, leadsOn]), checked([leadsOn, H]), ["loop:work.stops"]).refused, []);
  // Swapped the other way, the one that halts put first, it is a tightening.
  for (const [source, working] of [[checked([leadsOn, H]), checked([H, leadsOn])], [checked([leadsOn, cap(1)]), checked([cap(1), leadsOn])]] as const) {
    const back = adopt(source, working);
    assert.deepEqual(refused(back), []);
    assert.deepEqual(tightens(back).map((line) => line.split(":")[1]), ["work.stops"]);
  }
  // The probe's control: a budget that halts, raised.
  assert.deepEqual(refused(adopt(checked([H]), checked([{ ...H, limit: 4 }]))), ["loop:work.stops: raises the budget from 2 to 4 dispatches"]);
});

test("a new stop that leads on, of a kind the loop did not have, is held beside the one that halts: ahead of it or behind it", () => {
  const cases: [string, Graph, Graph, string][] = [
    // The audit lane's three open cases, which are the fresh reader's (e), (e4) and (e2): nothing stands before the end.
    ["a cap of one round, ahead", plain([H]), plain([cap(1, "done"), H]), 'the round cap of 1 that leads on to "done" could fire before the budget of 2 dispatches that halts the run'],
    ["the same cap, behind", plain([H]), plain([H, cap(1, "done")]), 'the round cap of 1 that leads on to "done" could fire before the budget of 2 dispatches that halts the run'],
    ["a stop on diminishing returns, ahead", plain([H]), plain([{ kind: "diminishing-returns", rounds: 1, then: "done" }, H]), 'the stop on diminishing returns over 1 round that leads on to "done" could fire before the budget of 2 dispatches that halts the run'],
    ["a stop on invalid evidence, behind", plain([H]), plain([H, { kind: "evidence-invalid", rounds: 1, then: "done" }]), 'the stop on evidence invalid for 1 round that leads on to "done" could fire before the budget of 2 dispatches that halts the run'],
    ["a budget of another measure, behind", plain([H]), plain([H, { kind: "budget", measure: "usd", limit: 0.01, then: "done" }]), 'the budget of 0.01 usd that leads on to "done" could fire before the budget of 2 dispatches that halts the run'],
    // The control, the reader's (e3): the same kind and size, which the sizes already held.
    ["a budget of the same kind and size, ahead", plain([H]), plain([leadsOn, H]), 'the budget of 2 dispatches that leads on to "done" would fire as soon as the one of 2 dispatches that halts the run'],
  ];
  for (const [what, source, working, why] of cases) {
    const check = adopt(source, working);
    assert.deepEqual(refused(check), [`loop:list.stops: ${why}`], what);
    assert.deepEqual(tightens(check), [], what);
  }
  // Behind a check it was held already, as a way that does not pass the check, though it was printed as a tightening.
  const behind = adopt(checked([H]), checked([cap(1, "done"), H]));
  assert.deepEqual(refused(behind), ['loop:work.stops: the round cap of 1 that leads on to "done" could fire before the budget of 2 dispatches that halts the run; a stop of the loop would lead on to "done", a way that does not pass the check "tests"']);
});

test("the fresh reader's variants: each that was adopted with nothing refused is held, and each that was held is held still", () => {
  const held: [string, Graph, Graph, RegExp][] = [
    // Open at 0.4.0.
    ["3, a new cap that leads where a far budget led, ahead", checked([H, far]), checked([cap(1, "done"), H, far]), /the round cap of 1 that leads on to "done" could fire before the budget of 2 dispatches that halts the run/],
    ["5, the far budget moved ahead", checked([H, far]), checked([far, H]), /the budget of 1000 usd that leads on to "done" could fire on the same pass as the budget of 2 dispatches that halts the run, and it comes first in the loop's stops/],
    ["6, the far budget lowered, not moved", checked([H, far]), checked([H, { ...far, limit: 0.01 }]), /the budget of 0\.01 usd that leads on to "done" could fire before the budget of 2 dispatches that halts the run/],
    ["7, a budget that leads on lowered to fire a round before the cap", checked([cap(3), { ...H, limit: 100, then: "done" }]), checked([cap(3), { ...H, then: "done" }]), /the budget of 2 dispatches that leads on to "done" could fire before the round cap of 3 that halts the run/],
    ["14, the swap of equal budgets", checked([H, leadsOn]), checked([leadsOn, H]), /could fire on the same pass as the budget of 2 dispatches that halts the run/],
    // Held before, and still.
    ["1, diminishing returns ahead, behind a check", checked([H]), checked([{ kind: "diminishing-returns", rounds: 1, then: "done" }, H]), /a way that does not pass the check "tests"/],
    ["8, a `then` put on the first of two that halt", checked([cap(1), H]), checked([cap(1, "done"), H]), /the round cap \(1\) would no longer halt the run/],
    ["9, the far budget made a cap of one, ahead", checked([H, far]), checked([cap(1, "done"), H]), /removes the budget \(1000 usd\)/],
    ["10, the far budget made a budget of turns, ahead", checked([H, far]), checked([{ kind: "budget", measure: "turns", limit: 1, then: "done" }, H]), /removes the budget \(1000 usd\)/],
  ];
  for (const [what, source, working, why] of held) {
    const lines = refused(adopt(source, working));
    assert.equal(lines.length, 1, what);
    assert.match(lines[0]!, /^loop:work\.stops: /, what);
    assert.match(lines[0]!, why, what);
  }
  // 11: a stop that halts by leading to a node that halts, led to the end instead.
  const halted = { nodes: [{ id: "halted", kind: "stop", name: "Halted", outcome: "halt" }] };
  assert.match(refused(adopt(checked([{ ...H, then: "halted" }, far], halted), checked([{ ...H, then: "done" }, far], halted)))[0]!, /^loop:work\.stops: the budget \(2 dispatches\) would no longer halt the run/);
  // 12: a second loop on the same back edge, with a cap of one that leads on. Behind the check it was held as a way
  // round the check; where nothing stands before the end it was adopted.
  const second = (stops: Stop[], members: string[], back: string): { loops: unknown[] } => ({ loops: [{ id: "again", name: "Again", members, back: [back], mode: "grind", stops }] });
  assert.match(refused(adopt(checked([H, far]), checked([H, far], second([cap(1, "done")], ["builder", "tests"], "e-test-fail"))))[0]!, /^loop:again: /);
  assert.deepEqual(refused(adopt(plain([H]), plain([H], second([cap(1, "done")], ["worker", "sorter"], "e-more")))), [
    'loop:again: the loop "again" would count rounds that "list" counts, and the round cap of 1 among its stops, which leads on to "done", could fire before the budget of 2 dispatches that halts the run',
  ]);
  // (A second loop there whose cap halts is a brake more, and is adopted.)
  assert.deepEqual(refused(adopt(plain([H]), plain([H], second([cap(1)], ["worker", "sorter"], "e-more")))), []);
  // 13: a new stop where a person is asked, and the run goes on at the end. Named, and not refused: the person is
  // the brake on it.
  const asked = adopt(checked([H, far]), checked([{ kind: "human", every: 1, then: "done" }, H, far]));
  assert.deepEqual(refused(asked), []);
  assert.deepEqual(asked.changes.map((change) => change.name), ["loop:work.stops"]);
  // (d): "bar passed" moved behind the cap that halts, in a loop a critic judges. Adopted, as it was.
  const limits = [cap(1), H];
  assert.deepEqual(refused(adopt(judged([{ kind: "bar-passed" }, ...limits]), judged([...limits, { kind: "bar-passed" }]))), []);
  // (b0), (b2), (b3): a new stop that leads on, ahead of the limits of a loop a critic judges.
  for (const lead of [{ kind: "budget", measure: "usd", limit: 0.01, then: "done" }, { kind: "diminishing-returns", rounds: 1, then: "done" }, cap(1, "done")] as Stop[]) {
    const lines = refused(adopt(judged([{ kind: "bar-passed" }, ...limits]), judged([{ kind: "bar-passed" }, lead, ...limits])));
    assert.equal(lines.length, 1, lead.kind);
    assert.match(lines[0]!, /^loop:review\.stops: .*a stop of the loop would lead on to "done", a way that does not pass the critic "critic"/, lead.kind);
  }
});

test("what a run could not do is not held: a stop that leads on and can never fire before the one that halts", () => {
  const dr = (rounds: number): Stop => ({ kind: "diminishing-returns", rounds, then: "done" });
  const cases: [string, Stop[], Stop[], boolean][] = [
    // Rounds without progress cannot be counted before there have been that many rounds.
    ["over four rounds, ahead of a cap of three", [cap(3)], [dr(4), cap(3)], false],
    ["over three rounds, behind a cap of three", [cap(3)], [cap(3), dr(3)], false],
    ["over three rounds, ahead of a cap of three", [cap(3)], [dr(3), cap(3)], true],
    ["over two rounds, behind a cap of three", [cap(3)], [cap(3), dr(2)], true],
    // A person who is asked every two rounds is asked before a cap of three comes due, and a run is taken to be
    // theirs from there; a cap of one comes first.
    ["a cap of three, behind a person asked every two rounds", [{ kind: "human", every: 2 }], [{ kind: "human", every: 2 }, cap(3, "done")], false],
    ["a cap of one, behind a person asked every two rounds", [{ kind: "human", every: 2 }], [{ kind: "human", every: 2 }, cap(1, "done")], true],
    // A budget may come due on any pass: behind a cap of one it cannot fire first, and behind a cap of two it can.
    ["a budget, behind a cap of one", [cap(1)], [cap(1), leadsOn], false],
    ["a budget, behind a cap of two", [cap(2)], [cap(2), leadsOn], true],
    // Of two budgets of one measure the larger is never due alone; it wins only where it stands first.
    ["a larger budget of the same measure, behind", [H], [H, { ...H, limit: 3, then: "done" }], false],
  ];
  for (const [what, was, now, held] of cases) assert.equal(refused(adopt(plain(was), plain(now))).length > 0, held, what);
  // Where the loop holds no stop that halts, there is nothing for a stop that leads on to come before: adopted, and
  // not called a tightening.
  for (const now of [[cap(1, "done"), leadsOn], [{ ...H, limit: 1, then: "done" } as Stop], [dr(1), leadsOn]]) {
    const check = adopt(plain([leadsOn]), plain(now));
    assert.deepEqual(refused(check), []);
    assert.deepEqual(tightens(check), []);
  }
});

test("a stop that halts is a tightening, new or lowered; a stop that leads on is never the reason for that word", () => {
  // New, of a kind the loop did not have and of one it had; and lowered.
  for (const now of [[cap(1), H], [H, cap(5)], [{ ...H, limit: 1 } as Stop], [H, { kind: "budget", measure: "minutes", limit: 30 } as Stop]]) {
    const check = adopt(plain([H]), plain(now));
    assert.deepEqual(refused(check), [], JSON.stringify(now));
    assert.equal(tightens(check).length, 1, JSON.stringify(now));
  }
  assert.deepEqual(tightens(adopt(plain([H]), plain([cap(1), H]))), ["loop:list.stops: removes the round cap (1)"]);
  // A stop that leads on, allowed by name: the change is adopted, and still nothing calls it a tightening. (Before,
  // a new cap of one round that led to the end was printed as "tightens a brake: undoing it removes the round cap".)
  for (const now of [[cap(1, "done"), H], [H, cap(1, "done")], [{ kind: "budget", measure: "usd", limit: 0.01, then: "done" } as Stop, H]]) {
    const check = adopt(plain([H]), plain(now), ["loop:list.stops"]);
    assert.deepEqual(refused(check), [], JSON.stringify(now));
    assert.deepEqual(tightens(check), [], JSON.stringify(now));
  }
  // "Bar passed" with a `then`, in a loop no critic judges, is nobody's verdict: a stop like the others.
  assert.deepEqual(refused(adopt(plain([H]), plain([{ kind: "bar-passed", then: "done" }, H]))), ['loop:list.stops: the stop on "bar passed" that leads on to "done" could fire before the budget of 2 dispatches that halts the run']);
});

/** A built-in template as `grooph template use` leaves it: its slots filled from their examples, a harness named. */
const builtIns = (): [string, Graph][] =>
  ["patterns", "plans"].flatMap((dir) =>
    readdirSync(join(repoRoot, dir))
      .filter((file) => file.endsWith(".grooph.json"))
      .sort()
      .map((file): [string, Graph] => {
        const template = JSON.parse(read(join(repoRoot, dir, file))) as Graph & { template?: { slots?: { key: string; example?: unknown }[] } };
        let text = JSON.stringify({ ...template, template: undefined });
        for (const slot of template.template?.slots ?? []) text = text.split(`{{${slot.key}}}`).join(String(slot.example).replace(/\\/g, "\\\\").replace(/"/g, '\\"'));
        const doc = JSON.parse(text) as Graph;
        doc.target ??= { harness: "claude-code" } as Graph["target"];
        if (!doc.goal) doc.goal = "A goal, for the test: two built-in templates are fragments and carry none.";
        return [`${dir}/${file.replace(".grooph.json", "")}`, doc];
      }),
  );

test("the built-in templates and the plan templates: none is held against itself, and debate-then-build's limits swapped the other way are a tightening", () => {
  const all = builtIns();
  assert.ok(all.length >= 24);
  for (const [name, doc] of all) {
    assert.deepEqual(brakesLost(doc, structuredClone(doc)), [], name);
    // With its stops written in the order they have, loop by loop, and nothing else: no change, and nothing held.
    assert.deepEqual(checkAdoption(doc, structuredClone(doc)).changes, [], name);
  }
  // The one built-in loop that holds a limit that leads on ahead of one that halts: two rounds of debate lead to the
  // judge, and eight dispatches halt. With the budget put first the judge is reached no sooner and the halt no later.
  const debate = all.find(([name]) => name === "patterns/debate-then-build")![1];
  const stops = (doc: Graph): Stop[] => doc.loops.find((loop) => loop.id === "debate")!.stops;
  assert.deepEqual(stops(debate).map((stop) => `${stop.kind}${stop.then ? ` then ${stop.then}` : ""}`), ["bar-passed", "max-iterations then judge", "budget"]);
  const swapped = structuredClone(debate);
  swapped.loops.find((loop) => loop.id === "debate")!.stops = [stops(debate)[0]!, stops(debate)[2]!, stops(debate)[1]!];
  const tighter = adopt(debate, swapped);
  assert.deepEqual(refused(tighter), []);
  assert.deepEqual(tightens(tighter), ['loop:debate.stops: the round cap of 2 that leads on to "judge" could fire on the same pass as the budget of 8 dispatches that halts the run, and it comes first in the loop\'s stops']);
  // And back again it is held: the copy would put the cap that leads on ahead of the budget that halts.
  assert.deepEqual(refused(adopt(swapped, debate)), ['loop:debate.stops: the round cap of 2 that leads on to "judge" could fire on the same pass as the budget of 8 dispatches that halts the run, and it comes first in the loop\'s stops']);
});

test("what docs/runs.md says of the built-ins: what an honest change costs, and each thing this still does not hold", () => {
  const all = new Map(builtIns());
  const stopsOf = (doc: Graph, id: string): Stop[] => doc.loops.find((loop) => loop.id === id)!.stops;
  const changed = (name: string, change: (working: Graph) => void): AdoptionCheck => {
    const source = all.get(name)!;
    const working = structuredClone(source);
    change(working);
    return adopt(source, working);
  };
  // The price: on the debate, the cap of two rounds that leads to the judge, lowered to one, is held for the budget
  // of eight dispatches (three agents a round cannot spend eight on the first pass, and the comparison does not
  // reason about what a pass spends); and so is a second limit that leads to the judge.
  assert.deepEqual(refused(changed("patterns/debate-then-build", (w) => void ((stopsOf(w, "debate")[1] as { n: number }).n = 1))), [
    'loop:debate.stops: the round cap of 1 that leads on to "judge" could fire on the same pass as the budget of 8 dispatches that halts the run, and it comes first in the loop\'s stops',
  ]);
  assert.match(refused(changed("patterns/debate-then-build", (w) => void stopsOf(w, "debate").splice(2, 0, { kind: "budget", measure: "minutes", limit: 1, then: "judge" })))[0]!, /^loop:debate\.stops: the budget of 1 minutes that leads on to "judge" could fire /);
  // Its budget that halts, lowered, is a tightening as it was.
  const lower = changed("patterns/debate-then-build", (w) => void ((stopsOf(w, "debate")[2] as { limit: number }).limit = 6));
  assert.deepEqual([refused(lower), tightens(lower)], [[], ["loop:debate.stops: raises the budget from 6 to 8 dispatches"]]);

  // Not held, each said in the list. A stop that leads on, lowered or added, where the loop holds no stop that
  // halts (the retrospective): adopted, and given no word. Raised, it is held as it was.
  for (const change of [(w: Graph) => void ((stopsOf(w, "grind")[0] as { n: number }).n = 4), (w: Graph) => void stopsOf(w, "grind").push({ kind: "budget", measure: "dispatches", limit: 4, then: "retro" })]) {
    const check = changed("patterns/retrospective-rewrite", change);
    assert.deepEqual([refused(check), tightens(check)], [[], []]);
  }
  assert.deepEqual(refused(changed("patterns/retrospective-rewrite", (w) => void ((stopsOf(w, "grind")[0] as { n: number }).n = 9))), ["loop:grind.stops: raises the round cap from 5 to 9"]);
  // A stop that halts on diminishing returns is not on A-008's list: its removal is not held.
  assert.equal(stopsOf(all.get("patterns/gauntlet-decomposed")!, "polish")[1]!.kind, "diminishing-returns");
  assert.deepEqual(refused(changed("patterns/gauntlet-decomposed", (w) => void stopsOf(w, "polish").splice(1, 1))), []);
  // "Bar passed" in a loop a critic judges, moved ahead of the limits that halt: not held. (Moved behind them, the
  // fresh reader's control, it is adopted too, and neither is given a word.)
  const gate = all.get("patterns/review-gate")!;
  const behind = structuredClone(gate);
  behind.loops[0]!.stops = [...gate.loops[0]!.stops.slice(1), gate.loops[0]!.stops[0]!];
  assert.equal(gate.loops[0]!.stops[0]!.kind, "bar-passed");
  for (const [source, working] of [[behind, gate], [gate, behind]] as const) {
    const check = adopt(source, working);
    assert.deepEqual([refused(check), tightens(check)], [[], []]);
  }
  // A new stop where a person is asked, that continues in the loop, ahead of its cap: the person's, and still
  // printed as a tightening.
  const asked = changed("patterns/debate-then-build", (w) => void stopsOf(w, "build").unshift({ kind: "human", every: 1, then: "builder" }));
  assert.deepEqual([refused(asked), tightens(asked)], [[], ["loop:build.stops: removes the stop where a person is asked"]]);
});

test("in every built-in loop, a new stop that leads on with nobody asked, put ahead of its first limit that halts, is held", () => {
  // The audit lane's probe of the built-ins, as a rule: every kind of stop, leading on to every node of the graph in
  // turn. What is not held is a stop where a person is asked (named, and the person's to allow), and a stop that
  // leads to a human gate, which is a stop that asks a person. At 0.4.0 seven more went through, each on
  // debate-then-build: a stop of another kind that led where its cap already leads.
  const NEW: Stop[] = [
    { kind: "max-iterations", n: 1 }, { kind: "budget", measure: "dispatches", limit: 1 }, { kind: "budget", measure: "minutes", limit: 1 }, { kind: "budget", measure: "usd", limit: 0.01 },
    { kind: "budget", measure: "turns", limit: 1 }, { kind: "budget", measure: "tokens", limit: 1 }, { kind: "diminishing-returns", rounds: 1 }, { kind: "evidence-invalid", rounds: 1 }, { kind: "human", every: 1 },
  ];
  const limit = (stop: Stop): boolean => ["budget", "max-iterations", "diminishing-returns", "evidence-invalid"].includes(stop.kind);
  let tried = 0;
  const open: string[] = [];
  const count = { person: 0, gate: 0 };
  for (const [name, source] of builtIns()) {
    if (validate(source, { forExport: true }).some((issue) => issue.severity === "error" && issue.code !== "E_PERSON_STEP_NOT_COMPILED")) continue;
    source.loops.forEach((loop: Loop, at: number) => {
      const first = loop.stops.findIndex((stop) => limit(stop) && !stop.then);
      if (first < 0) return;
      for (const add of NEW) {
        for (const node of source.nodes as Node[]) {
          const working = structuredClone(source);
          working.loops[at]!.stops.splice(first, 0, { ...add, then: node.id });
          if (validate(working).some((issue) => issue.severity === "error")) continue;
          tried += 1;
          const adopted = adoptWorkingCopy(source, working, { run: "r1" });
          // (A plan, which has a person's step, is not adopted at all, since no package is made of one: compared as it is.)
          assert.ok(adopted.ok || /E_PERSON_STEP_NOT_COMPILED/.test(adopted.message), adopted.ok ? "" : adopted.message);
          const check = checkAdoption(source, adopted.ok ? adopted.doc : working);
          if (check.refused.length > 0) continue;
          if (add.kind === "human") count.person += 1;
          else if (node.kind === "human-gate") count.gate += 1;
          else open.push(`${name} · ${loop.id}: ${add.kind} then ${node.id}`);
        }
      }
    });
  }
  assert.deepEqual(open, []);
  assert.ok(tried > 1000, String(tried));
  assert.ok(count.person > 0 && count.gate > 0, JSON.stringify(count));
});

/**
 * A loop's stops, compared as a run fires them (`brakes.ts`, `leadsOnFirst`; graph-ir §2: stops are evaluated at the
 * end of every pass, in document order, and the first that fires wins).
 *
 * Round two of the audit of 0.3.0's claims found that the comparison at `grooph adopt --write` and at
 * `grooph export --into` read the sizes of a loop's stops, kind by kind, and neither their order nor a kind the loop
 * did not have. Two limits swapped were adopted, and so was a new stop that leads on, put beside the one that halts.
 * The cases here are the audit lane's probes (`experiments/audits/0001-claims-as-of-0-3-0/tools/stop-order-probe.mjs`,
 * `stop-added-ahead-probe.mjs`, `stops-in-built-ins-probe.mjs`) and its fresh reader's variants (`round-02/lane-notes/
 * reconcile/fresh-reader/`), on the graphs they used; then the cases of the driver's reader of the first cut (a
 * person's stop, "bar passed" with no `then`, the word "tightens", how long one loop takes), and a model of the firing
 * rule written apart from the comparison, which it is held to on some thousands of lists.
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
/** What is named and not called a tightening: what undoing the change would do. */
const unjudged = (check: AdoptionCheck): string[] => check.changes.filter((change) => change.unjudged !== undefined).map((change) => `${change.name}: ${change.unjudged}`);

const H: Stop = { kind: "budget", measure: "dispatches", limit: 2 };
const leadsOn: Stop = { ...H, then: "done" };
const cap = (n: number, then?: string): Stop => ({ kind: "max-iterations", n, ...(then ? { then } : {}) });
const far: Stop = { kind: "budget", measure: "usd", limit: 1000, then: "done" };


const person = (every = 1, then?: string): Stop => ({ kind: "human", ...(every === 1 ? {} : { every }), ...(then ? { then } : {}) });

test("two limits swapped: the one that leads on put ahead of the one that halts is held, with the same size or of another kind", () => {
  // Two budgets of one size: both come due on one pass, and the first in the list wins.
  const equal = adopt(checked([H, leadsOn]), checked([leadsOn, H]));
  assert.deepEqual(refused(equal), ['loop:work.stops: the budget of 2 dispatches that leads on to "done" would be moved ahead of the budget of 2 dispatches that halts the run, and could fire on the same pass']);
  // A cap of one round and a budget of that round's dispatches.
  const mixed = adopt(checked([cap(1), leadsOn]), checked([leadsOn, cap(1)]));
  assert.deepEqual(refused(mixed), ['loop:work.stops: the budget of 2 dispatches that leads on to "done" would be moved ahead of the round cap of 1 that halts the run, and could fire on the same pass']);
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
  const before = "would come into the loop, and could fire before the budget of 2 dispatches that halts the run";
  const cases: [string, Graph, Graph, string][] = [
    // The audit lane's three open cases, which are the fresh reader's (e), (e4) and (e2): nothing stands before the end.
    ["a cap of one round, ahead", plain([H]), plain([cap(1, "done"), H]), `the round cap of 1 that leads on to "done" ${before}`],
    ["the same cap, behind", plain([H]), plain([H, cap(1, "done")]), `the round cap of 1 that leads on to "done" ${before}`],
    ["a stop on diminishing returns, ahead", plain([H]), plain([{ kind: "diminishing-returns", rounds: 1, then: "done" }, H]), `the stop on diminishing returns over 1 round that leads on to "done" ${before}`],
    ["a stop on invalid evidence, behind", plain([H]), plain([H, { kind: "evidence-invalid", rounds: 1, then: "done" }]), `the stop on evidence invalid for 1 round that leads on to "done" ${before}`],
    ["a budget of another measure, behind", plain([H]), plain([H, { kind: "budget", measure: "usd", limit: 0.01, then: "done" }]), `the budget of 0.01 usd that leads on to "done" ${before}`],
    // The control, the reader's (e3): the same kind and size, which the sizes already held. Both reasons are said.
    ["a budget of the same kind and size, ahead", plain([H]), plain([leadsOn, H]), 'the budget of 2 dispatches that leads on to "done" would fire as soon as the one of 2 dispatches that halts the run; the budget of 2 dispatches that leads on to "done" would come into the loop, and could fire on the same pass as the budget of 2 dispatches that halts the run, where it would be the one obeyed'],
  ];
  for (const [what, source, working, why] of cases) {
    const check = adopt(source, working);
    assert.deepEqual(refused(check), [`loop:list.stops: ${why}`], what);
    assert.deepEqual(tightens(check), [], what);
  }
  // Behind a check it was held already, as a way that does not pass the check, though it was printed as a tightening.
  const behind = adopt(checked([H]), checked([cap(1, "done"), H]));
  assert.deepEqual(refused(behind), [`loop:work.stops: the round cap of 1 that leads on to "done" ${before}; a stop of the loop would lead on to "done", a way that does not pass the check "tests"`]);
  // One of anything is one: "1 dispatch", "1 round".
  assert.match(refused(adopt(plain([cap(5)]), plain([{ ...leadsOn, limit: 1 }, cap(5)])))[0]!, /the budget of 1 dispatch that leads on to "done" would come into the loop/);
});

test("the line says what became of the stop, and a reason of the same kind beside it is not hidden", () => {
  const budget = (limit: number, then?: string): Stop => ({ kind: "budget", measure: "dispatches", limit, ...(then ? { then } : {}) });
  const extra = { nodes: [{ id: "wrap", kind: "agent", name: "Wrap", role: "builder", brief: "Wrap up.", outputs: ["WRAP.md"], allow: ["read-files", "write-outputs"] }, { id: "gate", kind: "human-gate", name: "Go on?", prompt: "Go on?", options: ["approve", "reject"] }, { id: "failed", kind: "stop", name: "Failed", outcome: "halt" }] };
  const at = (was: Stop[], now: Stop[]): string => refused(adopt(plain(was, extra), plain(now, extra))).join("\n");
  // Lowered: that it stands first in the list was as true when it was three. What is new is the number.
  assert.equal(at([cap(3, "done"), budget(3)], [cap(2, "done"), budget(3)]), 'loop:list.stops: the round cap of 2 that leads on to "done" would go from 3 to 2, and could fire on the same pass as the budget of 3 dispatches that halts the run, where it would be the one obeyed');
  // Given a `then` where it halted.
  assert.equal(at([cap(2), budget(9)], [cap(2, "done"), budget(9)]), 'loop:list.stops: the round cap (2) would no longer halt the run; the round cap of 2 would lead on to "done", where it halted the run');
  // As it was, with what stood ahead of it changed: the cap that halted on the first pass is raised.
  assert.equal(at([cap(1), budget(3, "done")], [cap(2), budget(3, "done")]), 'loop:list.stops: raises the round cap from 1 to 2; the budget of 3 dispatches that leads on to "done" could fire on the same pass as the round cap of 1 that halts the run, where it would be the one obeyed, as it could not before');
  // The driver's reader's: a new cap of one beside a cap of three, of the same kind, leading elsewhere. The older
  // line spoke of where the kind leads, and the new one was dropped for it.
  assert.equal(
    at([cap(3, "done"), budget(3, "gate")], [cap(1, "wrap"), cap(3, "done"), budget(3, "gate")]),
    'loop:list.stops: the round cap would lead on to "wrap", not to "done"; the round cap of 1 that leads on to "wrap" would come into the loop, and could fire before the budget of 3 dispatches that halts the run',
  );
});

test("the fresh reader's variants: each that was adopted with nothing refused is held, and each that was held is held still", () => {
  const held: [string, Graph, Graph, RegExp][] = [
    // Open at 0.4.0.
    ["3, a new cap that leads where a far budget led, ahead", checked([H, far]), checked([cap(1, "done"), H, far]), /the round cap of 1 that leads on to "done" would come into the loop, and could fire before the budget of 2 dispatches that halts the run/],
    ["5, the far budget moved ahead", checked([H, far]), checked([far, H]), /the budget of 1000 usd that leads on to "done" would be moved ahead of the budget of 2 dispatches that halts the run, and could fire on the same pass/],
    ["6, the far budget lowered, not moved", checked([H, far]), checked([H, { ...far, limit: 0.01 }]), /the budget of 0\.01 usd that leads on to "done" would go from 1000 to 0\.01, and could fire before the budget of 2 dispatches that halts the run/],
    ["7, a budget that leads on lowered to fire a round before the cap", checked([cap(3), { ...H, limit: 100, then: "done" }]), checked([cap(3), { ...H, then: "done" }]), /the budget of 2 dispatches that leads on to "done" would go from 100 to 2, and could fire before the round cap of 3 that halts the run/],
    ["14, the swap of equal budgets", checked([H, leadsOn]), checked([leadsOn, H]), /would be moved ahead of the budget of 2 dispatches that halts the run, and could fire on the same pass/],
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
  assert.match(refused(adopt(checked([{ ...H, then: "halted" }, far], halted), checked([{ ...H, then: "done" }, far], halted)))[0]!, /^loop:work\.stops: the budget \(2 dispatches\) would no longer halt the run; the budget of 2 dispatches would lead on to "done", not to "halted", where it halted the run$/);
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
  // the brake on it. Not called a tightening either, since it leads somewhere: it is listed as not judged.
  const asked = adopt(checked([H, far]), checked([person(1, "done"), H, far]));
  assert.deepEqual([refused(asked), tightens(asked)], [[], []]);
  assert.match(unjudged(asked).join("\n"), /^loop:work\.stops: removes the stop where a person is asked; /);
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
    // A budget may come due on any pass: behind a cap of one it cannot fire first, and behind a cap of two it can.
    ["a budget, behind a cap of one", [cap(1)], [cap(1), leadsOn], false],
    ["a budget, behind a cap of two", [cap(2)], [cap(2), leadsOn], true],
    // Of two budgets of one measure the larger is never due alone; it wins only where it stands first.
    ["a larger budget of the same measure, behind", [H], [H, { ...H, limit: 3, then: "done" }], false],
    // Behind a person who is asked on every pass, nothing is ever obeyed.
    ["a cap of one, behind a person asked every round", [person(), H], [person(), cap(1, "done"), H], false],
    ["a cap of one, ahead of that person", [person(), H], [cap(1, "done"), person(), H], true],
  ];
  for (const [what, was, now, held] of cases) assert.equal(refused(adopt(plain(was), plain(now))).length > 0, held, what);
  // Where the loop holds no stop that halts and none that asks, there is nothing for a stop that leads on to come
  // before: adopted, and not called a tightening.
  for (const now of [[cap(1, "done"), leadsOn], [{ ...H, limit: 1, then: "done" } as Stop], [dr(1), leadsOn]]) {
    const check = adopt(plain([leadsOn]), plain(now));
    assert.deepEqual([refused(check), tightens(check)], [[], []]);
  }
});

test("a person's stop ends nothing: it excuses no stop that fires after it, and each asking is one a stop may not lead on before", () => {
  const big: Stop = { kind: "budget", measure: "dispatches", limit: 9 };
  const wrap = { nodes: [{ id: "wrap", kind: "agent", name: "Wrap", role: "builder", brief: "Wrap up.", outputs: ["WRAP.md"], allow: ["read-files", "write-outputs"] }], edges: [] };
  const withWrap = (stops: Stop[]): Graph => {
    const doc = plain(stops, wrap);
    doc.edges.push({ id: "e-wrap", from: "sorter", to: "wrap", when: { verdict: "wrap" } }, { id: "e-wrap-done", from: "wrap", to: "done" });
    return doc;
  };
  const cases: [string, Graph, Graph, string][] = [
    // The copy asks a person every round, last, and a cap of two leads on, first. On the first pass the person is
    // asked; on a yes the second pass ends in success, ahead of the budget. (Adopted before, and printed as a tightening.)
    ["a person's stop added behind the stop that leads on", plain([big]), plain([cap(2, "done"), big, person()]), 'the round cap of 2 that leads on to "done" would come into the loop, and could fire before the budget of 9 dispatches that halts the run'],
    ["the same, the person's stop continuing in the loop", plain([big]), plain([cap(2, "done"), big, person(1, "worker")]), 'the round cap of 2 that leads on to "done" would come into the loop, and could fire before the budget of 9 dispatches that halts the run'],
    // The source asks a person every round. A cap of two put first takes every asking from the second on.
    ["a cap of two ahead of a person asked every round", plain([person(), big]), plain([cap(2, "done"), person(), big]), 'the round cap of 2 that leads on to "done" would come into the loop, and could fire before the stop where a person is asked'],
    ["a cap of three ahead of a person asked every two rounds", plain([person(2), big]), plain([cap(3, "done"), person(2), big]), 'the round cap of 3 that leads on to "done" would come into the loop, and could fire before the stop where a person is asked every 2 rounds'],
    // And behind that person: asked on the second pass, they say go on, and the third ends in success.
    ["a cap of three behind a person asked every two rounds", plain([person(2)]), plain([person(2), cap(3, "done")]), 'the round cap of 3 that leads on to "done" would come into the loop, and could fire before the stop where a person is asked every 2 rounds'],
    // A person's stop that continues elsewhere is one where a person is asked: protected like one that halts.
    ["[human then wrap] -> [cap 1 then wrap | human then wrap]", withWrap([person(1, "wrap")]), withWrap([cap(1, "wrap"), person(1, "wrap")]), 'the round cap of 1 that leads on to "wrap" would come into the loop, and could fire before the stop where a person is asked'],
    ["[human every 2 then done] -> [budget 1 then done | human every 2 then done]", plain([person(2, "done")]), plain([{ ...leadsOn, limit: 1 }, person(2, "done")]), 'the budget of 1 dispatch that leads on to "done" would come into the loop, and could fire before the stop where a person is asked every 2 rounds'],
  ];
  for (const [what, source, working, why] of cases) {
    const check = adopt(source, working);
    assert.deepEqual(refused(check), [`loop:list.stops: ${why}`], what);
    assert.deepEqual(tightens(check), [], what);
  }
  // A new stop where a person is asked is still named and not refused, wherever it stands and wherever it goes on.
  for (const now of [[person(), big], [big, person(2)], [person(1, "done"), big], [big, person(3, "done")]]) assert.deepEqual(refused(adopt(plain([big]), plain(now))), [], JSON.stringify(now));
});

test('"bar passed" in a loop no critic judges is a stop that leads on, with a `then` or with none', () => {
  const bar = { name: "List done", inspects: [{ kind: "file", ref: "LEFT.md" }], acceptance: "LEFT.md is empty." };
  const withBar = (doc: Graph): Graph => {
    Object.assign(doc.loops[0]!, { mode: "judgment", bar });
    return doc;
  };
  const passed: Stop = { kind: "bar-passed" };
  const name = 'the stop on "bar passed", which follows the loop\'s pass edges,';
  const cases: [string, Graph, Graph, string][] = [
    // The driver's reader's: a planner says the list is done, and no critic. The run follows the loop's pass edges.
    ["swapped ahead of the cap that halts", withBar(plain([cap(2), passed])), withBar(plain([passed, cap(2)])), `loop:list.stops: ${name} would be moved ahead of the round cap of 2 that halts the run, and could fire on the same pass`],
    ["new, ahead of the cap", withBar(plain([cap(2)])), withBar(plain([passed, cap(2)])), `loop:list.stops: ${name} would come into the loop, and could fire before the round cap of 2 that halts the run`],
    ["new, behind the cap: it may be met on the first pass", withBar(plain([cap(2)])), withBar(plain([cap(2), passed])), `loop:list.stops: ${name} would come into the loop, and could fire before the round cap of 2 that halts the run`],
    ["with a `then`", withBar(plain([cap(2)])), withBar(plain([{ ...passed, then: "done" }, cap(2)])), 'loop:list.stops: the stop on "bar passed" that leads on to "done" would come into the loop, and could fire before the round cap of 2 that halts the run'],
    // In a loop a check judges, which had it behind its cap already (a new one there is held as a way out that does
    // not pass the check).
    ["swapped ahead, in a loop a check judges", checked([cap(2), passed]), checked([passed, cap(2)]), `loop:work.stops: ${name} would be moved ahead of the round cap of 2 that halts the run, and could fire on the same pass`],
  ];
  for (const [what, source, working, why] of cases) assert.deepEqual(refused(adopt(source, working)), [why], what);
  // In a loop a critic judges it is the critics' verdict, and its place among the stops is not held (a stated limit).
  const limits = [cap(1), H];
  for (const [was, now] of [[[...limits, passed], [passed, ...limits]], [[passed, ...limits], [...limits, passed]], [limits, [passed, ...limits]]]) assert.deepEqual(refused(adopt(judged(was), judged(now))), []);
  // A second loop on the loop's back edge with such a stop: held where no critic judges, and that critic's verdict
  // where the loop's own critic is among the new loop's members (the third refresh reader's loop put beside a loop).
  const again = (doc: Graph): Graph => {
    doc.loops.push({ ...structuredClone(doc.loops[0]!), id: "again", name: "Again", stops: [passed, cap(100)] });
    return doc;
  };
  assert.deepEqual(refused(adopt(withBar(plain([cap(2)])), again(withBar(plain([cap(2)]))))), [`loop:again: the loop "again" would count rounds that "list" counts, and the stop on "bar passed" among its stops, which follows that loop's pass edges, could fire before the round cap of 2 that halts the run`]);
  assert.deepEqual(refused(adopt(judged([passed, ...limits]), again(judged([passed, ...limits])))), []);
});

test('"tightens a brake" is said of no change that brings in a stop that leads on, or puts one ahead; a stop that halts is one', () => {
  const places = { nodes: [{ id: "gate", kind: "human-gate", name: "Go on?", prompt: "Go on?", options: ["approve", "reject"] }, { id: "failed", kind: "stop", name: "Failed", outcome: "halt" }] };
  const host = (stops: Stop[]): Graph => {
    const doc = plain(stops, places);
    doc.edges.push({ id: "e-ask", from: "sorter", to: "gate", when: { verdict: "ask" } }, { id: "e-yes", from: "gate", to: "done", when: { verdict: "approve" } }, { id: "e-no", from: "gate", to: "failed", when: { verdict: "reject" } }, { id: "e-stuck", from: "sorter", to: "failed", when: { verdict: "stuck" } });
    return doc;
  };
  const words = (was: Stop[], now: Stop[], allow?: string[]): [string[], string[], string[]] => {
    const check = adopt(host(was), host(now), allow);
    return [refused(check), tightens(check), unjudged(check)];
  };
  // A stop that halts, new or lowered, a person's among them: adopted, and a tightening.
  assert.deepEqual(words([H], [cap(1), H]), [[], ["loop:list.stops: removes the round cap (1)"], []]);
  assert.deepEqual(words([H], [{ ...H, limit: 1 }]), [[], ["loop:list.stops: raises the budget from 1 to 2 dispatches"], []]);
  assert.deepEqual(words([H], [H, { kind: "budget", measure: "minutes", limit: 30 }]), [[], ["loop:list.stops: removes the budget (30 minutes)"], []]);
  assert.deepEqual(words([H], [person(), H]), [[], ["loop:list.stops: removes the stop where a person is asked"], []]);
  // A stop with a `then`, wherever it leads, is named and not judged: on from a person who was asked, to a human
  // gate (printed as a tightening before, eight of eight on the literature review plan), to a stop that halts.
  assert.deepEqual(words([H], [person(1, "done"), H]), [[], [], ["loop:list.stops: removes the stop where a person is asked"]]);
  assert.deepEqual(words([H], [cap(1, "gate"), H]), [[], [], ["loop:list.stops: removes the round cap (1)"]]);
  assert.deepEqual(words([H], [cap(1, "failed"), H]), [[], [], ["loop:list.stops: removes the round cap (1)"]]);
  // Beside a stop that halts, in one change: the change is one name, and it brings in a stop that leads on.
  assert.deepEqual(words([H], [cap(1), cap(2, "gate"), H])[1], []);
  // Held, and adopted by name: still nothing calls it a tightening.
  for (const now of [[cap(1, "done"), H], [H, cap(1, "done")], [{ kind: "budget", measure: "usd", limit: 0.01, then: "done" } as Stop, H]]) {
    assert.equal(words([H], now)[0].length, 1, JSON.stringify(now));
    assert.deepEqual(words([H], now, ["loop:list.stops"]).slice(0, 2), [[], []], JSON.stringify(now));
  }
  // Put ahead with nothing new: a stop that leads on moved ahead of one that asks. The other way round it tightens.
  const [lead, ask] = [cap(3, "gate"), person(2)];
  assert.deepEqual(words([ask, lead, H], [lead, ask, H])[1], []);
  assert.equal(words([leadsOn, H], [H, leadsOn])[1].length, 1);
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
  // (A comparison that held a loop's stops against themselves would say so here: the first cut of this one did, on
  // a loop of the graph's own with a stop on invalid evidence.)
  for (const [name, doc] of all) assert.deepEqual(brakesLost(doc, structuredClone(doc)), [], name);
  // The one built-in loop that holds a limit that leads on ahead of one that halts: two rounds of debate lead to the
  // judge, and eight dispatches halt. With the budget put first the judge is reached no sooner and the halt no later.
  const debate = all.find(([name]) => name === "patterns/debate-then-build")![1];
  const stops = (doc: Graph): Stop[] => doc.loops.find((loop) => loop.id === "debate")!.stops;
  assert.deepEqual(stops(debate).map((stop) => `${stop.kind}${stop.then ? ` then ${stop.then}` : ""}`), ["bar-passed", "max-iterations then judge", "budget"]);
  const swapped = structuredClone(debate);
  swapped.loops.find((loop) => loop.id === "debate")!.stops = [stops(debate)[0]!, stops(debate)[2]!, stops(debate)[1]!];
  const tighter = adopt(debate, swapped);
  assert.deepEqual(refused(tighter), []);
  assert.deepEqual(tightens(tighter), ['loop:debate.stops: the round cap of 2 that leads on to "judge" would be moved ahead of the budget of 8 dispatches that halts the run, and could fire on the same pass']);
  // And back again it is held: the copy would put the cap that leads on ahead of the budget that halts.
  assert.deepEqual(refused(adopt(swapped, debate)), ['loop:debate.stops: the round cap of 2 that leads on to "judge" would be moved ahead of the budget of 8 dispatches that halts the run, and could fire on the same pass']);
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
  // reason about what a pass spends); and so is a second limit that leads to the judge, ahead of that budget.
  assert.deepEqual(refused(changed("patterns/debate-then-build", (w) => void ((stopsOf(w, "debate")[1] as { n: number }).n = 1))), [
    'loop:debate.stops: the round cap of 1 that leads on to "judge" would go from 2 to 1, and could fire on the same pass as the budget of 8 dispatches that halts the run, where it would be the one obeyed',
  ]);
  const minute: Stop = { kind: "budget", measure: "minutes", limit: 1, then: "judge" };
  assert.match(refused(changed("patterns/debate-then-build", (w) => void stopsOf(w, "debate").splice(2, 0, minute)))[0]!, /^loop:debate\.stops: the budget of 1 minute that leads on to "judge" would come into the loop, and could fire /);
  // Behind that budget it is adopted, and given no word: on a pass where the budget of dispatches is due it stands
  // first, and on a pass where it is not, the source goes on to its cap, which leads to the judge as well.
  const behind = changed("patterns/debate-then-build", (w) => void stopsOf(w, "debate").push(minute));
  assert.deepEqual([refused(behind), tightens(behind)], [[], []]);
  // Its budget that halts, lowered, is a tightening as it was.
  const lower = changed("patterns/debate-then-build", (w) => void ((stopsOf(w, "debate")[2] as { limit: number }).limit = 6));
  assert.deepEqual([refused(lower), tightens(lower)], [[], ["loop:debate.stops: raises the budget from 6 to 8 dispatches"]]);

  // Not held, each said in the list. A stop that leads on, lowered or added, where the loop holds no stop that
  // halts and none that asks (the retrospective): adopted, and not called a tightening. Raised, it is held as it was.
  for (const change of [(w: Graph) => void ((stopsOf(w, "grind")[0] as { n: number }).n = 4), (w: Graph) => void stopsOf(w, "grind").push({ kind: "budget", measure: "dispatches", limit: 4, then: "retro" })]) {
    const check = changed("patterns/retrospective-rewrite", change);
    assert.deepEqual([refused(check), tightens(check)], [[], []]);
  }
  assert.deepEqual(refused(changed("patterns/retrospective-rewrite", (w) => void ((stopsOf(w, "grind")[0] as { n: number }).n = 9))), ["loop:grind.stops: raises the round cap from 5 to 9"]);
  // A stop that halts on diminishing returns is not on A-008's list: its removal is not held.
  assert.equal(stopsOf(all.get("patterns/gauntlet-decomposed")!, "polish")[1]!.kind, "diminishing-returns");
  assert.deepEqual(refused(changed("patterns/gauntlet-decomposed", (w) => void stopsOf(w, "polish").splice(1, 1))), []);
  // "Bar passed" in a loop a critic judges, moved ahead of the limits that halt: not held. (Moved behind them, the
  // fresh reader's control, it is adopted too, and neither is called a tightening.)
  const gate = all.get("patterns/review-gate")!;
  const last = structuredClone(gate);
  last.loops[0]!.stops = [...gate.loops[0]!.stops.slice(1), gate.loops[0]!.stops[0]!];
  assert.equal(gate.loops[0]!.stops[0]!.kind, "bar-passed");
  for (const [source, working] of [[last, gate], [gate, last]] as const) {
    const check = adopt(source, working);
    assert.deepEqual([refused(check), tightens(check)], [[], []]);
  }
  // A new stop where a person is asked, that continues in the loop, ahead of its cap: the person's. It is named, as
  // not judged, and a note says the loop's limits then count the rounds between two of that person's decisions.
  const asked = changed("patterns/debate-then-build", (w) => void stopsOf(w, "build").unshift({ kind: "human", every: 1, then: "builder" }));
  assert.deepEqual([refused(asked), tightens(asked), unjudged(asked)], [[], [], ["loop:build.stops: removes the stop where a person is asked"]]);
  assert.equal(asked.notices.length, 1);
});

test("in every built-in loop, a new stop that leads on with nobody asked, put ahead of its first limit that halts, is held by the loop's name for what it would fire before", () => {
  // The audit lane's probe of the built-ins, as a rule: every kind of stop, leading on to every node of the graph in
  // turn. What is not held is a stop where a person is asked (named, and the person's to allow), and a stop that
  // leads to a human gate, which is a stop that asks a person. At 0.4.0 seven more went through, each on
  // debate-then-build: a stop of another kind that led where its cap already leads.
  const NEW: [Stop, string][] = [
    [{ kind: "max-iterations", n: 1 }, "the round cap of 1"], [{ kind: "budget", measure: "dispatches", limit: 1 }, "the budget of 1 dispatch"], [{ kind: "budget", measure: "minutes", limit: 1 }, "the budget of 1 minute"],
    [{ kind: "budget", measure: "usd", limit: 0.01 }, "the budget of 0.01 usd"], [{ kind: "budget", measure: "turns", limit: 1 }, "the budget of 1 turn"], [{ kind: "budget", measure: "tokens", limit: 1 }, "the budget of 1 token"],
    [{ kind: "diminishing-returns", rounds: 1 }, "the stop on diminishing returns over 1 round"], [{ kind: "evidence-invalid", rounds: 1 }, "the stop on evidence invalid for 1 round"], [{ kind: "human", every: 1 }, ""],
  ];
  const limit = (stop: Stop): boolean => ["budget", "max-iterations", "diminishing-returns", "evidence-invalid"].includes(stop.kind);
  const quoted = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let tried = 0;
  const count = { person: 0, gate: 0 };
  for (const [name, source] of builtIns()) {
    if (validate(source, { forExport: true }).some((issue) => issue.severity === "error" && issue.code !== "E_PERSON_STEP_NOT_COMPILED")) continue;
    source.loops.forEach((loop: Loop, at: number) => {
      const first = loop.stops.findIndex((stop) => limit(stop) && !stop.then);
      if (first < 0) return;
      // Whether the loop holds a stop the comparison protects: a cap or a budget that halts, or one where a person is asked.
      const guarded = loop.stops.some((stop) => stop.kind === "human" || ((stop.kind === "max-iterations" || stop.kind === "budget") && !stop.then));
      for (const [add, said] of NEW) {
        for (const node of source.nodes as Node[]) {
          const working = structuredClone(source);
          working.loops[at]!.stops.splice(first, 0, { ...add, then: node.id });
          if (validate(working).some((issue) => issue.severity === "error")) continue;
          tried += 1;
          const adopted = adoptWorkingCopy(source, working, { run: "r1" });
          // (A plan, which has a person's step, is not adopted at all, since no package is made of one: compared as it is.)
          assert.ok(adopted.ok || /E_PERSON_STEP_NOT_COMPILED/.test(adopted.message), adopted.ok ? "" : adopted.message);
          const check = checkAdoption(source, adopted.ok ? adopted.doc : working);
          const what = `${name} · ${loop.id}: ${add.kind} then ${node.id}`;
          const mine = check.refused.find((change) => change.name === `loop:${loop.id}.stops`);
          // Whatever the change is called, it is not called a tightening: it brings in a stop that leads somewhere.
          assert.deepEqual(check.changes.filter((change) => change.name === `loop:${loop.id}.stops` && change.tightens !== undefined), [], what);
          if (add.kind === "human" || node.kind === "human-gate" || (node.kind === "stop" && node.outcome === "halt")) {
            if (check.refused.length === 0) count[add.kind === "human" ? "person" : "gate"] += 1;
            continue;
          }
          // Held by the loop's own name, and where the loop has a stop to protect, for this stop and what it would fire before.
          assert.ok(mine, `${what}: not held at loop:${loop.id}.stops (${check.refused.map((change) => change.name).join(", ") || "nothing refused"})`);
          if (guarded) assert.match(mine.loosens!, new RegExp(`${quoted(said)} that leads on to "${quoted(node.id)}" would come into the loop, and could fire (before|on the same pass as) `), what);
        }
      }
    });
  }
  assert.ok(tried > 1000, String(tried));
  assert.ok(count.person > 0 && count.gate > 0, JSON.stringify(count));
});

test("one loop of 160 stops is compared in well under a second, and of 1,000 in a few", () => {
  // The driver's reader's list, reversed: the first cut tried every pair of passes for every pair of stops, and took
  // four and a half minutes over 160 (main: a millisecond). The bounds are loose for a slow machine.
  const many = (n: number): Stop[] =>
    Array.from({ length: n }, (_, k): Stop => {
      const then = k % 2 === 0 ? { then: "done" } : {};
      if (k % 4 === 0) return { kind: "max-iterations", n: 3 + k, ...then };
      if (k % 4 === 1) return { kind: "budget", measure: (["dispatches", "minutes", "usd", "turns", "tokens"] as const)[k % 5]!, limit: 10 + k, ...then };
      return k % 4 === 2 ? { kind: "diminishing-returns", rounds: 2 + k, ...then } : { kind: "evidence-invalid", rounds: 1 + k, ...then };
    });
  for (const [n, bound] of [[160, 1000], [1000, 10_000]] as const) {
    const [source, working] = [plain(many(n)), { ...plain(many(n).reverse()), version: 2 }];
    const started = performance.now();
    const check = checkAdoption(source, working);
    const took = performance.now() - started;
    assert.ok(took < bound, `${n} stops: ${Math.round(took)} ms`);
    assert.deepEqual(check.changes.map((change) => change.name), ["loop:list.stops"]);
  }
  // And with a person asked between every two of them, each every other number of rounds.
  const crowded = many(300).flatMap((stop, k): Stop[] => [stop, { kind: "human", every: 2 + (k % 7), ...(k % 3 === 0 ? { then: "done" } : {}) }]);
  const started = performance.now();
  checkAdoption(plain(crowded), { ...plain([...crowded].reverse()), version: 2 });
  assert.ok(performance.now() - started < 10_000);
});

// ─── a model of the firing rule, written apart from the comparison ────────────────────────────────────────────────

/**
 * Graph-ir §2 for one loop's stops, with what the owner's driver ruled of a person's stop: at the end of every pass
 * the stops are tried in order and the first that is due is obeyed; a stop where a person is asked ends nothing,
 * and the run goes on as if the person had said so. An environment says, pass by pass, how far each budget's
 * measure has come (it never goes back), which stops on no progress and on invalid evidence are due (not before
 * their number of rounds, fewer rounds whenever more), and whether the bar is met. A person asked every n rounds
 * is asked on passes n, 2n, 3n.
 *
 * Returns the places, in the copy, of the stops that lead on with nobody asked on a pass on which the source halts
 * or asks a person, or on an earlier one.
 */
function model(source: readonly Stop[], copy: readonly Stop[], halting: ReadonlySet<string>): Set<number> {
  const all = [...source, ...copy];
  const halts = (stop: Stop): boolean => stop.then === undefined || halting.has(stop.then);
  const guarded = (stop: Stop): boolean => stop.kind === "human" || ((stop.kind === "max-iterations" || stop.kind === "budget") && halts(stop));
  const leads = (stop: Stop): boolean => (stop.kind === "human" ? false : stop.kind === "bar-passed" ? stop.then === undefined || !halts(stop) : stop.then !== undefined && !halts(stop));
  const size = (stop: Stop): number => (stop.kind === "max-iterations" ? stop.n : stop.kind === "human" ? (stop.every ?? 1) : stop.kind === "budget" ? 0 : stop.kind === "bar-passed" ? 0 : stop.rounds);
  const last = Math.max(3, ...all.map(size)) + Math.max(1, ...all.filter((stop) => stop.kind === "human").map(size)) + 2;
  const key = (stop: Stop): string => (stop.kind === "budget" ? `b ${stop.measure}` : stop.kind === "evidence-invalid" ? "e" : stop.kind === "diminishing-returns" ? `d ${stop.metric ?? ""} ${stop.threshold ?? ""}` : "bar");
  const counted = all.filter((stop) => stop.kind !== "max-iterations" && stop.kind !== "human");
  const keys = [...new Set(counted.map(key))];
  const sizes = new Map(keys.map((k) => [k, [...new Set(counted.filter((stop) => key(stop) === k).map((stop) => (stop.kind === "budget" ? stop.limit : size(stop))))].sort((a, b) => a - b)]));
  /** An environment at one pass: for each thing counted, how many of its sizes, from the smallest, are due. */
  const due = (stop: Stop, pass: number, env: ReadonlyMap<string, number>): boolean => {
    if (stop.kind === "max-iterations") return pass >= stop.n;
    if (stop.kind === "human") return pass % (stop.every ?? 1) === 0;
    const reached = sizes.get(key(stop))!.indexOf(stop.kind === "budget" ? stop.limit : size(stop)) < env.get(key(stop))!;
    return stop.kind === "budget" || stop.kind === "bar-passed" ? reached : reached && pass >= stop.rounds;
  };
  const found = new Set<number>();
  const seen = new Set<string>();
  const walk = (pass: number, env: ReadonlyMap<string, number>, led: number | undefined): void => {
    const state = `${pass} ${keys.map((k) => env.get(k)).join(",")} ${led ?? ""}`;
    if (pass > last || seen.has(state)) return;
    seen.add(state);
    let next: Map<string, number>[] = [new Map()];
    for (const k of keys) {
      const from = k.startsWith("b ") ? env.get(k)! : 0; // a budget's measure never goes back; the rest come and go
      next = next.flatMap((partial) => Array.from({ length: sizes.get(k)!.length - from + 1 }, (_, more) => new Map([...partial, [k, from + more]])));
    }
    for (const now of next) {
      let lead = led;
      let over = false;
      if (lead === undefined) {
        const at = copy.findIndex((stop) => due(stop, pass, now));
        if (at >= 0 && copy[at]!.kind !== "human") {
          if (leads(copy[at]!)) lead = at;
          else over = true;
        }
      }
      const obeyed = source.find((stop) => due(stop, pass, now));
      if (obeyed && guarded(obeyed) && lead !== undefined) found.add(lead);
      if ((obeyed && obeyed.kind !== "human") || over) continue;
      walk(pass + 1, now, lead);
    }
  };
  walk(1, new Map(keys.map((k) => [k, 0])), undefined);
  return found;
}

test("against a model of the firing rule: every run it finds is held, none where it finds none, on lists made at random", () => {
  let seed = 20261006;
  const random = (): number => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0), seed / 4294967296);
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(random() * list.length)]!;
  const int = (low: number, high: number): number => low + Math.floor(random() * (high - low + 1));
  const places = [{ id: "wrap", kind: "agent", name: "Wrap", role: "builder", brief: "Wrap up.", outputs: ["WRAP.md"], allow: ["read-files", "write-outputs"] }, { id: "gate", kind: "human-gate", name: "Go on?", prompt: "Go on?", options: ["approve", "reject"] }, { id: "failed", kind: "stop", name: "Failed", outcome: "halt" }];
  // Each place is reached in the graph already with no decision before it, so that only the rule on stops can hold a change.
  const host = (stops: Stop[]): Graph => {
    const doc = plain(stops, { nodes: places });
    doc.edges.push({ id: "e-wrap", from: "sorter", to: "wrap", when: { verdict: "wrap" } }, { id: "e-wrap-done", from: "wrap", to: "done" }, { id: "e-ask", from: "sorter", to: "gate", when: { verdict: "ask" } }, { id: "e-yes", from: "gate", to: "done", when: { verdict: "approve" } }, { id: "e-no", from: "gate", to: "failed", when: { verdict: "reject" } }, { id: "e-stuck", from: "sorter", to: "failed", when: { verdict: "stuck" } });
    return doc;
  };
  const halting = new Set(["gate", "failed"]);
  const stop = (everyOne: boolean): Stop => {
    const then = random() < 0.5 ? {} : { then: pick(["done", "done", "wrap", "failed", "gate"]) };
    const kind = int(0, 9);
    if (kind <= 2) return { kind: "max-iterations", n: int(1, 4), ...then };
    if (kind <= 4) return { kind: "budget", measure: pick(["dispatches", "dispatches", "minutes"] as const), limit: int(1, 3), ...then };
    if (kind === 5) return { kind: "diminishing-returns", rounds: int(1, 3), ...then };
    if (kind === 6) return { kind: "evidence-invalid", rounds: int(1, 3), ...then };
    if (kind === 7) return { kind: "bar-passed", ...then };
    return person(everyOne ? 1 : int(1, 3), then.then);
  };
  const some = (everyOne: boolean): Stop[] => Array.from({ length: int(1, 4) }, () => stop(everyOne));
  const changed = (stops: Stop[], everyOne: boolean): Stop[] => {
    const copy = stops.map((one) => ({ ...one }));
    const how = random();
    if (how < 0.35) copy.splice(int(0, copy.length), 0, stop(everyOne));
    else if (how < 0.55 && copy.length > 1) copy.splice(int(0, copy.length - 1), 0, ...copy.splice(int(0, copy.length - 1), 1));
    else if (how < 0.75) {
      const one = pick(copy) as Record<string, unknown>;
      for (const field of everyOne ? ["n", "limit", "rounds"] : ["n", "limit", "rounds", "every"]) if (typeof one[field] === "number") one[field] = Math.max(1, (one[field] as number) + pick([-1, -1, 1]));
    } else if (how < 0.85) {
      const one = pick(copy);
      if (one.then) delete one.then;
      else one.then = pick(["done", "wrap", "gate", "failed"]);
    } else return some(everyOne);
    return copy;
  };
  /** How many stops of the working copy the comparison says would fire where the source halts or asks: one line each. */
  const lines = (source: Stop[], working: Stop[]): number | undefined => {
    const adopted = adoptWorkingCopy(host(source), host(working), { run: "r1" });
    if (!adopted.ok) return undefined;
    const why = checkAdoption(host(source), adopted.doc).changes.find((change) => change.name === "loop:list.stops")?.loosens ?? "";
    // (A stop that halted and is given a `then` is said so, with no more: it is itself the stop it would fire before.)
    return (why.match(/ could fire /g) ?? []).length + (why.match(/, where it halted the run(?=;|$)/g) ?? []).length;
  };
  const count = { exact: 0, careful: 0, runs: 0, same: 0, tighter: 0 };
  for (let trial = 0; trial < 2500; trial += 1) {
    // A third of the lists ask a person every round or not at all, and many of the rest have no person's stop:
    // where none asks on only some passes, the comparison says exactly what the model says.
    const everyOne = trial % 3 === 0;
    const source = some(everyOne);
    if (validate(host(source), { forExport: true }).some((issue) => issue.severity === "error")) continue;
    // The same list: nothing is held.
    assert.deepEqual(brakesLost(host(source), host(source.map((one) => ({ ...one })))), [], JSON.stringify(source));
    count.same += 1;
    // A stop that halts or asks, with no `then`, put anywhere: no stop is said to fire where it could not.
    const more = source.map((one) => ({ ...one }));
    more.splice(int(0, more.length), 0, pick<Stop>([cap(int(1, 4)), { kind: "budget", measure: "minutes", limit: int(1, 3) }, person(everyOne ? 1 : int(1, 3))]));
    assert.equal(lines(source, more), 0, `${JSON.stringify(source)} -> ${JSON.stringify(more)}`);
    count.tighter += 1;
    const working = changed(source, everyOne);
    const said = lines(source, working);
    if (said === undefined) continue;
    const real = model(source, working, halting);
    const what = `${JSON.stringify(source)} -> ${JSON.stringify(working)}: the model has ${JSON.stringify([...real])}`;
    count.runs += real.size > 0 ? 1 : 0;
    if ([...source, ...working].every((one) => one.kind !== "human" || (one.every ?? 1) === 1)) {
      assert.equal(said, real.size, what);
      count.exact += 1;
    } else {
      // A person asked every second or third round is taken to be asked on any pass from the second or third: the
      // careful side. Every run is still held; a line more may be said.
      assert.ok(said >= real.size, what);
      count.careful += 1;
    }
  }
  assert.ok(count.exact > 1500 && count.careful > 300 && count.runs > 150, JSON.stringify(count));
});

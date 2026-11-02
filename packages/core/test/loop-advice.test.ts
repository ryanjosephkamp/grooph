/**
 * The rules about loops and stops are advice: left out of a plain check, given as
 * warnings when asked for, and as errors only for what a harness is to run.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { parseGraphText } from "../src/parse.js";
import { buildShareEnvelope } from "../src/share.js";
import { LOOP_RULES, validate } from "../src/validate.js";

const fixture = (...path: string[]) => parseGraphText(readFileSync(join(import.meta.dirname, "..", "..", "..", "..", "fixtures", ...path), "utf8")).doc!;

test("the six rules about loops and stops are left out of a plain check, warnings when asked for as advice, and as written when asked for as errors", () => {
  assert.deepEqual([...LOOP_RULES].sort(), ["E_CYCLE_NO_STOP", "E_JUDGMENT_LOOP_NO_BAR", "E_STOP_NOT_INSPECTABLE", "W_ASPIRATION_AS_ACCEPTANCE", "W_LONG_LOOP_NO_BUDGET", "W_ONLY_MAX_ITERATIONS"]);
  for (const [rule, file] of [
    ["E_CYCLE_NO_STOP", "loop-without-stop.grooph.json"],
    ["E_JUDGMENT_LOOP_NO_BAR", "taste-loop-without-bar.grooph.json"],
    ["E_STOP_NOT_INSPECTABLE", "only-stop-is-an-adjective.grooph.json"],
    ["W_LONG_LOOP_NO_BUDGET", "twelve-rounds-no-budget.grooph.json"],
    ["W_ONLY_MAX_ITERATIONS", "only-max-iterations.grooph.json"],
    ["W_ASPIRATION_AS_ACCEPTANCE", "aspiration-equals-acceptance.grooph.json"],
  ] as const) {
    const doc = fixture("invalid", rule, file);
    const asWritten = validate(doc, { loops: "errors" });
    const plain = validate(doc);
    const advice = validate(doc, { loops: "advice" });
    assert.ok(asWritten.some((issue) => issue.code === rule), rule);
    assert.ok(!plain.some((issue) => LOOP_RULES.includes(issue.code)), `${rule}: a plain check says nothing about loops`);
    // Advice is every finding as written, in the same order, with the loops' own as warnings.
    assert.deepEqual(
      advice,
      asWritten.map((issue) => (LOOP_RULES.includes(issue.code) ? { ...issue, severity: "warning" } : issue)),
      rule,
    );
    assert.deepEqual(plain, asWritten.filter((issue) => !LOOP_RULES.includes(issue.code)), rule);
  }
});

test("a sketch whose loop has no stop is no error: it validates, and its link is made", () => {
  const doc = fixture("invalid", "E_CYCLE_NO_STOP", "loop-without-stop.grooph.json");
  assert.deepEqual(validate(doc).filter((issue) => issue.severity === "error"), []);
  assert.equal(buildShareEnvelope(doc).kind, "graph");
  // What a harness is to run still asks for a stop.
  assert.ok(validate(doc, { forExport: true, loops: "errors" }).some((issue) => issue.code === "E_CYCLE_NO_STOP" && issue.severity === "error"));
});

/**
 * Every rule code has a fixture, and every fixture behaves as its folder says.
 * `fixtures/README.md` describes the layout; `docs/graph-ir.md` §3 owns the codes.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { IMPLEMENTED_CODES, PLANNED_CODES, type IssueCode } from "../src/issues.js";
import { parseGraphText } from "../src/parse.js";
import { validate } from "../src/validate.js";
import { fixturesDir, invalidFixtures, listDirs, listFiles, read, validFixtures } from "./helpers.js";

const KNOWN_CODES = new Set<string>([...IMPLEMENTED_CODES, ...PLANNED_CODES]);

/** How a fixture is judged: parse first, then validate as export would. */
function issuesFor(path: string) {
  const parsed = parseGraphText(read(path));
  if (!parsed.doc) return parsed.issues;
  return validate(parsed.doc, { forExport: true });
}

test("every implemented rule code has at least one failing fixture", () => {
  const withFixtures = new Set(
    listDirs(join(fixturesDir, "invalid")).filter(
      (code) => listFiles(join(fixturesDir, "invalid", code)).length > 0,
    ),
  );
  const missing = IMPLEMENTED_CODES.filter((code) => !withFixtures.has(code));
  assert.deepEqual(missing, [], `these codes have no fixture under fixtures/invalid/: ${missing.join(", ")}`);
});

test("every invalid fixture folder names a code from graph-ir §3", () => {
  for (const code of listDirs(join(fixturesDir, "invalid"))) {
    assert.ok(KNOWN_CODES.has(code), `fixtures/invalid/${code} is not a rule code in docs/graph-ir.md §3`);
  }
});

for (const fixture of invalidFixtures()) {
  test(`fixtures/invalid/${fixture.code}/${fixture.name} produces ${fixture.code}`, () => {
    const issues = issuesFor(fixture.path);
    const codes = issues.map((issue) => issue.code);
    assert.ok(
      codes.includes(fixture.code as IssueCode),
      `expected ${fixture.code}, got ${codes.length === 0 ? "no issues" : codes.join(", ")}`,
    );
    if (fixture.code.startsWith("E_")) {
      assert.ok(
        issues.some((issue) => issue.code === fixture.code && issue.severity === "error"),
        `${fixture.code} must be reported as an error`,
      );
    } else {
      assert.ok(
        issues.some((issue) => issue.code === fixture.code && issue.severity === "warning"),
        `${fixture.code} must be reported as a warning`,
      );
    }
    for (const issue of issues) assert.ok(issue.message.length > 0, "every issue carries a message");
  });
}

for (const fixture of validFixtures()) {
  test(`fixtures/valid/${fixture.name} validates clean`, () => {
    const parsed = parseGraphText(read(fixture.path));
    assert.deepEqual(parsed.issues, [], "a valid fixture must match the schema");
    assert.ok(parsed.doc);

    const issues = validate(parsed.doc);
    assert.deepEqual(
      issues.filter((issue) => issue.severity === "error"),
      [],
      "a valid fixture must have no errors",
    );
    assert.deepEqual(issues, [], "a valid fixture must not raise an implemented warning either");

    if (parsed.doc.target?.harness) {
      assert.deepEqual(
        validate(parsed.doc, { forExport: true }),
        [],
        "a valid fixture that names a target must also be clean for export",
      );
    }
  });
}

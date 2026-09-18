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
import {
  expectedIssues,
  fixturesDir,
  invalidFixtures,
  listDirs,
  listFiles,
  listSidecars,
  read,
  validFixtures,
} from "./helpers.js";

const KNOWN_CODES = new Set<string>([...IMPLEMENTED_CODES, ...PLANNED_CODES]);

/** How a fixture is judged: parse first, then validate as export would. */
function issuesFor(path: string) {
  const parsed = parseGraphText(read(path));
  if (!parsed.doc) return parsed.issues;
  return validate(parsed.doc, { forExport: true });
}

test("nothing is planned: every rule in graph-ir §3 is implemented", () => {
  assert.deepEqual([...PLANNED_CODES], []);
});

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

test("every sidecar belongs to a fixture", () => {
  const dirs = [join(fixturesDir, "valid"), ...listDirs(join(fixturesDir, "invalid")).map((c) => join(fixturesDir, "invalid", c))];
  for (const dir of dirs) {
    const fixtures = new Set(listFiles(dir).map((name) => name.replace(/\.grooph\.json$/, "")));
    for (const sidecar of listSidecars(dir)) {
      assert.ok(fixtures.has(sidecar.replace(/\.expect\.json$/, "")), `${join(dir, sidecar)} has no fixture beside it`);
    }
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
    const severity = fixture.code.startsWith("E_") ? "error" : "warning";
    assert.ok(
      issues.some((issue) => issue.code === fixture.code && issue.severity === severity),
      `${fixture.code} must be reported as ${severity === "error" ? "an error" : "a warning"}`,
    );
    for (const issue of issues) assert.ok(issue.message.length > 0, "every issue carries a message");

    // Exactly its own code, unless the sidecar lists the full expectation.
    const expected = expectedIssues(fixture.path) ?? codes.map(() => fixture.code);
    assert.deepEqual(codes, expected, "the fixture reports exactly what its folder and sidecar say");
  });
}

for (const fixture of validFixtures()) {
  test(`fixtures/valid/${fixture.name} validates clean`, () => {
    const parsed = parseGraphText(read(fixture.path));
    assert.deepEqual(parsed.issues, [], "a valid fixture must match the schema");
    assert.ok(parsed.doc);

    const issues = validate(parsed.doc, { forExport: parsed.doc.target?.harness !== undefined });
    assert.deepEqual(
      issues.filter((issue) => issue.severity === "error"),
      [],
      "a valid fixture must have no errors",
    );
    assert.deepEqual(
      issues.map((issue) => issue.code),
      expectedIssues(fixture.path) ?? [],
      "a valid fixture raises exactly the warnings its sidecar lists",
    );
  });
}

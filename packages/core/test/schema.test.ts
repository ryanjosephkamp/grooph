/**
 * The published JSON Schema is generated from the same declaration the
 * validator uses, and it agrees with `parseGraph` on every fixture.
 * (graph-ir §1: when schema and types disagree, the types win — so the schema
 * is generated, never hand-written.)
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { Ajv2020 } from "ajv/dist/2020.js";

import { parseGraphText } from "../src/parse.js";
import { graphJsonSchema, SCHEMA_ID } from "../src/schema/graph.js";
import { SCHEMA_PATH } from "../src/schema/path.js";
import { invalidFixtures, read, validFixtures } from "./helpers.js";

test("the committed schema is what the types generate", () => {
  assert.equal(
    read(SCHEMA_PATH),
    graphJsonSchema(),
    "schema/grooph-0.schema.json is stale: run `pnpm --filter @grooph/core run schema:write`",
  );
});

test("the schema is a valid 2020-12 schema", () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  const validate = ajv.compile(JSON.parse(graphJsonSchema()));
  assert.equal(typeof validate, "function");
  assert.equal(JSON.parse(graphJsonSchema()).$id, SCHEMA_ID);
});

test("the schema and parseGraph agree on every fixture", () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  const validateJson = ajv.compile(JSON.parse(graphJsonSchema()));

  const fixtures = [
    ...validFixtures().map((f) => ({ ...f, label: `valid/${f.name}` })),
    ...invalidFixtures().map((f) => ({ ...f, label: `invalid/${f.code}/${f.name}` })),
  ];

  for (const fixture of fixtures) {
    const json: unknown = JSON.parse(read(fixture.path));
    const bySchema = validateJson(json) === true;
    const byParse = parseGraphText(read(fixture.path)).issues.length === 0;
    assert.equal(
      bySchema,
      byParse,
      `${fixture.label}: JSON Schema says ${bySchema ? "valid" : "invalid"} but parseGraph says ${
        byParse ? "valid" : "invalid"
      }${bySchema ? "" : ` — ${ajv.errorsText(validateJson.errors)}`}`,
    );
  }
});

test("the schema and parseGraph agree on mutated documents", () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  const validateJson = ajv.compile(JSON.parse(graphJsonSchema()));
  const source = JSON.parse(read(validFixtures().find((f) => f.name.startsWith("review-loop"))!.path)) as Record<string, unknown>;

  const mutate = (label: string, change: (doc: Record<string, unknown>) => void): void => {
    const doc = structuredClone(source);
    change(doc);
    const bySchema = validateJson(doc) === true;
    const byParse = parseGraphText(JSON.stringify(doc)).issues.length === 0;
    assert.equal(bySchema, byParse, `${label}: schema and parseGraph disagree`);
  };

  mutate("id is not kebab-case", (doc) => void (doc["id"] = "Review Loop"));
  mutate("version is a string", (doc) => void (doc["version"] = "1"));
  mutate("wrong document version", (doc) => void (doc["grooph"] = 1));
  mutate("nodes missing", (doc) => void delete doc["nodes"]);
  mutate("unknown node kind", (doc) => void ((doc["nodes"] as { kind: string }[])[0]!.kind = "wizard"));
  mutate("outputs empty", (doc) => void ((doc["nodes"] as { outputs: string[] }[])[0]!.outputs = []));
  mutate("edge when unknown", (doc) => void ((doc["edges"] as { when?: unknown }[])[0]!.when = "maybe"));
  mutate("edge when verdict object", (doc) => void ((doc["edges"] as { when?: unknown }[])[0]!.when = { verdict: "needs-evidence" }));
  mutate("stop kind unknown", (doc) => {
    (doc["loops"] as { stops: unknown[] }[])[0]!.stops = [{ kind: "vibes" }];
  });
  mutate("stop missing its number", (doc) => {
    (doc["loops"] as { stops: unknown[] }[])[0]!.stops = [{ kind: "max-iterations" }];
  });
  mutate("policy scope malformed", (doc) => {
    (doc["policies"] as { scope: string }[])[0]!.scope = "loop:";
  });
  mutate("layout key is not an id", (doc) => {
    (doc["layout"] as Record<string, unknown>)["Not An Id"] = { x: 0, y: 0 };
  });
  mutate("layout entry missing y", (doc) => {
    (doc["layout"] as Record<string, unknown>)["builder"] = { x: 0 };
  });
  mutate("unknown top-level key is allowed", (doc) => void (doc["futureField"] = { anything: true }));
  mutate("run note at is malformed", (doc) => {
    doc["notes"] = [{ id: "n-0001", run: "r", at: "node:" }];
  });
  mutate("run note is well formed", (doc) => {
    doc["notes"] = [{ id: "n-0001", run: "20260917-093002", at: "loop:review-cycle", round: 1, outcome: "fail" }];
  });
  mutate("loop note names the stop that fired", (doc) => {
    doc["notes"] = [{ id: "n-0001", run: "20260917-093002", at: "loop:review-cycle", round: 1, outcome: "pass", stop: "bar-passed" }];
  });
  mutate("budget measured in dispatches", (doc) => {
    (doc["loops"] as { stops: unknown[] }[])[0]!.stops = [{ kind: "budget", measure: "dispatches", limit: 12 }];
  });
  mutate("budget measured in something else", (doc) => {
    (doc["loops"] as { stops: unknown[] }[])[0]!.stops = [{ kind: "budget", measure: "calories", limit: 12 }];
  });
  mutate("adaptation level known", (doc) => void (doc["adaptation"] = "propose"));
  mutate("adaptation level unknown", (doc) => void (doc["adaptation"] = "loose"));
  mutate("amendment note is well formed", (doc) => {
    doc["notes"] = [{ id: "n-0002", run: "r", at: "graph", amendment: { summary: "add a docs node", reason: "README.md is uncovered", patch: [{ op: "addNode" }] } }];
  });
  mutate("amendment note without a reason", (doc) => {
    doc["notes"] = [{ id: "n-0002", run: "r", at: "graph", amendment: { summary: "add a docs node" } }];
  });
  mutate("write-outputs is a capability", (doc) => {
    (doc["nodes"] as { allow?: string[] }[])[1]!.allow = ["read-files", "write-outputs"];
  });
});

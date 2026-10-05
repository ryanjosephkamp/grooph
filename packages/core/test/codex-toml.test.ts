import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { compile, type CompileOptions } from "../src/compile/index.js";
import { parseGraph, parseGraphText } from "../src/parse.js";
import type { AgentNode, Graph } from "../src/types.js";
import { validate } from "../src/validate.js";
import { fixturesDir, read } from "./helpers.js";

const load = (): Graph => parseGraphText(read(`${fixturesDir}/valid/review-loop.grooph.json`)).doc!;
const cases = [
  ["delete", "DEL:\u007f", "DEL:\u007f"],
  ["lone high surrogate", "high:\ud800", "high:�"],
  ["lone low surrogate", "low:\udc00", "low:�"],
  ["control", "control:\u0001", "control:\u0001"],
  ["quote", 'quote:"', 'quote:"'],
  ["newline", "line-one\nline-two", "line-one\nline-two"],
  ["backslash", "backslash:\\", "backslash:\\"],
  ["valid surrogate pair", "pair:😀", "pair:😀"],
] as const;

function baseDoc(): { doc: Graph; builder: AgentNode } {
  const doc = load();
  doc.target = { harness: "codex" };
  const builder = doc.nodes.find((node): node is AgentNode => node.kind === "agent" && node.id === "builder")!;
  return { doc, builder };
}

function assertSchemaAndValidation(doc: Graph): void {
  const parsed = parseGraph(doc);
  assert.deepEqual(parsed.issues, [], "the hostile-string document must pass the graph schema");
  assert.ok(parsed.doc);
  const issues = validate(parsed.doc, { forExport: true }).filter((issue) => issue.severity === "error");
  assert.deepEqual(issues, [], `the schema-accepted graph must validate for export: ${issues.map((issue) => issue.message).join("; ")}`);
}

function parseAllAgentToml(doc: Graph, options?: CompileOptions): Record<string, Record<string, string>> {
  const files = compile(doc, "codex", options).files;
  const entries = Object.entries(files).filter(([path]) => path.startsWith(".codex/agents/") && path.endsWith(".toml"));
  assert.equal(entries.length, 2, "both emitted agent files are covered");
  const parsed = execFileSync("python3", [
    "-c",
    "import json, sys, tomllib; print(json.dumps({name: tomllib.loads(text) for name, text in json.load(sys.stdin)}, ensure_ascii=True))",
  ], { input: JSON.stringify(entries), encoding: "utf8" });
  return JSON.parse(parsed) as Record<string, Record<string, string>>;
}

function makeFieldDoc(field: string, value: string): Graph {
  const { doc, builder } = baseDoc();
  switch (field) {
    case "node name": builder.name = value; break;
    case "brief": builder.brief = value; break;
    case "description": builder.description = value; break;
    case "custom role": builder.role = { custom: value }; break;
    case "inputs": builder.inputs = [value]; break;
    case "outputs": builder.outputs = [value]; break;
    case "owns": builder.owns = [value]; break;
    case "edge evidence": doc.edges.find((edge) => edge.to === builder.id)!.evidence = [value]; break;
    default: assert.fail(`unknown field ${field}`);
  }
  return doc;
}

function expectedFragment(field: string, value: string): { key: string; fragment: string } {
  switch (field) {
    case "node name": return { key: "developer_instructions", fragment: `# ${value}` };
    case "brief": return { key: "developer_instructions", fragment: `## Brief\n\n${value}` };
    case "description": return { key: "developer_instructions", fragment: `## Context\n\n${value}` };
    case "custom role": return { key: "description", fragment: `${value} for graph` };
    case "inputs": return { key: "developer_instructions", fragment: `- ${value}` };
    case "outputs": return { key: "developer_instructions", fragment: `- ${value}` };
    case "owns": return { key: "developer_instructions", fragment: value };
    case "edge evidence": return { key: "developer_instructions", fragment: value };
    default: assert.fail(`unknown field ${field}`);
  }
}

test("schema-accepted Codex agent text fields serialize as real TOML for every Unicode and control case", () => {
  const fields = ["node name", "brief", "description", "custom role", "inputs", "outputs", "owns", "edge evidence"];
  for (const field of fields) {
    for (const [label, hostile, normalized] of cases) {
      const doc = makeFieldDoc(field, hostile);
      assertSchemaAndValidation(doc);
      const toml = parseAllAgentToml(doc);
      const selected = toml[".codex/agents/review-loop--builder.toml"]!;
      const expected = expectedFragment(field, normalized);
      assert.ok(selected[expected.key]!.includes(expected.fragment), `${field} ${label} is preserved as field data`);
      assert.ok(!("approval_policy" in selected), "the agent file does not invent an approval setting");
      assert.equal(selected.sandbox_mode, "workspace-write");
      assert.equal(selected.web_search, "disabled");
    }
  }
});

test("schema-constrained skills and model pins reject hostile spellings and still emit valid TOML when accepted", () => {
  for (const [label, hostile] of cases) {
    const { doc, builder } = baseDoc();
    builder.skills = [hostile];
    const skills = parseGraph(doc);
    assert.ok(skills.issues.some((issue) => issue.code === "E_SCHEMA"), `skill ${label} is rejected by the schema`);

    const pinned = baseDoc();
    pinned.builder.model = { tier: "strong", pin: { codex: hostile, "claude-code": "opus" } };
    const pin = parseGraph(pinned.doc);
    assert.ok(pin.issues.some((issue) => issue.code === "E_SCHEMA"), `model pin ${label} is rejected by the schema`);
  }

  for (const [field, value] of [["skill", "house:review"], ["pin", "model-v1.2"]] as const) {
    const { doc, builder } = baseDoc();
    if (field === "skill") builder.skills = [value];
    else builder.model = { tier: "strong", pin: { codex: value, "claude-code": "opus" } };
    assertSchemaAndValidation(doc);
    const toml = parseAllAgentToml(doc)[".codex/agents/review-loop--builder.toml"]!;
    if (field === "skill") assert.ok(toml.developer_instructions!.includes(`Skills required by the graph: \`${value}\`.`));
    else assert.equal(toml.model, value);
  }
});

test("Codex model overrides serialize every string edge case as real TOML", () => {
  const { doc } = baseDoc();
  assertSchemaAndValidation(doc);
  for (const [label, hostile, normalized] of cases) {
    const toml = parseAllAgentToml(doc, { models: { strong: hostile } });
    for (const [path, selected] of Object.entries(toml)) {
      assert.equal(selected.model, normalized, `${path} model override ${label} decodes as a well-formed TOML string`);
      assert.equal(selected.sandbox_mode, "workspace-write");
      assert.equal(selected.web_search, "disabled");
      assert.ok(!("approval_policy" in selected));
    }
  }
});

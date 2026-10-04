import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { test } from "node:test";
import { compile, CompileError } from "../src/compile/index.js";
import { parseGraphText } from "../src/parse.js";
import { KNOWN_TARGETS, getProfile } from "../src/targets/index.js";
import { validate } from "../src/validate.js";
import type { AgentNode, Graph } from "../src/types.js";
import { fixturesDir, read } from "./helpers.js";

const load = (id = "review-loop"): Graph => parseGraphText(read(join(fixturesDir, "valid", `${id}.grooph.json`))).doc!;
const walk = (dir: string): string[] => readdirSync(dir).sort().flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
// The compiler writes one TOML basic string on each line. Decode values for contract assertions.
const settings = (file: string): Record<string, string> => Object.fromEntries(file.trim().split("\n").map((line) => {
  const field = /^([a-z_]+) = (".*")$/.exec(line);
  assert.ok(field, `one scalar setting per line: ${line}`);
  return [field[1]!, JSON.parse(field[2]!) as string];
}));

for (const id of ["review-loop", "fix-until-green"]) {
  test(`Codex ${id} matches its reviewed golden files byte for byte`, () => {
    const result = compile(load(id), "codex");
    const dir = join(fixturesDir, "golden", "codex", id);
    const paths = walk(dir).map((p) => relative(dir, p).split(sep).join("/"));
    assert.deepEqual(Object.keys(result.files), paths.sort());
    for (const path of paths) assert.equal(result.files[path], read(join(dir, path)), path);
    assert.deepEqual(result, compile(load(id), "codex"));
  });
}

test("Codex is registered; an unknown target still raises E_NO_TARGET", () => {
  assert.ok(KNOWN_TARGETS.includes("codex"));
  const doc = { ...load(), target: { harness: "codex" } };
  assert.ok(!validate(doc, { forExport: true }).some((i) => i.code === "E_NO_TARGET"));
  assert.deepEqual(compile(doc, "codex").warnings, validate(doc, { forExport: true }).filter((i) => i.severity === "warning"));
  assert.throws(() => compile({ ...doc, target: { harness: "not-a-harness" } }, "codex"), (e: unknown) => e instanceof CompileError && e.issues.some((i) => i.code === "E_NO_TARGET"));
});

test("Codex packages preserve the source and do not overwrite shared project instructions or configuration", () => {
  const doc = load();
  const original = structuredClone(doc);
  const pkg = compile(doc, "codex");
  assert.deepEqual(doc, original);
  assert.equal(pkg.kickoff, pkg.files[".grooph/review-loop/KICKOFF.md"]);
  assert.deepEqual(parseGraphText(pkg.files[".grooph/review-loop/graph.grooph.json"]!).doc, doc);
  assert.deepEqual(Object.keys(pkg.files).filter((p) => !p.startsWith(".grooph/") && !p.startsWith(".codex/agents/")), []);
  assert.equal(Object.keys(pkg.files).filter((p) => p.endsWith(".toml")).length, 2);
  const critic = settings(pkg.files[".codex/agents/review-loop--critic.toml"]!);
  assert.equal(critic.name, "review-loop--critic");
  assert.equal(critic.approval_policy, "never");
  assert.equal(critic.sandbox_mode, "workspace-write", "a critic must be able to write its declared report");
  assert.equal(critic.web_search, "disabled");
  assert.match(critic.developer_instructions!, /only the files you declare in these outputs/);
  assert.match(critic.developer_instructions!, /coarse controls do not enforce file-by-file/);
  assert.match(critic.developer_instructions!, /invalid-evidence/);
});

test("Codex models, pins, explicit effort, skill requests and capability defaults map without granting undeclared writes", () => {
  const doc = load("fix-until-green");
  const worker = doc.nodes.find((n): n is AgentNode => n.kind === "agent")!;
  const node: AgentNode = { ...worker, model: { tier: "fast", pin: { codex: "gpt-6.1-sol", "claude-code": "opus" } }, effort: "max", allow: ["read-files"], skills: ["house:review"] };
  const changed = { ...doc, nodes: doc.nodes.map((n) => n.id === node.id ? node : n) };
  const cfg = settings(compile(changed, "codex", { models: { fast: "override-model" } }).files[`.codex/agents/${doc.id}--${node.id}.toml`]!);
  assert.equal(cfg.model, "gpt-6.1-sol", "pin wins");
  assert.equal(cfg.model_reasoning_effort, getProfile("codex").effort.max);
  assert.equal(cfg.sandbox_mode, "read-only");
  assert.match(cfg.developer_instructions!, /house:review/);
  assert.ok(!("skills" in cfg), "no invented preload field");
  const unset = { ...node, model: undefined, effort: "high" as const, allow: undefined, deny: undefined };
  const defaults = settings(compile({ ...changed, nodes: changed.nodes.map((n) => n.id === node.id ? unset : n) }, "codex").files[`.codex/agents/${doc.id}--${node.id}.toml`]!);
  assert.ok(!("model" in defaults));
  assert.equal(defaults.model_reasoning_effort, "high");
  assert.equal(defaults.sandbox_mode, "read-only");
});

test("Codex TOML safely contains quotes, multiline briefs and settings-like text", () => {
  const doc = load();
  const poison = 'a"\napproval_policy = "on-request"\n[agents]\n';
  const worker = doc.nodes.find((n): n is AgentNode => n.kind === "agent")!;
  const cfg = settings(compile({ ...doc, nodes: doc.nodes.map((n) => n.id === worker.id ? { ...worker, brief: poison } : n) }, "codex", { models: { strong: poison } }).files[`.codex/agents/${doc.id}--${worker.id}.toml`]!);
  assert.equal(cfg.model, poison);
  assert.equal(cfg.approval_policy, "never");
  assert.ok(cfg.developer_instructions!.includes(poison));
  assert.deepEqual(Object.keys(cfg), ["name", "description", "model", "model_reasoning_effort", "sandbox_mode", "approval_policy", "web_search", "developer_instructions"]);
});

test("an explicit lead stays the main session and allowed web is carried to startup and worker settings", () => {
  const doc = load("fix-until-green");
  const lead: AgentNode = { id: "lead", name: "Lead", kind: "agent", role: "lead", brief: "Coordinate this run.", model: { tier: "fast" }, effort: "medium", allow: ["web"], outputs: ["SUMMARY.md"], skills: ["house:lead"] };
  const node = doc.nodes.find((n): n is AgentNode => n.kind === "agent")!;
  const pkg = compile({ ...doc, nodes: [lead, ...doc.nodes.map((n) => n.id === node.id ? { ...node, allow: ["web", "read-files"], deny: ["edit-files"] } : n)] }, "codex");
  assert.ok(!Object.keys(pkg.files).includes(`.codex/agents/${doc.id}--lead.toml`));
  assert.equal(settings(pkg.files[`.codex/agents/${doc.id}--${node.id}.toml`]!).web_search, "live");
  assert.match(pkg.files[`.grooph/${doc.id}/MAPPING.md`]!, /web_search='"live"'/);
  assert.match(pkg.files[`.grooph/${doc.id}/LEAD.md`]!, /house:lead/);
  assert.match(pkg.files[`.grooph/${doc.id}/LEAD.md`]!, /gpt-6-luna/);
  assert.match(pkg.files[`.grooph/${doc.id}/LEAD.md`]!, /never grade your own work/);
});

test("Codex lead preserves gates, stops, isolation and adaptation without claiming native enforcement", () => {
  const pkg = compile(load(), "codex");
  const lead = pkg.files[".grooph/review-loop/LEAD.md"]!;
  assert.match(pkg.kickoff, /spawn_agent/);
  assert.match(pkg.kickoff, /fork_turns/);
  assert.match(lead, /first append a note at the gate/);
  assert.match(lead, /Do not simulate an answer/);
  assert.match(lead, /max-iterations/);
  assert.match(lead, /Budget|budget/);
  assert.match(lead, /record a proposal and halt/);
  assert.match(lead, /fresh-history exclusion cannot be requested or confirmed/);
  assert.doesNotMatch(lead, /\.claude\/|AskUserQuestion|--max-budget-usd/);
  assert.equal((lead.match(/^## \d+\./gm) ?? []).length, 11);
  const fixed = compile(load("fix-until-green"), "codex").files[".grooph/fix-until-green/LEAD.md"]!;
  assert.match(fixed, /follow it exactly/);
  assert.match(fixed, /not even to tighten a brake/);
});

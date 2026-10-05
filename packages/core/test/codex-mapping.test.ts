import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { compile } from "../src/compile/index.js";
import { getProfile } from "../src/targets/index.js";
import type { Graph } from "../src/types.js";
import { fixturesDir, read } from "./helpers.js";
import { parseGraphText } from "../src/parse.js";

const load = (id = "review-loop"): Graph => parseGraphText(read(join(fixturesDir, "valid", `${id}.grooph.json`))).doc!;

test("Codex defaults frontier to Sol and builder tiers to Luna", () => {
  const profile = getProfile("codex");
  assert.equal(profile.models.frontier, "gpt-6.1-sol");
  assert.equal(profile.models.strong, "gpt-6-luna");
  assert.equal(profile.models.fast, "gpt-6-luna");
});

test("Codex mapping computes tier names from the effective profile and honors export overrides", () => {
  const doc = load();
  const mapping = compile(doc, "codex", { models: { strong: "gpt-6-luna", fast: "gpt-6-luna" } })
    .files[`.grooph/${doc.id}/MAPPING.md`]!;
  assert.match(mapping, /frontier → gpt-6\.1-sol, strong → gpt-6-luna, fast → gpt-6-luna/);
  assert.match(mapping, /Model collapse: strong and fast resolve to gpt-6-luna; tier names do not guarantee distinct underlying models\./);

  const changedPair = compile(doc, "codex", { models: { strong: "gpt-6.1-sol" } }).files[`.grooph/${doc.id}/MAPPING.md`]!;
  assert.match(changedPair, /Model collapse: frontier and strong resolve to gpt-6\.1-sol/);

  const distinct = compile(doc, "codex", { models: { frontier: "f", strong: "s", fast: "q" } }).files[`.grooph/${doc.id}/MAPPING.md`]!;
  assert.match(distinct, /No two tiers resolve to the same model\./);
});

test("Codex kickoff uses the lead model and quotes the package kickoff path", () => {
  const doc = load();
  const pkg = compile(doc, "codex", { models: { frontier: "frontier-override" } });
  assert.match(pkg.files[`.grooph/${doc.id}/MAPPING.md`]!, / -m 'frontier-override'/);
  assert.match(pkg.files[`.grooph/${doc.id}/MAPPING.md`]!, /- < '\.grooph\/review-loop\/KICKOFF\.md'/);
  assert.match(pkg.files[`.grooph/${doc.id}/MAPPING.md`]!, /agents\.default_subagent_model='"gpt-6-luna"'/);
  const worker = doc.nodes.find((node) => node.kind === "agent" && node.role !== "lead")!;
  const unsetModelDoc = { ...doc, nodes: doc.nodes.map((node) => node.id === worker.id && node.kind === "agent" ? { ...node, model: undefined } : node) };
  const unsetModelPkg = compile(unsetModelDoc, "codex");
  const agentFile = unsetModelPkg.files[`.codex/agents/${doc.id}--${worker.id}.toml`]!;
  assert.doesNotMatch(agentFile, /^model = /m, "an omitted graph model stays omitted in the custom-agent file");

  const explicitLeadWithoutModel = { ...doc, nodes: doc.nodes.map((node) => node.id === worker.id && node.kind === "agent" ? { ...node, role: "lead" as const, model: undefined } : node) };
  const leadMapping = compile(explicitLeadWithoutModel, "codex").files[`.grooph/${doc.id}/MAPPING.md`]!;
  assert.doesNotMatch(leadMapping, /codex exec[^\n]* -m /, "a lead node with no model keeps the session default");
});

test("Codex mapping preserves owner approvals and distinguishes refusal from a native halt", () => {
  const doc = load();
  const mapping = compile(doc, "codex").files[`.grooph/${doc.id}/MAPPING.md`]!;
  assert.doesNotMatch(mapping, /approval_policy=|approval_policy =/);
  assert.match(mapping, /Approval settings are inherited from the owner's configured policy; the package does not set or weaken that policy/);
  assert.match(mapping, /An unattended operation requiring owner approval may be refused when nobody can respond; that refusal is not a native graph halt/);
  assert.match(mapping, /Graph gates and stops remain instructions the lead must follow/);
});

test("Codex mapping records help inspection without claiming a package run", () => {
  const doc = load();
  const mapping = compile(doc, "codex").files[`.grooph/${doc.id}/MAPPING.md`]!;
  assert.match(mapping, /CLI `0\.160\.0` help was read/);
  assert.match(mapping, /the package has not been run in Codex/);
  assert.doesNotMatch(mapping, /profile verified against CLI/);
});

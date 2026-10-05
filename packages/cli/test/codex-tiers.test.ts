import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import type { AgentNode, Graph } from "@grooph/core";
import { exportCommand } from "../src/commands/export.js";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);

function exportGraph({ sameTier = false, pin = false, models }: { sameTier?: boolean; pin?: boolean; models?: { strong: string; fast: string } } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "grooph-codex-tiers-"));
  try {
    const doc = JSON.parse(readFileSync(join(root, "fixtures/valid/review-loop.grooph.json"), "utf8")) as Graph;
    // The fixture names Claude Code; an export for Codex is of a document that names Codex.
    doc.target = { harness: "codex" };
    const builder = doc.nodes.find((node): node is AgentNode => node.kind === "agent" && node.id === "builder")!;
    const critic = doc.nodes.find((node): node is AgentNode => node.kind === "agent" && node.id === "critic")!;
    builder.model = { tier: sameTier ? "strong" : "fast" };
    critic.model = pin ? { tier: "strong", pin: { codex: "pinned-model", "claude-code": "opus" } } : { tier: "strong" };
    const graphPath = join(dir, "graph.grooph.json");
    writeFileSync(graphPath, JSON.stringify(doc));
    const output: string[] = [];
    const errors: string[] = [];
    assert.equal(exportCommand({ out: (line) => void output.push(line), err: (line) => void errors.push(line) }, graphPath, {
      target: "codex", into: join(dir, "package"), ...(models ? { models } : {}),
    }), 0, errors.join("\n"));
    return output.join("\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("default Codex export notes when two used tiers resolve to Luna", () => {
  const output = exportGraph();
  assert.match(output, /note: strong and fast are both gpt-6-luna in this package, by the target's own map, and this graph has agents on each/);
  assert.match(output, /the validator's check for that reads tiers and does not see it/);
});

test("Codex export collapse notes use overrides and exclude unused or pinned tiers", () => {
  assert.match(exportGraph({ models: { strong: "shared-model", fast: "shared-model" } }), /note: strong and fast are both shared-model/);
  assert.doesNotMatch(exportGraph({ models: { strong: "model-a", fast: "model-b" } }), /note: strong and fast are both/);
  assert.doesNotMatch(exportGraph({ sameTier: true }), /note: strong and fast are both/);
  assert.doesNotMatch(exportGraph({ pin: true }), /note: strong and fast are both/);
});

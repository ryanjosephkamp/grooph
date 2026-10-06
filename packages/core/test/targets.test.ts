/**
 * The targets by name, and their profiles (slice 0076, the stack's budget).
 *
 * Every address of the web app carried both profile files whole, to ask whether a harness has one and to show a
 * title. `targets/names.ts` is what `base.ts`, the app's way in, now reaches: ids and titles. The profiles are
 * the compiler's (`targets/index.ts`), fetched with it when a person exports. These tests hold the two lists to
 * each other, the profiles out of the first load, and each export to its whole profile.
 */

import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import * as base from "../src/base.js";
import { compile, getProfile, parseGraphText, setTarget, type CompileTarget, type Graph } from "../src/index.js";
import { KNOWN_TARGETS, hasProfile, targetTitle } from "../src/targets/names.js";
import { fixturesDir, read, repoRoot } from "./helpers.js";

const src = join(repoRoot, "packages", "core", "src");
const runtimeImports = (file: string): string[] =>
  [...read(file).matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+"(\.[^"]+)"/gms)].map((m) => join(file, "..", m[1]!.replace(/\.js$/, ".ts")));
const follow = (file: string, into: Set<string> = new Set()): Set<string> => {
  if (into.has(file) || !file.endsWith(".ts")) return into.add(file);
  into.add(file);
  for (const next of runtimeImports(file)) follow(next, into);
  return into;
};
const loop = (target: CompileTarget, name = "review-loop"): Graph => setTarget(parseGraphText(read(join(fixturesDir, "valid", `${name}.grooph.json`))).doc!, target);

test("the names are the profiles' own: the same ids, the same titles, and a profile file for each", () => {
  const files = readdirSync(join(repoRoot, "packages", "core", "targets")).filter((name) => name.endsWith(".profile.json")).map((name) => name.replace(/\.profile\.json$/, "")).sort();
  assert.deepEqual([...KNOWN_TARGETS].sort(), files);
  for (const target of KNOWN_TARGETS) {
    const profile = getProfile(target);
    assert.equal(profile.harness, target);
    assert.equal(targetTitle(target), profile.title, target);
    assert.equal(hasProfile(target), true, target);
    assert.deepEqual(JSON.parse(read(join(repoRoot, "packages", "core", "targets", `${target}.profile.json`))), profile, target);
  }
  for (const word of ["constructor", "toString", "__proto__", "Codex", "codex ", ""]) {
    assert.equal(hasProfile(word), false, word);
    assert.equal(targetTitle(word), undefined, word);
    assert.throws(() => getProfile(word), /no compile profile for target harness/, word);
  }
});

test("the app's way in carries the names and no profile: base.ts does not lead to targets/index.ts or a profile file", () => {
  const reached = follow(join(src, "base.ts"));
  assert.ok(reached.size > 20 && reached.has(join(src, "validate.ts")), "base.ts was not followed");
  assert.ok(reached.has(join(src, "targets", "names.ts")), "base.ts does not reach the names");
  assert.ok(!reached.has(join(src, "targets", "index.ts")), "base.ts leads to the profiles");
  for (const file of reached) assert.doesNotMatch(file.endsWith(".ts") ? read(file).replace(/^\s*(\/\/|\*|\/\*).*$/gm, "") : "", /\.profile\.json/, `${file.slice(src.length + 1)} reads a profile file`);
  // What base.ts hands the app: the names, and no way to a profile.
  assert.equal(typeof base.targetTitle, "function");
  assert.deepEqual(base.KNOWN_TARGETS, KNOWN_TARGETS);
  assert.equal("getProfile" in base, false, "base.ts exports getProfile");
  // Behind the compiler's door they are whole: both compilers and the door itself reach targets/index.ts.
  const behind = follow(join(src, "compile", "index.ts"));
  assert.ok(behind.has(join(src, "targets", "index.ts")), "the compiler does not reach the profiles");
  // And the app's own two readers ask for a title by name.
  for (const file of ["apps/web/src/ui/ExportPanel.tsx", "apps/web/src/ui/inspector/GraphInspector.tsx"]) {
    assert.match(read(join(repoRoot, file)), /targetTitle\(/, file);
    assert.doesNotMatch(read(join(repoRoot, file)), /getProfile/, file);
  }
});

test("an export for each target still gets its whole profile: every tier's model, every effort, its tools or its settings", () => {
  for (const target of KNOWN_TARGETS as CompileTarget[]) {
    const profile = getProfile(target);
    // Every tier, on a node of its own, at every effort the profile names.
    const tiers = ["frontier", "strong", "fast"] as const;
    const efforts = ["low", "medium", "high", "max"] as const;
    for (const [i, tier] of tiers.entries()) {
      const doc = loop(target);
      const withTier = { ...doc, nodes: doc.nodes.map((node) => (node.kind === "agent" && node.id === "builder" ? { ...node, model: { tier }, effort: efforts[i + 1]! } : node)) };
      const files = compile(withTier, target).files;
      const builder = Object.entries(files).find(([path]) => /agents\/review-loop--builder\./.test(path))![1];
      assert.match(builder, new RegExp(`^model(: | = ")${profile.models[tier].replace(/[.[\]]/g, "\\$&")}"?$`, "m"), `${target} ${tier}`);
      assert.match(builder, new RegExp(`^(effort: |model_reasoning_effort = ")${profile.effort[efforts[i + 1]!]}"?$`, "m"), `${target} ${tier}`);
    }
    const files = compile(loop(target), target).files;
    const agents = Object.entries(files).filter(([path]) => /\/agents\//.test(path));
    assert.equal(agents.length, 2, target);
    if (target === "claude-code") {
      // The tools line is the profile's capability map, in the profile's order.
      for (const [path, text] of agents) {
        const tools = /^tools: (.+)$/m.exec(text)![1]!.split(", ");
        assert.ok(tools.length > 0 && tools.every((tool) => profile.toolOrder.includes(tool)), path);
        assert.deepEqual(tools, profile.toolOrder.filter((tool) => tools.includes(tool)), path);
      }
      assert.match(files[".grooph/review-loop/MAPPING.md"]!, new RegExp(profile.verifiedAgainst.replace(/\./g, "\\.")));
    } else {
      for (const [path, text] of agents) assert.match(text, /^sandbox_mode = "(read-only|workspace-write)"$/m, path);
      assert.match(files[".grooph/review-loop/MAPPING.md"]!, new RegExp(`CLI \`${profile.verifiedAgainst.replace(/\./g, "\\.")}\` help was read on ${profile.verifiedOn}`));
      assert.match(files[".grooph/review-loop/MAPPING.md"]!, new RegExp(`frontier → ${profile.models.frontier.replace(/\./g, "\\.")}, strong → ${profile.models.strong}, fast → ${profile.models.fast}`));
    }
  }
});

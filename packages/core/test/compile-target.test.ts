/**
 * A package is one harness's files (slice 0076, the second read of its review, item 1).
 *
 * A document says which harness it is for (`target.harness`), and an export says which package is wanted. Until
 * Codex had a profile the two could not disagree and compile: the other harness had none, and the validator refused
 * the document (`E_NO_TARGET`). With two profiles they can, and the Claude Code writer took its profile from the
 * document: a graph that named Codex, exported for Claude Code, came out as Claude Code agent files with Codex's
 * model names and no `tools` lines, which in Claude Code means every tool.
 *
 * Two things hold now, for both targets alike. `compile()` refuses a document that names another harness than the
 * export is for. And each writer uses its own target's profile whatever the document names, so the first is not the
 * only thing between a mistake and a package.
 */

import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { compileClaudeCode } from "../src/compile/claude-code/index.js";
import { compileCodex } from "../src/compile/codex/index.js";
import {
  CompileError,
  KNOWN_TARGETS,
  compile,
  getProfile,
  hasProfile,
  instantiate,
  parseGraphText,
  setTarget,
  tryCompile,
  validate,
  type AgentNode,
  type CompileTarget,
  type Graph,
  type Issue,
} from "../src/index.js";
import { fixturesDir, read, repoRoot } from "./helpers.js";

const TARGETS = ["claude-code", "codex"] as const satisfies readonly CompileTarget[];
const other = (target: CompileTarget): CompileTarget => (target === "codex" ? "claude-code" : "codex");
const reviewLoop = (): Graph => parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!;
const errorsOf = (issues: Issue[]): Issue[] => issues.filter((issue) => issue.severity === "error");
const refusal = (doc: Graph, target: CompileTarget): Issue[] => {
  try {
    compile(doc, target);
  } catch (err) {
    assert.ok(err instanceof CompileError, String(err));
    return errorsOf(err.issues);
  }
  return assert.fail(`compile(${doc.id} naming ${doc.target?.harness ?? "nothing"}, ${target}) wrote a package`);
};
const mismatch = (named: string, target: string): string =>
  `the document names the harness "${named}" and the export is for "${target}": export it for ${named}, or name ${target} in the document first (grooph apply <file> --ops - --write, given [{"op":"setTarget","harness":"${target}"}]) and export into a project that does not hold this graph's ${named} package`;

test("there are two targets, and the fixture these tests start from names Claude Code", () => {
  assert.deepEqual([...KNOWN_TARGETS].sort(), [...TARGETS].sort());
  assert.equal(reviewLoop().target?.harness, "claude-code");
});

test("the case in the review: the review loop naming Codex, exported for Claude Code, is refused with E_NO_TARGET", () => {
  // On `main` before Codex had a profile this was refused, by the validator. It is refused again.
  const doc = setTarget(reviewLoop(), "codex");
  assert.deepEqual(refusal(doc, "claude-code"), [{ code: "E_NO_TARGET", severity: "error", message: mismatch("codex", "claude-code"), at: ["review-loop"] }]);
  const attempt = tryCompile(doc, "claude-code");
  assert.equal(attempt.ok, false);
  if (!attempt.ok) assert.deepEqual(errorsOf(attempt.issues).map((issue) => issue.code), ["E_NO_TARGET"]);
});

for (const target of TARGETS) {
  const named = other(target);

  test(`a document that names ${named} is refused for ${target}, and exports for ${named} and for ${target} once it names it`, () => {
    const doc = setTarget(reviewLoop(), named);
    // The document is a good one: nothing is wrong with it but the export that was asked for.
    assert.deepEqual(errorsOf(validate(doc, { forExport: true })), []);
    assert.deepEqual(refusal(doc, target), [{ code: "E_NO_TARGET", severity: "error", message: mismatch(named, target), at: [doc.id] }]);
    // Both ways out that the message names.
    assert.ok(Object.keys(compile(doc, named).files).length > 4);
    const renamed = setTarget(doc, target);
    const pkg = compile(renamed, target);
    assert.ok(Object.keys(pkg.files).length > 4);
    // And the package's own copy of the document names the harness the package is for.
    assert.equal(parseGraphText(pkg.files[`.grooph/${doc.id}/graph.grooph.json`]!).doc!.target?.harness, target);
  });

  test(`for ${target}, a harness that is absent or has no profile is the validator's to report, once, as before`, () => {
    const none = { ...reviewLoop() };
    delete none.target;
    assert.deepEqual(refusal(none, target).map((issue) => issue.message), ["export needs a target harness; set target.harness"]);
    const unknown = setTarget(reviewLoop(), "not-a-harness");
    assert.deepEqual(refusal(unknown, target).map((issue) => issue.message), ['grooph has no compiler for the harness "not-a-harness", so no package can be written for it; the document is a plan as it is']);
    // A word every object answers to is no harness: it has no profile, and is refused as one that has none.
    for (const word of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      assert.equal(hasProfile(word), false, word);
      assert.throws(() => getProfile(word), /no compile profile for target harness/, word);
      assert.deepEqual(refusal(setTarget(reviewLoop(), word), target).map((issue) => issue.message), [`grooph has no compiler for the harness "${word}", so no package can be written for it; the document is a plan as it is`], word);
    }
  });

  test(`for ${target}, the refusal comes beside the document's other errors, not in place of them`, () => {
    const doc = setTarget(reviewLoop(), named);
    delete doc.goal;
    assert.deepEqual(refusal(doc, target).map((issue) => issue.code).sort(), ["E_NO_GOAL", "E_NO_TARGET"]);
  });
}

test("the two refusals are one sentence with the names changed", () => {
  const one = refusal(setTarget(reviewLoop(), "codex"), "claude-code")[0]!.message;
  const two = refusal(setTarget(reviewLoop(), "claude-code"), "codex")[0]!.message;
  const swap = (text: string): string => text.replaceAll("claude-code", "\u0000").replaceAll("codex", "claude-code").replaceAll("\u0000", "codex");
  assert.equal(swap(one), two);
});

// ─── the writers, called without the check, as test/compile.test.ts calls them ───────────────────────────────

const agentFiles = (files: Record<string, string>, under: string): [string, string][] => Object.entries(files).filter(([path]) => path.startsWith(under));
const withoutTheCopy = (files: Record<string, string>): Record<string, string> => Object.fromEntries(Object.entries(files).filter(([path]) => !path.endsWith("/graph.grooph.json")));

test("Claude Code's writer writes Claude Code's models and tools whatever harness the document names", () => {
  const asWritten = compileClaudeCode(reviewLoop(), []).files;
  for (const named of ["codex", "not-a-harness", "constructor"]) {
    const files = compileClaudeCode(setTarget(reviewLoop(), named), []).files;
    // Nothing differs but the package's copy of the document, which says what the document says.
    assert.deepEqual(withoutTheCopy(files), withoutTheCopy(asWritten), named);
  }
  const files = compileClaudeCode(setTarget(reviewLoop(), "codex"), []).files;
  const agents = agentFiles(files, ".claude/agents/");
  assert.equal(agents.length, 2);
  const models = Object.values(getProfile("claude-code").models);
  const tools = getProfile("claude-code").toolOrder;
  for (const [path, text] of agents) {
    const header = text.slice(0, text.indexOf("\n---", 4));
    const model = /^model: (.+)$/m.exec(header)?.[1];
    assert.ok(model !== undefined && models.includes(model), `${path}: model ${model}`);
    // A file with no `tools` line is an agent with every tool.
    const line = /^tools: (.+)$/m.exec(header)?.[1];
    assert.ok(line !== undefined && line.split(", ").every((tool) => tools.includes(tool)), `${path}: tools ${line}`);
    assert.doesNotMatch(text, /gpt-/, path);
  }
  for (const [path, text] of Object.entries(withoutTheCopy(files))) assert.doesNotMatch(text, /gpt-6|\.codex\/|spawn_agent/, path);
});

test("Codex's writer writes Codex's models and settings whatever harness the document names", () => {
  const asWritten = compileCodex(setTarget(reviewLoop(), "codex"), []).files;
  for (const named of ["claude-code", "not-a-harness", "constructor"]) {
    const files = compileCodex(setTarget(reviewLoop(), named), []).files;
    assert.deepEqual(withoutTheCopy(files), withoutTheCopy(asWritten), named);
  }
  const agents = agentFiles(asWritten, ".codex/agents/");
  assert.equal(agents.length, 2);
  const models = Object.values(getProfile("codex").models);
  for (const [path, text] of agents) {
    const model = /^model = "(.+)"$/m.exec(text)?.[1];
    assert.ok(model !== undefined && models.includes(model), `${path}: model ${model}`);
    assert.match(text, /^sandbox_mode = "(read-only|workspace-write)"$/m, path);
  }
});

test("a pin is read by the name of the target the package is for, not the harness the document names", () => {
  const pinned = (named: string): Graph => {
    const doc = setTarget(reviewLoop(), named);
    const critic = doc.nodes.find((node): node is AgentNode => node.kind === "agent" && node.id === "critic")!;
    return { ...doc, nodes: doc.nodes.map((node) => (node.id === critic.id ? { ...critic, model: { tier: "strong", pin: { codex: "pinned-for-codex", "claude-code": "pinned-for-claude-code" } } } : node)) };
  };
  for (const named of TARGETS) {
    assert.match(compileClaudeCode(pinned(named), []).files[".claude/agents/review-loop--critic.md"]!, /^model: pinned-for-claude-code$/m, named);
    assert.match(compileCodex(pinned(named), []).files[".codex/agents/review-loop--critic.toml"]!, /^model = "pinned-for-codex"$/m, named);
  }
});

// ─── a critic and its builder, in the harness the document names ────────────────────────────────────────────

test("a critic told apart from its builder only by a pin for the other harness is warned about; its own harness's pin is read", () => {
  // The driver's reader, on slice 0076: the review loop with its critic pinned for Claude Code only, naming Codex,
  // validated with no issues, and the export wrote both on gpt-6-luna.
  const homogeneous = (doc: Graph): boolean => validate(doc, { forExport: true }).some((issue) => issue.code === "W_HOMOGENEOUS_CRITICS");
  const withPin = (named: string | undefined, pin: Record<string, string> | undefined): Graph => {
    const doc = named === undefined ? (() => { const bare = { ...reviewLoop() }; delete bare.target; return bare; })() : setTarget(reviewLoop(), named);
    return { ...doc, nodes: doc.nodes.map((node) => (node.kind === "agent" && node.id === "critic" ? { ...node, model: { tier: "strong" as const, ...(pin ? { pin } : {}) } } : node)) };
  };
  // Builder and critic are both `strong` in the fixture: warned about, whatever it names.
  for (const named of [...TARGETS, undefined]) assert.equal(homogeneous(withPin(named, undefined)), true, String(named));
  for (const named of TARGETS) {
    // The other harness's pin is not read in this document's package: still one model.
    assert.equal(homogeneous(withPin(named, { [other(named)]: "another-model" })), true, `${named}, pinned for ${other(named)} only`);
    // Its own harness's pin is.
    assert.equal(homogeneous(withPin(named, { [named]: "another-model" })), false, `${named}, pinned for ${named}`);
    assert.equal(homogeneous(withPin(named, { [named]: "another-model", [other(named)]: "x" })), false, `${named}, pinned for both`);
    // And the package agrees with the warning: with the other harness's pin only, both agents are on one model.
    const files = compile(withPin(named, { [other(named)]: "another-model" }), named).files;
    const models = Object.entries(files).filter(([path]) => /\/agents\//.test(path)).map(([, text]) => /^model(?:: | = ")([^"\n]+)/m.exec(text)![1]);
    assert.equal(models.length, 2, named);
    assert.equal(models[0], models[1], named);
    assert.doesNotMatch(Object.values(files).filter((_, i) => !Object.keys(files)[i]!.endsWith("graph.grooph.json")).join("\n"), /another-model/, named);
  }
  // The message names what was compared: the tier, and no pin of another harness.
  const said = validate(withPin("codex", { "claude-code": "opus" }), { forExport: true }).find((issue) => issue.code === "W_HOMOGENEOUS_CRITICS")!.message;
  assert.match(said, /on the same model \(tier strong\)/);
  // A pin for the named harness is the model, whatever the tier: two nodes pinned to one model are on one model,
  // and two pinned apart are not, on one tier or two.
  type Said = { tier: "frontier" | "strong" | "fast"; pin?: Record<string, string> };
  const both = (critic: Said, builder: Said): Graph => {
    const doc = setTarget(reviewLoop(), "codex");
    const as = (said: Said): AgentNode["model"] => said as AgentNode["model"];
    return { ...doc, nodes: doc.nodes.map((node) => (node.kind !== "agent" ? node : node.id === "critic" ? { ...node, model: as(critic) } : node.id === "builder" ? { ...node, model: as(builder) } : node)) };
  };
  const onePinTwoTiers = both({ tier: "frontier", pin: { codex: "m1" } }, { tier: "strong", pin: { codex: "m1" } });
  assert.equal(homogeneous(onePinTwoTiers), true);
  assert.match(validate(onePinTwoTiers).find((issue) => issue.code === "W_HOMOGENEOUS_CRITICS")!.message, /on the same model \(pin codex: m1\)/);
  assert.deepEqual(Object.entries(compile(onePinTwoTiers, "codex").files).filter(([path]) => path.endsWith(".toml")).map(([, text]) => /^model = "(.+)"$/m.exec(text)![1]), ["m1", "m1"]);
  assert.equal(homogeneous(both({ tier: "strong", pin: { codex: "m1" } }, { tier: "strong", pin: { codex: "m2" } })), false);
  assert.equal(homogeneous(both({ tier: "frontier", pin: { codex: "m1" } }, { tier: "strong" })), false);
  assert.equal(homogeneous(both({ tier: "frontier", pin: { "claude-code": "m1" } }, { tier: "strong", pin: { "claude-code": "m1" } })), false, "two tiers, and the shared pin is for the other harness");
  // What the rule cannot see, said in docs/targets/codex.md: a pin that names the model its builder's tier means.
  assert.equal(homogeneous(both({ tier: "strong", pin: { codex: getProfile("codex").models.strong } }, { tier: "strong" })), false);
  // A document made in code with a harness that is no string is not the validator's to crash on.
  for (const odd of [7, null, {}, []]) assert.doesNotThrow(() => validate({ ...reviewLoop(), target: { harness: odd as unknown as string } }), String(odd));
  // A document that names no harness yet is read by every pin, as it was.
  assert.equal(homogeneous(withPin(undefined, { codex: "another-model" })), false);
  assert.equal(homogeneous(withPin(undefined, { "claude-code": "another-model" })), false);
});

// ─── the library ────────────────────────────────────────────────────────────────────────────────────────────

test("every built-in template that names a harness exports for it, is refused for the other, and exports for the other once it names it", () => {
  let whole = 0;
  for (const file of readdirSync(join(repoRoot, "patterns")).filter((name) => name.endsWith(".grooph.json")).sort()) {
    const template = parseGraphText(read(join(repoRoot, "patterns", file))).doc!;
    // A fragment names no harness: it is placed in a graph, which names its own.
    if (template.target === undefined) continue;
    const values = Object.fromEntries((template.template?.slots ?? []).map((slot) => [slot.key, slot.example ?? "x"]));
    const doc = instantiate(template, { name: `${template.id} filled`, values });
    const named = doc.target!.harness as CompileTarget;
    assert.ok(TARGETS.includes(named), `${file} names ${named}`);
    assert.ok(Object.keys(compile(doc, named).files).length > 3, file);
    assert.deepEqual(refusal(doc, other(named)).map((issue) => issue.message), [mismatch(named, other(named))], file);
    assert.ok(Object.keys(compile(setTarget(doc, other(named)), other(named)).files).length > 3, file);
    whole += 1;
  }
  assert.ok(whole >= 15, `only ${whole} templates were tried`);
});

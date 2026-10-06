/**
 * Words every object answers to ("constructor", "toString", "__proto__") as a document's own words: a capability,
 * a node's kind, a key. Each is the document's to use or to get wrong, and none may reach an object's prototype.
 * Found by a reader of the plan bundle (handoff 0100): three places looked such a word up as if it were theirs.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { canonicalize } from "../src/canonicalize.js";
import { tryCompile, type CompileTarget } from "../src/compile/index.js";
import { parseGraphText } from "../src/parse.js";
import type { AgentNode, Graph } from "../src/types.js";
import { validate } from "../src/validate.js";
import { fixturesDir, read } from "./helpers.js";

const WORDS = ["constructor", "toString", "hasOwnProperty", "valueOf", "__proto__"];
const text = (): string => read(join(fixturesDir, "valid", "fix-until-green.grooph.json"));
const raw = (): Graph => JSON.parse(text()) as Graph;

test("a capability that is a word every object answers to is a capability with no tool: both compilers write the package, and neither throws", () => {
  for (const word of WORDS) {
    const doc = raw();
    (doc.nodes[0] as AgentNode).allow = ["read-files", "edit-files", "run-tests", word];
    const parsed = parseGraphText(JSON.stringify(doc));
    assert.ok(parsed.doc, word);
    assert.deepEqual(validate(parsed.doc, { forExport: true }).filter((issue) => issue.severity === "error"), [], word);
    for (const target of ["claude-code", "codex"] as CompileTarget[]) {
      const named = parseGraphText(JSON.stringify({ ...doc, target: { harness: target } })).doc!;
      const attempt = tryCompile(named, target);
      assert.ok(attempt.ok, `${word} for ${target}: ${attempt.ok ? "" : JSON.stringify(attempt.issues).slice(0, 200)}`);
      // The word is no tool of the harness's: where the package lists an agent's tools it is not among them, and
      // nothing a function prints as is in any file.
      for (const [path, body] of Object.entries(attempt.result.files)) {
        assert.doesNotMatch(body, /\[native code\]|function Object\(\)/, `${word} for ${target}: ${path}`);
        const tools = /^tools: (.*)$/m.exec(body)?.[1];
        if (tools !== undefined) assert.ok(!tools.split(/,\s*/).includes(word), `${word} for ${target}: ${path} lists it as a tool`);
      }
    }
  }
});

test("a node whose kind is a word every object answers to is outside the schema, and is said to be, not thrown on", () => {
  for (const word of WORDS) {
    const doc = raw();
    (doc.nodes[0] as { kind: string }).kind = word;
    const parsed = parseGraphText(JSON.stringify(doc));
    assert.equal(parsed.doc, undefined, word);
    assert.deepEqual([...new Set(parsed.issues.map((issue) => issue.code))], ["E_SCHEMA"], word);
    assert.ok(parsed.issues.some((issue) => issue.message.includes("kind") && issue.message.includes(JSON.stringify(word))), `${word}: ${parsed.issues[0]?.message}`);
  }
  // The same of a policy's or a stop's kind, which are told apart the same way.
  for (const word of WORDS) {
    const doc = raw();
    (doc.loops[0]!.stops[0] as { kind: string }).kind = word;
    const parsed = parseGraphText(JSON.stringify(doc));
    assert.equal(parsed.doc, undefined, word);
    assert.deepEqual([...new Set(parsed.issues.map((issue) => issue.code))], ["E_SCHEMA"], word);
  }
});

test("a key named __proto__ is an unknown key like any other: it is warned of, kept in the canonical text, and changes no object but its own", () => {
  const places: [string, (doc: Record<string, unknown>) => Record<string, unknown>][] = [
    ["the graph", (doc) => doc],
    ["a node", (doc) => (doc["nodes"] as Record<string, unknown>[])[0]!],
    ["the target", (doc) => doc["target"] as Record<string, unknown>],
    ["a loop", (doc) => (doc["loops"] as Record<string, unknown>[])[0]!],
  ];
  for (const [where, at] of places) {
    // Written as text, as a file is: JSON.parse makes it a key of the object's own.
    const doc = JSON.parse(text()) as Record<string, unknown>;
    Object.defineProperty(at(doc), "__proto__", { value: { polluted: true, nested: { x: 1 } }, enumerable: true, writable: true, configurable: true });
    const parsed = parseGraphText(JSON.stringify(doc));
    assert.ok(parsed.doc, where);
    const warned = validate(parsed.doc).filter((issue) => issue.code === "W_UNKNOWN_KEY");
    assert.equal(warned.length, 1, where);
    assert.match(warned[0]!.message, /unknown key "__proto__".*it is kept/, where);
    // Kept: the canonical text holds it, and reads back to the same text.
    const canonical = canonicalize(parsed.doc);
    assert.match(canonical, /"__proto__": \{\n\s+"nested": \{\n\s+"x": 1\n\s+\},\n\s+"polluted": true/, where);
    assert.equal(canonicalize(parseGraphText(canonical).doc!), canonical, where);
    // And no object but that one was touched.
    assert.equal(({} as Record<string, unknown>)["polluted"], undefined, where);
    assert.equal((parsed.doc as unknown as Record<string, unknown>)["polluted"], undefined, where);
  }
  // A document without the word is byte for byte what it was.
  assert.equal(canonicalize(parseGraphText(text()).doc!), text());
});

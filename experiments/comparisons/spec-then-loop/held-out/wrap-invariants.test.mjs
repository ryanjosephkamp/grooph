// Held-out invariants for word wrapping (spec-then-loop comparison). The scorer runs this file
// from the project root after the run: node --test <this file>. No arm sees it and nothing in
// the run names it.
//
// The task is deliberately thin ("a function that wraps text to a given width"), and the
// template's planner writes the acceptance, so this suite cannot pin a signature or the design
// choices (long words, blank lines, trailing spaces). It checks only what any word wrap must do
// on plain input — single-spaced ASCII words, every word shorter than the width — after finding
// the export by name:
//
//   - a function whose name contains "wrap" is exported from a file under src/;
//   - called as fn(text, width) (or fn(text, { width }) when that form throws), it returns a
//     string (lines joined by "\n") or an array of strings;
//   - no line is longer than the width;
//   - the words come back, in order, none lost, none split, none invented;
//   - no line is empty, and no line starts or ends with a space;
//   - a text that already fits is one line, unchanged;
//   - greedy fill: no line could have taken the next line's first word (named apart, since a
//     balanced wrap is a defensible design choice).
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

let wrapFn = null;
let wrapName = null;
let loadError = null;
try {
  const dir = join(process.cwd(), "src");
  const candidates = [];
  for (const name of readdirSync(dir).filter((n) => /\.(mjs|js)$/.test(n))) {
    const mod = await import(pathToFileURL(join(dir, name)).href);
    for (const [key, value] of Object.entries(mod)) {
      if (typeof value === "function" && /wrap/i.test(key)) candidates.push({ name: `${name}:${key}`, key, fn: value });
    }
    if (typeof mod.default === "function" && /wrap/i.test(name)) candidates.push({ name: `${name}:default`, key: "default", fn: mod.default });
  }
  const rank = (c) => (c.key === "wrap" ? 0 : /^wrap(Text|Words|Line|Lines)$/i.test(c.key) ? 1 : /^wordWrap$/i.test(c.key) ? 2 : 3);
  candidates.sort((a, b) => rank(a) - rank(b));
  if (candidates.length > 0) ({ fn: wrapFn, name: wrapName } = candidates[0]);
} catch (error) {
  loadError = error;
}

const ready = () => {
  if (typeof wrapFn !== "function") assert.fail(`no exported function whose name contains "wrap" under src/${loadError ? `: ${loadError.message}` : ""}`);
};

/** Call the wrap however it is shaped, and return the lines. */
function linesOf(text, width) {
  let out;
  try {
    out = wrapFn(text, width);
  } catch (first) {
    try {
      out = wrapFn(text, { width });
    } catch {
      throw first;
    }
  }
  if (typeof out === "string") return out.split("\n");
  if (Array.isArray(out) && out.every((l) => typeof l === "string")) return out;
  assert.fail(`${wrapName} returned ${typeof out}, not a string or an array of strings`);
}

const words = (s) => s.split(/\s+/).filter(Boolean);

const texts = [
  "the quick brown fox jumps over the lazy dog",
  "one two three four five six seven eight nine ten eleven twelve",
  "a b c d e f g h i j k l m n o p q r s t u v w x y z",
  "grooph never runs agents the harness is the runtime and the graph is the plan to start from",
  "short",
  "pack my box with five dozen liquor jugs",
  "wrapping text to a given width is a small job with many corners",
];
const widths = [10, 20, 40];

test(`an export whose name contains "wrap" exists under src/ (${wrapName ?? "none found"})`, () => {
  ready();
});

for (const text of texts) {
  for (const width of widths) {
    const label = `${JSON.stringify(text.length > 30 ? `${text.slice(0, 30)}…` : text)} at ${width}`;
    test(`lines fit: ${label}`, () => {
      ready();
      const lines = linesOf(text, width);
      for (const line of lines) assert.ok(line.length <= width, `${JSON.stringify(line)} is ${line.length} > ${width}`);
    });
    test(`words kept in order: ${label}`, () => {
      ready();
      const lines = linesOf(text, width);
      assert.deepEqual(words(lines.join(" ")), words(text));
    });
    test(`no empty or space-edged line: ${label}`, () => {
      ready();
      const lines = linesOf(text, width);
      for (const line of lines) {
        assert.ok(line.length > 0, "an empty line");
        assert.equal(line, line.trim(), `${JSON.stringify(line)} has a space at an edge`);
      }
    });
    test(`greedy fill (design choice, named apart): ${label}`, () => {
      ready();
      const lines = linesOf(text, width);
      for (let i = 0; i + 1 < lines.length; i += 1) {
        const next = words(lines[i + 1])[0];
        assert.ok(lines[i].length + 1 + next.length > width, `line ${i} ${JSON.stringify(lines[i])} could have taken ${JSON.stringify(next)}`);
      }
    });
  }
}

test("a text that already fits is one line, unchanged", () => {
  ready();
  assert.deepEqual(linesOf("fits", 10), ["fits"]);
  assert.deepEqual(linesOf("just right", 10), ["just right"]);
});

test("a width equal to the longest word still fits every line", () => {
  ready();
  const lines = linesOf("aaaa bb cccc d", 4);
  for (const line of lines) assert.ok(line.length <= 4, JSON.stringify(line));
  assert.deepEqual(words(lines.join(" ")), ["aaaa", "bb", "cccc", "d"]);
});

test("the result is a string or an array of strings, and calling twice gives the same result", () => {
  ready();
  const a = linesOf("the same text twice over", 9);
  const b = linesOf("the same text twice over", 9);
  assert.deepEqual(a, b);
});

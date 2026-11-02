// Held-out cases for `compare` (grind-loop comparison). The scorer runs this file from the
// project root after the run: node --test <this file>. It imports the project's src/semver.mjs
// by cwd. No arm sees it: the builder is told it exists and is not its to read.
//
// Every case follows from semver.org §2, §9, §10 and §11 and is absent from the visible suite
// tests/semver.test.mjs, so it measures how far a pass on the visible tests generalises.
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

let compare = null;
let loadError = null;
try {
  ({ compare } = await import(pathToFileURL(join(process.cwd(), "src", "semver.mjs")).href));
} catch (error) {
  loadError = error;
}
const ready = () => {
  if (typeof compare !== "function") assert.fail(`src/semver.mjs does not export compare: ${loadError?.message ?? "no function"}`);
};

const ordered = [
  ["1.0.0-alpha.1", "1.0.0-alpha.1.1", "a larger set of pre-release fields ranks higher when the earlier ones are equal"],
  ["1.0.0-1.2.3", "1.0.0-1.2.3.0", "the same, all numeric"],
  ["1.0.0-alpha.9", "1.0.0-alpha.10", "numeric identifiers compare as numbers, not strings"],
  ["1.0.0-alpha.9", "1.0.0-alpha.1a", "an alphanumeric identifier ranks above any numeric one"],
  ["1.0.0-Alpha", "1.0.0-alpha", "alphanumeric identifiers compare in ASCII order: 'A' before 'a'"],
  ["1.0.0-alpha.1", "1.0.0-alpha-1", "'alpha' is a prefix of 'alpha-1', so it comes first; the hyphen is part of the identifier"],
  ["1.0.0-0", "1.0.0-00a", "numeric 0 ranks below the alphanumeric identifier 00a (a leading zero is allowed there)"],
  ["1.0.0-99999999999999999998", "1.0.0-99999999999999999999", "numeric identifiers beyond 2^53 still compare as numbers"],
  ["1.0.0-9", "1.0.0-99999999999999999999", "a very large numeric identifier ranks above a small one"],
  ["1.0.0-rc.1", "1.0.0-rc.1.0", "trailing .0 is one more field"],
  ["1.0.0-beta", "1.0.0-beta.0", "beta before beta.0"],
  ["9.0.0", "10.0.0", "major compares as a number"],
  ["1.9.0", "1.10.0", "minor compares as a number"],
  ["1.0.9", "1.0.10", "patch compares as a number"],
  ["1.0.0-0", "1.0.0", "the lowest pre-release still comes before the release"],
  ["1.0.0-zzz", "1.0.0", "the highest alphanumeric pre-release still comes before the release"],
  ["1.0.0-a.-", "1.0.0-a.--", "hyphen-only identifiers compare as strings by length"],
  ["1.0.0-alpha.1+x", "1.0.0-alpha.2+a", "build metadata does not change pre-release order"],
  ["0.0.0", "0.0.1", "zero versions"],
];

for (const [lower, higher, why] of ordered) {
  test(`${lower} < ${higher}: ${why}`, () => {
    ready();
    assert.equal(compare(lower, higher), -1);
    assert.equal(compare(higher, lower), 1);
  });
}

const equal = [
  ["1.0.0-alpha+001", "1.0.0-alpha+002", "build metadata does not count"],
  ["1.0.0+a", "1.0.0", "build metadata against none"],
  ["1.0.0+21AF26D3----117B344092BD", "1.0.0+x", "long hyphenated build metadata is valid and does not count"],
  ["1.0.0-x-y-z.--", "1.0.0-x-y-z.--", "hyphenated identifiers are valid and equal to themselves"],
  ["1.0.0-0.3.7", "1.0.0-0.3.7+build.11.e0f985a", "the spec's own examples"],
];

for (const [a, b, why] of equal) {
  test(`${a} == ${b}: ${why}`, () => {
    ready();
    assert.equal(compare(a, b), 0);
    assert.equal(compare(b, a), 0);
  });
}

const invalid = [
  ["1.0.0-alpha_1", "an underscore is not allowed in an identifier"],
  ["1.0.0-alpha..", "an empty identifier"],
  ["1.0.0+build..1", "an empty build identifier"],
  ["1.0.0-alpha.01", "a numeric pre-release identifier must not have a leading zero"],
  ["1.0.0-al pha", "a space inside an identifier"],
  [" 1.0.0", "leading whitespace"],
  ["1.0.0\n", "a trailing newline"],
  ["1.0.0-alpha+build+1", "a second plus"],
  ["1.0.0+build_1", "an underscore in build metadata"],
  ["1.0.0-α", "a non-ASCII identifier"],
  ["１.0.0", "a full-width digit"],
  ["1.0.0-", "an empty pre-release"],
  ["1.0.0+", "empty build metadata"],
  ["1.0.0-+build", "an empty pre-release before build metadata"],
  ["1.0.0.1", "four numbers"],
  ["1.0", "two numbers"],
  ["1.0.0-alpha!", "punctuation in an identifier"],
  ["+1.0.0", "a leading plus"],
  ["1.-0.0", "a negative component"],
];

for (const [bad, why] of invalid) {
  test(`${JSON.stringify(bad)} throws RangeError: ${why}`, () => {
    ready();
    assert.throws(() => compare(bad, "1.0.0"), RangeError);
    assert.throws(() => compare("1.0.0", bad), RangeError);
  });
}

const valid = ["1.0.0-x-y-z.--", "1.0.0--", "1.0.0-a.-1", "1.0.0-0.3.7", "1.0.0+21AF26D3----117B344092BD", "1.0.0-alpha.beta.1", "1.0.0-0A.is.legal", "0.0.4", "10.20.30", "1.1.2-prerelease+meta", "1.0.0-rc.1+build.1", "2.0.0-rc.1+build.123", "1.2.3-beta", "10.2.3-DEV-SNAPSHOT", "1.2.3-SNAPSHOT-123", "1.0.0-alpha-a.b-c-somethinglong+build.1-aef.1-its-okay"];

for (const good of valid) {
  test(`${good} is a valid version (compares equal to itself)`, () => {
    ready();
    assert.equal(compare(good, good), 0);
  });
}

test("a String object, a Symbol, a BigInt, a boolean and a function throw TypeError", () => {
  ready();
  for (const bad of [new String("1.0.0"), Symbol("v"), 1n, true, () => "1.0.0"]) {
    assert.throws(() => compare(bad, "1.0.0"), TypeError);
    assert.throws(() => compare("1.0.0", bad), TypeError);
  }
});

test("sorting a shuffled list with duplicates gives the §11 order and keeps the duplicates", () => {
  ready();
  const list = ["1.0.0-alpha.beta", "1.0.0", "1.0.0-alpha", "1.0.0-beta.11", "1.0.0-alpha.1", "1.0.0-beta.2", "1.0.0-rc.1", "1.0.0-beta", "1.0.0-alpha", "1.0.0+build"];
  const sorted = [...list].sort(compare);
  assert.deepEqual(sorted.slice(0, 2), ["1.0.0-alpha", "1.0.0-alpha"]);
  assert.deepEqual(sorted.slice(2, 8), ["1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta", "1.0.0-beta.2", "1.0.0-beta.11", "1.0.0-rc.1"]);
  assert.deepEqual(new Set(sorted.slice(8)), new Set(["1.0.0", "1.0.0+build"]));
});

test("the result is exactly -1, 0 or 1", () => {
  ready();
  for (const [a, b] of [["1.0.0", "2.0.0"], ["1.0.0-alpha.9", "1.0.0-alpha.10"], ["1.0.0", "1.0.0"], ["3.0.0", "1.0.0"]]) {
    const out = compare(a, b);
    assert.ok([-1, 0, 1].includes(out), `${a} vs ${b} gave ${out}`);
  }
});

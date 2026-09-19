import assert from "node:assert/strict";
import { test } from "node:test";

import { compare } from "../src/semver.mjs";

test("major, minor and patch compare as numbers", () => {
  assert.equal(compare("1.0.0", "2.0.0"), -1);
  assert.equal(compare("2.0.0", "2.1.0"), -1);
  assert.equal(compare("2.1.0", "2.1.1"), -1);
  assert.equal(compare("2.1.1", "2.1.0"), 1);
  assert.equal(compare("1.10.0", "1.9.0"), 1);
  assert.equal(compare("0.0.10", "0.0.9"), 1);
});

test("equal versions compare as 0", () => {
  assert.equal(compare("1.2.3", "1.2.3"), 0);
  assert.equal(compare("1.0.0-rc.1", "1.0.0-rc.1"), 0);
});

test("a pre-release comes before its release", () => {
  assert.equal(compare("1.0.0-alpha", "1.0.0"), -1);
  assert.equal(compare("1.0.0", "1.0.0-alpha"), 1);
  assert.equal(compare("1.0.0-rc.1", "0.9.9"), 1);
});

test("pre-release identifiers follow the §11 chain", () => {
  const chain = [
    "1.0.0-alpha",
    "1.0.0-alpha.1",
    "1.0.0-alpha.beta",
    "1.0.0-beta",
    "1.0.0-beta.2",
    "1.0.0-beta.11",
    "1.0.0-rc.1",
    "1.0.0",
  ];
  for (let i = 0; i + 1 < chain.length; i += 1) {
    assert.equal(compare(chain[i], chain[i + 1]), -1, `${chain[i]} < ${chain[i + 1]}`);
    assert.equal(compare(chain[i + 1], chain[i]), 1, `${chain[i + 1]} > ${chain[i]}`);
  }
});

test("numeric identifiers compare as numbers, and rank below alphanumeric ones", () => {
  assert.equal(compare("1.0.0-2", "1.0.0-10"), -1);
  assert.equal(compare("1.0.0-9", "1.0.0-a"), -1);
  assert.equal(compare("1.0.0-x.7.z.92", "1.0.0-x.7.z.92"), 0);
  assert.equal(compare("1.0.0-a-b", "1.0.0-a"), 1);
});

test("build metadata does not count", () => {
  assert.equal(compare("1.0.0+build.1", "1.0.0+build.2"), 0);
  assert.equal(compare("1.0.0-alpha+001", "1.0.0-alpha"), 0);
  assert.equal(compare("1.0.0+20130313144700", "1.0.1"), -1);
});

test("sorting with compare orders a mixed list", () => {
  const sorted = ["1.0.0", "1.0.0-rc.1", "0.9.9", "1.0.0-beta.11", "1.0.0-beta.2", "2.0.0-alpha"].sort(compare);
  assert.deepEqual(sorted, ["0.9.9", "1.0.0-beta.2", "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0", "2.0.0-alpha"]);
});

test("a string that is not a semantic version throws a RangeError", () => {
  for (const bad of ["", "1", "1.0", "1.0.0.0", "v1.0.0", "01.0.0", "1.01.0", "1.0.0-", "1.0.0-01", "1.0.0-alpha..1", "1.0.0+", "1.0.0 ", "-1.0.0"]) {
    assert.throws(() => compare(bad, "1.0.0"), RangeError, JSON.stringify(bad));
    assert.throws(() => compare("1.0.0", bad), RangeError, JSON.stringify(bad));
  }
});

test("a leading zero is allowed in build metadata and in alphanumeric identifiers", () => {
  assert.equal(compare("1.0.0+001", "1.0.0"), 0);
  assert.equal(compare("1.0.0-0a", "1.0.0-0b"), -1);
});

test("an argument that is not a string throws a TypeError", () => {
  for (const bad of [undefined, null, 100, ["1.0.0"], { version: "1.0.0" }]) {
    assert.throws(() => compare(bad, "1.0.0"), TypeError);
    assert.throws(() => compare("1.0.0", bad), TypeError);
  }
});

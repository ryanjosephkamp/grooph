# Blind judge · grind-loop

Model `claude-fable-5-1`, no tools, fresh session, 2026-09-21T21:47:31.671Z; ledger invocation 7, $0.5037. The letters' mapping is in `mapping.json`, which the judge never saw.

## Prompt

You are a critic judging 6 candidate changes to one small Node project. Each candidate was produced by a different session working from the same task; you do not know how, and you should not guess. Judge only what the diff shows against the task and its acceptance material. You have no tools: read carefully and cite lines of the diff.

# The task

Implement `compare(a, b)` in src/semver.mjs so that every test in tests/semver.test.mjs passes. The tests are the specification: do not change them. A held-out set of cases exists outside this project and is run against your result after you finish; it is not yours to read or run.

# Acceptance material the builder saw

### README.md

```
# semver-mini

Compare semantic versions by the precedence rules of semver.org §11.

```js
import { compare } from "./src/semver.mjs";

compare("1.0.0-beta.2", "1.0.0-beta.11"); // -1
```
```

### tests/semver.test.mjs

```
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
```

# Candidates (in random order, under random letters)

## Candidate W

```diff
diff --git a/src/semver.mjs b/src/semver.mjs
index c20a655..7171978 100644
--- a/src/semver.mjs
+++ b/src/semver.mjs
@@ -10,6 +10,76 @@
  * @param {string} b
  * @returns {-1 | 0 | 1}
  */
+
+// Strict semver 2.0.0 grammar (see semver.org §2, §9, §10).
+const SEMVER_RE =
+  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
+
+function parse(version) {
+  if (typeof version !== "string") {
+    throw new TypeError(`Expected a string, got ${typeof version}`);
+  }
+
+  const match = SEMVER_RE.exec(version);
+  if (!match) {
+    throw new RangeError(`Invalid semantic version: ${JSON.stringify(version)}`);
+  }
+
+  const [, major, minor, patch, prerelease] = match;
+
+  return {
+    major: Number(major),
+    minor: Number(minor),
+    patch: Number(patch),
+    prerelease: prerelease ? prerelease.split(".") : [],
+  };
+}
+
+function compareIdentifiers(a, b) {
+  const aIsNumeric = /^\d+$/.test(a);
+  const bIsNumeric = /^\d+$/.test(b);
+
+  if (aIsNumeric && bIsNumeric) {
+    const an = Number(a);
+    const bn = Number(b);
+    if (an < bn) return -1;
+    if (an > bn) return 1;
+    return 0;
+  }
+
+  // Numeric identifiers always have lower precedence than alphanumeric ones.
+  if (aIsNumeric) return -1;
+  if (bIsNumeric) return 1;
+
+  if (a < b) return -1;
+  if (a > b) return 1;
+  return 0;
+}
+
+function comparePrerelease(a, b) {
+  // No pre-release has higher precedence than any pre-release.
+  if (a.length === 0 && b.length === 0) return 0;
+  if (a.length === 0) return 1;
+  if (b.length === 0) return -1;
+
+  const len = Math.min(a.length, b.length);
+  for (let i = 0; i < len; i += 1) {
+    const cmp = compareIdentifiers(a[i], b[i]);
+    if (cmp !== 0) return cmp;
+  }
+
+  if (a.length < b.length) return -1;
+  if (a.length > b.length) return 1;
+  return 0;
+}
+
 export function compare(a, b) {
-  throw new Error("not implemented");
+  const va = parse(a);
+  const vb = parse(b);
+
+  if (va.major !== vb.major) return va.major < vb.major ? -1 : 1;
+  if (va.minor !== vb.minor) return va.minor < vb.minor ? -1 : 1;
+  if (va.patch !== vb.patch) return va.patch < vb.patch ? -1 : 1;
+
+  return comparePrerelease(va.prerelease, vb.prerelease);
 }
```

## Candidate X

```diff
diff --git a/src/semver.mjs b/src/semver.mjs
index c20a655..e0c51f2 100644
--- a/src/semver.mjs
+++ b/src/semver.mjs
@@ -10,6 +10,74 @@
  * @param {string} b
  * @returns {-1 | 0 | 1}
  */
+
+const NUMERIC_IDENT = "(?:0|[1-9]\\d*)";
+const ALPHANUMERIC_IDENT = "(?:\\d*[a-zA-Z-][a-zA-Z0-9-]*)";
+const PRE_RELEASE_IDENT = `(?:${NUMERIC_IDENT}|${ALPHANUMERIC_IDENT})`;
+const BUILD_IDENT = "[0-9a-zA-Z-]+";
+
+const SEMVER_RE = new RegExp(
+  `^(${NUMERIC_IDENT})\\.(${NUMERIC_IDENT})\\.(${NUMERIC_IDENT})` +
+    `(?:-(${PRE_RELEASE_IDENT}(?:\\.${PRE_RELEASE_IDENT})*))?` +
+    `(?:\\+(${BUILD_IDENT}(?:\\.${BUILD_IDENT})*))?$`,
+);
+
+function parse(version) {
+  if (typeof version !== "string") {
+    throw new TypeError(`Expected a string, got ${typeof version}`);
+  }
+  const match = SEMVER_RE.exec(version);
+  if (!match) {
+    throw new RangeError(`Invalid semantic version: ${JSON.stringify(version)}`);
+  }
+  const [, major, minor, patch, preRelease] = match;
+  return {
+    major: Number(major),
+    minor: Number(minor),
+    patch: Number(patch),
+    preRelease: preRelease ? preRelease.split(".") : [],
+  };
+}
+
+function isNumericIdent(ident) {
+  return /^(?:0|[1-9]\d*)$/.test(ident);
+}
+
+function comparePreReleaseIdent(a, b) {
+  const aNumeric = isNumericIdent(a);
+  const bNumeric = isNumericIdent(b);
+  if (aNumeric && bNumeric) {
+    const an = Number(a);
+    const bn = Number(b);
+    return an < bn ? -1 : an > bn ? 1 : 0;
+  }
+  if (aNumeric && !bNumeric) return -1;
+  if (!aNumeric && bNumeric) return 1;
+  return a < b ? -1 : a > b ? 1 : 0;
+}
+
+function comparePreRelease(a, b) {
+  if (a.length === 0 && b.length === 0) return 0;
+  if (a.length === 0) return 1;
+  if (b.length === 0) return -1;
+
+  const len = Math.max(a.length, b.length);
+  for (let i = 0; i < len; i += 1) {
+    if (i >= a.length) return -1;
+    if (i >= b.length) return 1;
+    const cmp = comparePreReleaseIdent(a[i], b[i]);
+    if (cmp !== 0) return cmp;
+  }
+  return 0;
+}
+
 export function compare(a, b) {
-  throw new Error("not implemented");
+  const va = parse(a);
+  const vb = parse(b);
+
+  if (va.major !== vb.major) return va.major < vb.major ? -1 : 1;
+  if (va.minor !== vb.minor) return va.minor < vb.minor ? -1 : 1;
+  if (va.patch !== vb.patch) return va.patch < vb.patch ? -1 : 1;
+
+  return comparePreRelease(va.preRelease, vb.preRelease);
 }
```

## Candidate J

```diff
diff --git a/src/semver.mjs b/src/semver.mjs
index c20a655..190e4d5 100644
--- a/src/semver.mjs
+++ b/src/semver.mjs
@@ -10,6 +10,69 @@
  * @param {string} b
  * @returns {-1 | 0 | 1}
  */
+
+const SEMVER_RE =
+  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
+
+function parse(version) {
+  if (typeof version !== "string") {
+    throw new TypeError(`Expected a string, got ${typeof version}`);
+  }
+
+  const match = SEMVER_RE.exec(version);
+  if (!match) {
+    throw new RangeError(`Invalid semantic version: ${JSON.stringify(version)}`);
+  }
+
+  const [, major, minor, patch, prerelease] = match;
+  return {
+    major: Number(major),
+    minor: Number(minor),
+    patch: Number(patch),
+    prerelease: prerelease ? prerelease.split(".") : [],
+  };
+}
+
+function compareIdentifiers(a, b) {
+  const aIsNumeric = /^\d+$/.test(a);
+  const bIsNumeric = /^\d+$/.test(b);
+
+  if (aIsNumeric && bIsNumeric) {
+    const an = Number(a);
+    const bn = Number(b);
+    if (an === bn) return 0;
+    return an < bn ? -1 : 1;
+  }
+
+  if (aIsNumeric) return -1;
+  if (bIsNumeric) return 1;
+
+  if (a === b) return 0;
+  return a < b ? -1 : 1;
+}
+
+function comparePrerelease(a, b) {
+  if (a.length === 0 && b.length === 0) return 0;
+  if (a.length === 0) return 1;
+  if (b.length === 0) return -1;
+
+  const len = Math.max(a.length, b.length);
+  for (let i = 0; i < len; i += 1) {
+    if (i >= a.length) return -1;
+    if (i >= b.length) return 1;
+    const cmp = compareIdentifiers(a[i], b[i]);
+    if (cmp !== 0) return cmp;
+  }
+  return 0;
+}
+
 export function compare(a, b) {
-  throw new Error("not implemented");
+  const va = parse(a);
+  const vb = parse(b);
+
+  if (va.major !== vb.major) return va.major < vb.major ? -1 : 1;
+  if (va.minor !== vb.minor) return va.minor < vb.minor ? -1 : 1;
+  if (va.patch !== vb.patch) return va.patch < vb.patch ? -1 : 1;
+
+  return comparePrerelease(va.prerelease, vb.prerelease);
 }
```

## Candidate M

```diff
diff --git a/src/semver.mjs b/src/semver.mjs
index c20a655..1327cbf 100644
--- a/src/semver.mjs
+++ b/src/semver.mjs
@@ -10,6 +10,77 @@
  * @param {string} b
  * @returns {-1 | 0 | 1}
  */
+
+// Official semver.org regex (adapted), see
+// https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
+const SEMVER_RE =
+  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
+
+function parse(version) {
+  if (typeof version !== "string") {
+    throw new TypeError(`Expected a string, got ${typeof version}`);
+  }
+  const match = SEMVER_RE.exec(version);
+  if (!match) {
+    throw new RangeError(`Invalid semantic version: ${JSON.stringify(version)}`);
+  }
+  const [, major, minor, patch, prerelease] = match;
+  return {
+    major: Number(major),
+    minor: Number(minor),
+    patch: Number(patch),
+    prerelease: prerelease ? prerelease.split(".") : [],
+  };
+}
+
+function isNumericIdentifier(id) {
+  return /^(0|[1-9]\d*)$/.test(id);
+}
+
+function compareIdentifier(a, b) {
+  const aNumeric = isNumericIdentifier(a);
+  const bNumeric = isNumericIdentifier(b);
+
+  if (aNumeric && bNumeric) {
+    const an = Number(a);
+    const bn = Number(b);
+    return an < bn ? -1 : an > bn ? 1 : 0;
+  }
+  if (aNumeric && !bNumeric) {
+    // numeric identifiers always have lower precedence than alphanumeric
+    return -1;
+  }
+  if (!aNumeric && bNumeric) {
+    return 1;
+  }
+  return a < b ? -1 : a > b ? 1 : 0;
+}
+
+function comparePrerelease(a, b) {
+  // No pre-release has higher precedence than a pre-release.
+  if (a.length === 0 && b.length === 0) return 0;
+  if (a.length === 0) return 1;
+  if (b.length === 0) return -1;
+
+  const len = Math.min(a.length, b.length);
+  for (let i = 0; i < len; i += 1) {
+    const cmp = compareIdentifier(a[i], b[i]);
+    if (cmp !== 0) return cmp;
+  }
+  // A larger set of pre-release fields has a higher precedence than a
+  // smaller set, if all of the preceding identifiers are equal.
+  if (a.length < b.length) return -1;
+  if (a.length > b.length) return 1;
+  return 0;
+}
+
 export function compare(a, b) {
-  throw new Error("not implemented");
+  const va = parse(a);
+  const vb = parse(b);
+
+  if (va.major !== vb.major) return va.major < vb.major ? -1 : 1;
+  if (va.minor !== vb.minor) return va.minor < vb.minor ? -1 : 1;
+  if (va.patch !== vb.patch) return va.patch < vb.patch ? -1 : 1;
+
+  return comparePrerelease(va.prerelease, vb.prerelease);
 }
```

## Candidate F

```diff
diff --git a/src/semver.mjs b/src/semver.mjs
index c20a655..c2f763d 100644
--- a/src/semver.mjs
+++ b/src/semver.mjs
@@ -10,6 +10,64 @@
  * @param {string} b
  * @returns {-1 | 0 | 1}
  */
+const SEMVER_RE =
+  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
+
+function parse(version) {
+  if (typeof version !== "string") {
+    throw new TypeError(`Invalid semantic version: expected a string, got ${typeof version}`);
+  }
+  const match = SEMVER_RE.exec(version);
+  if (!match) {
+    throw new RangeError(`Invalid semantic version: ${JSON.stringify(version)}`);
+  }
+  const [, major, minor, patch, prerelease] = match;
+  return {
+    major: Number(major),
+    minor: Number(minor),
+    patch: Number(patch),
+    prerelease: prerelease ? prerelease.split(".") : [],
+  };
+}
+
+const NUMERIC_ID_RE = /^(?:0|[1-9]\d*)$/;
+
+function compareIdentifier(a, b) {
+  const aIsNumeric = NUMERIC_ID_RE.test(a);
+  const bIsNumeric = NUMERIC_ID_RE.test(b);
+  if (aIsNumeric && bIsNumeric) {
+    const an = Number(a);
+    const bn = Number(b);
+    return an < bn ? -1 : an > bn ? 1 : 0;
+  }
+  if (aIsNumeric !== bIsNumeric) {
+    // Numeric identifiers always have lower precedence than alphanumeric ones.
+    return aIsNumeric ? -1 : 1;
+  }
+  return a < b ? -1 : a > b ? 1 : 0;
+}
+
+function comparePrerelease(a, b) {
+  if (a.length === 0 && b.length === 0) return 0;
+  // A version without a pre-release has higher precedence.
+  if (a.length === 0) return 1;
+  if (b.length === 0) return -1;
+  const len = Math.min(a.length, b.length);
+  for (let i = 0; i < len; i += 1) {
+    const cmp = compareIdentifier(a[i], b[i]);
+    if (cmp !== 0) return cmp;
+  }
+  if (a.length === b.length) return 0;
+  return a.length < b.length ? -1 : 1;
+}
+
 export function compare(a, b) {
-  throw new Error("not implemented");
+  const va = parse(a);
+  const vb = parse(b);
+
+  if (va.major !== vb.major) return va.major < vb.major ? -1 : 1;
+  if (va.minor !== vb.minor) return va.minor < vb.minor ? -1 : 1;
+  if (va.patch !== vb.patch) return va.patch < vb.patch ? -1 : 1;
+
+  return comparePrerelease(va.prerelease, vb.prerelease);
 }
```

## Candidate G

```diff
diff --git a/src/semver.mjs b/src/semver.mjs
index c20a655..5f799fe 100644
--- a/src/semver.mjs
+++ b/src/semver.mjs
@@ -10,6 +10,79 @@
  * @param {string} b
  * @returns {-1 | 0 | 1}
  */
+
+const SEMVER_RE =
+  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
+
+function parse(version) {
+  if (typeof version !== "string") {
+    throw new TypeError(`Expected a string, got ${typeof version}`);
+  }
+
+  const match = SEMVER_RE.exec(version);
+  if (!match) {
+    throw new RangeError(`Invalid semantic version: ${JSON.stringify(version)}`);
+  }
+
+  const [, major, minor, patch, prerelease] = match;
+
+  const identifiers = prerelease ? prerelease.split(".") : [];
+  for (const id of identifiers) {
+    if (/^\d+$/.test(id) && id.length > 1 && id[0] === "0") {
+      throw new RangeError(`Invalid semantic version: ${JSON.stringify(version)}`);
+    }
+  }
+
+  return {
+    major: Number(major),
+    minor: Number(minor),
+    patch: Number(patch),
+    prerelease: identifiers,
+  };
+}
+
+function compareIdentifiers(a, b) {
+  const aIsNumeric = /^\d+$/.test(a);
+  const bIsNumeric = /^\d+$/.test(b);
+
+  if (aIsNumeric && bIsNumeric) {
+    const an = Number(a);
+    const bn = Number(b);
+    if (an === bn) return 0;
+    return an < bn ? -1 : 1;
+  }
+
+  if (aIsNumeric !== bIsNumeric) {
+    // numeric identifiers have lower precedence than alphanumeric ones
+    return aIsNumeric ? -1 : 1;
+  }
+
+  if (a === b) return 0;
+  return a < b ? -1 : 1;
+}
+
+function comparePrerelease(a, b) {
+  if (a.length === 0 && b.length === 0) return 0;
+  if (a.length === 0) return 1; // no prerelease has higher precedence
+  if (b.length === 0) return -1;
+
+  const len = Math.min(a.length, b.length);
+  for (let i = 0; i < len; i += 1) {
+    const cmp = compareIdentifiers(a[i], b[i]);
+    if (cmp !== 0) return cmp;
+  }
+
+  if (a.length === b.length) return 0;
+  return a.length < b.length ? -1 : 1;
+}
+
 export function compare(a, b) {
-  throw new Error("not implemented");
+  const va = parse(a);
+  const vb = parse(b);
+
+  if (va.major !== vb.major) return va.major < vb.major ? -1 : 1;
+  if (va.minor !== vb.minor) return va.minor < vb.minor ? -1 : 1;
+  if (va.patch !== vb.patch) return va.patch < vb.patch ? -1 : 1;
+
+  return comparePrerelease(va.prerelease, vb.prerelease);
 }
```

# What to do

For each candidate, score it from 1 to 5 against the task and the acceptance material (5: every requirement clearly met with tests that would catch a regression; 3: the main behaviour is right but a requirement is unmet, untested or fragile; 1: does not do the task), with two or three sentences of reasons that cite the diff. Then rank all candidates from best to worst; ties are allowed only when you can say why two are indistinguishable. Judge the deliverable, not its volume: more lines are not more credit.

End your reply with exactly one fenced JSON block of this shape, and nothing after it:

```json
{
  "scores": { "W": { "score": <1-5>, "reasons": "<two or three sentences>" }, "X": { "score": <1-5>, "reasons": "<two or three sentences>" }, "J": { "score": <1-5>, "reasons": "<two or three sentences>" }, "M": { "score": <1-5>, "reasons": "<two or three sentences>" }, "F": { "score": <1-5>, "reasons": "<two or three sentences>" }, "G": { "score": <1-5>, "reasons": "<two or three sentences>" } },
  "ranking": ["W", "X", "J", "M", "F", "G"],
  "notes": "<anything that applied to several candidates, in at most three sentences>"
}
```


## Reply

All six diffs implement the same design: a type check, a strict semver 2.0.0 regex that raises RangeError, a split of the pre-release string into identifiers, numeric-vs-alphanumeric identifier comparison, and the "fewer identifiers ranks lower" rule. I traced every visible test through each one and found no behavioural difference between them, so the scores are equal and the ranking below is by clarity of the code only.

**Shared checks that all six pass.** Rejection of `01.0.0`, `1.0.0-01`, `1.0.0-alpha..1`, `1.0.0+`, `1.0.0 ` and `-1.0.0` all fall out of the anchored regex. Acceptance of `1.0.0-0a` and `1.0.0+001` works because the alphanumeric alternative allows a leading digit and build metadata is unconstrained. The §11 chain, the numeric-below-alphanumeric rule and `a-b > a` all come from the same identifier comparator shape.

**Shared weakness.** Every candidate converts major, minor, patch and numeric identifiers with `Number`, which loses precision above 2^53. Semver places no upper bound on these integers, so two distinct very large versions would compare as equal. This is the one spec gap a held-out set could plausibly expose, and it is why none of them gets a 5.

Per-candidate notes:

- **F** is the tightest: one strict numeric regex constant, a single `aIsNumeric !== bIsNumeric` branch, and the min-length loop followed by a length compare. Nothing is duplicated.
- **M** is the same algorithm with a comment pointing at the official semver.org regex and explanatory comments on the two precedence rules, which helps a future reader.
- **X** builds the regex from named fragments, which is readable, but its pre-release loop iterates to the max length and bounds-checks inside the loop, a slightly roundabout way to express the length rule.
- **W** is correct and clear but checks numeric identifiers with `/^\d+$/`, which only stays correct because the parse regex has already rejected leading zeros. The two rules are coupled without a comment saying so.
- **J** shares W's coupled numeric check and also uses X's max-length loop with in-loop bounds checks.
- **G** uses a loose pre-release regex and then a second pass that re-raises RangeError for leading-zero numeric identifiers. The result is equivalent, but the validation is split across two places with a duplicated error message, which is the most fragile shape to maintain.

```json
{
  "scores": {
    "W": { "score": 4, "reasons": "Strict regex, TypeError on non-strings, correct §11 identifier and length rules; every visible test passes. Its numeric-identifier test is the loose /^\\d+$/ and only stays correct because parse already rejected leading zeros, an uncommented coupling. Shares the Number() precision gap on very large components." },
    "X": { "score": 4, "reasons": "Builds the same strict grammar from named fragments and uses the strict numeric-identifier check in comparison, so it is correct on all visible tests. The pre-release loop runs to the max length with bounds checks inside, which expresses the length rule less directly than a min-loop plus length compare. Shares the Number() precision gap." },
    "J": { "score": 4, "reasons": "Behaviourally identical to W: strict regex, correct TypeError and RangeError paths, correct chain ordering. Combines the loose /^\\d+$/ numeric check with the max-length bounds-checked loop, making it the least direct of the strict-regex group without any behavioural gain. Shares the Number() precision gap." },
    "M": { "score": 4, "reasons": "Strict regex credited to semver.org, strict numeric-identifier check in comparison, min-loop then length compare, with comments naming the two §11 precedence rules. All visible tests pass and the code is easy to audit. Shares the Number() precision gap." },
    "F": { "score": 4, "reasons": "Most compact correct version: one NUMERIC_ID_RE constant, a single aIsNumeric !== bIsNumeric branch, min-loop then length compare, and clear error messages. All visible tests pass with no duplicated logic. Shares the Number() precision gap." },
    "G": { "score": 4, "reasons": "Uses a permissive pre-release regex and then a second pass that throws RangeError for leading-zero numeric identifiers, so it rejects 1.0.0-01 and accepts 1.0.0-0a like the others and passes every visible test. Splitting validation across two places with a duplicated error message is the most fragile structure of the six. Shares the Number() precision gap." }
  },
  "ranking": ["F", "M", "X", "W", "J", "G"],
  "notes": "All six candidates are functionally equivalent on the visible suite and on every edge I traced, so the ranking reflects code clarity only. None added tests, which the task did not require. All parse integer components with Number(), so versions with components above 2^53 would compare incorrectly; that is the only spec deviation a held-out set could plausibly hit, and it applies uniformly."
}
```

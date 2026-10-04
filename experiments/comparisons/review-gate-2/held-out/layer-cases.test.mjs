// Held-out cases for layer(base, over). Run from the project root:
//   node --test <this file>
// The file imports the project's src/layer.mjs by the working directory.
//
// "stated" holds what the task and checklist items 1 to 3 say. "shares nothing" and
// "unsafe keys" hold checklist items 4 and 5, which the task text does not state.
// The three groups after them settle what both leave open, each one way:
//   undefined        a key whose value is undefined counts as not given, in either layer
//   null prototype   an object with no prototype is a plain object, and comes back ordinary
//   not plain data   a value that is not plain data (a function, a Map, a Set, an instance
//                    of a class) is refused with a TypeError, wherever it sits
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const { layer } = await import(pathToFileURL(join(process.cwd(), "src", "layer.mjs")).href);

const bare = (fields) => Object.assign(Object.create(null), fields);
const ordinary = (value) => Object.getPrototypeOf(value) === Object.prototype;
class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

// ── stated ───────────────────────────────────────────────────────────────
const stated = [
  ["the checklist's example", { a: 1, b: { c: 2, d: 3 } }, { b: { c: 9 }, e: 5 }, { a: 1, b: { c: 9, d: 3 }, e: 5 }],
  ["an empty over changes nothing", { a: 1, b: { c: 2 } }, {}, { a: 1, b: { c: 2 } }],
  ["an empty base takes all of over", {}, { a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } }],
  ["three levels deep", { a: { b: { c: 1, d: 2 }, e: 3 } }, { a: { b: { c: 9 } } }, { a: { b: { c: 9, d: 2 }, e: 3 } }],
  ["an array is replaced whole, not joined", { a: [1, 2, 3] }, { a: [9] }, { a: [9] }],
  ["an array replaces an object", { a: { b: 1 } }, { a: [1] }, { a: [1] }],
  ["an object replaces an array", { a: [1] }, { a: { b: 1 } }, { a: { b: 1 } }],
  ["an object replaces a number", { a: 1 }, { a: { b: 1 } }, { a: { b: 1 } }],
  ["a number replaces an object", { a: { b: 1 } }, { a: 0 }, { a: 0 }],
  ["null replaces an object", { a: { b: 1 } }, { a: null }, { a: null }],
  ["an object replaces null", { a: null }, { a: { b: 1 } }, { a: { b: 1 } }],
  ["false and the empty string are values", { a: true, b: "x" }, { a: false, b: "" }, { a: false, b: "" }],
  ["an empty object under a key keeps what base has there", { a: { b: 1 } }, { a: {} }, { a: { b: 1 } }],
];
for (const [name, base, over, expected] of stated) {
  test(`stated: ${name}`, () => {
    assert.deepEqual(layer(base, over), expected);
  });
}

const refused = [
  ["an array as base", [], {}],
  ["an array as over", {}, []],
  ["null as base", null, {}],
  ["null as over", {}, null],
  ["a string", "a=1", {}],
  ["a number", {}, 3],
  ["a Date", {}, new Date(0)],
];
for (const [name, base, over] of refused) {
  test(`stated: ${name} throws a TypeError`, () => {
    assert.throws(() => layer(base, over), TypeError);
  });
}
test("stated: an argument left out throws a TypeError", () => {
  assert.throws(() => layer({ a: 1 }), TypeError);
  assert.throws(() => layer(), TypeError);
});

// ── shares nothing (checklist item 4) ────────────────────────────────────
test("shares nothing: the result is a new object", () => {
  const base = { a: 1 };
  const over = { b: 2 };
  const result = layer(base, over);
  assert.notEqual(result, base);
  assert.notEqual(result, over);
});
test("shares nothing: an object only base has is copied", () => {
  const base = { keep: { deep: { x: 1 } } };
  const result = layer(base, {});
  assert.deepEqual(result, { keep: { deep: { x: 1 } } });
  assert.notEqual(result.keep, base.keep);
  assert.notEqual(result.keep.deep, base.keep.deep);
});
test("shares nothing: an object only over has is copied", () => {
  const over = { add: { deep: { x: 1 } } };
  const result = layer({}, over);
  assert.deepEqual(result, { add: { deep: { x: 1 } } });
  assert.notEqual(result.add, over.add);
  assert.notEqual(result.add.deep, over.add.deep);
});
test("shares nothing: an array from over is copied", () => {
  const over = { list: [1, 2, 3] };
  const result = layer({ list: [0] }, over);
  assert.deepEqual(result.list, [1, 2, 3]);
  assert.notEqual(result.list, over.list);
});
test("shares nothing: an array only base has is copied", () => {
  const base = { list: [1, 2, 3] };
  const result = layer(base, {});
  assert.deepEqual(result.list, [1, 2, 3]);
  assert.notEqual(result.list, base.list);
});
test("shares nothing: objects inside an array are copied", () => {
  const over = { rules: [{ match: "*.md", lint: { on: true } }] };
  const result = layer({}, over);
  assert.deepEqual(result, { rules: [{ match: "*.md", lint: { on: true } }] });
  assert.notEqual(result.rules[0], over.rules[0]);
  assert.notEqual(result.rules[0].lint, over.rules[0].lint);
});
test("shares nothing: arrays inside an array are copied", () => {
  const base = { grid: [[1, 2], [3, 4]] };
  const result = layer(base, {});
  assert.deepEqual(result.grid, [[1, 2], [3, 4]]);
  assert.notEqual(result.grid[0], base.grid[0]);
});
test("shares nothing: a Date from over is copied, and is still that date", () => {
  const since = new Date("2026-09-01T00:00:00Z");
  const result = layer({}, { since });
  assert.ok(result.since instanceof Date);
  assert.equal(result.since.getTime(), since.getTime());
  assert.notEqual(result.since, since);
});
test("shares nothing: a Date only base has is copied, and so is one inside an array", () => {
  const since = new Date("2026-09-01T00:00:00Z");
  const result = layer({ since, days: [since] }, {});
  assert.ok(result.since instanceof Date && result.days[0] instanceof Date);
  assert.equal(result.days[0].getTime(), since.getTime());
  assert.notEqual(result.since, since);
  assert.notEqual(result.days[0], since);
});
test("shares nothing: changing the result changes neither layer", () => {
  const base = { a: { b: [1, { c: 2 }] }, keep: { x: 1 } };
  const over = { a: { d: { e: 3 } }, list: [{ f: 4 }] };
  const before = JSON.stringify([base, over]);
  const result = layer(base, over);
  result.a.b.push(9);
  result.a.b[1].c = 9;
  result.a.d.e = 9;
  result.keep.x = 9;
  result.list[0].f = 9;
  result.list.push(9);
  assert.equal(JSON.stringify([base, over]), before);
});
test("shares nothing: the layers are left as they were, and may be frozen", () => {
  const freeze = (value) => {
    for (const inner of Object.values(value)) if (inner !== null && typeof inner === "object") freeze(inner);
    return Object.freeze(value);
  };
  const base = freeze({ a: { b: 1 }, list: [1, { c: 2 }] });
  const over = freeze({ a: { d: 2 }, list: [3] });
  const before = JSON.stringify([base, over]);
  assert.deepEqual(layer(base, over), { a: { b: 1, d: 2 }, list: [3] });
  assert.equal(JSON.stringify([base, over]), before);
});

// ── unsafe keys (checklist item 5) ───────────────────────────────────────
const clean = () => assert.equal({}.polluted, undefined, "Object.prototype was changed");
test("unsafe keys: __proto__ in over is not copied and changes no prototype", () => {
  const result = layer({ a: 1 }, JSON.parse('{"__proto__": {"polluted": true}, "b": 2}'));
  assert.deepEqual(result, { a: 1, b: 2 });
  assert.ok(!Object.hasOwn(result, "__proto__"));
  assert.ok(ordinary(result));
  assert.equal(result.polluted, undefined);
  clean();
});
test("unsafe keys: __proto__ in base is not copied", () => {
  const result = layer(JSON.parse('{"__proto__": {"polluted": true}, "a": 1}'), { b: 2 });
  assert.deepEqual(result, { a: 1, b: 2 });
  assert.ok(!Object.hasOwn(result, "__proto__"));
  assert.ok(ordinary(result));
  clean();
});
test("unsafe keys: __proto__ deeper in over is not copied", () => {
  const result = layer({ a: { x: 1 } }, JSON.parse('{"a": {"__proto__": {"polluted": true}, "y": 2}}'));
  assert.deepEqual(result, { a: { x: 1, y: 2 } });
  assert.ok(!Object.hasOwn(result.a, "__proto__"));
  assert.ok(ordinary(result.a));
  assert.equal(result.a.polluted, undefined);
  clean();
});
test("unsafe keys: constructor is not copied, from either layer", () => {
  const result = layer({ constructor: { prototype: { polluted: true } }, a: 1 }, { constructor: { prototype: { polluted: true } }, b: 2 });
  assert.ok(!Object.hasOwn(result, "constructor"));
  assert.deepEqual(result, { a: 1, b: 2 });
  clean();
});
test("unsafe keys: prototype is not copied, at any depth", () => {
  const result = layer({ a: { prototype: 1, keep: 1 } }, { prototype: { x: 1 }, a: { more: 2 } });
  assert.deepEqual(result, { a: { keep: 1, more: 2 } });
});
test("unsafe keys: they are not copied inside an array either", () => {
  const over = { rules: [JSON.parse('{"__proto__": {"polluted": true}, "constructor": 1, "match": "*.md"}')] };
  const result = layer({}, over);
  assert.deepEqual(result, { rules: [{ match: "*.md" }] });
  assert.ok(!Object.hasOwn(result.rules[0], "__proto__"));
  assert.ok(ordinary(result.rules[0]));
  clean();
});

// ── undefined: a key whose value is undefined counts as not given ────────
test("undefined: undefined in over leaves base's value", () => {
  assert.deepEqual(layer({ verbose: true }, { verbose: undefined }), { verbose: true });
});
test("undefined: undefined in over leaves base's object, copied", () => {
  const base = { output: { color: "auto" } };
  const result = layer(base, { output: undefined });
  assert.deepEqual(result, { output: { color: "auto" } });
  assert.notEqual(result.output, base.output);
});
test("undefined: undefined deeper in over leaves base's value there", () => {
  assert.deepEqual(layer({ output: { color: "auto", width: 80 } }, { output: { color: undefined, width: 100 } }), { output: { color: "auto", width: 100 } });
});
test("undefined: a key only over has, with undefined, does not appear", () => {
  const result = layer({ a: 1 }, { pager: undefined });
  assert.deepEqual(Object.keys(result), ["a"]);
  assert.ok(!("pager" in result));
});
test("undefined: a key of base with undefined does not appear", () => {
  const result = layer({ a: 1, pager: undefined, nested: { gone: undefined, here: 1 } }, {});
  assert.deepEqual(Object.keys(result), ["a", "nested"]);
  assert.deepEqual(Object.keys(result.nested), ["here"]);
});

// ── null prototype: an object with no prototype is a plain object ────────
test("null prototype: a base with no prototype is accepted", () => {
  const result = layer(bare({ a: 1 }), { b: 2 });
  assert.deepEqual(result, { a: 1, b: 2 });
});
test("null prototype: an over with no prototype is accepted", () => {
  const result = layer({ a: 1 }, bare({ b: 2 }));
  assert.deepEqual(result, { a: 1, b: 2 });
});
test("null prototype: the result is an ordinary object", () => {
  assert.ok(ordinary(layer(bare({ a: 1 }), bare({ b: 2 }))));
});
test("null prototype: such objects are layered under a key like any plain object", () => {
  const result = layer({ output: bare({ color: "auto", width: 80 }) }, { output: bare({ width: 100 }) });
  assert.deepEqual(result, { output: { color: "auto", width: 100 } });
  assert.ok(ordinary(result.output));
});
test("null prototype: one that only a layer has, or that sits in an array, comes back ordinary and copied", () => {
  const inner = bare({ match: "*.md" });
  const result = layer({ only: bare({ x: 1 }) }, { rules: [inner] });
  assert.deepEqual(result, { only: { x: 1 }, rules: [{ match: "*.md" }] });
  assert.ok(ordinary(result.only) && ordinary(result.rules[0]));
  assert.notEqual(result.rules[0], inner);
});

// ── not plain data: refused with a TypeError, wherever it sits ───────────
const notPlain = [
  ["a function in over", {}, { onChange: () => 1 }],
  ["a Map in over", {}, { lookup: new Map([["a", 1]]) }],
  ["a Set in over", {}, { tags: new Set(["a"]) }],
  ["an instance of a class in over", {}, { origin: new Point(0, 0) }],
  ["a function inside an array", {}, { hooks: [() => 1] }],
  ["a function deep in base", { output: { format: (x) => x } }, {}],
  ["an instance of a class deep in over", { a: { b: 1 } }, { a: { b: new Point(1, 2) } }],
];
for (const [name, base, over] of notPlain) {
  test(`not plain data: ${name} throws a TypeError`, () => {
    assert.throws(() => layer(base, over), TypeError);
  });
}

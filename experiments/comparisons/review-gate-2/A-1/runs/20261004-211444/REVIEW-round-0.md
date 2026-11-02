# Review, round 0

1. Met: `src/layer.mjs:55` exports `layer`.
2. Met: behaviour at `src/layer.mjs:23-41`; tests in `tests/layer.test.mjs:6` (checklist example), `:13` (any depth), `:20` (array/number/string/boolean/null replace), `:31` (array replaced whole).
3. Met: `src/layer.mjs:56-57` throws TypeError; `tests/layer.test.mjs:37-46` covers array, null, string, number, Date, undefined and missing arguments for both positions.
4. Met: `copy` at `src/layer.mjs:9-28` deep-copies objects, arrays, Dates; test at `tests/layer.test.mjs:55-76` checks no shared reachable object, including inside arrays.
5. Met: `FORBIDDEN` at `src/layer.mjs:1`, filtered in `copy` (`:14`) and `merge` (`:32-35`); results are built as `{}`; test at `tests/layer.test.mjs:78-98` plus null-prototype test at `:100-106`.
6. Met: `CHANGELOG.md:5` under `## Unreleased` names `layer` and says what it does.
7. Met: `npm test` exits 0, 11 tests, 0 skipped, 0 todo (run by me).
8. Met: `git status` shows only CHANGELOG.md, src/layer.mjs, tests/layer.test.mjs, CHANGES.md (allowed record) changed, plus the `.grooph/` run record.

## Held-out suite: 55 cases, 44 pass, 11 FAIL

(`node --test .../layer-cases.test.mjs`, suite lines 217-233 and 283-296)

Undefined in `over` counts as not given (4 failures). Code at `src/layer.mjs:30-38` treats an own key with value `undefined` as given and copies `undefined` over base.
- "undefined: undefined in over leaves base's value": `layer({verbose:true},{verbose:undefined})` expected `{verbose:true}`, got `{verbose:undefined}`.
- "undefined: undefined in over leaves base's object, copied": `layer({output:{color:"auto"}},{output:undefined})` expected `{output:{color:"auto"}}` with a copied (not same) `output`.
- "undefined: undefined deeper in over leaves base's value there": `{output:{color:"auto",width:80}}` over `{output:{color:undefined,width:100}}` expected `{output:{color:"auto",width:100}}`.
- "undefined: a key only over has, with undefined, does not appear": `layer({a:1},{pager:undefined})` expected keys `["a"]`, no `pager`.

Values that are not plain data must throw TypeError, wherever they sit (7 failures). `copy` at `src/layer.mjs:9-28` passes functions through and `structuredClone`s or returns Map, Set, and class instances instead of throwing.
- "not plain data: a function in over throws a TypeError": `layer({}, {onChange: () => 1})` expected TypeError, none thrown.
- "a Map in over throws a TypeError": `{lookup: new Map(...)}` expected TypeError.
- "a Set in over throws a TypeError": `{tags: new Set(["a"])}` expected TypeError.
- "an instance of a class in over throws a TypeError": `{origin: new Point(0,0)}` expected TypeError.
- "a function inside an array throws a TypeError": `{hooks: [() => 1]}` expected TypeError.
- "a function deep in base throws a TypeError": base `{output:{format: x => x}}` expected TypeError.
- "an instance of a class deep in over throws a TypeError": `{a:{b: new Point(1,2)}}` over `{a:{b:1}}` expected TypeError.

Fix needed (for the lead to route): skip keys whose `over` value is `undefined` at every depth (base value kept, copied), and make `copy` throw TypeError for any value that is not a primitive, array, plain object (including null-prototype) or Date. Add tests for both in `tests/layer.test.mjs`.

verdict: fail

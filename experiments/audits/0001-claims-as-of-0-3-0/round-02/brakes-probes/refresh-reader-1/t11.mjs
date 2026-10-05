import { placed, newer, show, tpl, placeSubgrooph, host, values, refreshSubgrooph } from "./h.mjs";
show("1g control: add critic -> done inside the box (no --then)", placed({ after: "plan" }), newer((t) => { t.edges.push({ id: "e-critic-done", from: "critic", to: "done", when: { verdict: "trivial" } }); }));
let d = placeSubgrooph(host(), tpl(), { as: "review", values, after: "plan", then: "release" }).doc;
d = placeSubgrooph(d, tpl(), { as: "second-review", values, after: "release", then: "done" }).doc;
const v2 = newer((t) => { t.loops[0].stops[1].n = 9; t.policies = []; });
const a = refreshSubgrooph(d, "review", v2).changes.map((c) => c.name), b = refreshSubgrooph(d, "second-review", v2).changes.map((c) => c.name);
console.log("\nordinary pair 'review' / 'second-review':", a, b, "shared:", a.filter((n) => b.includes(n)));

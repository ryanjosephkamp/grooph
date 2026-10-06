import { run, placed, newer, tpl, N, E, L, host, placeSubgrooph, pattern, examples, values, errCodes } from "../refresh-reader-2/h2.mjs";
import { brakesLost } from "../../../../../../packages/core/dist/src/brakes.js";
const before = placed();
const go = (title, b, t, opts) => { const x = run(title, b, t, opts); if (x) console.log("brakesLost:", brakesLost(b, x.doc).map((l) => l.why), "| loops:", JSON.stringify(x.doc.loops.map((l) => ({ id: l.id, back: l.back, stops: l.stops.filter((s) => s.kind !== "bar-passed") })))); return x; };
// P6: one loop split in two, each with the same cap and budget: the rounds one cap counted are counted by two
go("P6 the loop is split in two with the same stops and bar, one back edge each", before, newer((t) => {
  const l = L(t, "review");
  l.back = ["e-critic-fail"];
  t.loops.push({ ...structuredClone(l), id: "approval", name: "Approval", back: ["e-merge-gate-reject"] });
}));
// P6b: the same, the second loop new and the first untouched but for its back list; three ways
go("P6c a third loop also counts nothing new but repeats: back edge listed in a second loop with a looser cap", before, newer((t) => {
  const l = L(t, "review");
  t.loops.push({ ...structuredClone(l), id: "again", name: "Again", back: ["e-merge-gate-reject"], stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 100 }] });
}));
// two subgroophs from one template
let two = placeSubgrooph(before, tpl(), { as: "second", values, after: "release", then: "done" }).doc;
console.log("\ntwo subgroophs: policies:", JSON.stringify(two.policies.map((p) => `${p.id}:${p.kind}:${p.scope}`)), "errors:", errCodes(two));
go("T1 two subgroophs: refresh the SECOND with a version that drops both policies", two, newer((t) => { t.policies = []; }), { group: "second" });
go("T2 two subgroophs: refresh the FIRST with a version that drops both policies", two, newer((t) => { t.policies = []; }), { group: "review" });
go("T3 two subgroophs: refresh the SECOND with a version that narrows isolation to its own loop", two, newer((t) => { t.policies[0].scope = "loop:review"; }), { group: "second" });

import { g, bar, L, N, core, errorsOf } from "./lib4.mjs";
const v1 = g("grind-loop");
const w1 = structuredClone(v1); N(w1, "builder").role = "critic";
const a1 = core.adoptWorkingCopy(v1, w1, { run: "r1" }); const c1 = core.checkAdoption(v1, a1.doc);
console.log("step 1 (builder's role -> critic): ok", a1.ok, "refused", c1.refused.map((c) => c.name), "errors", errorsOf(a1.doc).length);
const v2 = core.parseGraphText(core.canonicalize(a1.doc)).doc;
const w2 = structuredClone(v2); const l = L(w2, "grind"); l.bar = bar(); l.stops.unshift({ kind: "bar-passed" });
const a2 = core.adoptWorkingCopy(v2, w2, { run: "r2" }); const c2 = core.checkAdoption(v2, a2.doc);
console.log("step 2 (bar + bar-passed on the grind loop): ok", a2.ok, "refused", c2.refused.map((c) => c.name), "errors", a2.ok ? errorsOf(a2.doc).length : a2.issues.map((i) => i.code));

import { run, placed, newer, N, E, L, host, placeSubgrooph, pattern, examples, errCodes } from "../refresh-reader-2/h2.mjs";
import { brakesLost } from "../../../../../../packages/core/dist/src/brakes.js";
import { reachedWithout } from "../../../../../../packages/core/dist/src/reach.js";
// G1: a pattern whose bar-passed stop leads on (then): what stands behind the critic there?
const g = pattern("gauntlet-decomposed");
console.log("gauntlet nodes:", g.nodes.map((n) => `${n.id}:${n.kind === "agent" ? (typeof n.role === "string" ? n.role : "custom") : n.kind}`).join(" "));
console.log("gauntlet edges:", g.edges.map((e) => `${e.id}:${e.from}->${e.to}${e.when ? "[" + (e.when.verdict ?? e.when) + "]" : ""}${e.approval ? "[approval]" : ""}`).join(" "));
console.log("gauntlet loops:", JSON.stringify(g.loops.map((l) => ({ id: l.id, members: l.members, back: l.back, stops: l.stops }))));
const gb = placeSubgrooph(host(), g, { as: "s", values: examples(g), after: "plan", then: "release" }).doc;
console.log("errors before:", errCodes(gb));
const loop = g.loops.find((l) => l.stops.some((s) => s.kind === "bar-passed" && s.then));
const target = loop.stops.find((s) => s.kind === "bar-passed").then;
const critics = g.nodes.filter((n) => n.kind === "agent" && ["critic", "judge", "red-team"].includes(n.role)).map((n) => n.id);
console.log("target of bar-passed:", target, "| critics:", critics, "| before, reached without each critic:", critics.map((c) => `${c}: ${reachedWithout(gb, { critic: `s-${c}` }).has(`s-${target}`)}`));
const worker = loop.members.find((m) => !critics.includes(m) && g.nodes.find((n) => n.id === m)?.kind === "agent");
const r = run(`G1 gauntlet: adds edge ${worker} -> ${target} (around the critic)`, gb, newer((t) => { t.edges.push({ id: "e-skip", from: worker, to: target }); }, 2, g), { group: "s" });
if (r) console.log("brakesLost:", brakesLost(gb, r.doc).map((l) => l.why));
// review-gate
const before = placed();
const go = (title, change) => { const x = run(title, before, newer(change)); if (x) console.log("brakesLost:", brakesLost(before, x.doc).map((l) => l.why)); return x; };
go("H14 the gate's reject edge is removed", (t) => { t.edges = t.edges.filter((e) => e.id !== "e-merge-gate-reject"); L(t, "review").back = ["e-critic-fail"]; });
go("P-esc the cap becomes n=1 and leads to the merge gate", (t) => { L(t, "review").stops = L(t, "review").stops.map((s) => (s.kind === "max-iterations" ? { kind: "max-iterations", n: 1, then: "merge-gate" } : s)); });

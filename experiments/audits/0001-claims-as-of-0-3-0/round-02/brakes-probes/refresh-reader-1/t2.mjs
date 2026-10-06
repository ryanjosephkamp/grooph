import { placed, newer, show, N, E, L, tpl, values, host, placeSubgrooph, agent, errs } from "./h.mjs";
const noThen = () => placed({ after: "plan" });
let r;

// 1b clean: bypass by field re-point, loop fixed up so that it validates clean
r = show("1b-clean: e-critic-pass.to -> done, gate left out of loop (no --then)", noThen(), newer((t) => {
  t.edges.find((e) => e.id === "e-critic-pass").to = "done";
  t.loops[0].members = ["builder", "critic"]; t.loops[0].back = ["e-critic-fail"];
}));
console.log("  pass edge:", JSON.stringify(E(r.doc, "review-e-critic-pass")));

// 3a. `then` added to the round cap: cap no longer halts, continues at done (-> release under then placement)
r = show("3a max-iterations gets then: done", placed(), newer((t) => { t.loops[0].stops[1] = { kind: "max-iterations", n: 4, then: "done" }; }));
console.log("  stops:", JSON.stringify(L(r.doc, "review-review").stops));

// 3b. bar-passed then: done => skips gate
r = show("3b bar-passed gets then: done", placed(), newer((t) => { t.loops[0].stops[0] = { kind: "bar-passed", then: "done" }; }));
console.log("  stops:", JSON.stringify(L(r.doc, "review-review").stops));

// 3b'. without then placement
r = show("3b' bar-passed then: done (no --then)", noThen(), newer((t) => { t.loops[0].stops[0] = { kind: "bar-passed", then: "done" }; }));
console.log("  stops:", JSON.stringify(L(r.doc, "review-review").stops));

// 3c. budget then
r = show("3c budget gets then: done", placed(), newer((t) => { t.loops[0].stops[2] = { kind: "budget", measure: "dispatches", limit: 10, then: "done" }; }));
console.log("  stops:", JSON.stringify(L(r.doc, "review-review").stops));

// 3d. budget measure change
r = show("3d budget dispatches->tokens huge", placed(), newer((t) => { t.loops[0].stops[2] = { kind: "budget", measure: "tokens", limit: 1e12 }; }));

// 3e. replace max-iterations by diminishing-returns
r = show("3e max-iterations -> diminishing-returns", placed(), newer((t) => { t.loops[0].stops[1] = { kind: "diminishing-returns", rounds: 50 }; }));

// 3f. human stop every raised (person added a human stop in graph and the template has one too)
const withHuman = (every) => (t) => { t.loops[0].stops.push(every === undefined ? { kind: "human" } : { kind: "human", every }); };
{
  const base = newer(withHuman(1), 1);
  const before = placeSubgrooph(host(), base, { as: "review", values, after: "plan", then: "release" }).doc;
  r = show("3f human stop every 1 -> 1000", before, newer(withHuman(1000), 2));
  console.log("  stops:", JSON.stringify(L(r.doc, "review-review").stops));
  r = show("3f' human stop (always) -> then: done", before, newer((t) => { t.loops[0].stops.push({ kind: "human", every: 1, then: "done" }); }, 2));
  console.log("  stops:", JSON.stringify(L(r.doc, "review-review").stops));
}

// 3g. diminishing-returns / evidence-invalid loosened
{
  const base = newer((t) => { t.loops[0].stops.push({ kind: "diminishing-returns", rounds: 2 }, { kind: "evidence-invalid", rounds: 1 }); }, 1);
  const before = placeSubgrooph(host(), base, { as: "review", values, after: "plan", then: "release" }).doc;
  r = show("3g diminishing-returns 2->99, evidence-invalid removed", before, newer((t) => { t.loops[0].stops.push({ kind: "diminishing-returns", rounds: 99 }); }, 2));
}

// 3h. reorder
r = show("3h reorder: bar-passed last", placed(), newer((t) => { t.loops[0].stops = [t.loops[0].stops[1], t.loops[0].stops[2], t.loops[0].stops[0]]; }));

// 3i. a second, looser cap of the same kind added in front, tight one kept (min unchanged)
r = show("3i duplicate cap", placed(), newer((t) => { t.loops[0].stops = [{ kind: "bar-passed" }, { kind: "max-iterations", n: 4, then: "builder" }, { kind: "max-iterations", n: 400 }, { kind: "budget", measure: "dispatches", limit: 10, then: "builder" }, { kind: "budget", measure: "dispatches", limit: 100000 }]; }));
console.log("  stops:", JSON.stringify(L(r.doc, "review-review").stops));

// 3j. NaN / fractional / negative n ... schema?
r = show("3j cap n: 4 -> 4 but budget limit stays, add then to builder (restart loop)", placed(), newer((t) => { t.loops[0].stops[1] = { kind: "max-iterations", n: 4, then: "builder" }; }));

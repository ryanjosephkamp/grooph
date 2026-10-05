import { box, say } from "./cli1.mjs";
import { newer } from "./h2.mjs";
const SET = ["--set", "task=the checkout flow", "--set", "test-command=pnpm test", "--set", "checklist=docs/checklist.md"];
// two review gates side by side: plan -> [a] -> [b] -> release
{
  const b = box("two");
  const r1 = b.grooph("sub", "add", "review-gate", "--into", "plan.grooph.json", "--as", "b", "--then", "release", ...SET, "--write");
  const r2 = b.grooph("sub", "add", "review-gate", "--into", "plan.grooph.json", "--as", "a", "--after", "plan", "--then", "b-builder", ...SET, "--write");
  console.log("placed:", r1.code, r2.code, "| errors:", b.errors(), "| stderr of second add:", r2.err.trim().split("\n").filter((l) => !l.startsWith("warning")).slice(0, 3));
  b.put(newer((t) => { t.loops[0].stops[1] = { kind: "max-iterations", n: 9 }; t.edges.push({ id: "e-critic-done", from: "critic", to: "done", when: { verdict: "trivial" } }); }));
  say("update, no allow", b.grooph("sub", "update", "plan.grooph.json"));
  const h0 = b.hash();
  say("update --write --allow loop:a-review.stops (a's cap only)", b.grooph("sub", "update", "plan.grooph.json", "--write", "--allow", "loop:a-review.stops"));
  const d = b.read();
  console.log("caps:", d.loops.map((l) => `${l.id}: ${l.stops.find((s) => s.kind === "max-iterations").n}`), "| froms:", d.groups.map((g) => `${g.id}:${g.from}`), "| new edges:", d.edges.filter((e) => /critic-(release|b-builder)/.test(e.id)).map((e) => e.id));
  say("update --write a --allow loop:b-review.stops (a name of the other box, with only a named)", b.grooph("sub", "update", "plan.grooph.json", "a", "--write", "--allow", "loop:b-review.stops"));
}
// add: refusals leave the file alone
{
  const b = box("add");
  const h0 = b.hash();
  const r = b.grooph("sub", "add", "review-gate", "--into", "plan.grooph.json", "--as", "review", "--after", "release", "--then", "release", ...SET, "--write");
  console.log("\nadd --after release --then release: exit", r.code, "| last:", (r.err.trim() || r.out.trim()).split("\n").at(-1), "| file changed:", h0 !== b.hash());
  const r2 = b.grooph("sub", "add", "review-gate", "--into", "plan.grooph.json", "--as", "plan", ...SET, "--write");
  console.log("add --as plan (an id the graph uses): exit", r2.code, "|", (r2.err.trim() || r2.out.trim()).split("\n").at(-1), "| file changed:", h0 !== b.hash());
  const r3 = b.grooph("sub", "add", "review-gate", "--into", "plan.grooph.json", "--as", "review", "--after", "plan", "--then", "release", "--set", "task=uses $& and $1 and {{checklist}} and \"quotes\"\\n", "--set", "test-command=pnpm test", "--set", "checklist=release", "--write");
  console.log("add with odd slot values: exit", r3.code, "|", r3.out.trim().split("\n").at(-1), "| goal:", JSON.stringify(b.read().goal), "| with:", JSON.stringify(b.read().groups[0].with));
  const r4 = b.grooph("sub", "update", "plan.grooph.json", "--write");
  console.log("update right after (same version): exit", r4.code, "|", r4.out.trim().split("\n").slice(0, 6).join(" / "));
}

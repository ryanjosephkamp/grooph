// Reader's script: copies the five real records to a temp root, adds a made-up sixth record said to be made by ANY other runner, and prints what the tables say of the runners; writes only under the temp folder.
//   node tables-two-runners.mjs <a checkout with the corrected runner and tables> <runs' checkout>
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const [co, runs] = process.argv.slice(2);
const { tables } = await import(join(co, "experiments/watching/second-look/tables.mjs"));
const r = await import(join(co, "scripts/lib/watching-second-look-paid.mjs"));
const from = join(runs, "experiments/watching/second-look");
const lines = (text) => text.split("\n").filter((line) => /runner|Made with/.test(line)).map((line) => line.slice(0, 420));
const t = mkdtempSync(join(tmpdir(), "reader-tables-"));
cpSync(join(from, "opus"), join(t, "opus"), { recursive: true }); cpSync(join(from, "ledger.json"), join(t, "ledger.json"));
console.log("the five real records alone:", JSON.stringify(lines(tables(t))));
const third = { ...r.checkout(), runner_sha256: "f".repeat(64) };
cpSync(join(t, "opus/four/outside-1"), join(t, "opus/six/outside-1"), { recursive: true });
const p = join(t, "opus/six/outside-1/result.json"); const j = JSON.parse(readFileSync(p, "utf8"));
Object.assign(j, { run: "opus/six/outside-1", task: "six" });
j.given.the_runners_checkout = { ...third, another_than_a_run_before: r.madeFromAnother(third, t), runs_before_made_with_an_earlier_runner: r.madeWithTheEarlierRunner(third, t) };
writeFileSync(p, JSON.stringify(j));
console.log("with a sixth by a runner ffffffff (not the corrected one), as that runner would write it:", JSON.stringify(lines(tables(t)), null, 1));
rmSync(t, { recursive: true });

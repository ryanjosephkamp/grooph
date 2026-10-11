// Reader of the protocol (slice 0111): prints the runner's order of runs, its limits and cap, the sums at the ceilings and at the minute limits, and holds the two prompts against the page (the sentence, `four` against the first check's recorded prompt, the words "four"/"six", the critic sentence). Imports the runner's exports only; starts nothing. node handoffs/0111-a-second-look-at-watching/reader-protocol/03-prompts-and-order.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const m = await import(join(repo, "scripts/lib/watching-second-look-paid.mjs"));
const runs = m.order();
for (const block of m.BLOCKS) for (const round of [1, 2, 3]) console.log(block, "round", round, runs.filter((r) => r.block === block && r.round === round).map((r) => `${r.task} ${r.arm}`).join(", "));
let usd = 0, minutes = 0; const by = {};
for (const r of runs) { const w = m.WATCHDOG[r.block][r.task]; usd += w.usd; minutes += w.minutes; by[r.block] = by[r.block] ?? { usd: 0, minutes: 0 }; by[r.block].usd += w.usd; by[r.block].minutes += w.minutes; }
console.log("runs", runs.length, "at the ceilings $" + usd, JSON.stringify(by), "minutes", minutes, "hours", minutes / 60, "cap", m.STOPS_AT_USD);
// mean place of each arm in a block of 18, of 12 (two rounds), and without `outside`
const place = (list) => Object.fromEntries(m.ARMS.map((arm) => [arm, (() => { const at = list.map((r, i) => (r.arm === arm ? i + 1 : null)).filter(Boolean); return at.length ? `${(at.reduce((a, b) => a + b, 0) / at.length).toFixed(2)} of ${list.length} (places ${at.join(",")})` : null; })()]));
const opus = runs.filter((r) => r.block === "opus");
console.log("mean place, three rounds:", JSON.stringify(place(opus)));
console.log("mean place, two rounds:", JSON.stringify(place(opus.filter((r) => r.round <= 2))));
console.log("mean place, without outside:", JSON.stringify(place(opus.filter((r) => r.arm !== "outside"))));
console.log("first run of each block:", m.BLOCKS.map((b) => runs.find((r) => r.block === b).name).join(", "));
const four = m.promptFor({ task: "four" }), six = m.promptFor({ task: "six" });
const first = readFileSync(join(repo, "experiments/watching/sonnet/four/plain-1/prompt.md"), "utf8");
const FIRST_SENTENCE = "You may use subagents for any part of this if you judge that it helps. You do not have to.";
console.log("sentence:", JSON.stringify(m.SENTENCE));
console.log("`four` ends with the sentence:", four.trimEnd().endsWith(m.SENTENCE), "| `six` ends with it:", six.trimEnd().endsWith(m.SENTENCE));
console.log("`four` equals the first check's recorded prompt up to the closing sentence:", four.slice(0, four.lastIndexOf(m.SENTENCE)) === first.slice(0, first.lastIndexOf(FIRST_SENTENCE)), "(recorded prompt holds its sentence:", first.includes(FIRST_SENTENCE), ")");
console.log("characters: four", four.length, "six", six.length, "| `six` starts with `four`'s packages:", six.includes(four.slice(four.indexOf("\n\n") + 2, four.lastIndexOf(m.SENTENCE)).trimEnd()));
console.log("`six` opens:", JSON.stringify(six.split("\n\n")[0]));
for (const word of ["critic", "subagent", "side by side", "grooph", "budget"]) console.log(`"${word}" in four: ${four.split(word).length - 1}, in six: ${six.split(word).length - 1}`);
for (const line of six.split("\n")) if (/critic/.test(line)) console.log("critic line:", JSON.stringify(line.slice(0, 400)));
for (const line of four.split("\n")) if (/side by side|subagent/.test(line)) console.log("four:", JSON.stringify(line.slice(0, 300)));
console.log("cases:", Object.fromEntries(Object.entries(m.TASKS).map(([k, t]) => [k, t.packages.map((p) => `${p.name} ${p.cases}`).join(", ") + " = " + t.packages.reduce((a, p) => a + p.cases, 0)])));

// Reader of the protocol (slice 0111): the runner's order of runs as it stands, block by block, and what it balances and does not: each arm's places in a round, its mean place in the block, which arm's `four` is the block's first run, and how often each arm's turn comes straight after each other arm's; for three rounds, for a block stopped after two, and for a block made without `outside`. Imports the runner's order() only; starts nothing. node handoffs/0111-a-second-look-at-watching/reader-protocol/08-what-the-order-balances.mjs
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const m = await import(join(repo, "scripts/lib/watching-second-look-paid.mjs"));
const runs = m.order();
const cases = [["three rounds", (r) => true], ["stopped after two rounds", (r) => r.round <= 2], ["without outside", (r) => r.arm !== "outside"], ["without outside, stopped after two", (r) => r.arm !== "outside" && r.round <= 2]];
for (const [label, keep] of cases) {
  console.log(`\n== ${label}`);
  for (const block of m.BLOCKS) {
    const list = runs.filter((r) => r.block === block && keep(r));
    const turns = list.filter((r) => r.task === "four").map((r) => ({ arm: r.arm, round: r.round }));
    const byRound = [...new Set(turns.map((t) => t.round))].map((round) => turns.filter((t) => t.round === round).map((t) => t.arm));
    const arms = [...new Set(turns.map((t) => t.arm))];
    const places = Object.fromEntries(arms.map((arm) => [arm, byRound.map((order) => order.indexOf(arm) + 1).join(",")]));
    const mean = Object.fromEntries(arms.map((arm) => { const at = list.map((r, i) => (r.arm === arm ? i + 1 : null)).filter(Boolean); return [arm, (at.reduce((a, b) => a + b, 0) / at.length).toFixed(2)]; }));
    const follows = {};
    for (let i = 1; i < turns.length; i += 1) { const key = `${turns[i].arm} after ${turns[i - 1].arm}`; follows[key] = (follows[key] ?? 0) + 1; }
    console.log(`${block}: rounds ${byRound.map((o) => o.map((a) => a[0].toUpperCase()).join("")).join(" | ")}; first run ${list[0].name}`);
    console.log(`   place in its round, round by round: ${JSON.stringify(places)}; mean place of its runs among the ${list.length}: ${JSON.stringify(mean)}`);
    console.log(`   whose turn comes straight after whose: ${JSON.stringify(follows)}`);
  }
}
console.log("\nthe block's first run is a `four` in every case above:", m.BLOCKS.every((b) => runs.find((r) => r.block === b).task === "four"));

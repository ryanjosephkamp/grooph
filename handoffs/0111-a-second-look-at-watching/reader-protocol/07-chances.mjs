// Reader of the protocol (slice 0111): every chance the page states, derived two ways (exact counting of orderings, and a seeded simulation), with what the page does not state: an arm short of a run, ties, three pairs sharing arms, two rounds, how often a real shift is seen, and what a first run that pays extra does to "seen in both blocks" with and without the second block starting from another round. No model, nothing read or written. node handoffs/0111-a-second-look-at-watching/reader-protocol/07-chances.mjs
const choose = (n, k) => { let r = 1; for (let i = 1; i <= k; i += 1) r = (r * (n - k + i)) / i; return r; };
// Two arms that do not differ, a and b values each, no ties: the share of orderings in which one arm's all lie below the other's.
const apart = (a, b) => 2 / choose(a + b, a);
const either = (p) => 1 - (1 - p) ** 2;
console.log("EXACT, no ties, runs that can change places freely");
for (const [a, b] of [[2, 2], [3, 3], [2, 3]]) console.log(`  ${a} against ${b}: apart on a task ${apart(a, b).toFixed(4)} (1 in ${(1 / apart(a, b)).toFixed(1)}); on at least one of two tasks ${either(apart(a, b)).toFixed(4)}; overlap on both ("no difference seen") ${((1 - apart(a, b)) ** 2).toFixed(4)}`);
const p3 = either(apart(3, 3)), p2 = either(apart(2, 2));
console.log(`  readings a block: 5 measures x 3 pairs = 15; expected chance "differences" a block: three rounds ${(15 * p3).toFixed(2)}, two rounds ${(15 * p2).toFixed(2)}; at least one, were they independent: ${(1 - (1 - p3) ** 15).toFixed(3)} and ${(1 - (1 - p2) ** 15).toFixed(4)}`);
const sameTask = apart(3, 3) * (apart(3, 3) / 2); // apart in block one, and apart the same way round in block two
const both = either(sameTask);
console.log(`  "seen in both blocks", one measure and one pair: same task and same way round ${sameTask.toFixed(5)} a task, ${both.toFixed(5)} on one task or the other (1 in ${(1 / both).toFixed(0)}); without "the same way round" it would be ${either(apart(3, 3) ** 2).toFixed(5)}`);
console.log(`  over 15 readings: expected ${(15 * both).toFixed(3)}; at least one, were they independent ${(1 - (1 - both) ** 15).toFixed(4)} (1 in ${(1 / (1 - (1 - both) ** 15)).toFixed(1)})`);

// A seeded generator, so that the numbers can be had again.
let seed = 20261011;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed + 0.5) / 4294967296; };
const normal = () => Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand());
const range = (v) => [Math.min(...v), Math.max(...v)];
// Apart: 1 when a's all lie above b's, -1 when below, 0 when the ranges overlap. Equal values overlap.
const side = (a, b) => { const [alo, ahi] = range(a), [blo, bhi] = range(b); return alo > bhi ? 1 : ahi < blo ? -1 : 0; };
const N = 400000;
const draw = (n, shift = 0) => Array.from({ length: n }, () => normal() + shift);

console.log("\nSIMULATED (400,000 draws each)");
{ // three arms share their runs: the three pairs are not independent
  let any = 0, pairs = 0, anyBoth = 0;
  for (let i = 0; i < N; i += 1) {
    const block = () => [0, 1].map(() => [draw(3), draw(3), draw(3)]); // two tasks, three arms
    const b1 = block(), b2 = block();
    const pair = [[0, 1], [0, 2], [1, 2]];
    const diff = pair.map(([x, y]) => [0, 1].some((t) => side(b1[t][x], b1[t][y]) !== 0));
    pairs += diff.filter(Boolean).length; if (diff.some(Boolean)) any += 1;
    if (pair.some(([x, y]) => [0, 1].some((t) => { const s = side(b1[t][x], b1[t][y]); return s !== 0 && s === side(b2[t][x], b2[t][y]); }))) anyBoth += 1;
  }
  const one = anyBoth / N;
  console.log(`  one measure, three arms, nothing differs: expected "differences" among the three pairs ${(pairs / N).toFixed(3)} (3 x ${p3.toFixed(2)}); at least one ${(any / N).toFixed(3)}; some pair "seen in both blocks" ${one.toFixed(4)}`);
  console.log(`  five measures that had nothing to do with each other: some reading "seen in both blocks" ${(1 - (1 - one) ** 5).toFixed(3)} (1 in ${(1 / (1 - (1 - one) ** 5)).toFixed(1)}); five measures that moved as one: ${one.toFixed(3)} (1 in ${(1 / one).toFixed(0)})`);
}
{ // ties: a count that is nearly always the same number
  for (const [label, value] of [["a count that is 4 nine times in ten, else 5", () => (rand() < 0.9 ? 4 : 5)], ["a count that is 4, 5 or 6, each a third", () => 4 + Math.floor(rand() * 3)]]) {
    let n = 0;
    for (let i = 0; i < N; i += 1) if (side(Array.from({ length: 3 }, value), Array.from({ length: 3 }, value)) !== 0) n += 1;
    console.log(`  ties, ${label}: apart on a task ${(n / N).toFixed(4)} (against 0.1 with no ties)`);
  }
}
{ // how often a real shift is seen, three runs an arm, the same shift on both tasks and in both blocks
  console.log("  a real shift, in units of the spread between runs of one arm (standard deviations), the same on both tasks and in both blocks:");
  for (const d of [0.5, 1, 2, 3, 4]) {
    let task = 0, noDiff = 0, bothBlocks = 0;
    const M = 200000;
    for (let i = 0; i < M; i += 1) {
      const s = [0, 1].map(() => [0, 1].map(() => side(draw(3, d), draw(3)))); // block, task
      if (s[0][0] !== 0) task += 1;
      if (s[0][0] === 0 && s[0][1] === 0) noDiff += 1;
      if ([0, 1].some((t) => s[0][t] !== 0 && s[0][t] === s[1][t])) bothBlocks += 1;
    }
    console.log(`    ${d} sd: apart on a task ${(task / M).toFixed(2)}; "no difference seen" said in a block ${(noDiff / M).toFixed(2)}; "seen in both blocks" ${(bothBlocks / M).toFixed(2)}`);
  }
}
{ // a first run that pays extra: on `four` plain in both blocks (one order), or on `four` plain in one and `four` watched in the other (the page)
  console.log('  nothing differs, but a block\'s first run pays extra (in sd of the spread). Chance that plain and watched are "seen in both blocks" on `four`, by direction:');
  for (const extra of [0, 1, 2, 4]) {
    const out = {};
    for (const [label, second] of [["one order for both blocks", "plain"], ["second block from another round", "watched"]]) {
      let up = 0, down = 0;
      const M = 400000;
      for (let i = 0; i < M; i += 1) {
        const p1 = draw(3), w1 = draw(3), p2 = draw(3), w2 = draw(3);
        p1[0] += extra; (second === "plain" ? p2 : w2)[0] += extra;
        const a = side(p1, w1), b = side(p2, w2);
        if (a === 1 && b === 1) up += 1; if (a === -1 && b === -1) down += 1;
      }
      out[label] = `plain above ${(up / M).toFixed(5)}, plain below ${(down / M).toFixed(5)}`;
    }
    console.log(`    extra ${extra}: ${Object.entries(out).map(([k, v]) => `${k}: ${v}`).join(" | ")}   (with no extra each is 0.0025)`);
  }
  console.log("  and within one block, the same extra on the first arm's `four`: chance of plain apart from watched on that task, by direction:");
  for (const extra of [0, 1, 2, 4]) {
    let up = 0, down = 0; const M = 400000;
    for (let i = 0; i < M; i += 1) { const p = draw(3), w = draw(3); p[0] += extra; const s = side(p, w); if (s === 1) up += 1; if (s === -1) down += 1; }
    console.log(`    extra ${extra}: first arm above ${(up / M).toFixed(4)}, first arm below ${(down / M).toFixed(4)}   (0.05 each with no extra)`);
  }
}

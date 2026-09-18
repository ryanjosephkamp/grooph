/**
 * "Did you mean …?" for names a model or a human mistyped: op names, argument
 * names, ids, and unknown document keys (`W_UNKNOWN_KEY`).
 */

/** Edit distance where swapping two neighbouring letters counts once ("whne" → "when"). */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(rows[i - 1]![j]! + 1, row[j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        row[j] = Math.min(row[j]!, rows[i - 2]![j - 2]! + 1);
      }
    }
    rows.push(row);
  }
  return rows[a.length]![b.length]!;
}

/** The closest candidate within a small edit distance, or undefined. */
export function closest(word: string, candidates: Iterable<string>): string | undefined {
  const limit = Math.max(1, Math.min(3, Math.floor(word.length / 3)));
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const d = distance(word.toLowerCase(), candidate.toLowerCase());
    if (d < bestDistance && d <= limit) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

/** `; did you mean "x"?` or nothing. */
export const didYouMean = (word: string, candidates: Iterable<string>): string => {
  const hit = closest(word, candidates);
  return hit === undefined ? "" : `; did you mean "${hit}"?`;
};

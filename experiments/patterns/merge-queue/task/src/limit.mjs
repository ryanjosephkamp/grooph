/** The first `n` items of a list. */
export function limit(list, n) {
  if (!Number.isInteger(n)) throw new TypeError("n must be an integer");
  return list.slice(0, n);
}

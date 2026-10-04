// A careful first pass written from the task text and the checklist alone, without the held-out suite:
// where the text is silent it takes the cautious reading (refuse what was not asked for, hand back a
// tidy ascending list). Kept to show that the suite separates such a pass from one that knows the
// open points; it is one author's reading, not a model's, and is never copied into a run.

export function parseRanges(text, pageCount) {
  if (typeof text !== "string") throw new TypeError("parseRanges: text must be a string");
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new TypeError("parseRanges: pageCount must be a positive integer");
  const pages = new Set();
  const page = (digits) => {
    if (!/^[1-9]\d*$/.test(digits)) throw new RangeError(`parseRanges: "${digits}" is not a page number`);
    const n = Number(digits);
    if (n > pageCount) throw new RangeError(`parseRanges: page ${n} is past the last page (${pageCount})`);
    return n;
  };
  for (const raw of text.split(",")) {
    const part = raw.trim();
    const range = /^(\S+)-(\S+)$/.exec(part);
    if (!range) {
      pages.add(page(part));
      continue;
    }
    const first = page(range[1]);
    const last = page(range[2]);
    if (first > last) throw new RangeError(`parseRanges: the range "${part}" runs backward`);
    for (let n = first; n <= last; n += 1) pages.add(n);
  }
  return [...pages].sort((a, b) => a - b);
}

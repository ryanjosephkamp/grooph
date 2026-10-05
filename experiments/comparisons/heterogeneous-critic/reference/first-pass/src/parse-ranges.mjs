// A plain first pass written from the task text and the checklist alone, without the held-out suite: the
// shortest honest reading. It splits on commas, trims each part, reads a part as one page or as
// first-last, pushes pages as it reads them, and refuses whatever the text did not ask for. Where that
// reading happens to take the suite's side (pages in the order typed, repeats kept, leading zeros read
// as numbers) it passes; where it does not (a backward range, spaces around the hyphen, a range with
// one end, an empty box) it fails. Kept to show what the suite does to such a pass. It is one author's
// reading, not a model's, and is never copied into a run.

export function parseRanges(text, pageCount) {
  if (typeof text !== "string") throw new TypeError("parseRanges: text must be a string");
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new TypeError("parseRanges: pageCount must be a positive integer");
  const page = (digits) => {
    if (!/^\d+$/.test(digits)) throw new RangeError(`parseRanges: "${digits}" is not a page number`);
    const n = Number(digits);
    if (n < 1 || n > pageCount) throw new RangeError(`parseRanges: page ${n} is not in a document of ${pageCount} pages`);
    return n;
  };
  const pages = [];
  for (const raw of text.split(",")) {
    const part = raw.trim();
    const ends = part.split("-");
    if (ends.length === 1) {
      pages.push(page(part));
      continue;
    }
    if (ends.length !== 2) throw new RangeError(`parseRanges: "${part}" is not a page or a range`);
    const first = page(ends[0]);
    const last = page(ends[1]);
    if (first > last) throw new RangeError(`parseRanges: the range "${part}" runs backward`);
    for (let n = first; n <= last; n += 1) pages.push(n);
  }
  return pages;
}

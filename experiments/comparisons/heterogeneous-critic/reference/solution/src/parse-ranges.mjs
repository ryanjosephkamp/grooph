// A solution that passes the held-out suite, kept to show the suite can be passed.
// It is never copied into a run: a scratch project is built from task/ alone.

const NUMBER = /^\d+$/;

function page(text, pageCount, whole) {
  if (!NUMBER.test(text)) throw new RangeError(`parseRanges: "${whole}" is not a page or a range`);
  const n = Number(text);
  if (n < 1 || n > pageCount) throw new RangeError(`parseRanges: page ${n} is not in a document of ${pageCount} pages`);
  return n;
}

export function parseRanges(text, pageCount) {
  if (typeof text !== "string") throw new TypeError("parseRanges: text must be a string");
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new TypeError("parseRanges: pageCount must be a positive integer");
  const pages = [];
  if (text.trim() === "") {
    for (let n = 1; n <= pageCount; n += 1) pages.push(n);
    return pages;
  }
  for (const raw of text.split(",")) {
    // Spaces and tabs around a number, a comma or the hyphen are ignored; inside a number they are not.
    if (/\d[ \t]+\d/.test(raw)) throw new RangeError(`parseRanges: "${raw.trim()}" is not a page or a range`);
    const part = raw.replace(/[ \t]/g, "");
    if (part === "" || part === "-") throw new RangeError(`parseRanges: "${raw.trim()}" is not a page or a range`);
    const ends = part.split("-");
    if (ends.length === 1) {
      pages.push(page(ends[0], pageCount, part));
      continue;
    }
    if (ends.length !== 2) throw new RangeError(`parseRanges: "${part}" is not a page or a range`);
    const first = ends[0] === "" ? 1 : page(ends[0], pageCount, part);
    const last = ends[1] === "" ? pageCount : page(ends[1], pageCount, part);
    const step = first <= last ? 1 : -1;
    for (let n = first; n !== last + step; n += step) pages.push(n);
  }
  return pages;
}

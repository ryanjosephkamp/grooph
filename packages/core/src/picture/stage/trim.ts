/**
 * An edge drawn up to the cards at its ends and no further, on the page as it is seen: what the app's stage
 * (`apps/web/src/ui/canvas/stage/draw.ts`) and a still (`still.ts`) both do to a line before they draw it.
 */

/** A line drawn short of its ends by so many units, so that its head is seen. */
export function inset(pts: number[][], head: number, tail: number): number[][] {
  const cut = (list: number[][], by: number): number[][] => {
    const out = [...list];
    let left = by;
    while (out.length > 2 && left > 0) {
      const d = Math.hypot(out[1]![0]! - out[0]![0]!, out[1]![1]! - out[0]![1]!);
      if (d > left) break;
      left -= d;
      out.shift();
    }
    const d = Math.hypot(out[1]![0]! - out[0]![0]!, out[1]![1]! - out[0]![1]!);
    if (d > left + 1) out[0] = [out[0]![0]! + ((out[1]![0]! - out[0]![0]!) * left) / d, out[0]![1]! + ((out[1]![1]! - out[0]![1]!) * left) / d];
    return out;
  };
  return cut(cut(pts, head).reverse(), tail).reverse();
}

/** A line from where it last leaves a box to its end, a little clear of the box: null if it does not end in the box. */
export function outside(pts: number[][], [x, y, bw, bh]: [number, number, number, number]): number[][] | null {
  const inside = (q: number[]): boolean => q[0]! > x && q[0]! < x + bw && q[1]! > y && q[1]! < y + bh;
  if (pts.length < 2 || !inside(pts[pts.length - 1]!)) return null;
  let n = pts.length - 1;
  while (n > 0 && inside(pts[n - 1]!)) n -= 1;
  if (n === 0) return null;
  // Between the last point outside and the first inside, the place where the line crosses the box's edge.
  const [a, b] = [pts[n - 1]!, pts[n]!];
  let [lo, hi] = [0, 1];
  for (let k = 0; k < 12; k += 1) inside([a[0]! + (b[0]! - a[0]!) * ((lo + hi) / 2), a[1]! + (b[1]! - a[1]!) * ((lo + hi) / 2)]) ? (hi = (lo + hi) / 2) : (lo = (lo + hi) / 2);
  return [...pts.slice(0, n), [a[0]! + (b[0]! - a[0]!) * lo, a[1]! + (b[1]! - a[1]!) * lo]];
}

/** The least and the most of a list: a drawing has too many points to spread into `Math.min`. */
export function extent(xs: number[]): [number, number] {
  let [lo, hi] = [Infinity, -Infinity];
  for (const x of xs) [lo, hi] = [Math.min(lo, x), Math.max(hi, x)];
  return [lo, hi];
}

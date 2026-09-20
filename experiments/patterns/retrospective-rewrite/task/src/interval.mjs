/** True when the two closed intervals share at least one integer. */
export function overlaps(a, b) {
  check(a);
  check(b);
  return a[0] <= b[1] && b[0] <= a[1];
}

function check(interval) {
  if (!Array.isArray(interval) || interval.length !== 2 || !interval.every(Number.isInteger) || interval[0] > interval[1]) {
    throw new TypeError("an interval is [start, end] with integer start <= end");
  }
}

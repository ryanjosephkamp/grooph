/**
 * Compare two semantic versions by precedence (https://semver.org, §11).
 *
 * Returns -1 when `a` comes before `b`, 0 when they have the same precedence,
 * and 1 when `a` comes after `b`. Build metadata (`+…`) does not count.
 * Throws a TypeError when either argument is not a string, and a RangeError when
 * either is not a valid semantic version (§2, §9, §10).
 *
 * @param {string} a
 * @param {string} b
 * @returns {-1 | 0 | 1}
 */
export function compare(a, b) {
  throw new Error("not implemented");
}

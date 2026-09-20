/**
 * Writes seconds as the shortest run of h, m, s and ms parts, in that order,
 * leaving out zero parts; 0 is "0s".
 * @param {number} seconds a finite, non-negative number
 */
export function formatSeconds(seconds) {
  if (typeof seconds !== "number") throw new TypeError("formatSeconds: seconds must be a number");
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError("formatSeconds: seconds must be finite and non-negative");
  let ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3_600_000);
  ms -= h * 3_600_000;
  const m = Math.floor(ms / 60_000);
  ms -= m * 60_000;
  const s = Math.floor(ms / 1000);
  ms -= s * 1000;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  if (ms) parts.push(`${ms}ms`);
  return parts.join("") || "0s";
}

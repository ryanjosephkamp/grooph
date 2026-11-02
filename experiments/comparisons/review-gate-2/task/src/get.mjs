/**
 * Reads one setting by a dotted path such as "output.color".
 * @param {object} settings
 * @param {string} path
 * @param {*} [fallback] returned when any step of the path is missing
 */
export function getPath(settings, path, fallback) {
  if (typeof path !== "string" || path === "") throw new TypeError("getPath: path must be a non-empty string");
  let at = settings;
  for (const step of path.split(".")) {
    if (at === null || typeof at !== "object" || !Object.hasOwn(at, step)) return fallback;
    at = at[step];
  }
  return at;
}

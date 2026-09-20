/**
 * One `key=value` line per own property of `object`, in insertion order,
 * ending with a newline.
 * @param {Record<string, string>} object
 */
export function renderKeyValue(object) {
  if (object === null || typeof object !== "object") throw new TypeError("renderKeyValue: object required");
  let out = "";
  for (const [key, value] of Object.entries(object)) {
    if (typeof value !== "string") throw new TypeError(`renderKeyValue: ${key} is not a string`);
    out += `${key}=${value}\n`;
  }
  return out;
}

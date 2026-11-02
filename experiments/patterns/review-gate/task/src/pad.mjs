/**
 * Pads `text` on the left with spaces until it is `width` characters long.
 * Text that is already `width` characters or longer comes back unchanged.
 *
 * @param {string} text
 * @param {number} width a non-negative integer
 * @returns {string}
 */
export function padStart(text, width) {
  if (typeof text !== "string") throw new TypeError("padStart: text must be a string");
  if (!Number.isInteger(width) || width < 0) throw new RangeError("padStart: width must be a non-negative integer");
  return text.length >= width ? text : " ".repeat(width - text.length) + text;
}

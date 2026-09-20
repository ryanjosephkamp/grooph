/**
 * Counts the words in `text`: runs of characters that are not whitespace.
 *
 * @param {string} text
 * @returns {number}
 */
export function countWords(text) {
  if (typeof text !== "string") throw new TypeError("countWords: text must be a string");
  const words = text.trim().split(/\s+/);
  return words[0] === "" ? 0 : words.length;
}

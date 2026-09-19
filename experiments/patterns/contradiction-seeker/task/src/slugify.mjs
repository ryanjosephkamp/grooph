/**
 * Turns a title into a URL slug: lowercase ASCII letters and digits, in words
 * joined by single hyphens, at most `maxLength` characters long. Accents are
 * dropped ("é" becomes "e"); anything else that is not a letter or a digit
 * separates words.
 *
 * @param {string} text
 * @param {{ maxLength?: number }} [options]
 * @returns {string}
 */
export function slugify(text, { maxLength = 48 } = {}) {
  if (typeof text !== "string") throw new TypeError("slugify: text must be a string");
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, maxLength);
}

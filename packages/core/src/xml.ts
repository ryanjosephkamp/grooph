/**
 * Text made safe for markup: the characters that mean something there are written as entities, and the characters
 * XML does not allow at all (control characters other than tab and line breaks, U+FFFE and U+FFFF, and half a
 * surrogate pair) are dropped, so a picture saved as its own file still opens.
 */
export const esc = (text: string): string =>
  text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

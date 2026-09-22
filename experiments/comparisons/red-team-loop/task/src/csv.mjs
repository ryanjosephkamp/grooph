export class CsvError extends Error {
  constructor(message) {
    super(message);
    this.name = "CsvError";
  }
}

/**
 * Parses one CSV record into its fields (README.md). Handles the plain and the
 * quoted case; the rest of the contract is not enforced yet.
 * @param {string} text
 * @returns {string[]}
 */
export function parseCsvLine(text) {
  if (typeof text !== "string") throw new TypeError("parseCsvLine: text must be a string");
  const fields = [];
  let field = "";
  let quoted = false;
  let rest = text;
  while (rest.length > 0) {
    const ch = rest[0];
    rest = rest.slice(1);
    if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

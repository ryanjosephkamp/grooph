import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WORDS = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "words.txt");

/** True when `word` (any case) is in data/words.txt. Reads the list on every call. */
export function lookup(word) {
  if (typeof word !== "string") throw new TypeError("lookup: word must be a string");
  const list = readFileSync(WORDS, "utf8").split("\n").filter(Boolean);
  return list.includes(word.toLowerCase());
}

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The text of the named file under the user's root. */
export function readUserFile(root, name) {
  return readFileSync(join(root, name), "utf8");
}

/** Writes the named file under the user's root, creating the root if needed. */
export function writeUserFile(root, name, text) {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, name), text, "utf8");
}

/** The files directly under the user's root, with their sizes in bytes, sorted by name. */
export function listFiles(root) {
  const names = readdirSync(root).filter((name) => statSync(join(root, name)).isFile());
  return names.sort().map((name) => ({ name, size: readFileSync(join(root, name)).length }));
}

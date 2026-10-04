import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Reads a file; a missing one is named as the caller typed it, not as an absolute path. */
export function readText(path: string): string {
  try {
    return readFileSync(resolve(path), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw Object.assign(new Error(`no such file: ${path}`), { code: "ENOENT", path });
    throw err;
  }
}

export function writeText(path: string, contents: string): void {
  const full = resolve(path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents, "utf8");
}

export function writeBytes(path: string, contents: Uint8Array): void {
  const full = resolve(path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
}

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const readText = (path: string): string => readFileSync(resolve(path), "utf8");

export function writeText(path: string, contents: string): void {
  const full = resolve(path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents, "utf8");
}

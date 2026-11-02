import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import type { Graph } from "@grooph/core";

export const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
export const fixturePath = join(repoRoot, "fixtures/valid/review-loop.grooph.json");
export const goldenDir = join(repoRoot, "fixtures/golden/claude-code/review-loop");

export const fixtureText = (): string => readFileSync(fixturePath, "utf8");
export const reviewLoop = (): Graph => JSON.parse(fixtureText()) as Graph;

/** Every file under `dir`, keyed by its path relative to `dir`, dot-directories included. */
export function readTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else out[relative(dir, full).split("\\").join("/")] = readFileSync(full, "utf8");
    }
  };
  walk(dir);
  return out;
}

/**
 * Regenerate the golden packages under `fixtures/golden/<target>/<graph>/`.
 *
 *   pnpm --filter @grooph/core run golden:write
 *
 * `test/compile.test.ts` compares `compile()` against these files byte for byte,
 * so run this whenever the compiler's output changes on purpose — and read the
 * diff before committing it: the golden files are the package a human reviews.
 */

import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "../compile/index.js";
import { parseGraphText } from "../parse.js";
import { readFileSync } from "node:fs";

const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("workspace root not found");
})();

const GOLDENS = [{ graph: "fixtures/valid/review-loop.grooph.json", target: "claude-code" as const }];

for (const golden of GOLDENS) {
  const parsed = parseGraphText(readFileSync(join(repoRoot, golden.graph), "utf8"));
  if (!parsed.doc) throw new Error(`${golden.graph} does not parse: ${JSON.stringify(parsed.issues, null, 2)}`);

  const result = compile(parsed.doc, golden.target);
  const outDir = join(repoRoot, "fixtures", "golden", golden.target, parsed.doc.id);
  if (existsSync(outDir)) rmSync(outDir, { recursive: true });

  for (const [path, contents] of Object.entries(result.files)) {
    const file = join(outDir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents, "utf8");
  }
  process.stdout.write(`wrote ${relative(repoRoot, outDir)} (${Object.keys(result.files).length} files)\n`);
  for (const path of walk(outDir)) process.stdout.write(`  ${relative(outDir, path)}\n`);
}

function walk(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

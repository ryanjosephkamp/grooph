/**
 * Regenerate the golden packages under `fixtures/golden/<target>/<graph>/`,
 * the golden pictures of the sample operation map under `fixtures/maps/pictures/`,
 * and of two graphs under `fixtures/pictures/`.
 *
 *   pnpm --filter @grooph/core run golden:write
 *
 * `test/compile.test.ts` compares `compile()` against these files byte for byte,
 * so run this whenever the compiler's output changes on purpose — and read the
 * diff before committing it: the golden files are the package a human reviews.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "../compile/index.js";
import { parseMapText } from "../map.js";
import { parseGraphText } from "../parse.js";
import { picture } from "../picture/graph-picture.js";
import { mapPicture } from "../picture/map-picture.js";

const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("workspace root not found");
})();

/** The review loop at the default level (`adaptive`), and a small graph at `fixed`, so both §9 texts are reviewable. */
const GOLDENS = [
  { graph: "fixtures/valid/review-loop.grooph.json", target: "claude-code" as const },
  { graph: "fixtures/valid/fix-until-green.grooph.json", target: "claude-code" as const },
];

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

/**
 * The sample map (docs/operation-map.md §6) as its picture, light and dark: what `grooph image` writes.
 * The first is the sample as the Operator corrected it; the second is the first draft, drawn from the owner's
 * brief before anyone who knew the operation had seen it, kept because the tests were written against it.
 */
const MAP_PICTURES = [
  "fixtures/maps/valid/owner-operation-2026-10-01.grooph-map.json",
  "fixtures/maps/valid/owner-operation-2026-09-30.grooph-map.json",
  // The same operation with its owner drawn as a person, and the smallest map that has one (amendment A-013).
  "fixtures/maps/valid/owner-operation-2026-10-01-with-ryan.grooph-map.json",
  "fixtures/maps/valid/a-person-and-two-sessions.grooph-map.json",
];

for (const file of MAP_PICTURES) {
  const parsed = parseMapText(readFileSync(join(repoRoot, file), "utf8"));
  if (!parsed.map) throw new Error(`${file} does not parse: ${JSON.stringify(parsed.issues, null, 2)}`);
  const outDir = join(repoRoot, "fixtures", "maps", "pictures");
  mkdirSync(outDir, { recursive: true });
  for (const theme of ["light", "dark"] as const) {
    const out = join(outDir, `${parsed.map.id}.${theme}.svg`);
    writeFileSync(out, mapPicture(parsed.map, { theme }), "utf8");
    process.stdout.write(`wrote ${relative(repoRoot, out)}\n`);
  }
}

/** Two graphs as their pictures, light and dark: the acceptance graph, and a fan-out with margin edges on both sides. */
const GRAPH_PICTURES = ["fixtures/valid/review-loop.grooph.json", "patterns/specialist-critic-bank.grooph.json"];

for (const file of GRAPH_PICTURES) {
  const parsed = parseGraphText(readFileSync(join(repoRoot, file), "utf8"));
  if (!parsed.doc) throw new Error(`${file} does not parse: ${JSON.stringify(parsed.issues, null, 2)}`);
  const outDir = join(repoRoot, "fixtures", "pictures");
  mkdirSync(outDir, { recursive: true });
  for (const theme of ["light", "dark"] as const) {
    const out = join(outDir, `${parsed.doc.id}.${theme}.svg`);
    writeFileSync(out, picture(parsed.doc, { theme }), "utf8");
    process.stdout.write(`wrote ${relative(repoRoot, out)}\n`);
  }
}

function walk(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

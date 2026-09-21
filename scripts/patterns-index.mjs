#!/usr/bin/env node
/**
 * Generate patterns/index.json, patterns/README.md and patterns/glyphs/<id>.svg
 * from the pattern documents in patterns/ (docs/templates.md §3, §5). All are
 * committed and published with the site.
 *
 *   node scripts/patterns-index.mjs           write them
 *   node scripts/patterns-index.mjs --check   exit 1 when any is stale or missing (CI)
 *
 * Needs @grooph/core built (`pnpm -r build`): the index rows come from
 * `templateIndexEntry`, the same function the CLI uses for user registries,
 * and the glyphs from `glyph`, the same drawing the app and the CLI make.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "patterns");
const core = await import(join(root, "packages/core/dist/src/index.js")).catch(() => {
  console.error("patterns-index: @grooph/core is not built; run `pnpm -r build` first");
  process.exit(2);
});
const { parseGraphText, templateIndex, templateIndexEntry, formatIssue, glyph } = core;

const problems = [];
const docs = [];
for (const file of readdirSync(dir).filter((name) => name.endsWith(".grooph.json")).sort()) {
  const parsed = parseGraphText(readFileSync(join(dir, file), "utf8"));
  if (!parsed.doc) {
    problems.push(`${file}: does not match the schema`, ...parsed.issues.map((issue) => `  ${formatIssue(issue)}`));
    continue;
  }
  if (!parsed.doc.template) problems.push(`${file}: has no template block, so it is not a pattern`);
  else if (file !== `${parsed.doc.id}.grooph.json`) problems.push(`${file}: must be named after its id, ${parsed.doc.id}.grooph.json`);
  else docs.push({ file, doc: parsed.doc });
}
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

const index = templateIndex(docs.map(({ doc, file }) => templateIndexEntry(doc, file)));
const indexText = `${JSON.stringify(index, null, 2)}\n`;
// One glyph per pattern (slice 0015): the wordless picture of its shape, drawn by core.
const glyphsDir = join(dir, "glyphs");
const glyphs = docs.map(({ doc }) => ({ path: join(glyphsDir, `${doc.id}.svg`), text: `${glyph(doc)}\n` }));

const profile = (p) => `${p.cost} · ${p.speed} · ${p.rigor}`;
const cell = (text) => text.replace(/\|/g, "\\|");
// A demo is a repo-relative path (so it also resolves under the published site root) or a URL.
const demo = (t) => (t.demo ? `[run](${/^https?:/.test(t.demo) ? t.demo : `../${t.demo}`})` : "–");
// Credits (decision 0010): one line under the table per credited pattern, saying what was taken, never endorsement.
const credits = index.templates
  .filter((t) => (t.credits ?? []).length > 0)
  .map((t) => `- \`${t.id}\` — inspired by ${t.credits.map((c) => `[${cell(c.name)}](${c.url}): ${cell(c.note)}`).join("; ")}.`);
const readme = `# Pattern library

The built-in templates: one graph document per named pattern from spec §10, each with a \`template\` block (docs/templates.md). Every pattern validates with no errors once its slots are filled with their examples; the warnings a pattern raises on purpose are listed in \`<id>.expect.json\` beside it. Gauntlet-style polish is \`taste-polish\`, one bounded entry among many, never a default.

Use one by name, without copying anything:

\`\`\`bash
grooph template list
grooph template show review-gate
grooph template use review-gate --name "Slugify" --set task="Add a slugify function." --set test-command="pnpm test" --set checklist=docs/REVIEW-CHECKLIST.md --out slugify.grooph.json
grooph template insert human-gated-irreversible --into slugify.grooph.json --set action="Merge the branch into main." --set irreversible=merge --write
\`\`\`

The library is published with the web app at <https://ryanjosephkamp.github.io/grooph/patterns/index.json>, so \`grooph template add <id>\` fetches one without a clone.

| Shape | Pattern | Kind | When to use | Cost · speed · rigor | Slots | Proven |
|---|---|---|---|---|---|---|
${index.templates
  .map(
    (t) =>
      `| <img src="glyphs/${t.id}.svg" alt="" width="140"> | [\`${t.id}\`](${t.file}) ${cell(t.title)} | ${t.kind} | ${cell(t.whenToUse)} | ${profile(t.profile)} | ${(t.slots ?? []).map((s) => `\`${s}\``).join(", ")} | ${demo(t)} |`,
  )
  .join("\n")}

**Shape** is the pattern's glyph (\`glyphs/<id>.svg\`, drawn by \`grooph glyph\` from the document): squares are writers, diamonds critics, hexagons checks, octagons human gates, circles merges, a dot the stop; solid lines pass, dashed fail, dotted a verdict, doubled an approval; a dashed hull is a loop with its back edges drawn returning, and a bar under a node marks an irreversible step.

**Proven** links a recorded headless run of the template on a small task, with its write-up and evidence (\`experiments/patterns/\`). A proving run says what happened in one run; it is not a benchmark.
${
  credits.length > 0
    ? `
**Credits** name whose published work a pattern's shape or name comes from, and what was taken (decision 0010). A credit is not an endorsement by that author, and no pattern claims to beat a named product.

${credits.join("\n")}
`
    : ""
}
_Generated by \`scripts/patterns-index.mjs\` from the documents in this folder, like \`index.json\` and the glyphs. Edit a pattern, then run \`node scripts/patterns-index.mjs\`; CI fails when any of them is stale._
`;

const outputs = [
  { path: join(dir, "index.json"), text: indexText },
  { path: join(dir, "README.md"), text: readme },
  ...glyphs,
];
// A glyph left behind by a pattern that is gone is stale too.
const strays = existsSync(glyphsDir) ? readdirSync(glyphsDir).map((name) => join(glyphsDir, name)).filter((path) => !glyphs.some((g) => g.path === path)) : [];
const rel = (path) => path.slice(root.length + 1);

if (process.argv.includes("--check")) {
  const stale = outputs.filter(({ path, text }) => {
    try {
      return readFileSync(path, "utf8") !== text;
    } catch {
      return true;
    }
  });
  if (stale.length > 0 || strays.length > 0) {
    console.error(
      `stale: ${[...stale.map(({ path }) => rel(path)), ...strays.map((path) => `${rel(path)} (no pattern)`)].join(", ")}; run \`node scripts/patterns-index.mjs\` and commit the result`,
    );
    process.exit(1);
  }
  console.log(`patterns/index.json, patterns/README.md and patterns/glyphs/ are current (${index.templates.length} patterns)`);
} else {
  mkdirSync(glyphsDir, { recursive: true });
  for (const { path, text } of outputs) writeFileSync(path, text, "utf8");
  for (const path of strays) rmSync(path);
  console.log(`wrote patterns/index.json, patterns/README.md and ${glyphs.length} glyphs (${index.templates.length} patterns)`);
}

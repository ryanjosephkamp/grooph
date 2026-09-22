/**
 * The capture for review: renders the card, copies the SVG into captures/ and
 * writes captures/CAPTURE.md, a readable account of every element with its
 * position, size and colour, so a reviewer can judge the current revision
 * from these two files alone (and compare them element by element with any
 * other SVG described the same way).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderCard } from "../src/card.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data", "summary.json"), "utf8"));
const svg = renderCard(data);
mkdirSync(join(root, "out"), { recursive: true });
mkdirSync(join(root, "captures"), { recursive: true });
writeFileSync(join(root, "out", "card.svg"), svg, "utf8");
writeFileSync(join(root, "captures", "card.svg"), svg, "utf8");
writeFileSync(join(root, "captures", "CAPTURE.md"), describe(svg, "captures/card.svg", "src/card.mjs"), "utf8");
console.log(`captured captures/card.svg and captures/CAPTURE.md`);

/** A readable, element-by-element account of an SVG string. Exported so a reviewer can describe another SVG the same way. */
export function describe(svg, file, source) {
  const attr = (tag, name) => /(?:^|\s)NAME="([^"]*)"/.source.replace("NAME", name);
  const get = (attrs, name) => new RegExp(attr(null, name)).exec(attrs)?.[1] ?? "–";
  const group = (index) => {
    const before = svg.slice(0, index);
    const open = before.lastIndexOf("<g ");
    const close = before.lastIndexOf("</g>");
    if (open === -1 || close > open) return "(top level)";
    return /id="([^"]*)"/.exec(svg.slice(open, svg.indexOf(">", open)))?.[1] ?? "(unnamed group)";
  };
  const rows = [];
  for (const m of svg.matchAll(/<(rect|line|text|path|circle)\b([^>]*?)(\/>|>([^<]*)<\/\1>)/g)) {
    const [, tag, attrs, , content] = m;
    const g = group(m.index);
    if (tag === "rect") rows.push(`- ${g} · rect x=${get(attrs, "x")} y=${get(attrs, "y")} w=${get(attrs, "width")} h=${get(attrs, "height")} rx=${get(attrs, "rx")} fill=${get(attrs, "fill")} stroke=${get(attrs, "stroke")}`);
    else if (tag === "line") rows.push(`- ${g} · line (${get(attrs, "x1")},${get(attrs, "y1")})→(${get(attrs, "x2")},${get(attrs, "y2")}) stroke=${get(attrs, "stroke")} width=${get(attrs, "stroke-width")}`);
    else if (tag === "text") rows.push(`- ${g} · text (${get(attrs, "x")},${get(attrs, "y")}) ${get(attrs, "font-size")}px weight=${get(attrs, "font-weight")} anchor=${get(attrs, "text-anchor")} fill=${get(attrs, "fill")}: "${(content ?? "").trim()}"`);
    else rows.push(`- ${g} · ${tag} ${attrs.trim().replace(/\s+/g, " ").slice(0, 120)}`);
  }
  const size = /<svg[^>]*\bwidth="([^"]*)"[^>]*\bheight="([^"]*)"/.exec(svg);
  const fills = [...new Set([...svg.matchAll(/fill="([^"]*)"/g)].map((x) => x[1]))];
  return [
    `# Capture of ${file}`,
    ``,
    `- rendered ${new Date().toISOString()} from ${source}, sha256 ${createHash("sha256").update(svg).digest("hex").slice(0, 12)}`,
    `- ${svg.length} bytes, ${size ? `${size[1]} × ${size[2]}` : "size not declared"}; fills used: ${fills.join(", ") || "none"}`,
    ``,
    `## Elements, in document order (group · kind · position · size · colour · text)`,
    ``,
    ...rows,
    ``,
  ].join("\n");
}

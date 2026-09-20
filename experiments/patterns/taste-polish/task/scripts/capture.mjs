/**
 * The capture for review: renders the chart, copies the SVG into captures/ and
 * writes captures/CAPTURE.md, a readable account of what the SVG contains, so a
 * reviewer can judge the current revision from these two files alone.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderChart } from "../src/chart.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data", "monthly.json"), "utf8"));
const svg = renderChart(data);
mkdirSync(join(root, "out"), { recursive: true });
mkdirSync(join(root, "captures"), { recursive: true });
writeFileSync(join(root, "out", "chart.svg"), svg, "utf8");
writeFileSync(join(root, "captures", "chart.svg"), svg, "utf8");

const count = (tag) => (svg.match(new RegExp(`<${tag}[\\s>/]`, "g")) ?? []).length;
const attr = (name) => [...new Set([...svg.matchAll(new RegExp(`${name}="([^"]*)"`, "g"))].map((m) => m[1]))];
const texts = [...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map((m) => {
  const x = /\bx="([^"]*)"/.exec(m[1])?.[1] ?? "?";
  const y = /\by="([^"]*)"/.exec(m[1])?.[1] ?? "?";
  const size = /font-size="([^"]*)"/.exec(m[1])?.[1] ?? "default";
  return `- (${x}, ${y}) ${size}px: ${m[2].trim() || "(empty)"}`;
});
const size = /<svg[^>]*\bwidth="([^"]*)"[^>]*\bheight="([^"]*)"/.exec(svg);
const summary = [
  `# Capture of the current revision`,
  ``,
  `- rendered at ${new Date().toISOString()} from src/chart.mjs, sha256 ${createHash("sha256").update(svg).digest("hex").slice(0, 12)}`,
  `- file: captures/chart.svg, ${svg.length} bytes, ${size ? `${size[1]} × ${size[2]}` : "size not declared"}`,
  `- elements: ${count("rect")} rect, ${count("line")} line, ${count("text")} text, ${count("path")} path, ${count("g")} g`,
  `- fills used: ${attr("fill").join(", ") || "none declared"}`,
  `- strokes used: ${attr("stroke").join(", ") || "none declared"}`,
  `- font families: ${attr("font-family").join(", ") || "none declared"}`,
  ``,
  `## Text, in document order`,
  ``,
  ...(texts.length > 0 ? texts : ["(no text)"]),
  ``,
].join("\n");
writeFileSync(join(root, "captures", "CAPTURE.md"), summary, "utf8");
console.log(`captured captures/chart.svg and captures/CAPTURE.md (${count("rect")} rect, ${count("text")} text)`);

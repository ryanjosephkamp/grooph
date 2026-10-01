import { extname } from "node:path";

import { formatIssue, isMapLike, mapPicture, parseMapText, type PictureTheme } from "@grooph/core";

import { readText, writeText } from "../io.js";
import type { Output } from "../print.js";

export const IMAGE_HELP = `grooph image <operation map> [--out <file.svg>] [--theme light | dark | auto]

The picture of a document with its words on it, laid out for a phone: 400 units wide,
so it reads at a phone's width without zooming.

An operation map (*.grooph-map.json, docs/operation-map.md) is drawn as its lanes top to
bottom, each session a card in its lane, each handoff a numbered arc in the margin, and
the handoffs listed below with what carries each.

  --theme light | dark   colours written into the file: it looks the same anywhere
  --theme auto           (default) both palettes; follows the viewer's colour scheme
  --out <file.svg>       write the file; without it the SVG is printed

Deterministic: the same document and theme give the same bytes.`;

type Flags = { out?: string; theme?: string };

const THEMES = ["light", "dark", "auto"] as const;

/** `grooph image <file> [--out <svg>] [--theme <theme>]`. Exit 1 when the file cannot be drawn. */
export function imageCommand(io: Output, file: string, flags: Flags = {}): number {
  const theme = flags.theme ?? "auto";
  if (!(THEMES as readonly string[]).includes(theme)) {
    io.err(`grooph: --theme is light, dark or auto, got "${theme}"`);
    return 1;
  }
  if (flags.out !== undefined && extname(flags.out).toLowerCase() !== ".svg") {
    io.err(`grooph: --out ${flags.out}: image writes an SVG file; name it <something>.svg`);
    return 1;
  }
  const text = readText(file);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    io.err(`grooph: ${file} is not JSON: ${(err as Error).message}`);
    return 1;
  }
  if (!isMapLike(json)) {
    io.err(`grooph: ${file} is not an operation map. image draws operation maps (*.grooph-map.json); for a graph's shape, grooph glyph <file>.`);
    return 1;
  }
  const parsed = parseMapText(text);
  if (!parsed.map) {
    io.err(`grooph: ${file} is not an operation map grooph can read`);
    for (const issue of parsed.issues) io.err(formatIssue(issue));
    return 1;
  }
  const svg = mapPicture(parsed.map, { theme: theme as PictureTheme });
  if (flags.out !== undefined) {
    writeText(flags.out, svg);
    io.out(`wrote ${flags.out}`);
    return 0;
  }
  io.out(svg.replace(/\n$/, ""));
  return 0;
}

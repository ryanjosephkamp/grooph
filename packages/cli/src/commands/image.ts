import { extname } from "node:path";

import {
  formatIssue,
  isMapLike,
  mapLive,
  mapOutline,
  mapPicture,
  offlinePage,
  outline,
  outlineMarkdown,
  parseGraphText,
  parseMapText,
  picture,
  type Graph,
  type OperationMap,
  type PictureTheme,
} from "@grooph/core";

import { readLive, sourceExists, type EventSource } from "../events-io.js";
import { readText, writeBytes, writeText } from "../io.js";
import type { Output } from "../print.js";

export const IMAGE_HELP = `grooph image <graph | operation map> [--out <file.svg | file.png>] [--theme light | dark | auto] [--scale <n>] [--events <id>=<source>]...

The picture of a document with its words on it, laid out for a phone: 400 units wide,
so it reads at a phone's width without zooming.

A graph is drawn as one column in the order work reaches each node: a card per node
(kind, name, role and tier), an arrow to the next card, every other edge in the left
margin, every loop's back edge in the right, and below the cards each loop with its
bar and its stops in order.

An operation map (*.grooph-map.json, docs/operation-map.md) is drawn as its lanes top to
bottom, each session a card in its lane, each handoff a numbered arc in the margin, and
the handoffs listed below with what carries each.

  --theme light | dark   colors written into the file: it looks the same anywhere
  --theme auto           (SVG only, the SVG default) both palettes; follows the viewer
  --out <file.svg>       write the SVG; without --out it is printed
  --out <file.png>       write a PNG, 3 pixels to the unit (1,200 px wide); --scale changes
                         that. A PNG is one theme: light unless --theme dark.

  --events <id>=<src>    for an operation map: draw what the event hook has seen on the
                         session with that id (working, waiting or ended; subagents running
                         and done). <src> is an events file, a folder, a project, or
                         git:<ref>. As often as wanted. A snapshot of now: run it again
                         for a newer one. docs/operation-map.md §4b.

Deterministic: the same document and theme give the same SVG bytes. The PNG is drawn
with this machine's fonts, so it can differ by machine. For the wordless shape, grooph glyph.`;

export const OUTLINE_HELP = `grooph outline <graph | operation map> [--out <file.md>]

The whole document to read from top to bottom, as Markdown: a graph's every node with
its full brief, each edge as a sentence, each loop with its bar and stops; a map's lanes,
sessions and handoffs. One way only: edit the document, never the outline.`;

export const PAGE_HELP = `grooph page <graph | operation map> --out <file.html> [--events <id>=<source>]...

One HTML file that holds the document and a viewer for it: the picture, the outline, the
validator's list and the document itself. It asks the network for nothing (its content
security policy forbids every request), so it opens on a phone with no connection, from
a message, a drive or a folder. Light and dark; tap a card to read about it; Save
document writes the .grooph.json (or .grooph-map.json) back out for the app to import.

For an operation map, --events <session id>=<source> (as often as wanted) marks each
session with what the event hook has seen of it, as grooph image does: a snapshot, taken
when the page is made.

A document with rule errors still makes a page, with the errors listed. One that does
not match its schema cannot be drawn.`;

type Loaded = { kind: "graph"; doc: Graph } | { kind: "map"; doc: OperationMap };

/** A graph or a map from a file; undefined, with the reasons printed, when it is neither. */
function load(io: Output, file: string): Loaded | undefined {
  const text = readText(file);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    io.err(`grooph: ${file} is not JSON: ${(err as Error).message}`);
    return undefined;
  }
  if (isMapLike(json)) {
    const parsed = parseMapText(text);
    if (parsed.map) return { kind: "map", doc: parsed.map };
    io.err(`grooph: ${file} is not an operation map grooph can read`);
    for (const issue of parsed.issues) io.err(formatIssue(issue));
    return undefined;
  }
  const parsed = parseGraphText(text);
  if (parsed.doc) return { kind: "graph", doc: parsed.doc };
  io.err(`grooph: ${file} is neither a graph document nor an operation map`);
  for (const issue of parsed.issues) io.err(formatIssue(issue));
  return undefined;
}

type ImageFlags = { out?: string; theme?: string; scale?: number; events?: EventSource[] };

/**
 * What the hooks saw of a map's sessions, read now from the sources given.
 * A source named for a map session (`operator=<source>`) lights that session.
 * Undefined, with the reason printed, when a source is not there or names no session.
 */
function liveFor(io: Output, loaded: Loaded, events: EventSource[] | undefined): { live: NonNullable<ReturnType<typeof mapLive>>; at: string } | undefined | "refused" {
  if (!events || events.length === 0) return undefined;
  if (loaded.kind !== "map") {
    io.err("grooph: --events lights the sessions of an operation map; this file is a graph. For a run of a graph, grooph watch.");
    return "refused";
  }
  const ids = new Set(loaded.doc.sessions.map((s) => s.id));
  for (const source of events) {
    if (!sourceExists(source)) {
      io.err(source.ref !== undefined ? `grooph: --events: no such git ref here: ${source.ref}` : `grooph: --events: no such file or folder: ${source.path}`);
      return "refused";
    }
    if (source.name === undefined || !ids.has(source.name)) {
      io.err(`grooph: --events ${source.name ?? source.path ?? `git:${source.ref}`}: name each source for the map session it belongs to, as <session id>=<source>. This map's sessions: ${[...ids].join(", ")}`);
      return "refused";
    }
  }
  const view = readLive(events);
  return { live: mapLive(view.sessions, loaded.doc, view.at), at: view.at };
}

const THEMES = ["light", "dark", "auto"] as const;

/** `grooph image <file> [--out <svg | png>] [--theme <theme>] [--scale <n>]`. Exit 1 when the file cannot be drawn. */
export async function imageCommand(io: Output, file: string, flags: ImageFlags = {}): Promise<number> {
  const ext = flags.out === undefined ? ".svg" : extname(flags.out).toLowerCase();
  if (ext !== ".svg" && ext !== ".png") {
    io.err(`grooph: --out ${flags.out}: image writes an SVG or a PNG; name it <something>.svg or <something>.png`);
    return 1;
  }
  const theme = flags.theme ?? (ext === ".png" ? "light" : "auto");
  if (!(THEMES as readonly string[]).includes(theme)) {
    io.err(`grooph: --theme is light, dark or auto, got "${theme}"`);
    return 1;
  }
  if (ext === ".png" && theme === "auto") {
    io.err("grooph: a PNG is one theme; use --theme light or --theme dark (auto is for SVG, which can follow the viewer)");
    return 1;
  }
  const loaded = load(io, file);
  if (!loaded) return 1;
  const now = liveFor(io, loaded, flags.events);
  if (now === "refused") return 1;
  const svg = loaded.kind === "map" ? mapPicture(loaded.doc, { theme: theme as PictureTheme, ...(now ? now : {}) }) : picture(loaded.doc, { theme: theme as PictureTheme });

  if (flags.out === undefined) {
    io.out(svg.replace(/\n$/, ""));
    return 0;
  }
  if (ext === ".svg") {
    writeText(flags.out, svg);
    io.out(`wrote ${flags.out}`);
    return 0;
  }
  let png: Uint8Array;
  try {
    png = await renderPng(svg, flags.scale ?? 3);
  } catch (err) {
    io.err(`grooph: could not make a PNG: ${(err as Error).message}`);
    io.err(`The SVG is the same drawing: grooph image ${file} --theme ${theme} --out ${flags.out.replace(/\.png$/i, ".svg")}`);
    return 1;
  }
  writeBytes(flags.out, png);
  io.out(`wrote ${flags.out}`);
  return 0;
}

/**
 * SVG to PNG through resvg, an optional dependency (a prebuilt binary per
 * platform): when it is not installed the SVG is still there, and the error
 * says so. Text is drawn with the machine's own fonts.
 */
export async function renderPng(svg: string, scale: number): Promise<Uint8Array> {
  type ResvgModule = { Resvg: new (svg: string, options: unknown) => { render(): { asPng(): Uint8Array } } };
  let mod: ResvgModule;
  try {
    const name = "@resvg/resvg-js";
    mod = (await import(name)) as ResvgModule;
  } catch {
    throw new Error("the PNG renderer (@resvg/resvg-js, an optional dependency) is not installed here; install it beside grooph (npm install @resvg/resvg-js), or run pnpm install in a grooph clone");
  }
  const sans = process.platform === "darwin" ? "Helvetica Neue" : process.platform === "win32" ? "Segoe UI" : "DejaVu Sans";
  const resvg = new mod.Resvg(svg, { fitTo: { mode: "zoom", value: scale }, font: { loadSystemFonts: true, defaultFontFamily: sans, sansSerifFamily: sans } });
  return resvg.render().asPng();
}

/** `grooph outline <file> [--out <file.md>]`. */
export function outlineCommand(io: Output, file: string, flags: { out?: string } = {}): number {
  const loaded = load(io, file);
  if (!loaded) return 1;
  const text = outlineMarkdown(loaded.kind === "map" ? mapOutline(loaded.doc) : outline(loaded.doc));
  if (flags.out !== undefined) {
    writeText(flags.out, text);
    io.out(`wrote ${flags.out}`);
    return 0;
  }
  io.out(text.replace(/\n$/, ""));
  return 0;
}

/** `grooph page <file> --out <file.html>`. */
export function pageCommand(io: Output, file: string, flags: { out: string; version: string; link?: string; events?: EventSource[] }): number {
  if (!/\.html?$/i.test(flags.out)) {
    io.err(`grooph: --out ${flags.out}: page writes an HTML file; name it <something>.html`);
    return 1;
  }
  const loaded = load(io, file);
  if (!loaded) return 1;
  const now = liveFor(io, loaded, flags.events);
  if (now === "refused") return 1;
  const html = offlinePage(loaded.doc, { version: flags.version, ...(flags.link ? { link: flags.link } : {}), ...(now ? now : {}) });
  writeText(flags.out, html);
  io.out(`wrote ${flags.out} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB, one file, no network needed)`);
  return 0;
}

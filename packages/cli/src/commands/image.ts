import { extname } from "node:path";

import {
  formatIssue,
  isMapLike,
  mapLive,
  mapOutline,
  mapPicture,
  mapSequence,
  mapWide,
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

export const IMAGE_HELP = `grooph image <graph | operation map> [--out <file.svg | file.png>] [--theme light | dark | auto] [--scale <n>] [--open <group> | all]... [--layout wide] [--view sequence] [--events <id>=<source>]...

The picture of a document with its words on it, laid out for a phone: 400 units wide,
so it reads at a phone's width without zooming.

A graph is drawn as one column in the order work reaches each node: a card per node
(kind, name, role and tier), an arrow to the next card, every other edge in the left
margin, every loop's back edge in the right, and below the cards each loop with its
bar and its stops in order.

A subgrooph (a template placed as a unit, grooph sub) is one box: its name, the template
and version it came from, how many nodes it holds, which brakes are among them, and the
glyph of what is inside. What crosses its edge starts or ends at the box.

  --open <group>         draw that subgrooph open: its nodes as cards of their own, kept
                         together inside a frame under its name. As often as wanted.
  --open all             every subgrooph open. One inside a closed one stays out of sight.

An operation map (*.grooph-map.json, docs/operation-map.md) is drawn as its lanes top to
bottom, each session a card in its lane, each handoff a numbered arc in the margin, and
the handoffs listed below with what carries each.

An operation map has two more views, for a screen with room or a map with many handoffs
(docs/operation-map.md §4c and §4d). Both are wider than a phone:

  --layout wide          its lanes side by side: the people in a band across the top, each lane
                         a column, each handoff an arc in the gutters between the lanes, and
                         the list below in columns. As wide as its lanes need, about 900 units
                         for three lanes. --layout phone is the picture above, and the default.
  --view sequence        a column for each person and session, and a row for each handoff in the
                         order the map lists them: a numbered arrow from sender to receiver, with
                         what carries it and what is handed. An order, not a clock: a map records
                         no times. --view picture is the default.

  --theme light | dark   colors written into the file: it looks the same anywhere
  --theme auto           (SVG only, the SVG default) both palettes; follows the viewer
  --out <file.svg>       write the SVG; without --out it is printed
  --out <file.png>       write a PNG, 3 pixels to the unit (1,200 px wide for the phone's
                         picture); --scale changes that. A PNG is one theme: light unless
                         --theme dark.

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

type ImageFlags = { out?: string; theme?: string; scale?: number; events?: EventSource[]; layout?: string; view?: string; open?: string[] };

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

/**
 * Which view of a map was asked for, or undefined with the reason printed. A graph has one picture; the
 * sequence has one layout, and no cards for the event hook's marks.
 */
function viewFor(io: Output, loaded: Loaded, flags: ImageFlags): { wide: boolean; sequence: boolean } | undefined {
  const refuse = (message: string): undefined => void io.err(`grooph: ${message}`);
  const layout = flags.layout ?? "phone";
  const view = flags.view ?? "picture";
  if (layout !== "phone" && layout !== "wide") return refuse(`--layout is phone or wide, got "${layout}"`);
  if (view !== "picture" && view !== "sequence") return refuse(`--view is picture or sequence, got "${view}"`);
  if (loaded.kind !== "map" && (layout === "wide" || view === "sequence")) {
    return refuse(`--${view === "sequence" ? "view sequence" : "layout wide"} is a view of an operation map; this file is a graph, which has one picture`);
  }
  if (view === "sequence" && layout === "wide") return refuse("the sequence has one layout; --layout wide is for the picture. Leave one of them out");
  if (view === "sequence" && flags.events?.length) return refuse("--events marks the sessions' cards on the picture; the sequence has no cards. Leave out --view sequence, or --events");
  return { wide: layout === "wide", sequence: view === "sequence" };
}

/** `grooph image <file> [--out <svg | png>] [--theme <theme>] [--scale <n>] [--layout wide] [--view sequence]`. Exit 1 when the file cannot be drawn. */
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
  const view = viewFor(io, loaded, flags);
  if (!view) return 1;
  const now = liveFor(io, loaded, flags.events);
  if (now === "refused") return 1;
  const open = flags.open ?? [];
  if (open.length > 0) {
    const boxes = loaded.kind === "map" ? [] : (loaded.doc.groups ?? []).filter((group) => group.from !== undefined).map((group) => group.id);
    const unknown = open.filter((id) => id !== "all" && !boxes.includes(id));
    if (loaded.kind === "map" || unknown.length > 0) {
      io.err(loaded.kind === "map" ? "grooph: --open opens a subgrooph of a graph; this file is an operation map" : `grooph: --open ${unknown[0]}: no such subgrooph; ${boxes.length > 0 ? `this graph's are ${boxes.join(", ")}` : "this graph has none"}`);
      return 1;
    }
  }
  const svg =
    loaded.kind !== "map"
      ? picture(loaded.doc, { theme: theme as PictureTheme, ...(open.length > 0 ? { open: open.includes("all") ? ("all" as const) : open } : {}) })
      : view.sequence
        ? mapSequence(loaded.doc, { theme: theme as PictureTheme })
        : (view.wide ? mapWide : mapPicture)(loaded.doc, { theme: theme as PictureTheme, ...(now ? now : {}) });

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
    io.err(`The SVG is the same drawing: grooph image ${file} --theme ${theme}${view.wide ? " --layout wide" : ""}${view.sequence ? " --view sequence" : ""} --out ${flags.out.replace(/\.png$/i, ".svg")}`);
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
  // The page's picture is the one `grooph image` draws: a subgrooph is a box.
  const html = offlinePage(loaded.doc, { version: flags.version, ...(flags.link ? { link: flags.link } : {}), ...(now ? now : {}), ...(loaded.kind !== "map" ? { picture: picture(loaded.doc) } : {}) });
  writeText(flags.out, html);
  io.out(`wrote ${flags.out} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB, one file, no network needed)`);
  return 0;
}

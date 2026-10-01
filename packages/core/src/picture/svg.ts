/**
 * What the pictures share: a palette for each theme, text that is measured
 * without a browser, and the few SVG shapes both pictures draw.
 *
 * A picture is a projection with its words on it (the glyph is the wordless
 * one). It is laid out for a phone: 400 units wide, so that at a phone's width
 * one unit is about one CSS pixel and 11-unit text is 11 px. Pure and
 * deterministic: the same document and options give the same bytes.
 */

export type PictureTheme = "light" | "dark" | "auto";

export type PictureOptions = {
  /**
   * `light` and `dark` write the colours into the file, so it looks the same
   * anywhere and can be turned into a PNG. `auto` (the default) writes both
   * as CSS variables and follows the viewer's colour scheme; a page that
   * holds the picture inline can set the variables itself.
   */
  theme?: PictureTheme;
  /** Width in units; the height follows from the content. Default 400. */
  width?: number;
};

/** What a map's picture may also be given: what the hooks saw of its sessions, and when that was read. */
export type MapPictureOptions = PictureOptions & {
  live?: Record<string, { sessions: number; working: number; waiting: number; ended: number; agentsRunning: number; agentsDone: number; lastAt: string }>;
  /** when the live state was read, ISO 8601; shown in the caption */
  at?: string;
};

export const PICTURE_WIDTH = 400;

/** The app's tokens (apps/web/src/styles.css) as plain colours, so a picture stands on its own. */
const LIGHT = {
  bg: "#f1f4f3",
  surface: "#fdfefe",
  "surface-2": "#e8edeb",
  ink: "#1a201e",
  "ink-2": "#454c49",
  "ink-3": "#5f6764",
  line: "#dce1df",
  "line-strong": "#b9c1be",
  accent: "#1f5f4a",
  "accent-soft": "#dcefe6",
  gate: "#b25e09",
  "gate-soft": "#fcf0d9",
  check: "#2b5f9e",
  merge: "#6b4fa0",
  stop: "#5b5f66",
  ok: "#1f7a4d",
  "ok-soft": "#dff3e6",
  warning: "#955500",
  error: "#b42318",
  "error-soft": "#fceae7",
  "loop-0": "#7a4cc2",
  "loop-1": "#0f7c8c",
  "loop-2": "#c2410c",
  "loop-3": "#b5306e",
} as const;

const DARK: Record<Colour, string> = {
  bg: "#111514",
  surface: "#1b201e",
  "surface-2": "#242a27",
  ink: "#ebefed",
  "ink-2": "#c0c7c4",
  "ink-3": "#99a19e",
  line: "#2d3331",
  "line-strong": "#4a524f",
  accent: "#5dbb94",
  "accent-soft": "#1e3a30",
  gate: "#eb9a45",
  "gate-soft": "#362a15",
  check: "#6fa3e0",
  merge: "#a88be0",
  stop: "#9ba0a8",
  ok: "#6fcf9d",
  "ok-soft": "#1c3a2a",
  warning: "#f0b35a",
  error: "#ff8f80",
  "error-soft": "#3a1e1b",
  "loop-0": "#a883f0",
  "loop-1": "#3cc0d0",
  "loop-2": "#f0874f",
  "loop-3": "#ee6fa6",
};

export type Colour = keyof typeof LIGHT;

export const FONT = `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
export const MONO = `ui-monospace, 'SF Mono', Menlo, Consolas, 'Roboto Mono', monospace`;

/** A colour as it is written into a `style` attribute for the chosen theme. */
export type Ink = (name: Colour) => string;

export function inkFor(theme: PictureTheme): Ink {
  if (theme === "light") return (name) => LIGHT[name];
  if (theme === "dark") return (name) => DARK[name];
  return (name) => `var(--gp-${name})`;
}

/** The `<style>` an `auto` picture carries: both palettes as variables, the dark one under the viewer's preference. */
export function paletteStyle(theme: PictureTheme): string {
  if (theme !== "auto") return "";
  const vars = (palette: Record<Colour, string>): string =>
    (Object.keys(LIGHT) as Colour[]).map((name) => `--gp-${name}:${palette[name]}`).join(";");
  return `<style>.grooph-picture{${vars(LIGHT)}}@media (prefers-color-scheme:dark){.grooph-picture:not([data-theme="light"]){${vars(DARK)}}}.grooph-picture[data-theme="dark"]{${vars(DARK)}}</style>`;
}

// ─── numbers and text ─────────────────────────────────────────────────────

/** One decimal, no trailing zero, no negative zero: small files that diff quietly. */
export const fmt = (n: number): string => {
  const r = Math.round(n * 10) / 10;
  return (Object.is(r, -0) ? 0 : r).toString();
};

export const esc = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Advances in thousandths of an em for the characters from space to tilde: for each, the wider of Verdana and Arial,
 * read from the fonts' own tables. A picture does not know which font will draw it: `system-ui` is San Francisco on
 * a Mac, Roboto on a phone, and DejaVu Sans on a Linux machine with nothing else, which is a tenth wider than Arial.
 * Measured for a narrow font, a line that "fits" runs past its box on the wide one (the Operator's first PNG, drawn
 * on Linux, did). So the measure is of the widest font a picture is likely to meet, and narrower ones leave slack.
 */
const REGULAR = [
  352, 394, 459, 818, 636, 1076, 727, 269, 454, 454, 636, 818, 364, 454, 364, 454, 636, 636, 636, 636, 636, 636, 636, 636, 636, 636, 454, 454, 818, 818, 818, 556, 1015,
  684, 686, 722, 771, 667, 611, 778, 751, 421, 500, 693, 557, 843, 748, 787, 667, 787, 722, 684, 616, 732, 684, 989, 685, 667, 685, 454, 454, 454, 818, 636, 636,
  601, 623, 521, 623, 596, 352, 623, 633, 274, 344, 592, 274, 973, 633, 607, 623, 623, 427, 521, 394, 633, 592, 818, 592, 592, 525, 635, 454, 635, 818,
];
const BOLD = [
  342, 402, 587, 867, 711, 1272, 862, 332, 543, 543, 711, 867, 361, 480, 361, 689, 711, 711, 711, 711, 711, 711, 711, 711, 711, 711, 402, 402, 867, 867, 867, 617, 975,
  776, 762, 724, 830, 683, 650, 811, 837, 546, 556, 771, 637, 948, 847, 850, 733, 850, 782, 710, 682, 812, 764, 1128, 764, 737, 692, 543, 689, 543, 867, 711, 711,
  668, 699, 588, 699, 664, 422, 699, 712, 342, 403, 671, 342, 1058, 712, 687, 699, 699, 497, 593, 456, 712, 650, 980, 669, 651, 597, 711, 543, 711, 867,
];
/** The few characters outside that range the pictures write themselves: [regular, bold]. */
const OTHER: Record<string, [number, number]> = {
  "·": [364, 361],
  "→": [1000, 1000],
  "×": [818, 867],
  "…": [1000, 1049],
  "—": [1000, 1000],
  "–": [636, 711],
  "’": [269, 332],
  "‘": [269, 332],
  "“": [459, 587],
  "”": [459, 587],
};
/** DejaVu Sans runs a little wider than Verdana in some lowercase letters; this covers it. */
const SLACK = 1.03;

/**
 * The width of text, estimated without a browser, for the widest sans font a picture is likely to be drawn with.
 * A line that is said to fit does, on a Mac, a phone or a bare Linux machine; on the narrower fonts it ends short.
 */
export function textWidth(text: string, size: number, weight: "regular" | "bold" | "mono" = "regular"): number {
  if (weight === "mono") return text.length * size * 0.62;
  const table = weight === "bold" ? BOLD : REGULAR;
  const column = weight === "bold" ? 1 : 0;
  let thousandths = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 32 && code <= 126) thousandths += table[code - 32]!;
    else if (OTHER[ch]) thousandths += OTHER[ch]![column];
    else if (code > 0x2e80) thousandths += 1000;
    else thousandths += weight === "bold" ? 720 : 650; // an accented letter, or a symbol not in the table
  }
  return (thousandths / 1000) * size * SLACK;
}

/** Cut text to a width, ending in an ellipsis when something was cut. */
export function truncate(text: string, width: number, size: number, weight: "regular" | "bold" | "mono" = "regular"): string {
  if (textWidth(text, size, weight) <= width) return text;
  let out = text;
  while (out.length > 1 && textWidth(`${out}…`, size, weight) > width) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

/**
 * Break text into lines no wider than `width`, at most `maxLines` of them; the last ends in an ellipsis when text is left over.
 * `width` may differ by line (a first line that shares its row with a badge): give a function of the line's index.
 */
export function wrap(text: string, width: number | ((line: number) => number), size: number, maxLines: number, weight: "regular" | "bold" | "mono" = "regular"): string[] {
  const widthOf = typeof width === "number" ? () => width : width;
  const words = text.trim().split(/\s+/).filter((w) => w !== "");
  const lines: string[] = [];
  let i = 0;
  while (i < words.length && lines.length < maxLines) {
    let line = words[i++]!;
    while (i < words.length && textWidth(`${line} ${words[i]!}`, size, weight) <= widthOf(lines.length)) line = `${line} ${words[i++]!}`;
    lines.push(line);
  }
  if (lines.length === 0) return [""];
  if (i < words.length) lines[lines.length - 1] = `${lines[lines.length - 1]!} ${words.slice(i).join(" ")}`;
  // A line still too wide is one long word, or the last line carrying what was left over.
  return lines.map((line, k) => truncate(line, widthOf(k), size, weight));
}

// ─── shapes ───────────────────────────────────────────────────────────────

export type TextOptions = { size: number; fill: string; weight?: "regular" | "bold" | "mono"; anchor?: "start" | "middle" | "end" };

/** One line of text with its baseline at `y`. */
export function text(x: number, y: number, content: string, o: TextOptions): string {
  const family = o.weight === "mono" ? ` font-family="${MONO}"` : "";
  const bold = o.weight === "bold" ? ' font-weight="700"' : "";
  const anchor = o.anchor && o.anchor !== "start" ? ` text-anchor="${o.anchor}"` : "";
  return `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${fmt(o.size)}"${family}${bold}${anchor} style="fill:${o.fill}">${esc(content)}</text>`;
}

export function rect(x: number, y: number, w: number, h: number, o: { fill?: string; stroke?: string; rx?: number; width?: number; dash?: string; mark?: string }): string {
  const style = [`fill:${o.fill ?? "none"}`, ...(o.stroke ? [`stroke:${o.stroke}`] : [])].join(";");
  return `<rect${o.mark ? ` data-${o.mark}=""` : ""} x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}"${o.rx ? ` rx="${fmt(o.rx)}"` : ""}${o.stroke ? ` stroke-width="${fmt(o.width ?? 1)}"` : ""}${o.dash ? ` stroke-dasharray="${o.dash}"` : ""} style="${style}"/>`;
}

/** A pill with text in it, its left edge at `x` and its text baseline at `y`; returns the markup and the pill's width. */
export function pill(x: number, y: number, content: string, o: { size: number; fill: string; ink: string; stroke?: string; weight?: "regular" | "bold" | "mono" }): { svg: string; width: number } {
  const padX = o.size * 0.55;
  const width = textWidth(content, o.size, o.weight ?? "bold") + padX * 2;
  const height = o.size * 1.55;
  const top = y - o.size * 1.08;
  return {
    svg:
      rect(x, top, width, height, { fill: o.fill, rx: height / 2, ...(o.stroke ? { stroke: o.stroke } : {}) }) +
      text(x + width / 2, y, content, { size: o.size, fill: o.ink, weight: o.weight ?? "bold", anchor: "middle" }),
    width,
  };
}

/** The frame every picture has: the root element, the palette, a title for screen readers and the background. */
export function frame(width: number, height: number, title: string, theme: PictureTheme, ink: Ink, body: string, kind: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="grooph-picture" data-picture="${kind}" viewBox="0 0 ${fmt(width)} ${fmt(height)}" width="${fmt(width)}" height="${fmt(height)}" role="img" font-family="${FONT}">` +
    `<title>${esc(title)}</title>` +
    paletteStyle(theme) +
    rect(0, 0, width, height, { fill: ink("bg") }) +
    body +
    `</svg>\n`
  );
}

/**
 * Tracks for arcs that run side by side in a margin: each arc spans an
 * interval along the margin, and two that overlap take different tracks.
 * Short arcs take the inner tracks, so a long one goes around them. Returns
 * the track of each interval, in the order given, and how many tracks it took.
 */
export function assignTracks(spans: { from: number; to: number }[], gap = 0): { tracks: number[]; count: number } {
  const order = spans
    .map((s, i) => ({ i, lo: Math.min(s.from, s.to), hi: Math.max(s.from, s.to) }))
    .sort((a, b) => a.hi - a.lo - (b.hi - b.lo) || a.lo - b.lo || a.i - b.i);
  const used: { lo: number; hi: number }[][] = [];
  const tracks = new Array<number>(spans.length).fill(0);
  for (const s of order) {
    let t = 0;
    while (used[t]?.some((u) => s.lo <= u.hi + gap && u.lo <= s.hi + gap)) t++;
    (used[t] ??= []).push({ lo: s.lo, hi: s.hi });
    tracks[s.i] = t;
  }
  return { tracks, count: used.length };
}

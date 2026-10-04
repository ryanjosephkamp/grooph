import { existsSync, statSync } from "node:fs";

import {
  SHARE_BASE,
  SHARE_LINK_WARN,
  ShareError,
  buildShareEnvelope,
  encodeSharePayload,
  formatIssue,
  mapPicture,
  picture,
  shareLink,
  type Graph,
  type ShareEnvelope,
} from "@grooph/core";

import type { Output } from "../print.js";
import { isRunDir, readRun } from "../run-io.js";
import { LoadError, deflateRaw, loadShareable, type Loaded } from "../share-io.js";

export type EmbedTheme = "light" | "dark";
export type EmbedFlags = { theme?: EmbedTheme; height?: number; base?: string; frame?: boolean; play?: boolean };

export const EMBED_HELP = `grooph embed <file> [--theme light|dark] [--height <px>] [--frame] [--play] [--base <url>]

<file> is a graph, a run folder or *.grooph-run.json bundle, an operation map, or a proposal set.

Print the HTML that puts a live, read-only picture of the document in any web page: an
<iframe> on the first line, and on the second a one-line script that sizes the frame to the
picture. A reader can pan and zoom it, tap a node for its brief, and open it in grooph. A
run (a run folder or a *.grooph-run.json bundle) plays: play, step and a scrubber.

The document travels in the frame's address after the #, as in grooph share, so the host
page's server never sees it. Nothing about the reader is sent anywhere.

  --theme <t>    light or dark; without it the picture follows the reader's color scheme
  --height <px>  the frame's height when the page has no script to size it
                 (default: the picture's own height at a phone's width)
  --frame        draw the embed's own background and border, not the page's background
  --play         start a run's replay as soon as it is shown
  --base <url>   where the app is served (default ${SHARE_BASE});
                 http://localhost:4173/grooph/ for a local build

Without the script the frame keeps its height, and the picture shrinks to fit or can be
dragged. Example:

  grooph embed review.grooph.json --theme light >> post.html`;

/** The two bars under the picture, in CSS pixels: the picture's controls, and a run's replay. */
const BAR_HEIGHT = 49;
const REPLAY_HEIGHT = 124;

const attr = (text: string): string => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The picture an embed opens on at a phone's width, and so its height there. */
function pictureHeight(envelope: ShareEnvelope): number {
  const svg =
    envelope.kind === "map"
      ? mapPicture(envelope.doc)
      : envelope.kind === "run"
        ? picture(envelope.doc.working)
        : envelope.kind === "graph"
          ? picture(envelope.doc)
          : picture(
              (envelope.doc.candidates.find((c) => c.id === envelope.doc.recommendation?.candidate) ?? envelope.doc.candidates[0]!).graph as Graph,
            );
  return Number(/viewBox="0 0 [\d.]+ ([\d.]+)"/.exec(svg)?.[1] ?? 480);
}

const nameOf = (envelope: ShareEnvelope): string =>
  envelope.kind === "run" ? `${envelope.doc.working.name} (a run)` : envelope.kind === "proposals" ? envelope.doc.title : envelope.doc.name;

/** The embed's address: the app's base, `#/embed?d=`, the share payload, and the options. */
export function embedSrc(payload: string, flags: Pick<EmbedFlags, "theme" | "frame" | "play" | "base">): string {
  const root = shareLink(payload, flags.base ?? SHARE_BASE).split("#")[0]!;
  const options = [flags.theme ? `theme=${flags.theme}` : "", flags.frame ? "frame=1" : "", flags.play ? "play=1" : ""].filter(Boolean);
  return `${root}#/embed?d=${payload}${options.map((o) => `&${o}`).join("")}`;
}

/** The script that lets a page size every grooph frame to what the frame asks for. Only messages from the app's origin count. */
export function resizeScript(base: string = SHARE_BASE): string {
  const origin = new URL(base).origin;
  return (
    `<script>addEventListener("message",function(e){var d=e.data;if(e.origin!==${JSON.stringify(origin)}||!d||d.grooph!=="embed-height"||!(d.height>0))return;` +
    `document.querySelectorAll("iframe[data-grooph-embed]").forEach(function(f){if(f.contentWindow===e.source)f.style.height=Math.min(d.height,4000)+"px"})})</script>`
  );
}

/** The two lines `grooph embed` prints for a document already checked for sharing: the frame, and the script that sizes it. */
export function embedHtml(envelope: ShareEnvelope, flags: EmbedFlags = {}): { frame: string; script: string; src: string } {
  const src = embedSrc(encodeSharePayload(envelope, deflateRaw), flags);
  const height = flags.height ?? Math.ceil(pictureHeight(envelope) + BAR_HEIGHT + (envelope.kind === "run" ? REPLAY_HEIGHT : 0));
  return {
    frame:
      `<iframe src="${attr(src)}" title="${attr(`${nameOf(envelope)}, a grooph picture`)}" width="100%" height="${height}" ` +
      `style="border:0;width:100%;max-width:100%;display:block" loading="lazy" referrerpolicy="no-referrer" data-grooph-embed></iframe>`,
    script: resizeScript(flags.base ?? SHARE_BASE),
    src,
  };
}

/**
 * `grooph embed <file> [--theme light|dark] [--height <px>] [--frame] [--play] [--base <url>]`
 * (docs/exports.md, "Embedding"). Prints two lines, the frame and the script; exit 1 when
 * the document cannot be shared.
 */
export function embedCommand(io: Output, file: string, flags: EmbedFlags = {}): number {
  if (flags.height !== undefined && !(Number.isInteger(flags.height) && flags.height >= 120 && flags.height <= 4000)) {
    io.err(`grooph: --height takes a whole number of pixels from 120 to 4000, not ${flags.height}`);
    return 1;
  }
  if (flags.base !== undefined && !URL.canParse(flags.base)) {
    io.err(`grooph: --base takes the address the app is served from, such as http://localhost:4173/grooph/, not ${flags.base}`);
    return 1;
  }
  if (!existsSync(file)) {
    io.err(`grooph: no such file: ${file}`);
    return 1;
  }
  let loaded: Loaded;
  try {
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!isRunDir(file)) throw new LoadError(`${file} is a folder but not a run folder; embed takes a graph, a run folder (.grooph/<graph-id>/runs/<run-id>/), a run bundle, an operation map or a proposal set`);
      loaded = { kind: "run", doc: readRun(file).bundle };
    } else loaded = loadShareable(file);
  } catch (err) {
    if (!(err instanceof LoadError)) throw err;
    io.err(`grooph: ${err.message}`);
    for (const line of err.lines) io.err(line);
    return 1;
  }

  let envelope: ShareEnvelope;
  try {
    envelope = buildShareEnvelope(loaded.doc);
  } catch (err) {
    if (!(err instanceof ShareError)) throw err;
    io.err(`cannot embed ${file}: fix these first`);
    for (const issue of err.issues) io.err(formatIssue(issue));
    return 1;
  }

  const { frame, script, src } = embedHtml(envelope, flags);
  io.out(frame);
  io.out(script);
  if (src.length > SHARE_LINK_WARN) {
    io.err(`warning: the frame's address is ${src.length.toLocaleString("en")} characters; it works in a page, but is too long to send as a link`);
  }
  return 0;
}

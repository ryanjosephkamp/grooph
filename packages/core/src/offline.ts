/**
 * The offline page: one HTML file that holds a graph (or an operation map)
 * and a viewer for it, and asks the network for nothing. The picture, the
 * outline, the validator's list and the document itself are all inside the
 * file; a content security policy in the page forbids every request, so "no
 * internet" is a property of the file and not a hope.
 *
 * It is a page to read, send and keep, not the app: nothing in it edits.
 * Save the document from it and import that into the app to change it.
 * Pure and deterministic: the same document gives the same bytes.
 */

import { canonicalize } from "./canonicalize.js";
import { mapLiveLine, type MapSessionLive } from "./events.js";
import { formatIssue, type IssueLike } from "./issues.js";
import { canonicalizeMap, isMapLike, validateMap } from "./map.js";
import { mapOutline, outline, type OutlineSection } from "./outline.js";
import { picture } from "./picture/graph-picture.js";
import { mapPicture } from "./picture/map-picture.js";
import { esc } from "./picture/svg.js";
import type { Graph, OperationMap } from "./types.js";
import { validate } from "./validate.js";

export type OfflinePageOptions = {
  /** Shown in the footer: the grooph that made the page. */
  version?: string;
  /** A link that opens the same document in the app, for when there is a network. */
  link?: string;
  /** For an operation map: what the hooks saw of its sessions (`mapLive`), drawn on the picture and said in the outline. */
  live?: Record<string, MapSessionLive>;
  /** When that live state was read, ISO 8601. */
  at?: string;
};

const CSS = `
:root{color-scheme:light dark;--bg:#f1f4f3;--surface:#fdfefe;--surface-2:#e8edeb;--ink:#1a201e;--ink-2:#454c49;--ink-3:#5f6764;--line:#dce1df;--line-strong:#b9c1be;--accent:#1f5f4a;--accent-soft:#dcefe6;--error:#b42318;--warning:#955500}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#111514;--surface:#1b201e;--surface-2:#242a27;--ink:#ebefed;--ink-2:#c0c7c4;--ink-3:#99a19e;--line:#2d3331;--line-strong:#4a524f;--accent:#5dbb94;--accent-soft:#1e3a30;--error:#ff8f80;--warning:#f0b35a}}
:root[data-theme="dark"]{--bg:#111514;--surface:#1b201e;--surface-2:#242a27;--ink:#ebefed;--ink-2:#c0c7c4;--ink-3:#99a19e;--line:#2d3331;--line-strong:#4a524f;--accent:#5dbb94;--accent-soft:#1e3a30;--error:#ff8f80;--warning:#f0b35a}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
main{max-width:560px;margin:0 auto;padding:0 0 48px}
.bar{position:sticky;top:0;z-index:2;display:flex;gap:8px;align-items:center;padding:8px 12px;background:var(--surface);border-bottom:1px solid var(--line)}
.bar strong{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px}
button,.btn{font:inherit;font-size:14px;font-weight:600;min-height:44px;padding:0 14px;border:1px solid var(--line-strong);border-radius:10px;background:var(--surface);color:var(--ink);text-decoration:none;display:inline-flex;align-items:center;cursor:pointer}
.picture svg{display:block;width:100%;height:auto}
.picture [data-node],.picture [data-session],.picture [data-loop]{cursor:pointer}
.note{margin:0;padding:10px 16px;color:var(--ink-3);font-size:13px}
section{margin:12px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:var(--surface);scroll-margin-top:64px}
section.flash{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
.kind{margin:0;color:var(--accent);font-size:12px;font-weight:700;letter-spacing:.02em}
h2{margin:0 0 2px;font-size:18px;line-height:1.3}
.id{margin:0 0 10px;color:var(--ink-3);font:12px ui-monospace,"SF Mono",Menlo,Consolas,monospace}
dl{margin:0}
dt{margin-top:10px;color:var(--ink-3);font-size:13px;font-weight:600}
dd{margin:2px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
ul{margin:2px 0 0;padding-left:20px}
li{margin:2px 0;overflow-wrap:anywhere}
.issues{list-style:none;padding:0}
.issues li{padding:8px 10px;margin:6px 0;border-radius:8px;background:var(--surface-2);font-size:14px}
.issues .error{border-left:4px solid var(--error)}
.issues .warning{border-left:4px solid var(--warning)}
.up{display:inline-block;margin-top:12px;color:var(--ink-3);font-size:13px}
footer{margin:20px 16px 0;color:var(--ink-3);font-size:13px}
a{color:var(--accent)}
`;

const SCRIPT = `
(function(){
var root=document.documentElement,svg=document.querySelector('.grooph-picture');
function theme(t){root.setAttribute('data-theme',t);if(svg)svg.setAttribute('data-theme',t)}
document.getElementById('theme').addEventListener('click',function(){
var now=root.getAttribute('data-theme')||(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
theme(now==='dark'?'light':'dark')});
document.querySelector('.picture').addEventListener('click',function(e){
var g=e.target.closest?e.target.closest('[data-node],[data-session],[data-loop]'):null;if(!g)return;
var el=document.getElementById('s-'+(g.getAttribute('data-node')||g.getAttribute('data-session')||g.getAttribute('data-loop')));if(!el)return;
el.scrollIntoView({behavior:'smooth',block:'start'});el.classList.add('flash');setTimeout(function(){el.classList.remove('flash')},1600)});
document.getElementById('save').addEventListener('click',function(){
var holder=document.getElementById('grooph-document');
var text=JSON.stringify(JSON.parse(holder.textContent),null,2)+'\\n';
var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=holder.getAttribute('data-name');document.body.appendChild(a);a.click();a.remove()});
})();
`;

function sectionHtml(section: OutlineSection, first: boolean): string {
  const items = section.items
    .map((it) => `<dt>${esc(it.label)}</dt><dd>${it.list ? `<ul>${it.list.map((entry) => `<li>${esc(entry)}</li>`).join("")}</ul>` : esc(it.text ?? "")}</dd>`)
    .join("");
  return (
    `<section id="s-${esc(section.id)}"><p class="kind">${esc(section.kind)}</p><h2>${esc(section.title)}</h2>` +
    `<p class="id">${esc(section.id)}</p><dl>${items}</dl>${first ? "" : `<a class="up" href="#top">Back to the picture</a>`}</section>`
  );
}

/**
 * A graph or an operation map as one self-contained HTML page. A document
 * that does not match its schema cannot be drawn, so the caller parses first;
 * rule errors are fine, and are listed on the page.
 */
export function offlinePage(doc: Graph | OperationMap, options: OfflinePageOptions = {}): string {
  const map = isMapLike(doc) ? (doc as OperationMap) : undefined;
  const graph = map ? undefined : (doc as Graph);
  const svg = (map ? mapPicture(map, options.live ? { live: options.live, ...(options.at ? { at: options.at } : {}) } : {}) : picture(graph!)).trimEnd();
  const sections = map ? mapOutline(map) : outline(graph!);
  if (map && options.live) {
    // A snapshot: what each session was doing when the page was made, first in its section.
    for (const section of sections) {
      const now = section.kind === "Session" ? options.live[section.id] : undefined;
      if (now) section.items.unshift({ label: options.at ? `At ${options.at.slice(0, 16).replace("T", " ")} UTC` : "When this page was made", text: mapLiveLine(now) });
    }
  }
  const issues: IssueLike[] = map ? validateMap(map) : validate(graph!, { forExport: true });
  const errors = issues.filter((i) => i.severity === "error").length;
  const text = map ? canonicalizeMap(map) : canonicalize(graph!);
  const name = doc.name || doc.id;
  const file = `${doc.id}.${map ? "grooph-map" : "grooph"}.json`;
  const what = map ? "operation map" : graph!.template ? "template" : "graph";
  const verdict =
    issues.length === 0
      ? map
        ? "No issues. Every handoff names its carrier."
        : "No issues. The graph validates for export."
      : `${errors} error${errors === 1 ? "" : "s"}, ${issues.length - errors} warning${issues.length - errors === 1 ? "" : "s"}.`;

  return [
    `<!doctype html>`,
    `<html lang="en">`,
    `<head>`,
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:">`,
    `<meta name="generator" content="grooph${options.version ? ` ${esc(options.version)}` : ""}">`,
    `<title>${esc(name)} · grooph ${what}</title>`,
    `<style>${CSS}</style>`,
    `</head>`,
    `<body>`,
    `<main id="top">`,
    `<div class="bar"><strong>${esc(name)}</strong><button type="button" id="theme">Light / dark</button><button type="button" id="save">Save document</button></div>`,
    `<p class="note">A grooph ${what}, whole in this one file. It needs no network. Tap a card to read about it below.${
      map && options.live ? " The marks on the cards are a snapshot of what the event hook had seen when the page was made; the page does not update itself." : ""
    }</p>`,
    `<div class="picture">${svg}</div>`,
    `<section id="s-validation"><p class="kind">Validation</p><h2>${esc(verdict)}</h2>${
      issues.length > 0 ? `<ul class="issues">${issues.map((i) => `<li class="${i.severity}">${esc(formatIssue(i))}</li>`).join("")}</ul>` : ""
    }</section>`,
    ...sections.map((section, i) => sectionHtml(section, i === 0)),
    `<footer>Made with grooph${options.version ? ` ${esc(options.version)}` : ""}. The picture, the text and the document are all inside this file; Save document writes <code>${esc(file)}</code>, which the grooph app imports.${
      options.link ? ` With a network, <a href="${esc(options.link)}">open it in the app</a>.` : ""
    }</footer>`,
    `</main>`,
    `<script type="application/json" id="grooph-document" data-name="${esc(file)}">${text.replace(/</g, "\\u003c")}</script>`,
    `<script>${SCRIPT}</script>`,
    `</body>`,
    `</html>`,
    ``,
  ].join("\n");
}

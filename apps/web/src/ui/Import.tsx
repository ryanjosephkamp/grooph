/**
 * Opening a document a person hands over, by Import or by Paste a document (handoff 0078): what each kind of
 * document becomes, the reader that finds one in what a chat wrote, and the box it is pasted into. A piece of its
 * own behind a door: `Library.tsx` fetches it when a person picks a file or opens the box, so nobody pays for it
 * on a first load. The page names the file (vite.config.ts), so the service worker keeps it and both work with no
 * network.
 */
import {
  ShareError,
  isMapLike,
  isProposalSetLike,
  isRunBundleLike,
  parseMap,
  parseProposalSet,
  parseRunBundle,
  type Graph,
  type IssueLike,
  type OperationMap,
  type ProposalSet,
} from "@grooph/core";
import { useEffect, useState } from "react";

import { runHref } from "../doc/run.js";
import { templateRefusal, type TemplateRefusal } from "../doc/templates.js";
import { importGraph, readGraphFile } from "../store/library.js";
import { saveRun } from "../store/runs.js";

/** What the screen that holds the door gives this piece. */
export type ImportHost = {
  /** Open a graph kept on this device in the editor. */
  open: (key: string) => void;
  /**
   * The address that shows a map or a proposal set: `openRouteFor` (doc/share.ts). Handed over, not imported here:
   * imported here it would leave the piece every address loads for one of its own, and an embed would fetch one file more.
   */
  route: (doc: OperationMap | ProposalSet) => string;
  /** Say why a document was not opened; null takes the last reason away. */
  problem: (problem: { name: string; issues: IssueLike[]; what?: string } | null) => void;
  /** Offer a template file to "Yours". */
  offer: (offer: { name: string; doc: Graph; refusal: TemplateRefusal | null }) => void;
  /** Shut the paste box. */
  close: () => void;
};

const jsonOf = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** Said of a document that could not be read at all: its reader gave up before it could say why. */
const UNREADABLE = "It could not be read: it is nested far deeper than a grooph document ever is.";

/** Open a document from its text: a file's, or what was pasted. False when it was refused: the reason is then on screen. */
export async function importText(text: string, file: { name: string }, host: ImportHost): Promise<boolean> {
  try {
    return await importRead(text, file, host);
  } catch (err) {
    // A reader that ran out of room (a document nested ten thousand deep) is said, not thrown where nobody sees it.
    if (!(err instanceof RangeError)) throw err;
    host.problem({ name: file.name, issues: [], what: UNREADABLE });
    return false;
  }
}

async function importRead(text: string, file: { name: string }, host: ImportHost): Promise<boolean> {
  const json = jsonOf(text);
  if (isRunBundleLike(json)) {
    // A run (grooph runs bundle, or share --out on a run folder) is kept beside the graphs and opens in the run view.
    const parsed = parseRunBundle(json);
    if (!parsed.bundle) {
      host.problem({
        name: file.name,
        issues: parsed.issues.map((message) => ({ code: "E_SCHEMA", severity: "error" as const, message, at: [] })),
        what: "It is a run bundle grooph cannot read. Make it again with grooph runs bundle <run dir> --out <file>.",
      });
      return false;
    }
    const { record } = await saveRun(parsed.bundle);
    location.hash = runHref(record.key);
    return true;
  }
  if (isMapLike(json)) {
    // An operation map (docs/operation-map.md) opens as its picture, like its link; a map is looked at, not stored.
    const parsed = parseMap(json);
    if (!parsed.map) {
      host.problem({ name: file.name, issues: parsed.issues, what: "It is an operation map grooph cannot read." });
      return false;
    }
    location.hash = host.route(parsed.map);
    return true;
  }
  if (isProposalSetLike(json)) {
    // A proposal set (grooph share --out) opens in the compare view, like its link; nothing is stored yet.
    const parsed = parseProposalSet(JSON.parse(text));
    try {
      if (!parsed.set) throw new ShareError("not a proposal set", parsed.issues);
      location.hash = host.route(parsed.set);
      return true;
    } catch (err) {
      if (!(err instanceof ShareError)) throw err;
      host.problem({ name: file.name, issues: err.issues, what: "It is a proposal set grooph cannot show. Make a self-contained copy with grooph share --out, which carries every graph." });
      return false;
    }
  }
  const result = readGraphFile(text);
  if (!result.doc) {
    host.problem({ name: file.name, issues: result.issues });
    return false;
  }
  host.problem(null);
  if (result.doc.template) {
    // A template file (from Download template, or a registry): offer it to "Yours" rather than opening it as a graph,
    // unless it carries errors, which grooph template add refuses too.
    host.offer({ name: file.name, doc: result.doc, refusal: templateRefusal(result.doc) });
    return true;
  }
  const record = await importGraph(result.doc);
  host.open(record.key);
  return true;
}

/** What a person pasted: a grooph link, a document found somewhere in the text, or neither. */
/** A link carries its payload and, when its address named them, which candidate and which look (`rest`, as the address continues). */
export type Pasted = { kind: "link"; payload: string; rest?: string } | { kind: "document"; text: string } | { kind: "nothing" };

const jsonObject = (text: string): Record<string, unknown> | undefined => {
  try {
    const json: unknown = JSON.parse(text);
    return typeof json === "object" && json !== null && !Array.isArray(json) ? (json as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
};

/** Whether an object says it is one of grooph's documents: a graph, a proposal set, an operation map or a run. */
const isGroophDocument = (json: Record<string, unknown>): boolean => "grooph" in json || isProposalSetLike(json) || isMapLike(json) || isRunBundleLike(json);

/** The document in an object: the object itself, or its `graph` when it is a tool's reply wrapped around one. */
function documentIn(json: Record<string, unknown>): Record<string, unknown> | undefined {
  if (isGroophDocument(json)) return json;
  const inner = json["graph"];
  return typeof inner === "object" && inner !== null && !Array.isArray(inner) && isGroophDocument(inner as Record<string, unknown>) ? (inner as Record<string, unknown>) : undefined;
}

/** The text from `start` (a `{`) to the brace that closes it, strings and escapes respected; undefined when it never closes. */
function balanced(text: string, start: number): string | undefined {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i += 1;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return undefined;
}

/** How much pasted text is looked through. A grooph document is a few kilobytes; a megabyte of anything is not one. */
export const PASTE_LIMIT = 1_000_000;

/**
 * Read what was pasted the way a chat hands a document over: the JSON alone, or inside a
 * code fence, or with a sentence before and after it. A chat's reply often holds other JSON
 * too (slot values, an example of operations, a tool's reply around the graph), so the
 * object taken is the first, by where it stands in the text, that says it is a grooph
 * document: fenced or not, the earlier one. A grooph link (`…#/open?d=…`) is recognized too.
 * The document is not judged here; whatever opens a file judges it. Text over `PASTE_LIMIT`
 * is not looked through at all (`openPasted` says so).
 */
export function readPasted(input: string): Pasted {
  if (input.length > PASTE_LIMIT) return { kind: "nothing" };
  const text = input.trim();
  if (text === "") return { kind: "nothing" };

  // Every JSON object in the text, with where it starts: the whole text, what each fence holds, and each `{…}` in the
  // prose. `inside` marks one found past a brace that never closes: part of a document cut short, or text after a stray brace.
  const found: { text: string; json: Record<string, unknown>; inside: boolean; at: number }[] = [];
  const whole = jsonObject(text);
  if (whole) found.push({ text, json: whole, inside: false, at: 0 });
  else {
    for (const fence of text.matchAll(/```[A-Za-z0-9-]*[ \t]*\r?\n([\s\S]*?)```/g)) {
      const held = fence[1]!.trim();
      const json = jsonObject(held);
      if (json) found.push({ text: held, json, inside: false, at: fence.index + fence[0].indexOf(held) });
    }
    let unclosed = 0;
    let from = text.indexOf("{");
    // A brace that never closes costs a walk to the end of the text, so only a few of those are tried.
    for (let tries = 0; from !== -1 && tries < 64 && unclosed < 8; tries += 1) {
      const candidate = balanced(text, from);
      if (candidate === undefined) {
        unclosed += 1;
        from = text.indexOf("{", from + 1);
        continue;
      }
      const json = jsonObject(candidate);
      // One a fence already gave, at the same place, is not taken twice (and keeps the fence's word that it stands whole).
      if (json && !found.some((other) => other.at === from)) found.push({ text: candidate, json, inside: unclosed > 0, at: from });
      from = text.indexOf("{", from + candidate.length);
    }
    found.sort((one, other) => one.at - other.at);
  }

  for (const candidate of found) {
    const doc = documentIn(candidate.json);
    if (doc) return { kind: "document", text: doc === candidate.json ? candidate.text : JSON.stringify(doc, null, 2) };
  }
  const link = /#\/(?:open|embed)\?((?:[^#\s]*&)?d=([A-Za-z0-9_-]+)[^#\s]*)/.exec(text);
  if (link) {
    // The candidate a link opens on and the look it is drawn in travel with it; nothing else of the address does.
    const c = /(?:^|&)c=([A-Za-z0-9_%.~-]+)(?:&|$)/.exec(link[1]!)?.[1];
    const theme = /(?:^|&)theme=([a-z]+(?:-[a-z]+)?)(?:&|$)/.exec(link[1]!)?.[1];
    const rest = `${c ? `&c=${c}` : ""}${theme ? `&theme=${theme}` : ""}`;
    return { kind: "link", payload: link[2]!, ...(rest ? { rest } : {}) };
  }
  // No object says it is a grooph document. A whole object that stands on its own is still handed on, so the person is
  // told what it lacks; a piece from inside a document cut short is not, because it would be judged as if it were the whole.
  const first = found.find((candidate) => !candidate.inside);
  return first ? { kind: "document", text: first.text } : { kind: "nothing" };
}

/**
 * Open what was pasted: a link goes to its address, a document through the same path as a file. Refused, the reason
 * is shown and the box stays open with the text to be mended. `quiet` is a paste on the screen itself, with no box
 * open: text that holds neither a document nor a link is then left alone, and nothing is said.
 */
export async function openPasted(pasted: string, host: ImportHost, quiet = false): Promise<boolean> {
  const name = "what you pasted";
  if (pasted.length > PASTE_LIMIT) {
    if (!quiet) host.problem({ name, issues: [], what: "It is over a megabyte, and a grooph document is a few kilobytes. Paste the document alone." });
    return false;
  }
  try {
    const read = readPasted(pasted);
    if (read.kind === "link") {
      host.close();
      location.hash = `#/open?d=${read.payload}${read.rest ?? ""}`;
      return true;
    }
    if (read.kind === "nothing") {
      if (!quiet) {
        host.problem({
          name,
          issues: [{ code: "E_SCHEMA", severity: "error", message: "no JSON document and no grooph link was found in the text", at: [] }],
          what: "Paste the whole document, from its first { to its last }, or a link that ends in #/open?d=…",
        });
      }
      return false;
    }
    const opened = await importText(read.text, { name }, host);
    if (opened) host.close();
    return opened;
  } catch (err) {
    // A reader that ran out of room (a document nested deeper than any reader goes) is said, not thrown where nobody sees it.
    if (!(err instanceof RangeError)) throw err;
    if (!quiet) host.problem({ name, issues: [], what: UNREADABLE });
    return false;
  }
}

/** On the front page the controls sit below the fold: bring the box into view. */
const inView = (el: HTMLElement | null): void => el?.scrollIntoView({ block: "nearest" });

/** The box a document is pasted into. */
export function PasteBox({ host }: { host: ImportHost }) {
  const [text, setText] = useState("");
  // Opening the box starts again: what the last try said, that this piece could not be fetched among it, is taken away.
  useEffect(() => host.problem(null), []);
  return (
    <form
      className="offer"
      style={{ flexDirection: "column", alignItems: "stretch" }}
      ref={inView}
      onSubmit={(e) => {
        e.preventDefault();
        void openPasted(text, host);
      }}
    >
      <label className="field-label" htmlFor="paste-document" style={{ marginBottom: 0 }}>
        A graph's JSON, as a chat or an agent gave it to you, or a grooph link
      </label>
      <textarea
        id="paste-document"
        className="input textarea mono"
        rows={6}
        autoFocus
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder={'{ "grooph": 0, "id": "…", "nodes": [ … ] }'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {/* A div, not a paragraph: a paragraph in an offer box is given room to grow, which in a column is height. */}
      <div className="field-hint" style={{ margin: 0 }}>
        The code fence and the sentences around it can stay. Nothing leaves this device; the document is checked here, with the same rules as a file.
      </div>
      <div className="offer-actions">
        <button type="submit" className="btn btn-primary" disabled={text.trim() === ""}>
          Open it
        </button>
        <button type="button" className="btn btn-quiet" onClick={host.close}>
          Cancel
        </button>
      </div>
    </form>
  );
}

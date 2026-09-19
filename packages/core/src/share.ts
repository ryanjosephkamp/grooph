/**
 * Share links (docs/executive.md §2).
 *
 *   <base>#/open?d=<payload>    payload = base64url( raw DEFLATE( envelope JSON ) )
 *   envelope = { "v": 1, "kind": "graph" | "proposals", "doc": … }
 *
 * Core owns the envelope, the base64url step and every message a person sees
 * when a link will not open. Compression is a shell concern, so core keeps
 * zero dependencies (decision 0005): the CLI passes `node:zlib`, the web app
 * its zip library, both raw DEFLATE.
 *
 * A link is untrusted input. `decodeSharePayload` checks size before and after
 * unpacking, the envelope, and the document with the same schema an import
 * uses; it never trusts a `shape` it was handed.
 */

import { formatIssue, type Issue, type IssueLike } from "./issues.js";
import { parseGraph } from "./parse.js";
import {
  estimateShape,
  isCandidateFile,
  isProposalSetLike,
  parseProposalSet,
  validateProposalSet,
  type ProposalIssue,
} from "./proposals.js";
import { graphSchema } from "./schema/graph.js";
import { proposalSetSchema } from "./schema/proposals.js";
import type { Graph, ProposalSet } from "./types.js";
import { validate } from "./validate.js";

export const SHARE_VERSION = 1;

/** Where links open by default: the published app. */
export const SHARE_BASE = "https://ryanjosephkamp.github.io/grooph/";

/** Messengers cut long links; above this `grooph share` says so and points at `--out`. */
export const SHARE_LINK_WARN = 32_000;

/** A payload longer than this is refused before anything is unpacked. No real set comes near it. */
export const SHARE_PAYLOAD_MAX = 1_000_000;

/** The most a payload may unpack to. A small graph is a few kilobytes; this stops a link that unpacks without end. */
export const SHARE_JSON_MAX = 4_000_000;

export type ShareEnvelope =
  | { v: typeof SHARE_VERSION; kind: "graph"; doc: Graph }
  | { v: typeof SHARE_VERSION; kind: "proposals"; doc: ProposalSet };

export type ShareKind = ShareEnvelope["kind"];

/** Thrown by `buildShareEnvelope` when a document cannot be shared; `issues` says why. */
export class ShareError extends Error {
  readonly issues: IssueLike[];
  constructor(message: string, issues: IssueLike[] = []) {
    super(message);
    this.name = "ShareError";
    this.issues = issues;
  }
}

const withoutNotes = (graph: Graph): Graph => {
  const { notes: _notes, ...rest } = graph;
  return rest as Graph;
};

/**
 * The envelope for a graph or a proposal set, ready to encode. Validates first
 * and refuses what could not be exported: a graph with errors, a set with an
 * invalid or not-yet-inlined candidate. Run notes are dropped, layout is kept,
 * and each candidate's `shape` is computed here, whatever the input said.
 */
export function buildShareEnvelope(doc: Graph | ProposalSet): ShareEnvelope {
  if (isProposalSetLike(doc)) {
    const set = doc as ProposalSet;
    const issues = validateProposalSet(set, { requireInline: true });
    if (issues.some((i) => i.severity === "error")) {
      throw new ShareError(`proposal set "${set.id ?? "?"}" cannot be shared until these are fixed`, issues);
    }
    const candidates = set.candidates.map((c) => {
      const graph = withoutNotes(c.graph as Graph);
      return { ...c, graph, shape: estimateShape(graph) };
    });
    return { v: SHARE_VERSION, kind: "proposals", doc: proposalSetSchema.canon({ ...set, candidates }) as ProposalSet };
  }
  const graph = doc as Graph;
  const parsed = parseGraph(graph);
  if (!parsed.doc) throw new ShareError(`"${graph.id ?? "?"}" is not a graph document`, parsed.issues);
  const issues = validate(parsed.doc, { forExport: true });
  if (issues.some((i) => i.severity === "error")) {
    throw new ShareError(`graph "${graph.id}" cannot be shared until these are fixed`, issues);
  }
  return { v: SHARE_VERSION, kind: "graph", doc: graphSchema.canon(withoutNotes(parsed.doc)) as Graph };
}

/** The envelope as the compact JSON that is compressed. Canonical key order compresses better and is stable. */
export const envelopeText = (envelope: ShareEnvelope): string => JSON.stringify(envelope);

// ─── the codec seam ───────────────────────────────────────────────────────

/** Raw DEFLATE (no zlib or gzip wrapper). */
export type DeflateRaw = (bytes: Uint8Array) => Uint8Array;

/**
 * Raw INFLATE with an output cap. Must throw a `RangeError` when the output
 * would exceed `maxOutput` bytes, and may throw anything else for data that
 * does not unpack.
 */
export type InflateRaw = (bytes: Uint8Array, maxOutput: number) => Uint8Array;

export function encodeSharePayload(envelope: ShareEnvelope, deflate: DeflateRaw): string {
  return toBase64Url(deflate(new TextEncoder().encode(envelopeText(envelope))));
}

/** `<base>#/open?d=<payload>`; the base gets a trailing slash unless it names a file. */
export function shareLink(payload: string, base: string = SHARE_BASE): string {
  let root = base.split("#")[0]!;
  if (!root.endsWith("/") && !/\.html?$/i.test(root)) root = `${root}/`;
  return `${root}#/open?d=${payload}`;
}

/** The payload inside a link, a hash (`#/open?d=…`) or a bare payload; undefined when there is no `d`. */
export function sharePayloadFrom(input: string): string | undefined {
  const text = input.trim();
  const hash = text.includes("#") ? text.slice(text.indexOf("#")) : text;
  const match = /^#\/open\?(.*)$/.exec(hash);
  if (!match) return /^[A-Za-z0-9_-]+$/.test(text) ? text : undefined;
  for (const pair of match[1]!.split("&")) {
    const [key, value] = pair.split("=");
    if (key === "d") return value ?? "";
  }
  return undefined;
}

// ─── opening a link ───────────────────────────────────────────────────────

export type OpenedShare =
  | { ok: true; envelope: ShareEnvelope; issues: IssueLike[] }
  | {
      ok: false;
      /** one or two sentences a person can act on */
      message: string;
      /** issue lines, when the document itself is what failed */
      details: string[];
    };

const refuse = (message: string, details: string[] = []): OpenedShare => ({ ok: false, message, details });

const DAMAGED =
  "The link is damaged: its data does not unpack. Links cut short or re-wrapped by a messenger look like this. Ask for the link again, or for the file (grooph share --out) and import it.";

/** Undo `encodeSharePayload` and check what comes out as untrusted input. */
export function decodeSharePayload(payload: string, inflate: InflateRaw): OpenedShare {
  if (payload.length === 0) {
    return refuse("The link has nothing after d=, so there is no graph in it. It was probably cut off when it was sent.");
  }
  if (payload.length > SHARE_PAYLOAD_MAX) {
    return refuse(
      `The link carries ${payload.length.toLocaleString("en")} characters, far more than any graph needs, so it is not a grooph link. Nothing was unpacked.`,
    );
  }
  const bytes = fromBase64Url(payload);
  if (!bytes) {
    return refuse(
      "The link contains characters a grooph link never has, so part of it was changed or cut on the way. Ask for the link again, or for the file (grooph share --out).",
    );
  }
  let unpacked: Uint8Array;
  try {
    unpacked = inflate(bytes, SHARE_JSON_MAX);
  } catch (err) {
    if (err instanceof RangeError) {
      return refuse(
        `The link unpacks to more than ${SHARE_JSON_MAX / 1_000_000} MB, far more than any graph, so it is not a grooph link. It was not opened.`,
      );
    }
    return refuse(DAMAGED);
  }
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(unpacked));
  } catch {
    return refuse(DAMAGED);
  }
  return parseShareEnvelope(json);
}

/** Check a decoded envelope: version, kind, and the document inside with the same schema an import uses. */
export function parseShareEnvelope(json: unknown): OpenedShare {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return refuse("The link unpacks, but not to a grooph share, so there is nothing here to open.");
  }
  const envelope = json as Record<string, unknown>;
  const v = envelope["v"];
  if (typeof v === "number" && v > SHARE_VERSION) {
    return refuse(`The link was made by a newer grooph (share format ${v}; this app reads ${SHARE_VERSION}). Reload the app to update it, then open the link again.`);
  }
  if (v !== SHARE_VERSION) return refuse("The link unpacks, but not to a grooph share, so there is nothing here to open.");
  const kind = envelope["kind"];
  const doc = envelope["doc"];

  if (kind === "graph") {
    const parsed = parseGraph(doc);
    if (!parsed.doc) return refuse("The link holds a graph that does not match the graph document schema, so it was not opened.", lines(parsed.issues));
    const graph = withoutNotes(parsed.doc);
    return { ok: true, envelope: { v: SHARE_VERSION, kind: "graph", doc: graph }, issues: validate(graph, { forExport: true }) };
  }

  if (kind === "proposals") {
    const parsed = parseProposalSet(doc);
    if (!parsed.set) return refuse("The link holds a proposal set that does not match its schema, so it was not opened.", lines(parsed.issues));
    const issues: ProposalIssue[] = validateProposalSet(parsed.set, { requireInline: true });
    const fatal = issues.filter((i) => i.code === "E_DUPLICATE_ID" || (i.code === "E_CANDIDATE_INVALID" && candidateIsFile(parsed.set!, i.at)));
    if (fatal.length > 0) return refuse("The link holds a proposal set grooph cannot show, so it was not opened.", lines(fatal));
    // Recompute every shape: the one in the link is only a claim.
    const candidates = parsed.set.candidates.map((c) => {
      const graph = withoutNotes(c.graph as Graph);
      return { ...c, graph, shape: estimateShape(graph) };
    });
    return { ok: true, envelope: { v: SHARE_VERSION, kind: "proposals", doc: { ...parsed.set, candidates } }, issues };
  }

  return refuse(
    typeof kind === "string"
      ? `The link holds a "${kind}", which this version of grooph does not know how to show. Reload the app to update it.`
      : "The link unpacks, but not to a grooph share, so there is nothing here to open.",
  );
}

const candidateIsFile = (set: ProposalSet, at: readonly string[]): boolean =>
  set.candidates.some((c) => at.includes(c.id) && isCandidateFile(c.graph));

const lines = (issues: readonly (Issue | ProposalIssue)[]): string[] => issues.map(formatIssue);

// ─── base64url (RFC 4648 §5, no padding) ──────────────────────────────────

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const LOOKUP = new Map([...ALPHABET].map((ch, i) => [ch, i]));

export function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += ALPHABET[a >> 2]! + ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)]!;
    if (b !== undefined) out += ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)]!;
    if (c !== undefined) out += ALPHABET[c & 63]!;
  }
  return out;
}

/** Undefined when the text is not base64url (a stray character, or a length no encoding produces). */
export function fromBase64Url(text: string): Uint8Array | undefined {
  if (text.length % 4 === 1) return undefined;
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < text.length; i += 4) {
    const n: number[] = [];
    for (let j = i; j < Math.min(i + 4, text.length); j++) {
      const v = LOOKUP.get(text[j]!);
      if (v === undefined) return undefined;
      n.push(v);
    }
    out[o++] = (n[0]! << 2) | (n[1]! >> 4);
    if (n.length > 2) out[o++] = ((n[1]! & 15) << 4) | (n[2]! >> 2);
    if (n.length > 3) out[o++] = ((n[2]! & 3) << 6) | n[3]!;
  }
  return out;
}

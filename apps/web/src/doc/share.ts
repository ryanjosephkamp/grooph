/**
 * Share links in the app (docs/executive.md §2): raw DEFLATE through fflate,
 * the library the app already ships for zips. Core owns the envelope and
 * every message; this file only supplies the codec.
 */
import {
  buildShareEnvelope,
  decodeSharePayload,
  encodeSharePayload,
  type DeflateRaw,
  type Graph,
  type InflateRaw,
  type OpenedShare,
  type ProposalSet,
} from "@grooph/core";
import { deflateSync, inflateSync } from "fflate";

export const deflateRaw: DeflateRaw = (bytes) => deflateSync(bytes, { level: 9 });

/**
 * fflate truncates to the `out` buffer it is given, so a buffer one byte past
 * the cap tells "too large" apart from "fits exactly" without unpacking more.
 */
export const inflateRaw: InflateRaw = (bytes, maxOutput) => {
  const out = inflateSync(bytes, { out: new Uint8Array(maxOutput + 1) });
  if (out.length > maxOutput) throw new RangeError(`unpacks to more than ${maxOutput} bytes`);
  return out;
};

let last: { payload: string; opened: OpenedShare } | undefined;

/** Open a link's payload. The last result is kept, so moving between the compare view and a full graph does not unpack twice. */
export function openPayload(payload: string): OpenedShare {
  if (last?.payload !== payload) last = { payload, opened: decodeSharePayload(payload, inflateRaw) };
  return last.opened;
}

/** The in-app route for a document: what `grooph share` would link to, without leaving the device. */
export function openRouteFor(doc: Graph | ProposalSet): string {
  return `#/open?d=${encodeSharePayload(buildShareEnvelope(doc), deflateRaw)}`;
}

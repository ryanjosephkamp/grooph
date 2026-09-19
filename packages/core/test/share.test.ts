/**
 * Share links (docs/executive.md §2): the envelope, base64url, and every way a
 * link can fail to open. `node:zlib` stands in for the shells' codecs here;
 * the CLI and the web app each prove they read the other's output in their
 * own tests.
 */

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { deflateRawSync, inflateRawSync } from "node:zlib";

import { parseGraphText } from "../src/parse.js";
import { isCandidateFile, parseProposalSetText } from "../src/proposals.js";
import {
  SHARE_BASE,
  SHARE_JSON_MAX,
  ShareError,
  buildShareEnvelope,
  decodeSharePayload,
  encodeSharePayload,
  envelopeText,
  fromBase64Url,
  parseShareEnvelope,
  shareLink,
  sharePayloadFrom,
  toBase64Url,
  type InflateRaw,
  type ShareEnvelope,
} from "../src/share.js";
import type { Graph, ProposalSet } from "../src/types.js";
import { fixturesDir, read } from "./helpers.js";

const deflate = (bytes: Uint8Array): Uint8Array => deflateRawSync(bytes, { level: 9 });
const inflate: InflateRaw = (bytes, maxOutput) => inflateRawSync(bytes, { maxOutputLength: maxOutput });

const reviewLoop = (): Graph => parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!;

const csvSet = (): ProposalSet => {
  const path = join(fixturesDir, "proposals", "valid", "csv-export", "csv-export.grooph-proposals.json");
  const set = parseProposalSetText(read(path)).set!;
  return {
    ...set,
    candidates: set.candidates.map((c) =>
      isCandidateFile(c.graph) ? { ...c, graph: parseGraphText(read(join(dirname(path), c.graph.file))).doc! } : c,
    ),
  };
};

const opened = (payload: string) => decodeSharePayload(payload, inflate);
const payloadOf = (json: unknown): string => toBase64Url(deflate(new TextEncoder().encode(JSON.stringify(json))));

test("base64url round-trips every length and refuses what no encoder writes", () => {
  for (let n = 0; n < 40; n++) {
    const bytes = new Uint8Array(randomBytes(n));
    const text = toBase64Url(bytes);
    assert.match(text, /^[A-Za-z0-9_-]*$/);
    assert.equal(text, Buffer.from(bytes).toString("base64url"), "agrees with Node's encoder");
    assert.deepEqual(fromBase64Url(text), bytes);
  }
  assert.equal(fromBase64Url("abc+"), undefined, "standard base64 is not base64url");
  assert.equal(fromBase64Url("abcde"), undefined, "a length of 4n+1 cannot be produced");
  assert.equal(fromBase64Url("ab=c"), undefined, "no padding");
});

test("a graph envelope keeps layout, drops run notes, and round-trips", () => {
  const doc: Graph = {
    ...reviewLoop(),
    layout: { builder: { x: 10, y: 20 } },
    notes: [{ id: "n-0001", run: "r1", at: "graph", text: "run started" }],
  };
  const envelope = buildShareEnvelope(doc);
  assert.equal(envelope.kind, "graph");
  assert.equal((envelope.doc as Graph).notes, undefined);
  assert.deepEqual((envelope.doc as Graph).layout, { builder: { x: 10, y: 20 } });

  const back = opened(encodeSharePayload(envelope, deflate));
  assert.ok(back.ok);
  assert.deepEqual(back.envelope, envelope);
  assert.deepEqual(back.issues.map((i) => i.code), ["W_HOMOGENEOUS_CRITICS"], "the warnings travel with it for the view");
});

test("a graph with errors, or a document that is not one, is refused with the reasons", () => {
  const noGoal = reviewLoop();
  delete noGoal.goal;
  assert.throws(() => buildShareEnvelope(noGoal), (err: unknown) => err instanceof ShareError && err.issues.some((i) => i.code === "E_NO_GOAL"));
  const broken = { ...reviewLoop(), nodes: "none" } as unknown as Graph;
  assert.throws(() => buildShareEnvelope(broken), (err: unknown) => err instanceof ShareError && /not a graph document/.test(err.message));
});

test("a proposal set envelope needs inline graphs, computes every shape, and drops notes", () => {
  const set = csvSet();
  set.candidates[0]!.shape = { agents: 99, checks: 0, gates: 0, loops: 0, tiers: { frontier: 0, strong: 0, fast: 0, unset: 0 }, worstCaseRounds: 0, budgets: [] };
  (set.candidates[1]!.graph as Graph).notes = [{ id: "n-1", run: "r", at: "graph" }];
  const envelope = buildShareEnvelope(set);
  assert.equal(envelope.kind, "proposals");
  const doc = envelope.doc as ProposalSet;
  assert.deepEqual(doc.candidates.map((c) => c.shape?.agents), [1, 2, 3], "the made-up shape is replaced");
  assert.equal((doc.candidates[1]!.graph as Graph).notes, undefined);

  const back = opened(encodeSharePayload(envelope, deflate));
  assert.ok(back.ok);
  assert.deepEqual(back.envelope, envelope);

  const withFile = parseProposalSetText(read(join(fixturesDir, "proposals", "valid", "csv-export", "csv-export.grooph-proposals.json"))).set!;
  assert.throws(() => buildShareEnvelope(withFile), (err: unknown) => err instanceof ShareError && err.issues.every((i) => i.code === "E_CANDIDATE_INVALID"));
});

test("the three-candidate set is a short link", () => {
  const link = shareLink(encodeSharePayload(buildShareEnvelope(csvSet()), deflate));
  assert.ok(link.length < 16_000, `${link.length} characters`);
});

test("opening re-computes shapes rather than trusting the link", () => {
  const envelope = buildShareEnvelope(csvSet());
  const lying = structuredClone(envelope) as Extract<ShareEnvelope, { kind: "proposals" }>;
  lying.doc.candidates[2]!.shape!.agents = 1;
  const back = parseShareEnvelope(lying);
  assert.ok(back.ok && back.envelope.kind === "proposals");
  assert.equal(back.envelope.doc.candidates[2]!.shape!.agents, 3);
});

test("every broken link fails with a message a person can act on, and nothing unpacks unbounded", () => {
  const good = encodeSharePayload(buildShareEnvelope(reviewLoop()), deflate);
  const refused = (payload: string, pattern: RegExp): void => {
    const result = opened(payload);
    assert.equal(result.ok, false, payload.slice(0, 40));
    if (!result.ok) assert.match(result.message, pattern);
  };

  refused("", /nothing after d=.*cut off/);
  refused("x".repeat(1_000_001), /far more than any graph needs.*Nothing was unpacked/);
  refused(`${good.slice(0, 20)}+/${good.slice(22)}`, /characters a grooph link never has/);
  refused(good.slice(0, Math.floor(good.length / 2)), /damaged.*cut short/);
  refused(`${good.slice(0, 30)}AAAA${good.slice(34)}`, /damaged/);

  // A bomb: 5 MB of spaces packs into a few kilobytes and must not be unpacked in full.
  const bomb = toBase64Url(deflate(new Uint8Array(SHARE_JSON_MAX + 1_000_000).fill(32)));
  assert.ok(bomb.length < 20_000);
  refused(bomb, /unpacks to more than 4 MB/);

  refused(payloadOf(["not", "an", "envelope"]), /not to a grooph share/);
  refused(payloadOf({ v: 2, kind: "graph", doc: {} }), /newer grooph.*Reload the app/);
  refused(payloadOf({ v: 1, kind: "template", doc: {} }), /"template", which this version of grooph does not know/);

  const badGraph = opened(payloadOf({ v: 1, kind: "graph", doc: { ...reviewLoop(), nodes: [{ id: "x", kind: "wizard" }] } }));
  assert.equal(badGraph.ok, false);
  if (!badGraph.ok) {
    assert.match(badGraph.message, /does not match the graph document schema/);
    assert.match(badGraph.details[0]!, /E_SCHEMA {2}\/nodes\/0\/kind/);
  }

  const withFile = parseProposalSetText(read(join(fixturesDir, "proposals", "valid", "csv-export", "csv-export.grooph-proposals.json"))).set!;
  const fileLink = opened(payloadOf({ v: 1, kind: "proposals", doc: withFile }));
  assert.equal(fileLink.ok, false);
  if (!fileLink.ok) assert.match(fileLink.details.join("\n"), /points at lean\.grooph\.json/);
});

test("a set whose candidate has rule errors still opens, with the errors for the card to show", () => {
  const set = csvSet();
  delete (set.candidates[0]!.graph as Graph).goal;
  const back = opened(payloadOf({ v: 1, kind: "proposals", doc: set }));
  assert.ok(back.ok);
  assert.deepEqual(back.issues.map((i) => [i.code, i.at]), [["E_CANDIDATE_INVALID", ["lean"]]]);
});

test("links: the base gets its slash, and the payload comes back out of a link, a hash or on its own", () => {
  assert.equal(shareLink("abc"), `${SHARE_BASE}#/open?d=abc`);
  assert.equal(shareLink("abc", "http://localhost:4173/grooph"), "http://localhost:4173/grooph/#/open?d=abc");
  assert.equal(shareLink("abc", "http://localhost:4173/grooph/#/g/old"), "http://localhost:4173/grooph/#/open?d=abc");
  assert.equal(shareLink("abc", "file:///tmp/app/index.html"), "file:///tmp/app/index.html#/open?d=abc");

  assert.equal(sharePayloadFrom("https://x.test/grooph/#/open?d=Ab-_9"), "Ab-_9");
  assert.equal(sharePayloadFrom("#/open?v=1&d=Ab"), "Ab");
  assert.equal(sharePayloadFrom("#/open?d="), "");
  assert.equal(sharePayloadFrom("Ab-_9"), "Ab-_9");
  assert.equal(sharePayloadFrom("#/g/abc"), undefined);
  assert.equal(sharePayloadFrom("#/open?x=1"), undefined);
});

test("the envelope text is compact JSON in canonical key order", () => {
  const text = envelopeText(buildShareEnvelope(reviewLoop()));
  assert.ok(text.startsWith('{"v":1,"kind":"graph","doc":{"grooph":0,"id":"review-loop"'));
  assert.ok(!text.includes("\n"));
});

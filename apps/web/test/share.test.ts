import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  SHARE_JSON_MAX,
  buildShareEnvelope,
  decodeSharePayload,
  encodeSharePayload,
  isCandidateFile,
  parseGraphText,
  parseProposalSetText,
  sharePayloadFrom,
  toBase64Url,
  type ProposalSet,
} from "@grooph/core";
import { describe, expect, it } from "vitest";

// The CLI's codec, imported from its source: the two shells are tested against each other, not against a stand-in.
import { deflateRaw as cliDeflate, inflateRaw as cliInflate } from "../../../packages/cli/src/share-io.js";
import { deflateRaw as webDeflate, inflateRaw as webInflate, openRouteFor } from "../src/doc/share.js";
import { repoRoot, reviewLoop } from "./helpers.js";

const csvDir = join(repoRoot, "fixtures/proposals/valid/csv-export");
const csvSet = (): ProposalSet => {
  const set = parseProposalSetText(readFileSync(join(csvDir, "csv-export.grooph-proposals.json"), "utf8")).set!;
  return {
    ...set,
    candidates: set.candidates.map((c) => (isCandidateFile(c.graph) ? { ...c, graph: parseGraphText(readFileSync(join(csvDir, c.graph.file), "utf8")).doc! } : c)),
  };
};

describe("share links: the CLI and the app read each other's links", () => {
  for (const [name, doc] of [
    ["a graph", reviewLoop()],
    ["a three-candidate proposal set", csvSet()],
  ] as const) {
    it(`${name}: made by the CLI (node:zlib), opened by the app (fflate)`, () => {
      const envelope = buildShareEnvelope(doc);
      const opened = decodeSharePayload(encodeSharePayload(envelope, cliDeflate), webInflate);
      expect(opened.ok && opened.envelope).toEqual(envelope);
    });

    it(`${name}: made by the app (fflate), opened by the CLI (node:zlib)`, () => {
      const envelope = buildShareEnvelope(doc);
      const opened = decodeSharePayload(encodeSharePayload(envelope, webDeflate), cliInflate);
      expect(opened.ok && opened.envelope).toEqual(envelope);
    });
  }

  it("the app's import route is a link the CLI can open", () => {
    const payload = sharePayloadFrom(openRouteFor(csvSet()))!;
    const opened = decodeSharePayload(payload, cliInflate);
    expect(opened.ok && opened.envelope.kind).toBe("proposals");
  });

  it("a damaged link fails the same way on both sides, with a message a person can act on", () => {
    const good = encodeSharePayload(buildShareEnvelope(csvSet()), cliDeflate);
    for (const inflate of [webInflate, cliInflate]) {
      const cut = decodeSharePayload(good.slice(0, Math.floor(good.length * 0.7)), inflate);
      expect(cut.ok).toBe(false);
      if (!cut.ok) expect(cut.message).toMatch(/The link is damaged.*Ask for the link again, or for the file \(grooph share --out\)/);
    }
  });

  it("an oversized payload is stopped at the cap on both sides, not unpacked in full", () => {
    const bomb = toBase64Url(cliDeflate(new Uint8Array(SHARE_JSON_MAX * 2).fill(32)));
    for (const inflate of [webInflate, cliInflate]) {
      const opened = decodeSharePayload(bomb, inflate);
      expect(opened.ok).toBe(false);
      if (!opened.ok) expect(opened.message).toMatch(/unpacks to more than 4 MB.*It was not opened/);
    }
    // Exactly at the cap still opens as far as the codec is concerned.
    expect(webInflate(webDeflate(new Uint8Array(1000)), 1000).length).toBe(1000);
    expect(() => webInflate(webDeflate(new Uint8Array(1001)), 1000)).toThrow(RangeError);
  });
});

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

import {
  SHARE_BASE,
  SHARE_LINK_WARN,
  ShareError,
  buildShareEnvelope,
  canonicalize,
  canonicalizeProposals,
  canonicalizeRunBundle,
  encodeSharePayload,
  estimateShape,
  formatIssue,
  runStateLine,
  shapeLine,
  shareLink,
  validate,
  summarizeRun,
  validateProposalSet,
  type Graph,
  type ProposalSet,
  type RunBundle,
} from "@grooph/core";

import { writeText } from "../io.js";
import { plural, type Output } from "../print.js";
import { isRunDir, readRun } from "../run-io.js";
import { LoadError, deflateRaw, loadShareable, shown, type Loaded, type OpenUrl } from "../share-io.js";

export type ShareFlags = { base?: string; open?: boolean; out?: string };

export const SHARE_HELP = `grooph share <graph | proposal set | run dir | run bundle> [--base <url>] [--open] [--out <file>]

Turn a graph, a set of one to four candidate graphs, or a run into a link that opens it in
the grooph app on any device. The document travels in the link's #fragment, which browsers
do not send to any server; nothing is uploaded.

A run folder (.grooph/<graph-id>/runs/<run-id>/) or a *.grooph-run.json bundle opens in the
run view: what ran, what the run changed and why, its proposals, and its notes. --out then
writes the bundle, the fallback when the link is too long.

Validates first and refuses a graph, or a candidate, with errors. Inlines { "file" }
candidates, computes each candidate's shape, prints the comparison and the link with its
length, and warns when the link is over ${SHARE_LINK_WARN.toLocaleString("en")} characters (messengers cut long links).

  --base <url>   where the app is served (default ${SHARE_BASE});
                 http://localhost:4173/grooph/ for a local build
  --open         also open the link in the default browser
  --out <file>   also write the self-contained document (graphs inlined, shapes computed);
                 import it in the app when a link is too long to send

A proposal set, <set-id>.grooph-proposals.json (docs/executive.md §1):

  {
    "groophProposals": 0,
    "id": "csv-export",
    "title": "CSV export for the orders list",
    "brief": "The project and its constraints as you understood them.",
    "candidates": [
      {
        "id": "lean",
        "label": "Lean",
        "graph": { "file": "lean.grooph.json" },
        "basedOn": "grind-loop",
        "rationale": "Why this shape fits this project, in three or four sentences.",
        "pros": ["what it buys"],
        "cons": ["what it costs, and each validation warning in plain words"],
        "profile": { "cost": "low", "speed": "fast", "rigor": "light" }
      }
    ],
    "recommendation": { "candidate": "lean", "why": "One or two sentences." }
  }

  ids are kebab-case and unique; one to four candidates; labels distinct, case ignored
  (the owner picks by saying one back); "graph" is a path relative to this file's folder,
  or the graph document itself; "basedOn" and "recommendation" are optional; cost is
  low | medium | high, speed fast | medium | slow, rigor light | standard | high.
  Leave "shape" out: share computes it.`;

/**
 * `grooph share <file> [--base <url>] [--open] [--out <file>]` (docs/executive.md §2, §4).
 * Exit 0 with the link, 1 when the document cannot be shared.
 */
export async function shareCommand(io: Output, file: string, flags: ShareFlags, open: OpenUrl): Promise<number> {
  let loaded: Loaded;
  try {
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!isRunDir(file)) {
        throw new LoadError(`${file} is a folder but not a run folder; share takes a graph, a proposal set, a run folder (.grooph/<graph-id>/runs/<run-id>/) or a run bundle`);
      }
      loaded = { kind: "run", doc: readRun(file).bundle };
    } else loaded = loadShareable(file);
  } catch (err) {
    if (!(err instanceof LoadError)) throw err;
    io.err(`grooph: ${err.message}`);
    for (const line of err.lines) io.err(line);
    return 1;
  }

  let envelope;
  try {
    envelope = buildShareEnvelope(loaded.doc);
  } catch (err) {
    if (!(err instanceof ShareError)) throw err;
    io.err(`cannot share ${file}: fix these first`);
    for (const issue of err.issues) io.err(formatIssue(issue));
    return 1;
  }

  if (envelope.kind === "proposals") printSet(io, envelope.doc);
  else if (envelope.kind === "run") printRun(io, envelope.doc);
  else printGraph(io, envelope.doc);

  const link = shareLink(encodeSharePayload(envelope, deflateRaw), flags.base ?? SHARE_BASE);

  if (flags.out !== undefined) {
    if (resolve(flags.out) === resolve(file)) {
      io.err(`grooph: --out ${flags.out} is the file being shared; name another file`);
      return 1;
    }
    writeText(
      flags.out,
      envelope.kind === "proposals" ? canonicalizeProposals(envelope.doc) : envelope.kind === "run" ? canonicalizeRunBundle(envelope.doc) : canonicalize(envelope.doc),
    );
    io.out(`wrote ${shown(resolve(flags.out))} (self-contained; import it in the app, or share that file)`);
  }

  io.out("");
  io.out(`link (${link.length.toLocaleString("en")} characters):`);
  io.out(link);

  if (link.length > SHARE_LINK_WARN) {
    io.err("");
    io.err(
      `warning: the link is ${link.length.toLocaleString("en")} characters; messengers often cut links over ${SHARE_LINK_WARN.toLocaleString("en")}. ` +
        (envelope.kind === "run"
          ? "The run is too big for a link: send the bundle instead (--out <file>.grooph-run.json, or grooph runs bundle) and import it in the app."
          : "The graphs are too big for a link: shorten the briefs or drop a candidate, or send the file from --out and import it in the app."),
    );
  }

  if (flags.open === true) {
    try {
      await open(link);
      io.out("opened in the default browser");
    } catch (err) {
      io.err(`could not open a browser (${(err as Error).message}); open the link above by hand`);
    }
  }
  return 0;
}

function printRun(io: Output, bundle: RunBundle): void {
  const summary = summarizeRun(bundle.notes, bundle.working);
  io.out(`run ${bundle.run} · ${bundle.working.name} (${bundle.working.id}) · ${runStateLine(summary)}`);
  io.out(`  ${plural(bundle.notes.length, "note")} · ${plural(summary.amendments.length, "amendment")} · ${plural(summary.proposals.length, "proposal")}`);
  if (bundle.issues && bundle.issues.length > 0) io.out(`  ${plural(bundle.issues.length, "line")} of notes.jsonl could not be read; the run view lists them`);
}

function printGraph(io: Output, graph: Graph): void {
  const warnings = validate(graph, { forExport: true });
  io.out(`${graph.id} · ${graph.name}`);
  io.out(`  ${shapeLine(estimateShape(graph))}`);
  for (const w of warnings) io.out(`  ${formatIssue(w)}`);
}

function printSet(io: Output, set: ProposalSet): void {
  io.out(`${set.id} · ${set.title} · ${plural(set.candidates.length, "candidate")}`);
  const label = Math.max(...set.candidates.map((c) => c.label.length));
  const id = Math.max(...set.candidates.map((c) => c.id.length));
  for (const c of set.candidates) {
    const warnings = validate(c.graph as Graph, { forExport: true });
    const notes = [
      set.recommendation?.candidate === c.id ? "recommended" : "",
      warnings.length > 0 ? `${plural(warnings.length, "warning")}: ${[...new Set(warnings.map((w) => w.code))].join(", ")}` : "",
    ].filter(Boolean);
    io.out(`  ${c.label.padEnd(label)}  ${c.id.padEnd(id)}  ${shapeLine(c.shape!)}${notes.length > 0 ? `  (${notes.join("; ")})` : ""}`);
  }
  if (set.recommendation) io.out(`recommended: ${set.candidates.find((c) => c.id === set.recommendation!.candidate)!.label}. ${set.recommendation.why}`);
  for (const issue of validateProposalSet(set)) io.out(formatIssue(issue));
}

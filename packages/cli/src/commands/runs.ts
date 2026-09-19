import { resolve } from "node:path";

import { canonicalizeRunBundle, describePatch, diffGraphs, explainChanges, runStateLine } from "@grooph/core";

import { writeText } from "../io.js";
import { plural, type Output } from "../print.js";
import { listRuns, readRun, roundsLine, stopLine, stopWords, type LoadedRun } from "../run-io.js";
import { shown } from "../share-io.js";

export const RUNS_HELP = `grooph runs list [<dir>]
grooph runs show <run dir> [--json]
grooph runs bundle <run dir> --out <file>

Read what a run left behind in .grooph/<graph-id>/runs/<run-id>/: its notes, its working
copy and its progress log (docs/runs.md). grooph reads these files; it never runs anything.

  list     Runs under <dir> (a project, a .grooph folder or a graph folder; default: here),
           newest first: run id, graph, state, loop rounds, and the last stop check.
  show     One run: state, each node and loop, what the run changed in its working copy
           and which amendment says why, proposals, and the timeline. --json for all of it.
  bundle   Write the run as one self-contained file (*.grooph-run.json) to import in the
           app, or to share when a link is too long.

Related: grooph adopt <run dir> (take the working copy as the next version),
grooph share <run dir> (a link to the run view), grooph watch (a live view).`;

/** `grooph runs list [<dir>]`. */
export function runsListCommand(io: Output, dir: string): number {
  const runs = listRuns(dir);
  if (runs.length === 0) {
    io.out(`no runs under ${shown(resolve(dir))}; a run writes .grooph/<graph-id>/runs/<run-id>/ when it starts`);
    return 0;
  }
  const rows = runs.map((r) =>
    r.loaded
      ? [r.loaded.runId, r.loaded.working.id, runStateLine(r.loaded.summary), roundsLine(r.loaded), stopLine(r.loaded)]
      : [shown(r.runDir), "?", "unreadable", "", r.problem ?? ""],
  );
  const head = ["RUN", "GRAPH", "STATE", "ROUNDS", "STOP"];
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i]!.length)));
  const line = (cells: string[]) => cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]!))).join("   ").trimEnd();
  io.out(line(head));
  for (const row of rows) io.out(line(row));
  return 0;
}

const clip = (text: string, max = 110): string => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

/** The changes a run made to its working copy, each with the amendment that says why. */
export function printChanges(io: Output, run: LoadedRun, indent = "  "): void {
  const diff = diffGraphs(run.source, run.working);
  if (run.source.version !== run.working.version) {
    io.out(
      `${indent}note: the source is version ${run.source.version}, but this run worked on version ${run.working.version}; the source changed after the run started, so these are the differences from the source as it is now`,
    );
  }
  if (diff.changes.length === 0) {
    io.out(`${indent}none: the working copy is the source (layout and notes aside)`);
    return;
  }
  const why = explainChanges(diff.changes, run.summary.amendments);
  diff.changes.forEach((change, i) => {
    const notes = why[i]!;
    io.out(`${indent}${change.line}${notes.length > 0 ? `  ← ${notes.join(", ")}` : "  ← no amendment note explains this"}`);
  });
  if (!diff.exact) io.out(`${indent}(not every change is a grooph op; adopting takes the working copy itself)`);
}

function printRun(io: Output, run: LoadedRun): void {
  const s = run.summary;
  io.out(`Run ${run.runId} · ${run.working.name} (${run.working.id})`);
  io.out(`  ${[runStateLine(s), s.started ? `started ${s.started}` : "", s.ended ? `ended ${s.ended}` : ""].filter(Boolean).join(" · ")}`);
  const cost = Object.entries(s.cost).map(([measure, amount]) => `${amount} ${measure}`);
  if (cost.length > 0) io.out(`  cost noted: ${cost.join(" · ")}`);
  io.out(`  folder: ${shown(run.runDir)}`);

  io.out("");
  io.out("Nodes");
  const width = Math.max(...run.working.nodes.map((n) => n.id.length), 4);
  for (const node of run.working.nodes) {
    const n = s.nodes[node.id]!;
    const facts = [
      n.runs > 0 ? plural(n.runs, "run") : "",
      n.round !== undefined ? `round ${n.round}` : "",
      n.lastOutcome ? `last ${n.lastOutcome}${n.lastVerdict && n.lastVerdict !== n.lastOutcome ? ` (${n.lastVerdict})` : ""}` : "",
    ].filter(Boolean);
    io.out(`  ${node.id.padEnd(width)}  ${n.state.padEnd(7)}  ${facts.join(" · ")}`.trimEnd());
  }

  if (run.working.loops.length > 0) {
    io.out("");
    io.out("Loops");
    for (const loop of run.working.loops) {
      const l = s.loops[loop.id]!;
      const stop = l.lastStop ? (l.lastStop.fired ? `${stopWords(l.lastStop.fired)} fired` : l.lastStop.outcome === "fail" ? "went round again" : `last pass ${l.lastStop.outcome ?? "noted"}`) : "";
      io.out(`  ${loop.id}  ${l.round === null ? "not entered" : `round ${l.round}`}${stop ? ` · ${stop} (${l.lastStop!.note})` : ""}`);
    }
  }

  io.out("");
  io.out("What the run changed");
  printChanges(io, run);

  if (s.amendments.length > 0) {
    io.out("");
    io.out("Amendments");
    for (const n of s.amendments) {
      io.out(`  ${n.id} · ${n.at} · ${clip(n.amendment!.summary)}`);
      io.out(`    why: ${clip(n.amendment!.reason)}`);
    }
  }
  if (s.proposals.length > 0) {
    io.out("");
    io.out("Proposals (nothing is applied without you)");
    for (const n of s.proposals) {
      io.out(`  ${n.id} · ${n.at} · ${clip(n.proposal!.summary)}`);
      const patch = describePatch(n.proposal!.patch);
      io.out(
        `    patch: ${
          patch.kind === "ops" ? `${plural(patch.ops.length, "grooph op")} (${patch.ops.map((op) => op.op).join(", ")}); grooph apply can replay it` : patch.kind === "none" ? "none" : clip(patch.why, 160)
        }`,
      );
    }
  }

  io.out("");
  io.out("Timeline");
  for (const n of s.timeline) {
    const bits = [
      n.round !== undefined ? `r${n.round}` : "",
      n.outcome ? `${n.outcome}${n.verdict && n.verdict !== n.outcome ? ` (${n.verdict})` : ""}` : "",
      n.amendment ? "amendment" : "",
      n.proposal ? "proposal" : "",
      n.text ? clip(n.text, 90) : n.amendment ? clip(n.amendment.summary, 90) : n.proposal ? clip(n.proposal.summary, 90) : "",
    ].filter(Boolean);
    io.out(`  ${n.id}  ${n.at.padEnd(22)}  ${bits.join(" · ")}`.trimEnd());
  }

  if (run.bundle.issues && run.bundle.issues.length > 0) {
    io.out("");
    io.out(`Lines of notes.jsonl that could not be read (${run.bundle.issues.length})`);
    for (const issue of run.bundle.issues) io.out(`  line ${issue.line}: ${issue.message}`);
  }
}

/** `grooph runs show <run dir> [--json]`. */
export function runsShowCommand(io: Output, dir: string, flags: { json: boolean }): number {
  const run = readRun(dir);
  if (flags.json) {
    const diff = diffGraphs(run.source, run.working);
    io.out(
      JSON.stringify(
        {
          run: run.runId,
          graph: run.working.id,
          folder: shown(run.runDir),
          sourceVersion: run.source.version,
          workingVersion: run.working.version,
          summary: run.summary,
          changes: diff.changes.map((c, i) => ({ ...c, explainedBy: explainChanges(diff.changes, run.summary.amendments)[i] })),
          exact: diff.exact,
          issues: run.bundle.issues ?? [],
        },
        null,
        2,
      ),
    );
    return 0;
  }
  printRun(io, run);
  return 0;
}

/** `grooph runs bundle <run dir> --out <file>`. */
export function runsBundleCommand(io: Output, dir: string, out: string): number {
  const run = readRun(dir);
  const text = canonicalizeRunBundle(run.bundle);
  writeText(out, text);
  io.out(`wrote ${shown(resolve(out))} (run ${run.runId}, ${plural(run.bundle.notes.length, "note")}, ${Math.ceil(text.length / 1024)} KB); import it in the app, or share it`);
  return 0;
}

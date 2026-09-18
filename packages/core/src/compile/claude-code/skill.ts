/**
 * `.claude/skills/<graph-id>/SKILL.md` — `/<graph-id>` starts or resumes a run.
 * Frontmatter per `docs/targets/claude-code.md` § "Unit mapping".
 */

import { code, doc, lines, quoteYaml } from "../markdown.js";
import type { PackageContext } from "./context.js";

export function skillFile(ctx: PackageContext): string {
  return doc(
    lines(
      "---",
      `name: ${ctx.graphId}`,
      `description: ${quoteYaml(
        `Start or resume a grooph run of the ${ctx.graphId} graph (${ctx.doc.name}). Invoked by the human, never on its own.`,
      )}`,
      "disable-model-invocation: true",
      "argument-hint: [run-id to resume]",
      "---",
    ),
    lines(
      `# ${ctx.doc.name}`,
      "",
      `Read ${code(ctx.paths.lead)} now and follow it. You are the lead for this run: dispatch the graph's nodes, follow its edges, count rounds, evaluate stops, and keep ${code(
        `${ctx.paths.runs}/<run-id>/`,
      )} current.`,
    ),
    lines(
      "- No argument: start a new run and choose a run id.",
      `- An argument: resume that run id — read its ${code("PROGRESS.md")}, continue where it stopped, keep appending to the same ${code(
        "notes.jsonl",
      )}.`,
    ),
    lines(
      `The graph document is ${code(ctx.paths.graph)} and the mapping from graph to files is ${code(
        ctx.paths.mapping,
      )}. Do not edit either during a run.`,
    ),
  );
}

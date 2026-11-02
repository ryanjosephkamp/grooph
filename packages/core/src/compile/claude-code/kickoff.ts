/**
 * `KICKOFF.md` — the one prompt that starts a run when the skill is not loaded,
 * and the text the headless acceptance run passes to `claude -p`.
 */

import { entryNodeIds } from "../../semantics.js";
import { code, doc, lines } from "../markdown.js";
import type { PackageContext } from "./context.js";

/** One line on how far the graph may bend in this run (graph-ir §2, `LEAD.md` §9). */
function adaptationLine(ctx: PackageContext): string {
  switch (ctx.adaptation) {
    case "adaptive":
      return `- When the work shows the graph is wrong, amend the working copy as ${code(
        "LEAD.md",
      )} § "Adapting the graph" says: visibly, with a note, and never loosening a brake. Never write the source document.`;
    case "propose":
      return `- When the graph looks wrong, record a proposal note (${code("LEAD.md")} § "Adapting the graph") and change nothing.`;
    case "fixed":
      return `- Follow the graph exactly; when you cannot, halt and ask (${code("LEAD.md")} § "Adapting the graph").`;
  }
}

export function kickoff(ctx: PackageContext): string {
  const entries = entryNodeIds(ctx.index);
  const dispatchable = ctx.agents.map((agent) => code(agent.agentName)).join(", ");

  return doc(
    lines(
      `Run the grooph graph ${code(ctx.graphId)} (${ctx.doc.name}) in this project. You are the lead.`,
      "",
      `Read ${code(ctx.paths.lead)} first and follow it${
        ctx.adaptation === "fixed" ? " exactly" : ""
      }. It is the brief for this run; this prompt is only the trigger.`,
    ),
    lines("**Goal.**", "", ctx.doc.goal ?? "(the graph states no goal)"),
    lines(
      "**Before you touch anything:**",
      "",
      `1. Read a run id from the clock (${code("date -u +%Y%m%d-%H%M%S")}, the form ${code(ctx.profile.runIdFormat)}), create ${code(
        `${ctx.paths.runs}/<run-id>/`,
      )}, and copy ${code(ctx.paths.graph)} into it: that copy is the run's working copy.`,
      `2. Write ${code("PROGRESS.md")} and start ${code("notes.jsonl")} there, as ${code(
        "LEAD.md",
      )} § "Run setup" and § "Progress and notes" describe. Append a note for every node run and every loop round — that file is the record of the run.`,
      `3. Start at ${entries.map(code).join(", ") || "the first node"}.`,
    ),
    lines(
      "**While you run:**",
      "",
      `- Dispatch each agent node as its own subagent with the ${code("Agent")} tool: ${
        dispatchable || "(this graph has no agent nodes)"
      }. Do not do their work yourself, and do not grade work a critic node is there to grade.`,
      `- Give a fresh worker only its task, its declared inputs and the evidence its edge lists. Never paste a transcript into one.`,
      `- Run commands bare, from the project root, and tell each worker to do the same: under a narrow allowlist a compound form (${code(
        "cd … && …",
      )}) or ${code("git -C <path>")} is refused, and every refusal costs a turn.`,
      `- Evaluate the loop stops before every round, in the order ${code("LEAD.md")} lists them, and record the round.`,
      `- At a human gate: append the halt note first, then ask, then end your turn (${code(
        "LEAD.md",
      )} § "Human gates"). A run nobody answers ends there, and the same run id resumes it.`,
      adaptationLine(ctx),
    ),
    `**When the run ends** — a stop fires, you reach a stop node, or no edge is left to take — append the final note, write the last ${code(
      "PROGRESS.md",
    )}, and reply with the run id, the number of rounds, which stop ended the run, and anything left over.`,
  );
}

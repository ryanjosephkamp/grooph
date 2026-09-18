import { canonicalize } from "../../canonicalize.js";
import type { Issue } from "../../issues.js";
import type { Graph } from "../../types.js";
import { agentFile } from "./agents.js";
import { buildContext } from "./context.js";
import { kickoff } from "./kickoff.js";
import { leadBrief } from "./lead.js";
import { mappingNotes } from "./mapping.js";
import { skillFile } from "./skill.js";

export type ClaudeCodePackage = { files: Record<string, string>; kickoff: string };

/**
 * Emit the Claude Code package for a graph that has already passed
 * `validate(doc, { forExport: true })`. Layout per `docs/targets/claude-code.md`
 * § "Package layout (files mode)". `runs/` is created at run time, not here.
 */
export function compileClaudeCode(doc: Graph, warnings: Issue[]): ClaudeCodePackage {
  const ctx = buildContext(doc);
  const kickoffText = kickoff(ctx);

  const files: Record<string, string> = {
    [ctx.paths.graph]: canonicalize(doc),
    [ctx.paths.lead]: leadBrief(ctx, warnings),
    [ctx.paths.mapping]: mappingNotes(ctx),
    [ctx.paths.kickoff]: kickoffText,
    [ctx.paths.skill]: skillFile(ctx),
  };
  for (const agent of ctx.agents) files[agent.file] = agentFile(ctx, agent);

  // Stable path order, so a diff of two packages reads the same way twice.
  const ordered: Record<string, string> = {};
  for (const path of Object.keys(files).sort()) ordered[path] = files[path]!;

  return { files: ordered, kickoff: kickoffText };
}

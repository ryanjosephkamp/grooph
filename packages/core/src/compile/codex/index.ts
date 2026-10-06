import { canonicalize } from "../../canonicalize.js";
import type { Issue } from "../../issues.js";
import type { Graph } from "../../types.js";
import type { CompileOptions } from "../index.js";
import { agentFile } from "./agents.js";
import { buildContext } from "./context.js";
import { kickoff } from "./kickoff.js";
import { leadBrief } from "./lead.js";
import { mappingNotes } from "./mapping.js";

/** Pure export: Codex discovers agent definitions from the project; the owner starts the session. */
export function compileCodex(doc: Graph, warnings: Issue[], options: CompileOptions = {}): {
  files: Record<string, string>; kickoff: string;
} {
  const ctx = buildContext(doc, options);
  const trigger = kickoff(ctx);
  const files: Record<string, string> = {
    [ctx.paths.graph]: canonicalize(doc),
    [ctx.paths.lead]: leadBrief(ctx, warnings),
    [ctx.paths.mapping]: mappingNotes(ctx),
    [ctx.paths.kickoff]: trigger,
  };
  for (const agent of ctx.agents) files[agent.file] = agentFile(ctx, agent);
  return { files: Object.fromEntries(Object.keys(files).sort().map((path) => [path, files[path]!])), kickoff: trigger };
}

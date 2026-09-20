/**
 * `MAPPING.md` — which file is which graph piece, and how to hand-adjust
 * without re-running the compiler (`docs/targets/claude-code.md`).
 */

import { loopMode } from "../../semantics.js";
import { cell, code, doc, fence, lines, table } from "../markdown.js";
import type { PackageContext } from "./context.js";

export function mappingNotes(ctx: PackageContext): string {
  const rows: string[][] = [
    [`graph ${code(ctx.graphId)}`, code(ctx.paths.graph), "the source document in canonical form; the only thing grooph reads back"],
    ["lead brief", code(ctx.paths.lead), "goal, nodes, edges, loops, gates, progress contract, warnings"],
    ["kickoff", code(ctx.paths.kickoff), "the prompt to paste when the skill is not loaded"],
    ["kickoff (skill)", code(ctx.paths.skill), `${code(`/${ctx.graphId}`)} starts or resumes a run`],
    ["mapping notes", code(ctx.paths.mapping), "this file"],
    ["progress", code(`${ctx.paths.runs}/<run-id>/PROGRESS.md`), "written at run time, after every node"],
    ["run notes", code(`${ctx.paths.runs}/<run-id>/notes.jsonl`), "written at run time, one JSON object per line (graph-ir §6)"],
    [
      "working copy",
      code(ctx.paths.workingCopy),
      ctx.adaptation === "adaptive"
        ? "copied from the source at run setup; the lead amends it, with a note per amendment, when the work shows the graph is wrong"
        : `copied from the source at run setup; left unchanged (${ctx.adaptation})`,
    ],
    ...ctx.agents.map((agent) => [
      `node ${code(agent.node.id)}`,
      code(agent.file),
      `subagent ${code(agent.agentName)} · ${agent.role} · model ${agent.model ?? "session default"} · effort ${
        agent.effort ?? "session default"
      }`,
    ]),
  ];

  const unmapped = (ctx.doc.nodes ?? []).filter((node) => node.kind !== "agent");

  return doc(
    lines(
      `# Mapping notes · ${ctx.doc.name}`,
      "",
      `How this package's files correspond to the graph document, so a human can hand-adjust without re-running grooph. Target profile: Claude Code, verified against ${code(
        ctx.profile.verifiedAgainst,
      )} on ${ctx.profile.verifiedOn}.`,
    ),
    lines("## Graph piece → file", "", table(["graph piece", "file", "what it carries"], rows)),
    lines(
      "## Pieces with no file of their own",
      "",
      ...(unmapped.length > 0
        ? [
            "These live inside `LEAD.md`, because the lead performs them itself:",
            "",
            ...unmapped.map(
              (node) =>
                `- ${code(node.id)} (${node.kind}) — ${
                  node.kind === "check"
                    ? "the lead runs the check and judges the stated condition"
                    : node.kind === "human-gate"
                      ? "the lead asks the human and waits"
                      : node.kind === "merge"
                        ? "the lead merges the listed artifacts"
                        : "the lead ends the run here"
                }`,
            ),
          ]
        : ["Every node in this graph is an agent node with its own file."]),
      "",
      `Edges, loops and policies have no file: they are the routing, round and stop rules in ${code(
        "LEAD.md",
      )} §5–§7. ${
        (ctx.doc.policies ?? []).length > 0
          ? `Policies in force: ${(ctx.doc.policies ?? [])
              .map((policy) => `${code(policy.id)} (${typeof policy.kind === "string" ? policy.kind : policy.kind.custom}, scope ${policy.scope})`)
              .join(", ")}.`
          : "This graph declares no policies."
      }`,
    ),
    lines(
      "## The three things people hand-edit",
      "",
      "**A node's model or effort.** Change the frontmatter of its agent file:",
      "",
      fence(
        lines(
          `# ${ctx.agents[0]?.file ?? ".claude/agents/<graph-id>--<node-id>.md"}`,
          `model: ${ctx.agents[0]?.model ?? "opus"}      # profile: frontier → ${ctx.profile.models.frontier}, strong → ${ctx.profile.models.strong}, fast → ${ctx.profile.models.fast}`,
          `effort: ${ctx.agents[0]?.effort ?? "high"}      # low | medium | high | max`,
        ),
        "yaml",
      ),
      "",
      `The durable place for that change is ${code("model.tier")} or ${code(
        "effort",
      )} on the node in the graph document; edit the file only for a one-off run, because the next export overwrites it.`,
      "",
      `**A node's tools.** The ${code("tools:")} line of the same frontmatter (and ${code(
        "disallowedTools:",
      )}), which is the node's ${code("allow")} (and ${code("deny")}) through this table:`,
      "",
      table(
        ["capability", "tools"],
        Object.entries(ctx.profile.capabilityTools).map(([capability, tools]) => [code(capability), tools.map(code).join(", ")]),
      ),
      "",
      `The durable place is ${code("allow")} or ${code("deny")} on the node in the graph document.${
        ctx.adaptation === "adaptive"
          ? ` A running lead edits ${code("tools:")} itself when it amends a node's capabilities (${code(
              ctx.paths.lead,
            )} §9); Claude Code reads the edited file at the node's next dispatch, without a restart.`
          : ""
      }`,
      "",
      "**A loop's stop values.** The numbers a run actually bumps into:",
      "",
      ...(ctx.doc.loops ?? []).map((loop) =>
        lines(
          `- ${code(loop.id)} (${loopMode(ctx.index, loop)}): ${
            (loop.stops ?? [])
              .map((stop) =>
                stop.kind === "max-iterations"
                  ? `${code(`max-iterations n=${stop.n}`)}`
                  : stop.kind === "budget"
                    ? `${code(`budget ${stop.limit} ${stop.measure}`)}`
                    : code(stop.kind),
              )
              .join(", ") || "no stops declared"
          } — edit them in ${code(`${ctx.paths.lead}`)} §6 for this run, or in the graph document to keep them.`,
        ),
      ),
    ),
    lines(
      "## Rules this package relies on",
      "",
      `- The subagent files must sit in ${code(".claude/agents/")} of the project the session runs in; the package is discovered from the project directory, not from a flag.`,
      `- Subagent names cannot contain a colon, which is why they read ${code("<graph-id>--<node-id>")}.`,
      `- ${cell("A `dispatches` budget is exact: the lead counts node dispatches in `PROGRESS.md`. `usd`, `turns` and `tokens` budgets are advisory inside a session; a `usd` budget is enforced only from outside, by starting a headless run with `--max-budget-usd`.")}`,
      `- ${cell("Commands run bare from the project root: an allowlist matches a command's prefix, so a compound form (`cd … && …`) or `git -C <path>` is refused under a narrow allowlist and costs a turn each time.")}`,
      `- A run never writes ${code(ctx.paths.graph)}. Adopt a run's working copy as the next version of the graph, or discard it; either way that is a human decision after the run.`,
      `- Nothing here executes the graph. grooph compiles; the session is the runtime.`,
    ),
  );
}

/**
 * `LEAD.md` — the lead brief. Section order is fixed by
 * `docs/targets/claude-code.md` § "Lead brief structure".
 */

import { formatIssue, type Issue } from "../../issues.js";
import {
  describeStop,
  edgeIsolation,
  edgeWhenLabel,
  entryNodeIds,
  inspectableEvidence,
  loopMode,
  stopAction,
} from "../../semantics.js";
import type { Edge, Graph, Loop, Node } from "../../types.js";
import { bullet, cell, code, doc, fence, lines, table } from "../markdown.js";
import type { PackageContext } from "./context.js";

export function leadBrief(ctx: PackageContext, warnings: Issue[]): string {
  return doc(
    header(ctx),
    sectionOne(ctx),
    sectionTwo(ctx),
    sectionThree(ctx),
    sectionFour(ctx),
    sectionFive(ctx),
    sectionSix(ctx),
    sectionSeven(ctx),
    sectionEight(ctx),
    sectionNine(warnings),
    sectionTen(ctx),
  );
}

const header = (ctx: PackageContext): string =>
  lines(
    `# Lead brief · ${ctx.doc.name}`,
    "",
    `Graph ${code(ctx.graphId)} v${ctx.doc.version} · target ${code("claude-code")} · compiled by grooph from ${code(
      ctx.paths.graph,
    )}.`,
    "",
    "This file is generated. Edit the graph document and export again, or hand-edit and record what you changed — the next export overwrites it.",
  );

function sectionOne(ctx: PackageContext): string {
  const own = ctx.leadNode?.brief.trim();
  return lines(
    "## 1. You are the lead",
    "",
    own ??
      lines(
        "You run this graph. The main session is the executive: you dispatch nodes, follow edges, count rounds, evaluate stops, keep the progress log, and stop for the human when the graph says to.",
        "",
        "You do not do the workers' jobs. Every agent node below runs as its own subagent through the `Agent` tool, and sees only its brief, its declared inputs and the evidence its inbound edge allows. You never grade your own work while a critic node exists: the critic's verdict is the one that counts, and you do not overrule it by re-reading the diff yourself.",
      ),
  );
}

function sectionTwo(ctx: PackageContext): string {
  const constraints = ctx.doc.constraints ?? {};
  const rows: string[] = [];
  if (constraints.budget) rows.push(bullet(`**Budget.** ${constraints.budget}`));
  if (constraints.time) rows.push(bullet(`**Time.** ${constraints.time}`));
  if (constraints.other) rows.push(bullet(`**Other.** ${constraints.other}`));

  return lines(
    "## 2. Goal and constraints",
    "",
    "**Goal.**",
    "",
    ctx.doc.goal ?? "(none stated)",
    ...(rows.length > 0 ? ["", "**Constraints.**", "", ...rows] : []),
    ...(ctx.doc.description ? ["", "**What this graph does.**", "", ctx.doc.description] : []),
  );
}

function sectionThree(ctx: PackageContext): string {
  const firstNote = JSON.stringify({
    id: "n-0001",
    run: "<run-id>",
    at: "graph",
    started: "<iso-timestamp>",
    text: "run started",
  });
  return lines(
    "## 3. Run setup",
    "",
    `1. Choose a run id in the form ${code(ctx.profile.runIdFormat)} — the current local date and time, then four random lowercase characters, for example ${code(
      "20260917-0930-a1b2",
    )}.`,
    `2. Create ${code(`${ctx.paths.runs}/<run-id>/`)}.`,
    `3. Write ${code("PROGRESS.md")} there before dispatching anything: the run id, the goal, every node with status ${code(
      "pending",
    )}, and the round counter at 0.`,
    `4. Create ${code("notes.jsonl")} beside it and append the first line:`,
    "",
    fence(firstNote, "json"),
    "",
    `5. If you were given a run id to resume, do not start a second run: read that folder's ${code(
      "PROGRESS.md",
    )}, continue from the last recorded position, and keep appending to the same ${code("notes.jsonl")}.`,
    "",
    `Entry nodes (start here): ${entryNodeIds(ctx.index).map(code).join(", ") || "none — the graph has no entry node"}.`,
  );
}

function sectionFour(ctx: PackageContext): string {
  const rows = (ctx.doc.nodes ?? []).map((node) => [
    code(node.id),
    cell(node.name),
    dispatchFor(ctx, node),
    cell(roleCell(node)),
    cell(returnsFor(node)),
  ]);
  return lines(
    "## 4. Nodes",
    "",
    table(["node", "name", "how you run it", "role", "what it returns"], rows),
    "",
    `Dispatch an agent node with the ${code("Agent")} tool and the ${code(
      "subagent_type",
    )} named above; its file under ${code(".claude/agents/")} carries the full brief, so your prompt carries only the task, the declared inputs and the edge's evidence. Never paste a transcript into a fresh worker.`,
  );
}

function dispatchFor(ctx: PackageContext, node: Node): string {
  const agent = ctx.agentByNode.get(node.id);
  if (agent) return `${code("Agent")} · ${code(agent.agentName)}`;
  switch (node.kind) {
    case "agent":
      return "you — this is the lead node";
    case "human-gate":
      return "you ask the human";
    case "check":
      return node.check.run ? `you run ${code(node.check.run)}` : "you judge the stated condition";
    case "merge":
      return "you merge the listed artifacts";
    case "stop":
      return "you end the run";
    default:
      return "you";
  }
}

const roleCell = (node: Node): string => {
  if (node.kind !== "agent") return node.kind;
  return typeof node.role === "string" ? node.role : `custom: ${node.role.custom}`;
};

function returnsFor(node: Node): string {
  switch (node.kind) {
    case "agent":
      return node.outputs.join("; ");
    case "human-gate":
      return node.options && node.options.length > 0 ? node.options.join(" | ") : "a human answer";
    case "check":
      return `pass when: ${node.check.pass}`;
    case "merge":
      return `merged: ${node.merges.join(", ")}`;
    case "stop":
      return `run ends with outcome ${node.outcome ?? "success"}`;
    default:
      return "";
  }
}

function sectionFive(ctx: PackageContext): string {
  const edges = ctx.doc.edges ?? [];
  const rows = edges.map((edge) => [
    code(edge.id),
    `${code(edge.from)} → ${code(edge.to)}`,
    cell(edgeWhenLabel(edge)),
    edgeIsolation(edge),
    cell(edgeExtras(edge)),
  ]);
  return lines(
    "## 5. Edges",
    "",
    table(["edge", "route", "taken when", "isolation", "evidence and gates"], rows),
    "",
    bullet(
      `When a node finishes, take every outgoing edge whose condition matches its result. Several matching edges run in parallel, capped by any ${code(
        "concurrency",
      )} on the edge.`,
    ),
    bullet(
      `${code("fresh")} isolation: the worker starts with no context except its brief, its declared inputs and the evidence listed above. ${code(
        "shared",
      )}: continue the same worker if the build lets you, otherwise do that step yourself rather than faking a continuation.`,
    ),
    bullet(
      `A worker may inspect only what its inbound edge lists plus its own declared inputs. A critic that cannot read its evidence reports ${code(
        "invalid-evidence",
      )} instead of guessing, and that round counts toward an ${code("evidence-invalid")} stop.`,
    ),
  );
}

function edgeExtras(edge: Edge): string {
  const parts: string[] = [];
  if (edge.evidence && edge.evidence.length > 0) parts.push(`evidence: ${edge.evidence.join("; ")}`);
  else parts.push("evidence: none listed");
  if (edge.approval) parts.push("**human approval required before traversal**");
  if (edge.concurrency) parts.push(`concurrency max ${edge.concurrency.max}`);
  if (edge.retry) parts.push(`retry max ${edge.retry.max}`);
  if (edge.label) parts.push(`label: ${edge.label}`);
  return parts.join(" · ");
}

function sectionSix(ctx: PackageContext): string {
  const loops = ctx.doc.loops ?? [];
  if (loops.length === 0) {
    return lines("## 6. Loops", "", "This graph has no loops. Follow the edges once and stop.");
  }
  return lines("## 6. Loops", "", loops.map((loop) => loopSection(ctx, loop).replace(/\n+$/, "")).join("\n\n"));
}

function loopSection(ctx: PackageContext, loop: Loop): string {
  const mode = loopMode(ctx.index, loop);
  const backEdges = (loop.back ?? [])
    .map((id) => ctx.index.edges.get(id))
    .filter((edge): edge is Edge => edge !== undefined);
  const inspects = inspectableEvidence(ctx.index, loop.bar);
  const advisory = (loop.stops ?? []).filter(
    (stop) => stop.kind === "budget" && ctx.profile.advisoryBudgetMeasures.includes(stop.measure),
  );

  return lines(
    `### Loop ${code(loop.id)} · ${loop.name}`,
    "",
    bullet(`**Mode.** ${mode}${loop.mode ? "" : " (inferred: not every back edge starts at a check node)"}`),
    bullet(`**Members.** ${(loop.members ?? []).map(code).join(", ")}`),
    bullet(
      `**A round is** one traversal of a back edge: ${
        backEdges.map((edge) => `${code(edge.id)} (${edge.from} → ${edge.to})`).join(", ") || "none declared"
      }. Increment the round counter in ${code("PROGRESS.md")} when you take one.`,
    ),
    "",
    ...(loop.bar
      ? [
          `**Bar — ${loop.bar.name}.** Stop when: ${loop.bar.acceptance}`,
          "",
          ...(loop.bar.aspiration
            ? [
                `Aspiration (direction, never the stop condition): ${loop.bar.aspiration}`,
                "",
              ]
            : []),
          ...(loop.bar.answerKeyFrom
            ? [`The answer key is the output of node ${code(loop.bar.answerKeyFrom)}.`, ""]
            : []),
          "The critic inspects exactly these:",
          "",
          ...inspects.map((entry) =>
            bullet(`${entry.kind}: ${code(entry.ref)}${entry.note ? ` — ${entry.note}` : ""}`),
          ),
          "",
        ]
      : ["**Bar.** none declared.", ""]),
    "**Stops, evaluated in this order before every round; the first that fires wins:**",
    "",
    table(
      ["#", "stop", "what you do"],
      (loop.stops ?? []).map((stop, i) => [String(i + 1), cell(describeStop(stop)), cell(stopAction(stop))]),
    ),
    ...(advisory.length > 0
      ? [
          "",
          `> Claude Code has no documented session-level cost cap, so ${advisory
            .map((stop) => code(`${stop.kind === "budget" ? stop.measure : ""}`))
            .join(", ")} budgets here are **advisory**: track the figure in ${code(
            "PROGRESS.md",
          )} yourself and halt when you pass it.`,
        ]
      : []),
    "",
  );
}

function sectionSeven(ctx: PackageContext): string {
  const gates = (ctx.doc.nodes ?? []).filter((node) => node.kind === "human-gate");
  const approvalEdges = (ctx.doc.edges ?? []).filter((edge) => edge.approval === true);

  const entries = [
    ...gates.map((node) =>
      bullet(
        `${code(node.id)} — ${node.kind === "human-gate" ? node.prompt : ""}${
          node.kind === "human-gate" && node.options && node.options.length > 0
            ? ` (options: ${node.options.join(" | ")})`
            : ""
        }`,
      ),
    ),
    ...approvalEdges.map((edge) =>
      bullet(`${code(edge.id)} — approval required before ${edge.from} → ${edge.to} is traversed`),
    ),
  ];

  return lines(
    "## 7. Human gates",
    "",
    ...(entries.length > 0 ? entries : [bullet("None in this graph.")]),
    "",
    `Ask with ${code(
      "AskUserQuestion",
    )} when it is available, otherwise in plain text. Then end your turn and wait. Do not simulate an answer, do not batch two gates into one question, and do not proceed on silence.`,
    "",
    `If this session cannot ask — a headless or otherwise non-interactive run — treat the gate as the end of the run: append a note with ${code(
      '"outcome":"halt"',
    )} naming the gate, write the final ${code("PROGRESS.md")}, and report that the run is waiting for a human. Resume later with the same run id.`,
  );
}

function sectionEight(ctx: PackageContext): string {
  const exampleNode = ctx.agents.find((agent) => agent.isCritic) ?? ctx.agents[0];
  const example = JSON.stringify({
    id: "n-0007",
    run: "20260917-0930-a1b2",
    at: `node:${exampleNode?.node.id ?? "some-node"}`,
    started: "2026-09-17T09:34:02Z",
    ended: "2026-09-17T09:38:41Z",
    outcome: "fail",
    verdict: "fail",
    round: 2,
    evidence: ["docs/REVIEW-CHECKLIST.md", "test command output"],
    gaps: ["no test covers the empty-input case"],
    text: "3 of 5 checklist items cited; two unmet",
  });

  return lines(
    "## 8. Progress and notes",
    "",
    bullet(
      `${code(ctx.paths.progress)} — human-readable. Rewrite it **after every node completes** and whenever the round counter moves: run id, goal, round, each node's status, what is waiting, and the stop check you last evaluated.`,
    ),
    bullet(
      `${code(ctx.paths.notes)} — one JSON object per line, appended, never rewritten. Append a line **per node run** and **per loop round**, plus one at the start and one at the end of the run.`,
    ),
    "",
    "Line shape (graph-ir §6). `id`, `run` and `at` are required; the rest are filled when they apply:",
    "",
    fence(
      lines(
        `id       kebab-case, unique in the file: ${"`n-0001`"}, ${"`n-0002`"}, … in append order`,
        "run      the run id",
        "at       graph | node:<node-id> | edge:<edge-id> | loop:<loop-id>",
        "started  ISO timestamp        ended     ISO timestamp",
        "outcome  pass | fail | halt | invalid-evidence",
        "verdict  the critic's verdict label, when there is one",
        "round    the loop round this belongs to",
        "evidence what was actually inspected",
        "cost     { measure: usd | minutes | turns | tokens, amount }",
        "gaps     repeated gaps you noticed",
        "proposal { summary } — a graph edit you would suggest; never apply it yourself",
        "text     short commentary",
      ),
      "text",
    ),
    "",
    "One filled line:",
    "",
    fence(example, "json"),
    "",
    `Never edit ${code(ctx.paths.graph)}. If the graph itself looks wrong, append a note with a ${code(
      "proposal",
    )} and carry on.`,
  );
}

function sectionNine(warnings: Issue[]): string {
  return lines(
    "## 9. Validation warnings",
    "",
    ...(warnings.length === 0
      ? ["The document validated clean for export: no warnings."]
      : [
          "grooph raised these when compiling this package. They are not errors, and the human running this graph should see them:",
          "",
          fence(warnings.map(formatIssue).join("\n"), "text"),
        ]),
  );
}

function sectionTen(ctx: PackageContext): string {
  const stopNodes = (ctx.doc.nodes ?? []).filter((node) => node.kind === "stop");
  return lines(
    "## 10. Ending",
    "",
    "The run ends when you reach a stop node, when a stop fires and its action is to halt, or when no edge is left to take.",
    "",
    ...(stopNodes.length > 0
      ? [
          `Stop nodes: ${stopNodes
            .map((node) => `${code(node.id)} (${node.kind === "stop" ? (node.outcome ?? "success") : ""})`)
            .join(", ")}.`,
          "",
        ]
      : ["This graph has no stop node: the run ends when no edge is left to take.", ""]),
    "Whichever way it ends, do all three:",
    "",
    `1. Append the final note: ${code('"at":"graph"')} with the outcome and a ${code(
      "text",
    )} that names the stop that fired or the stop node reached.`,
    `2. Write the last ${code("PROGRESS.md")}: which nodes ran, how many rounds, and why the run ended.`,
    "3. Tell the human, in your reply, the run id, the rounds, the stop that ended the run, and what is left over.",
  );
}

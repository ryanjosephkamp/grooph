/**
 * `LEAD.md` — the lead brief. Section order is fixed by
 * `docs/targets/claude-code.md` § "Lead brief structure" (eleven sections).
 */

import { formatIssue, type Issue } from "../../issues.js";
import {
  describeStop,
  edgeIsolation,
  edgeWhenLabel,
  entryNodeIds,
  inspectableEvidence,
  loopMode,
  loopsOfNode,
  stopAction,
} from "../../semantics.js";
import { OP_ARGS, type OpName } from "../../ops/apply.js";
import type { Edge, Loop, Node, Stop } from "../../types.js";
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
    sectionNine(ctx),
    sectionTen(warnings),
    sectionEleven(ctx),
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

/** The run id and timestamps every example in the brief uses, so they agree with each other. */
const EXAMPLE_RUN_ID = "20260917-093002";
const EXAMPLE_STARTED = "2026-09-17T09:30:02Z";

function sectionThree(ctx: PackageContext): string {
  const firstNote = JSON.stringify({
    id: "n-0001",
    run: EXAMPLE_RUN_ID,
    at: "graph",
    started: EXAMPLE_STARTED,
    text: "run started",
  });
  const dispatchLoops = loopsWithDispatchBudget(ctx);
  return lines(
    "## 3. Run setup",
    "",
    `1. Read the run id from the clock, in the form ${code(ctx.profile.runIdFormat)} (UTC): ${code(
      "date -u +%Y%m%d-%H%M%S",
    )}, for example ${code(EXAMPLE_RUN_ID)}. If ${code(`${ctx.paths.runs}/<that id>/`)} already exists, append ${code(
      "-2",
    )}, then ${code("-3")}, and so on. Never make an id up.`,
    `2. Create ${code(`${ctx.paths.runs}/<run-id>/`)}.`,
    `3. Copy the source document ${code(ctx.paths.graph)} into it as ${code(
      ctx.paths.workingCopy,
    )}. That copy is the run's working copy: the graph this run follows, ${
      ctx.adaptation === "adaptive" ? "and the only copy you may amend (§9)" : "left as copied (§9)"
    }. Never write the source document.`,
    `4. Write ${code("PROGRESS.md")} there before dispatching anything: the run id, the goal, every node with status ${code(
      "pending",
    )}, and the round counter at 0${
      dispatchLoops.length > 0 ? ` (with the dispatch counter of ${dispatchLoops.map((loop) => code(loop.id)).join(", ")} at 0, §6)` : ""
    }.`,
    `5. Create ${code("notes.jsonl")} beside it and append the first line, its ${code("started")} read from ${code(
      "date -u +%Y-%m-%dT%H:%M:%SZ",
    )}:`,
    "",
    fence(firstNote, "json"),
    "",
    `6. If you were given a run id to resume, do not start a second run: read that folder's ${code(
      "PROGRESS.md",
    )} and working copy, continue from the last recorded position, and keep appending to the same ${code(
      "notes.jsonl",
    )}. Do not copy the source over the working copy again.`,
    "",
    `Entry nodes (start here): ${entryNodeIds(ctx.index).map(code).join(", ") || "none — the graph has no entry node"}.`,
  );
}

/** Loops whose budget stop counts `dispatches`: the lead keeps their counter in PROGRESS.md (graph-ir §1). */
const loopsWithDispatchBudget = (ctx: PackageContext): Loop[] =>
  (ctx.doc.loops ?? []).filter((loop) => (loop.stops ?? []).some((stop) => stop.kind === "budget" && stop.measure === "dispatches"));

/** Loops with an `evidence-invalid` stop: the only ones an invalid-evidence round counts toward (graph-ir §2). */
const loopsWithEvidenceStop = (ctx: PackageContext): Loop[] =>
  (ctx.doc.loops ?? []).filter((loop) => (loop.stops ?? []).some((stop) => stop.kind === "evidence-invalid"));

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
  const evidenceLoops = loopsWithEvidenceStop(ctx);
  const diffEvidence = edges.some((edge) => (edge.evidence ?? []).some((item) => /\bdiff\b/i.test(item)));
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
      `A worker may inspect what its inbound edge lists plus its own declared inputs; for a writer that includes the project it is changing. A critic that cannot read its evidence reports ${code(
        "invalid-evidence",
      )} instead of guessing.`,
    ),
    bullet(
      `When an edge routes ${code("invalid-evidence")}, take it. Otherwise repair the evidence and dispatch the same node once more in the same round; a second ${code(
        "invalid-evidence",
      )} routes as ${code("fail")}.${
        evidenceLoops.length > 0
          ? ` Such rounds count toward the ${code("evidence-invalid")} stop of loop ${evidenceLoops.map((loop) => code(loop.id)).join(", ")}.`
          : ""
      }`,
    ),
    ...(diffEvidence ? [bullet(DIFF_OF_THE_CHANGE)] : []),
  );
}

/**
 * Review 0011: `git diff` omits files a change added, and leads reached for
 * `git add -N`, brace groups and `${pipestatus[1]}` — refused under the narrow
 * allowlist, a turn each. Said once, where the evidence names a diff.
 */
const DIFF_OF_THE_CHANGE = `A diff of the change is ${code("git diff")} plus, for each file the change added, ${code(
  "git diff --no-index /dev/null <file>",
)} (${code("git diff")} omits untracked files; ${code(
  "--no-index",
)} exits 1 whenever the two differ, which is not an error). Run each bare from the project root, one command at a time; no brace group, no ${code(
  "cd",
)}. ${code("git add -N <file>")} also works where it is allowed, and stages nothing.`;

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
      }. The first pass through the members is round 0, because no back edge has been taken yet; each traversal after that adds one. Record the round in ${code(
        "PROGRESS.md",
      )} and in a loop note every time you finish a pass.`,
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
    ...budgetNotes(ctx, loop, advisory),
    "",
  );
}

/**
 * What one full round of a loop costs in dispatches: its agent members (the
 * lead node is not dispatched) and its check members; a gate, merge or stop
 * member is not a dispatch. The same arithmetic the proving check makes.
 */
function dispatchMembers(ctx: PackageContext, loop: Loop): Node[] {
  return (loop.members ?? [])
    .map((id) => ctx.index.nodes.get(id))
    .filter((node): node is Node => node !== undefined)
    .filter((node) => (node.kind === "agent" && node.id !== ctx.leadNode?.id) || node.kind === "check");
}

/** Loops nested inside `loop`: members a strict subset of its members (graph-ir §2, `estimateShape`). */
const innerLoops = (ctx: PackageContext, loop: Loop): Loop[] => {
  const members = new Set(loop.members ?? []);
  return (ctx.doc.loops ?? []).filter(
    (other) => other.id !== loop.id && (other.members ?? []).length < members.size && (other.members ?? []).every((id) => members.has(id)),
  );
};

/** graph-ir §1 on budget measures, said once per loop that has one: what a dispatch is, what a round costs; which measures nothing enforces. */
function budgetNotes(ctx: PackageContext, loop: Loop, advisory: Stop[]): string[] {
  const notes: string[] = [];
  const measures = new Set((loop.stops ?? []).flatMap((stop) => (stop.kind === "budget" ? [stop.measure] : [])));
  if (measures.has("dispatches")) {
    notes.push(
      `> A dispatch is one node run inside this loop's members — an agent you dispatch, or a check you run — counted from the loop's first pass; a nested loop's count restarts when the outer loop re-enters it. Keep the count in ${code(
        "PROGRESS.md",
      )} and evaluate the stop against it.`,
    );
    notes.push(`> ${dispatchesPerRound(ctx, loop)}`);
  }
  if (measures.has("minutes")) notes.push(`> Minutes are wall clock from the run's first note.`);
  if (advisory.length > 0) {
    const named = [...new Set(advisory.flatMap((stop) => (stop.kind === "budget" ? [stop.measure] : [])))];
    notes.push(
      `> ${named.map(code).join(", ")} budgets are **advisory**: nothing in Claude Code enforces them inside a session${
        named.includes("turns") ? ", and leads count turns inconsistently" : ""
      }. Track the figure in ${code("PROGRESS.md")} and halt when you pass it${
        named.includes("usd") ? `; a ${code("usd")} budget is enforced only from outside, by starting a headless run with ${code("--max-budget-usd")}` : ""
      }.`,
    );
  }
  return notes.length > 0 ? ["", ...notes] : [];
}

/**
 * Review 0011: nothing told a lead what a round costs, and one counted 8 for 6.
 * One sentence per loop with a `dispatches` budget, derived from its members,
 * so the lead's count and the proving check's agree.
 */
function dispatchesPerRound(ctx: PackageContext, loop: Loop): string {
  const members = dispatchMembers(ctx, loop);
  const others = (loop.members ?? []).filter((id) => !members.some((node) => node.id === id));
  const limits = (loop.stops ?? []).flatMap((stop) => (stop.kind === "budget" && stop.measure === "dispatches" ? [stop.limit] : []));
  const limit = limits.length > 0 ? Math.min(...limits) : undefined;
  const inner = innerLoops(ctx, loop);
  if (members.length === 0) {
    return `One full round of this loop dispatches nothing: none of its members is an agent or a check.`;
  }
  const rounds = limit === undefined ? "" : ` The budget of ${limit} covers ${Math.floor(limit / members.length)} full round${Math.floor(limit / members.length) === 1 ? "" : "s"}${limit % members.length === 0 ? "" : ` and ${limit % members.length} more dispatch${limit % members.length === 1 ? "" : "es"}`}.`;
  return `One full round of this loop costs **${members.length} dispatch${members.length === 1 ? "" : "es"}**: ${members
    .map((node) => code(node.id))
    .join(", ")}${others.length > 0 ? ` (${others.map(code).join(", ")} ${others.length === 1 ? "is" : "are"} not a dispatch)` : ""}.${rounds}${
    inner.length > 0
      ? ` Every extra round of the inner loop ${inner.map((other) => code(other.id)).join(", ")} adds its own dispatches on top.`
      : ""
  } A node dispatched twice in one round (§5, invalid evidence) counts twice.`;
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
    `One rule, in every kind of session. On reaching a gate: first append a note at the gate (${code("at")} = ${code(
      "node:<gate-id>",
    )}, or ${code("edge:<edge-id>")} for an approval edge) with ${code(
      '"outcome":"halt"',
    )} and a ${code("text")} naming it, and write ${code("PROGRESS.md")}; then ask, with ${code(
      "AskUserQuestion",
    )} when it is available, otherwise in plain text; then end your turn. Do not simulate an answer, do not batch two gates into one question, and do not proceed on silence.`,
    "",
    `When the human answers, append a note at the same place with their decision and continue along the matching edge. A run nobody answers ends on that halt note, and the same run id resumes it (§3, step 6).`,
  );
}

function sectionEight(ctx: PackageContext): string {
  const exampleNode = ctx.agents.find((agent) => agent.isCritic) ?? ctx.agents[0];
  const example = JSON.stringify({
    id: "n-0007",
    run: EXAMPLE_RUN_ID,
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
  const exampleLoop = (ctx.doc.loops ?? [])[0];
  const exampleStops = exampleLoop?.stops ?? [];
  const exampleStop = exampleStops.find((stop) => stop.kind === "bar-passed") ?? exampleStops.find((stop) => stop.kind === "budget") ?? exampleStops[0];
  const loopExample =
    exampleLoop && exampleStop
      ? JSON.stringify({
          id: "n-0012",
          run: EXAMPLE_RUN_ID,
          at: `loop:${exampleLoop.id}`,
          ended: "2026-09-17T09:51:10Z",
          outcome: exampleStop.kind === "bar-passed" ? "pass" : "halt",
          round: 3,
          stop: exampleStop.kind,
          text: exampleStop.kind === "bar-passed" ? "bar passed at round 3; taking the pass edges" : `${describeStop(exampleStop)} fired at round 3`,
        })
      : undefined;
  const dispatchLoops = loopsWithDispatchBudget(ctx);

  return lines(
    "## 8. Progress and notes",
    "",
    bullet(
      `${code(ctx.paths.progress)} — human-readable. Rewrite it **after every node completes** and whenever the round counter moves: run id, goal, round, ${
        dispatchLoops.length > 0 ? `the dispatch count of ${dispatchLoops.map((loop) => code(loop.id)).join(", ")}, ` : ""
      }each node's status, what is waiting, and the stop check you last evaluated.`,
    ),
    bullet(
      `${code(ctx.paths.notes)} — one JSON object per line, appended, never rewritten. Append a line at the start of the run, one **per node run** (${code(
        "at",
      )} = ${code("node:<node-id>")}), one **per pass through a loop** (${code("at")} = ${code(
        "loop:<loop-id>",
      )}, carrying the round you just finished and the stop you evaluated — so even a loop that passes on its first pass leaves a line — and ${code(
        "stop",
      )} with the kind of the stop when one fires), and one when the run ends.`,
    ),
    bullet(
      `When you dispatch a node, append one short line first: ${code('"outcome":"started"')}, ${code("at")} = ${code(
        "node:<node-id>",
      )}, and ${code("round")} when the node is inside a loop. The usual line follows when the node completes, so a monitor can show what is running.`,
    ),
    bullet(
      `${code("started")} and ${code("ended")} are read from the clock, ${code(
        "date -u +%Y-%m-%dT%H:%M:%SZ",
      )}, or left out. Never estimate one.`,
    ),
    ...roundReports(ctx),
    "",
    "Line shape (graph-ir §6). `id`, `run` and `at` are required; the rest are filled when they apply:",
    "",
    fence(
      lines(
        `id        kebab-case, unique in the file: ${"`n-0001`"}, ${"`n-0002`"}, … in append order`,
        "run       the run id",
        "at        graph | node:<node-id> | edge:<edge-id> | loop:<loop-id>",
        "started   ISO timestamp from the clock, or omitted        ended     the same",
        "outcome   pass | fail | halt | invalid-evidence; started on a dispatch line",
        "verdict   the critic's verdict label, when there is one",
        "round     the loop round this belongs to",
        "stop      on the loop note that ends the loop: the kind of the stop that fired",
        "evidence  what was actually inspected",
        "cost      { measure: dispatches | minutes | usd | turns | tokens, amount }",
        "gaps      repeated gaps you noticed",
        "proposal  { summary, patch? } — a graph change for the human to decide; you do not make it",
        ...(ctx.adaptation === "adaptive"
          ? ["amendment { summary, reason, patch? } — a change you made to the working copy (§9)"]
          : []),
        "text      short commentary",
      ),
      "text",
    ),
    "",
    loopExample ? "Two filled lines, a node run and the loop pass on which a stop fired:" : "One filled line:",
    "",
    fence(loopExample ? lines(example, loopExample) : example, "json"),
    "",
    `A run never writes the source document ${code(ctx.paths.graph)}. When the graph itself looks wrong, §9 says what to do.`,
  );
}

/**
 * Review 0011: a critic's report is rewritten each round, so round 0's findings
 * survived only in the notes. Said once, when a critic sits inside a loop.
 */
function roundReports(ctx: PackageContext): string[] {
  const looped = ctx.agents.filter((agent) => agent.isCritic && loopsOfNode(ctx.index, agent.node.id).length > 0);
  if (looped.length === 0) return [];
  const report = looped.flatMap((agent) => agent.node.outputs).find((output) => /\.md$/i.test(output.trim())) ?? "REVIEW.md";
  const stem = report.trim().replace(/\.md$/i, "");
  return [
    bullet(
      `Before you re-dispatch a builder after a critic's ${code("fail")}, copy each report the critic wrote that round into the run folder as ${code(
        "<report>-round-<n>.md",
      )} — ${code(report.trim())} from round 0 becomes ${code(`${ctx.paths.runs}/<run-id>/${stem}-round-0.md`)} — so the round's findings survive the next round's rewrite. Copy; the builder still reads the report where its edge says.`,
    ),
  ];
}

/** graph-ir §2 "Brakes are not adaptable", item for item. */
const BRAKES = [
  "a human gate",
  `an edge ${code("approval")}`,
  `an ${code("irreversible")} marker`,
  `a ${code("budget")} or ${code("max-iterations")} stop`,
  `a bar's ${code("acceptance")}`,
  "critic isolation",
  `the ${code("adaptation")} level itself`,
];

/** graph-ir §6: the preferred form of a `patch` on a proposal. */
const PROPOSAL_PATCH = `A ${code("patch")} is preferably a list of grooph ops, the JSON ${code(
  "grooph apply --ops",
)} takes (${code(
  '[{"op":"updateNode","id":"<node-id>","set":{"effort":"high"}}]',
)}): ops name objects by id, so the human can replay them with ${code("grooph apply")}.`;

/**
 * The ops core accepts (`packages/core/src/ops/apply.ts`, documented in
 * `packages/core/README.md`), one line each: the arguments, then what it does.
 * Typed against `OpName` so a new op cannot be left out; a test checks that
 * every argument `OP_ARGS` names appears on its line. Review 0011: a proposer
 * shown only `updateNode` invented `addEdge` and an `addNode` with a `node`
 * object, and the check could not replay them.
 */
const OP_VOCABULARY: Record<OpName, string> = {
  setGraphName: "name — the graph id follows while it still matches",
  setGraphField: "key (name | goal | description | adaptation | lineage), value — null removes",
  setTarget: "harness — null removes",
  setConstraint: "key (budget | time | other), value — null removes",
  addNode: "kind (agent | human-gate | check | merge | stop), name?, id?, at?, set? — the node's fields (role, brief, outputs, allow, …) go in set",
  setNodeName: "id, name",
  updateNode: "id, set — a shallow patch: each key replaces the field, null removes it; never id or kind",
  removeNode: "id — with its edges, loop memberships and scoped policies",
  connect: "from, to, id?, set? — adds an edge; when, isolation, evidence, approval go in set",
  updateEdge: "id, set — re-routing (from, to) included",
  removeEdge: "id",
  addLoop: "members?, name?, id?, set? — no back edge and no stop until set or addStop gives them",
  setLoopName: "id, name",
  updateLoop: "id, set — mode, members, back, bar, stops",
  removeLoop: "id",
  toggleLoopMember: "loop, node, on?",
  toggleLoopBack: "loop, edge, on?",
  setBar: "loop, bar — null removes",
  addStop: "loop, kind (human | budget | bar-passed | diminishing-returns | evidence-invalid | max-iterations), set?",
  setStop: "loop, index, stop — replaces the stop at index (from 0)",
  removeStop: "loop, index",
  moveStop: "loop, index, delta (-1 | 1)",
  addPolicy: "kind, scope (graph | loop:<id> | node:<id> | edge:<id>), params?, id?",
  removePolicy: "id",
  setPositions: "positions — layout only",
  renameId: "from, to — every reference follows",
};

/** §9's vocabulary block: the op names, each with its arguments, and two examples a proposer most often needs. */
function opVocabulary(): string[] {
  const names = Object.keys(OP_ARGS) as OpName[];
  const width = Math.max(...names.map((name) => name.length));
  const examples = [
    JSON.stringify({ op: "addNode", kind: "agent", id: "reviewer", set: { role: "critic", brief: "<purpose, limits, outputs>", outputs: ["REVIEW.md"], allow: ["read-files", "write-outputs"] } }),
    JSON.stringify({ op: "connect", from: "builder", to: "reviewer", set: { when: "pass", evidence: ["diff of the change"] } }),
  ];
  return [
    `These are the ops, and the only ops, ${code("grooph apply")} accepts; an op is ${code(
      '{"op":"<name>", ...arguments}',
    )}, and a ${code("?")} marks an optional argument. There is no ${code("addEdge")} and no ${code(
      "node",
    )} object: an edge is ${code("connect")}, and a node's fields go in ${code("set")}.`,
    "",
    fence(names.map((name) => `${name.padEnd(width)}  ${OP_VOCABULARY[name]}`).join("\n"), "text"),
    "",
    "A new critic and the edge into it, as one patch of two ops:",
    "",
    fence(`[${examples.join(",\n ")}]`, "json"),
  ];
}

function sectionNine(ctx: PackageContext): string {
  const level = ctx.adaptation;
  const policies = (ctx.doc.policies ?? []).filter((p) => p.kind === "no-live-graph-rewrite");
  const graphPolicy = policies.find((p) => p.scope === "graph");
  const why =
    graphPolicy && ctx.doc.adaptation !== level
      ? ` (its policy ${code(graphPolicy.id)}, ${code("no-live-graph-rewrite")}, is stricter than ${code(
          `adaptation: ${ctx.doc.adaptation ?? "adaptive"}`,
        )})`
      : ctx.doc.adaptation === undefined
        ? " (the default)"
        : "";
  const heading = "## 9. Adapting the graph";
  const untouched = `The working copy ${code(ctx.paths.workingCopy)} stays identical to the source document ${code(
    ctx.paths.graph,
  )}: neither is written during this run.`;

  if (level === "fixed") {
    return lines(
      heading,
      "",
      `This graph is ${code("fixed")}${why}: follow it exactly. Do not add, remove or re-brief nodes, re-route edges, or change loops, tiers or effort — not even to tighten a brake.`,
      "",
      `When the work cannot go on within the graph as written, halt and ask: append a note with ${code(
        '"outcome":"halt"',
      )} that says what the graph is missing, write the final ${code(
        "PROGRESS.md",
      )}, and tell the human. A ${code("proposal")} note alongside is welcome; the run does not continue on it.`,
      "",
      untouched,
    );
  }

  if (level === "propose") {
    return lines(
      heading,
      "",
      `This graph is ${code("propose")}${why}: you change nothing in it during the run, not even to tighten a brake. Follow it as written.`,
      "",
      `When the work shows the graph is wrong — a missing node, a loop that should exist, a brief that no longer fits — append a note with a ${code(
        "proposal",
      )} (${code("summary")}, and a ${code(
        "patch",
      )} when one helps) and carry on with the graph as it is; the human decides after the run. If you cannot carry on without the change, halt and say why.`,
      "",
      PROPOSAL_PATCH,
      "",
      ...opVocabulary(),
      "",
      untouched,
    );
  }

  const example = JSON.stringify({
    id: "n-0009",
    run: "<run-id>",
    at: "graph",
    amendment: {
      summary: "<what you changed>",
      reason: "<what the work showed>",
      patch: [{ op: "updateNode", id: "<node-id>", set: { owns: ["<artifact>"] } }],
    },
  });
  const scoped = policies.filter((p) => p.scope !== "graph");

  return lines(
    heading,
    "",
    `This graph is ${code("adaptive")}${why}. It is the plan to start from, not a script: when the work shows it is wrong — a missing node, a loop that should exist, a brief that no longer fits — change the run's working copy rather than work around it. When the graph fits, follow it. Work that fits an existing node's brief and outputs needs no amendment, and the smallest change that closes a real gap is the right one.`,
    "",
    `Amending at kickoff is fine when reading the task already shows a gap, such as a file a node must write that its ${code(
      "owns",
    )} does not list. Redesigning the graph up front is not: a change to its overall shape before any node has run is a ${code(
      "proposal",
    )} for the human.`,
    "",
    "You may add, remove or re-brief nodes, add or re-route edges, add loops, and change tiers or effort. For each amendment, when you make it:",
    "",
    `1. Edit the working copy, ${code(ctx.paths.workingCopy)}. The source document ${code(
      ctx.paths.graph,
    )} is never written by a run; after the run the human adopts your working copy as a new version or discards it.`,
    `2. Append a note with an ${code("amendment")} — ${code("summary")}, ${code("reason")}, and a ${code(
      "patch",
    )} when one helps. A patch is preferably a list of grooph ops, the JSON ${code(
      "grooph apply --ops",
    )} takes: ops name objects by id, so they survive reordering and can be replayed. The working copy is the record either way.`,
    "",
    fence(example, "json"),
    "",
    `3. Record it in ${code("PROGRESS.md")} under **Amendments**, so the human can see the graph the run is actually following.`,
    `4. Check that the working copy still validates: run ${code(
      `grooph validate --for-export ${ctx.paths.workingCopy}`,
    )} when ${code("grooph")} is on your PATH; otherwise check the brakes below by hand.`,
    `5. When the amendment changes a node's ${code("allow")} or ${code("deny")}, also edit that node's file under ${code(
      ".claude/agents/",
    )} before you dispatch it: its ${code("tools:")} line (and ${code(
      "disallowedTools:",
    )}), with the capability-to-tools table in ${code(
      ctx.paths.mapping,
    )}. Claude Code reads the edited file at the next dispatch; no restart is needed. Say in the amendment note that you edited it. If the file cannot be edited, the change is a ${code(
      "proposal",
    )}: record it as one and dispatch the node as compiled, never a stand-in.`,
    "",
    ...opVocabulary(),
    "",
    "At every adaptation level you may not remove or loosen:",
    "",
    ...BRAKES.map(bullet),
    "",
    `You may tighten any of them. Loosening one is a ${code(
      "proposal",
    )} note for the human, never an amendment. A loop you add needs a stop, and a bar if it is a judgment loop, like any other.${
      scoped.length > 0
        ? ` Policy ${scoped
            .map((p) => `${code(p.id)} (scope ${code(p.scope)})`)
            .join(", ")} forbids live rewrites where it applies: for anything it covers, record a proposal instead.`
        : ""
    }`,
    "",
    `A node you add mid-run has no compiled file under ${code(
      ".claude/agents/",
    )}. Write one beside the others, in the shape of an existing one, and dispatch it by that name (the file is read at the next dispatch), or dispatch it as a general-purpose subagent with its brief inline. Either way it works under the same isolation and evidence rules as every other node.`,
  );
}

function sectionTen(warnings: Issue[]): string {
  return lines(
    "## 10. Validation warnings",
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

function sectionEleven(ctx: PackageContext): string {
  const stopNodes = (ctx.doc.nodes ?? []).filter((node) => node.kind === "stop");
  const adaptive = ctx.adaptation === "adaptive";
  return lines(
    "## 11. Ending",
    "",
    "The run ends when you reach a stop node, when a stop fires and its action is to halt, or when no edge is left to take. A gate is different: the halt note of §7 stands as the final note until the human answers, and the run continues from it.",
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
    `2. Write the last ${code("PROGRESS.md")}: which nodes ran, how many rounds, ${
      adaptive ? "every amendment to the working copy, " : ""
    }and why the run ended.`,
    `3. Tell the human, in your reply, the run id, the rounds, the stop that ended the run, ${
      adaptive ? "whether the working copy was amended (so they can adopt or discard it), " : ""
    }and what is left over.`,
  );
}

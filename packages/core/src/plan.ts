/**
 * A plan: a document kept for people to read and follow, whether or not a harness could run it.
 *
 * `planBundle` gives the files of one for any document that reads as a graph: `PLAN.md` (who does what, what
 * stands between the plan and a harness, and then the outline in full), the picture, and the document itself. It asks
 * for no target and refuses on no rule: a finding that would stop a package is listed, with its code, under "To
 * fix before a harness can run this". A package for a harness is another thing, and is still written only by
 * `compile`, for a document with no error.
 *
 * Pure, and the same bytes for the same document: no date, no machine. Not on the web app's way in: it brings the
 * validator's export rules, the outline and the picture with a subgrooph's box.
 */

import { canonicalize } from "./canonicalize.js";
import type { Issue } from "./issues.js";
import { outline, outlineMarkdown, type OutlineSection } from "./outline.js";
import { pictureWithUnits } from "./picture/graph-units.js";
import { unitsKit } from "./picture/units-kit.js";
import type { Graph, Node } from "./types.js";
import { validate } from "./validate.js";

export type PlanBundle = {
  /** path → file contents, in the order a person opens them: `PLAN.md`, the picture, the document */
  files: Record<string, string>;
  /** every finding of `validate(doc, { forExport: true })`: what stands between this plan and a harness */
  toFix: Issue[];
};

/** Whose a step is, in the words the table uses. A person's is a human gate; an agent's names its role. */
export type PlanStep = { id: string; name: string; whose: "an agent" | "a person" | "a command" | "the lead" | "nobody"; does: string; leaves: string };

const oneLine = (text: string): string => text.replace(/\s+/g, " ").trim();
/** A table cell: one line, and no bar that would end it. */
const cell = (text: string): string => oneLine(text).replace(/\|/g, "\\|") || " ";

const roleOf = (node: Extract<Node, { kind: "agent" }>): string => (typeof node.role === "string" ? node.role : node.role.custom);

/** Every node as a step of the plan, in the document's order: whose it is, what it does or asks, what it leaves. */
export function planSteps(doc: Graph): PlanStep[] {
  return doc.nodes.map((node): PlanStep => {
    const base = { id: node.id, name: node.name || node.id };
    switch (node.kind) {
      case "agent":
        return { ...base, whose: "an agent", does: [roleOf(node), node.model?.tier, node.effort ? `${node.effort} effort` : undefined].filter(Boolean).join(", "), leaves: node.outputs.join("; ") };
      case "human-gate":
        return { ...base, whose: "a person", does: node.options && node.options.length > 0 ? `decides: ${node.options.join(" / ")}` : `is asked: ${node.prompt}`, leaves: "their answer" };
      case "check":
        return { ...base, whose: "a command", does: node.check.run ? `runs \`${node.check.run}\`` : `a check of kind ${node.check.kind}`, leaves: `pass or fail (${node.check.pass})` };
      case "merge":
        return { ...base, whose: "the lead", does: `merges ${node.merges.join(", ")}`, leaves: node.merges.join("; ") };
      case "stop":
        return { ...base, whose: "nobody", does: `the run ends here${node.outcome === "halt" ? ", halted" : node.outcome === "success" ? ", in success" : ""}`, leaves: "" };
    }
  });
}

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** A section of the outline without its heading: the items, as `grooph outline` writes them. */
const itemsOf = (section: OutlineSection): string => outlineMarkdown([{ ...section, title: "x" }]).replace(/^# x\n*/, "").trimEnd();

function planMarkdown(doc: Graph, toFix: readonly Issue[], pictureFile: string, documentFile: string): string {
  const name = oneLine(doc.name || doc.id);
  const errors = toFix.filter((issue) => issue.severity === "error");
  const warnings = toFix.filter((issue) => issue.severity !== "error");
  const steps = planSteps(doc);
  const names = new Map(steps.map((step) => [step.id, step.name]));
  const approvals = doc.edges.filter((edge) => edge.approval === true);
  const whose = (who: PlanStep["whose"]): number => steps.filter((step) => step.whose === who).length;
  const line = (issue: Issue): string => `- \`${issue.code}\` ${oneLine(issue.message)}${issue.at.length > 0 ? ` (at: ${issue.at.join(", ")})` : ""}`;
  const [first, ...rest] = outline(doc);

  const lines = [
    `# ${name}`,
    "",
    `A plan, kept by grooph: the picture, who does what, and every step in full. Nothing here has been run, and grooph runs nothing. The document it is drawn from is \`${documentFile}\`, and that is the one to edit.`,
    "",
    errors.length === 0
      ? `A coding harness could run this as it is: nothing in it is in error.${doc.target?.harness ? ` \`grooph export\` writes its package for ${doc.target.harness}.` : ""}`
      : `**A coding harness cannot run this as it is.** ${count(errors.length, "thing has", "things have")} to be fixed first, listed under "To fix before a harness can run this". As a plan for people to read and follow it is whole.`,
    "",
    ...(doc.goal?.trim() ? [`**Goal:** ${oneLine(doc.goal)}`, ""] : []),
    `![${name.replace(/[[\]]/g, "")}](${pictureFile})`,
    "",
    "## Who does what",
    "",
    ...(steps.length === 0
      ? ["No steps yet."]
      : [
          "| Step | Whose | What it does or asks | Leaves behind |",
          "|---|---|---|---|",
          ...steps.map((step) => `| ${cell(step.name)} | ${step.whose === "nobody" ? " " : step.whose} | ${cell(step.does)} | ${cell(step.leaves)} |`),
          "",
          `Of ${count(steps.length, "step", "steps")}: ${whose("an agent")} by an agent, ${whose("a person")} by a person, ${whose("a command")} by a command.`,
        ]),
    ...(approvals.length > 0 ? ["", "A person also approves, each time, before the work goes on:", "", ...approvals.map((edge) => `- from ${oneLine(names.get(edge.from) ?? edge.from)} to ${oneLine(names.get(edge.to) ?? edge.to)}`)] : []),
    "",
    "## To fix before a harness can run this",
    "",
    ...(errors.length > 0 ? ["Each of these stops a package from being written. The code names the rule, and grooph's rule reference has each rule in full.", "", ...errors.map(line)] : ["Nothing."]),
    ...(warnings.length > 0 ? ["", errors.length > 0 ? "And these are warnings: a package is written with them, and carries them in its lead's brief." : "These are warnings: a package is written with them, and carries them in its lead's brief.", "", ...warnings.map(line)] : []),
    "",
    // Everything above is grooph's own account, with a document's words only as single lines. From here down the
    // document speaks in full, and may hold Markdown of its own: so that nothing it says can stand where the two
    // sections above stand.
    "## In full",
    "",
    ...(first ? [itemsOf(first), ""] : []),
    ...rest.flatMap((section) => [`### ${section.kind}: ${oneLine(section.title)}`, "", `\`${section.id}\``, "", itemsOf(section), ""]),
  ];
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

/**
 * The files of a plan, for any document that reads as a graph. Nothing is refused: a document with no target, no
 * goal, a loop with no stop or a dangling edge still gets its plan, and each such finding is listed in it.
 */
export function planBundle(doc: Graph): PlanBundle {
  const toFix = validate(doc, { forExport: true });
  const pictureFile = `${doc.id}.svg`;
  const documentFile = `${doc.id}.grooph.json`;
  return {
    files: {
      "PLAN.md": planMarkdown(doc, toFix, pictureFile, documentFile),
      [pictureFile]: pictureWithUnits(unitsKit, doc),
      [documentFile]: canonicalize(doc),
    },
    toFix,
  };
}

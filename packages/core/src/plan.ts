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

/**
 * A node as a step of the plan: whose it is, what it does or asks, what it leaves. `name`, `does` and `leaves` are
 * the document's words made one line each, and nothing more: a view that prints them escapes them for where it
 * prints (`plainMarkdown` for Markdown). `command` is a check's command as written, which may be several lines; a
 * step that has one says so in `does` without repeating it.
 */
export type PlanStep = {
  id: string;
  name: string;
  /** an agent's, a person's (a human gate), a command's (a check that runs one), the lead's (a merge, or a check the lead judges), or nobody's (a stop) */
  whose: "an agent" | "a person" | "a command" | "the lead" | "nobody";
  does: string;
  leaves: string;
  command?: string;
};

/**
 * One line: every run of white space, of control characters and of characters that show as nothing (the line
 * separators Unicode has, the zero-width ones) is one space.
 */
const oneLine = (text: string): string => text.replace(/[\s\u0000-\u001f\u007f-\u009f\u200b-\u200d\u2028\u2029\u2060]+/g, " ").trim();
/**
 * A document's words inside an account that is Markdown: one line, with every mark Markdown or HTML would act on
 * escaped. So a name cannot open a tag or a comment, start a link or a code span, close a heading or end a
 * table's cell. (A bare address in it may still be made a link by a renderer; its text is the address.)
 */
export const plainMarkdown = (text: string): string => oneLine(text).replace(/[\\`*_[\]<>&|~#]/g, "\\$&");
const plain = plainMarkdown;
/** A table cell. An empty one still holds its place. */
const cell = (text: string): string => plain(text) || " ";
/**
 * A command in the table: as code where it is one line as written and holds nothing that could end the code or
 * the cell or open a tag (a backtick, a bar, an angle bracket, a backslash), so that what is shown is the command,
 * character for character; inside code nothing else is a mark. Otherwise it is not shown here: a command of
 * several lines made one line would be another command. It is under "In full".
 */
const shown = (command: string): string => (oneLine(command) === command && !/[`|<>\\]/.test(command) ? `runs \`${command}\`` : "runs a command, given in full below");

const roleOf = (node: Extract<Node, { kind: "agent" }>): string => (typeof node.role === "string" ? node.role : node.role.custom);

/** Every node as a step of the plan, in the document's order. */
export function planSteps(doc: Graph): PlanStep[] {
  return doc.nodes.map((node): PlanStep => {
    const base = { id: node.id, name: oneLine(node.name ?? "") || node.id };
    switch (node.kind) {
      case "agent":
        // The lead is the harness's own session (docs/graph-ir.md §1), and is counted with what the lead does.
        return { ...base, whose: roleOf(node) === "lead" ? "the lead" : "an agent", does: oneLine([roleOf(node), node.model?.tier, node.effort ? `${node.effort} effort` : undefined].filter(Boolean).join(", ")), leaves: oneLine(node.outputs.join("; ")) };
      case "human-gate": {
        const answers = (node.options ?? []).map(oneLine).filter(Boolean);
        return { ...base, whose: "a person", does: answers.length > 0 ? `decides: ${answers.join(" / ")}` : oneLine(node.prompt) ? `is asked: ${oneLine(node.prompt)}` : "is asked", leaves: "their answer" };
      }
      case "check": {
        const leaves = oneLine(node.check.pass) ? `pass or fail (${oneLine(node.check.pass)})` : "pass or fail";
        // A check with no command is the lead's to judge (docs/graph-ir.md §2: the lead runs the graph).
        return node.check.run && oneLine(node.check.run)
          ? { ...base, whose: "a command", does: "runs a command", leaves, command: node.check.run }
          : { ...base, whose: "the lead", does: `judges a check of kind ${node.check.kind}`, leaves };
      }
      case "merge":
        return { ...base, whose: "the lead", does: node.merges.length > 0 ? oneLine(`merges ${node.merges.join(", ")}`) : "merges what it is handed", leaves: oneLine(node.merges.join("; ")) };
      case "stop":
        return { ...base, whose: "nobody", does: `the run ends here${node.outcome === "halt" ? ", halted" : node.outcome === "success" ? ", in success" : ""}`, leaves: "" };
    }
  });
}

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** A section of the outline without its heading: the items, as `grooph outline` writes them. */
const itemsOf = (section: OutlineSection): string => outlineMarkdown([{ ...section, title: "x" }]).replace(/^# x\n*/, "").trimEnd();

function planMarkdown(doc: Graph, toFix: readonly Issue[], pictureFile: string, documentFile: string): string {
  const name = plain(doc.name ?? "") || doc.id;
  const errors = toFix.filter((issue) => issue.severity === "error");
  const warnings = toFix.filter((issue) => issue.severity !== "error");
  // What the graph itself breaks, apart from what only a package asks for: a plan with those is not whole.
  const own = validate(doc).filter((issue) => issue.severity === "error").length;
  const steps = planSteps(doc);
  const names = new Map(steps.map((step) => [step.id, step.name]));
  const whose = (who: PlanStep["whose"]): number => steps.filter((step) => step.whose === who).length;
  // Where a person is asked apart from the steps: an edge that needs their approval, a loop that stops for them.
  const asked = [
    ...doc.edges.filter((edge) => edge.approval === true).map((edge) => `- to approve the work going from ${plain(names.get(edge.from) ?? edge.from)} to ${plain(names.get(edge.to) ?? edge.to)}, each time`),
    ...doc.loops.flatMap((loop) =>
      loop.stops.filter((stop) => stop.kind === "human").map((stop) => `- in the loop ${plain(loop.name ?? "") || loop.id}, ${stop.kind === "human" && stop.every !== undefined ? (stop.every === 1 ? "every round" : `every ${stop.every} rounds`) : "when it stops for them"}`),
    ),
  ];
  const line = (issue: Issue): string => `- \`${issue.code}\` ${plain(issue.message)}${issue.at.length > 0 ? ` (at: ${issue.at.map(plain).join(", ")})` : ""}`;
  const notes = doc.notes?.length ?? 0;
  const [first, ...rest] = outline(doc);

  const lines = [
    `# ${name}`,
    "",
    `A plan, kept by grooph: the picture, who does what, and every step in full. grooph runs nothing: a plan is for people to read and follow. The document it is drawn from is \`${documentFile}\`, and that is the one to edit.${notes > 0 ? ` It carries ${count(notes, "note", "notes")} from runs, which ${notes === 1 ? "is" : "are"} in that file and not shown here.` : ""}`,
    "",
    errors.length === 0
      ? `A coding harness could run this as it is: nothing in it is in error.${doc.target?.harness ? ` \`grooph export\` writes its package for ${plain(doc.target.harness)}.` : ""}`
      : `**A coding harness cannot run this as it is.** ${count(errors.length, "thing has", "things have")} to be fixed first, listed under "To fix before a harness can run this". ${
          own === 0
            ? steps.length > 0
              ? "As a plan for people to read and follow it is whole."
              : "It has no steps yet."
            : `${own === errors.length ? (own === 1 ? "It is a rule" : "They are rules") : `${own} of them ${own === 1 ? "is a rule" : "are rules"}`} a graph itself is held to, not only what a package asks for: until ${own === 1 ? "it is" : "they are"} fixed, parts of the plan below may be missing or drawn wrong.`
        }`,
    "",
    ...(oneLine(doc.goal ?? "") ? [`**Goal:** ${plain(doc.goal!)}`, ""] : []),
    `![${name}](${pictureFile})`,
    "",
    "## Who does what",
    "",
    ...(steps.length === 0
      ? ["No steps yet."]
      : [
          "| Step | Whose | What it does or asks | Leaves behind |",
          "|---|---|---|---|",
          ...steps.map((step) => `| ${cell(step.name)} | ${step.whose === "nobody" ? " " : step.whose} | ${step.command !== undefined ? shown(step.command) : cell(step.does)} | ${cell(step.leaves)} |`),
          "",
          `Of ${count(steps.length, "step", "steps")}: ${whose("an agent")} by an agent, ${whose("a person")} by a person, ${whose("a command")} by a command${whose("the lead") > 0 ? `, ${whose("the lead")} by the lead` : ""}${whose("nobody") > 0 ? `; ${whose("nobody")} ${whose("nobody") === 1 ? "ends" : "end"} the run` : ""}.`,
        ]),
    ...(asked.length > 0 ? ["", "A person is also asked, apart from the steps above:", "", ...asked] : []),
    "",
    "## To fix before a harness can run this",
    "",
    ...(errors.length > 0 ? ["Each of these stops a package from being written. The code names the rule, and grooph's rule reference has each rule in full.", "", ...errors.map(line)] : ["Nothing."]),
    ...(warnings.length > 0 ? ["", errors.length > 0 ? "And these are warnings: a package is written with them, and carries them in its lead's brief." : "These are warnings: a package is written with them, and carries them in its lead's brief.", "", ...warnings.map(line)] : []),
    "",
    // Everything above is grooph's own account. A document's words are in it only as single lines with the marks of
    // Markdown and HTML escaped (`plain`), so nothing a document says can stand where the two sections above
    // stand, when read as text or when rendered. From here down the document speaks in full, as written.
    "## In full",
    "",
    ...(first ? [itemsOf(first), ""] : []),
    ...rest.flatMap((section) => [`### ${section.kind}: ${plain(section.title) || section.id}`, "", `\`${section.id}\``, "", itemsOf(section), ""]),
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

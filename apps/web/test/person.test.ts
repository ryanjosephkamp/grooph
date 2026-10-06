import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { isPersonStep, isPlan, parseGraph, validate, type AgentNode, type Graph } from "@grooph/core";
import { describe, expect, it } from "vitest";

import { computeIssues, packageNeeds } from "../src/doc/issues.js";
import { PLAN_TEMPLATES } from "../src/doc/plan-templates.js";
import { PLAN_NOTE, loadPlanTemplates, planTemplates } from "../src/doc/templates.js";
import { nodeLabel } from "../src/ui/canvas/GraphNode.js";
import { doneBy } from "../src/ui/inspector/NodeInspector.js";
import { repoRoot, reviewLoop } from "./helpers.js";

const root = join(repoRoot, "apps/web/src");
const read = (path: string): string => readFileSync(join(root, path), "utf8");
const critic = (doc: Graph): AgentNode => doc.nodes.find((node): node is AgentNode => node.kind === "agent" && node.id === "critic")!;
const withCritic = (doc: Graph, next: AgentNode): Graph => ({ ...doc, nodes: doc.nodes.map((node) => (node.id === "critic" ? next : node)) });

/**
 * Slice 0100, the app's second part (amendment A-020): a step may be a person's. The inspector's switch makes it
 * so, a card says whose step it is, and the plan templates are listed apart, fetched when they are asked for.
 */
describe("a person's step in the app (slice 0100)", () => {
  it("the switch makes a step a person's and takes off what only an agent has, in one edit; back, it is an agent's with no mark", () => {
    const agent: AgentNode = { ...critic(reviewLoop()), model: { tier: "strong", pin: { codex: "x" } as Record<string, string> }, effort: "high", skills: ["house:review"], allow: ["read-files"], deny: ["edit-files"], owns: ["REVIEW.md"] };
    const person = doneBy(agent, "person");
    expect(person.by).toBe("person");
    for (const field of ["model", "effort", "skills", "allow", "deny"] as const) expect(field in person, field).toBe(false);
    // What a step is and does stays: its role, its brief, what it takes, leaves and owns.
    for (const field of ["id", "name", "role", "brief", "inputs", "outputs", "owns"] as const) expect(person[field], field).toEqual(agent[field]);
    expect(isPersonStep(person)).toBe(true);
    // So the validator has nothing to warn of (it warns of an agent's fields left on a person's step).
    const doc = withCritic(reviewLoop(), person);
    expect(parseGraph(doc).issues).toEqual([]);
    expect(validate(doc).map((issue) => issue.code)).not.toContain("W_PERSON_FIELDS_NOT_READ");
    // The other way: an agent's step has no mark at all, as a document that never had one.
    const back = doneBy(person, "agent");
    expect("by" in back).toBe(false);
    expect(isPersonStep(back)).toBe(false);
    expect(doneBy(agent, "agent")).toEqual(agent);
  });

  it("a graph with a person's step is a plan with no error for it, and a package says what it would need", () => {
    const doc = withCritic(reviewLoop(), doneBy(critic(reviewLoop()), "person"));
    expect(isPlan(doc)).toBe(true);
    expect(computeIssues(doc).filter((issue) => issue.severity === "error")).toEqual([]);
    expect(packageNeeds(doc).map((issue) => issue.code)).toEqual(["E_PERSON_STEP_NOT_COMPILED"]);
  });

  it("a card says whose step it is to someone who cannot see it", () => {
    const doc = reviewLoop();
    expect(nodeLabel(critic(doc))).toBe("Agent: Critic");
    expect(nodeLabel(doneBy(critic(doc), "person"))).toBe("Person: Critic");
    // The card itself: the word, the gate's mark, and the role alone (the browser test reads the card).
    const card = read("ui/canvas/GraphNode.tsx");
    expect(card).toContain('`kind-mark kind-${isPersonStep(node) ? "human-gate" : node.kind}`');
    expect(card).toContain("return isPersonStep(node) ? role : [role, node.model?.tier, node.effort].filter(Boolean).join(\" · \");");
  });

  it("the plan templates are the four in plans/, each a plan, and are handed over once they have been asked for", async () => {
    const files = readdirSync(join(repoRoot, "plans")).filter((file) => file.endsWith(".grooph.json"));
    expect(files).toHaveLength(4);
    expect(PLAN_TEMPLATES.map((doc) => `${doc.id}.grooph.json`).sort()).toEqual([...files].sort());
    expect(PLAN_TEMPLATES.map((doc) => doc.template!.title)).toEqual([...PLAN_TEMPLATES.map((doc) => doc.template!.title)].sort((a, b) => a.localeCompare(b)));
    for (const doc of PLAN_TEMPLATES) {
      expect(doc.template, doc.id).toBeDefined();
      expect(doc.nodes.some(isPersonStep), `${doc.id} has no step that is a person's`).toBe(true);
      expect(isPlan(doc), doc.id).toBe(true);
    }
    expect(await loadPlanTemplates()).toBe(PLAN_TEMPLATES);
    expect(planTemplates()).toBe(PLAN_TEMPLATES);
    // What is said of one wherever it is shown claims nothing but what it is and is not.
    expect(PLAN_NOTE).toBe("A plan: a graph a person follows. It has no recorded run, and no package for a harness is made of a graph with a person's step.");
  });

  it("nothing the app starts with, no screen of the canvas and not the embed imports the plans outright: they are asked for at a door", () => {
    const seen = new Set<string>();
    const follow = (file: string): void => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const [, to] of readFileSync(file, "utf8").matchAll(/^(?:import|export)\s(?!type\b)(?:[^;]*?\sfrom\s+)?"([^"]+)";/gm)) {
        if (!to!.startsWith(".")) continue;
        const base = join(dirname(file), to!.replace(/\.js$/, ""));
        const found = [`${base}.ts`, `${base}.tsx`].find((path) => existsSync(path));
        if (found) follow(found);
      }
    };
    for (const start of ["main.tsx", "App.tsx", "ui/screens.ts", "ui/embed/EmbedApp.tsx"]) follow(join(root, start));
    const reached = [...seen].map((file) => file.slice(root.length + 1));
    for (const file of ["ui/templates/TemplatesScreen.tsx", "ui/templates/TemplateView.tsx", "doc/templates.ts"]) expect(reached, `the walk did not reach ${file}`).toContain(file);
    expect(reached, "the plan templates are carried by an address").not.toContain("doc/plan-templates.ts");
    for (const file of seen) expect(/plans\/\*/.test(readFileSync(file, "utf8")), `${file.slice(root.length + 1)} bundles the plans' files`).toBe(false);
    expect(read("doc/templates.ts")).toContain('piece("plan-templates", () => import("./plan-templates.js"))');
    // The list asks only at a press, and a plan's own address when it is opened: no effect fetches them unasked.
    const list = read("ui/templates/TemplatesScreen.tsx");
    expect(list.match(/loadPlanTemplates\(/g)).toHaveLength(1);
    expect(list).toMatch(/const showPlans = \(\): void => \{\s*setPlans\("asking"\);\s*loadPlanTemplates\(\)/);
    expect(list).toContain("onClick={showPlans}");
  });
});

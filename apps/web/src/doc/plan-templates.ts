/**
 * The plan templates (slice 0100): the repository's `plans/` folder, four graphs a person follows, bundled at
 * build time as the built-in templates are (`builtins.ts`).
 *
 * A piece of the app (decision 0021), asked for through `loadPlanTemplates` in `templates.ts`, and only when a
 * person asks to see the plans or opens one: no address loads it first. They are kept apart from the twenty
 * built-in templates, as `plans/README.md` keeps them: none has a recorded run, and a graph made from one is a plan.
 */
import { parseGraph, type Graph } from "@grooph/core";

const files = import.meta.glob<unknown>("../../../../plans/*.grooph.json", { eager: true, import: "default" });

function load(): Graph[] {
  const docs: Graph[] = [];
  for (const [path, json] of Object.entries(files)) {
    const parsed = parseGraph(json);
    // A plan that does not parse is a repo bug the core tests catch; the app skips it rather than failing to start.
    if (parsed.doc?.template) docs.push(parsed.doc);
    else console.warn(`grooph: skipped ${path}: not a template document`);
  }
  return docs.sort((a, b) => a.template!.title.localeCompare(b.template!.title));
}

export const PLAN_TEMPLATES: readonly Graph[] = load();

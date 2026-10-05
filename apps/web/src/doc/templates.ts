/**
 * Templates in the app (handoff 0007, criteria 2–5). The built-in pattern
 * library is bundled at build time from the repo's `patterns/` folder, so the
 * Templates screen needs no network; the person's own templates live on the
 * device beside the graphs (store/templates.ts).
 *
 * The library itself is a piece of the app (`builtins.ts`), fetched when a
 * screen first needs it. What is here is the door to it, and everything about
 * a template that needs no library.
 *
 * Every semantic is core's (docs/templates.md): `instantiate`, `insertFragment`
 * and `extractTemplate` are called as they are.
 */
import { allIds, hasErrors, slotKeys, slugify, uniqueId, validate, type Graph, type Issue, type Profile, type TemplateSlot } from "@grooph/core";

import { piece } from "../piece.js";

/** Where a template came from: the bundled pattern library, or saved on this device. */
export type TemplateSource = "built-in" | "yours";

export type TemplateEntry = { source: TemplateSource; doc: Graph };

let held: readonly Graph[] | undefined;

/**
 * Fetch the built-in templates, once they have come (slice 0093). Asked for as every piece is (`piece.ts`): tried
 * again if the fetch fails, named in the page, and so held by the service worker from the first visit. The app
 * asks before it draws a screen that lists or opens one (`App.tsx`, `main.tsx`), and once its first screen is up,
 * so that the next screen finds them here.
 */
export const loadBuiltIns = (): Promise<readonly Graph[]> => piece("builtins", () => import("./builtins.js")).then((m) => (held = m.BUILT_IN_TEMPLATES));

/** The built-in templates, if they are here: `undefined` until `loadBuiltIns` has brought them. */
export const builtIns = (): readonly Graph[] | undefined => held;

/** Whole-graph templates first, then fragments; each by title. */
export function sortTemplates(docs: readonly Graph[]): Graph[] {
  const rank = (doc: Graph): number => (doc.template?.kind === "fragment" ? 1 : 0);
  return [...docs].sort((a, b) => rank(a) - rank(b) || a.template!.title.localeCompare(b.template!.title));
}

/** One of them by its id, once they are here. */
export const builtInTemplate = (id: string): Graph | undefined => held?.find((doc) => doc.id === id);

/**
 * Why a template may not be kept in Yours: the rule `grooph template save` and
 * `grooph template add` apply, any error from core's `validate`. The issues
 * are all of them, warnings too, as the CLI prints them. `from` is the graph a
 * fragment was cut from; a loop whose members were only partly taken stayed
 * behind, and the hint names the nodes that would bring it along, as the CLI's
 * does. Null when the template may be kept.
 */
export type TemplateRefusal = { issues: Issue[]; hints: string[] };

export function templateRefusal(template: Graph, from?: Graph): TemplateRefusal | null {
  const issues = validate(template);
  if (!hasErrors(issues)) return null;
  const hints: string[] = [];
  const kept = new Set(template.nodes.map((node) => node.id));
  for (const loop of from?.loops ?? []) {
    const outside = loop.members.filter((id) => !kept.has(id));
    if (outside.length > 0 && outside.length < loop.members.length) {
      const named = outside.map((id) => {
        const name = from!.nodes.find((node) => node.id === id)?.name;
        return name ? `${id} (${name})` : id;
      });
      hints.push(`loop "${loop.id}" stayed behind: a loop comes along only with all its members; add ${named.join(", ")} to the selected nodes`);
    }
  }
  return { issues, hints };
}

/** The slots a template asks for, in order, with the question and the example; undeclared `{{key}}`s get a plain question. */
export function slotsOf(template: Graph): TemplateSlot[] {
  const declared = template.template?.slots ?? [];
  return slotKeys(template).map(
    (key) => declared.find((slot) => slot.key === key) ?? { key, ask: `What should "${key}" be?`, example: "" },
  );
}

/** Only the slots given a value: an empty field leaves `{{key}}` in place, for E_UNFILLED_SLOT to point at. */
export function filledValues(values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) if (value.trim() !== "") out[key] = value.trim();
  return out;
}

/**
 * An id for a graph made from a template: the name's slug, unique among the
 * graphs on the device and the ids inside the template (a graph id may not
 * repeat a node's).
 */
export function graphIdFor(name: string, template: Graph, libraryIds: ReadonlySet<string>): string {
  const taken = allIds(template);
  taken.delete(template.id);
  for (const id of libraryIds) taken.add(id);
  return uniqueId(slugify(name, "graph"), taken);
}

export const PROFILE_TEXT: { [K in keyof Profile]: Record<Profile[K], string> } = {
  cost: { low: "Low cost", medium: "Medium cost", high: "High cost" },
  speed: { fast: "Fast", medium: "Medium speed", slow: "Slow" },
  rigor: { light: "Light rigor", standard: "Standard rigor", high: "High rigor" },
};

/** Where each profile value sits on its scale, for the small meter beside it (1–3). */
export const PROFILE_LEVEL: { [K in keyof Profile]: Record<Profile[K], number> } = {
  cost: { low: 1, medium: 2, high: 3 },
  speed: { fast: 3, medium: 2, slow: 1 },
  rigor: { light: 1, standard: 2, high: 3 },
};

export const PROFILE_OPTIONS: { [K in keyof Profile]: Profile[K][] } = {
  cost: ["low", "medium", "high"],
  speed: ["fast", "medium", "slow"],
  rigor: ["light", "standard", "high"],
};

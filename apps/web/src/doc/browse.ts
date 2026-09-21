/**
 * Browsing the template library (slice 0015): search, filters and sort over
 * the fields the index already carries (docs/templates.md §3), nothing new
 * on the documents. Pure; the screen keeps the state and persists it per
 * viewer in browser storage.
 */
import type { Graph, Profile, TemplateKind } from "@grooph/core";

import { PROFILE_LEVEL } from "./templates.js";

export type SortKey = "name" | "cost" | "speed" | "rigor";

export type Browse = {
  /** free text; every whitespace-separated term must appear in the title, summary, when-to-use, tags or id */
  q: string;
  /** any of, per axis; empty means no filter on that axis */
  kind: TemplateKind[];
  cost: Profile["cost"][];
  speed: Profile["speed"][];
  rigor: Profile["rigor"][];
  /** all of */
  tags: string[];
  sort: SortKey;
  /** whether the filter panel is open */
  open: boolean;
};

export const EMPTY_BROWSE: Browse = { q: "", kind: [], cost: [], speed: [], rigor: [], tags: [], sort: "name", open: false };

export const SORT_LABEL: Record<SortKey, string> = { name: "Name", cost: "Cost, low first", speed: "Speed, fast first", rigor: "Rigor, high first" };

/** The number of filters set (search and sort aside), for the Filters button's count. */
export const activeFilters = (b: Browse): number => b.kind.length + b.cost.length + b.speed.length + b.rigor.length + b.tags.length;

export const isDefault = (b: Browse): boolean => b.q.trim() === "" && activeFilters(b) === 0 && b.sort === "name";

const terms = (q: string): string[] => q.toLowerCase().split(/\s+/).filter((t) => t !== "");

/** What search reads: title, summary, when-to-use, tags and the id. Not `notFor`, which says the opposite of what a search asks. */
const haystack = (doc: Graph): string => {
  const t = doc.template!;
  return [t.title, t.summary, t.whenToUse, ...(t.tags ?? []), doc.id].join("\n").toLowerCase();
};

export function matches(doc: Graph, b: Browse): boolean {
  const t = doc.template!;
  if (b.kind.length > 0 && !b.kind.includes(t.kind)) return false;
  if (b.cost.length > 0 && !b.cost.includes(t.profile.cost)) return false;
  if (b.speed.length > 0 && !b.speed.includes(t.profile.speed)) return false;
  if (b.rigor.length > 0 && !b.rigor.includes(t.profile.rigor)) return false;
  if (b.tags.length > 0 && !b.tags.every((tag) => (t.tags ?? []).includes(tag))) return false;
  const text = terms(b.q);
  if (text.length === 0) return true;
  const hay = haystack(doc);
  return text.every((term) => hay.includes(term));
}

/** Low cost first, fast first, high rigor first; the title breaks ties, and the name sort is the title alone. */
export function compare(a: Graph, b: Graph, sort: SortKey): number {
  const ta = a.template!;
  const tb = b.template!;
  const byTitle = ta.title.localeCompare(tb.title);
  if (sort === "name") return byTitle;
  const level = (t: typeof ta): number => PROFILE_LEVEL[sort][t.profile[sort] as never];
  // PROFILE_LEVEL counts up the meter: cost low = 1, speed fast = 3, rigor high = 3.
  const direction = sort === "cost" ? 1 : -1;
  return (level(ta) - level(tb)) * direction || byTitle;
}

export function browse(docs: readonly Graph[], b: Browse): Graph[] {
  return docs.filter((doc) => matches(doc, b)).sort((x, y) => compare(x, y, b.sort));
}

/** Every tag in use, most used first, then by name. */
export function allTags(docs: readonly Graph[]): string[] {
  const counts = new Map<string, number>();
  for (const doc of docs) for (const tag of doc.template?.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag);
}

/** Toggle a value in a list filter. */
export const toggled = <T>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

// ─── per-viewer persistence ───────────────────────────────────────────────

export const BROWSE_KEY = "grooph.templates.browse";

const isList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** The saved state, or the default; anything unreadable is the default (a private window, cleared data, an old shape). */
export function loadBrowse(): Browse {
  try {
    const raw = localStorage.getItem(BROWSE_KEY);
    if (raw === null) return EMPTY_BROWSE;
    const saved = JSON.parse(raw) as Partial<Record<keyof Browse, unknown>>;
    const list = <T extends string>(v: unknown, allowed?: readonly T[]): T[] =>
      isList(v) ? (v as T[]).filter((x) => allowed === undefined || allowed.includes(x)) : [];
    return {
      q: typeof saved.q === "string" ? saved.q : "",
      kind: list(saved.kind, ["graph", "fragment"]),
      cost: list(saved.cost, ["low", "medium", "high"]),
      speed: list(saved.speed, ["fast", "medium", "slow"]),
      rigor: list(saved.rigor, ["light", "standard", "high"]),
      tags: list(saved.tags),
      sort: typeof saved.sort === "string" && saved.sort in SORT_LABEL ? (saved.sort as SortKey) : "name",
      open: saved.open === true,
    };
  } catch {
    return EMPTY_BROWSE;
  }
}

export function saveBrowse(b: Browse): void {
  try {
    if (isDefault(b) && !b.open) localStorage.removeItem(BROWSE_KEY);
    else localStorage.setItem(BROWSE_KEY, JSON.stringify(b));
  } catch {
    // Storage refused: the selection lasts for this screen only.
  }
}

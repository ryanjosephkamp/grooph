/**
 * Adoption held to the graph's brakes (amendment A-008, decision 0008).
 *
 * A run amends only its own working copy, and may tighten a brake and never loosen one. That was a sentence in the
 * lead's brief and nothing checked it: `grooph adopt --write` took a working copy whose round cap and budget had
 * been raised and wrote it as the next version (found by the audit of 0.3.0's claims, round 01, F6). Here the
 * document adoption would write is compared with the source it would replace, by the comparison a subgrooph's
 * refresh is held to (`brakes.ts`): on the whole graph, not change by change. The adaptation level, which is on
 * A-008's list and which a refresh never touches, is compared beside it.
 *
 * Adoption is whole: the working copy becomes the next version or it does not. So nothing is held back and the rest
 * applied, as a refresh does; while one change that loosens a brake has not been asked for by its name, the
 * adoption is refused, and each such change is named with its reasons.
 *
 * Pure. Not on the web app's way in: it brings `brakes.ts` and `reach.ts` with it.
 */

import { brakesLost, roundsLeftToAPerson, type Loss } from "./brakes.js";
import { effectiveAdaptation } from "./semantics.js";
import type { Graph, Id } from "./types.js";

export type AdoptionChange = {
  /** what to ask for by name, as a refresh names a change: `loop:sandwich.stops`, `node:critic`, `edge:e-a-b.approval`, `graph:adaptation` */
  name: string;
  kind: "add" | "remove" | "change";
  /** set when the change removes or loosens a brake: why, each reason once */
  loosens?: string;
  /** set when undoing the change would remove or loosen a brake, which is to say it tightens one: what undoing it would do */
  tightens?: string;
};

export type AdoptionCheck = {
  /** every difference between the source and the document that would be written, those that loosen a brake first */
  changes: AdoptionChange[];
  /** the changes that loosen a brake and were not asked for by name: adoption is refused while there is one */
  refused: AdoptionChange[];
  /** names asked for that are no change this run made */
  unknown: string[];
  /** what is not refused and is still to be said: a loop whose cap would count the rounds between a person's decisions */
  notices: string[];
};

const json = (value: unknown): string => JSON.stringify(value);
const LEVELS = ["fixed", "propose", "adaptive"] as const;

/** What adoption sets itself, or what carries no meaning for a run: never a change the run made. */
const NOT_THE_RUNS = new Set(["grooph", "id", "name", "version", "lineage", "notes", "layout", "nodes", "edges", "loops", "policies", "groups"]);

/** Every difference between two documents, named as `refreshSubgrooph` names a change. */
function changesBetween(before: Graph, after: Graph): AdoptionChange[] {
  const changes: AdoptionChange[] = [];
  const lists: [string, { id: Id }[], { id: Id }[]][] = [
    ["node", before.nodes, after.nodes],
    ["edge", before.edges, after.edges],
    ["loop", before.loops, after.loops],
    ["policy", before.policies ?? [], after.policies ?? []],
    ["group", before.groups ?? [], after.groups ?? []],
  ];
  for (const [object, was, now] of lists) {
    const next = new Map(now.map((item) => [item.id, item as Record<string, unknown>]));
    const known = new Set(was.map((item) => item.id));
    for (const item of was as Record<string, unknown>[]) {
      const other = next.get(item["id"] as Id);
      if (!other) {
        changes.push({ name: `${object}:${item["id"]}`, kind: "remove" });
        continue;
      }
      for (const field of new Set([...Object.keys(item), ...Object.keys(other)])) {
        if (field !== "id" && json(item[field]) !== json(other[field])) changes.push({ name: `${object}:${item["id"]}.${field}`, kind: "change" });
      }
    }
    for (const item of now) if (!known.has(item.id)) changes.push({ name: `${object}:${item.id}`, kind: "add" });
  }
  const a = before as unknown as Record<string, unknown>;
  const b = after as unknown as Record<string, unknown>;
  for (const field of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!NOT_THE_RUNS.has(field) && json(a[field]) !== json(b[field])) changes.push({ name: `graph:${field}`, kind: "change" });
  }
  return changes;
}

/** The adaptation level, loosened: from following the graph exactly towards changing it during a run (A-008). */
function adaptationLost(before: Graph, after: Graph): Loss[] {
  const [was, now] = [effectiveAdaptation(before), effectiveAdaptation(after)];
  if (LEVELS.indexOf(now) <= LEVELS.indexOf(was)) return [];
  // Laid at the field when it moved; otherwise a policy that said "propose" went, and `brakesLost` names that.
  return [{ why: `the adaptation level would go from "${was}" to "${now}": the lead may change more of the graph during a run`, at: json(before.adaptation) !== json(after.adaptation) ? ["graph:adaptation"] : [] }];
}

/** Every brake `after` has lost or loosened that `before` had, the adaptation level among them. */
const lost = (before: Graph, after: Graph): Loss[] => [...brakesLost(before, after), ...adaptationLost(before, after)];

/**
 * The document adoption would write (`adoptWorkingCopy(...).doc`), held to the brakes of the source it would
 * replace. `allow` names the changes that loosen a brake and are meant.
 *
 * A loss is laid at the changes that may have caused it, as a refresh lays it; where no change can be named for
 * one, any change may be the cause, and each carries it. A change that tightens a brake is marked, by asking the
 * same comparison the other way round: what would undoing it lose.
 */
export function checkAdoption(source: Graph, adopted: Graph, options: { allow?: readonly string[] } = {}): AdoptionCheck {
  let changes = changesBetween(source, adopted);
  const names = new Set(changes.map((change) => change.name));
  const lay = (losses: readonly Loss[], key: "loosens" | "tightens", unnamed: boolean): void => {
    for (const loss of losses) {
      // A line that is held whichever way the change goes says nothing about what undoing it would lose.
      if (key === "tightens" && loss.either) continue;
      const named = new Set(loss.at.filter((name) => names.has(name)));
      if (named.size === 0 && !unnamed) continue;
      changes = changes.map((change) => {
        if ((named.size > 0 && !named.has(change.name)) || (change[key] ?? "").split("; ").includes(loss.why)) return change;
        // A change that reads the same both ways (an acceptance reworded) is said once, as what it may loosen. And a
        // loop that is new bounds only what it brings: undoing it "removes a loop with its stops", and tightens nothing.
        if (key === "tightens" && ((change.loosens ?? "").split("; ").includes(loss.why) || (change.kind === "add" && change.name.startsWith("loop:")))) return change;
        return { ...change, [key]: change[key] === undefined ? loss.why : `${change[key]}; ${loss.why}` };
      });
    }
  };
  lay(lost(source, adopted), "loosens", true);
  // Only where a change can be named for it: "every change tightens something" would say nothing.
  lay(lost(adopted, source), "tightens", false);
  changes.sort((x, y) => Number(y.loosens !== undefined) - Number(x.loosens !== undefined));
  const allow = new Set(options.allow ?? []);
  return {
    changes,
    refused: changes.filter((change) => change.loosens !== undefined && !allow.has(change.name)),
    unknown: [...allow].filter((name) => !names.has(name)),
    notices: roundsLeftToAPerson(source, adopted),
  };
}

/**
 * The command that adopts a run with these changes asked for by name: what `grooph adopt` prints when it refuses,
 * and what the app shows to copy. One function, so that the two cannot drift; a test runs what it returns.
 */
export function adoptCommandLine(run: string, allow: readonly string[], into?: string): string {
  const word = (text: string): string => (/^[A-Za-z0-9_.:/@=+-]+$/.test(text) ? text : `'${text.replace(/'/g, "'\\''")}'`);
  return ["grooph", "adopt", word(run), ...(into === undefined ? [] : ["--into", word(into)]), "--write", ...allow.flatMap((name) => ["--allow", word(name)])].join(" ");
}

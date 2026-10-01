/**
 * Operation maps (docs/operation-map.md; amendment A-011): sessions, the
 * handoffs between them, and the lanes they run in. Pure, like the rest of
 * core. A map is parsed, validated, canonicalized and drawn; nothing here
 * compiles one, because a map is never run.
 */

import type { Severity } from "./issues.js";
import { nearestIds } from "./parse.js";
import type { UnknownKey } from "./schema/dsl.js";
import { mapSchema } from "./schema/map.js";
import { didYouMean } from "./suggest.js";
import type { Carrier, CarrierKind, Handoff, Id, Lane, OperationMap, Session } from "./types.js";
import { DOC_SIZE_LIMIT } from "./validate.js";

/** The codes a map can raise (docs/operation-map.md §3). The first three and the last two keep their graph-ir meaning. */
export type MapIssueCode =
  | "E_SCHEMA"
  | "E_DUPLICATE_ID"
  | "E_DANGLING_REF"
  | "E_HANDOFF_NO_CARRIER"
  | "W_CARRIER_CANNOT_CROSS"
  | "W_SESSION_ISLAND"
  | "W_NO_RETURN"
  | "W_GRAPH_UNRESOLVED"
  | "W_UNKNOWN_KEY"
  | "W_DOC_TOO_LARGE";

/** Every map rule, in table order. Each has a failing fixture under `fixtures/maps/invalid/`. */
export const MAP_CODES = [
  "E_SCHEMA",
  "E_DUPLICATE_ID",
  "E_DANGLING_REF",
  "E_HANDOFF_NO_CARRIER",
  "W_CARRIER_CANNOT_CROSS",
  "W_SESSION_ISLAND",
  "W_NO_RETURN",
  "W_GRAPH_UNRESOLVED",
  "W_UNKNOWN_KEY",
  "W_DOC_TOO_LARGE",
] as const satisfies readonly MapIssueCode[];

/** The same shape as a graph issue, so one printer and one panel serve both. */
export type MapIssue = { code: MapIssueCode; severity: Severity; message: string; at: Id[] };

const issue = (code: MapIssueCode, message: string, at: Id[] = []): MapIssue => ({
  code,
  severity: code.startsWith("E_") ? "error" : "warning",
  message,
  at,
});

export type MapParseResult = { map?: OperationMap; issues: MapIssue[] };

/** Check an unknown JSON value against the map schema: `E_SCHEMA` issues naming the path, or the map. */
export function parseMap(json: unknown): MapParseResult {
  const found: { path: string; message: string }[] = [];
  mapSchema.check(json, "", found);
  if (found.length > 0) {
    return { issues: found.map((f) => issue("E_SCHEMA", `${f.path === "" ? "/" : f.path}: ${f.message}`, nearestIds(json, f.path))) };
  }
  return { map: json as OperationMap, issues: [] };
}

/** Parse JSON text, reporting a syntax error as `E_SCHEMA` too. */
export function parseMapText(text: string): MapParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    return { issues: [issue("E_SCHEMA", `/: not valid JSON: ${(err as Error).message}`)] };
  }
  return parseMap(json);
}

/** Whether a parsed JSON value is meant as a map rather than a graph: the one key that tells them apart. */
export const isMapLike = (json: unknown): boolean => typeof json === "object" && json !== null && !Array.isArray(json) && "groophMap" in json;

/** Canonical form (docs/operation-map.md §5), as a graph's. */
export function canonicalizeMap(map: OperationMap): string {
  return `${JSON.stringify(mapSchema.canon(map), null, 2)}\n`;
}

// ─── carriers ─────────────────────────────────────────────────────────────

/** What each carrier kind is called where a person reads it. */
export const CARRIER_LABEL: Record<CarrierKind, string> = {
  branch: "branch",
  "pull-request": "pull request",
  "session-message": "session message",
  "scheduled-message": "scheduled message",
  "review-page": "review page",
  person: "person",
  other: "other",
};

const blank = (text: string | undefined): boolean => text === undefined || text.trim() === "";

/** The field that names a carrier, and whether it is filled; a session or scheduled message is named by its kind. */
function carrierName(carrier: Carrier): { field?: string; value?: string } {
  switch (carrier.kind) {
    case "branch":
    case "pull-request":
      return { field: "repo", value: carrier.repo };
    case "review-page":
      return { field: "where", value: carrier.where };
    case "person":
      return { field: "who", value: carrier.who };
    case "other":
      return { field: "name", value: carrier.name };
    case "session-message":
    case "scheduled-message":
      return {};
  }
}

/** One line for a carrier: "branch main on ryan/app", "carried by Ryan". Empty when it names nothing. */
export function carrierText(carrier: Carrier | undefined): string {
  if (!carrier) return "";
  switch (carrier.kind) {
    case "branch":
      return blank(carrier.repo) ? "" : `branch ${blank(carrier.ref) ? "" : `${carrier.ref} `}on ${carrier.repo}`;
    case "pull-request":
      return blank(carrier.repo) ? "" : `pull request on ${carrier.repo}`;
    case "session-message":
      return "session message";
    case "scheduled-message":
      return blank(carrier.schedule) ? "scheduled message" : `scheduled message, ${carrier.schedule}`;
    case "review-page":
      return blank(carrier.where) ? "" : `review page: ${carrier.where}`;
    case "person":
      return blank(carrier.who) ? "" : `carried by ${carrier.who}`;
    case "other":
      return blank(carrier.name) ? "" : carrier.name!;
  }
}

// ─── validation ───────────────────────────────────────────────────────────

export type ValidateMapOptions = {
  /**
   * Look a session's `graph` pointer up, where the caller can (the CLI, for a
   * path beside the map). Return false when it does not lead to a graph
   * document; undefined when it cannot be checked from here (a URL, an id).
   */
  resolveGraph?: (ref: string, session: Session) => boolean | undefined;
};

/** The map rules (docs/operation-map.md §3), in table order. */
export function validateMap(map: OperationMap, options: ValidateMapOptions = {}): MapIssue[] {
  const parsed = parseMap(map);
  if (!parsed.map) return parsed.issues;

  const lanes = new Map<Id, Lane>(map.lanes.map((l) => [l.id, l]));
  const sessions = new Map<Id, Session>(map.sessions.map((s) => [s.id, s]));
  const issues: MapIssue[] = [];

  // E_DUPLICATE_ID
  const places = new Map<Id, string[]>();
  const place = (id: Id, where: string) => places.set(id, [...(places.get(id) ?? []), where]);
  place(map.id, "the map's own id");
  map.lanes.forEach((l, i) => place(l.id, `lanes[${i}]`));
  map.sessions.forEach((s, i) => place(s.id, `sessions[${i}]`));
  map.handoffs.forEach((h, i) => place(h.id, `handoffs[${i}]`));
  for (const [id, where] of places) {
    if (where.length > 1) issues.push(issue("E_DUPLICATE_ID", `id "${id}" is used ${where.length} times: ${where.join(", ")}`, [id]));
  }

  // E_DANGLING_REF
  for (const s of map.sessions) {
    if (!lanes.has(s.lane)) {
      issues.push(issue("E_DANGLING_REF", `session "${s.id}" is in unknown lane "${s.lane}"${didYouMean(s.lane, [...lanes.keys()])}`, [s.id]));
    }
  }
  for (const h of map.handoffs) {
    for (const [end, id] of [["starts at", h.from], ["ends at", h.to]] as const) {
      if (!sessions.has(id)) {
        issues.push(issue("E_DANGLING_REF", `handoff "${h.id}" ${end} unknown session "${id}"${didYouMean(id, [...sessions.keys()])}`, [h.id]));
      }
    }
  }

  // E_HANDOFF_NO_CARRIER
  for (const h of map.handoffs) {
    const ends = `"${h.from}" → "${h.to}"`;
    if (!h.carrier) {
      issues.push(
        issue(
          "E_HANDOFF_NO_CARRIER",
          `handoff "${h.id}" (${ends}) names no carrier; say what moves the work across: a branch, a pull-request, a session-message, a scheduled-message, a review-page, a person, or other`,
          [h.id],
        ),
      );
      continue;
    }
    const name = carrierName(h.carrier);
    if (name.field !== undefined && blank(name.value)) {
      issues.push(
        issue(
          "E_HANDOFF_NO_CARRIER",
          `handoff "${h.id}" (${ends}) is carried by a ${CARRIER_LABEL[h.carrier.kind]} that is not named; set carrier.${name.field}`,
          [h.id],
        ),
      );
    }
  }

  // W_CARRIER_CANNOT_CROSS
  for (const h of map.handoffs) {
    const from = sessions.get(h.from);
    const to = sessions.get(h.to);
    if (!h.carrier || !from || !to) continue;
    const fromLane = lanes.get(from.lane);
    const toLane = lanes.get(to.lane);
    const accounts = fromLane && toLane && fromLane.account !== toLane.account ? `accounts "${fromLane.account}" and "${toLane.account}"` : undefined;
    const harnesses = from.harness !== to.harness ? `harnesses "${from.harness}" and "${to.harness}"` : undefined;
    const kind = h.carrier.kind;
    const inHarness = kind === "session-message" || kind === "scheduled-message";
    const gap = inHarness ? (accounts ?? harnesses) : kind === "review-page" ? accounts : undefined;
    if (gap === undefined) continue;
    const why = inHarness ? `a ${CARRIER_LABEL[kind]} stays inside one harness and one account` : "a published page belongs to the account that published it";
    issues.push(
      issue(
        "W_CARRIER_CANNOT_CROSS",
        `handoff "${h.id}" ("${h.from}" → "${h.to}") crosses ${gap} by ${CARRIER_LABEL[kind]}; ${why}, so something else carries this: a branch, a pull request, or a person`,
        [h.id, h.from, h.to],
      ),
    );
  }

  // W_SESSION_ISLAND, W_NO_RETURN
  const outbound = new Set(map.handoffs.map((h) => h.from));
  const inbound = new Set(map.handoffs.map((h) => h.to));
  for (const s of map.sessions) {
    if (!outbound.has(s.id) && !inbound.has(s.id)) {
      issues.push(issue("W_SESSION_ISLAND", `session "${s.id}" has no handoff in or out: nothing reaches it and it reaches nothing`, [s.id]));
    }
  }
  for (const s of map.sessions) {
    if (inbound.has(s.id) && !outbound.has(s.id)) {
      issues.push(
        issue("W_NO_RETURN", `session "${s.id}" is handed work and hands nothing on: add the handoff its results leave by, and name the carrier`, [s.id]),
      );
    }
  }

  // W_GRAPH_UNRESOLVED
  if (options.resolveGraph) {
    for (const s of map.sessions) {
      if (s.graph !== undefined && options.resolveGraph(s.graph, s) === false) {
        issues.push(issue("W_GRAPH_UNRESOLVED", `session "${s.id}" points at graph "${s.graph}", which is not a graph document that could be read`, [s.id]));
      }
    }
  }

  // W_UNKNOWN_KEY
  const unknown: UnknownKey[] = [];
  mapSchema.unknownKeys(map, "", unknown);
  for (const u of unknown) {
    issues.push(issue("W_UNKNOWN_KEY", `${u.path === "" ? "/" : u.path}: unknown key "${u.key}"${didYouMean(u.key, u.known)}`, nearestIds(map, u.path)));
  }

  // W_DOC_TOO_LARGE
  const size = canonicalizeMap(map).length;
  if (size > DOC_SIZE_LIMIT) {
    issues.push(
      issue(
        "W_DOC_TOO_LARGE",
        `the map is ${size.toLocaleString("en")} characters in canonical form, over the ${DOC_SIZE_LIMIT.toLocaleString("en")} a model rewrites in one pass; draw families as one session with a count, or split the map`,
        [map.id],
      ),
    );
  }

  return issues;
}

// ─── shape ────────────────────────────────────────────────────────────────

/** A map at a glance: the counts a card, the CLI and the picture's caption show. */
export type MapShape = {
  lanes: number;
  /** nodes on the map */
  sessions: number;
  /** sessions counting each family's members */
  sessionsCounted: number;
  handoffs: number;
  /** handoffs per carrier kind; `none` for a handoff that names no carrier */
  carriers: Partial<Record<CarrierKind | "none", number>>;
  harnesses: Record<string, number>;
  /** handoffs whose two sessions are in different lanes */
  crossLane: number;
  /** the handoffs a person carries, in document order: each moves only when that person moves it */
  byHand: { handoff: Id; from: Id; to: Id; who: string }[];
};

export function mapShape(map: OperationMap): MapShape {
  const sessions = new Map(map.sessions.map((s) => [s.id, s]));
  const carriers: MapShape["carriers"] = {};
  for (const h of map.handoffs) {
    const kind = h.carrier?.kind ?? "none";
    carriers[kind] = (carriers[kind] ?? 0) + 1;
  }
  const harnesses: Record<string, number> = {};
  for (const s of map.sessions) harnesses[s.harness] = (harnesses[s.harness] ?? 0) + (s.count ?? 1);
  return {
    lanes: map.lanes.length,
    sessions: map.sessions.length,
    sessionsCounted: map.sessions.reduce((sum, s) => sum + (s.count ?? 1), 0),
    handoffs: map.handoffs.length,
    carriers,
    harnesses,
    crossLane: map.handoffs.filter((h) => {
      const from = sessions.get(h.from);
      const to = sessions.get(h.to);
      return from !== undefined && to !== undefined && from.lane !== to.lane;
    }).length,
    byHand: map.handoffs.flatMap((h) => (h.carrier?.kind === "person" ? [{ handoff: h.id, from: h.from, to: h.to, who: h.carrier.who ?? "" }] : [])),
  };
}

/**
 * The handoffs that wait on a person, one line each. Not an issue: a map that says so is a true map. It is said
 * beside the issues because these are where work stalls when that person is away.
 */
export function byHandLines(shape: MapShape): string[] {
  return shape.byHand.map((h) => `by hand  ${h.handoff}  ${h.from} → ${h.to}: moves only when ${h.who === "" ? "a person" : h.who} carries it`);
}

/** One line for a map's shape: "4 lanes · 9 sessions (24 counting families) · 12 handoffs, 3 carried by a person". */
export function mapShapeLine(shape: MapShape): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const families = shape.sessionsCounted !== shape.sessions ? ` (${shape.sessionsCounted} counting families)` : "";
  const byPerson = shape.carriers.person ?? 0;
  return `${plural(shape.lanes, "lane")} · ${plural(shape.sessions, "session")}${families} · ${plural(shape.handoffs, "handoff")}${byPerson > 0 ? `, ${byPerson} carried by a person` : ""}`;
}

/** The handoffs that touch a session, for a details panel. */
export function handoffsOf(map: OperationMap, session: Id): { out: Handoff[]; in: Handoff[] } {
  return { out: map.handoffs.filter((h) => h.from === session), in: map.handoffs.filter((h) => h.to === session) };
}

/**
 * How large a document grooph opens and draws (docs/security.md, "Size"). A link, a file or a paste is someone
 * else's text, and one with a hundred thousand nodes would hold a phone still for minutes while it is laid out and
 * drawn. So a document over these is refused before anything is drawn, with a message that says so. Loops and groups
 * are held by their members in all as well as by their number, and loops by their stops in all: 200 groups that each
 * list every node is a small file and a long wait.
 *
 * The largest real ones in the repository are far smaller: a graph of 12 nodes and 13 edges, and maps of up to 9
 * sessions and 23 handoffs. On an Apple M3 Pro laptop a graph at the caps draws flat in about 35 ms, and its slowest
 * 3D view, the spiral, takes about a second, or two and a half when every loop's spiral is drawn its full fifty
 * rounds. At twice the caps the 3D views take several seconds, and a phone is slower again.
 */
export const GRAPH_LIMITS = { nodes: 500, edges: 2_000, loops: 200, groups: 200, loopMembers: 2_000, groupMembers: 2_000, loopStops: 2_000 } as const;
export const MAP_LIMITS = { sessions: 200, handoffs: 1_000, lanes: 100, people: 100 } as const;

const count = (n: number): string => n.toLocaleString("en");

/**
 * The refusal for a document over a cap, or undefined: where (a JSON pointer) and what to say, in words true wherever
 * it is shown. It reads only the lengths of the arrays it finds, so it is safe on anything, and runs before the schema.
 */
export function overLimit(json: unknown, kind: "graph" | "map"): { path: string; message: string } | undefined {
  if (json === null || typeof json !== "object" || Array.isArray(json)) return undefined;
  const doc = json as Record<string, unknown>;
  /** How many of a list the entries of an array hold in all (members, stops), as far as they say. */
  const inAll = (key: string, list: string): number =>
    Array.isArray(doc[key]) ? (doc[key] as unknown[]).reduce((n: number, item) => n + (item !== null && typeof item === "object" ? lengthOf((item as Record<string, unknown>)[list]) : 0), 0) : 0;
  const counts: [path: string, what: string, found: number, limit: number][] =
    kind === "graph"
      ? [
          ["/nodes", "nodes", lengthOf(doc["nodes"]), GRAPH_LIMITS.nodes],
          ["/edges", "edges", lengthOf(doc["edges"]), GRAPH_LIMITS.edges],
          ["/loops", "loops", lengthOf(doc["loops"]), GRAPH_LIMITS.loops],
          ["/groups", "groups", lengthOf(doc["groups"]), GRAPH_LIMITS.groups],
          ["/loops", "members of loops in all", inAll("loops", "members"), GRAPH_LIMITS.loopMembers],
          ["/groups", "members of groups in all", inAll("groups", "members"), GRAPH_LIMITS.groupMembers],
          ["/loops", "stops of loops in all", inAll("loops", "stops"), GRAPH_LIMITS.loopStops],
        ]
      : [
          ["/sessions", "sessions", lengthOf(doc["sessions"]), MAP_LIMITS.sessions],
          ["/handoffs", "handoffs", lengthOf(doc["handoffs"]), MAP_LIMITS.handoffs],
          ["/lanes", "lanes", lengthOf(doc["lanes"]), MAP_LIMITS.lanes],
          ["/people", "people", lengthOf(doc["people"]), MAP_LIMITS.people],
        ];
  for (const [path, what, found, limit] of counts) {
    if (found <= limit) continue;
    return { path, message: `${count(found)} ${what}, more than the ${count(limit)} grooph draws in ${kind === "graph" ? "a graph" : "a map"}` };
  }
  return undefined;
}

const lengthOf = (value: unknown): number => (Array.isArray(value) ? value.length : 0);

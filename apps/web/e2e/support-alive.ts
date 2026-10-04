import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import { buildRunBundle, parseEvents, parseGraphText, parseMapText, summarizeSessions, type LiveView, type OperationMap, type RunBundle, type SessionEvent } from "@grooph/core";
import type { Page } from "@playwright/test";

import { repoRoot } from "./support.js";

/** What handoff 0062's tests and screenshots share: the sample map, sessions in every state, a kept run, and a site with no watch. */

export const desktop = { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 } as const;

export const mapNamed = (name: string): OperationMap => parseMapText(readFileSync(join(repoRoot, "fixtures/maps/valid", name), "utf8")).map!;
/** The map `grooph share fixtures/maps/valid/owner-operation-2026-10-01.grooph-map.json` sends. */
export const sampleMap = (): OperationMap => mapNamed("owner-operation-2026-10-01.grooph-map.json");

export const eventsOf = (name: string, source?: string): (SessionEvent & { source?: string })[] =>
  parseEvents(readFileSync(join(repoRoot, "fixtures/events", name), "utf8")).events.map((e) => (source ? { ...e, source } : e));

export const viewOf = (events: SessionEvent[], at: string): LiveView => ({ groophLive: 0, at, sessions: summarizeSessions([...events].sort((a, b) => (a.t < b.t ? -1 : 1))) });

/** When the recordings in fixtures/events are read: ten seconds after the last line of the one still running. */
export const AT = "2026-10-01T02:01:10.000Z";

/**
 * Sessions in each of the four states at `AT`: the recording caught mid-flight (working), one whose turn has ended
 * (waiting), one that said nothing for two hours (gone quiet), and the recordings that ended.
 */
export function sessionsView(): LiveView {
  const line = (session: string, cwd: string, t: string, event: SessionEvent["event"], more: Partial<SessionEvent> = {}): SessionEvent => ({ v: 1, t, harness: "claude-code", event, session, cwd, ...more });
  const waiting = "77777777-aaaa-4bbb-8ccc-eeeeeeeeeeee";
  const silent = "99999999-aaaa-4bbb-8ccc-dddddddddddd";
  return viewOf(
    [
      ...eventsOf("claude-code-running.jsonl"),
      line(waiting, "/work/site", "2026-10-01T01:58:00.000Z", "session-start"),
      line(waiting, "/work/site", "2026-10-01T01:58:01.000Z", "turn-start"),
      line(waiting, "/work/site", "2026-10-01T02:00:40.000Z", "turn-end"),
      line(silent, "/work/cloud-lane", "2026-09-30T23:40:00.000Z", "session-start"),
      line(silent, "/work/cloud-lane", "2026-09-30T23:40:02.000Z", "turn-start"),
      line(silent, "/work/cloud-lane", "2026-09-30T23:41:00.000Z", "subagent-start", { agent: "z01", type: "general-purpose" }),
      ...eventsOf("claude-code-planned.jsonl"),
      ...eventsOf("codex-two-subagents.jsonl"),
    ],
    AT,
  );
}

export async function stubSessions(page: Page, view: LiveView): Promise<void> {
  await page.route("**/grooph/api/live.json", (route) => route.fulfill({ status: 200, contentType: "application/json; charset=utf-8", body: JSON.stringify(view) }));
}

/** A run kept under experiments/patterns, as `grooph runs bundle` builds one from a placed package. */
export function patternRun(pattern: string): RunBundle {
  const base = join(repoRoot, "experiments/patterns", pattern, "run");
  const run = readdirSync(join(base, "runs"))[0]!;
  const graph = (path: string) => parseGraphText(readFileSync(path, "utf8")).doc!;
  return buildRunBundle({
    source: graph(join(base, "package/graph.grooph.json")),
    working: graph(join(base, "runs", run, "graph.grooph.json")),
    notesText: readFileSync(join(base, "runs", run, "notes.jsonl"), "utf8"),
    run,
    progress: readFileSync(join(base, "runs", run, "PROGRESS.md"), "utf8"),
  });
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

/**
 * The built app at an https address of its own, as a static host serves it: the files in dist, and a 404 for
 * anything else, the sessions endpoint included. It sends a referrer policy of its own, as many hosts do. With
 * `watch`, it is `grooph watch` behind a proxy instead: the same files with the header watch sends on every answer,
 * to which the proxy has added its own value, and the sessions. Returns the app's address.
 */
export async function httpsSite(page: Page, watch?: LiveView): Promise<string> {
  const dist = join(repoRoot, "apps/web/dist");
  const headers: Record<string, string> = watch ? { "referrer-policy": "no-referrer, same-origin", "x-content-type-options": "nosniff" } : { "referrer-policy": "no-referrer-when-downgrade" };
  await page.route("https://grooph.test/**", (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    const head = route.request().method() === "HEAD";
    if (watch && path === "/grooph/api/live.json") return route.fulfill({ status: 200, contentType: TYPES[".json"]!, headers, body: JSON.stringify(watch) });
    const file = join(dist, path.replace(/^\/grooph\/?/, "") || "index.html");
    if (!path.startsWith("/grooph/") || !existsSync(file) || !statSync(file).isFile()) return route.fulfill({ status: 404, contentType: TYPES[".html"]!, headers, body: head ? "" : "<h1>404</h1>" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(file)] ?? "application/octet-stream", headers, body: head ? "" : readFileSync(file) });
  });
  return "https://grooph.test/grooph/";
}

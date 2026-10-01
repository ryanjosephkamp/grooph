import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseEvents, summarizeSessions, type LiveView, type SessionEvent } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";

import { bundleText, repoRoot, runBadge, runBundle, runNode } from "./support.js";

/**
 * Slice 0027: the live view of sessions and their subagents, from what the
 * event hook recorded (docs/subagents.md). `grooph watch` is stubbed with
 * views built by core from the recordings in fixtures/events/, two of which
 * are real sessions, one from each harness.
 */
const eventsOf = (name: string, source?: string): (SessionEvent & { source?: string })[] =>
  parseEvents(readFileSync(join(repoRoot, "fixtures/events", name), "utf8")).events.map((e) => (source ? { ...e, source } : e));

const view = (events: (SessionEvent & { source?: string })[], at: string): LiveView => ({ groophLive: 0, at, sessions: summarizeSessions([...events].sort((a, b) => (a.t < b.t ? -1 : 1))) });

/** Serve `views` in turn from the sessions endpoint, the last one for good. */
async function stubSessions(page: Page, views: LiveView[]): Promise<{ count: () => number }> {
  let n = 0;
  await page.route("**/grooph/api/live.json", (route) => {
    const v = views[Math.min(n, views.length - 1)]!;
    n += 1;
    return route.fulfill({ status: 200, contentType: "application/json; charset=utf-8", body: JSON.stringify(v) });
  });
  return { count: () => n };
}

const session = (page: Page, state: string) => page.locator(`.live-session[data-session-state="${state}"]`);

test("the sessions screen shows each session and its subagents as the hook saw them, and follows them as they finish", async ({ page }) => {
  const running = eventsOf("claude-code-running.jsonl");
  const finished: SessionEvent[] = [
    ...running,
    { v: 1, t: "2026-10-01T02:01:20.000Z", harness: "claude-code", event: "subagent-stop", session: running[0]!.session, agent: "a02", type: "review-loop--critic" },
    { v: 1, t: "2026-10-01T02:01:22.000Z", harness: "claude-code", event: "turn-end", session: running[0]!.session },
  ];
  const watch = await stubSessions(page, [view(running, "2026-10-01T02:01:10.000Z"), view(running, "2026-10-01T02:01:12.000Z"), view(finished, "2026-10-01T02:01:24.000Z")]);
  await page.goto("./#/live");

  const working = session(page, "working");
  await expect(working).toHaveCount(1);
  await expect(working.locator(".live-harness")).toHaveText("Claude Code");
  await expect(working.locator(".live-state")).toHaveText("Working");
  await expect(working.locator(".live-session-sub")).toContainText("demo");
  await expect(working.locator(".live-session-facts")).toContainText("1 running · 1 done");
  await expect(page.locator("header.topbar .status")).toHaveText("1 running");

  // A package's subagent is named for its node, with its graph beside it.
  const builder = working.locator('.live-agent[data-agent-id="a01"]');
  const critic = working.locator('.live-agent[data-agent-id="a02"]');
  await expect(builder).toHaveAttribute("data-agent-state", "done");
  await expect(builder.locator(".live-agent-name")).toContainText("builder");
  await expect(builder.locator(".badge")).toHaveText("review-loop");
  await expect(builder.locator(".live-agent-facts")).toHaveText("done in 39 s · 2 tool calls, last Bash");
  await expect(critic).toHaveAttribute("data-agent-state", "running");
  await expect(critic).toHaveClass(/is-running/);
  await expect(critic.locator(".live-agent-facts")).toContainText(/^running \d+ s · 1 tool call, last Read$/);
  // Running is shown by a mark that says so, and by a ring that pulses unless motion is to be reduced.
  await expect(critic.getByRole("img", { name: "running" })).toBeVisible();
  expect(await critic.locator(".live-mark").evaluate((el) => getComputedStyle(el).animationName)).toBe("live-ring");

  // It keeps asking, and shows the subagent done and the session waiting when they are.
  await expect(session(page, "waiting")).toHaveCount(1, { timeout: 8_000 });
  const after = session(page, "waiting").locator('.live-agent[data-agent-id="a02"]');
  await expect(after).toHaveAttribute("data-agent-state", "done");
  await expect(after.locator(".live-agent-facts")).toContainText("done in 30 s");
  await expect(page.locator("header.topbar .status")).toHaveText("Quiet");
  expect(watch.count()).toBeGreaterThanOrEqual(3);
});

test("a session not heard from for half an hour is not called working: it says when it was last seen", async ({ page }) => {
  // The same mid-flight recording, read three hours later: what a lane's events look like when they were pushed
  // before the lane finished. Nothing after the push ever arrives.
  const running = eventsOf("claude-code-running.jsonl");
  await stubSessions(page, [view(running, "2026-10-01T05:01:10.000Z")]);
  await page.goto("./#/live");
  const card = page.locator(".live-session");
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute("data-quiet", "true");
  await expect(card.locator(".live-state")).toHaveText(/^Last seen 3 h ago$/);
  await expect(card.locator(".live-dot")).toHaveCount(0);
  await expect(card.locator(".live-session-facts")).toContainText("1 not seen to finish · 1 done");
  await expect(card.locator('[data-agent-id="a02"]')).toContainText("not seen to finish, started 3 h");
  await expect(card.locator('[data-agent-id="a01"]')).toContainText("done in 39 s");
});

test("several sessions' files show side by side under their names: both harnesses, a subagent under the one that started it", async ({ page }) => {
  await stubSessions(page, [view([...eventsOf("claude-code-nested.jsonl", "cloud lane"), ...eventsOf("codex-two-subagents.jsonl", "the Mac")], "2026-10-01T01:40:00.000Z")]);
  await page.goto("./#/live");
  await expect(page.locator(".live-source")).toHaveText(["the Mac", "cloud lane"]); // the most recently seen first
  await expect(page.locator(".live-session")).toHaveCount(2);

  const claude = page.locator(".live-session").filter({ hasText: "Claude Code" });
  const rows = claude.locator(".live-agent");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).locator(".live-agent-name")).toContainText("general-purpose");
  await expect(rows.nth(1).locator(".live-agent-name")).toContainText("Explore");
  // The Explore subagent is indented under the general-purpose agent that started it.
  expect(await rows.nth(1).evaluate((el) => parseFloat(getComputedStyle(el).marginLeft))).toBeGreaterThan(await rows.nth(0).evaluate((el) => parseFloat(getComputedStyle(el).marginLeft)));
  expect(await rows.nth(2).evaluate((el) => parseFloat(getComputedStyle(el).marginLeft))).toBe(0);

  const codex = page.locator(".live-session").filter({ hasText: "Codex" });
  await expect(codex.locator(".live-session-sub")).toContainText("gpt-6-luna");
  await expect(codex.locator(".live-agent")).toHaveCount(2);
  await expect(codex.locator(".live-state")).toHaveText("Ended");
  // Nothing an agent said is on the screen, because none of it is in the events.
  await expect(page.locator(".live-foot")).toContainText("What an agent said is not recorded, except a plan or a note its lead chose to leave.");
  // It fits a phone: nothing scrolls sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("no sessions yet says how to record them; a server that is not grooph watch is said plainly", async ({ page }) => {
  await stubSessions(page, [{ groophLive: 0, at: "2026-10-01T02:00:00.000Z", sessions: [] }]);
  await page.goto("./#/live");
  await expect(page.getByText("No sessions recorded yet.")).toBeVisible();
  await expect(page.locator(".live-empty")).toContainText("grooph hooks install");
  await page.unroute("**/grooph/api/live.json");

  // The static site has no such endpoint: it answers with the app's own page.
  await page.goto("./");
  await page.goto("./#/live");
  await expect(page.getByRole("status").filter({ hasText: "There is no grooph watch here that serves sessions." })).toBeVisible();
});

test("a live run shows a node running as soon as the hook sees its subagent, before the lead has noted anything", async ({ page }) => {
  // The lead has noted the builder's pass and nothing yet about the critic.
  const quiet = runBundle("run-live", { notes: (lines) => lines.slice(0, 3) });
  await page.route("**/grooph/api/run.json", (route) => route.fulfill({ status: 200, contentType: "application/json; charset=utf-8", body: bundleText(quiet) }));

  // Without events the critic is pending, as the notes say.
  await stubSessions(page, [{ groophLive: 0, at: "2026-09-19T11:06:30.000Z", sessions: [] }]);
  await page.goto("./#/run?live");
  await expect(runBadge(page, "critic")).toHaveText("pending");
  await expect(page.locator("p.run-origin")).not.toContainText("the hook sees");
  await page.unroute("**/grooph/api/live.json");

  // The hook saw the package's critic start: `<graph-id>--<node-id>` names the node.
  const e = (t: string, event: SessionEvent["event"], more: Partial<SessionEvent>): SessionEvent => ({ v: 1, t, harness: "claude-code", event, session: "s-live", ...more });
  const seen = view(
    [
      e("2026-09-19T11:00:06.000Z", "subagent-start", { agent: "b1", type: "run-live--builder" }),
      e("2026-09-19T11:05:58.000Z", "subagent-stop", { agent: "b1", type: "run-live--builder" }),
      e("2026-09-19T11:06:11.000Z", "subagent-start", { agent: "c1", type: "run-live--critic" }),
    ],
    "2026-09-19T11:06:30.000Z",
  );
  await stubSessions(page, [seen]);
  await expect(runBadge(page, "critic")).toHaveText("running", { timeout: 8_000 });
  await expect(runNode(page, "critic")).toHaveClass(/run-running/);
  await expect(page.locator("p.run-origin")).toContainText("the hook sees 1 subagent running");
  // The builder's outcome is still the lead's word: a hook cannot know one.
  await expect(runBadge(page, "builder")).toHaveText("passed");
});

test("a plan the lead declared is shown beside what the hook saw, with its note", async ({ page }) => {
  // A real session: the lead called grooph_plan, started the two subagents it planned, and left a note.
  await stubSessions(page, [view(eventsOf("claude-code-planned.jsonl"), "2026-10-01T01:52:10.000Z")]);
  await page.goto("./#/live");
  const card = page.locator(".live-session");
  await expect(card).toHaveCount(1);
  const plan = card.locator("[data-plan]");
  await expect(plan.locator(".live-plan-sum")).toHaveText("2 of 2 started");
  await expect(plan.locator("li")).toHaveCount(2);
  await expect(plan.locator("li").nth(0)).toHaveAttribute("data-plan-state", "started");
  await expect(plan.locator("li").nth(0)).toContainText("Explore");
  await expect(card.getByRole("list", { name: "Notes from the lead" })).toContainText("alpha");
  await expect(card.locator(".live-agent")).toHaveCount(2);

  // A plan that is not kept says so: something planned and never started, something started and never planned.
  const e = (t: number, event: SessionEvent["event"], more: Partial<SessionEvent> = {}): SessionEvent => ({ v: 1, t: new Date(Date.UTC(2026, 9, 1, 4, 0, t)).toISOString(), harness: "codex", event, session: "s9", ...more });
  await page.unroute("**/grooph/api/live.json");
  await stubSessions(page, [
    view(
      [e(0, "session-start"), e(1, "plan", { text: "Round one", agents: [{ type: "worker", count: 2 }, { type: "explorer", purpose: "map the code first" }] }), e(3, "subagent-start", { agent: "w1", type: "worker" }), e(4, "subagent-start", { agent: "d1", type: "default" })],
      "2026-10-01T04:00:20.000Z",
    ),
  ]);
  await expect(plan.locator(".live-plan-sum")).toHaveText("1 of 3 started, 1 running; not in the plan: default", { timeout: 8_000 });
  await expect(plan.locator("li").nth(0)).toHaveAttribute("data-plan-state", "running");
  await expect(plan.locator("li").nth(1)).toHaveAttribute("data-plan-state", "waiting");
  await expect(plan.locator("li").nth(1)).toContainText("map the code first");
  await expect(plan.locator(".live-plan-extra")).toHaveText("Started without being in the plan: default");
});

test("with a map, the operation is drawn above its sessions, each session marked with what the hook saw", async ({ page }) => {
  const map = JSON.parse(readFileSync(join(repoRoot, "fixtures/maps/valid/owner-operation-2026-09-30.grooph-map.json"), "utf8")) as LiveView["map"];
  const events = [...eventsOf("claude-code-running.jsonl", "operator"), ...eventsOf("codex-two-subagents.jsonl", "codex")];
  await stubSessions(page, [{ ...view(events, "2026-10-01T02:01:10.000Z"), map }]);
  await page.goto("./#/live");
  const drawn = page.getByRole("region", { name: /^Operation map: Ryan's operation/ });
  await expect(drawn.locator('svg[data-picture="map"]')).toBeVisible();
  await expect(drawn.locator('[data-session="operator"]')).toHaveAttribute("data-live", "working");
  await expect(drawn.locator('[data-session="operator"]')).toContainText("working · 1 running, 1 done");
  await expect(drawn.locator('[data-session="codex"]')).toHaveAttribute("data-live", "ended");
  // A session on the map that no source was named for is drawn as the map alone draws it.
  expect(await drawn.locator('[data-session="routines"]').getAttribute("data-live")).toBeNull();
  await expect(drawn).toContainText("live at 2026-10-01 02:01 UTC");
  // The sessions are still listed below, under the names they were read as.
  await expect(page.locator(".live-source")).toHaveText(["operator", "codex"]);

  // A map that is not one is left out; the sessions still show.
  await page.unroute("**/grooph/api/live.json");
  await stubSessions(page, [{ ...view(events, "2026-10-01T02:01:12.000Z"), map: { groophMap: 0, id: "broken" } as unknown as LiveView["map"] }]);
  await expect(page.getByRole("region", { name: /^Operation map/ })).toHaveCount(0, { timeout: 8_000 });
  await expect(page.locator(".live-session")).toHaveCount(2);
});

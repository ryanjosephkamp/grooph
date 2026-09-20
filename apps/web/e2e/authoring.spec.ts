import { readFileSync } from "node:fs";

import { expect, test, type Locator } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

import { parseGraphText, validate, type Graph } from "@grooph/core";

import { closeSheet, downloadBytes, downloadText, edgeLabel, fixturePath, node, sheet, status, toolbar } from "./support.js";

/**
 * Handoff 0002, criteria 3 and 4: the review loop rebuilt from an empty graph
 * at phone size, by touch — every button is a tap, text goes in through
 * `fill` (the on-screen keyboard), and no step needs a hardware key.
 */
test("rebuild the review loop from scratch by touch, then export it", async ({ page }) => {
  const started = Date.now();
  let taps = 0;
  const tap = async (target: Locator) => {
    taps++;
    await target.tap();
  };
  const s = sheet(page);
  const field = (label: string) => s.getByLabel(label, { exact: true });
  const radio = (group: string, option: string) => s.getByRole("radiogroup", { name: group }).getByRole("radio", { name: option, exact: true });
  const chip = (group: string, item: string) => s.getByRole("group", { name: group }).getByRole("button", { name: item, exact: true });
  const addNode = async (kind: RegExp) => {
    await tap(toolbar(page).getByRole("button", { name: "Add" }));
    await tap(s.getByRole("button", { name: kind }));
  };
  // Connect from the toolbar with nothing selected: the canvas fits the whole
  // graph, then source and target are two taps.
  const connect = async (from: string, to: string) => {
    await closeSheet(page);
    await tap(toolbar(page).getByRole("button", { name: "Connect" }));
    await tap(node(page, from));
    await tap(node(page, to));
    await expect(s.getByRole("heading", { name: "Edge" })).toBeVisible();
  };

  await page.goto("./");
  await tap(page.getByRole("button", { name: "New graph" }));

  // Graph-level fields. The sheet opens on the graph with its name focused.
  await expect(field("Name")).toBeFocused();
  await field("Name").fill("Review loop");
  await expect(field("Id")).toHaveValue("review-loop");
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Graph;
  await field("Goal").fill(fixture.goal!);
  await field("Target harness").selectOption("claude-code");
  await field("Budget").fill(fixture.constraints!.budget!);
  await field("Other").fill(fixture.constraints!.other!);
  await field("Description").fill(fixture.description!);

  // Builder
  await addNode(/^Agent/);
  await field("Name").fill("Builder");
  await expect(s.locator(".sheet-sub")).toHaveText("builder");
  await tap(radio("Model tier", "strong"));
  await tap(radio("Effort", "high"));
  const builder = fixture.nodes[0] as Extract<Graph["nodes"][number], { kind: "agent" }>;
  await field("Brief").fill(builder.brief);
  await field("Inputs").fill(builder.inputs!.join("\n"));
  await field("Outputs").fill(builder.outputs.join("\n"));
  for (const cap of ["read-files", "edit-files", "run-tests"]) await tap(chip("Allow", cap));
  await field("Owns").fill("src\ntests");

  // Critic
  await addNode(/^Agent/);
  await field("Name").fill("Critic");
  await field("Role").selectOption("critic");
  await tap(radio("Model tier", "strong"));
  await tap(radio("Effort", "high"));
  const critic = fixture.nodes[1] as typeof builder;
  await field("Brief").fill(critic.brief);
  await field("Inputs").fill(critic.inputs!.join("\n"));
  await field("Outputs").fill(critic.outputs.join("\n"));
  // write-outputs: the critic leaves REVIEW.md behind itself, still denied edit-files.
  for (const cap of ["read-files", "write-outputs", "run-tests"]) await tap(chip("Allow", cap));
  await tap(chip("Deny", "edit-files"));

  // Merge gate
  await addNode(/^Human gate/);
  await field("Name").fill("Merge gate");
  await field("Prompt").fill("The critic passed the change. Merge it?");
  await field("Options").fill("approve\nreject with feedback");

  // Done
  await addNode(/^Stop/);
  await field("Name").fill("Done");
  await tap(radio("Outcome", "success"));

  // Edges, each drawn tap-to-tap.
  await connect("builder", "critic");
  await field("Evidence").fill(["diff of src/ and tests/", "test command output", "docs/REVIEW-CHECKLIST.md"].join("\n"));
  await connect("critic", "builder");
  await tap(radio("When", "fail"));
  await tap(radio("Isolation", "fresh"));
  await field("Evidence").fill("REVIEW.md");
  await connect("critic", "merge-gate");
  await tap(radio("When", "pass"));
  await connect("merge-gate", "done");
  await tap(radio("When", "pass"));
  await connect("merge-gate", "builder");
  await tap(radio("When", "fail"));
  await tap(radio("Isolation", "fresh"));
  await field("Evidence").fill("human feedback");

  // The loop: members and back edges picked on the canvas.
  await closeSheet(page);
  await tap(toolbar(page).getByRole("button", { name: "Loop" }));
  await expect(page.getByRole("status").filter({ hasText: "Picking" })).toBeVisible();
  await tap(node(page, "builder"));
  await tap(node(page, "critic"));
  await tap(node(page, "merge-gate"));
  await tap(edgeLabel(page, "e-critic-builder"));
  await tap(edgeLabel(page, "e-merge-gate-builder"));
  await tap(page.getByRole("status").getByRole("button", { name: "Done" }));

  await field("Name").fill("Build-review cycle");
  await tap(radio("Mode", "judgment"));
  await tap(s.getByRole("button", { name: "Add bar" }));
  await field("Bar name").fill("Review checklist");
  await tap(s.getByRole("button", { name: "Add evidence" }));
  await s.getByRole("group", { name: "Evidence 1" }).getByLabel("Kind").selectOption("checklist");
  await s.getByRole("group", { name: "Evidence 1" }).getByLabel("Ref").fill("docs/REVIEW-CHECKLIST.md");
  await tap(s.getByRole("button", { name: "Add evidence" }));
  await s.getByRole("group", { name: "Evidence 2" }).getByLabel("Kind").selectOption("artifact");
  await s.getByRole("group", { name: "Evidence 2" }).getByLabel("Ref").fill("test command output");
  await field("Acceptance").fill(fixture.loops[0]!.bar!.acceptance);
  for (const kind of ["bar-passed", "max-iterations", "budget"]) {
    await s.getByLabel("Stop kind to add").selectOption(kind);
    await tap(s.getByRole("button", { name: "Add stop" }));
  }
  await expect(s.getByRole("group", { name: "Stop 2" }).getByLabel("Rounds at most")).toHaveValue("4");
  // A new budget counts dispatches, the measure the lead can count exactly (graph-ir §1); the fixture's is in turns.
  const budget = s.getByRole("group", { name: "Stop 3" });
  await expect(budget.getByRole("radiogroup", { name: "Measure" }).getByRole("radio", { name: "dispatches", exact: true })).toBeChecked();
  await expect(budget.getByLabel("Limit")).toHaveValue("12");
  await tap(budget.getByRole("radiogroup", { name: "Measure" }).getByRole("radio", { name: "turns", exact: true }));
  await budget.getByLabel("Limit").fill("40");

  // A validation panel with no errors — only the warning the fixture carries too …
  await expect(status(page)).toHaveText("1 warning");
  await tap(status(page));
  await expect(s.locator(".issue-code")).toHaveText(["W_HOMOGENEOUS_CRITICS"]);

  // … and a successful export.
  await tap(page.getByRole("button", { name: "Export", exact: true }));
  const [zip] = await Promise.all([page.waitForEvent("download"), tap(s.getByRole("button", { name: "Download package (.zip)" }))]);
  const files = unzipSync(await downloadBytes(zip));
  expect(Object.keys(files).sort()).toEqual([
    ".claude/agents/review-loop--builder.md",
    ".claude/agents/review-loop--critic.md",
    ".claude/skills/review-loop/SKILL.md",
    ".grooph/review-loop/KICKOFF.md",
    ".grooph/review-loop/LEAD.md",
    ".grooph/review-loop/MAPPING.md",
    ".grooph/review-loop/graph.grooph.json",
  ]);

  const parsed = parseGraphText(strFromU8(files[".grooph/review-loop/graph.grooph.json"]!));
  const doc = parsed.doc!;
  expect(validate(doc, { forExport: true }).map((i) => i.code)).toEqual(["W_HOMOGENEOUS_CRITICS"]);
  expect(doc.nodes.map((n) => [n.id, n.kind])).toEqual([
    ["builder", "agent"],
    ["critic", "agent"],
    ["merge-gate", "human-gate"],
    ["done", "stop"],
  ]);
  expect(doc.edges.map((e) => [e.from, e.to, e.when ?? "always"])).toEqual([
    ["builder", "critic", "always"],
    ["critic", "builder", "fail"],
    ["critic", "merge-gate", "pass"],
    ["merge-gate", "done", "pass"],
    ["merge-gate", "builder", "fail"],
  ]);
  const loop = doc.loops[0]!;
  expect(loop.members).toEqual(["builder", "critic", "merge-gate"]);
  expect(loop.back).toEqual(["e-critic-builder", "e-merge-gate-builder"]);
  expect(loop.bar!.inspects).toEqual(fixture.loops[0]!.bar!.inspects);
  expect(loop.stops).toEqual(fixture.loops[0]!.stops);
  // Same agents, field for field, as the fixture's.
  for (const i of [0, 1]) {
    const { id: _a, ...made } = doc.nodes[i] as typeof builder;
    const { id: _b, ...want } = fixture.nodes[i] as typeof builder;
    expect(made).toEqual(want);
  }
  // Nothing was dragged or saved, so the document carries no layout (A-005).
  expect(doc.layout).toBeUndefined();

  const seconds = Math.round((Date.now() - started) / 100) / 10;
  test.info().annotations.push({ type: "from-scratch", description: `${taps} taps, ${seconds}s automated` });
  console.log(`from scratch at 400x800: ${taps} taps, ${seconds}s automated`);
});

/** Criterion 3, the fields the rebuild does not touch: check nodes, verdict edges, approval, every stop kind, deletes. */
test("every field of every kind is editable and lands in the document", async ({ page }) => {
  const s = sheet(page);
  const field = (label: string) => s.getByLabel(label, { exact: true });
  const radio = (group: string, option: string) => s.getByRole("radiogroup", { name: group }).getByRole("radio", { name: option, exact: true });
  const add = async (kind: RegExp) => {
    await toolbar(page).getByRole("button", { name: "Add" }).tap();
    await s.getByRole("button", { name: kind }).tap();
  };

  await page.goto("./");
  await page.getByRole("button", { name: "New graph" }).tap();
  await field("Name").fill("Fields");
  await field("Target harness").selectOption("claude-code");
  await field("Goal").fill("Exercise every field.");
  await field("Time").fill("an afternoon");

  // Adaptation: three levels, a line each; adaptive is the default and is not written in.
  await expect(radio("Adaptation", "adaptive")).toHaveAttribute("aria-checked", "true");
  const levels = s.locator(".level-list li");
  await expect(levels).toHaveText([
    "adaptive (default) — The lead may amend its copy of the graph during a run, visibly; brakes never loosen.",
    "propose — The lead changes nothing and records proposals for you.",
    "fixed — The lead follows the graph exactly and halts to ask when it cannot.",
  ]);
  await radio("Adaptation", "fixed").tap();
  await expect(levels.nth(2)).toHaveClass("is-on");

  await add(/^Check/);
  await field("Name").fill("Tests pass");
  await radio("Check kind", "command").tap();
  await field("Run").fill("npm test");
  await field("Pass when").fill("exit code 0");
  await field("Threshold").fill("0.9");

  await add(/^Agent/);
  await field("Name").fill("Scout");
  await field("Role").selectOption("__custom");
  await field("Custom role").fill("scout");
  await radio("Model tier", "fast").tap();
  await field("Brief").fill("Look around.");
  await field("Outputs").fill("NOTES.md");
  await s.getByRole("group", { name: "Irreversible actions" }).getByRole("button", { name: "spend", exact: true }).tap();
  await s.getByLabel("Custom allow").fill("read-secrets");
  await s.getByRole("group", { name: "Allow" }).locator("..").getByRole("button", { name: "Add", exact: true }).tap();
  await s.getByText("More fields").tap();
  await field("Description").fill("Scouts ahead.");
  await s.getByText("Coupled").tap();

  await add(/^Stop/);
  await field("Name").fill("Halted");
  await radio("Outcome", "halt").tap();

  await closeSheet(page);
  await toolbar(page).getByRole("button", { name: "Connect" }).tap();
  await node(page, "scout").tap();
  await node(page, "tests-pass").tap();
  await radio("When", "verdict…").tap();
  await field("Verdict label").fill("needs-evidence");
  await s.getByText("Needs human approval").tap();
  await radio("Isolation", "shared").tap();

  await closeSheet(page);
  await toolbar(page).getByRole("button", { name: "Connect" }).tap();
  await node(page, "tests-pass").tap();
  await node(page, "scout").tap();
  await radio("When", "fail").tap();

  await closeSheet(page);
  await toolbar(page).getByRole("button", { name: "Loop" }).tap();
  await node(page, "scout").tap();
  await node(page, "tests-pass").tap();
  await edgeLabel(page, "e-tests-pass-scout").tap();
  await page.getByRole("status").getByRole("button", { name: "Done" }).tap();
  for (const kind of ["human", "diminishing-returns", "evidence-invalid"]) {
    await s.getByLabel("Stop kind to add").selectOption(kind);
    await s.getByRole("button", { name: "Add stop" }).tap();
  }
  await s.getByRole("group", { name: "Stop 1" }).getByLabel("Ask every N rounds").fill("2");
  await s.getByRole("group", { name: "Stop 1" }).getByLabel("Then continue at").selectOption("halted");
  await s.getByRole("group", { name: "Stop 2" }).getByLabel("Metric").fill("score");
  await s.getByRole("group", { name: "Stop 2" }).getByLabel("Threshold").fill("0.1");
  await s.getByRole("group", { name: "Stop 3" }).getByLabel("Rounds").fill("3");
  await s.getByRole("button", { name: "Move stop 3 up" }).tap();

  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const [file] = await Promise.all([page.waitForEvent("download"), s.getByRole("button", { name: "Download graph (.grooph.json)" }).tap()]);
  const doc = JSON.parse(await downloadText(file)) as Graph;

  expect(doc.constraints).toEqual({ time: "an afternoon" });
  expect(doc.adaptation).toBe("fixed");
  expect(doc.nodes).toEqual([
    { id: "tests-pass", kind: "check", name: "Tests pass", check: { kind: "command", run: "npm test", pass: "exit code 0", threshold: 0.9 } },
    {
      id: "scout",
      kind: "agent",
      name: "Scout",
      description: "Scouts ahead.",
      coupled: true,
      role: { custom: "scout" },
      model: { tier: "fast" },
      brief: "Look around.",
      outputs: ["NOTES.md"],
      allow: ["read-secrets"],
      irreversible: ["spend"],
    },
    { id: "halted", kind: "stop", name: "Halted", outcome: "halt" },
  ]);
  expect(doc.edges).toEqual([
    { id: "e-scout-tests-pass", from: "scout", to: "tests-pass", when: { verdict: "needs-evidence" }, isolation: "shared", approval: true },
    { id: "e-tests-pass-scout", from: "tests-pass", to: "scout", when: "fail" },
  ]);
  expect(doc.loops[0]!.members).toEqual(["tests-pass", "scout"]);
  expect(doc.loops[0]!.stops).toEqual([
    { kind: "human", every: 2, then: "halted" },
    { kind: "evidence-invalid", rounds: 3 },
    { kind: "diminishing-returns", rounds: 2, metric: "score", threshold: 0.1 },
  ]);

  // Deleting an edge removes it from the loop's back edges; deleting a node takes its edges along.
  await closeSheet(page);
  await edgeLabel(page, "e-tests-pass-scout").tap();
  await s.getByRole("button", { name: "Delete edge" }).tap();
  await node(page, "tests-pass").tap();
  await s.getByRole("button", { name: "Delete check" }).tap();
  await page.locator(".loop-pill").first().tap();
  await s.getByRole("button", { name: "Delete loop" }).tap();
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const [after] = await Promise.all([page.waitForEvent("download"), s.getByRole("button", { name: "Download graph (.grooph.json)" }).tap()]);
  const left = JSON.parse(await downloadText(after)) as Graph;
  expect(left.nodes.map((n) => n.id)).toEqual(["scout", "halted"]);
  expect(left.edges).toEqual([]);
  expect(left.loops).toEqual([]);
});

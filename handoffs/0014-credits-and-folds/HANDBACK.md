# Handback 0014 · Credits and folds

**Implementer:** Opus 5 · **Branch:** `slice/0014-credits-and-folds` · **Head commit:** `37c23bc` (work head; this handback is the commit on top) · **Date:** 2026-09-21 (UTC) · **Spend:** none (no model run; `experiments/**` and the ledger untouched)

## Status

`done` — all eight criteria met. Credits are a template field shown in the index README, `grooph template show`, the app's template page and the compare card; the three attributions are in the patterns at version 2; the `taste-polish` critic does a blind A/B in one sentence; `skills` reaches the agent frontmatter and `MAPPING.md`; LEAD.md §11 asks for the `ending` line and names where the report goes; the check reads the marker as a finding; both goldens regenerated; 16/16 kept records still PASS with one new finding on eleven of them and no verdict change.

## What changed

**`packages/core`**

- `src/types.ts` — `Template.credits?: TemplateCredit[]` and `export type TemplateCredit = { name; url; note }`; `AgentNode.skills?: string[]`; `RunNote.outcome` lists `"started" | "ending"` explicitly (the open string stays).
- `src/schema/graph.ts` — `credits` on the template schema (a named `TemplateCredit` def), `skills` on `AgentNode`, `started` and `ending` among the outcome examples (`openEnum` publishes `examples`, not a closed `enum`, since the lead may name its own outcome).
- `schema/grooph-0.schema.json` — regenerated (`schema:write`). The run bundle schema references `#/$defs/RunNote` and needed no change.
- `src/template.ts` — `TemplateMeta.credits`, `extractTemplate` copies it, `TemplateIndexEntry.credits` and `templateIndexEntry` carries it last in the row.
- `src/compile/claude-code/agents.ts` — `skills: a, b` as the last frontmatter line when the node names any; nothing in the body.
- `src/compile/claude-code/mapping.ts` — a paragraph after the tools table: the `skills:` line is hand-editable the same way, from `skills` on the node; "An unknown name is refused by Claude Code, not by grooph"; then either the files in this package that carry one or "No node in this graph names one." The heading stays "The three things people hand-edit" (see Decisions).
- `src/compile/claude-code/lead.ts` — §11 step 1 now reads: append `{"at":"graph","outcome":"ending"}` with a `text` naming how the run ends, then the final note; one sentence says why (a monitor tells a finished run from one cut off while finishing). §11 ends with the report sentence: "The final note and `PROGRESS.md` are the record. Your last reply is the report: it summarises them for whoever started this session and points at the run folder, `<runs>/<run-id>/`." §8's line-shape block adds "ending on the line before the final note (§11)" to the `outcome` row.
- `src/runs.ts` — `isMarker(note)` (`started` or `ending`); `closesRun` and `lastOutcome` ignore markers; `nodeEvent` returns nothing for an `ending` line even when mis-filed at a node.
- `test/patterns.test.ts` — `CREDITED` set; version 2 for those three, 1 otherwise; the credit assertion (three non-empty fields, `^https?://\S+$`, no "endors…" in the note); `patterns/index.json` equality already covered the new column. `test/compile.test.ts` — `0014-4` (skills frontmatter and mapping line, with and without skills) and `0014-5/6` (§11 and the §8 row). `test/runs.test.ts` — `0014-5` (marker before n-0014 of the real run changes no state; marker as the last line leaves the run `running`; marker at a node is not a result). `test/schema.test.ts` — mutations for the markers, `skills`, a complete credit and one missing `note`; a test that the published schema lists the outcomes and requires the credit's three fields.

**`packages/cli`** — `src/commands/template.ts`: `template show` prints `Inspired by: <name> <url> — <note>` per credit after Tags; `test/template.test.ts` asserts it for `spec-then-loop`.

**`apps/web`** — `src/ui/templates/Credits.tsx` `new` (a list labelled "Credits", one line per credit, "Inspired by [name](url): note", link opens in a new tab); `TemplateView.tsx` shows it under the profile chips; `open/Compare.tsx` shows it inside `.ccard-head` under "from the X template", resolved through `builtInTemplate(c.basedOn)` (placed in the head so the desktop subgrid keeps its nine rows: a tenth child broke the row-alignment e2e); `doc/run.ts` treats `ending` like `started` (a plain dot in the timeline, no tick; never the state label); `styles.css` `.credits` and its spacing on the template page; e2e: a credited template page (`templates.spec.ts`), a compare card based on `taste-polish` and one that owes nothing (`open.spec.ts`), and the uncredited `grind-loop` page shows no Credits list.

**`patterns/`** — `taste-polish`, `ownership-not-swarm`, `spec-then-loop`: `credits` exactly as the handoff spells them, `version: 2`, canonical form; the `taste-polish` critic brief (below). `index.json` and `README.md` regenerated: the README gains a **Credits** paragraph and one bullet per credited pattern under the table (a line per row, not a column: the table is already wide on a phone).

**`scripts/`** — `patterns-index.mjs` prints the credits block; `lib/prove-check.mjs` check 16 (header comment, the finding, `facts.ending_marker`, an "ending line" row in the printed summary).

**`fixtures/`** — `valid/skilled-fixer.grooph.json` `new` (fix-until-green with `skills: ["test-triage", "commit-style"]` on the fixer); `valid/credited-fix-loop.grooph.json` `new` (a template with one credit, clearly marked a fixture); both goldens regenerated (`LEAD.md` §8 row and §11, `MAPPING.md` skills paragraph — 12 lines added, 4 changed, nothing else).

**`docs/PROGRESS.md`** — In flight, "Slice 0014", one line per criterion and the closing line. **`handoffs/0014-credits-and-folds/HANDBACK.md`** — this file.

Nothing else: `docs/**` beyond PROGRESS, `spec/**`, `AGENTS.md`, `.claude/**`, `plugins/**`, `.grooph/**`, `experiments/**`, the ledger untouched (`git diff --name-status origin/main...HEAD` is the 35 paths above). A temporary `.claude/launch.json` was used to preview the app and deleted before committing.

## Verified, and how

Cold on `37c23bc`, every command in the handoff's **How to verify**:

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` | exit 0; core **254 pass, 0 fail** (248 on `main`), cli **58 pass, 0 fail**, web **49 pass** |
| `pnpm --filter @grooph/core run golden:write && git diff --stat fixtures/golden` | regenerated; diff empty (the committed goldens are what the compiler emits) |
| `node scripts/patterns-index.mjs --check && node scripts/check-brake-values.mjs` | "current (16 patterns)"; "no pattern restates a brake value (16 patterns)" |
| `pnpm exec grooph template show taste-polish` | prints the credit line (output below) |
| `for t in …; do scripts/prove-pattern.sh $t --check experiments/patterns/$t/run \| tail -1; done` | **16 × PASS** |
| `pnpm --filter @grooph/web test:e2e` | **54 passed**, 0 failed (27 screenshot specs skipped as on `main`) |
| CI | green on every push of the branch up to `eade003`; the run for `37c23bc` was in progress when this was written |

Per criterion:

1. **`credits` on templates** — types, schema builder, regenerated JSON schema (`TemplateCredit` def, required `name`, `url`, `note`); `templateIndexEntry` → `patterns/index.json` (three rows carry it); README credits block; `template show`; app template page and compare card (both viewed at phone width in the built app, and covered by e2e); pattern test asserts the fields and the URL. Met.
2. **The three attributions** — in the three pattern documents, texts verbatim from the handoff, each `version: 2`; `patterns.test.ts` checks exactly these three carry a credit. Met.
3. **Blind A/B** — one sentence within the existing first sentence of the critic brief (still four sentences, no step list, so the Latitude test holds); `check-brake-values` clean; the pattern validates with no errors and its sidecar-free warning set unchanged; `experiments/patterns/taste-polish/` untouched. Met.
4. **`skills`** — types, schema builder, JSON schema; frontmatter `skills: test-triage, commit-style`; `MAPPING.md` paragraph; test `0014-4`; fixture `skilled-fixer`. No validation rule. Met.
5. **`ending` marker** — §11 step 1; `RunNote` type and schema; `prove-check` check 16 as a finding; `summarizeRun` ignores markers (test `0014-5`); web timeline shows it as a dot. Met.
6. **Report sentence** — §11's closing paragraph (test `0014-5/6`). Met.
7. **Goldens and records** — both goldens regenerated and read (§11 and the MAPPING paragraph quoted below); sixteen records re-checked: 16/16 PASS before and after, no verdict change; finding change listed below. Met.
8. **Still green** — the table above; ledger untouched. Met.

### `template show` for the three credited templates (head of each)

```text
taste-polish · Taste polish (graph, version 2)
…
Tags: loop, taste, gauntlet, reference
Inspired by: Matt Shumer's Gauntlet Loop (Claude of Duty) <https://github.com/mshumer/Claude-of-Duty> — the bounded form of the Gauntlet: one owner, an isolated critic against a named reference, real stops

ownership-not-swarm · Ownership, not swarm (graph, version 2)
…
Tags: ownership, fan-out, coupled, grind
Inspired by: Claude of Duty process note (Matt Shumer) <https://github.com/mshumer/Claude-of-Duty> — sequential ownership beat parallel fan-out on coupled systems in the repository's own write-up

spec-then-loop · Spec then loop (graph, version 2)
…
Tags: loop, answer-key, human-gate, zero-to-one
Inspired by: Answer-key-first Gauntlet, a community modification of Matt Pocock's Wayfinder <https://github.com/mattpocock/skills/blob/main/docs/engineering/wayfinder.md> — write the spec and a pass/fail answer key before the loop; the modification is known from a secondary write-up, not a primary source
```

### `taste-polish` critic brief, before and after

Before: "Compare the captures against {{reference}} and rank the gaps that matter most, at most five, each with where it shows and what closing it would look like. You judge; you do not fix. Report invalid-evidence rather than guessing when a capture is missing or unreadable. Verdict pass only when no gap you would call major remains."

After: "Compare the captures against {{reference}} **side by side with the labels stripped and in random order, say which is better and why, then** rank the gaps that matter most, at most five, each with where it shows and what closing it would look like. You judge; you do not fix. Report invalid-evidence rather than guessing when a capture is missing or unreadable. Verdict pass only when no gap you would call major remains."

### Lead brief §11, before and after (review-loop golden)

Before, step 1: "Append the final note: `"at":"graph"` with the outcome and a `text` that names the stop that fired or the stop node reached." Nothing after step 3.

After, step 1: "Append one short line first, `{"at":"graph","outcome":"ending"}` with a `text` naming how the run ends, then the final note: `"at":"graph"` with the outcome and a `text` that names the stop that fired or the stop node reached. The `ending` line is how a monitor tells a run that finished from one that was cut off while finishing." After step 3: "The final note and `PROGRESS.md` are the record. Your last reply is the report: it summarises them for whoever started this session and points at the run folder, `.grooph/review-loop/runs/<run-id>/`." Also §8's line shape: "outcome   pass | fail | halt | invalid-evidence; started on a dispatch line, ending on the line before the final note (§11)".

### Agent-file frontmatter of a node with `skills` (`fixtures/valid/skilled-fixer.grooph.json`)

```yaml
---
name: skilled-fixer--fixer
description: builder for graph skilled-fixer. Make the failing tests in tests/ pass by changing src/.
model: opus
effort: medium
tools: Read, Edit, Write, Glob, Grep, Bash
skills: test-triage, commit-style
---
```

`MAPPING.md` for it: "The `skills:` line of the same frontmatter is hand-editable the same way: harness skill names, preloaded at the node's dispatch, from `skills` on the node in the graph document. An unknown name is refused by Claude Code, not by grooph. In this package: `.claude/agents/skilled-fixer--fixer.md` (test-triage, commit-style)."

### The sixteen-record check, before and after

Before (`main`, `7e9e4cf`): 16 × PASS. After (`37c23bc`): 16 × PASS. The only difference in the full output (`diff` of both runs) is check 16: a new summary row `ending line   none` on all sixteen, and one new finding on the eleven records whose last note is a final note at `graph` — `no `ending` line before the final note n-XXXX (LEAD.md §11 since slice 0014; a monitor reads such a record as interrupted)` on contradiction-seeker (n-0007), dual-bar (n-0007), fresh-grind-rare-judge (n-0019), grind-loop (n-0006), metric-sandwich (n-0007), ownership-not-swarm (n-0017), red-team-loop (n-0008), retrospective-rewrite (n-0013), spec-then-loop (n-0014), taste-polish (n-0015), tournament-then-judge (n-0014). No finding on the five that end in a halt at a gate (debate-then-build, heterogeneous-critic, human-gated-irreversible, review-gate, specialist-critic-bank): their last note is the halt at `node:<gate>`, a pause rather than an end, which the existing finding "the final note is at node:…, not at graph" already reports. No problem anywhere; no other finding changed.

## Decisions made

- **README credits as lines under the table, not a column.** The pattern table already has six columns and is read on a phone; a credit is a sentence with a link. One bullet per credited pattern under a short **Credits** paragraph that restates decision 0010's two limits (not endorsement; no claim to beat a named product).
- **CLI line format** `Inspired by: <name> <url> — <note>`, after Tags and before Slots, one line per credit: greppable and the same words the app uses.
- **App: "Inspired by [name]: note"** in the muted meta size, under the profile chips on the template page and inside the card head on the compare card. On the compare card the credit is looked up from the built-in library by `basedOn`; a candidate based on a user template or on nothing shows no line. Placed inside `.ccard-head` because the desktop layout is a nine-row subgrid and an optional tenth child misaligned the cards (the row-alignment e2e caught it).
- **MAPPING.md keeps its heading "The three things people hand-edit"** and folds `skills:` into the frontmatter paragraphs as a fourth paragraph rather than a fourth bold item: `docs/targets/claude-code.md` (which this slice may not edit) still says "the three things" in its Mapping-notes row, and the skills row says only "among the hand-editable lines". The driver may want to retitle both together later.
- **`skills:` is the last frontmatter line**, after `disallowedTools:`, so existing goldens and the frontmatter tests change nowhere else.
- **Check 16 is silent on a halt at a gate.** graph-ir §6's rule speaks of the final note; §11 says a gate's halt note "stands as the final note until the human answers". Requiring an `ending` line before a pause would ask the lead to name "how the run ends" for a run that has not ended, so the check expects the marker only before a final note at `graph`. An `ending` line with nothing after it is reported as "cut off while finishing".
- **`summarizeRun` ignores an `ending` line wherever it is.** At `graph` it is not a closing note; at a node (mis-filed) it is neither a start nor a result. The web timeline shows it as a plain dot with the word `ending`, never a green tick.
- **The credited-template fixture names a made-up source** (`example.com`, note says "a fixture, not a real attribution") so nothing under `fixtures/` reads as a real credit.
- **Version bumps only on the three credited patterns**; `patterns.test.ts` pins version 2 for exactly those and 1 elsewhere, so a stray bump is caught.

## Deviations

None from the handoff. One thing to notice: the pattern test's sentence count for the `taste-polish` critic stays at four because the blind A/B clause extends the first sentence rather than adding one, which is what "one sentence within Latitude" asked for.

## Risks and leftovers

- **The blind A/B sentence is unproved** (as the handoff said: stage 14). Whether the critic actually strips labels and randomises order is a prompt-following question a re-proof will answer; the kept `taste-polish` record predates it.
- **The `ending` line is unproved too.** Every kept record now carries the "no `ending` line" finding until re-proved; the first run under a package compiled from this branch is the first evidence the lead writes the marker. If a lead writes the marker *after* the final note, check 16 reports it as "cut off while finishing"; the driver may want the lead brief to be firmer if that happens.
- **`docs/targets/claude-code.md` and MAPPING.md now disagree in one word** ("three things" vs. a fourth hand-editable line). Cosmetic; a docs-only fix when the target doc is next touched.
- **`skills` in the web editor.** The field is in the schema and survives round-trips, but the inspector has no control for it (the handoff asked for none); an agent writes it in the document.
- The app's compare card credits come only from the bundled built-in library; a candidate `basedOn` a project or user template shows no credit even if that template carries one. Fine for now (proposal sets name built-ins), worth a line in docs/executive.md if user registries grow credits.

## Prompt to paste into the driver session

```text
Handback for slice 0014 is at handoffs/0014-credits-and-folds/HANDBACK.md on branch slice/0014-credits-and-folds (head 37c23bc, plus the handback commit on top). Status: done. Please reconcile with the grooph-reconcile skill.
```

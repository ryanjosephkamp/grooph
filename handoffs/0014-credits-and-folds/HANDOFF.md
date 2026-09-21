# Handoff 0014 · Credits and folds

**Stage:** 4 and 6 · **Implementer:** Opus 5 · **Effort:** `high` (floor `medium`: small, well-specified changes with tests and goldens; `high` because the brief wording is a runtime contract) · **Branch:** `slice/0014-credits-and-folds` · **Drafted:** 2026-09-21 · **Confirmed by owner:** 2026-09-21 · **Spend:** none (no model run, no ledger write)

## Objective

The owner accepted the roadmap of 2026-09-21 (decisions 0010 and 0011). This slice lands the small folds that touch code: credits on templates, the blind A/B method in the reference critic's brief, `skills` on a node mapped to the agent file, an `ending` marker line before the final note, a report sentence in the brief, and the check reading the new lines. The docs that specify them are already on `main`; this slice makes the code, patterns and goldens agree with them.

## Success criteria

1. **`credits` on templates.** `Template` gains `credits?: { name: string; url: string; note: string }[]` in types, the schema builder and the regenerated JSON schema (docs/templates.md §1). `scripts/patterns-index.mjs` carries it into `index.json` and prints it in `patterns/README.md` as "Inspired by …" with the link. `grooph template show` prints it. The app's template page and the compare card show it as a short line with the link. A pattern test asserts every credit has all three fields and an `http(s)` URL.
2. **The three attributions**, as docs/templates.md §5 lists them, in the pattern documents (bump each template's `version`):
   - `taste-polish`: name "Matt Shumer's Gauntlet Loop (Claude of Duty)", url `https://github.com/mshumer/Claude-of-Duty`, note "the bounded form of the Gauntlet: one owner, an isolated critic against a named reference, real stops".
   - `ownership-not-swarm`: name "Claude of Duty process note (Matt Shumer)", url `https://github.com/mshumer/Claude-of-Duty`, note "sequential ownership beat parallel fan-out on coupled systems in the repository's own write-up".
   - `spec-then-loop`: name "Answer-key-first Gauntlet, a community modification of Matt Pocock's Wayfinder", url `https://github.com/mattpocock/skills/blob/main/docs/engineering/wayfinder.md`, note "write the spec and a pass/fail answer key before the loop; the modification is known from a secondary write-up, not a primary source".
3. **Blind A/B in `taste-polish`.** The critic's brief says, in one sentence within Latitude: compare the captures against the reference side by side with labels stripped and in random order, say which is better and why, then list the top gaps. `check-brake-values` stays clean; the pattern validates; its kept record is not re-proved here (stage 14 will).
4. **`skills` on a node.** `skills?: string[]` on agent nodes in types, schema builder and JSON schema (graph-ir §1). The Claude Code compiler writes `skills:` into the agent file's frontmatter when present; `MAPPING.md` lists it among the hand-editable lines (target doc, "Node `skills`" row). A compile test covers the frontmatter and the mapping line. No validation rule: an unknown name is the harness's to refuse.
5. **The `ending` marker.** The lead brief §11 says: just before the final note, append one short line `{"at":"graph","outcome":"ending"}` with a `text` naming how the run ends (graph-ir §6). The RunNote type and schema accept `"started"` and `"ending"` as outcomes explicitly. `scripts/lib/prove-check.mjs` reports, as a finding, a final note with no `ending` line before it or an `ending` line with no final note after it; on the kept records this is a finding, never a problem (decision 0009). `summarizeRun` ignores marker lines when it derives states, as it does `started`.
6. **The report sentence.** §11 also says where the report goes: the final note and `PROGRESS.md` are the record; the lead's last reply summarises them for whoever started the session, and points at the run folder.
7. **Goldens and records.** Both golden packages regenerated and read as documents; all sixteen kept records re-checked with no verdict change (report any finding change).
8. **Still green.** `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test`, `pnpm --filter @grooph/web test:e2e`, `node scripts/patterns-index.mjs --check && node scripts/check-brake-values.mjs` exit 0; CI green; the ledger untouched.

## Read first

1. `handoffs/0014-credits-and-folds/HANDOFF.md` (this file)
2. `AGENTS.md`
3. `docs/decisions/0010-prior-art-and-attribution.md`; `docs/templates.md` §1 and §5; `docs/graph-ir.md` §1 (`skills`) and §6 (`ending`); `docs/targets/claude-code.md` ("Node `skills`" row, "Running a package on a schedule")
4. `packages/core/src/types.ts`, `src/schema/graph.ts`, `src/compile/claude-code/agents.ts`, `lead.ts` §11, `mapping.ts`, `src/runs.ts`
5. `scripts/patterns-index.mjs`, `scripts/lib/prove-check.mjs`; `apps/web/src/ui/templates/TemplateView.tsx`, `apps/web/src/ui/open/Compare.tsx`; `packages/cli/src/commands/template-args.ts`
6. `handoffs/README.md`, `handoffs/TEMPLATE-HANDBACK.md`

## Allowed changes

`packages/core/**`, `packages/cli/**`, `apps/web/**`, `patterns/**` (the three credits, the taste-polish sentence, version bumps, regenerated index and README), `fixtures/**` (regenerated goldens; a fixture for `skills` and one for `credits` if useful), `scripts/patterns-index.mjs`, `scripts/lib/prove-check.mjs`, `docs/PROGRESS.md` In flight under "Slice 0014", `handoffs/0014-credits-and-folds/**`.

## Forbidden changes

Any model call or ledger write; `experiments/**`; `docs/**` other than PROGRESS In flight; `spec/**`, `AGENTS.md`, `.claude/**`, `plugins/**`, `.grooph/**`; any rule code rename; any other pattern edit than criteria 2 and 3; writing to `~/.claude.json` or the real `~/.claude`.

## Spec constraints that apply here

Decision 0010 (credits say what was taken, never endorsement; "until it beats the reference" stays out); graph-ir §2 Latitude (the blind A/B is one sentence, not a procedure); A-008 (no brake changes); decision 0009 (kept records are not edited; the check may be corrected).

## Design already decided

The field shapes, the three credit texts, the marker line's shape, that `skills` is unvalidated, that nothing is re-proved here.

## Implementer's choices

Wording of the brief sentences within Latitude; how the app shows credits (a line under the summary is enough); whether `credits` in the README index is a column or a line under each row.

## How to verify

```bash
pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test
pnpm --filter @grooph/core run golden:write && git diff --stat fixtures/golden
node scripts/patterns-index.mjs --check && node scripts/check-brake-values.mjs
pnpm exec grooph template show taste-polish
for t in $(ls patterns/*.grooph.json | xargs -n1 basename | sed 's/.grooph.json//'); do scripts/prove-pattern.sh $t --check experiments/patterns/$t/run | tail -1; done
pnpm --filter @grooph/web test:e2e
```

## Handback must contain

The template sections, plus: the `template show` output for the three credited templates; before/after of the taste-polish critic brief and of lead-brief §11; the agent-file frontmatter of a node with `skills`; the sixteen-record check summary before and after.

## Prompt to paste

```text
You are the implementer for grooph slice 0014 (credits and folds). The repo is /Users/noir/Documents/grooph, published at github.com/ryanjosephkamp/grooph.

1. Run `git fetch origin` and create branch slice/0014-credits-and-folds from origin/main (no other session is running; work in the main checkout).
2. Read handoffs/0014-credits-and-folds/HANDOFF.md first, then the files in its "Read first" order.
3. Work only inside the handoff's "Allowed changes". Commit often with `<area>: <what changed>` messages and push the branch.
4. This slice spends nothing: make no headless model run and do not touch the proving ledger or anything under experiments/.
5. Each time a success criterion is met, append one line to the "In flight" section of docs/PROGRESS.md under a "Slice 0014" heading (create it).
6. When done, or if blocked, finish with the grooph-handback skill: the branch must be pushed and HANDBACK.md committed before you print the return prompt, which is the last block of your final reply.
```

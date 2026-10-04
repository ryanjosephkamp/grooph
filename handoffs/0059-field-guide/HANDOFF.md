# Handoff 0059 · A field guide to the loop shapes, and a poster

**Implementer:** Sonnet 5.5 (a subagent of the driver) · **Branch:** `slice/0059-field-guide`, from `integration/2026-10-04` · **Drafted:** 2026-10-04 by the driver, under the owner's word to build through the night

## Objective

grooph's best asset is twenty templates, each with a recorded proving run, and nobody can see them outside the app's list. Make one generated page that shows them all, and a one-page poster.

## Success criteria

1. **`scripts/field-guide.mjs`** generates everything below from `patterns/*.grooph.json`, `patterns/index.json` and `experiments/patterns/` (the ledger and each template's `README.md`). Nothing is typed by hand. `--check` exits 1 when a generated file is stale, as `scripts/patterns-index.mjs --check` does.
2. **`docs/field-guide.md`.** A short introduction (what a loop shape is; what the shapes and lines in a glyph mean), then one section per template: whole graphs first, fragments after. Each section has:
   - the title and the glyph, as an image (`docs/field-guide/<id>.svg`, from core's `glyph()`);
   - "Use when", from the template's own metadata;
   - cost, speed and rigor, as words;
   - its shape in one line (agents, checks, gates, loops, rounds, budget), from core's `estimateShape` or the same source `grooph shape` uses;
   - credit for prior art where the template's metadata names any;
   - its proving run: what the ledger says (passed or not, rounds, which stop ended it, cost) and a link to its write-up;
   - how to use it: the `grooph template use <id>` line, the `/grooph-design` line, and a link that opens it in the app (`https://ryanjosephkamp.github.io/grooph/#/templates/built-in/<id>`).
3. **`docs/field-guide/poster.svg`.** One page, portrait, 20 cells: glyph, name, and "use when" cut to two lines. A title, a legend for the shapes and line styles, and the app's address. It must be legible printed on A3 or Letter, and at 1200 px wide on a screen. Light theme. Under 400 KB.
4. **Honest.** A template whose proving record is red says so, with the record's own reason. No claim beyond what the records hold (`docs/decisions/0013-value-as-of-study-one.md`).
5. **Checked.** `node scripts/field-guide.mjs --check` passes, and `.github/workflows/ci.yml` runs it beside the other generated-file checks. `pnpm -r build && pnpm -r test` pass.
6. **Evidence.** A PNG of the poster (rendered with the repository's own tools, or Playwright) saved as `handoffs/0059-field-guide/poster.png`, at most 600 KB, and you have looked at it: no overlapping text, nothing cut off.

## Allowed changes

`scripts/field-guide.mjs`, `docs/field-guide.md`, `docs/field-guide/**`, one step in `.github/workflows/ci.yml`, `handoffs/0059-field-guide/**`. Read anything.

## Forbidden changes

`patterns/**`, `experiments/**`, `packages/**`, `apps/**`: the guide is made from them and changes none of them. No new dependency.

## How to verify

`pnpm -r build && node scripts/field-guide.mjs --check && pnpm -r test`, then look at the poster.

## Hand back

Write `handoffs/0059-field-guide/HANDBACK.md` from `handoffs/TEMPLATE-HANDBACK.md`. Commit on your branch, push it, and do not open a pull request: the driver does.

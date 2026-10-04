# Handback 0057 · No-friction toolkit

**Implementer:** Sonnet 5.5 · **Branch:** `slice/0057-no-friction-toolkit` · **Head commit:** `9a99bcf` (the work; the handback commit follows it) · **Date:** 2026-10-04

## Status

`done` — all ten criteria are met, including 8 and 9.

## What changed

- `packages/cli/src/index.ts`: short overview, `grooph help <command>`, did-you-mean, usage errors that name the command, `explain` wired in. The 72-line usage is gone.
- `packages/cli/src/commands/help.ts` (new): the overview, the nearest-command measure, help pages with an example for new, apply, validate, canonicalize, export, explain.
- `packages/cli/src/commands/explain.ts` (new): `grooph explain`. The bounds are computed inside the command from `estimateShape` and the document; no core change.
- `packages/cli/src/commands/{new,template,template-args,validate,apply,export,adopt,pick,share}.ts`: files for people at a terminal; `grooph:` prefixes; `next:` lines; `template use` no longer needs `--name`.
- `packages/cli/src/{print,io}.ts`: `Output.isTTY`, `printNext`, a missing file named as typed.
- `packages/cli/test/friction.test.ts` (new); `cli.test.ts` and `template.test.ts` adjusted (see Deviations).
- `docs/quickstart.md` (new), `docs/rules.md` (new, generated), `scripts/first-run.sh` (new), `scripts/rule-reference.mjs` (new), `.github/workflows/ci.yml` (two steps).
- `docs/PROGRESS.md`: one line under In flight, as the handback skill asks.

## Verified, and how

Cold run of `pnpm -r build && pnpm -r test && scripts/first-run.sh && node scripts/rule-reference.mjs --check && scripts/test-install-local.sh`: core 337 pass, cli 108 pass, first run ok, rules current, install checks passed. Playwright: `GROOPH_E2E_PORT=4357 pnpm --filter @grooph/web test:e2e`: 92 passed, 62 skipped, none failed. The patterns index check also passes.

1. `grooph validat x` prints the suggestion and a `grooph --help` line, exit 1, no usage: friction.test.ts.
2. Errors: friction.test.ts (missing file as typed, prefix, usage errors). Issue lists (`error E_…`) keep their own format, and so do continuation lines.
3. `new` and `template use` write `<id>.grooph.json` when `isTTY` is true and print the document otherwise; `--name` falls back to the template's title: friction.test.ts.
4. `next:` lines for new, template use, apply, validate (clean and not), export, explain: friction.test.ts.
5. `--help` is 39 lines; `help <command>` equals `<command> --help` and has an Example: friction.test.ts.
6. `docs/quickstart.md`: two paths, the by-hand commands copied from 0055.
7. `scripts/first-run.sh` passes, and CI runs it.
8. `docs/rules.md`: 35 rules (24 graph, 11 map); `--check` passes and CI runs it.
9. `grooph explain <file> [--json]`: friction.test.ts.
10. No fixture or golden file changed (`git diff main -- fixtures` is empty).

## Decisions made

- Nearest command: edit distance with transposition as one edit, a prefix of three or more letters counting as one edit, and a limit of one edit per three letters typed. This is why `wat` suggests `watch`.
- `next:` lines print only at a terminal, except the ones `new`, `template use` and `pick` already printed with `--out`. A pipe's stdout and stderr must not change (Forbidden changes), and existing tests assert clean stderr.
- `isTTY` lives on the `Output` object so tests can set it without a pseudo-terminal.
- The `docs/rules.md` passing example is one fixed clean document per kind. Most rules have no matching passing fixture, and inventing one would be new fixture work.

## Deviations

- Two existing test expectations changed, each because a criterion requires it: an unknown command no longer prints the usage (cli.test.ts), and `template use` without `--name` no longer fails (template.test.ts). Two others follow the new overview and help text.
- Non-terminal text changed in one place: error lines now start with `grooph:` (criterion 2).
- `docs/PROGRESS.md` is outside the allowed list. I appended one line because the handback skill requires it.

## Risks and leftovers

- `bounds` stayed in the CLI. If the app wants it, it moves to core.
- `template use` at a terminal refuses to overwrite `<id>.grooph.json` without `--force`. A second run needs `--force` or `--out`.
- Lane 0056 adds its `embed` command to `index.ts` after this lands, and the overview has no line for it. The driver wires both.

## Prompt to paste into the driver session

```text
Handback for slice 0057 is at handoffs/0057-no-friction-toolkit/HANDBACK.md on branch slice/0057-no-friction-toolkit (head 9a99bcf). Status: done. Please reconcile with the grooph-reconcile skill.
```

# Handoff 0057 · No-friction toolkit: no dead end between nothing and an exported package

**Stage:** 19 (polish) · **Implementer:** Sonnet 5.5, effort medium; the driver (Opus 5.5) reviews before merge · **Branch:** `slice/0057-no-friction-toolkit` · **Drafted:** 2026-10-04 · **Confirmed by owner:** pending

## Objective

A person or an agent goes from a fresh clone to an exported package without one dead end, and every error says what to do next. The audit found dead ends in the first three commands a newcomer types (`handoffs/briefs/plan-2026-10-04.md`, section 3).

## Success criteria

Each has a test in `packages/cli/test/` unless it names another check.

1. **An unknown command suggests the nearest one.** `grooph validat x` prints `grooph: unknown command "validat". Did you mean "validate"?` and one line pointing at `grooph --help`, exits 1, and does not print the whole usage.
2. **Errors look alike.** Every error line starts `grooph:`. A missing file is named as the user typed it, not as an absolute path.
3. **`grooph new` and `grooph template use` leave a file when a person runs them.**
   - When standard output is a terminal and there is no `--out`, they write `<id>.grooph.json` in the current folder, say `wrote …`, and print a `next:` line.
   - When standard output is not a terminal they print the document as today. Agents and scripts rely on that, and it must not change.
   - `template use <name>` with no `--name` uses the template's title.
4. **Every command that succeeds says what comes next,** in one `next:` line, where there is an obvious next step: new, template use, apply, validate (when clean, and when not), export.
5. **`grooph --help` fits a screen.** At most 45 lines, grouped by what you are doing (start, check, compile, see, watch, share), each line with the command and five or six words. `grooph help <command>` and `grooph <command> --help` print that command's full help with one example.
6. **`docs/quickstart.md`.** Two paths: ask your agent (`/grooph-design`), and by hand. The by-hand path is exactly the commands in handoff 0055's "Design already decided".
7. **`scripts/first-run.sh`** runs the by-hand path in a fresh temporary folder against the built CLI and fails if any command fails or if the package is not there at the end. CI runs it.
8. **`docs/rules.md`, generated.** `scripts/rule-reference.mjs` writes one section per rule code from `fixtures/`: the code, what the validator prints, a failing example and a passing one. `--check` fails when the file is stale, and CI runs it, as it does for the patterns index.
9. **`grooph explain <file>`** says in plain words what bounds a graph: for each loop, how many rounds at most, the budget, and what happens at each stop; every human gate and what it guards; and the worst case in one line. It adds no new rule: it reads what the validator already reads. `--json` gives the same as data.
10. **Nothing else moves.** `pnpm -r test`, Playwright and `scripts/test-install-local.sh` pass. No golden file changes except where a criterion above requires it, and the handback lists each.

## Read first

1. This file
2. `AGENTS.md`
3. `handoffs/briefs/plan-2026-10-04.md`: section 3, the CLI rows
4. `docs/graph-ir.md` (rules and codes), `docs/templates.md`
5. `packages/cli/src/index.ts`, `packages/cli/src/commands/`, `packages/cli/src/print.ts`
6. `scripts/patterns-index.mjs` (the pattern for a generated file with `--check`)

## Allowed changes

`packages/cli/src/index.ts`, `packages/cli/src/print.ts`, `packages/cli/src/commands/**` except `hooks.ts`, `packages/cli/src/commands/explain.ts` (new), `packages/cli/test/**` (new files, and existing ones only where a criterion changes their expectation), `packages/core/src/**` only for a pure `bounds(document)` function with tests if `explain` needs one, `docs/quickstart.md` (new), `docs/rules.md` (generated), `scripts/first-run.sh` (new), `scripts/rule-reference.mjs` (new), `.github/workflows/ci.yml` (two steps).

## Forbidden changes

- `packages/cli/hooks/**`, `packages/cli/src/commands/hooks.ts`, `packages/cli/src/events-io.ts`: they were settled this week over seven rounds with another project's lanes depending on them.
- `apps/**`.
- `README.md` (lane 0055 owns it).
- `spec/**`.
- Any change to what a command prints when its output is not a terminal, other than error text.

## Design already decided

- Agents are the main users of the CLI (decision 0007). A change that helps a person at a terminal must not change what an agent's pipe receives.
- No new dependency.

## Implementer's choices

How "nearest command" is measured, the grouping of the help, the wording of `next:` lines, the layout of `docs/rules.md`.

## How to verify

`pnpm -r build && pnpm -r test && scripts/first-run.sh && node scripts/rule-reference.mjs --check && scripts/test-install-local.sh`

## Stop rules

Hand back when the criteria are met. Also stop and hand back with what is left if:
- you have worked about six hours;
- the same check has failed three times;
- you need a file outside the allowed list;
- the owner says "save point": commit, push, write your exact next step in `HANDBACK.md`, stop.

If time runs short, criteria 1 to 7 are the slice. 8 and 9 may hand back as a second slice.

## Prompt to paste

```text
You are an implementer for grooph. Read handoffs/0057-no-friction-toolkit/HANDOFF.md first, then the files it lists. Stay inside its allowed changes. Work on branch slice/0057-no-friction-toolkit, commit often, push, open a pull request against main, and finish with the grooph-handback skill. Do not merge.
```

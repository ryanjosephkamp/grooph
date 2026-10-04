# Handoff 0065 · Community: loop graphs by pull request, checked and drawn by CI

**Implementer:** Sonnet 5.5 (a subagent of the driver) · **Branch:** `slice/0065-community`, from `integration/2026-10-04` · **Drafted:** 2026-10-04 by the driver, under the owner's word to build through the night · **Stage:** 12 (community gallery)

## Objective

Anyone can add a loop graph to grooph's repository by pull request, and CI checks it and draws it with no person in the loop until the owner decides to merge. No backend (decision 0001). The gallery is a generated page.

## Success criteria

1. **`community/README.md`** says how to submit, in under a screen:
   - one folder per author, `community/<handle>/`;
   - one document per file: a graph, a template or an operation map;
   - what the document's own fields must carry: a name, a goal or summary, and credit and links where the shape comes from someone else's work;
   - how to check it before sending (`grooph validate`), and how to see it (`grooph image`).
2. **`scripts/community-index.mjs`** reads every document under `community/`, validates each with core, and writes:
   - `community/index.json`: for each, its path, author, kind, name, summary, its shape in one line, and a link that opens it in the app (the same payload `grooph share` makes);
   - a glyph or picture per document under `community/pictures/`;
   - `docs/community.md`: the gallery as a page, one entry per document with its picture, its author, its summary, credit, and the link to open it. It says plainly that community graphs have no proving run unless one is linked.

   `--check` exits 1 when anything generated is stale or any document fails validation. A document that fails is named with the validator's own lines.
3. **`.github/workflows/community.yml`** runs on a pull request that touches `community/**`:
   - it builds, runs the script's check, and writes what it found to the job summary: valid or not, with the validator's lines, for each changed document;
   - it uploads the pictures as an artifact;
   - it runs on the `pull_request` event with read-only permissions and no secrets. It never executes anything from a submission: documents are read as data only. Say in a comment at the top of the file why that matters.
4. **Three seed submissions** under `community/grooph/`, each a template for a research workflow, each validating clean:
   - a literature sweep: search, screen against stated criteria, extract, and a critic that looks for a contradicting source before the summary is accepted;
   - a replication check: one agent reproduces a result from the description alone, a check compares numbers, and a person decides when they disagree;
   - a hypothesis ratchet: propose, test against held-out cases, keep only what beats the last kept result, stop on diminishing returns.

   Model them on the built-in templates in `patterns/` (read `docs/templates.md` and `docs/graph-ir.md`). Each loop has stops in order, each taste loop a bar, each critic its own context. They are marked as not proved.
5. **An issue form** `.github/ISSUE_TEMPLATE/loop.yml`: "Suggest a loop", for people who have a shape and no document: what it is for, who builds, who checks, what stops it, a link.
6. **Checked.** `pnpm -r build && node scripts/community-index.mjs --check && pnpm -r test` pass. `.github/workflows/ci.yml` runs the check beside the other generated-file checks.

## Allowed changes

`community/**`, `scripts/community-index.mjs`, `docs/community.md` (generated), `.github/workflows/community.yml`, one step in `.github/workflows/ci.yml`, `.github/ISSUE_TEMPLATE/loop.yml`, `handoffs/0065-community/**`.

## Forbidden changes

`patterns/**`, `packages/**`, `apps/**` (no change to the app: the gallery is a page, so the app's weight does not change), any new dependency, any workflow trigger other than `pull_request` and `push`, any use of a secret or a write token in the community workflow.

## How to verify

`pnpm -r build && node scripts/community-index.mjs --check && pnpm -r test && node scripts/perf-budget.mjs --check`

## Hand back

Write `handoffs/0065-community/HANDBACK.md` from `handoffs/TEMPLATE-HANDBACK.md`. Commit on your branch, adding files by name, push it, and do not open a pull request: the driver does.

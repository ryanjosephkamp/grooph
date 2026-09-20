# Gate briefs

The driver publishes a brief as a Claude Artifact at a gate, so the owner can read it on a phone and copy the next prompt. **A published page belongs to the Claude account that published it.** Another account cannot open or update it, and sees nothing at its URL.

So the page is never the record: the file beside it is. Each brief here is the source the page was published from. Publishing it again from another account mints a **new URL**; record the new one in the table below, replacing the old.

| Source | Page title | URL (account `ryanjosephkamp`, as of 2026-09-19) | Covers |
|---|---|---|---|
| [`gate-0001.html`](gate-0001.html) | grooph Gate 0001 | https://claude.ai/artifact/HtmTY1yAjqRqDbDr14cFHA | End of stages 0–1: plan locked, scaffolding pushed, slice 0001 awaiting confirmation |
| [`gate-0002.html`](gate-0002.html) | grooph Gate 0002 | https://claude.ai/artifact/XHf1AE28eMkPUdk3CQF6sj | Slice 0001 merged after its first real Claude Code run; slices 0002 and 0003 offered |
| [`slice-0007-options.html`](slice-0007-options.html) | grooph slice 0007 options | https://claude.ai/artifact/TN1LH8i1e93P7atU18qh8c | A one-tap launcher for the three candidate workflows for slice 0007, wrapping a 5,009-character share link |
| [`account-handover.html`](account-handover.html) | grooph Account Handover | https://claude.ai/artifact/CvWYDVgeZ49mJaxjvbzoGH | The switch checklist and the first prompt for a new Claude account; the full recipe is [`docs/HANDOVER.md`](../../docs/HANDOVER.md) |

Nothing downstream reads these pages. Their substance is in [`docs/PROGRESS.md`](../../docs/PROGRESS.md), [`docs/PLAN.md`](../../docs/PLAN.md) and each slice's `REVIEW.md`; the briefs restate it for a phone. Losing a URL costs a bookmark, not a record.

`slice-0007-options.html` is a special case worth knowing: the share link inside it encodes the proposal set in its own URL fragment, so it depends on the **app** (GitHub Pages, tied to the GitHub account) and not on the Claude account. That link keeps working after a Claude account switch; only the wrapper page around it stops.

## Publishing one again

Read the file, update its facts, publish it with the Artifact tool, then write the new URL into the table above in the same commit. Keep the title and favicon stable so the page keeps its identity in the new account's gallery.

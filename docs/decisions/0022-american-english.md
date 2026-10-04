# 0022 · Public-facing text is American English

**Date:** 2026-10-04 · **Status:** accepted (the owner asked for it, 2026-10-04) · **Deciders:** owner, driver

## Context

grooph's text was written in a mix of spellings, British more often than not: "colour", "prioritise", "summarising", "centre". The owner asked for American English in everything the public reads, an audit and a correction pass, and American English in internal writing from now on.

## Decision

1. **Everything public-facing is American English.** That is the README, the documents the site renders and the other reference documents, the app, the CLI, the core (its messages, and what the compiler writes into a package), the templates, the community folder, the plugin, the scripts that generate public pages, the fixtures and the issue templates. Whole files, comments and names included, so a British word cannot reach a message by way of a variable.
2. **The internal record is left as it was written.** Handoffs and handbacks, decisions before this one, the plan and the progress page as they stood, the review of October 2026, and everything under `experiments/`: evidence is never edited by hand (decision 0009). The spec is frozen and changes only by amendment. New internal writing is American too; nothing checks the old.
3. **A check, in CI.** `node scripts/american-english.mjs --check` reads the public-facing files for British spellings by family (-our, -ise, -re, doubled l, and a list of words) and fails with the American form. A word that is right where it stands goes in the script's `ALLOWED` list with its reason.
4. **Spelling alone is not a change to a package.** The correction touched one word of what the compiler writes ("summarises") and the prose of five templates. No proving run was repeated for it: the convention that a package change goes through a proving run is about what an agent does, and a spelling does not change that. The proving records stand as records of the earlier text.

## What the pass changed

About 300 words in 85 files. By kind:

- **Names in code**, most of them: `colour` in the picture and glyph code, `centre` in layout. Renamed throughout, tests included.
- **What people read**: the CLI's help for `embed`, `glyph` and `image`; "Picture colors" in the app; six documents on the site.
- **What the compiler writes**: one word in the lead's brief. The two golden packages changed with it.
- **Templates**: prose in `spec-then-loop`, `specialist-critic-bank`, `gauntlet-decomposed` and `ralph-loop`. In `patrol-pulse` the word was also a node's id (`prioritise`) and a gate's option (`prioritised`): both are respelled, which is a change to the document, so that template is **version 2**.

## Left as they are, on purpose

Each is in `ALLOWED` with this reason.

- **`cancelled`** where it is GitHub's word for a run's conclusion, or `node:test`'s word in its summary. Another program's name for a thing is not ours to respell.
- **The blind judge's prompt** in `scripts/lib/compare-run.mjs` ("the main behaviour is right"). It is the instrument study one used; an instrument is not reworded between studies.
- **One comment in the push script** (`packages/cli/hooks/grooph-events-push.mjs`, "spelt"). Other repositories hold copies of that file, and `grooph hooks` compares them with the one shipped. It changes with the script's next real change.
- **"halted at `prioritise`"** on the field guide page. That is the node's id in the run recorded on 2026-09-22. The template's re-proof (handoff 0019) will replace the record.

## Found on the way

The pass changed the length of the review loop's share link, and a test that cut the link in half began to fail: a link cut to a length no encoding produces was reported as containing "characters a grooph link never has". It now reads as cut short, like any other cut, and the test cuts at all four remainders.

## Consequences

- A new public string is American, or CI says so.
- The check knows words, not grammar or punctuation. It will miss a British idiom and a word that is not on its list; add the word when one is found.
- `patrol-pulse` is at version 2 with a record made at version 1. The field guide says where the recorded run halted in the record's own spelling.

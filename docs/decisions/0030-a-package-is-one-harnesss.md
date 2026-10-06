# 0030 · A package is one harness's, and the document names which

**Date:** 2026-10-05 · **Status:** in force since pull request #127 merged on 2026-10-05, on the owner's word to merge the Codex target, and released in 0.4.0; he has not been asked about points 4 and 5 one by one (as proposed: the owner's word on the review desk, card q39, was that the loosened brake be fixed before the Codex target merges; the driver set points 4 and 5 below from its reader's findings; this record is the lane's draft of what was then built) · **Deciders:** owner

## Context

Until the Codex target, grooph had one compile profile. A document whose `target.harness` was anything but `claude-code` was refused at export for want of a profile (`E_NO_TARGET`), so a document and the export asked of it could not disagree and still compile.

Slice 0076 gave Codex a profile. The Claude Code compiler took its profile from the document's own harness, so `fixtures/valid/review-loop.grooph.json` naming Codex, exported with `--target claude-code`, exited 0 and wrote Claude Code agent files with the model `gpt-6-luna` and no `tools` or `disallowedTools` lines, which in Claude Code means every tool. The review's second read called it a brake loosened by the pull request, and the review desk's card q39 put it to the owner as one to be fixed before the target merges.

The driver's reader then found the same mistake reachable two more ways: a machine-wide `GROOPH_MODELS` naming Claude Code's models wrote them into a Codex package, and the reverse; and a critic told apart from its builder only by a pin for the other harness was not flagged, though the package put both on one model.

## Decision

1. **A package is one harness's files.** Nothing in it is written with another harness's profile, model names or units.
2. **The document names which harness** (`target.harness`). It is the document's own metadata, as the spec's section 5.1 lists it, and the app, `grooph pick` and `grooph adopt` already read the target from it.
3. **An export for another harness than the document names is refused**, the same way for every target: `E_NO_TARGET`, reported by `compile()`, since the validator is not told which export is asked for. It is refused and not warned, because the two were said in two places and one of them is a mistake grooph cannot settle; because a package for another harness would carry a copy of the graph, an outline and a `grooph adopt` line naming a harness the package is not for; and because a refusal can be loosened to a warning later without breaking anyone, where the reverse cannot.
4. **Each compiler uses its own target's profile whatever the document names**, and reads a node's pin by its own target's name. Point 3 is then not the only thing between a mistake and a package.
5. **A machine's model names are per harness.** `GROOPH_MODELS` is read for the Claude Code target only, as it always was. The Codex target reads `GROOPH_MODELS_CODEX` and never `GROOPH_MODELS`. `--models`, typed on the command, applies to that export whichever its target, since the person typed it for it. The export prints which of them named the tiers.
6. **The validator's check that a critic differs from its builder reads the pin for the harness the document names** (`W_HOMOGENEOUS_CRITICS`). A pin for another harness tells nothing apart in this document's package. A document that names no harness yet is read by every pin, as before.

## What it costs

- **One op before a Codex export of a graph made from a built-in template.** The templates name Claude Code. `setTarget` names another harness (`echo '[{"op":"setTarget","harness":"codex"}]' | grooph apply <file> --ops - --write`), or the graph inspector's harness choice in the app. `grooph template use` has no `--target` yet.
- **A machine that set `GROOPH_MODELS` for Codex**, in the hours the Codex target existed on a branch, sets `GROOPH_MODELS_CODEX` now. No release ever read `GROOPH_MODELS` for Codex.
- **A mismatch is seen at export, not before.** `grooph validate --for-export` can say "0 errors" for a graph the export then refuses.

## How it sits with what is already decided

- **It restores what `main` did before the Codex profile existed.** Such an export was refused then, for want of a profile. No export that worked on `main` is refused now.
- **The spec's first principle** says the graph is independent of which harness will run it, and that a harness is a compile target. That holds: nothing in a graph's nodes, edges, loops or stops is a harness's, and one op retargets a graph. What this decision adds is that the target is said once, in the document, and an export does not contradict it silently. No amendment is asked for.
- **The game experiment's protocol** (`experiments/game/PROTOCOL.md`, section 2) already allows for it: "If the Codex compiler needs the document to name its harness, that one line differs and the difference is in the record." The Claude Code run's starting contents are unchanged (the tree `3238a9052ce7765c79990029bbff6bccd88628bf`).
- **Decision 0029** is untouched: nothing here is a claim about what grooph is shown to do.

## Not decided here

- **Two packages of one graph in one project.** A graph exported for one harness and then, renamed, for the other into the same folder leaves both harnesses' files beside one `.grooph/<graph-id>/`, and the export says nothing. A check in the export is the first follow-up, after the change that makes export aware of what grooph last wrote (pull request #60). The files to look for are in the handback of slice 0076 ("After the driver's reader") and in `docs/targets/codex.md`, "Known limits".
- **Whether `grooph adopt` should hold a run's change of harness as it holds a brake.** It takes one today. That goes to the audit and to the owner.
- **A fixture for the new case of `E_NO_TARGET`.** A fixture is a document, and the fixtures' runner validates a document without an export; it cannot say "exported for that target". The case is held by `packages/core/test/compile-target.test.ts` and `packages/cli/test/cli.test.ts`, and the rule's row in `docs/graph-ir.md` says so.

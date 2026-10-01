# 0016 · What the Operator's first use changed

**Date:** 2026-10-01 · **Status:** accepted (the owner approved the merge and the generic public sample, 2026-10-01) · **Deciders:** owner, driver, from the Operator's reply

## Context

`docs/HANDBACK-operator.md` was written for a session nobody here had met. On 2026-10-01 that session, the Operator, built grooph 0.1.0 in a cloud sandbox, drew the real operation, and answered: nine questions, a map, and six things wrong or missing. This is the first time grooph was used by someone who did not build it.

## Decision

1. **The sample map is the one the session that runs the operation drew**, not the one drawn from the brief. The first draft stays as a fixture, labelled as a draft. The public copy leaves out the product's own details; the Operator's file stays with the owner.
2. **A picture is measured for the widest font it is likely to meet.** The Operator's PNG, drawn on Linux, ran past its boxes because the measure assumed a narrow font. The alternative, shipping a font, would fix the PNG and not the SVG a browser draws. The cost is a little slack on a Mac or a phone.
3. **Words before arcs.** With one hub and eighteen handoffs the arcs took more than half the picture and the names were cut. The cards now keep most of a lane's width and the tracks close up; a name wraps before it is cut.
4. **Events travel on a branch of their own.** The first handback said to commit `.grooph/events/` with a lane's work. The Operator saw at once that this puts event files in every pull request. `grooph events push` writes one commit holding only that folder to its own branch, by git's plumbing, so nothing in the work is touched. It is a command a lane runs, not something the hook does: the hook's promise is one appended line and no network.
5. **A map may draw a person** (amendment A-013). The owner is the hub of the operation and could be shown only as a carrier between two sessions. People are optional, additive, and not sessions; the `person` carrier stays for a map that does not need more.
6. **Each of these is checked by the Operator's next use, not by this repository's tests alone.** The tests show the code does what it says. Whether the picture now reads on Linux, whether a cloud sandbox may push the events branch, and whether the redrawn map is right are the Operator's to say.

## Consequences

- Slices 0037 to 0040; version 0.2.0; amendment A-013.
- `docs/HANDBACK-operator.md` section 12 answers each of the six, and section 8 says what each answer changed.
- The handback now has a reader. What it says is "known limit" will be tested by someone who can say it is wrong.

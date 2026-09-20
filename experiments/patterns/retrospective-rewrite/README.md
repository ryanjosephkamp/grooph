# retrospective-rewrite · one proving run

_(run pending)_

## Task

[`task/`](task/): `intervals`, where `tests/interval.test.mjs` already specifies a missing `mergeIntervals` (touching and adjacent-integer intervals join; the input is left alone) and fails. The task ([`slots.json`](slots.json)) also asks for a README entry, which no test covers: something for the retrospective to notice.

## Mechanism

None of the three loop-forcing mechanisms applies honestly: the grind loop's bar is the test suite, and a builder that runs the tests before reporting passes at round 0. The design bet is elsewhere: the graph is at `adaptation: "propose"`, so the record must show at least one `proposal` note from the researcher and no amendment ([`expect.json`](expect.json)).

## Shape

`builder` (fast) → `tests` check; fail → `builder`; pass → `retro` (researcher, strong; reads the run's notes and `PROGRESS.md`) → `done`. Loop `grind`: max-iterations 5 then `retro`, budget 30 minutes then `retro`.

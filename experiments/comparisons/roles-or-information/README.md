# Roles or information: two arms on study two's tasks

**On paper, written on 2026-10-05. Nothing here has been run, and this is not yet a pre-registered project:** it holds the two derived prompts for each of study two's three tasks, so that the owner can read exactly what each arm would be given before he says yes or no. The question and its yes and no are in [`handoffs/briefs/study-three-on-paper.md`](../../../handoffs/briefs/study-three-on-paper.md), question 5.

## Why

In both comparisons the reviewer held evidence the builder had not seen. So a design ended above the task alone, and nobody can say whether the roles did it or the information did (audit 0001, finding F12). These two arms take the two apart, on the same three tasks and with the same suites as the scorer.

| Arm | What the session is given | What it takes away |
|---|---|---|
| **E, information without roles** | The task alone, as study two's arm D, with the held-out material a reviewer was given named to the one session | the roles: no builder, no reviewer, no loop |
| **F, roles without information** | Study two's design as prose, as its arm B, with no held-out material anywhere | the information: a reviewer in a fresh context that holds nothing the builder lacks |

## How each prompt is made

Nobody writes either by hand. `node scripts/lib/compare-arms-ef.mjs --write` makes them, and `--check` confirms the kept ones are what the rule derives today.

- **Arm E** is arm D's kept prompt, byte for byte, with one section added at its end. The section names the held-out files a reviewer was given in study two (the task's `held-out/` folder, less what was the scorer's alone) and uses the same words for every task: a suite is run and every case made to hold; any other file is read and agreed with. It names no role, and it does not say where the files are.
- **Arm F** is the protocol's own derivation of arm B, from a package compiled with [`slots.F.json`](review-gate-2/slots.F.json) in place of study two's slots. Those are study two's slots with the one value that named the held-out material rewritten to name only what is inside the project. Every other value is the same, byte for byte, and the script refuses anything else.

| Task | Arm E names | Arm F's one changed slot | Now reads |
|---|---|---|---|
| [`review-gate-2`](review-gate-2/) | `layer-cases.test.mjs` | `checklist` | `docs/REVIEW-CHECKLIST.md` |
| [`heterogeneous-critic`](heterogeneous-critic/) | `parse-ranges-cases.test.mjs` | `checklist` | `docs/REVIEW-CHECKLIST.md` |
| [`taste-polish`](taste-polish/) | `REFERENCE.md`, `reference.txt` | `reference` | `STYLE.md`, the file the owner already works from |

## What to know before saying yes

- **On two of the three tasks, arm E is handed the scorer's own suite and told to pass it.** In `review-gate-2` and `heterogeneous-critic` the file a reviewer ran in study two is the file the scorer runs. So there "E matches A" can mean only this: a session given the answer key and told to satisfy it does so. That is a ceiling, and it would be a surprise if E fell short of it. It is not evidence that roles add nothing. **The arm that can say something on those two tasks is F:** whether a reviewer who holds nothing the builder lacks lifts the result above the task alone.
- **In `taste-polish` arm E is informative.** There the reviewer was given the reference statement and the notes on it, and the scorer's own suite was kept from every session. E is given the reference and not the suite.
- **Arm E is told more firmly than a reviewer was.** A reviewer was told to run the suite and report what failed. The one session of arm E is told to run it and make every case hold.
- **In `taste-polish`, arm F's reviewer is awkward.** The template has its reviewer compare the captures "side by side" against a reference. With no reference, the derived prose has it compare them against `STYLE.md`, in the template's own words. The words are the template's and are left as derived.
- **The task text is study two's, unchanged, in both arms.** In `taste-polish` it says the billing team's statement "is kept outside this project" and to work from `STYLE.md`. Arm F's prompt still carries that sentence: it names no path, and in arm F no folder exists for it to point at. Arm E carries it too and then names the statement, so its two sentences pull against each other. Both prompts are left that way: the task text goes to every arm as written.
- **Where the held-out material is.** Arm E's added section does not say. The token `<held-out>` becomes a real path when a run is built, and from the clean profile that path has to be inside the session's folder ([`../profile/README.md`](../profile/README.md)).
- **The scorer and its suites are study two's.** Nothing under `experiments/comparisons/review-gate-2/`, `heterogeneous-critic/` or `taste-polish/` is changed or copied.

## What is not here yet

The pre-registration in the runner's fields (the losing tests, the replicates, the spend), the runner's support for the two arms, and the clean profile the sessions would start from. Each waits for the owner's yes.

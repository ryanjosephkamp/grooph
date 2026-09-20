# human-gated-irreversible · one proving run

_(run pending)_

## Task

[`task/`](task/): `notes-store`, a tiny module whose tests already specify a missing `removeNote`. The fragment is proved inside a host ([`slots.json`](slots.json)): `grind-loop` is instantiated, `human-gated-irreversible` is inserted with `grooph template insert`, and three ops route the tests' pass edge into the fragment's gate and drop the host's own stop node, so the graph reads `builder` → `tests` → `gate` → `act` (publish: write `PUBLISHED.txt`) → `done`.

## Mechanism

None of the three loop-forcing mechanisms: this fragment's point is the brake, not a loop. The design bet is that the run halts at the gate with a halt note and `PUBLISHED.txt` never exists ([`expect.json`](expect.json): `notRun: act`, `absent: PUBLISHED.txt`). The halt is the ending; no gate in this batch gets a scripted answer.

## Shape

`builder` (fast) → `tests` check; fail → `builder`; pass → `gate` ("About to do this, and it cannot be undone … Go ahead?") → `act` (`irreversible: publish`) → `done`. Loop `grind`: max-iterations 5, budget 30 minutes.

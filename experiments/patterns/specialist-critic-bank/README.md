# specialist-critic-bank · one proving run

_(run pending)_

## Task

[`task/`](task/): `userfiles`, the file store behind a "my files" page, whose helpers carry two planted defects: `readUserFile(root, name)` joins the request's name onto the root with no traversal check, and `listFiles(root)` reads every file whole to report its size. The task ([`slots.json`](slots.json)) asks for `searchFiles(root, query, { within })`, built on those helpers, with a request-supplied subfolder.

## Mechanism

A real search space for four specialist critics: the change is told to build on helpers whose defects it inherits, and it adds a second traversal surface (`within`) of its own. The design bet: the security and performance critics rate what they find blocker or major, the triage judge merges four reports and sends the builder back once, and the second round is clean, ending in a halt at `gate` ([`expect.json`](expect.json)).

## Shape

`builder` (strong) → `correctness`, `security`, `performance`, `taste` (strong, fresh, in parallel, concurrency cap 4) → `triage` (frontier) → `gate` → `done`; triage fail and gate rejection → `builder`. Loop `review`: bar-passed, max-iterations 4, budget 26 dispatches.

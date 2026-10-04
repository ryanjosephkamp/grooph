# Community loops

Send a loop graph, a template or an operation map by pull request. There is nothing to sign up for and nothing is uploaded: CI checks and draws your document, and the owner decides whether to merge. The gallery is [docs/community.md](../docs/community.md).

**Where it goes.** One folder per author, named for your GitHub handle: `community/<handle>/`. One document per file, named for its id: `<id>.grooph.json` (a graph or a template) or `<id>.grooph-map.json` (an operation map). The folder may also hold Markdown write-ups (`.md`); nothing else.

**What the document must carry**, in its own fields, so it travels with the file:
- A name, and a goal or summary: `name` and `goal` or `description` for a graph, `template.title` and `template.summary` for a template, `name` and `description` for a map.
- Credit and a link wherever the shape comes from someone else's work: `template.credits` for a template (name, link, what you took), the `description` for a graph or a map. Say what you took, never that they endorse it.
- For a template, an example for every slot: CI fills them in to check and draw it.

**Check it before you send it.**

```bash
grooph validate community/<handle>/<id>.grooph.json                      # errors fail CI, warnings are listed
grooph image community/<handle>/<id>.grooph.json --out picture.svg       # what the gallery will draw
```

**What happens next.** `community.yml` reads each document you changed as data (nothing in it is ever run), writes valid or not to the job summary with the validator's own lines, and attaches the pictures. The gallery files (`community/index.json`, `community/pictures/`, `docs/community.md`) are generated: leave them out of your pull request, and the owner refreshes them when merging with `pnpm -r build && node scripts/community-index.mjs`. If you do include them, they must be exactly what that command writes.

**Proof.** An entry says "no proving run linked" unless a template's `template.demo` links a recorded run. Valid means sound, not that it works.

No document yet? [Suggest a loop](https://github.com/ryanjosephkamp/grooph/issues/new?template=loop.yml). By sending a document you agree it is published here under the repository's license (MIT).

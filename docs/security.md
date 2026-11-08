# Security

What grooph does with a document someone else made: a link, a file, a pasted document or Mermaid text, or an embed on another page. Each item names where it is enforced and the test that holds it. For what leaves your device, see [privacy](privacy.md). To report a problem, see [`SECURITY.md`](https://github.com/ryanjosephkamp/grooph/blob/main/SECURITY.md).

## Links

- **The document rides in the link's `#fragment`,** which browsers do not send to any server.
- **A link is refused before anything is drawn when its payload is over 1 MB, or when it unpacks to more than 4 MB.** No real graph comes near either: a large one is a few kilobytes. These are `SHARE_PAYLOAD_MAX` and `SHARE_JSON_MAX` in `packages/core/src/share.ts`, held by `packages/core/test/share.test.ts`, which includes a link that unpacks without end.
- **What a link unpacks to is read as untrusted input:** against the document's schema, and against the size caps below. That holds for a graph, a map, a set of candidate graphs, and a run.

## Size

grooph opens and draws a graph of up to:
- 500 nodes and 2,000 edges;
- 200 loops and 200 groups;
- 2,000 members of loops in all, 2,000 members of groups in all, and 2,000 stops of loops in all.

It opens an operation map of up to 200 sessions, 1,000 handoffs, 100 lanes, and 100 people.

A document over a cap is refused before anything is drawn, with a message that says how many it has and what grooph opens. This holds however it arrives: a link, a file, a paste, Mermaid text, the command line, a set of candidate graphs (each graph in it), or a run (the graph it started from and its working copy).

The largest real diagrams in this repository are a graph of 12 nodes and 13 edges and maps of up to 9 sessions and 23 handoffs. On an Apple M3 Pro laptop (measured October 28, 2026):
- a graph at the caps draws flat in about 35 ms;
- its slowest 3D view, the spiral, takes about a second, and about 2.5 seconds when every one of its 200 loops is capped at 50 rounds or more;
- groups nested 200 deep draw in under a second in every 3D view;
- a run of 55,000 notes is read and drawn in about a third of a second.

A phone is slower again. A spiral is drawn at most 50 rounds tall; a higher cap is said in words under it. The caps are in `packages/core/src/limits.ts`, held by `packages/core/test/limits.test.ts` and `packages/core/test/still.test.ts`.

## Text from a document

**Text is escaped wherever grooph shows it.** Markup in a name, a brief, a goal, a loop, a verdict, or a stop stays words. It never becomes an element, an attribute, or a handler. An id or a harness named like a built-in of the language, such as `constructor`, is drawn as its own name. This covers:
- the picture in every theme;
- the glyph;
- the 3D views, and their stills;
- the offline page;
- a map's pictures.

Characters that XML does not allow (control characters other than tab and line breaks, U+FFFE and U+FFFF, and half of a surrogate pair) are dropped, so a picture saved as its own `.svg` file still opens. `packages/core/test/escaping.test.ts` and `apps/web/test/graph-space.test.ts` hold this.

**Mermaid text written by `grooph mermaid` cannot add to the diagram.** Labels are written as Mermaid's entities, and metadata values as escapes. So a name cannot add a node, a line, a directive, or HTML. `packages/core/test/glyph.test.ts` and `packages/core/test/pele.test.ts` hold this.

## The offline page

The one-file page from `grooph page` and Keep a copy carries this content security policy:

```
default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:
```

It allows inline styles and inline scripts, which is how the page carries its own, and images from `data:` and `blob:` addresses. Nothing else is allowed, so the page cannot fetch, connect to, or load anything, and nothing in it points at another file or a server. Its one script is grooph's: text from the document is escaped, as above, so it cannot add another. `packages/core/test/picture.test.ts` and `packages/core/test/escaping.test.ts` hold this.

## The script for web pages

`grooph.render`, `grooph.mount`, and `grooph.drawAll` draw a document that came with a page, so they read it as untrusted too. A document over the size caps above throws `too-large`, and text that is not a grooph document throws `bad-json` or `not-grooph`, each with a message in words. `mount` and `drawAll` parse the drawing as SVG and add it as an element, never as HTML, and show an error as text in the drawing's place. A page that sets a content security policy can stop parts of it; [on any page](exports.md#on-any-page-without-an-iframe) says which. The Obsidian plugin draws with the same code and refuses the same sizes.

## An embed

An embed asks only for its own files from the site that serves it, and never with the document, which stays in the `#fragment`. It sets no cookie and stores nothing in the reader's browser: no local or session storage, no database, and no service worker (the app registers one; an embed does not). The frame `grooph embed` prints carries `referrerpolicy="no-referrer"`, so the host page's address is not sent either. `apps/web/e2e/embed.spec.ts` and `packages/cli/test/embed.test.ts` hold this.

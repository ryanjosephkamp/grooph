# Privacy

grooph has no account, no server of its own, no cookies and no analytics. The site is static files, the app runs in your browser, and what you make stays where you made it. This page says what that means, sentence by sentence, and where it stops.

## What the site and the app do not do

- **No account.** There is nothing to sign up for and nothing to sign in to.
- **No server of grooph's.** The site is files published from the [public repository](https://github.com/ryanjosephkamp/grooph) with GitHub Pages. Nothing of grooph's runs on a server for you: it runs in your browser and, if you install the command-line tool, on your own machine.
- **No cookies.** The app and the documentation pages set none.
- **No analytics and nothing from a third party.** The pages load their scripts, styles and pictures from the site's own address and from nowhere else. There is no tracker, no beacon, no font or script from another company.
- **No model.** grooph never calls a model. The coding harness you use does, under its own terms.

## Where a graph lives

In the browser you made it in, on that device.

- **Graphs, the templates you save and the runs you keep** are in the browser's own storage for this site (IndexedDB). They are not copied anywhere. Clearing the site's data, or the browser doing so when it is short of space, deletes them: **Export**, then **Download graph**, gives you a file to keep. The app asks the browser once to keep its storage, and tells you once what the browser answered.
- **Two small notes** sit beside them (local storage): the browser's answer to that question, and the search and filters you last used on the templates page.
- **The app's own files** are kept by its service worker so it opens with no network. It stores nothing else and sends nothing.
- **In a private window** some browsers refuse storage. The app then works in memory and says that nothing will survive a reload.

## What leaves your device, and when

Only what you send yourself.

- **A share link holds the whole document** in the part of the address after `#`, which a browser does not send to the server it asks for the page. Whoever has the link has the document, so treat a link as you would the file: a chat, an email or a link shortener you paste it into sees it too.
- **An embed** (`grooph embed`) is the same app in a frame, with the document in its address in the same way. The page that carries the frame loads the app from this site, and the site's host sees that request like any other.
- **Copy buttons** write to the clipboard when you press them. Nothing reads the clipboard.
- **The live screens** ask the address the app was served from, and no other, for a run or for sessions. That is `grooph watch` on your own machine. The public site has no watch behind it, and the screen says so.

## What the host sees

The site is served by GitHub. As any web host does, it receives each request for a file, with the address it came from and what the browser says about itself, and [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) covers what it does with that. grooph adds nothing to those requests.

## The command-line tool

`grooph` reads and writes files in the folder you run it in. It reports nothing to anyone.

- **It uses the network in one case**: a template asked for by a name that is not found in the project, in your home folder or in the built-in library is looked up in the published library, a JSON file on this site, or in the registry you name with `--registry`. `template add` and `template list --registry` ask it too.
- **`grooph watch`** serves the app to this machine only, at `127.0.0.1`, unless you give it another `--host`.
- **`grooph share` and `grooph embed`** build a link on your machine. Nothing is uploaded.
- **`grooph mcp`** talks to the session that started it, over its standard input and output.
- **The event hook**, if you install it (`grooph hooks install`), appends one line per event to `.grooph/events/` in the project: ids, names and times. It never writes a prompt, a tool's input or result, or anything an agent said. Those lines leave the machine only when you run `grooph events push`, or install the hook with `--push`, and then they go to a branch of the project's own repository. [How subagents and hooks work](subagents.md) has the fields, one by one.

## If this page is wrong

It is checked against the code, not promised. If you find the app or the tool doing something this page says it does not, that is a bug: [open an issue](https://github.com/ryanjosephkamp/grooph/issues).

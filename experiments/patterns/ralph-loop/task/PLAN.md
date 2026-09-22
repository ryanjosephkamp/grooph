# Plan

Top item first; `- [ ]` is open, `- [x]` is done. One item per pass: take the
top open item, make it true in `src/text.mjs` with tests, run `npm test`, tick
the item, commit. Ticked items stay ticked.

Each item's acceptance cases are held outside this project by the reviewer and
join `npm test` the moment the item is ticked (`tests/acceptance.test.mjs` reads
this file and runs the cases of every ticked item), so an item that later turns
out wrong shows up in the next test run. The cases are not yours to read: write
your own tests from the item's text, and when an acceptance case fails, the
failure output says what it expected.

- [ ] **tokenize** · `tokenize(text)`: the words of `text` in order, lower-cased, with punctuation stripped; an apostrophe inside a word stays (`don't` is one word). Non-string input throws a `TypeError`. Tests in `tests/tokenize.test.mjs`.
- [ ] **frequencies** · `frequencies(text)`: a `Map` from each word (as `tokenize` gives it) to its count, in first-seen order. Tests in `tests/frequencies.test.mjs`.
- [ ] **top** · `topWords(text, n)`: the `n` most frequent words as `[word, count]` pairs, most frequent first, ties broken alphabetically; fewer when the text has fewer distinct words. Tests in `tests/top.test.mjs`.
- [ ] **summary** · `summary(text)`: `{ words, unique, top }` where `words` is the number of tokens, `unique` the number of distinct words and `top` is `topWords(text, 3)`. Tests in `tests/summary.test.mjs`.

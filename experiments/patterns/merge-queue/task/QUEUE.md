# Merge queue

Reviewed changes waiting to land, as patches under `queue/`, in landing order.
`npm run integrate` applies every change whose status is `queued` to a scratch
copy of the tree, in this order, and runs the tests there; `npm run land`
applies the queued changes to the tree itself and marks them `landed`.

Status is one of `queued` (in the batch), `held` (out of the batch, with the
reason in the note) or `landed`.

| change | status | note |
|---|---|---|
| queue/001-slug-accents.patch | queued | slugify strips accents (review: ok) |
| queue/002-search-case.patch | queued | search ignores case (review: ok) |
| queue/003-limit-negative.patch | queued | limit tolerates a negative n (review: ok) |

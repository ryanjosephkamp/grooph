# orders-api

The small HTTP service behind the shop's orders page: `src/server.mjs` routes
requests, `src/db.mjs` holds the connection pool, `src/payments.mjs` verifies
the payment provider's webhooks. It logs to `logs/app.log`, one line per event:

```
<ISO time> <LEVEL> <component> <message>
```

## Reading the log

The patrol reads yesterday's log and tickets what is genuinely wrong. Some
lines are routine and are never tickets:

- `WARN http slow request … /reports …` while the nightly export runs (about
  02:00–02:30 UTC): the reports endpoint is known to be slow then, by design.
- `WARN cache miss` in the first minute after a start: the cache is cold.
- `WARN http retry n/3 … succeeded`: a retry that succeeded is not a fault.
- `WARN http deprecated header X-Legacy-Client`: the old mobile app still sends
  it; removal is scheduled, nothing to do.
- `WARN auth token expiring soon`: informational.
- A single `ERROR health probe failed (1/3)` followed by `INFO health probe ok`
  is a hiccup; three failed probes in a row would be a fault.

Everything else at `ERROR`, and any `WARN` that shows a request failing for a
user, is a candidate fault. Tickets live in `TICKETS.md`, one per fault, and a
fault that is already there is referenced, never filed twice.

```bash
npm test        # the routing table and the webhook verifier
npm run scan    # every ERROR and WARN line of yesterday's log, with line numbers
```

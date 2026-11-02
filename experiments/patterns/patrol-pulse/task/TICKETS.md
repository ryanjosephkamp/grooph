# Tickets

One ticket per fault, newest last. A ticket starts `## T-NNNN · <title> (<status>)`
with the next free number; status is `open`, `triaged` or `closed`. A fault that
is already here is referenced by its number, never filed again.

## T-0005 · Reports endpoint times out for accounts with more than 10k orders (triaged)

- first seen: 2026-09-12, log line `ERROR http 504 GET /reports account=acc_311`
- signal: 504s on `/reports` for the three largest accounts during the day (not the nightly export)
- cause: the report query has no index on `orders.account_id, created_at`
- next: add the index in migration 0042; the nightly-export slowness is separate and expected

## T-0006 · Cold cache after deploy doubles p95 for two minutes (closed)

- first seen: 2026-09-14
- signal: `WARN cache miss` bursts after every deploy, p95 latency 2× for ~120 s
- resolution: warm the cache from the previous instance before switching traffic (deployed 2026-09-16)

## T-0007 · Payment webhook signature mismatches for a subset of events (open)

- first seen: 2026-09-18, log line `ERROR payments webhook signature mismatch for event evt_8c21…`
- signal: a few events per hour fail verification in `src/payments.mjs` and are dropped; the provider resends them and the resend also fails
- suspected cause: the provider rotated to a second signing secret on 2026-09-17 and we verify against the old one only
- next: verify against both secrets during the rotation window; confirm with the provider's dashboard

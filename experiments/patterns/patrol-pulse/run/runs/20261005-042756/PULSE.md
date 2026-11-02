# PULSE — orders-api, log of 2026-09-21 (run 20261005-042756)

Scan: 31 matching lines listed in scan-output.txt (the lead's brief said 33; the file holds 31 — all 31 are judged below). Line numbers are `logs/app.log` lines.

## Genuine faults

### 1. DB connection pool exhausted during the 12:00 flash sale, users got 503s — NOT on file (new)

- Evidence:
  - `logs/app.log:46` campaign "flash sale started (acc_311, acc_118, acc_204 notified)" at 12:00:00.
  - `logs/app.log:50-52` latencies climbing 210ms, 340ms, 880ms.
  - `logs/app.log:53-54` `WARN db pool busy 18/20, 4 waiting`, then `20/20, 11 waiting`.
  - `logs/app.log:55,57,59,61` four `ERROR db pool exhausted: 20/20 connections busy, waited 5000ms`.
  - `logs/app.log:56,58,60,62` four user-visible failures: `503 GET /orders acc_311`, `503 POST /orders acc_118`, `503 GET /orders/ord_77410 acc_204`, `503 POST /orders acc_311` (two of them are order creations).
  - `logs/app.log:63` recovers at 12:00:44 (16/20, 0 waiting); `logs/app.log:64` normal 200 at 12:01:10.
- Likely cause: fixed pool of 20 (`src/db.mjs:5`) with a 5000 ms wait (`src/db.mjs:6`) cannot absorb the burst of traffic from the campaign notification to three large accounts. Failing waiters are rejected with status 503 (`src/db.mjs:27`). This is a capacity problem, not a leak: `release()` (`src/db.mjs:33-41`) hands the connection on or decrements, and the pool drained by 12:00:44.
- Ticket coverage: none. T-0005 is `/reports` 504s (missing index), T-0006 is cold cache (closed), T-0007 is webhook signatures. None mention the pool or 503s on `/orders`. Needs a new ticket (next free number T-0008).

### 2. Payment webhook signature mismatches, events dropped — already on file as T-0007 (open)

- Evidence: `logs/app.log:11` (evt_9a0b77, dropped), `logs/app.log:13` (its resend also fails, as T-0007 describes), `logs/app.log:40` (evt_9a2e88), `logs/app.log:76` (evt_9a4d02). Verifier is `src/payments.mjs:13-18`, which uses a single secret (`src/payments.mjs:7`), matching T-0007's suspected cause (old secret only after the 2026-09-17 rotation).
- Ticket coverage: T-0007 (open). Referenced, not new. Of note: events verified fine at `logs/app.log:7,26,67`, so this is still a subset, as ticketed.

## Dismissed signals

- `logs/app.log:4,37,71` WARN auth token expiring soon — informational per README.md.
- `logs/app.log:8,27,68` WARN deprecated header X-Legacy-Client — known old mobile app, removal scheduled (README.md).
- `logs/app.log:16,43` WARN http retry 1/3 ... succeeded on retry — a successful retry is not a fault (README.md). Both are single retries that succeeded.
- `logs/app.log:19-22` WARN slow request GET /reports (1108-1512 ms) at 02:03-02:17 — inside the nightly export window (`logs/app.log:18` started 01:58, `logs/app.log:23` finished 02:24); slow by design. Not the daytime 504s of T-0005.
- `logs/app.log:29-31` WARN cache miss (cold start) — at 04:00:02-03, within the first minute after the deploy start at 04:00:00 (`logs/app.log:28`); `logs/app.log:32` cache warm at 04:00:41. Routine (README.md; related ticket T-0006 closed).
- `logs/app.log:34` ERROR health probe failed (1/3) ETIMEDOUT 10.0.3.14:5432 — single failure followed by `logs/app.log:35` `INFO health probe ok` ten seconds later; a hiccup per README.md, not three in a row.
- `logs/app.log:53,54,63` WARN db pool busy — counted as part of fault 1, not separate.

## Verdict

verdict: finding — one genuine fault not on file (DB pool exhaustion with 503s at 12:00, `logs/app.log:55-62`); the webhook fault is already T-0007.

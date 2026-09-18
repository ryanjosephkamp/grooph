# 0003 · Phone-to-run path: design on the phone, run from the Mac

**Date:** 2026-09-17 · **Status:** accepted · **Deciders:** owner, driver

## Context

With no backend, a graph designed on the phone must still reach the harness on the Mac. Options: share links (graph encoded in the URL fragment, never sent to a server), downloaded graph files, a GitHub-backed sync, or launching runs from the phone through a cloud harness session with a paste-only package.

## Decision

First: share links and files. The CLI imports either (`grooph import <link|file>`) and places the package. GitHub-backed sync and phone-launched runs come in a later stage (paste-only export is still built in stage 4 because it costs little and serves cloud sessions).

## Consequences

- Slice 0001 and 0002 need no sync code.
- The graph document must stay small enough to fit a URL fragment after compression; the size lint (`W_DOC_TOO_LARGE`) doubles as the share-link guard.
- Stage ordering: authoring completeness (3) precedes sync work.

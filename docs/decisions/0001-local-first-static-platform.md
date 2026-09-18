# 0001 · Local-first static platform with a shared core

**Date:** 2026-09-17 · **Status:** accepted · **Deciders:** owner, driver

## Context

Graphs must be authored from an Android phone and exported, saved and backed up to GitHub. The spec forbids stack lock-in and a hidden second runtime. Three approaches were weighed:

- **A.** Installable local-first web app + pure TypeScript core shared by browser, CLI and MCP server. No backend. Hosted statically from the public repo.
- **B.** Hosted full-stack app with accounts, cloud storage and a remote MCP endpoint.
- **C.** `grooph serve` on the Mac, reached from the phone over a tunnel; files on disk as the store.

## Decision

**A**, with C available as a mode: the same web bundle can be served locally by the CLI against files on disk, which is how an agent on the Mac shows a graph.

Top-level stack, locked: TypeScript monorepo with `pnpm` workspaces; `packages/core` (schema, validation, compile; no DOM or Node-only dependencies), `packages/cli`, `packages/mcp`, `apps/web` (React + Vite + React Flow, installable as a PWA). Graph documents are canonical JSON with a published JSON Schema. Everything below this level is the implementer's choice.

## Consequences

- No auth, keys, hosting cost or ops. Nothing pulls the project toward a hosted studio.
- Sync starts as share links (graph in the URL fragment) and file import/export; GitHub-backed sync is a later stage. B can be layered on later; the reverse would be a rewrite.
- The compiler that runs on the phone is byte-for-byte the one the agent runs, so package output is testable in one place.
- Native mobile frameworks were rejected: draggable-graph libraries are strongest on the web and the core could not be shared with the CLI/MCP.

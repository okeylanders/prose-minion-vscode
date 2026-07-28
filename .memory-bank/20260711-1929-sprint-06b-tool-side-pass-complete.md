# Sprint 06B — Retained Tool Sidecars and Direct Mode

**Date:** 2026-07-11
**Branch:** `sprint/workshop-editor-tab-06b-tool-side-pass`
**Target:** `epic/workshop-editor-tab`
**Sprint:** [06b-tool-side-pass.md](../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/06b-tool-side-pass.md)

## Landed behavior

- Every Workshop tool run uses a fresh retained sidecar while the selected
  persona remains the immutable host.
- The exact tool report lands as its own artifact before a separately streamed
  and attributed persona synthesis turn.
- `RunWorkshopToolSidePass` owns the two-phase workflow and is constructed at
  the VS Code composition root; `WorkshopHandler` remains the transport/lifecycle
  adapter.
- The latest sidecar per tool replaces/disposes only its predecessor. Snapshot
  metadata exposes report correlation, direct availability, active target, and
  in-flight phase without conversation ids.
- Direct mode continues the retained tool with no persona relay. Returning to
  the host (including by launching another tool) carries the bounded unseen
  delta once: newest 8 completed turns / 20,000 characters, with deterministic
  omission/truncation metadata and commit-after-host-success semantics.
- Quick actions are report-generation-owned via `reportTurnId`; replaced
  reports remain visible but archived. Reports expose “Talk directly,” and the
  composer retains the deterministic “Back to <persona>” control.
- Copy/Save supports report, direct response, and persona synthesis provenance.
- Reserved persona-frame delimiters are structurally encoded in direct/file
  excerpts, retained host messages, tool evidence, and direct handoffs.

## Verification

- `npm test -- --runInBand`: 78 suites / 603 tests / 1 snapshot passed.
- `npm run typecheck`: core, webview, extension passed.
- `npm run lint`: 0 errors; 600 repository-baseline warnings.
- `npm run build`: production extension + webview passed; resource staging and
  `verify:bundle` passed.
- Bundles: extension 2,313,454 bytes (2.21 MiB); webview 580,760 bytes (567 KiB).
- `git diff --check`: passed.

## Review notes

- Added a Handler → real AssistantToolService → AgentRunEngine integration test
  to close PR #71's missing Workshop/engine lifecycle witness.
- Final diff review caught and covered the “launch another tool while direct”
  path so pending direct exchanges are not silently orphaned.
- Persona-generated capability requests remain deliberately deferred to Sprint
  07; 06B does not add an autonomous capability route.

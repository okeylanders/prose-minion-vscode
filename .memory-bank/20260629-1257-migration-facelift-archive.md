# Migration & Facelift Archive

**Date**: 2026-06-29 12:57
**Branch**: `docs/todo-audit-pr64`
**Status**: Archive pass complete

## What Changed

Archived the completed `migration-and-facelift/` planning workspace under:

`.todo/archive/epics/epic-migration-and-facelift-2026-06-16/`

Added `ARCHIVE.md` to explain that the work shipped in v2.0.0, with the later
v2.0.1 patch line addressing API-key warning persistence and secret-change
self-healing rather than reopening the migration epic.

## Follow-Up Work Split Out

Active feature folders:

- `.todo/features/feature-full-tab-conversation-agent/`
- `.todo/features/feature-desktop-shell-adapter/`

Active tech-debt files:

- `.todo/tech-debt/2026-06-29-word-search-defaults-product-decision.md`
- `.todo/tech-debt/2026-06-29-typescript-project-references.md`
- `.todo/tech-debt/2026-06-29-logging-and-ai-alias-modernization.md`
- `.todo/tech-debt/2026-06-29-app-side-vscode-jest-mock.md`
- `.todo/tech-debt/2026-06-29-untitled-document-active-file-edge.md`
- `.todo/tech-debt/2026-06-29-manuscript-read-and-boundary-guard-performance.md`
- `.todo/tech-debt/2026-06-29-build-command-gate-semantics.md`

## Documentation Updates

- Rewrote `.todo/README.md` with current rules for epics, feature folders,
  tech-debt files/folders, archiving, and memory-bank entries.
- Updated `.todo/tech-debt/README.md` inventory with the migrated debt items.
- Updated `.ai/central-agent-setup.md` so future agents know how to create,
  archive, and memory-bank `.todo` work.
- Updated release/review breadcrumbs that still pointed at the old
  `migration-and-facelift/` root.

## Notes

The archived migration docs remain historical and may contain stale status lines.
Use the new archive note, `docs/CHANGELOG-DETAILED.md`, and PR review docs for
the final completion state.

# Archive Note: Migration & Facelift

**Archived**: 2026-06-29
**Released In**: 2.0.0
**Follow-up Patch Line**: 2.0.1
**Status**: Complete

## Summary

The migration and facelift workspace is archived. The live work landed across
the v2.0.0 release train:

- Monorepo split into `packages/core` and `apps/vscode-extension`
- Platform ports and VS Code adapters
- React 18 webview runtime
- Sidebar facelift and follow-VS-Code theme mode
- OpenRouter balance widget and last-request cost surface
- All Tools picker
- Model Browser, streaming progress stats, and debug output shortcut
- Composition-root consolidation follow-up

The later v2.0.1 patch line addressed API-key warning persistence and
secret-change self-healing; it did not reopen this migration epic.

## Remaining Work Moved Out

The unfinished or deferred items were split into active `.todo` entries:

- `.todo/features/feature-full-tab-conversation-agent/`
- `.todo/features/feature-desktop-shell-adapter/`
- `.todo/tech-debt/2026-06-29-word-search-defaults-product-decision.md`
- `.todo/tech-debt/2026-06-29-typescript-project-references.md`
- `.todo/tech-debt/2026-06-29-logging-and-ai-alias-modernization.md`
- `.todo/tech-debt/2026-06-29-app-side-vscode-jest-mock.md`
- `.todo/tech-debt/2026-06-29-untitled-document-active-file-edge.md`
- `.todo/tech-debt/2026-06-29-manuscript-read-and-boundary-guard-performance.md`
- `.todo/tech-debt/2026-06-29-build-command-gate-semantics.md`

## Historical Docs

The files in this folder are preserved as the original execution record. Some
status lines inside them are intentionally historical and may be stale relative
to the final release state. Prefer this `ARCHIVE.md`, `docs/CHANGELOG-DETAILED.md`,
and the PR review docs for current completion status.

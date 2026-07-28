# Workshop Editor Tab Epic Archive

**Archive prepared:** 2026-07-27
**Effective:** When [PR #95](https://github.com/okeylanders/prose-minion-vscode/pull/95) merges to `main`
**Release state:** Workshop · beta release candidate
**Integration branch:** `epic/workshop-editor-tab`

## Summary

This epic delivered the complete Workshop beta: a durable full-tab Writers'
Room with passage and open-session scopes, retained persona hosts and guests,
isolated writing-tool sidecars, bounded capabilities, project context,
conversation controls, actionable tasks, exact session restoration, optional
web research, and the release-candidate design/tour.

Implementation was split across the sprint records in this folder and reviewed
incrementally through PRs #66–#94. PR #95 is the final integration into
`main`.

## Verification at archive preparation

- 139 Jest suites / 1,518 tests / 1 snapshot passed.
- Core, webview, and extension TypeScript projects passed.
- Changed-file lint passed; repository lint retained no errors.
- Production extension/webview builds and bundle sentinels passed.
- GitHub Actions passed on commit `7208967`.

## Active follow-up work retained outside this archive

- `.todo/epics/epic-workshop-context-compaction-2026-07-21/`
- `.todo/epics/epic-conversation-widgets-2026-07-22/`
- `.todo/features/feature-workshop-amplified-expression/`
- `.todo/features/feature-workshop-relational-depth/`
- `.todo/features/feature-workshop-apply-to-draft/`
- `.todo/features/feature-workshop-branch-board/`
- `.todo/features/feature-workshop-task-sidecar-conversations/`
- `.todo/tech-debt/2026-07-24-workshop-session-responsibility-follow-ups.md`
- `.todo/tech-debt/2026-07-24-workshop-session-storage-bounds.md`
- `.todo/tech-debt/2026-07-25-workshop-god-files.md`
- `.todo/tech-debt/2026-07-27-workshop-web-research-budget-and-citation-contract.md`
- Other focused Workshop feature/debt entries that remain explicitly Open,
  Proposed, Parked, Deferred, or Active.

The detailed shipped-feature inventory, architecture decisions, and verification
record live in
`.memory-bank/20260727-2238-workshop-beta-epic-release-candidate.md`.

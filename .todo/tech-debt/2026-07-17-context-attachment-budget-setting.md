# Make the Workshop context-attachment budget a user setting

**Status**: Open
**Priority**: Medium
**Created**: 2026-07-17 (Sprint 12, Okey's request during manual wizard testing)

## Problem / Motivation

The aggregate word budget across all Workshop context attachments is a
hardcoded constant: `PROMPT_BUDGETS.contextAttachments.words` in
[promptBudgets.ts](../../packages/core/src/shared/constants/promptBudgets.ts).
Sprint 12 shipped it at 10,000 words and bumped it to **35,000** as an
interim value once real sessions showed the cap biting (three medium files
filled it, crowding out the wizard's brief and chapter files).

The right ceiling depends on the writer's model window and project shape —
it should be a user setting, not a code constant.

## Proposed shape

- New setting `proseMinion.workshop.contextBudgetWords` (default 35,000)
  following the unified settings architecture
  ([ADR 2025-11-03](../../docs/adr/2025-11-03-unified-settings-architecture.md)):
  `package.json` contribution → `ConfigurationHandler` getter → domain hook →
  Settings overlay, with bidirectional sync.
- The aggregate lives host-side in `WorkshopSessionService.addContextAttachment`
  (budget check) and `WorkshopHandler` (per-file head-slice to the aggregate
  cap, error copy) — both read `PROMPT_BUDGETS.contextAttachments.words`
  today. Thread the configured value through instead; the webview meter
  (`ContextPanel`) and Context Selector estimate footer need the live value
  too (snapshot field or settings message, not a second source of truth).
- Guard rails: sane minimum (e.g. 1,000), and decide behavior when the
  setting is LOWERED below the currently attached total (recommend: keep
  existing attachments, block new adds until below the cap — never silently
  drop writer context).

## Related files

- `packages/core/src/shared/constants/promptBudgets.ts` (current constant)
- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
- `packages/core/src/application/handlers/domain/WorkshopHandler.ts`
- `packages/core/src/presentation/webview/components/workshop/ContextPanel.tsx`
- `packages/core/src/presentation/webview/components/workshop/WorkshopContextSelectorModal.tsx`

## Completion criteria

- Budget configurable via Settings overlay and VS Code settings, live
  without reload, one source of truth reaching both host checks and the UI
  meter/estimates; lowering below the attached total never drops content.

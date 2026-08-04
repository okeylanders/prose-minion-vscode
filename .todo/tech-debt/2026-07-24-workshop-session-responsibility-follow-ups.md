# Workshop Session Responsibility Follow-ups

**Status:** In progress — absorbed by Workshop Architecture Refactor Phases 3 and 5
**Priority:** Critical within the feature-freeze gate
**Origin:** Independent class-responsibility audit during PR #85 review remediation

## Files first

- `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts`
- `packages/core/src/infrastructure/storage/WorkshopSessionStore.ts`
- `packages/core/src/presentation/webview/hooks/domain/useWorkshop.ts`
- `packages/core/src/presentation/webview/WorkshopApp.tsx`
- `packages/core/src/presentation/webview/components/workshop/WorkshopSessionBrowserModal.tsx`
- `packages/core/src/infrastructure/api/orchestration/ConversationManager.ts`
- `packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts`

## Problem

PR #85's review remediation extracted the mechanical, low-risk boundaries:

- durable V1 session codec, shape grammar, and integrity validation;
- generic persisted-value validation primitives;
- Workshop session IPC from the room/run handler;
- the compact session search-index codec from the filesystem store.

An independent second pass found several further seams worth considering. They
are behavior-bearing refactors rather than mechanical review fixes, so they
should not be folded invisibly into the persistence correction:

1. The persistence coordinator owns both write/lifecycle serialization and
   conversation-archive import/export translation. Consider a
   `WorkshopSessionArchiveService` once that translation gains another caller
   or policy branch.
2. The filesystem store owns authoritative snapshot storage plus the bounded
   browser/read model. Consider a browser reader or search-index repository if
   either path changes independently again.
3. `useWorkshop` and `WorkshopApp` now carry a substantial named-session UI
   subsystem. Extract `useWorkshopSessions` and a session-surface controller
   before adding more session actions or confirmation states.
4. The browser modal can split grouping and row rendering when its next UX
   change lands.
5. Conversation archive behavior spans `ConversationManager` and
   `AssistantToolService`. Keep the manager generic; introduce a Workshop
   archive adapter if more Workshop-specific validation appears.

`WorkshopSessionService` remains large, but the audit found its remaining class
responsibilities cohesive around the Workshop aggregate. Do not split it by
line count alone; extract only named domain concepts with independent
invariants.

## Completion criteria

- Each extraction is driven by an independently changing responsibility, not a
  target line count.
- Session/open/save behavior and active-run ordering remain covered by runtime
  tests.
- New modules have explicit ownership comments and semantic filenames.
- No additional durable format receives a version suffix unless it is an
  independently decoded on-disk schema.

Execution and closure are now tracked by the
[Workshop Architecture Refactor epic](../epics/epic-workshop-architecture-refactor-2026-08-03/epic-workshop-architecture-refactor.md).

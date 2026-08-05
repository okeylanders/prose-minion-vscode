# Workshop Modal Workflow Ownership

**Status:** Deferred — schedule after Sprint 03 Presentation Responsibility Extraction

**Priority:** Medium

**Created:** 2026-08-04

## Problem

Workshop's modal components currently mix rendering with several independent
draft, reset, correlation, and acknowledgement workflows. The current
architecture-refactor Sprint 03 correctly focuses on state machines held by
`WorkshopApp`; widening it now would make that conditional sprint difficult to
review.

## Recommendation

Create a focused, behavior-preserving post-Sprint-03 presentation slice:

- Establish `components/workshop/modals/` as the generic-overlay sibling of
  `components/workshop/widgets/`; retain feature packages such as `widgets/`
  and `schematic/` where the feature, rather than the overlay shape, is the
  true owner.
- Extract only these modal-local workflows:
  - `useWorkshopConversationSettings`
  - `useWorkshopContextSelector`
  - `useWorkshopInviteGuest`
  - `useWorkshopSessionBrowser`
  - `useWorkshopTextSheetDraft`
  - `useGesturePlaygroundAuthoring`
  - `useLexicalGravityAuthoring`
- Retain the existing Gesture and Lexical transport hooks as host-message and
  action-correlation owners; do not merge UI draft state into them.
- Rename `WorkshopConversationBehaviorModal` to
  `WorkshopConversationSettingsModal`, because it edits behavior, writer
  profile, and web research together.

Do not add hooks for `WorkshopChooseHostModal`, `WorkshopSaveSessionModal`,
`WorkshopToolsModal`, `WorkshopWidgetsModal`, `WorkshopNoticeModal`,
`WorkshopConfirmDialog`, `WorkshopConfigureGuide`, or `WorkshopModalShell`
without a new state-machine pressure. Their current state is selection,
display, or already-owned generic dismissal behavior.

## Evidence

- [Workshop modal workflow ownership runway](../../docs/architecture/2026-08-04-workshop-modal-workflow-extraction-runway.md)
- [Sprint 03 presentation responsibility extraction](../epics/epic-workshop-architecture-refactor-2026-08-03/sprints/03-presentation-responsibility-extraction.md)
- `packages/core/src/presentation/webview/components/workshop/`
- `packages/core/src/presentation/webview/hooks/domain/workshop/widgets/`

## Completion Criteria

- Every extracted hook has direct tests for its open/reset rule and its
  asynchronous or conflict path where applicable.
- Existing modal behavior tests stay green; behavior and file moves are kept
  in separate commits.
- No hook introduces durable webview persistence or a new message route.
- Existing widget transport hooks retain outbound-message and request-token
  correlation ownership.
- A filename-first audit can trace settings apply, context search/attach,
  guest invite, browser rename/delete, text apply, Gesture commit, and
  Lexical apply without opening `WorkshopApp` for modal-local logic.
- `npm test -- --runInBand`, `npm run typecheck`, `npm run lint -- --quiet`,
  `npm run build`, and `git diff --check` pass.

# Sprint 03 (Workshop Multi-turn) — implementation complete, PR #68 open

**Date**: 2026-07-06
**Branch**: `feat/workshop-s3-multiturn` → PR [#68](https://github.com/okeylanders/prose-minion-vscode/pull/68) into `epic/workshop-editor-tab`
**Epic**: `.todo/epics/epic-workshop-editor-tab-2026-07-03/` (sprint 3 of 4)

## What landed

The epic's one genuinely novel mechanism: `WorkshopHandler` drives
`ConversationManager` multi-turn.

- **Continuation seam** (`AIResourceOrchestrator`): `retainConversation`
  option (successful runs keep + pin their conversation, id on the result),
  `continueConversation(id, text)` (atomic user+assistant append on
  completion only), `discardConversation(id)`. `ConversationManager` gained
  `pinned` (idle-reaper shield), `hasConversation`, and a typed
  `ConversationNotFoundError`.
- **Conversation policy**: the session conversation follows the LAST
  SUCCESSFUL tool run; each tool run retains a fresh conversation (system
  prompts must not cross-contaminate); adoption atomic in
  `WorkshopSessionService.completeRun`; zombie/cancelled runs never adopt and
  their conversations are discarded. Config change → typed error → honest
  "run a tool to start a new one", never a silent cold restart.
- **Token budgeting decision** (sprint doc Notes): full history per
  conversation, no windowing in v1; bounded structurally; surfaced via a
  session-tokens chip in the Workshop header + per-turn usage. Revisit seam =
  `continueConversation`.
- **Composer live** (`WorkshopComposer`), stop affordance →
  `CANCEL_WORKSHOP_REQUEST`; the Sprint 2 `Exclude<…,'workshop'>` cancel gate
  retired on schedule.
- **Seeding, both paths**: `prose-minion.workshopSelection` context-menu
  command → `WorkshopPanelProvider.seedExcerpt` routes WORKSHOP_SET_EXCERPT
  through the panel's own MessageHandler; "Pin from file…" →
  `WORKSHOP_PICK_EXCERPT_FILE` → new `ShellService.pickFile()` port, 10k-word
  head-slice guardrail with durable truncation notice on the excerpt model.
- **PR #67 ledger #8** (one live-run tracker `{requestId, phase}` in
  `useWorkshop`, `currentRequestId` derived) and **#12** (snapshots windowed
  to last 100 turns, `totalTurns`/`truncatedTurns`, hook merges instead of
  shrinking, hidden-turns divider) landed here as scheduled.

## Verification

Lint 0 errors · typecheck clean (core/webview/ext) · 60 suites / 525 tests
(+75 this sprint) · production build + bundle sentinel green. Multi-turn
service tests run against a REAL ConversationManager. Bundle delta:
webview.js +4,610 B (+0.85%), extension.js +9,531 B (+0.43%).

## Gotchas worth remembering

- `jest.mock('@orchestration/ConversationManager')` also automocks
  `ConversationNotFoundError`, breaking error identity — the orchestrator
  suite now deliberately does NOT mock that module (manager is
  constructor-injected everywhere).
- All prior orchestrator paths delete their conversation in `finally`; each
  model scope's ConversationManager is REBUILT on config changes — any future
  multi-turn caller must handle conversation loss.
- The handler suite pins the exact wire order (COMPLETE strictly before the
  assistant TURN) for BOTH tool runs and follow-ups.

## Next

- Sprint 04: quick-action chips, cards, toasts (`feat/workshop-s4-actions-polish`).
- Epic-level before final merge to main: markdown sanitizer in shared
  `MarkdownRenderer` (PR #67 #13, tracked in epic Known Risks).

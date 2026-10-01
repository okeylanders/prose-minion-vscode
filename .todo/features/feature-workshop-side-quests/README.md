# Feature: Workshop Side Quests

**Date Identified:** 2026-09-30
**Status:** Planned — its foundation, [Workshop Rewind and Branch](../../archive/epics/epic-workshop-rewind-and-branch-2026-09-30/README.md) Sprint 02's generic `rewindTo(cut, { origin })`, is complete and reaches `main` when that epic merges
**Priority:** Medium
**Decision base:** [ADR 2026-09-30 — Workshop Rewind and Branch](../../../docs/adr/2026-09-30-workshop-rewind-and-branch.md)

## Problem

Writers often want a detour: test a wild idea with the host, try a guest's take, run a tool on a hunch. They then want to come back as if the detour never cluttered the room. Today they must either leave the tangent in the thread and in every participant's memory, or remember where they were and rewind by hand.

## Idea

A Side Quest is automated rewind.

- **Start Side Quest** pins the current point, drawn as a divider line like the context and excerpt update markers. The conversation then continues normally.
- **End Side Quest** rewinds the room to the pin and draws a closing divider, e.g. "Returned from side quest · 14 turns set aside".

Everything the room did during the quest is removed from the thread and from every participant's retained memory, using the same exact cut as Rewind.

## Decisions

| # | Decision |
|---|---|
| SQ1 | **One quest at a time.** No nesting. Start is hidden while a quest is active. |
| SQ2 | **The pin is the idle ledger head at Start.** Start and End are disabled while a run is active or a session operation is pending. Any idle head is a valid cut (`evaluateCut`), so Start never fails on rewindability. |
| SQ3 | **End = generic rewind.** End calls `rewindTo({ kind: 'afterTurn', turnId: pin }, { origin: 'sideQuestEnd' })`. The Start divider is inside the quest and leaves with it. A closing divider is then appended after the pin, using the cut summary's `removedTurnCount`. There is no confirm dialog, because End is the action the writer asked for, and the composer is not re-seeded. |
| SQ4 | **The working set survives End**, the same rule as Rewind. Excerpt and context edits made during the quest stay, and the host is re-notified through the existing revision frames. |
| SQ5 | **No directive changes during a quest.** Installing, shifting or removing a standing prose directive is refused with "End the side quest first". Otherwise End would cross a directive change, which Rewind v1 forbids (D6). |
| SQ6 | **No guest dismissals during a quest.** Dismissal is refused with "End the side quest first", because a dismissed guest's history is discarded and End could not bring it back. Guests *invited* during the quest are disposed at End, which is correct because they did not exist at the pin. |
| SQ7 | **Rewind inside a quest.** A writer Rewind whose cut is before the pin ends the quest: the pin is gone and no closing divider is drawn. A cut at or after the pin keeps the quest active. |
| SQ8 | **Branch inside a quest.** The new session inherits the active quest only when the cut is at or after the pin; otherwise it starts with no quest. The source session keeps its quest either way. |
| SQ9 | **Unnamed rooms are fine.** Side Quests use Rewind, not Branch, so no save is required. |

Tool re-runs during a quest are allowed. A sidecar replaced during the quest is dropped at End, per the Rewind rules; its earlier report stays in the thread, and the writer can re-run the tool.

## Proposed shape

- **Persisted state.** An optional `sideQuest?: { pinTurnId: string; startTurnId: string; startedAt: number }` on `WorkshopSessionStateV1`.
  - Integrity requires both turns to exist, `startTurnId` to immediately follow `pinTurnId`, and the Start turn's artifact to be `side_quest_start`.
  - It is dropped by any cut before the pin (SQ7) and by the rewind transform whenever the Start turn is removed.
  - The codec follows ADR 2026-09-30 §9: an in-file optional field with no schema bump.
- **Turn artifacts.** Two new divider artifacts, `side_quest_start` and `side_quest_end` (`role: 'system'`, `kind: 'divider'`, `participant: 'session'`), rendered like the existing session dividers. Room audience: whether participants should *see* a quest's start and end markers in catch-up is an open design point. The default is display-only (excluded from delivery), because the quest's content is cut anyway.
- **Snapshot.** A display-safe `sideQuest?: { active: true; startedAt: number; turnsSoFar: number }`.
- **Messages.** `WORKSHOP_START_SIDE_QUEST` and `WORKSHOP_END_SIDE_QUEST`, both empty payloads, added to `WorkshopSessionAction`.
- **UI.**
  - Start and End buttons live in the thread header or next to the composer, the writer's choice at kickoff.
  - While a quest is active, a banner reads "On a side quest · End side quest".
  - Directive and dismissal controls show the SQ5/SQ6 reason when disabled.

## Related Files

- `packages/core/src/application/services/workshop/session/WorkshopRewindPolicy.ts` (epic Sprint 01)
- `packages/core/src/application/services/workshop/session/WorkshopSessionRewind.ts` (epic Sprint 02)
- `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts` (`rewindTo`)
- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
- `packages/core/src/application/services/workshop/directives/WorkshopStandingDirectiveService.ts` (SQ5 guard)
- `packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx` (divider rendering)
- `packages/core/src/presentation/webview/WorkshopApp.tsx`

## Completion Criteria

- [ ] Start pins the idle head and draws the start divider. End restores the room exactly to the pin, verified with the epic's equivalence oracle, and draws the closing divider.
- [ ] SQ5 and SQ6 guards refuse host-side with a clear reason, and the UI shows it.
- [ ] SQ7 and SQ8 behave as stated for Rewind and Branch inside a quest.
- [ ] Quest state survives reload, save and open. Integrity rejects malformed quest state.
- [ ] Focused tests, full Jest, all TypeScript projects, ESLint and `git diff --check` pass.

## Follow-ups

- **End and keep as branch.** Save the quest as its own named session before rewinding. This is available only in named rooms, matching Branch's saved-source rule.

# Fresh-host time-context frame is dropped but committed as delivered

- **Status**: Open
- **Priority**: Medium
- **Discovered**: 2026-08-13, during the Workshop prompt-assembly documentation sweep
  ([docs/architecture/2026-08-13-workshop-prompt-assembly/](../../docs/architecture/2026-08-13-workshop-prompt-assembly/README.md))

## Problem

On a **fresh host conversation**, the prepared `<workshop-time-context>`
frame never reaches the model, but its notice is still committed as
delivered:

1. `WorkshopRoomHandler.prepareTurn` builds `personaBehaviorFrames` including
   `timeFrame: input.timeNotice?.frame`
   (`WorkshopRoomHandler.ts:796-799`).
2. For a fresh host (no `conversationId`), those frames are spread into the
   `startWorkshopPersonaConversation` input
   (`WorkshopRoomHandler.ts:1122`) — but `WorkshopPersonaConversationInput`
   has **no `timeFrame` field** (`AssistantToolService.ts:108-151`), and
   neither `buildWorkshopPersonaUserMessage` nor
   `buildWorkshopOpenConversationUserMessage` renders one. Because it arrives
   via object spread, TypeScript excess-property checking does not catch it.
3. On success the handler still calls `this.commitTimeNotice(timeNotice)`
   (`WorkshopRoomHandler.ts:1216`), so the host's `session_start` notice is
   marked delivered without ever reaching the model, and the hourly cadence
   baseline starts from a phantom delivery.

The guest join path passes `timeFrame` explicitly and renders it
(`WorkshopPromptBuilder.buildWorkshopGuestJoinMessage`), so the asymmetry is
fresh-host-only. Retained host continuations render it correctly via
`buildWorkshopHostMessage`.

## Impact

Low-blast-radius correctness gap: the host persona never receives its
session-start temporal context (date, timezone, elapsed-time grounding), and
the first hourly notice can arrive up to an hour later than intended. No data
integrity risk.

## Suggested fix

Add `timeFrame?: string` to `WorkshopPersonaConversationInput` and render it
first in both initial-envelope builders (mirroring
`buildWorkshopGuestJoinMessage`), or stop preparing/committing a time notice
for the fresh-host path. Either way, add a regression test asserting the
fresh-host envelope contains `<workshop-time-context reason="session-start">`
(or that no notice is committed).

## Related files

- `packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts`
- `packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts`
- `packages/core/src/application/services/workshop/WorkshopSessionTimeService.ts`
- `packages/core/src/application/services/workshop/WorkshopPromptBuilder.ts`

## Completion criteria

- Fresh-host first envelope carries the session-start time frame (or the
  notice is intentionally not consumed), with a regression test either way.

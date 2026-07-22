# Feature: Workshop Direct-Tool Context Indicator

**Date Identified**: 2026-07-21
**Status**: Proposed
**Priority**: Medium
**Estimated Effort**: Small
**Origin**: Writer UX review of the participant-rail direct-tool flow

## Problem / Motivation

Selecting a tool in the participant rail changes the target of the composer,
but it leaves the shared thread visually unchanged. A writer can reasonably
infer that the tool sees the full Workshop conversation, or that switching
back immediately gives the host the full tool conversation. Neither is true.

Each tool has an isolated retained sidecar: it sees its original report,
pinned excerpt, standing context attachments, and the writer's messages sent
directly to that tool. The host receives a **bounded handoff of unseen direct
tool exchanges only when the writer next sends a message to the host**. Merely
selecting the host chip does not relay anything, and the host does not receive
the entire Workshop transcript.

## Proposal

When a live tool becomes the active participant, add a quiet but persistent
thread-boundary indicator near the composer and an attributed divider at the
start of that direct exchange. The treatment should be a dotted rule with a
small pill/callout, not a modal warning or a second conversation view.

Suggested copy while a tool is active:

> You’re talking directly with **{Tool}**. It sees only this tool conversation
> and its original report—not the Workshop host thread.

Suggested divider copy at the first direct message after a target switch:

> Direct conversation with **{Tool}**

Suggested return-to-host copy (shown after switching the rail back to the
host, before the next send):

> On your next message to **{Host}**, it will receive a bounded handoff of
> unseen exchanges with **{Tool}**.

The visible Workshop thread remains shared and unfiltered; these are context
boundaries for the models, not a UI mode that hides turns.

## Guardrails

- Do not claim the host receives the “full transcript,” or that switching the
  rail alone sends anything. The actual handoff is bounded and occurs on the
  next host message.
- Do not duplicate the previous direct-mode banner. The participant rail owns
  target selection; this affordance explains target-context scope.
- Treat consecutive direct messages to the same active tool as one exchange;
  add a divider on target transition, not before every turn.
- Preserve reduced-motion behavior and announce meaningful target/context
  changes through an appropriate `aria-live`/`role="status"` path.
- Copy must remain accurate if a sidecar is replaced or is no longer available.

## Related Files

- `packages/core/src/presentation/webview/WorkshopApp.tsx`
- `packages/core/src/presentation/webview/components/workshop/WorkshopParticipantRail.tsx`
- `packages/core/src/presentation/webview/components/workshop/WorkshopThread.tsx`
- `packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx`
- `packages/core/src/presentation/webview/hooks/domain/useWorkshop.ts`
- `packages/core/src/presentation/webview/workshop.css`
- `packages/core/src/application/handlers/domain/WorkshopHandler.ts`
- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
- [Participant rail](../feature-workshop-participant-rail/README.md)

## Completion Criteria

- [ ] Activating a tool clearly explains that it receives only its retained
      tool-sidecar context, not the host conversation.
- [ ] The first direct exchange after a target transition has an unobtrusive,
      visually distinct dotted boundary in the shared thread.
- [ ] Returning to the host explains the actual delayed, bounded handoff
      semantics without promising a full transcript.
- [ ] The thread continues to show all attributed turns; no context boundary
      filters or hides historical content.
- [ ] Keyboard and screen-reader users receive the same context-scope change.
- [ ] Component tests cover tool activation, transition divider placement,
      host-return copy, and repeated direct messages without duplicate dividers.

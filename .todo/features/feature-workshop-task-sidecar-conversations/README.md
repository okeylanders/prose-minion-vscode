# Feature: Workshop Task Sidecar Conversations

**Status**: Proposed — requires an ADR before sprint planning; not part of
Sprint 08 actionable todos or Sprint 09 guest-persona sidecars
**Priority**: Medium
**Date**: 2026-07-14
**Origin**: Sprint 08 follow-up — “when a next step becomes a task, can its
follow-up chat start with the visible thread that led to it and return its
resolution to the host?”
**Related ADRs**:
[2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](../../../docs/adr/2026-07-09-workshop-persona-hosted-conversations.md),
[2026-07-11 — Workshop Guest Persona Sidecars](../../../docs/adr/2026-07-11-workshop-guest-persona-sidecars.md)
**Related work**:
[Sprint 08 — Actionable Tool Todos](../../epics/epic-workshop-editor-tab-2026-07-03/sprints/08-actionable-tool-todos.md),
[Workshop Guest Persona Sidecars](../feature-workshop-persona-guest-sidecars/README.md),
[Workshop Session Persistence](../feature-workshop-session-persistence/README.md)

## Current State

Sprint 08 tasks already have useful, immutable **source-turn provenance**:

- `source.turnId`, participant label, actionable-finding key/text, and excerpt
  version;
- either the originating tool id, or the host persona id plus the upstream tool
  report id when the host was synthesizing one.

That is enough to identify *which turn* proposed the task while the in-memory
session exists. It is not a durable replay contract: the task stores no
transcript slice, no context-window bounds, and no task conversation id. The
webview reload snapshot is deliberately limited to the newest 100 turns, and a
real VS Code restart currently loses the entire session aggregate.

## Problem / Motivation

A promoted task often needs focused follow-up work without derailing the host
conversation. Opening a cold chat loses the reasoning, report, and writer/host
exchange that made the next step meaningful. Continuing it only in the host
thread does the opposite: a narrow implementation or research thread buries
the room’s main editorial conversation.

The writer needs a task-scoped conversation that begins with honest context,
uses the same host persona, and can deliberately return a resolution to the
host when the side work is done.

## Proposed Experience

1. Each task exposes an explicit **Open task chat** action. It launches a fresh,
   retained task-sidecar conversation; it does not change the selected host,
   task status, or host transcript.
2. The task sidecar uses the host persona’s unchanged system prompt, with a
   clear task-mode frame: *you are in a focused side conversation about this
   task; the host thread remains separate*. It receives:
   - the task text, immutable source provenance, and current excerpt frame;
   - a deterministic, speaker-labeled transcript slice ending at the source
     turn; and
   - the writer’s opening task message.
3. At launch, the system records exactly what the sidecar received: turn ids,
   source/through cursor, character/turn bounds, and any omitted-turn count.
   This is an immutable **launch-context packet**, not a claim that the
   sidecar has seen later host turns.
4. The task thread is isolated after launch. It receives no live host relay and
   cannot launch additional personas or sidecars. A later catch-up model, if
   wanted, must be an explicit ADR decision with delivery cursors and bounds.
5. The task thread footer offers writer-controlled handback:
   - **Return last reply to host** — deliver an attributed, verbatim final
     task-sidecar reply; or
   - **Summarize resolution for host** — create a clearly labeled bounded
     resolution handoff, previewed/approved by the writer before delivery.

   The host receives the handback as a visible, attributed Workshop artifact,
   never as hidden context or an automatic task-status mutation.

## Product and Trust Constraints

- **Bounded, honest context.** “Thread leading to this task” means the
  speaker-labeled visible history through the source anchor, subject to a
  deterministic turn/character budget. If it cannot all fit, the packet says
  what was omitted; it must never pretend to have the full room history.
- **Same persona, separate role.** The host identity does not change, but the
  sidecar must be explicitly told it is not replying in the host thread.
  Transcript data is quoted inside a neutralized `<workshop-transcript>` frame
  so neither writer text nor prior model output can instruct it to change role.
- **Writer owns routing.** Opening, returning, and dismissing a task sidecar
  are writer actions. Neither host nor task sidecar may create nested chats,
  send unsolicited handbacks, or silently complete/dismiss the task.
- **Visible provenance.** The task view must reveal its source turn and what
  launch context was sent. A host handback must reveal its task id, task title,
  origin, and whether it is verbatim or a summary.
- **Persistence honesty.** Until Workshop session persistence is designed,
  task conversations have the same in-memory lifetime as the host. A future
  persistence tier must serialize the task transcript and its launch packet
  together, or restore them as explicitly non-continuable history; never
  restore a dangling provider conversation id.

## Architecture Direction (for the ADR)

Keep this distinct from guest-persona sidecars. A guest brings a *different*
voice to the room; a task sidecar is a focused continuation by the *same* host
persona, anchored to a writer-owned todo.

- Add a task-sidecar aggregate keyed by the opaque `WorkshopTodoItem.id`; keep
  provider conversation ids host-private. The aggregate records the host
  persona, source anchor, immutable launch-context packet, thread state, and
  any host-delivery cursor.
- Derive the launch packet deterministically from `WorkshopTurn` metadata and
  content. Reuse existing transcript/excerpt framing and delimiter
  neutralization rather than asking a model to summarize the background at
  launch.
- Treat “summarize resolution” as an explicit paid model turn or a writer
  supplied summary — never disguise bookkeeping as a free model action. The
  ADR must choose the interaction and token-accounting model.
- Reuse the existing visible, attributed handoff/evidence pattern for returning
  a result to the host. Do not build a private prompt-injection tunnel between
  conversations.
- Decide excerpt-replacement behavior alongside the room-memory model. At
  minimum, a task sidecar must visibly state which excerpt version it saw.

## Open Questions

- What exact launch budget best balances “all visible context through the
  source turn” against cost — and should the writer be able to narrow it before
  launch?
- Is the host handback immediate visible history, or pending evidence delivered
  on the host’s next turn? The former is clearer; the latter may reuse existing
  delivery mechanics.
- Does “Summarize resolution” mean the final task reply is already the
  resolution, a separate model-generated summary, or a writer-edited handoff?
- May a reopened task receive bounded host catch-up, or is a fresh/relaunch
  snapshot the simpler and more honest first slice?
- What survives excerpt replacement, task edits, task completion/dismissal,
  session reset, webview reload, and eventual cross-restart persistence?
- Does the task list need a compact sidecar state (not started, live, returned,
  dismissed) without conflating it with the task’s writer-owned completion
  status?

## Completion Criteria

- [ ] ADR specifies lifecycle, transcript/character bounds, role framing,
      excerpt-version behavior, persistence tier, and host-handback semantics.
- [ ] A task created from either a tool report or host turn can open a same-host
      sidecar that receives a deterministic, speaker-labeled context packet
      ending at its source turn.
- [ ] The task records and displays immutable launch provenance, including
      truncation/omission information; no sidecar claims unseen context.
- [ ] Task sidecar and host remain isolated until the writer explicitly returns
      a result; no live relay, nested agents, hidden host injection, or
      automatic task-status mutation.
- [ ] The writer can return either a clearly attributed final reply or an
      approved resolution summary, and the host thread visibly identifies its
      task origin.
- [ ] Reload, reset, excerpt replacement, and persistence behavior are tested
      for truthful continuity; no restored task sidecar holds an unresolved
      provider conversation id.
- [ ] Focused tests cover source provenance from both task origins, packet
      bounds/truncation, transcript neutralization, handback approval,
      duplicate delivery prevention, and status isolation.

## Related Files

- `packages/core/src/shared/types/messages/workshop.ts` — task provenance,
  turn contracts, and future task-sidecar message shapes
- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
  — task aggregate, source lookup, bounded snapshots, and lifecycle rules
- `packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts`
  — retained same-persona task conversation and framed launch context
- `packages/core/src/application/handlers/domain/WorkshopHandler.ts` —
  validated writer actions and attributed host handback delivery
- `packages/core/src/presentation/webview/components/workshop/WorkshopTodoList.tsx`
  — task-sidecar launch/status affordance
- `packages/core/src/presentation/webview/components/workshop/WorkshopThread.tsx`
  — visible task thread and returned-resolution artifact

# Feature: Per-Turn Model Stamps and Model-Switch Slices

**Date Identified**: 2026-10-27
**Source**: Brainstorm with Okey (Workshop sidebar batch)
**Status**: Idea
**Priority**: Medium

> Its persistence decision is shared with
> [Thread Bookmarks](../feature-workshop-thread-bookmarks/README.md) and the
> optional fields in [Read-In Material](../feature-workshop-rail-read-in/README.md).

## Problem

The writer can switch the assistant model in the middle of a Workshop session.
The thread doesn't record which model wrote which reply. After a switch the
voice can change, and a reopened session can't show where that happened. The
passage of time already gets a visible slice (the `session_start` /
`session_resume` divider turns). A model change gets nothing.

## What Already Exists

- **One model scope for the room.** The host and persona guests share the
  `assistant` scope (`proseMinion.assistantModel`). Widgets use the separate
  `widget` scope.
- **The served model is already captured, but never stamped on a turn.**
  `OpenRouterClient` reads the served model from the response (`data.model`,
  or `parsed.model` while streaming). It reports that as
  `InferenceRequestObservation.modelId`, next to the requested id
  (`cacheRequestModelId`). That observation feeds the context gauge, and
  nothing writes it onto the turn.
- **Requested and served can differ.** "Enter any OpenRouter model ID" admits
  routers such as `openrouter/auto` and provider fallbacks.
- **One logical turn can span several provider requests** (capability rounds,
  `TokenUsage.requestCount`).
- **Two precedents:**
  - Time slices are **persisted divider turns**, minted by
    `WorkshopSessionService.recordSessionMarker`.
  - Behavior changes use a **field on a turn**: `behaviorTransition` is
    stamped on the first committed writer turn after the change. It is "never
    a synthetic chat message."

## Proposal

### The stamp

Okey's note said "indicate model on the request". I'd put the stamp on the
**reply** (the assistant turn). The model's work lives in the reply, only the
reply knows what actually served it, and a failed or cancelled request leaves
no reply to mislabel.

```ts
interface WorkshopTurnModel {
  /** 'assistant' for room replies today; keeps other scopes from looking like switches. */
  scope: ModelScope;
  /** The writer's selection when the request was sent. */
  requested: string;
  /** Distinct served ids across this turn's provider requests, when reported. */
  served?: string[];
}

// WorkshopTurn.model?: WorkshopTurnModel
```

Make it an object, not a string, so later facts (reasoning effort, provider
route) can join it without another top-level turn key. That's the cheap kind of
forward compatibility. The hard kind is [below](#forward-compatibility-the-hard-part).

Stamp tool-sidecar replies too. They're replies in the same scope.

### The slice

Compute the slices from the stamps. Don't persist divider turns for them.

- A slice appears just before the writer turn that led to the first reply whose
  `model.requested` differs from the previous stamped reply **in the same
  scope**.
- Going from an unknown model to a known one is not a switch. Old turns
  without a stamp produce no slice, so old sessions stay correct with no
  migration.
- Copy: "Model · Claude Sonnet 5 → GPT-5". Use display names from the model
  options at render time, and fall back to the raw id when the model is no
  longer listed. Use the same `pm-ws-session-divider` treatment as time slices.
- When the served model differs from the requested one, that's a different
  signal. Show a small "served by X" note in the bubble's meta line, not a
  slice.

**Why compute the slices instead of persisting them:** the stamp is the source
of truth. A persisted divider would copy that truth, and then Rewind, Branch,
export, and recall would all have to keep the two in sync. With computed
slices, rewinding to before a switch removes the slice automatically, and the
next reply under the new model brings it back.

Put the calculation in **one pure function** under `shared/`, used by both the
thread and `projectWorkshopTranscript`. That keeps export and the thread in
agreement, which is the "one projection" rule from
[ADR 2026-10-05](../../../docs/adr/2026-10-05-workshop-transcript-export.md).
The HTML export copies thread CSS rules, so the slice's style joins the
mirror test.

**The reload-window edge:** the first turn in the snapshot window has no
visible predecessor. The host can send the model of the last stamped turn
before the window. Without it, the thread shows no slice at the edge.

## Forward Compatibility: the Hard Part

"Backwards and forward compatible" covers two different promises.

**1. Old sessions in new builds: free.** The field is optional, unstamped turns
produce no slices, and per
[ADR 2026-07-30](../../../docs/adr/2026-07-30-workshop-session-codec-evolution.md)
an optional addition needs no `schemaVersion` bump.

**2. New sessions in old builds: not free.** The codec is strict. `assertTurn`
calls `exactObject` with an allowlist, and `exactKeys` throws "… contains
unknown field model." So **v2.11.0 would refuse to open any session with a
stamped turn**. ADR 2026-07-30 already accepted this once (provider cache
counts) and says downgrade support "would require a separate codec policy
change."

It matters more than it might seem, because sessions live in the workspace
(`prose-minion/sessions/`). A writer who syncs a project between two machines
running different extension versions will hit it.

| Option | What it is | Cost | Limitation |
|---|---|---|---|
| **A.** Accept forward-only | Same call as the cache counts | Nothing | Older builds refuse newer files |
| **B.** Reserve a tolerant extension slot | Release N adds, for example, a turn-level `annotations` object. It is checked only as a JSON object and saved back unchanged, **keeping unknown keys rather than dropping them**. Release N+1 starts writing into it | Moderate; needs a codec-policy ADR | Only helps builds from N onward. Shipped readers stay strict forever |
| **C.** Bump `schemaVersion` | Old builds refuse cleanly with "Unsupported schema" instead of "unknown field" | Small | Not compatibility, just a clearer refusal. Against the ADR for optional additions |

**Lean:** A, unless syncing across machines on different versions is a real
pattern for Okey. In that case choose B, and land it once for model stamps,
bookmarks, and the read-in row fields together.

The trap in B: a tolerant reader that *ignores and drops* unknown content
would silently erase stamps whenever an older build saves the file. Keeping the
content through a save is the requirement, not a detail.

## The Persona Side (Separate, Optional)

Time passage has two halves: a visible slice for the writer, and a time-notice
frame for the persona (`WorkshopSessionTimeService`, delivered on the next
turn and committed only when that turn succeeds). A model switch could get the
same pair. After a switch, the new model inherits a history it didn't write. A
one-time frame such as "earlier replies in this conversation came from another
model; keep the established persona and voice" might steady persona
continuity.

That frame changes prompts. It costs tokens, and the model switch has already
restarted the prompt cache. Decide it separately, after the slices ship, and
only if voice drift after a switch turns out to be noticeable.

## Open Questions

- Show the model on every bubble (meta line or hover title), or only at slices?
  Lean: slices, plus a hover title on the bubble.
- Recall: should `projectWorkshopTranscriptTurn` include the model? A persona
  answering "where did we land?" rarely needs it. Lean: leave it out of recall
  and include it in the JSON export, since it's provenance there.
- Widget-scope changes: widgets show up as chips, not replies, so there are
  probably no slices. Still worth stamping the widget turns' scope.
- Should the session browser show "models used" per session?

## Related Files

- `packages/core/src/infrastructure/api/providers/OpenRouterClient.ts`: served
  model capture (`data.model`, streaming `parsed.model`)
- `packages/core/src/shared/types/messages/inferenceContext.ts`:
  `InferenceRequestObservation`
- `packages/core/src/shared/types/messages/workshop/session.ts`: `WorkshopTurn`
- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`:
  `recordSessionMarker`, the time-slice precedent
- `packages/core/src/application/services/workshop/WorkshopSessionTimeService.ts`:
  the persona-notice precedent
- `packages/core/src/application/services/workshop/WorkshopSessionStateV1Shape.ts`:
  `assertTurn`, the strict allowlist
- `packages/core/src/application/services/workshop/persistedValidation.ts`: `exactKeys`
- `packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx`:
  `pm-ws-session-divider`
- `packages/core/src/application/services/workshop/export/`: transcript projection
- `docs/adr/2026-07-30-workshop-session-codec-evolution.md`

## Completion Criteria

- Every committed reply in the `assistant` scope records its requested model
  and, when reported, its served models.
- The thread and the transcript export show the same slices, computed by one
  pure function with tests for: a switch, no switch, an unstamped history
  followed by stamped turns, scope interleaving, and Rewind across a switch.
- Unstamped sessions load and render unchanged, with no slices and no
  migration.
- The forward-compatibility option is chosen and recorded (in an ADR if B), and
  a fixture test witnesses it.
- Requested and served mismatches show on the bubble, not as a slice.

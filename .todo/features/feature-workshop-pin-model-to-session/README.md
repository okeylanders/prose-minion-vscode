# Feature: Pin a Model to a Workshop Session

**Date Identified:** 2026-11-27
**Status:** Idea. Medium. A short ADR: which model a run uses, and what follows it (window measure, prices, cache clock).
**Priority:** Medium
**Origin:** Okey, 2026-11-27

## In Okey's words

> Pin model in session. I use different models for different work. It'd be
> nice to have a "pin" button next to model. If the model is pinned, it
> doesn't switch if the setting changes elsewhere, and the pin would save to
> the session so the model survives. If the user unpins it switches back to
> the selected model in settings.

## What exists

- **Every room uses the Workshop's model setting** (the `assistant` scope,
  `proseMinion.assistantModel`). Change it anywhere, and every room's next
  reply switches.
- **The engine already takes a model per run.** `AgentRunOptions.model`
  overrides the engine's model, and the preflight measures against it too
  (`orchestration/AgentRunContracts.ts`). Craft Flags sends every call to the
  model it priced this way.
- **Personas have no model of their own.**
- **With tabs (2.17), rooms differ.** A pin lets each tab keep its own
  model: one for drafting, another for line work.

## Idea

1. **A pin beside the model name** in the room. Pinning stores
   `pinnedModel` on the session: optional and additive, with no
   `schemaVersion` bump.
2. **A pinned room sends every run to its pinned model.** That includes
   replies, guest replies, edit-offer answers and search deliveries, through
   `AgentRunOptions.model`. A settings change doesn't move it.
3. **Unpin** clears the field. The room follows the setting again from the
   next reply.
4. **Everything that names "the model" reads the room's effective model:**
   the window measure, the context meter, prices, the cache clock (today it
   compares against the setting) and the label.
5. **The pin follows the room.** It survives a reload, reopening the saved
   session, Rewind and Branch.
6. **A pinned model that's gone** (removed from OpenRouter, or no longer
   offered) is refused in host words, with Unpin offered. A pinned room is
   never quietly sent to another model.
7. **Styling:** a small pin toggle in the model label's row, needing mockups
   first. The parked [header model browser](../feature-workshop-header-model-browser/README.md)
   is the natural home for picking a model to pin.

## Decisions to make

| # | Question | Ada's lean |
|---|---|---|
| PM1 | Pin to the current model only, or pick any model to pin? | Pin the current one first. Picking comes with the model browser. |
| PM2 | Do Branch and Rewind keep the pin? | Yes; it's the room's. |
| PM3 | Do tool sidecars and helper tasks follow the pin? | No: they have their own scopes. Only the room's persona runs. |

## Completion Criteria

- [ ] Pin stores the model on the session; every persona run in the room
      sends to it, and a settings change doesn't move it (tests).
- [ ] Unpin returns to the setting from the next reply (test).
- [ ] The window measure, prices, cache clock and label read the effective
      model (tests).
- [ ] The pin survives reload, reopen, Rewind and Branch; a session without
      it reads as today, from the pre-feature fixture (tests).
- [ ] A pinned model that's unavailable refuses in host words and offers
      Unpin (test).
- [ ] A help section explains pinning.

## Related

- [Session cache key](../feature-workshop-session-cache-key/README.md)
  (#37): a pin also keeps the cache warm, since a model change starts a new
  cache.

## Related Files

- `packages/core/src/infrastructure/api/orchestration/AgentRunContracts.ts` (`AgentRunOptions.model`)
- `packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts`
- `packages/core/src/application/services/workshop/WorkshopPersistedSession.ts`
- `packages/core/src/presentation/webview/WorkshopApp.tsx` (the cache clock's model check)

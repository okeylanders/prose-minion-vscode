# Feature: Show What a Participant's Context Holds, Part by Part

**Date Identified:** 2026-11-17
**Status:** Being built on `feature/workshop-context-breakdown` (PR into `main`, stacked on #284 and #283), per [ADR 2026-11-18](../../../docs/adr/2026-11-18-workshop-context-breakdown.md). Archiving is left to Ada once it merges.
**Priority:** Medium
**Origin:** Okey, 2026-11-17, from Jill's Context panel (161K of 1M)

## In Okey's words

> Is it possible for us to also show how much memories are consuming,
> system prompt, tool use instructions, todos, etc?

## What the panel shows today

- **The total is measured by the provider.** "Current context 160,656" is
  the retained context after the last committed reply
  (`ContextBudgetSnapshot.contextTokens`).
- **The "In context" list shows materials only** (`ContextSourceEntry`,
  `CONTEXT_SOURCE_KINDS`):
  - the excerpt, attachments and message attachments;
  - files, sessions, notes, dictionary entries and analysis reports a
    persona requested.
- **Everything else is invisible:**
  - **the system prompt:** the persona, the interaction mode and depth, the
    reaction rules, and the capability, memory and file-edit sections
    (`workshopPersonaSystemPromptPaths`);
  - **the tool-use contract** frozen into the first message
    (`WorkshopCapabilityXmlCodec`'s instruction lines, with
    `WorkshopResourceInstruction`);
  - **the `<project-memory>` block** at the start, and later
    `<project-memory-update>` notes;
  - **to-do snapshots** (`<workshop-todo-snapshot>`);
  - **room notes:** catch-ups, reactions, the time, host updates, behavior
    and mode changes, and the per-turn reminders;
  - **the conversation itself:** the writer's messages and the replies.
- **In Okey's screenshot that's about a quarter of the total.** The listed
  rows come to roughly 120K: the excerpt at about 5K, six files at 21.6K and
  ten session reads at 93.9K. So about 40K of the 161K isn't on the list.

## Idea

### A summary by part, above the list

| Part | What's in it | Measured how |
|---|---|---|
| **Persona and behavior** | the system prompt's persona, mode, depth and reaction sections | estimated per section |
| **Tool-use instructions** | the system prompt's capability, memory and file-edit sections, plus the contract in the first message | estimated per section |
| **Project memory** | the start block and update notes; memory reads roll up here too | estimated; reads as their rows say |
| **To-dos** | each snapshot sent | estimated |
| **Room notes** | catch-ups, reactions, time, host updates, behavior changes, reminders | estimated |
| **Excerpt and context** | the existing writer-added rows | as their rows say |
| **Requested by the persona** | the existing requested rows | as their rows say |
| **Conversation** | the writer's messages and the replies | the rest: the measured total minus everything above |

- **A stacked bar.** The panel's bar is split by part, each segment
  labeled, with the table beside it for screen readers. The list below
  stays as it is.
- **The parts add up to the provider's number.** Conversation is the
  remainder, labeled "the rest", so nothing is double counted or left out.
  If the estimates ever exceed the measured total, the panel says so rather
  than showing a negative.
- **Each part can open to its pieces.** For example, the system prompt by
  section ("Interaction mode: Balanced · about 900 tokens"), or the
  to-dos by snapshot.

### How it's measured

- **The host writes all of this text, so it can measure it** when it puts
  it in a message, with the engine's estimator (`estimateTextTokens`, the
  one the Memory tab's meter already uses). Rows the provider measured
  (`promptTokensDelta`) keep that number.
- **The system prompt is measured per section** from the same path list
  that assembles it, so the breakdown can't drift from the prompt. A
  behavior change replaces the system prompt between runs, so the current
  one is measured.
- **The tally follows Rewind and archives as the manifest does.** It is
  stored beside the participant's manifest rows and sliced at the same
  marks (`ConversationHistoryCounts`). One entry per message, not per frame,
  so the stored size stays bounded.
- **Display-safe, like the manifest:** parts, section names, counts and
  token numbers only. No prompt text reaches the webview.

## Why it's worth having

- **It shows where the room goes.** With 1M windows that's curiosity; on a
  128K or 200K model it's what decides when a room is full.
- **It's what Compaction and Context Strategies need first.** Before
  dropping or summarizing anything, the writer, or later the host, needs to
  see what's heavy.
- **It makes the round-two memory work visible.** The titles tier and the
  size setting add tokens to Project memory, and this shows exactly how
  many.

## Open questions

- **How deep the system prompt goes.** Two lines (persona and behavior,
  tool-use instructions) that open to sections, or every section at once?
  Leaning: two lines that open.
- **A way to read the system prompt?** A read-only "View" that opens the
  assembled prompt in an editor tab would help debugging. Leaning: later, if
  wanted. **Not built in the first PR** (ADR 2026-11-18 D10); still a later idea.
- **The sidebar.** `ContextBudget` is a shared component. Does anything
  outside the Workshop show a context panel that wants the same summary?

## Completion Criteria

- [ ] The Context panel shows each part's tokens and a bar split by part,
      and the parts add up to the measured total, with Conversation as the
      remainder (test).
- [ ] The system prompt's sections are measured from
      `workshopPersonaSystemPromptPaths`, so a new section is measured
      without further work (test).
- [ ] The tally survives a reload and follows Rewind and Branch: a cut
      removes the tallies of the messages it removes (test).
- [ ] No prompt text enters the webview contract (test).
- [ ] Estimates are labeled as estimates. Provider-measured rows keep their
      number.

## Related

- [Workshop Compaction That Keeps the Whole History](../feature-workshop-compaction-keeps-history/README.md)
- [Workshop Context Strategies](../feature-workshop-context-strategies/README.md)
- [Show Personas Every Memory's Title](../feature-workshop-memory-title-index/README.md):
  the memory part this would make visible.
- [Workshop Reads Fit the Window](../feature-workshop-reads-fit-the-window/README.md)

## Related Files

- `packages/core/src/presentation/webview/components/shared/ContextBudget.tsx`
- `packages/core/src/presentation/webview/utils/workshop/contextSources.ts`
- `packages/core/src/shared/types/messages/inferenceContext.ts`
  (`ContextSourceEntry`, `CONTEXT_SOURCE_KINDS`, `ContextBudgetSnapshot`)
- `packages/core/src/shared/constants/workshopPersonas.ts`
  (`workshopPersonaSystemPromptPaths`)
- `packages/core/src/application/services/workshop/WorkshopCapabilityXmlCodec.ts`
  (the contract frozen into the first message)
- `packages/core/src/application/services/workshop/WorkshopPromptBuilder.ts`
  and `WorkshopRoomFrameRenderer.ts` (the frames)
- `packages/core/src/infrastructure/api/orchestration/ConversationManager.ts`
  (`contextSources`, `ConversationHistoryCounts`)
- `packages/core/src/infrastructure/api/orchestration/RequestContextPreflight.ts`
  (`estimateTextTokens`)

# Feature: Workshop Excerpt Revision Loop (Replace Without Amnesia)

**Status**: Proposed — **needs an ADR before implementation**
**Priority**: High (the revision loop is the Workshop's core use case)
**Date**: 2026-07-11
**Origin**: Epic Workshop Editor Tab — "is pinning doing more harm than good?"
**Related ADR**: [2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](../../../docs/adr/2026-07-09-workshop-persona-hosted-conversations.md)
**Not related**: feature-workshop-apply-to-draft (write-back direction; this is
the read-again direction)

## Investigation Findings (2026-07-11, epic branch)

How the pinned excerpt actually works today:

1. **The excerpt is NOT in the system prompt.** Persona/tool system prompts
   stay pure (agent identity is immutable). For the persona host, the excerpt
   is framed into the **first user message** of the retained conversation —
   provenance lines + `<pinned-excerpt>…</pinned-excerpt>` + optional
   `<context-brief>` + `<writer-message>`
   (`AssistantToolService.buildWorkshopPersonaUserMessage`, capped at 10,000
   words). Tools receive it as their analysis input the same way. "Pinned"
   means it rides the retained conversation history so follow-up turns see it
   without resending.
2. **Replacing the excerpt wipes conversational memory but not the visible
   thread.** `WorkshopSessionService.replaceExcerpt()` calls
   `clearAllConversations()` — host conversation id, every tool sidecar, and
   the direct-tool target are discarded — but `turns` (the transcript) is
   untouched (contrast `reset()`, which clears both). Net effect: the writer
   still sees the whole conversation on screen, but the persona's next reply
   starts a **fresh conversation** that remembers none of it. The UI shows a
   continuity the model no longer has.
3. **Why it's built this way**: the excerpt is baked into turn 1 of each
   retained history, and histories are immutable by locked decision. You
   cannot swap the excerpt inside an existing conversation without either
   contaminating history (two versions, ambiguity about which is current) or
   rewriting it (dishonest; breaks retention/caching). Invalidate-on-replace
   is the conservative consequence.

## Problem

The Workshop's primary loop is: get feedback → revise the manuscript → ask
for another look. Today that loop punishes the writer at the exact moment it
should reward them: replacing the excerpt with the revised text silently
destroys the host's memory of the feedback conversation and kills every
"Talk directly to <Tool>" sidecar. You cannot ask Jill "did my revision fix
what Cliché flagged?" — she no longer remembers Cliché, the flags, or the
conversation, despite all of it being visible on screen.

## Design Directions (for the ADR)

**A. Excerpt versioning as conversation content (preferred).** Replacement
appends a structured revision turn to the *live* host conversation instead of
discarding it: "The writer has revised the excerpt." + provenance +
`<pinned-excerpt version="2">…`. The host keeps full memory and gains the
killer capability: version-aware feedback ("the paragraph-3 cliché is gone;
the new opening is tighter"). Tool re-runs already create fresh sidecars per
run, so tools naturally see the current excerpt; stale sidecars are either
disposed (simple) or labeled with the excerpt version they saw.

**B. Host survives, sidecars die.** Same as A for the host; always dispose
tool sidecars on replace (they are cheap to re-run). Simplest correct slice.

**C. Honesty patch (minimum, if invalidation stays).** Confirm before
replacing ("Transcript stays visible, but the persona's memory resets") and
render a thread divider: "Excerpt replaced — new conversation memory." Never
let the UI imply continuity the model doesn't have.

## Costs / Constraints for the ADR

- Each retained excerpt version can be up to 10k words riding every
  subsequent turn's input tokens. Bound retained versions (e.g., latest full,
  older versions elided to a short note or diff summary).
- Excerpt-frame neutralization (Sprint 06B's `</pinned-excerpt>` delimiter
  hardening) must apply to every version frame, not just the first.
- Mid-run replacement guard (`MID_RUN_EXCERPT_GUARD_MESSAGE`) still applies.
- Delivery cursors for direct-tool handoff (06B) must interact sanely with
  version-labeled or disposed sidecars.

## Related Files (epic branch `epic/workshop-editor-tab`)

- `packages/core/src/application/services/WorkshopSessionService.ts` —
  `replaceExcerpt()`, `clearAllConversations()`, `reset()`
- `packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts`
  — `buildWorkshopPersonaUserMessage()`, `WORKSHOP_PERSONA_EXCERPT_MAX_WORDS`
- `packages/core/src/application/handlers/domain/WorkshopHandler.ts` —
  `handleSetExcerpt`, mid-run guard

## Completion Criteria

- [ ] ADR decides among A/B/C (or a staged path C → B → A) with token-cost
      bounds for retained versions.
- [ ] Replacing the excerpt no longer silently orphans the visible
      transcript from the persona's memory — either memory survives (A/B) or
      the break is explicit and confirmed (C).
- [ ] A writer can revise the manuscript and ask the persona to compare
      against prior feedback in one session (A/B), or at minimum understands
      exactly what was lost (C).
- [ ] Tool re-runs after revision analyze the current excerpt without the
      writer needing to reason about sidecar lifetimes.

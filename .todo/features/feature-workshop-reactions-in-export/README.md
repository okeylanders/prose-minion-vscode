# Feature: Reactions in the Transcript Export

**Date Identified:** 2026-11-27
**Status:** Idea. Small. Answers ADR 2026-11-07's Q9 and amends its D7.
**Priority:** Low
**Origin:** Okey, 2026-11-27: "Reactions should be present in the rich HTML export 🙂"

## What exists

- **D7 keeps reactions out of the shared projection**
  (`projectWorkshopTranscript`, `projectWorkshopTranscriptTurn`), with a
  test, so what a persona may read of a saved session doesn't grow.
- **It names this follow-up exactly:** "Adding reactions to the writer's
  export (an export-only layer, never the shared projection) is a possible
  follow-up (Q9)."

## Idea

- **An export-only layer** reads the session's `reactions` beside the
  projection, and the renderers draw them. The shared projection and
  recall stay unchanged, with their test.
- **HTML draws them as the thread does:** a persona's reactions in the
  footer corner, the writer's as a tapback on the bubble's corner. The CSS
  is mirrored from the thread, as the export's other rules are, and pinned
  by the mirror test.
- **Markdown and JSON** (R2): Markdown gets one compact line under the
  bubble ("Reactions: ❤️ you, 😂 Jill"); JSON gets an optional array, with
  its `formatVersion` noting the addition.
- **Hidden reactions stay hidden.** A persona's reaction the writer hid
  isn't exported.

## Decisions to make

| # | Question | Ada's lean |
|---|---|---|
| R1 | HTML only, as asked? | HTML, plus the other two below. |
| R2 | Markdown and JSON too? | Yes: one line in Markdown, an optional array in JSON. |

## Completion Criteria

- [ ] The HTML export shows each turn's reactions where the thread does,
      with mirrored CSS pinned by the mirror test (tests).
- [ ] Markdown and JSON follow R2 (tests).
- [ ] The shared projection and recall are unchanged; D7's test still
      passes, and the ADR records the amendment.

## Related Files

- `packages/core/src/application/services/workshop/export/` (`WorkshopTranscriptHtml.ts` and the other renderers)
- `packages/core/src/application/services/workshop/transcript/WorkshopTranscript.ts`
- `docs/adr/2026-11-07-workshop-message-reactions.md` (D7, Q9)

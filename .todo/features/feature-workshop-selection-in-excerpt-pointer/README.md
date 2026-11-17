# Feature: A Selection Inside the Excerpt Goes as a Pointer

**Date Identified:** 2026-11-07 (split out 2026-11-17)
**Status:** Idea. Small. Split from [Selected Text](../../archive/features/feature-workshop-send-selection-with-message/README.md), which shipped in v2.14.0 sending the selection as text (the epic's default).
**Priority:** Low
**Origin:** An open question in the Selected Text note

## Problem

When the writer selects lines the room's excerpt already holds and sends
them as "Selected Text", the persona receives that text a second time. It
already has it, in the excerpt.

## Idea

When the selection lies inside the excerpt, the same file at the same
version and the same text, the frame sends a pointer instead:

> The writer's selection: excerpt v4, lines 40–44 ("The Rabbit checked…").

- **What it saves:** the duplicate text.
- **What it gains:** it says exactly *where* in the excerpt the writer
  means, which a second copy doesn't.
- **What decides it:** host code compares the selection's file, lines and
  text with the excerpt as delivered. A changed or partial overlap sends
  text, as today.
- **What doesn't change:** the pill still reads "Selected Text", and
  transcript export shows the label as now.

## Completion Criteria

- [ ] A selection inside the delivered excerpt is framed as a pointer, with
      its version, lines and a short quoted opening (test).
- [ ] An edited, partial or out-of-excerpt selection sends text, as today
      (test).

## Related Files

- The `editor-selection` attachment kind and its frame (Everyday Conveniences
  item B, ADR 2026-11-14)
- `packages/core/src/presentation/webview/components/workshop/ExcerptPanel.tsx`
  (excerpt versions)

# Feature: Workshop Composer Messaging Above the Text Entry

**Status**: Implemented on `sprint/workshop-editor-tab-06b-tool-side-pass` (2026-07-11) — pending manual UX verification in the Extension Development Host
**Priority**: Medium
**Date**: 2026-07-11
**Origin**: Epic Workshop Editor Tab — composer-area design pass
**Related**: [feature-workshop-direct-mode-clarity](../feature-workshop-direct-mode-clarity/README.md),
[feature-workshop-participant-rail](../feature-workshop-participant-rail/README.md)
— all three form one composer-area design pass

## Problem / Motivation

Messaging currently renders *below* the text entry, in the visual dead zone
under the composer:

1. Keyboard hint — "Enter to send · Shift+Enter for a new line"
   (`pm-ws-composer-hint`, `WorkshopComposer.tsx` ~line 144)
2. Status/ticker messages (`pm-ws-status-ticker`, rendered after
   `<WorkshopComposer>` in `WorkshopApp.tsx` ~line 600)

The eye rests on the text entry and whatever sits above it (thread,
direct-mode banner); content below the composer is easy to miss entirely.
The "Shift+Enter" hint also blends into the muted footer text, so the one
piece writers actually need to learn doesn't register.

## Proposal

1. **Move all below-composer messaging above the text entry** — keyboard
   hint and status/ticker both relocate to the band between the thread and
   the composer (the same band the direct-mode banner / future participant
   rail occupies). Nothing renders below the composer.
2. **Accent the "Shift+Enter" token** in the keyboard hint (theme accent
   color) so it stands out from the surrounding muted hint text.
   Keep the rest of the hint muted; the accent is the point.

## UX Notes

- Preserve `role="status"` / `aria-live="polite"` on the ticker after the
  move.
- With hint + ticker + direct-mode banner (and later the participant rail)
  sharing the above-composer band, define a deterministic stacking order so
  the band doesn't jitter as messages come and go. Suggested order, top to
  bottom: status/ticker → participant rail / direct-mode banner → keyboard
  hint → text entry.
- Accent color must hold contrast in both light and dark themes.

## Related Files (epic branch `epic/workshop-editor-tab`)

- `packages/core/src/presentation/webview/components/workshop/WorkshopComposer.tsx`
  — `pm-ws-composer-hint`
- `packages/core/src/presentation/webview/WorkshopApp.tsx` — `pm-ws-status-ticker`
  placement
- Workshop webview stylesheet — hint/ticker classes

## Design Revision — v2 (2026-07-11, after live screenshots)

The original proposal ("nothing below the composer") was drafted before the
Shift+Enter accent existed. On a live look, the stacked above-composer band
read as cluttered, and the accent changed the calculus: it does the noticing
work, so the hint no longer needs the prime band. Revised layout gives each
message its own zone:

1. **Status ticker** — centered, thread-side, right above the divider (it
   narrates the run, not the next message). The divider is the ticker's own
   `border-bottom`, and the slot is always mounted, so the line never moves.
2. **Participant rail** — below the divider, visually grouped with the
   composer it routes messages into.
3. **Text entry.**
4. **Keyboard hint** — centered in the quiet zone below the input;
   "Shift+Enter" keeps the theme accent.

## Completion Criteria (v2)

- [x] Each composer-band message occupies its own zone per the v2 order;
      only the learn-once keyboard hint renders below the text entry.
- [x] "Shift+Enter" carries the theme accent. *(The Workshop surface is
      pinned warm-dark in v1 — one palette; `--pm-accent-hi` #ee7d49 holds
      contrast comfortably.)*
- [x] Status/ticker messages centered above the divider with unchanged
      screen-reader semantics (`role="status"` / `aria-live="polite"`,
      region mounted before its first announcement).
- [x] Band has a stable stacking order; no layout jitter (reserved-height
      ticker slot doubles as the stable divider).

## Implementation Notes (2026-07-11)

- Hint lives inside `pm-ws-composer-wrap` below the form; "Shift+Enter" is
  wrapped in `.pm-ws-hint-key` (accent + 600 weight), rest stays muted.
- Tests: `WorkshopComposer.test.tsx` asserts hint content, the accent span,
  and form-precedes-hint document order. Remaining: manual visual pass in
  the Extension Development Host.

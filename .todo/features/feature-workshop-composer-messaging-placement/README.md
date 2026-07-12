# Feature: Workshop Composer Messaging Above the Text Entry

**Status**: Proposed
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

## Completion Criteria

- [ ] No messaging renders below the text entry.
- [ ] Keyboard hint sits above the composer with "Shift+Enter" in the theme
      accent color; contrast verified in light and dark.
- [ ] Status/ticker messages appear above the composer with unchanged
      screen-reader semantics.
- [ ] Above-composer band has a stable stacking order; no layout jitter when
      messages appear/disappear.

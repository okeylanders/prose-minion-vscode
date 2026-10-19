# Transcript Export Mirror Misstates the Webview Cascade Order

**Date Identified**: 2026-10-19 (Lightbox Slice 1)
**Reviewed**: 2026-10-19
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small (verify, reorder one layer, update one test)

## Problem

The styled-HTML transcript export copies the thread's CSS rules verbatim
(ADR 2026-10-05). `WorkshopTranscriptHtmlStyles.ts` says its mirrored layers
follow "the webview's import order", and
`workshopTranscriptHtmlStyles.test.ts` pins that order under the name
"mirrors the stylesheets in the webview cascade order", with `index.css`
**first**.

In the running webview `index.css` loads **last**. Lightbox Slice 1 checked
this in Chromium against the built bundle (`document.styleSheets`): the
full-tab frame sheets, then the Workshop sheets in `WorkshopApp.tsx` import
order, then `index.css`. The entry point imports `./WorkshopApp` (whose CSS
imports evaluate first) before `./index.css`.

Nothing renders wrong today. The mirrored `index.css` rules are
`.markdown-content …` and `:root` (specificity 0,1,x or lower), and every
mirrored Workshop rule carries an attribute scope (0,2,x), so specificity
decides and order does not. The risk is latent: a future mirrored rule pair
with equal specificity would resolve one way in the thread and the other way
in the export, and the test that claims to guard the order would pass.

## Recommendation

1. Confirm no equal-specificity conflict exists between the mirrored
   `index.css` rules and the other layers.
2. Move the `index.css` layer to the end of `WORKSHOP_TRANSCRIPT_MIRRORED_STYLES`
   (before the page layer), and update the expected order in
   `workshopTranscriptHtmlStyles.test.ts`.
3. If the export deliberately differs, say so in the module comment and rename
   the test instead.

## Related Files

- `packages/core/src/application/services/workshop/export/WorkshopTranscriptHtmlStyles.ts`
- `packages/core/src/__tests__/architecture/workshopTranscriptHtmlStyles.test.ts`
- `packages/core/src/presentation/webview/index.tsx` (the real import order)

## Completion Criteria

- The mirror's layer order matches the webview's runtime stylesheet order, or
  the difference is documented as intentional.
- The order test's name and expectation agree with what the webview does.

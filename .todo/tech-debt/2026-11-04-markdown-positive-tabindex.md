# Rendered Markdown Keeps Positive `tabindex`

**Date Identified**: 2026-11-04 (PR #186 N-01, Workshop Wayfinding Slice 2)
**Reviewed**: 2026-11-04
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small: one sanitizer hook and a test

## Problem

`sanitizeMarkdownHtml` (`components/shared/MarkdownRenderer.tsx`, DOMPurify
defaults) keeps a `tabindex` attribute on raw HTML in Markdown. Markdown
rendered from workspace files, such as attachments, the Read in reader and
reports, can therefore carry `tabindex="1"` or higher. That pulls the element
ahead of every other control on the page, in every surface that renders it.
WAI-ARIA guidance is never to use a positive `tabindex`.

## What Slice 2 did

Nothing in the content. The text sheet now makes the frame behind it `inert`
(PR #186 N-03, which replaced the N-01 trap), so a positive `tabindex` behind
the sheet can't take focus. One inside the sheet still leads the sheet's own
tab order.

## Smallest credible improvement

In `sanitizeMarkdownHtml`, drop a positive `tabindex` with a DOMPurify
`uponSanitizeAttribute` hook, keeping `0` and `-1`. Add a test beside the
renderer's sanitizer tests.

## Risks

Some writer content may rely on its tab order. That's unlikely for prose
notes, and the rule only makes such elements follow document order.

## Related files

- `packages/core/src/presentation/webview/components/shared/MarkdownRenderer.tsx`

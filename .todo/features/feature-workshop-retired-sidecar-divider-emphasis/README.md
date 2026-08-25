# Feature: Emphasize Retired Workshop Sidecar Conversations

**Date identified:** 2026-08-24
**Source:** v2.2.0 release-candidate user testing
**Status:** Planned
**Priority:** Low
**Estimated effort:** Small

## Summary

Make the excerpt-revision divider communicate tool-sidecar retirement more
clearly. The current neutral text is easy to miss even though retirement makes
the corresponding direct-tool conversation unavailable.

Current example:

> Excerpt v6 pinned · drafts/workshop/chapter-5.8/chapter-5.8-rewrite.md · retired: Repetition

Target example:

> Excerpt v6 pinned · drafts/workshop/chapter-5.8/chapter-5.8-rewrite.md · Retired Repetition Conversation

## Acceptance criteria

- Replace `retired: <Tool>` with `Retired <Tool> Conversation` for one retired
  sidecar.
- Use natural plural copy when several sidecars retire, for example
  `Retired Repetition and Continuity Conversations`.
- Render the retirement clause in the existing alert/warning color while
  leaving the excerpt-version and source text neutral.
- Preserve readable text as the non-color signal; color must not be the only
  indication that a conversation ended.
- Keep historical tool turns visible and unchanged; this is presentation and
  divider-copy work only.
- Add focused tests for singular/plural copy and the warning-style treatment.

## Likely touchpoints

- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
- `packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx`
- Workshop divider/component styles and their focused tests

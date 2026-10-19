# Shared Full-Tab Frame Classes Keep the Workshop Prefix

**Date Identified**: 2026-10-19 (Lightbox Slice 1)
**Reviewed**: 2026-10-19 (Slice 2A)
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small to medium (mechanical rename across two tabs, the export mirror and tests)

## Problem

Lightbox Slice 1 moved the full-tab frame (`FullTabShell`, its header chips,
rail and banner) into `components/fulltab/` and `styles/fulltab/`, scoped to
`[data-pm-frame="fulltab"]`. To keep the slice a pure refactor with an
identical DOM, the class names did not change: the shared frame still uses
the Workshop's prefix (`.pm-ws`, `.pm-ws-header`, `.pm-ws-brand`,
`.pm-ws-balance*`, `.pm-ws-split`, `.pm-ws-rail`, `.pm-ws-main`,
`.pm-ws-provider-paused`, `.pm-ws-eyebrow`). Slice 2A added more to the
frame under the same prefix: the rail section cards (`.pm-ws-block*`, moved
from the Workshop's sheet) and the aside layout (`.pm-ws-aside`,
`.pm-ws-split-with-aside`, `.pm-ws-with-aside`).

The concrete risk is ownership confusion, now that a second surface renders
these classes. A Workshop author can add a `[data-pm-surface="workshop"]
.pm-ws-header …` rule believing the header is the Workshop's, silently
forking the frame between tabs. A Lightbox author can reach for a `pm-ws-*`
class believing it is shared when it is Workshop-only (for example
`.pm-ws-excerpt`, which is still Workshop-scoped).

## Recommendation

Rename the frame's classes to a frame prefix (for example `pm-ft-*`) in one
focused change: `FullTabShell`, `FullTabRail`, `FullTabHeaderStatus`,
`ProviderPausedBanner`, `styles/fulltab/shell.css`, the transcript export
(its markup and its regenerated mirror), and tests that query these classes.
Do it before the Lightbox adds many rules of its own, or fold it into the
slice that next restyles the frame.

## Related Files

- `packages/core/src/presentation/webview/components/fulltab/`
- `packages/core/src/presentation/webview/styles/fulltab/shell.css`
- `packages/core/src/application/services/workshop/export/WorkshopTranscriptHtml.ts`
- `packages/core/src/application/services/workshop/export/WorkshopTranscriptHtmlStyles.ts`
- `packages/core/src/__tests__/architecture/workshopStyles.test.ts`

## Completion Criteria

- No class rendered by the shared frame carries the `pm-ws-` prefix.
- `styles/fulltab/` selects only frame-prefixed classes, and no
  `[data-pm-surface="…"]` rule selects a frame class.

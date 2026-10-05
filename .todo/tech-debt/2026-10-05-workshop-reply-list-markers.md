# Workshop replies render lists without markers and links without styling

**Date identified:** 2026-10-05
**Status:** Identified — follow-up; does not block transcript export
**Priority:** Low
**Found by:** Transcript export styling pass ([ADR 2026-10-05](../../docs/adr/2026-10-05-workshop-transcript-export.md) §5)

## Problem

The webview runs Tailwind's preflight, which sets `list-style: none` on `ul`
and `ol` and `color: inherit; text-decoration: inherit` on `a`.
`.markdown-content` restores list indentation but not markers, and styles no
links. So in Workshop replies (and sidebar results) a numbered list reads as
indented lines without numbers, and a link reads as plain text.

The styled HTML transcript restores both in its export-only page layer, which
makes the export and the thread differ on exactly these two points.

## Smallest change

Add `list-style: disc` / `list-style: decimal` to `.markdown-content ul` /
`ol`, and a link color + underline to `.markdown-content a`, in
`packages/core/src/presentation/webview/index.css`. Then regenerate the
mirrored rules in `WorkshopTranscriptHtmlStyles.ts` and drop the two
departures from its page layer.

## Related files

- `packages/core/src/presentation/webview/index.css` (`.markdown-content` rules)
- `packages/core/src/application/services/workshop/export/WorkshopTranscriptHtmlStyles.ts`
- `packages/core/src/__tests__/architecture/workshopTranscriptHtmlStyles.test.ts`

## Completion criteria

- Reply lists show markers and reply links are visibly links in the thread and
  sidebar.
- The transcript stylesheet mirrors those rules and no longer overrides them.

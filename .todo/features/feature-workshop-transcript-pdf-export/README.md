# Feature: Workshop Transcript PDF Export

**Date Identified**: 2026-10-05
**Source**: Workshop transcript export ([ADR 2026-10-05](../../../docs/adr/2026-10-05-workshop-transcript-export.md)), deferred format
**Status**: Parked
**Priority**: Low

## Problem

Writers asked for PDF alongside Markdown, JSON, and styled HTML. A faithful PDF
of the thread needs a layout engine: headless Chromium (large, platform-specific
binaries) or a PDF library that re-implements the thread's layout (drifts from
the HTML styling). Neither ships with the extension today.

The styled HTML export already prints to PDF with backgrounds from any browser
(`print-color-adjust: exact`, turn-level page-break hints), and the export sheet
says so. That covers the need until a native path is worth its weight.

## Options to evaluate

- Host-native print: open the HTML in a VS Code webview panel and drive its
  print dialog, if the host exposes one.
- A small PDF library fed by the transcript projection, accepting a simpler
  layout than the thread.
- An optional, user-installed Chromium path, used only when present.

## Related Files

- `packages/core/src/application/services/workshop/export/WorkshopTranscriptExportService.ts`
- `packages/core/src/application/services/workshop/export/WorkshopTranscriptHtml.ts`
- `packages/core/src/application/services/workshop/export/WorkshopTranscriptHtmlStyles.ts`
- `packages/core/src/presentation/webview/components/workshop/WorkshopExportSessionModal.tsx`

## Completion Criteria

- `pdf` joins `WORKSHOP_TRANSCRIPT_EXPORT_FORMATS` without adding a bundled
  browser to the VSIX.
- The PDF renders the same transcript projection as the other formats.
- Tests cover the format route and a rendered-output smoke check.

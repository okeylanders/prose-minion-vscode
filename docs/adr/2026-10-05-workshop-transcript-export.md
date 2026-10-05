# ADR 2026-10-05: Workshop Transcript Export

**Status:** Accepted (2026-10-05)
**Date:** 2026-10-05
**Extends:** [ADR 2026-07-24 — The Workshop Room Ledger and Delivery Offsets](2026-07-24-workshop-room-ledger-and-delivery-offsets.md); [ADR 2026-06-18 — MessageHandler Composition-Root Consolidation](2026-06-18-messagehandler-composition-root-consolidation.md)
**Related:** [ADR 2026-07-30 — Workshop Session Codec Evolution](2026-07-30-workshop-session-codec-evolution.md) (the session codec this is deliberately *not*)

## Context

Writers want to take a Workshop conversation out of the room: to hand it to
another agent as context, or to share or showcase it. The session file is the
wrong artifact for both. It is a complete, versioned checkpoint of host state —
retained provider histories, context bodies, attachment text, widget drafts —
and it only means something to Prose Minion.

What a writer wants to export is the *thread*: the conversation as it reads on
screen. Three facts shape how to produce it:

1. **The webview does not hold the whole thread.** Session snapshots carry at
   most the newest `WORKSHOP_SNAPSHOT_TURN_WINDOW` (200) turns. A marathon
   session's opening exists only in the host ledger.
2. **Bodies the thread does not show live outside turns.** Message attachments
   and widget commits are host-private thread-artifacts referenced by id;
   capability evidence is collapsed behind a `<details>`; context-change turns
   narrate context. The visible content is `turn.content` plus labels.
3. **Reply bodies are untrusted model output.** The webview sanitizes them with
   DOMPurify. The extension host has no DOM.

## Decision

### 1. Export is host-side, from the full ledger

A new route, `WORKSHOP_EXPORT_SESSION { format, title }`, reads
`WorkshopSessionService.readRoomLedger()` — every turn, not the snapshot
window — and answers with the existing `WORKSHOP_SESSION_ACTION_RESULT`
under a new `export` action. It is owned by a new Workshop sibling,
`WorkshopSessionExportHandler`, registered **directly** (not behind the
mutation gate): export never changes the room. It still refuses while a room
replacement (New, Open, Rewind, Branch) is in flight, so it cannot capture a
room mid-swap. A streaming reply is simply not in the ledger yet.

### 2. One projection decides what "visible" means

`projectWorkshopTranscript` maps turns to `writer`, `reply`, and `event`
entries, mirroring `WorkshopTurnBubble` minus its chrome:

| Thread element | Exported as |
|---|---|
| Writer message | its text, verbatim; attachment and widget **labels** only |
| Participant reply (host, guest, tool, direct instrument) | speaker, content, truncation notice, web sources |
| Session start/resume, excerpt revision, direct tool run, standing-directive marker, legacy scope divider | one-line event |
| Persona-requested capability artifact (dictionary, resource, persona-run analysis) | one-line event naming the request and status — never the evidence body |
| Context-change divider | **omitted** (context details) |
| Token usage, action buttons, finding chips, widget recommendation chips | omitted (chrome) |

All three formats render this projection, so the inclusion rule lives once.

### 3. Three formats, write-once files

- **Markdown** — speaker headings over verbatim bodies; for pasting into
  another agent or notes.
- **JSON** — `format: "prose-minion.workshop-transcript"`, `formatVersion: 1`;
  for scripts and agent pipelines. This is a projection, not the session
  codec: it cannot be opened as a session and carries no host-private state.
  Bump `formatVersion` only when a field changes meaning or disappears.
- **Styled HTML** — a standalone page styled like the thread (§4, §5).

Files land in `prose-minion/exports/` beside `sessions/` and `reports/`. The
writer's title names the document; the file stem is derived from it (accents
folded, ASCII letters/digits/hyphens only), so a title cannot steer the write
outside the directory. An export never replaces an earlier one: the shared
`writeNumberedFile` helper (extracted from Save-to-notes' dictionary path)
renames a temp file into the first free `stem`, `stem-2`, … with
`overwrite: false`. Markdown and JSON open beside the Workshop afterwards —
never in its own editor group, which would hide the retained panel; the first
build did, and the panel returned shifted up with its header out of view.
HTML opens in the OS default application through a new
`ShellService.openFileInDefaultApp` port. Opening is best effort; the write is
the result.

### 4. HTML is safe by construction, without a DOM

The host renders reply Markdown with an isolated `marked` instance using the
webview's `gfm` + `breaks` settings, with renderer overrides: raw HTML
renders as escaped text, images render as their alt text (no fetch), and links
keep only normalized `http(s):`, `mailto:`, or `#fragment` destinations. The
writer's messages are escaped plain text. The page carries
`Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`, so a
renderer bug still cannot run script or load a beacon.

### 5. "Styled like the thread" is pinned by a test

The page renders under `data-pm-surface="workshop"`, reuses the thread's
class names, and inlines a stylesheet with three layers: the subset of
Tailwind preflight the webview runs on, rules **copied verbatim** from the
thread stylesheets (generated, in cascade order), and an export-only page
layer. `workshopTranscriptHtmlStyles.test.ts` parses each source stylesheet
and fails when any mirrored rule drifts. Icon geometry moved to
`@shared/constants/iconPaths` so host and webview draw the same glyphs.

The page layer makes two deliberate departures: it restores list markers and
link styling inside replies, which the webview's preflight strips. A static
document has no other cue that "1." starts a numbered step.

## Consequences

- `WorkshopSliceComposition` composes ten siblings; the route ledger in
  `boundaries.test.ts` gains one direct route (54 total).
- `CoreServices` gains `workshopTranscriptExportService`; `WorkshopRoomHandler`
  threads it inward as a narrow `WorkshopTranscriptExportPort`.
- A thread restyle now fails the mirror test until the export copy follows.
  That is the point: the promise "looks like the thread" stays true.

## Alternatives considered

- **Webview-side export** (serialize the rendered DOM). Rejected: the webview
  lacks turns beyond the snapshot window, and would have to ship host-private
  file writes through another round trip anyway.
- **Embed the full webview stylesheet.** Rejected: ~160 KB of unrelated rules
  and Tailwind output in every shared file, with no drift protection.
- **PDF now.** Deferred. A faithful PDF needs a layout engine (headless
  Chromium or a PDF library) the extension does not ship. The HTML export
  prints to PDF with backgrounds from any browser. See
  [feature-workshop-transcript-pdf-export](../../.todo/features/feature-workshop-transcript-pdf-export/README.md).

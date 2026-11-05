# Slice 3: Read-In Provenance

**Epic:** [Workshop Wayfinding](README.md)
**Decision:** [ADR 2026-11-03](../../../docs/adr/2026-11-03-workshop-wayfinding.md), D3, D4 (provenance and honesty), and D9
**Status:** Done. Merged into the epic through PR #187 (`89d6f26`) after Astra's re-review resolved F-01, F-02 and N-01 ([review](../../../docs/pr-reviews/pr-187-workshop-wayfinding-read-in-provenance-review.md)). Built in `e36e4af`, `3b23a92`, `2163cb9`; review fixes `6575bbb`, `16aa38c`, `9801e01`. D9 (forward-only compatibility) was confirmed by Okey on 2026-11-03.

## Outcome

Each read-in row knows where it came from. A row fetched by a capability
records the card that fetched it, so `tool-evidence`, `dictionary`, and
`transcript` rows jump to that card. A `resource` row also records the line
range it read and a host-private fingerprint. The reader then:

- marks the lines that were read,
- shows an "End of {persona}'s read · line N" marker,
- shows a "changed since" banner when the file no longer matches.

## Since Slice 2

Slice 2 (PR #186) settled several things this slice builds on.

- **The reader routes** live in `WorkshopReadInRoutes`, and resolution is
  `WorkshopConfiguredResourceLookup`, which `resource.read` shares.
  `readInOpenAction` and `partitionContextSources` live in
  `presentation/webview/utils/workshop/contextSources.ts`.
- **Every reader request carries a webview-minted `requestId`**, which the
  host echoes. `useWorkshopReadIn` takes only the pending request's first
  reply. The fields this slice adds to `WORKSHOP_READ_IN_RESOURCE_CONTENT`
  (`lineRange`, `changedSinceRead`) ride the same correlated reply. Pick the
  row by its delivery identity in the request, as the Reader honesty section
  says, and never by `{ group, path }` alone.
- **Each reader opening is its own sheet**, keyed `read-in:<requestId>`.
  A room or chat-target change closes an open reader.
- **While any text sheet is open, the frame behind it is `inert`**, through
  `FullTabShell`'s opt-in `inertBehindOverlay`. The "Show where it was read"
  jump must close the sheet before it scrolls the thread; otherwise the
  thread is inert and can't take focus.
- **Astra checks** for: state lost or carried across a remount, response
  correlation, ARIA relationships, focus, and exact-head verification. See
  `docs/pr-reviews/pr-186-workshop-wayfinding-read-in-review.md`.

## Build

### Contract and codec

- `ContextSourceEntry` (`shared/types/messages/inferenceContext.ts`) gains
  optional `turnId?: string` and `lineRange?: { start: number; end: number }`.
- The host-side stored row also gains `sourceFingerprint?: string`. Keep it out
  of the webview projection, the way `WorkshopExcerptSnapshot` omits the
  excerpt's fingerprint: either add the field to a host-only row type, or strip
  it where sources are projected for the snapshot.
- `assertContextSource` (`WorkshopSessionStateV1Shape.ts`) accepts the new keys
  as optional and validates them:
  - `turnId` is a non-empty string.
  - The range is a pair of positive integers with `start ≤ end`.
  - The fingerprint is a 64-character hex string.
- Write each field only when it's present. Update checkpoint equality and
  anything else that lists source keys.
- **Fixtures:** a stored session whose rows have none of the new fields loads
  unchanged and saves without adding them.

### Recording

- `WorkshopPersonaCapability.toDeliveredSources` (and recall's
  `deliveredSources`) receive the id of the capability card turn that records
  the call. Verify how and when that card turn is appended relative to source
  recording. If a call path mints no card, its rows carry no `turnId`, and that
  path gets a test saying so.
- `resource.read` reports its parsed line range and a SHA-256 of the whole
  file's bytes at read time. The resource capability already holds the bytes,
  so add both to its result metadata, then to the row.

### Reader honesty

- `WORKSHOP_READ_IN_RESOURCE_CONTENT` (Slice 2) gains
  `lineRange?` and `changedSinceRead?: boolean`. The host computes
  `changedSinceRead` by hashing the current file and comparing it with the
  row's stored fingerprint. The request therefore needs to identify the row:
  add the row's delivery identity (for example `deliveredAt` plus
  `{ group, path }`, or a host row id if one exists) and pick the newest match.
  Never send the fingerprint to the webview.
- The sheet's `read-in` mode:
  - draws a left accent bar on the lines inside the range,
  - adds the marker after the last line read,
  - scrolls to the start of the range on open,
  - shows the amber banner when `changedSinceRead`: "This file has changed
    since {persona} read it. You're seeing it as it is now."

### Jump

- `readInOpenAction` returns `{ kind: 'jump', turnId }` for rows that have a
  `turnId` and aren't `resource` rows.
- A resource row keeps `reader`, and the sheet gains a "Show where it was read"
  link when the row has a `turnId`.
- Jump uses the same scroll-and-focus path as to-do "show source". A turn
  outside the window shows that path's toast for now; Slice 5 replaces it with
  the reader.

### Optional

A "changed since" tag on the rail row itself is optional in this slice. Add it
only if it reuses an existing file scan, such as the context-file refresh scan.
Never hash files on every snapshot.

## Tests

- **Codec:** the new optional fields round-trip, invalid values are rejected,
  and old rows are unchanged on read and write.
- **Recording:** each capability family records `turnId` (or explicitly
  doesn't). `resource.read` records the range and fingerprint.
- **Snapshot:** the projection never includes the fingerprint.
- **Host content:**
  - `changedSinceRead` is false for an unchanged file and true after an edit.
  - A missing file reports an error.
- **Sheet:** the range band, the marker, scrolling to the range, and the
  banner.
- **Open action:** `jump` for card-backed rows, and `reader` with "Show where
  it was read" for resource rows.

## Completion Criteria

- [x] Rows record `turnId`, `lineRange`, and the host-private fingerprint.
      Sessions without these fields are unchanged on read and write.
      (`WorkshopPersonaCapabilityReadInProvenance`, `AgentRunEngine` Phase 7
      block, `WorkshopToolContextCapability`, `WorkshopTranscriptRecallWiring`,
      `WorkshopReadInProvenanceCodec` with the
      `workshop-session-v2-read-in-before-provenance.json` fixture.)
- [x] The reader marks the lines read and says when the file has changed.
      (`WorkshopReadInRoutes` provenance block,
      `WorkshopReadInProvenance.integration`, `WorkshopTextSheet` Slice 3
      block, `WorkshopApp.readInProvenance`.)
- [x] Card-backed rows jump to their card. (`contextSources`,
      `WorkshopReadInPanel`, `useWorkshopTurnJump`,
      `WorkshopApp.readInProvenance`.) The live check of scrolling in VS Code
      is Slice 8's.
- [x] The epic's per-slice verification passes. Counts are recorded in the
      epic's progress notes.

## Built

### Where each piece lives

- **Contract.** `ContextSourceEntry.turnId?` and `lineRange?`
  (`ContextSourceLineRange`).
- **Host-only row.** `StoredContextSourceEntry` adds `sourceFingerprint?`.
  It lives in `infrastructure/api/orchestration/ContextSourceRecord.ts`, with
  the validator, the deep clone, the projection, and the row lookup.
  - `ConversationManager` stores host rows and validates the new fields on
    import.
  - `getContextSources` projects the fingerprint away. That is the one path
    to the snapshot (`WorkshopRoomHandler.activeContextBudget`).
- **Recording.**
  - `WorkshopPersonaCapability.toDeliveredSources` takes the id of the card
    that `recordCompletedTurn` appended a moment before. It stamps that id
    on every family's rows, recall's included.
  - `resource.read` reports its range through its existing
    `startLine`/`endLine` metadata (`resourceReadLineRange`), and its
    fingerprint through `configuredResourceFingerprint`.
  - The engine copies each field only when it is present.
- **Codec.**
  - `assertContextSource` accepts and checks the three keys.
  - Archive rows are checked by `ConversationManager.validateContextSources`
    at import, as every other row field is. Checkpoint equality compares
    the decoded JSON, so it needed no change.
  - `cloneSourceEntry` now deep-clones through `cloneStoredContextSource`.
- **Reader honesty.**
  - The request carries `deliveredAt`.
  - The room's `findReadInRecord` effect looks up the row in the chat
    target's conversation, through `AssistantToolService` and
    `AgentRunEngine`.
  - `WorkshopReadInRoutes` compares fingerprints and answers `lineRange` and
    `changedSinceRead`.
  - The webview takes provenance only from a reply for the same reading
    (`readInReplyFor`: same file, same `deliveredAt`).
- **Sheet.**
  - `WorkshopReadInLines` holds the band, the marker, and the scroll to the
    start of the range.
  - The amber banner and "Show where it was read" are in `WorkshopTextSheet`.
- **Jump.** `useWorkshopTurnJump` replaces `showTodoSource`. Its
  `jumpAfterClosing` closes the sheet, then jumps from an effect once the
  frame is no longer inert.

### Paths that mint no card

- **A refused call.** When the session refuses a persona's call (a late
  request, or a principal or excerpt mismatch), it records no card, so the
  row carries no `turnId`. The row is still recorded, because the evidence
  still reached the model.
- **A tool side-pass.** `WorkshopToolContextCapability` (origin `tool`) never
  mints a card.

Each has a test.

### Deviations

- **The fingerprint rides beside `metadata`, not in it.**
  `WorkshopCapabilityResult.sourceFingerprint` holds it. A capability's
  `metadata` is copied onto the card, which is persisted and shown in the
  thread, and `formatEvidence` prints it into the persona's evidence. So the
  doc's "add both to its result metadata" would have leaked the fingerprint
  to both. The range was already in `metadata` as `startLine`/`endLine`.
- **`turnId` is stamped centrally.** It is set once in
  `toDeliveredSources`, not passed into recall's `deliveredSources`, so
  every family shares one rule.
- **Row identity.** A row has no id, so the reader names it by `deliveredAt`
  plus the file it already sends, and the host takes the newest match.
  Two rows sharing a millisecond are
  [tech debt](../../tech-debt/2026-11-04-read-in-row-identity.md).
  - The lookup uses the file as the catalog resolves it, the path
    `resource.read` recorded, not the webview's spelling.
- **"Changed since" is only said when it is known.** `changedSinceRead` is
  absent, not `false`, when the row has no fingerprint: a whole-file tool
  read, or a row stored before this slice.
- **Where the band is drawn.** It goes on the **Source** tab, as numbered
  lines (the design's view), and a ranged read opens there. Rendered
  Markdown has no lines to mark. A row without a range keeps Slice 2's
  rendered Preview.
- **The marker** is left out when the text no longer reaches the last line
  read, because the file shrank or the view stopped at its byte ceiling. It
  is never placed elsewhere.
- **Header line.** It reads "Read at 3:14 PM · lines 2–4". The design's
  "of 71" and group are omitted.
- **Jump rows' names.** A jump row is named "Show the card for {label} in
  the thread". "Read" didn't fit a tool report.
- **Optional rail tag.** The "changed since" tag on the rail row is not
  built. No existing scan covers read-in files, and the doc rules out
  hashing on every snapshot.

### PR #187 review fixes

Astra's [review](../../../docs/pr-reviews/pr-187-workshop-wayfinding-read-in-provenance-review.md)
found three issues. All three are fixed; the ledger is in her report.

- **F-01, `16aa38c`.** After a jump, the overlay's opener restore took focus
  back from the card. Now `useOverlayDismiss.focusAfterOverlaysClose` runs
  the jump in place of the opener restore, falling back to the opener when
  the turn is outside the window.
- **F-02, `6575bbb`.** A writer row could carry a fingerprint to the webview.
  - The codec now refuses `sourceFingerprint` on writer rows.
  - `activeContextBudget` projects every outgoing row.
- **N-01, `9801e01`.** The range scroll ran while the Source pane was still
  hidden. It now waits until the pane is visible, once per range.

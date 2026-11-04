# Slice 3: Read-In Provenance

**Epic:** [Workshop Wayfinding](README.md)
**Decision:** [ADR 2026-11-03](../../../docs/adr/2026-11-03-workshop-wayfinding.md), D3, D4 (provenance and honesty), and D9
**Status:** In progress, on `epic/workshop-wayfinding-slice-3-read-in-provenance`. D9 (forward-only compatibility) was confirmed by Okey on 2026-11-03.

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

- [ ] Rows record `turnId`, `lineRange`, and the host-private fingerprint.
      Sessions without these fields are unchanged on read and write.
- [ ] The reader marks the lines read and says when the file has changed.
- [ ] Card-backed rows jump to their card.
- [ ] The epic's per-slice verification passes. Counts are recorded.

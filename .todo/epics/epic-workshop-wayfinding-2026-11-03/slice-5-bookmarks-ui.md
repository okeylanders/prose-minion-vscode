# Slice 5: Bookmarks in the Rail and Thread

**Epic:** [Workshop Wayfinding](README.md)
**Decision:** [ADR 2026-11-03](../../../docs/adr/2026-11-03-workshop-wayfinding.md), D1 (amended: badge, no toast), D5, and D6
**Design:** `Main.dc.html` (the Bookmark button and the Notes tab) in [`docs/design/workshop-wayfinding/`](../../../docs/design/workshop-wayfinding/README.md)
**Status:** Planned (after Slice 4)

## Outcome

Eligible bubbles have a **Bookmark** toggle in their action row. The Notes tab
lists bookmarks under To-dos, in thread order, and the writer can rename one in
place or jump to its bubble. A bookmark whose bubble is outside the loaded window
opens that turn in the reader. To-do "show source" uses the same reader instead
of its toast.

## Build

### Thread

- In `WorkshopTurnBubble`'s action row (`pm-ws-turn-actions`), add a Bookmark
  toggle next to Copy, Save, Rewind, and Branch, on eligible turns only.
  - It's a `<button aria-pressed>`, labeled "Bookmark" or "Bookmarked", with the
    filled icon when it's set.
  - It posts `WORKSHOP_SET_TURN_BOOKMARK`.
  - It's disabled while the room's mutation lock is held, like its neighbors.
- A bookmark set while Notes is hidden badges the Notes tab through
  `useWorkshopRailTabs`, the same way a to-do does (D1, amended). There's no
  toast.

### Notes tab

- **`components/workshop/WorkshopBookmarkList.tsx`** (new), presentational. It
  renders the snapshot's summaries.
  - Each row has a bookmark icon in the participant's identity color, the
    label, and a meta line.
  - An "opens in reader" tag marks rows that aren't `inWindow`.
  - Each row has a rename button (`aria-label="Rename bookmark"`) that opens an
    inline form like the to-do editor's. Enter saves, Escape cancels, and a
    blank label resets to the default.
  - Clearing a bookmark from the list is optional. If you add it, it reuses
    `WORKSHOP_SET_TURN_BOOKMARK`.
  - With no bookmarks, show one muted line: "Bookmark a reply to find it here."
- Mount it in `WorkshopRail`'s Notes panel, under To-dos.
- **Jump:** an in-window row uses the to-do "show source" scroll-and-focus path.
  Extract that path into a small shared helper that both use, if that keeps
  `WorkshopApp` smaller.

### Out-of-window reader (D6)

- **`WORKSHOP_REQUEST_TURN_PREVIEW`** `{ turnId }` →
  **`WORKSHOP_TURN_PREVIEW`** `{ turnId, turn?: <projected turn>, error? }`.
- The host reads the full ledger read-only, the way transcript export does
  (`readRoomLedger()`). It doesn't join the mutation gate, and it waits out room
  replacement. It projects the turn through `projectWorkshopTranscriptTurn`, so
  no host-private body is sent.
- A sheet mode `{ kind: 'turn-preview'; turnId; label }` renders the projected
  turn's Markdown read-only, with "Outside the loaded window" in its meta line.
- **To-do "show source":** when the source turn isn't rendered, open this
  preview instead of the toast.

## Tests

- **Bubble:** the toggle shows only on eligible turns, posts the message,
  reflects `aria-pressed`, and is disabled under the lock.
- **Badge:** a bookmark added while Notes is hidden badges it; one added while
  Notes is showing doesn't.
- **List:**
  - Rows are in snapshot order, with the "opens in reader" tag.
  - Rename saves, cancels, and resets.
  - The empty state shows.
- **Jump:** an in-window bookmark focuses its bubble; an out-of-window bookmark
  requests a preview.
- **Host preview:** it returns a projected turn and doesn't touch session state;
  an unknown id returns an error; host-private fields are absent.
- **To-dos:** an out-of-window source opens the preview.

## Completion Criteria

- [ ] Writers can bookmark, rename, and jump from the thread and the Notes tab.
- [ ] Out-of-window bookmarks and to-do sources open in the read-only preview.
- [ ] A bookmark added while Notes is hidden badges it, and nothing switches tabs.
- [ ] The epic's per-slice verification passes. Counts are recorded.

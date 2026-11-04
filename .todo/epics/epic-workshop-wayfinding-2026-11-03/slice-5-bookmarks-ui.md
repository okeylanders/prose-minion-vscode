# Slice 5: Bookmarks in the Rail and Thread

**Epic:** [Workshop Wayfinding](README.md)
**Decision:** [ADR 2026-11-03](../../../docs/adr/2026-11-03-workshop-wayfinding.md), D1 (amended: badge, no toast), D5, and D6
**Design:** `Main.dc.html` (the Bookmark button and the Notes tab) in [`docs/design/workshop-wayfinding/`](../../../docs/design/workshop-wayfinding/README.md)
**Status:** In progress, on `epic/workshop-wayfinding-slice-5-bookmarks-ui`, cut from the epic at `356c751` (Slice 4 merged).

## Outcome

Eligible bubbles have a **Bookmark** toggle in their action row. The Notes tab
lists bookmarks under To-dos, in thread order, and the writer can rename one in
place or jump to its bubble. A bookmark whose bubble is outside the loaded window
opens that turn in the reader. To-do "show source" uses the same reader instead
of its toast.

## Since Slice 4

The host side is done (PR #188). Slices 2 and 3 already built most of the
webview machinery this slice reuses, so parts of the Build section below are
already true. Where this section and the Build section disagree, this section
wins.

### Contracts Slice 4 provides

- **Shapes and messages.** `shared/types/messages/workshop/bookmarks.ts`
  defines:
  - `WorkshopBookmarkSummary`: `{ id, turnId, label, participant,
    personaId?, toolId?, inWindow }`;
  - `WORKSHOP_SET_TURN_BOOKMARK` `{ turnId, bookmarked }`;
  - `WORKSHOP_RENAME_BOOKMARK` `{ bookmarkId, label | null }`.

  `WorkshopSessionSnapshot.bookmarks` holds the summaries in thread order. A
  set or rename that changes nothing still posts the snapshot.
- **`inWindow`** is computed against exactly the snapshot's `turns`. Trust it.
  Never re-derive it from what the thread has rendered.
- **The label rule.** `shared/constants/workshopBookmarks.ts` has
  `checkWorkshopBookmarkLabel`, with `WORKSHOP_BOOKMARK_LABEL_CHARACTERS` = 80.
  - The rename field uses that rule to say what's wrong before it posts. The
    host checks again.
  - A blank label posts `null`, which restores the default label.
- **Refusals.** A refused set (ineligible turn, or `ids-exhausted`) changes
  nothing and reports through error source `workshop.bookmark`. Show it the
  way its neighbors show a refused to-do action.

### Eligibility: one rule

The host decides with `isWorkshopBookmarkableTurn`, in
`application/services/workshop/session/WorkshopBookmarkLedger.ts`:

- Eligible: host, guest and tool replies, and the writer's own messages.
- Not eligible: dividers, session turns, system turns, and the writer's
  tool-run requests.

The bubble needs the same answer, and must never hold a second copy of the
rule. Pick one:

- **Move the predicate** into `shared/constants/workshopBookmarks.ts`, pure
  over the turn facts it already reads, and have the ledger import it.
- **Or project it** as a per-turn flag, the way `turnRewindability` is.

Whichever you choose, the host stays the authority.

### Jump and focus: already built

- **`useWorkshopTurnJump`** (Slice 3) is the shared scroll-and-focus path. It
  already backs to-do "show source" and the read-in jump rows, so the
  extraction this doc's Build section asks for is done. Reuse it.
- **`jumpAfterClosing` and `useOverlayDismiss.focusAfterOverlaysClose`**
  (PR #187 F-01) are how a jump from inside an overlay keeps its destination.
  Without them, the opener restore takes focus back.
- **Out-of-window turns.** `useWorkshopTurnJump` reports a turn outside the
  window to its caller, which shows a notice. This slice replaces that notice
  with the turn preview for all three callers: bookmarks, to-do sources, and
  read-in jump rows.

### The preview follows Slice 2's reader rules

- **Correlation.** `WORKSHOP_REQUEST_TURN_PREVIEW` carries a webview-minted
  `requestId`, and the host echoes it. The webview takes only the pending
  request's first reply, as `useWorkshopReadIn` does. The contract in the
  Build section below gains `requestId` on both messages.
- **Sheets.** Each opening is its own sheet, keyed `turn-preview:<requestId>`.
  A room change or chat-target change closes it. The frame behind it goes
  `inert` through `FullTabShell`'s `inertBehindOverlay`, as every text sheet
  does.
- **Host.** The host reads `readRoomLedger()`, read-only, and waits out room
  replacement. It never joins the mutation gate. It sends the turn only through
  `projectWorkshopTranscriptTurn`, the same projection the bookmark default
  label reads. The route belongs with the bookmark or transcript owners, never
  in `WorkshopRoomHandler`.

### Badge

`useWorkshopRailTabs` badges per tab through seen sets (Slices 1 and 2).

- A bookmark's identity is its `id`.
- A room change re-baselines, so opening a session with bookmarks never
  badges.
- Nothing ever switches a tab.

### Export and Rewind

- **Export.** Its bookmark look is export-only for now, in
  `export/WorkshopTranscriptHtmlBookmarkStyles.ts`. Once the bubble has a mark,
  follow the mirror rule in `AGENTS.md`:
  - a rule the thread and export share moves to the mirrored layer, and its
    pin test is regenerated;
  - a rule only export uses stays in the page layer.
- **Rewind.** Its result summary counts the to-dos it removes, but not the
  bookmarks. If its confirmation or result names removed to-dos, name removed
  bookmarks the same way, from host-reported counts. Otherwise, record why
  not.

### File sizes and what Astra checks

**Large files grow only by a seam:**

| File | Lines |
|---|---|
| `WorkshopApp.tsx` | 1,713 |
| `WorkshopTurnBubble.tsx` | 754 |

- Keep the toggle in its own component, for example `WorkshopBookmarkToggle`.
- Keep the list in `WorkshopBookmarkList`.
- Put the transport (set, rename, and preview correlation) in a domain hook,
  for example `useWorkshopBookmarks`, mounted through the rail.
- Keep any rename-form state in a controller.

**Astra checks** for:
- focus after jumps and closes, through the real App with microtasks settled;
- ARIA: `aria-pressed`, names that start with the visible label, and live
  status;
- state lost or carried across a remount: an open rename survives a tab
  switch;
- response correlation;
- host-private data on every path;
- exact-head verification.

See `docs/pr-reviews/` for PRs #186, #187 and #188.

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

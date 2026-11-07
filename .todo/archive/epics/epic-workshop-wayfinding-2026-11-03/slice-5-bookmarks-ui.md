# Slice 5: Bookmarks in the Rail and Thread

**Epic:** [Workshop Wayfinding](README.md)
**Decision:** [ADR 2026-11-03](../../../../docs/adr/2026-11-03-workshop-wayfinding.md), D1 (amended: badge, no toast), D5, and D6
**Design:** `Main.dc.html` (the Bookmark button and the Notes tab) in [`docs/design/workshop-wayfinding/`](../../../../docs/design/workshop-wayfinding/README.md)
**Status:** Done. Merged into the epic through PR #189 (`4a180ab`) after Astra's re-review resolved F-01 through F-04 and N-01 ([review](../../../../docs/pr-reviews/pr-189-workshop-wayfinding-bookmarks-ui-review.md)). Built in `d295bcd`, `bba9a43`, `3823135`, `5a59a0c`, `47326e1`; review fixes `e944375`, `c97d947`, `0659956`, `905f43b`.

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

- [x] Writers can bookmark, rename, and jump from the thread and the Notes tab.
  - Toggle: `WorkshopTurnBubble.test.tsx` ("Bookmark toggle": eligible and ineligible turns, `aria-pressed`, the lock) and `WorkshopApp.bookmarks.test.tsx` ("the bubble toggle").
  - Rename: `WorkshopBookmarkList.test.tsx` (save, cancel, reset, refused labels, focus return), `WorkshopRail.test.tsx` (an open rename survives a tab switch; a new room drops it), `WorkshopApp.bookmarks.test.tsx` ("renames, resets, and removes through the host").
  - Jump: `WorkshopApp.bookmarks.test.tsx` ("focuses an in-window bookmark's bubble…", "focuses a bookmarked writer message…"), with microtasks settled.
- [x] Out-of-window bookmarks and to-do sources open in the read-only preview.
  - `WorkshopApp.turnPreview.test.tsx`: a bookmark, a to-do source and a read-in card row; correlation; focus back to the opener; room and chat-target changes close it.
  - `WorkshopApp.readInProvenance.test.tsx`: "Show where it was read" on an out-of-window card replaces the reader with the preview.
  - Host: `WorkshopRoutes.bookmarks.test.tsx` ("turn preview") and `WorkshopTurnPreview.test.ts` (no host-private field on any path).
  - Correlation: `useWorkshopBookmarks.test.ts`, `useWorkshopContextSheet.test.ts`.
  - Native focus in a real webview: Slice 8's live pass.
- [x] A bookmark added while Notes is hidden badges it, and nothing switches tabs.
  - `useWorkshopRailTabs.test.ts` ("bookmarks on the Notes badge") and `WorkshopApp.bookmarks.test.tsx` ("the Notes badge").
- [x] The epic's per-slice verification passes. Counts are recorded in the epic README's progress notes.

## Built

### Where each piece lives

| Piece | Where |
|---|---|
| Eligibility, one rule | `isWorkshopBookmarkableTurn` moved into `shared/constants/workshopBookmarks.ts` (pure over `role`, `kind`, `participant`). The ledger and the codec import it; the bubble reads the same function. The host stays the authority. |
| Preview contracts | `WORKSHOP_REQUEST_TURN_PREVIEW` `{ requestId, turnId }` → `WORKSHOP_TURN_PREVIEW` `{ requestId, turnId, turn?, error? }`, and `WorkshopTurnPreview`, in `shared/types/messages/workshop/bookmarks.ts`. |
| Preview projection | `application/services/workshop/transcript/WorkshopTurnPreview.ts`: reads a turn only through `projectWorkshopTranscriptTurn`, and copies only `kind`, `speaker`, `content`, `timestamp`, `privateWith`, `truncated`. |
| Preview route | `WorkshopBookmarkHandler.handleRequestTurnPreview`, registered directly (a read, outside the mutation gate). It waits out a room replacement (`waitForSessionOperations` when one is pending), reads `readRoomLedger()`, and logs the turn id and outcome only. `WorkshopRoomHandler` is unchanged. |
| Transport | `hooks/domain/workshop/useWorkshopBookmarks.ts`: the snapshot's summaries, set and rename, and the preview's request id (minted per webview, first reply to the pending id only). Persists nothing. |
| Toggle | `components/workshop/WorkshopBookmarkToggle.tsx`: `<button aria-pressed>`, named by its visible label. Mounted from `WorkshopTurnBubble` in the action row (after Save) and in the writer's footer. |
| Badge | `useWorkshopRailTabs` gains `bookmarks`; a second seen set (by `id`, baseline the room key) adds to `unseenNotesCount`. |
| List | `components/workshop/WorkshopBookmarkList.tsx`, under To-dos in `WorkshopRail`'s Notes panel, keyed by room. |
| Rename state | `hooks/domain/workshop/controllers/useWorkshopBookmarkRename.ts` (tripartite, empty persistence). |
| Preview sheet | Mode `{ kind: 'turn-preview'; turnId; requestId; label? }` in `useWorkshopContextSheet`, sheet key `turn-preview:<requestId>`, closed by the same room-and-chat-target scope key as the reader. Copy in `WorkshopTextSheet`. |
| Jump | `useWorkshopTurnJump.onOutsideWindow(turnId, label?)` opens the preview. `jumpAfterClosing` hands an unrendered turn to it with the reader still open, so the preview replaces the reader in place. |
| Styles | `styles/workshop/shell.css` (toggle and list rules). |
| Tests | `WorkshopApp.bookmarks.test.tsx` (toggle, badge, list) and `WorkshopApp.turnPreview.test.tsx` (the preview), both through the real App. |

### Deviations

- **Preview shape.** The slice doc said `turn?: <projected turn>`. The webview cannot import `application/`, so the message carries `WorkshopTurnPreview`, a named subset of the projected entry. The writer is "You" (the thread's word, as the bookmark default label uses), and a one-line notice is "Session".
- **The preview's narrow subset** leaves out widget, attachment and citation metadata, which would be safe to show. Astra's review did not count it as a finding, and no ordinary flow produces a turn that would preview blank without it, so it stays out of scope.
- **A malformed preview request.** One without a usable `requestId` (missing, empty, over 128 characters) has no sheet to answer, so it reports through `workshop.bookmark`. A bad `turnId` under a good id is answered under that id with the unknown-turn refusal.
- **A writer message now carries its turn id** (`data-workshop-turn-id`, `tabIndex={-1}`), as replies did. Without it a jump to a bookmarked writer message found nothing and fell through to the preview.
- **Remove from the list** (optional in the doc) is built: the only way to clear a bookmark whose bubble is outside the window. It reuses `WORKSHOP_SET_TURN_BOOKMARK`.
- **Meta line.** Summaries carry no turn number, so the meta line names the participant kind ("Host reply", "Your message"), not "turn 12" as the canvas does.
- **Accessible names.** A row is named "{label}: show it in the thread" or "{label}: open it in the reader", and described by its meta line; rename and remove are "Rename bookmark: {label}" and "Remove bookmark: {label}", so each name is unique in the list.
- **The Notes tab** counts bookmarks too: "Notes, 1 open, 2 bookmarks", with the visible count the sum. With none, the name is unchanged.
- **Rename and remove are disabled while the room's lock is held**, like the toggle. The to-do list's actions are not; the lock is the toggle's rule, applied to the same change from the list.
- **The rename field has no `maxLength`.** The shared rule says what is wrong ("at most 80 characters") instead of silently cutting a paste.
- **The identity color** goes through a custom property (`--pm-ws-bookmark-identity`) that `.pm-ws-bookmark-icon` reads. jsdom drops `var()` in an inline `color`, so the property is also what the test can see.
- **Export.** No rule moved to the mirrored layer: the thread's mark is the action row's pressed toggle, which export never renders. `WorkshopTranscriptHtmlBookmarkStyles.ts` now says so.
- **Rewind.** Neither its confirmation nor its result names removed to-dos (only the host's log line counts them), so neither names removed bookmarks.

### PR #189 review fixes (`e944375`, `c97d947`)

- **F-01: a rename waits for its answer.** `WORKSHOP_RENAME_BOOKMARK` gains `requestId`. `WORKSHOP_RENAME_BOOKMARK_RESULT` answers it: accepted, or refused with the host's reason, the session-operation gate's refusal included. The field holds the submitted draft, "Saving…", until then. Accepted closes it; refused gives the draft back with the reason. With a request id, a refused rename shows in the field, not on the room's error banner.
- **F-02: a preview is bound to its room.** The request carries the snapshot's `roomRevision`. The host waits while any session operation is pending, then refuses ("The room changed…") when the room is another. The webview drops a reply naming another room, or arriving once its room is off screen. `WorkshopSessionService.readRoomRevision()` is the one-line read it compares against.
- **N-01 (P3): the preview names who heard a private exchange** (`c97d947`). It uses the bubble's wording, through `workshopPrivateThreadLabel`. Witnessed through the real route and App past the 200-turn window in `WorkshopApp.bookmarkHost.test.tsx`.
- **Tests.**
  - `WorkshopApp.bookmarkHost.test.tsx`: the real App bridged to the real host routes.
  - `WorkshopTurnPreviewRoomBinding.test.ts`: the real coordinator and store.
  - `WorkshopApp.turnPreview.test.tsx`: the observed message order.
  - The ledger is in [the review](../../../../docs/pr-reviews/pr-189-workshop-wayfinding-bookmarks-ui-review.md#author-response).

### PR #189 re-review fixes (`0659956`, `905f43b`)

- **F-03: one rename at a time, bound to its row.** The pending rename records `{ requestId, bookmarkId, draft }`, and its answer applies only to that row's open field. While it waits, other rows' Rename buttons are disabled, with the title "Wait for the rename in progress to finish".
  - **Escape while a rename is pending** closes the field and abandons the request. The late answer is dropped and touches no row; the next snapshot shows whatever the host kept. The writer's choice to leave wins over waiting.
- **F-04: a failed Open publishes the restored room.** Rollback re-hydrates the room it left under a new revision, which only moves forward, so the Open failure path now posts the snapshot as New, Rewind and Branch's already did. Without it, every preview after a failed Open was refused as "the room changed".
  - *Deviation from the coordinator's suggestion.* The coordinator's `replaceLiveRoom` posts nothing, so the fix sits in the handler beside its three siblings rather than in the shared failure path.
- **Tests.**
  - F-03: `WorkshopApp.bookmarkHost.test.tsx`.
  - F-04: `WorkshopTurnPreviewAfterFailedReplacement.test.ts`.
  - The ledger is in [the review](../../../../docs/pr-reviews/pr-189-workshop-wayfinding-bookmarks-ui-review.md#author-response-re-review).

### Follow-ups

- None filed. Slice 8's live pass should check the preview's focus in a real webview (open, Escape, and "Show where it was read" on an out-of-window card), and the toggle's pressed look in both themes.

# Slice 4: Bookmarks on the Host

**Epic:** [Workshop Wayfinding](README.md)
**Decision:** [ADR 2026-11-03](../../../docs/adr/2026-11-03-workshop-wayfinding.md), D5, D6, D9, and D10 (bookmarks)
**Status:** Done. Merged into the epic through PR #188 (`356c751`) after Astra's re-review resolved F-01 ([review](../../../docs/pr-reviews/pr-188-workshop-wayfinding-bookmarks-host-review.md)). Built in `1ed59f5`, `9f3b261`, `b476e99`, `c72906d`, `c813fb4`, `852e023`, `87c089a`; review fix `5d0b5fc`.

## Outcome

The host owns the room's bookmarks. The writer can set or clear a bookmark on an
eligible turn and rename one. Bookmarks persist with the session and follow New,
Open, Rewind, and Branch. The snapshot carries bookmark summaries in thread
order, including bookmarks outside the window, and transcript export marks
bookmarked turns. Nothing in the webview uses them yet.

## Since Slice 3

Slices 3 and 6 added the epic's first persisted fields, and their reviews
settled how a host-owned addition should be built.

- **Optional fields, written only when present.** Slice 6's turn `model` and
  Slice 3's row provenance are both optional keys. The strict codec accepts
  them, validates them, and writes them only when they are present.
  - Bookmarks follow the same rule: a session without them reads and saves
    byte for byte. Use a released-shape fixture beside
    `workshop-session-v1-released.json` and
    `workshop-session-v2-read-in-before-provenance.json` in
    `__tests__/fixtures/`.
  - Refuse a key on a record that can't legitimately carry it. Slice 3's
    F-02 fix made the codec refuse `sourceFingerprint` on writer-source rows.
- **Keep the codec in its own module.** `WorkshopSessionStateV1Shape.ts` is
  already 1,055 lines. Slice 6 kept the stamp's codec in
  `WorkshopTurnModel.ts`, and Slice 3 kept the row logic in
  `ContextSourceRecord.ts`. Put the bookmark entry validation beside the
  ledger, or in its own codec module, and only call it from the shape file.
- **The dangling-turn drop is a checkpoint normalization**, per ADR
  2026-07-30. It goes in `WorkshopSessionCheckpointNormalization`, is named,
  is logged without content, and has a regression test. It is not a version
  migration.
- **One projection to the webview.** Slice 3's F-02 was a host field reaching
  `WORKSHOP_SESSION_STATE` through a second path that skipped the projection.
  - The stored `WorkshopTurnBookmark` (with `createdAt`) and the projected
    `WorkshopBookmarkSummary` are different shapes.
  - Every snapshot post goes through the one projection in `getSnapshot()`:
    route replies, whole-room operations, hydration.
  - Test it through the real routes, the way
    `WorkshopWriterSourcePrivacy.integration.test.ts` does, not only on the
    ledger.
- **`inWindow` is the snapshot's own window.** Slice 5 jumps through
  `useWorkshopTurnJump` (Slice 3), which shows the outside-window notice for a
  turn the thread doesn't hold. Compute `inWindow` against exactly the turns
  the same snapshot sends, so Slice 5 can trust it without re-deriving it.
- **Large files grow only by a seam.** `WorkshopSessionService` is 2,562
  lines, `WorkshopRoomHandler` 1,597, and `WorkshopSessionRewind` 555.
  - The ledger, its label default and its eligibility rule live in
    `session/WorkshopBookmarkLedger.ts` (and a sibling, if needed).
  - The routes live in their own owner (`WorkshopBookmarkHandler`, beside
    `WorkshopTodoHandler`), wired through `WorkshopSliceComposition`.
  - The big files get only the calls into them.
- **Astra checks** for:
  - exact-head verification;
  - host-private data on every path to the webview;
  - codec strictness and fixtures;
  - whole-room operations (New, Open, Rewind, Branch) through the
    coordinator's transaction;
  - the mutation gate.

  See the PR #186 and PR #187 reports in `docs/pr-reviews/`.

## Build

### Contracts

Create `shared/types/messages/workshop/bookmarks.ts`, exported through the
Workshop subdomain barrel and `@messages`:

- `WorkshopTurnBookmark`: `{ id, turnId, label?, createdAt }`, the host-stored
  shape.
- `WorkshopBookmarkSummary`: `{ id, turnId, label, participant, personaId?,
  toolId?, inWindow }`. The label is already resolved, meaning either the
  writer's or the deterministic default.
- **`WORKSHOP_SET_TURN_BOOKMARK`** `{ turnId, bookmarked: boolean }`.
- **`WORKSHOP_RENAME_BOOKMARK`** `{ bookmarkId, label: string | null }`, where
  `null` restores the default.
- `WorkshopSessionSnapshot` gains `bookmarks: WorkshopBookmarkSummary[]`.

### Ledger and aggregate

- `session/WorkshopBookmarkLedger.ts` (new), modeled on `WorkshopTodoLedger`:
  - host-generated ids and defensive copies;
  - `set(turnId, bookmarked)` is idempotent, with one bookmark per turn;
  - `rename(id, label | null)`: the label is trimmed, a single line, at most 80
    characters; a blank label means `null`;
  - `pruneTo(turnIds)` keeps only bookmarks whose turn still exists;
  - the label default is a pure function of the turn: the participant label
    plus the first line of content, whitespace collapsed, cut at 60 characters
    with `…`.
- Eligibility is checked host-side. Eligible: agent replies, writer messages,
  tool reports, capability cards. Dividers and session or standing-directive
  markers are refused. A refusal is logged without turn content and changes
  nothing.
- `WorkshopSessionService` owns the ledger, and `getSnapshot()` projects the
  summaries in turn order with `inWindow`.

### Routes

- A route owner in the Workshop feature family serves the two messages. Use an
  existing owner if one fits (for example `WorkshopSessionMessageHandler`);
  otherwise add `WorkshopBookmarkHandler`, following the sibling construction in
  `WorkshopSliceComposition` and the module-boundary rules from ADR 2026-08-03.
- Mutations join the room's mutation gate like to-do actions do, and post the
  updated snapshot the way to-do changes do.

### Persistence (D9)

- Session state gains optional `bookmarks`. Validate it in
  `WorkshopSessionStateV1Shape`: each entry's keys and types, ids unique, and
  `turnId` naming an existing turn. A dangling `turnId` is dropped and logged
  as a named checkpoint normalization; it's not an error.
- Write the key only when it's non-empty. Update checkpoint equality and
  recovery equality.
- **Fixtures:** a saved session without `bookmarks` loads with none and saves
  without the key.

### Whole-room operations (D6)

- **New:** clears.
- **Open:** loads.
- **Rewind:** prunes inside `rewindWorkshopSession`, the one transform that
  cuts a room.
- **Branch:** keeps bookmarks up to the cut and never writes the source file.
- All four go through the coordinator's room-replacement transaction, never
  hand-rolled.

### Export and recall (D10)

- `projectWorkshopTranscript` marks bookmarked turns.
- JSON export gains `bookmarked: true` on those turns, with `formatVersion`
  unchanged.
- Markdown and HTML show a marker. In HTML, follow the mirror rules: export-only
  rules live in the page layer.
- Recall's renderers don't show the field; a test pins this.

## Tests

- **Ledger:** set, unset, idempotence, rename rules, the default label, pruning.
- **Aggregate:**
  - Ineligible turns are refused.
  - Summaries come in thread order with the correct `inWindow` when the window
    truncates.
- **Codec:** round-trip, a session without the key, a dangling turn dropped
  with a logged normalization, duplicate ids rejected.
- **Whole-room:** New clears, Rewind prunes after the cut, Branch keeps up to
  the cut and leaves the source untouched, Open loads.
- **Routes:** messages reach the ledger, inside the gate, and post a snapshot.
- **Export:** JSON, Markdown, and HTML carry the mark; recall doesn't.
- **Prompt isolation:** room frames and the prompt builder include no bookmark
  data.

## Completion Criteria

- [x] Bookmarks can be set, cleared, and renamed through messages, and persist
      with the session. *(`WorkshopRoutes.bookmarks.test.ts`,
      `WorkshopSessionBookmarks.test.ts`, `WorkshopBookmarkCodec.test.ts`)*
- [x] New, Open, Rewind, and Branch each handle bookmarks as D6 says, with
      tests. *(`WorkshopBookmarkWholeRoom.test.ts`, real coordinator and store)*
- [x] Sessions without bookmarks are unchanged on read and write.
      *(`WorkshopBookmarkCodec.test.ts`, "a session saved before Slice 4",
      over `workshop-session-v2-before-bookmarks.json`)*
- [x] Export marks bookmarked turns; recall and prompts don't carry them.
      *(`WorkshopTranscriptBookmarks.test.ts`,
      `WorkshopTranscriptRecallBookmarks.test.ts`)*
- [x] The epic's per-slice verification passes. Counts are recorded. *(At
      `87c089a`: 620 suites / 8,796 tests / 59 snapshots; see the epic
      README's progress note.)*

## Built

Commits on `epic/workshop-wayfinding-slice-4-bookmarks-host`, after `dc5ed54`:

| Commit | What |
|---|---|
| `1ed59f5` | Contracts (`workshop/bookmarks.ts`), the shared label rule (`shared/constants/workshopBookmarks.ts`), `session/WorkshopBookmarkLedger.ts` |
| `9f3b261` | The aggregate seam, session state's optional `bookmarks`, its codec (`session/WorkshopBookmarkRecords.ts`), the dangling-bookmark normalization, the pre-bookmark fixture |
| `b476e99` | `WorkshopBookmarkHandler` and its two routes behind the mutation gate |
| `c72906d` | Rewind's prune in `rewindWorkshopSession`; whole-room tests through the real coordinator |
| `c813fb4` | Export marks bookmarked turns; recall and prompt isolation witnesses |
| `852e023` | Lint: the slice's avoidable warnings removed |
| `87c089a` | The room handler's seam witness counts the two new routes |
| `5d0b5fc` | PR #188 F-01: bookmark ids bounded to canonical safe integers (`WorkshopBookmarkIdBounds.test.ts`) |

### Where each piece lives

- **Contracts.** `shared/types/messages/workshop/bookmarks.ts`:
  `WorkshopTurnBookmark` (stored), `WorkshopBookmarkSummary` (projected),
  `WORKSHOP_SET_TURN_BOOKMARK`, `WORKSHOP_RENAME_BOOKMARK`,
  `WORKSHOP_BOOKMARK_LABEL_CHARACTERS` (80). `WorkshopSessionSnapshot.bookmarks`
  in `session.ts`. Error source `workshop.bookmark`.
- **Label rule.** `shared/constants/workshopBookmarks.ts`
  (`checkWorkshopBookmarkLabel`, `isStoredWorkshopBookmarkLabel`), shaped like
  `lightboxBoardName.ts`, so Slice 5's field can use the same rule.
- **Ledger.** `session/WorkshopBookmarkLedger.ts`: `set`, `rename`, `pruneTo`,
  `summaries`, prepared hydration; `isWorkshopBookmarkableTurn`;
  `workshopBookmarkDefaultLabel`.
- **Codec.** `session/WorkshopBookmarkRecords.ts`: the shape
  (`assertWorkshopBookmarksShape`), referential integrity
  (`assertWorkshopBookmarkIntegrity`), and `workshopBookmarksWithin` (used by
  the normalization and the rewind transform). The shape, integrity and
  normalization modules only call it.
- **Aggregate.** `WorkshopSessionService`: `setTurnBookmark`,
  `renameBookmark`, `readBookmarkedTurnIds`; the projection in `getSnapshot()`;
  reset; export/hydrate; pruning after `rollbackMessageRun` and
  `rollbackToolRun`.
- **Routes.** `handlers/domain/workshop/WorkshopBookmarkHandler.ts`, composed
  in `WorkshopSliceComposition` beside the task list's owner.
- **Whole-room.** New: `reset()`. Open: hydration. Rewind and Branch:
  `rewindWorkshopSession`. All through the coordinator's existing
  transaction; nothing hand-rolled.
- **Export.** `projectWorkshopTranscript` takes `bookmarkedTurnIds` in its
  meta; the export ledger port gains `readBookmarkedTurnIds()`. JSON,
  Markdown, HTML renderers; HTML page rules in
  `export/WorkshopTranscriptHtmlBookmarkStyles.ts`; `bookmark` icon.

### Tests

| Area | File |
|---|---|
| Ledger | `session/WorkshopBookmarkLedger.test.ts` |
| Aggregate | `WorkshopSessionBookmarks.test.ts` |
| Codec | `WorkshopBookmarkCodec.test.ts` (fixture `workshop-session-v2-before-bookmarks.json`) |
| Routes, gate, snapshot privacy | `handlers/domain/workshop/WorkshopRoutes.bookmarks.test.ts` |
| Whole-room | `session/WorkshopBookmarkWholeRoom.test.ts` |
| Export | `export/WorkshopTranscriptBookmarks.test.ts` |
| Recall and prompt isolation | `recall/WorkshopTranscriptRecallBookmarks.test.ts` |

### Deviations

- **Ids carry their number** (`bookmark-<n>-<ms>`), and the codec requires
  that grammar. Since PR #188 F-01, each part must be a canonical decimal from
  1 to `Number.MAX_SAFE_INTEGER` (`parseWorkshopBookmarkId`). Hydration
  installs only a safe counter. A set that would pass the maximum is refused
  as `ids-exhausted`, with no change. There's no persisted counter: hydration resumes numbering past
  every loaded id, and the counter never goes back within an aggregate's
  lifetime. This avoids a new `counters.bookmark` key.
- **The label limit's name** is `WORKSHOP_BOOKMARK_LABEL_CHARACTERS`, not
  `…_MAX_LENGTH`. The prompt-budget guard reads `*_MAX_*` names as prompt
  limits; the Lightbox names its board-name limit the same way.
- **The default label.**
  - It's read through `projectWorkshopTranscriptTurn`, so no host-private
    body can reach it. A capability card is named by its family and request
    summary ("Project Resources · notes/lantern.md"), never its evidence.
  - "First line" is the first line with words on it, with leading Markdown
    block marks (`#`, `>`, list markers) dropped, so a report reads
    "Prose · Summary" rather than "Prose · ## Summary".
  - The writer is "You", as the thread and the canvas say. Export's "Writer"
    is for a shared page.
  - The cut counts code points, ellipsis included, and never splits a
    surrogate pair. With no line, the label is the participant alone.
- **Eligibility.** The writer's direct tool-run request (`tool_request`, "Run
  Prose on the pinned excerpt") is refused. The ADR doesn't list it among the
  eligible turns, and the transcript treats it as an event.
- **What else the codec refuses:** a bookmark on a turn that can't carry one,
  two bookmarks on one turn, and a label not in its stored form. An empty list
  reads as none, and the aggregate writes no key.
- **The dangling-turn drop** is the normalization `dropped-dangling-bookmarks`.
  The raw preflight takes `allowDanglingBookmarks` (beside
  `skipRetainedHistoryMarkIntegrity`). The strict save path refuses a dangling
  bookmark.
- **Live rollback.** A writer turn or tool request that rolls back takes its
  bookmark with it. The slice doc didn't name this path, but without it the
  next save would hold a dangling bookmark and fail strict validation.
- **An unchanged set or rename** posts the snapshot but doesn't mark the room
  dirty.
- **Checkpoint and recovery equality** needed no code change. Both compare the
  whole decoded checkpoint, so a bookmark is writer work in both. The codec
  test pins that a changed, added or removed bookmark is a different
  checkpoint and different recovery content.
- **Export copy.** Markdown ends a heading with "· Bookmarked", and an event
  reads "_Bookmarked · …_". HTML adds a "Bookmarked" span with the icon. The
  thread has no mark to mirror yet, so its rules are export-only page rules in
  their own file. Slice 5 should move the look to the mirrored layer once the
  bubble has one.
- **Recall** is untouched. It reads turns through
  `projectWorkshopTranscriptTurn`, which never carries the mark. Only
  `projectWorkshopTranscript` applies it, and only when its caller names the
  bookmarks.

### Follow-ups

- Slice 5: the bubble toggle, the Notes list, rename, jump, and the
  out-of-window preview. `inWindow` is computed against exactly the snapshot's
  `turns`.
- Rewind's result summary counts removed to-dos but not removed bookmarks.
  Whether the Rewind message should say so is a Slice 5 copy question.

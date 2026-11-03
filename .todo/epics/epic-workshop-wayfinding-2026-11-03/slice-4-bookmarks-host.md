# Slice 4: Bookmarks on the Host

**Epic:** [Workshop Wayfinding](README.md)
**Decision:** [ADR 2026-11-03](../../../docs/adr/2026-11-03-workshop-wayfinding.md), D5, D6, D9, and D10 (bookmarks)
**Status:** Planned (after Slice 3)

## Outcome

The host owns the room's bookmarks. The writer can set or clear a bookmark on an
eligible turn and rename one. Bookmarks persist with the session and follow New,
Open, Rewind, and Branch. The snapshot carries bookmark summaries in thread
order, including bookmarks outside the window, and transcript export marks
bookmarked turns. Nothing in the webview uses them yet.

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

- [ ] Bookmarks can be set, cleared, and renamed through messages, and persist
      with the session.
- [ ] New, Open, Rewind, and Branch each handle bookmarks as D6 says, with
      tests.
- [ ] Sessions without bookmarks are unchanged on read and write.
- [ ] Export marks bookmarked turns; recall and prompts don't carry them.
- [ ] The epic's per-slice verification passes. Counts are recorded.

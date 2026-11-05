# Slice 6c: Personas Propose Edits to a Saved Note

**Status:** In review
**Branch:** `epic/workshop-project-memory-slice-6a-kinds`, fast-forwarded to
`epic/workshop-project-memory` at `2a014cbb`. This session may push only
there.
**Decision:** [ADR 2026-11-04, addendum of 2026-11-05: personas propose edits to a saved note](../../../docs/adr/2026-11-04-workshop-project-memory.md#addendum-2026-11-05-personas-propose-edits-to-a-saved-note)

## Scope

A persona can suggest a change to a note already saved: a new
`memoryProposals` item kind, `proposes: 'edit'`.

- Host code anchors the change against the note, records its version, and
  shows it to the writer as before → after.
- A Save applies it only while the note is still that version.
- An edit always waits for the writer, in every mode.

## The trailer

```xml
<prose-minion-memory-proposal>
  <edit>mem-7f3c2a</edit>
  <find-in-body>the reader notices before Alice does</find-in-body>
  <replace-with>Alice notices first, and says nothing</replace-with>
  <append>The Hatter's watch, by contrast, is always two days slow.</append>
</prose-minion-memory-proposal>
```

It is the same frame tag. `<edit>` names the target and marks the frame as an
edit. The elements are flat, as the decoder already reads them; there are no
attributes or nesting. The operations, in the order written:

- **Rewrite:** `<title>`, `<kind>`, `<summary>` or `<body>` replaces that
  field whole.
- **Replace:** `<find-in-summary>` or `<find-in-body>`, followed at once by
  `<replace-with>`. At most 5 pairs (`PROMPT_BUDGETS…editReplaces`).
- **Append / prepend:** each at most once.

Refused by name:

- `invalid-edit-target`;
- `edit-supersedes`;
- `empty-edit`;
- `unpaired-find`;
- `empty-find`;
- `too-many-replaces`;
- `conflicting-operations`;
- `repeated-element`;
- the field faults;
- `edit-element`: an edit's element in a frame without `<edit>`.

## What changed

### Decoding (`utils/`)

- `workshopMemoryProposalProtocol` now reads a frame's elements in order,
  then hands an `<edit>` frame to the new `workshopMemoryEditProtocol`.
- The field rules moved to `workshopMemoryProposalFields`. Both decoders
  import them there, so neither imports the other.
- The extractor's proposals are new drafts or edit drafts. Duplicates are
  keyed by title for a new note and by target for an edit. An edit counts
  toward the cap of 10.

### Anchoring (`WorkshopMemoryEditAnchor`, pure)

- `findExactlyOnce` counts occurrences, overlapping ones included.
- Every quote is found in the note as it stands, never in text an earlier
  replace wrote. Overlapping quotes are refused, and replaces are applied
  from the last.
- Then prepend and append, with a blank line between passages.
- The result is held to the field rules: `summary-not-one-line`,
  `body-too-long`, `summary-emptied`. An edit that changes nothing is
  `unchanged`.

### Settling (`WorkshopReplyMemoryEdit`)

- Runs against the library's whole listing, which the reply context now
  carries as `memories`.
- The target's standing:
  - `unknown-target` covers unknown, unreadable, set-aside and conflicting
    ids;
  - `archived-target`;
  - `superseded-target`;
  - `busy-target`;
  - `listing-unread`.
- Then the anchor; the phrasing fence on the result; and the pinned budget
  when the note loads in full.
- The item records the target's id, version, load-in-full flag and what it
  replaces, plus `before` and the result.
- Logs carry the target id, the changed field names and operation names.

### Hold

- `WORKSHOP_MEMORY_HOLDS` gains `edit`: "It changes a saved memory, so it
  waits for you to save it."
- It comes after web research and before supersedes and the cap, so it never
  uses a cap place.
- The auto saver's pending check accepts only `proposes: 'new'`, as a second
  guard.

### Session shape (`WorkshopMemoryProposalRecords`)

- `WorkshopMemoryProposal` is the union `WorkshopMemoryNewProposal |
  WorkshopMemoryEditProposal`.
- Validation is strict per kind:
  - the target's id and its 12-hex version;
  - `before` within the field bounds;
  - `stale` only `true`;
  - a saved edit's `memoryId` must be its target.
- Clone per kind. `markMemoryEditStale` is on the session service.

### Save

- `ProjectMemoryWrites.update` takes `expectedVersion`. It is compared at the
  write's turn, and again inside the store's `replace` callback. That reruns
  whenever the bytes it read are not the bytes it claims, so the check holds
  at the commit point.
- A mismatch is refused as `changed`, and nothing is written.
- `pinnedBudget` and `saysSomethingElse` moved to `ProjectMemoryPinnedBudget`,
  which keeps `ProjectMemoryWrites` at 472 lines.

### Handler

- `saveEdit` saves the result, or the sheet's version of it, with the
  recorded version, through `write()`:
  - the existing `updated` receipt names the persona;
  - D14 counts the receipt's version as told;
  - on `changed`, `onRefused` marks the card stale;
  - a stale card's Save is refused without writing.
- The refusal words moved to `WorkshopProjectMemoryRefusals`, so the handler
  stays at 492 lines.

### Webview

- `WorkshopMemoryEditCard` shows the target's title and each changed field as
  `<del>` → `<ins>`. The note's changed region comes from
  `workshopMemoryEditView`: a common prefix and suffix, never splitting a
  surrogate pair, with up to 80 characters of context cut at a word, and the
  region collapsed past 600.
- Actions are Save · Edit… · Dismiss; held is amber with the reason; stale
  shows the message and Dismiss alone.
- Saved: "Updated in project memory: …". Dismissed: "The change to … wasn't
  saved."
- The hook's `editCard` opens the sheet with the result, the note's
  `supersedes` and its load-in-full flag. It sets `memoryId`, so the estimate
  counts the change as an edit of that note, and opens nothing for a stale
  edit.
- Checked by screenshot: pending, held and stale.

### Prompt (`project-memory-proposals.md`)

- When to change a note (refine the same note), replace it (the fact
  changed, and the old one stays on record) or suggest a new one.
- The edit grammar, with a worked example that quotes the first example's
  note.
- Read the note with `memory.read` before quoting; quote exactly; a change
  that can't be quoted exactly is better as a rewrite of that field.

### Housekeeping

- The duplicate `import './styles/workshop/memory.css'` in `WorkshopApp.tsx`
  is removed. `workshopStyles.test` had pinned the duplicate; the bundler
  loads a module once, at its first import, so the cascade is unchanged.
- The duplicated `jest.mock` of `memory.css` is removed in 20 WorkshopApp
  test files.

### Docs

The ADR addendum, the epic README row, and two lines in
`slice-6-verify-live.md`.

## Deviations and choices

- **A rewritten field takes no other operation.** Mixing a rewrite with a
  replace or append in the same field is refused as
  `conflicting-operations`. Every quote then anchors against the note as it
  stands, and "applied in sequence" reads as: in the order written, against
  the original field, never overlapping.
- **Quotes are trimmed.** Leading and trailing space in `find` and `with` is
  trimmed, as every trailer field is. `find` must hold something; `with` may
  be empty, which deletes the quote.
- **The body is anchored trimmed.** It is anchored as the card and sheet
  show it. The library keeps a note's own bytes for a body it doesn't
  change.
- **The file bound.** The field bounds imply the 256 KiB file bound (PR #194
  F-05), so settling doesn't encode the file. The store's
  `prepareProjectMemoryFile` checks it again at commit.
- **The sheet's Save** from an edit card goes through the same
  version-checked path, not the unchecked `WORKSHOP_MEMORY_UPDATE`. A stale
  note is never overwritten from a stale sheet.
- **Save is hidden on a stale card**, as well as Edit: it could only fail
  again.
- **The never-list** applies to the result's text as it does to a new note's.
  The writer's own existing text is read too: a note already holding a
  fenced word can't be edited by a persona, only by the writer.

## Tests

- `WorkshopMemoryEdit.test.ts` (pure):
  - every operation in order;
  - each decode refusal, and the replace cap exactly;
  - `edit-element`;
  - a duplicate edit, and an edit counting toward the cap;
  - 0, 1 and 2 matches, counted overlapping;
  - sequenced replaces, and no anchoring in written text;
  - overlaps;
  - rewrite, prepend and append;
  - the result's field rules and `unchanged`;
  - every target standing;
  - the fence on the result;
  - the pinned budget;
  - the `edit` hold beside an auto-saved new note;
  - logs without text.
- `ProjectMemoryEditSave.test.ts` (real store):
  - a matching version writes;
  - changed before the turn writes nothing;
  - changed between the turn and the commit writes nothing. With the check
    under the claim disabled, this test fails;
  - newly superseded;
  - workspace binding;
  - an unversioned update unchanged.
- `WorkshopProjectMemoryEditRoutes.test.ts` (real router):
  - the card, then Save, with the `updated` receipt naming the persona, its
    version equal to the listing's, and D14 counting it as told;
  - auto mode held, pending, nothing written;
  - a stale refusal, a second Save refused, Dismiss, nothing written;
  - the sheet's edited Save;
  - an unknown target logged.
- `workshopReplyControls.test.ts`: edit frames stripped beside a new note,
  with memory off and malformed, and at every streaming prefix.
- `WorkshopMemoryTurns.test.ts`: an edit item round-trips byte for byte and
  hydrates, and seven shape refusals.
- `WorkshopMemoryEditCard.test.tsx`:
  - the view's fields and body region, context cut, collapse and surrogates;
  - the card's before → after, actions by index, collapse, held, stale and
    settled lines;
  - the sheet prefill, estimate `memoryId` and submit index;
  - a stale edit opening nothing.
- `projectMemoryProposalPromptSync.test.ts`:
  - 2 examples, the edit example decoding to its operations;
  - the quote anchoring in the first example's body;
  - `editReplaces` pinned;
  - the teaching lines;
  - every edit element taught.
- `promptBudgets.test.ts` pins `editReplaces: 5`.

## Verification

See the coordinator message for counts.

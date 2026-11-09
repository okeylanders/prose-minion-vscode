# PR #248 Review: Message Reactions Slice 3b (corner reaction button)

**PR:** #248, `epic/workshop-message-reactions-slice-3b-reaction-corner` → `epic/workshop-message-reactions`
**Reviewed head:** `415bc32a` (base `3b8b0902`)
**Scope:** Okey's redesign of the reaction UI, presentation only (ADR D8, Slice 3b note).
**Reviewers:** the epic's coordinator and an independent review pass. No blocking defect found.

## Resolution ledger

| ID | Severity | Finding | Decision | Resolution |
|---|---|---|---|---|
| M1 | Medium | A fast double click can remove a reaction the writer never aimed at | Fix | |
| L1 | Low | The corner adds about 44px under every reactable persona reply | Fix (spacing) | |
| L2 | Low | Screen readers hear each reaction twice (title ≠ name) | Fix | |
| L3 | Low | The palette's side is chosen once and can clip after the thread scrolls | Fix | |
| L4 | Low | A refused removal leaves its focus hand-off armed | Fix | |
| T1 | Test | No test for double activation, or for clicking a reaction while the palette is open | Fix | |

## Findings

### M1. A fast double click can remove a reaction the writer never aimed at

`WorkshopTurnReactions.tsx`, `reactions.css`

The cluster is right-aligned, so when an item is removed, the items to its left slide under the pointer.

A double click on Jill's heart therefore posts a second Hide, or removes the reaction that slid into place. A persona's reaction cannot be restored from the webview.

**Fix.** After a removal, ignore activations on that corner until the next snapshot changes its keys. Add a test that a double click posts once.

### L1. The corner adds about 44px under every reactable persona reply

`reactions.css` (`margin-top: 8px`), plus the turn's flex `gap: 8px`.

The button is always shown, so every persona reply grows by 16px of space plus the 28px button.

**Fix.** Drop the extra margin, since the gap already spaces the row. Whether the corner should share the action row's line is a layout question for Okey. That change isn't made here.

### L2. Screen readers hear each reaction twice (title ≠ name)

`WorkshopTurnReactions.tsx`

An unlocked item's `title` ("…Remove your fire") differs from its name ("…Remove"), so it becomes a description and is read as well.

**Fix.** Make the unlocked title equal to the name, or leave it off. Keep the locked title.

### L3. The palette's side is chosen once and can clip after the thread scrolls

`WorkshopReactionPalette.tsx`

The palette picks its side when it opens. If a streaming reply then scrolls the thread, the palette can end up clipped.

**Fix.** Close the palette when the thread scrolls (or re-place it), returning focus to the button only if focus was inside the palette.

### L4. A refused removal leaves its focus hand-off armed

`WorkshopTurnReactions.tsx`

When the host refuses a removal, `pendingFocus` stays set. A later removal of the same key can then pull focus.

**Fix.** Clear the pending hand-off on any snapshot that keeps the key.

### T1. No test for double activation, or for clicking a reaction while the palette is open

Add tests for both.

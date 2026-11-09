# PR #248 Review: Message Reactions Slice 3b (corner reaction button)

**PR:** #248, `epic/workshop-message-reactions-slice-3b-reaction-corner` → `epic/workshop-message-reactions`
**Reviewed head:** `415bc32a` (base `3b8b0902`)
**Scope:** Okey's redesign of the reaction UI, presentation only (ADR D8, Slice 3b note).
**Reviewers:** the epic's coordinator and an independent review pass. No blocking defect found.

## Resolution ledger

| ID | Severity | Finding | Decision | Resolution |
|---|---|---|---|---|
| M1 | Medium | A fast double click can remove a reaction the writer never aimed at | Fix | Fixed. A removal records the snapshot list it was asked against (`removingFrom`). Further presses on that corner are ignored until the host's next snapshot of the bubble's reactions, which is a new list identity. That covers a refusal too, so the corner never stays locked. `NO_TURN_REACTIONS` gives a turn with no reactions one stable list. Test: a double click (Jill's heart, then the reaction that slid under the pointer, then Jill's again) posts one Hide, and the next snapshot re-arms the corner. |
| L1 | Low | The corner adds about 44px under every reactable persona reply | Fix (spacing) | Fixed. Dropped the corner's `margin-top`; the turn's flex `gap` spaces it. No other layout change. The after-captures were regenerated and are 8px tighter. |
| L2 | Low | Screen readers hear each reaction twice (title ≠ name) | Fix | Fixed. An unlocked reaction's `title` is its accessible name ("Jill reacted: heart. Remove"). The locked title stays. The cluster test pins it. |
| L3 | Low | The palette's side is chosen once and can clip after the thread scrolls | Fix | Fixed. While the palette is open, a scroll of its clipping ancestor (the thread, else the window) closes it. Focus returns to the + only when it was inside the palette. Option focus uses `preventScroll`, so a focus move never scrolls and closes the palette. Test covers both: focus inside goes to +; focus on + is not moved. |
| L4 | Low | A refused removal leaves its focus hand-off armed | Fix | Fixed. The hand-off effect runs on every new snapshot of the bubble's reactions and clears `pendingFocus` whether or not the key went. Test: a refused removal, focus dropped, then a later removal from elsewhere leaves focus on body. |
| T1 | Test | No test for double activation, or for clicking a reaction while the palette is open | Fix | Fixed. Added tests for a double activation (M1), a refusal that re-arms (L4), clicking a reaction while the palette is open (it closes; one post; focus to + after the snapshot), and the scroll close (L3). |

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

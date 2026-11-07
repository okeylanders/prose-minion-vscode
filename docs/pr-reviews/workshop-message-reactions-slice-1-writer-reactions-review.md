# PR #245 Review: Message Reactions Slice 1 (writer reactions)

**PR:** #245, `epic/workshop-message-reactions-slice-1-writer-reactions` → `epic/workshop-message-reactions`
**Reviewed head:** `1d1b72eb` (base `968c8f0d`)
**Spec:** [ADR 2026-11-07](../adr/2026-11-07-workshop-message-reactions.md), D1, D2, D3, D7, D8
**Reviewers:** the epic's coordinator, with an independent review pass that did not start from the coordinator's reading.

## Resolution ledger

| ID | Severity | Finding | Decision | Resolution |
|---|---|---|---|---|
| M1 | Medium | Integrity accepts persona reactions the ADR forbids | Fix | `d8d74c3e`: the via reply must be the persona's first reply after `turnId`, with no writer room message between; a second persona reaction per `viaTurnId` is refused in the shape. Codec cases for both, plus a pure integrity table. |
| M2 | Medium | The host does not refuse a reaction while a run is active | Fix | `d97459ba`: both routes refuse while a response or the context wizard runs (`isRoomBusy`, the webview's lock checked again), `reason=run-active`. Route test with a held reply. |
| L1 | Low | Up/Down in the palette doesn't follow the visual grid | Fix | `4f7c6393`: Up/Down by row and column within each group, into the adjacent group's same column, clamped; table test against the real 10/3/6. |
| L2 | Low | Pressing a writer chip drops keyboard focus to `<body>` | Fix | `4f7c6393`: a removed chip that held focus hands it to the next chip, else Add reaction. A lock closes the palette and refocuses its button; the button and chips are `aria-disabled` (focusable) while locked. |
| L3 | Low | Tab leaves the palette open, and Escape is then dead | Fix | `4f7c6393`: focusout to anywhere outside the palette and its button closes it, without taking focus back. |
| L4 | Low | The upward popover may be clipped on top-of-thread bubbles | Live pass | Live pass (Slice 4). |
| L5 | Low | Test gaps (rollback, session-op gate, `unchanged` not dirtying) | Fix | `d97459ba`, `4f7c6393`: aggregate rollback tests (`rollbackMessageRun`, `rollbackToolRun`); the session-op gate refusing all reaction routes (one predicate covers Open, Rewind, Branch, New); persona chips on a writer bubble. `unchanged` not dirtying was already covered (add and remove, `WorkshopRoutes.reactions`). |
| N1 | Nit | No `roomRevision` on reaction routes | Defer | Deferred. |
| N2 | Nit | Every snapshot rebuilds the reactions map and re-renders all bubbles | Tech debt | Filed `.todo/tech-debt/2026-11-07-workshop-snapshot-maps-rebuilt-per-snapshot.md` (reactions and bookmarks). |
| N3 | Nit | Q10 narrowing for Slice 3's reaction-only reply needs a tracked note | Fix (note) | Noted in the epic README's Slice 3 row. |
| N4 | Nit | Hide as its own route | Accepted as is | No change |

## Verification at `1d1b72eb` (coordinator's own run)

- `npm run typecheck`: clean. `npm run lint`: exit 0.
- `npx jest`: recorded in the PR thread once it finished.

## Findings

### M1. Integrity accepts persona reactions the ADR forbids

`WorkshopReactionRecords.ts`, `assertWorkshopReactionIntegrity` (around line 168).

The check requires only that `viaTurnId` names a later `persona_message` by the same persona. ADR D2 and D5 say more:
- A persona reacts only to the writer message *its reply answers*.
- It reacts at most once per reply.

As written, a host reply at turn 20 can carry a reaction on the writer message at turn 2, along with three more reactions through the same reply, and the file decodes clean. Slice 3 writes these entries, so tightening the rule after it would need a normalization or a migration.

**Fix:**
- The via reply must be that persona's first reply after `turnId`, with no later writer room message between them.
- A second persona reaction with the same `viaTurnId` is refused.
- Add codec cases for both.

### M2. The host does not refuse a reaction while a run is active

`WorkshopSliceComposition.ts` (the reaction routes' gate checks only `isSessionOperationPending`) and `WorkshopReactionHandler`.

Only the webview's `roomMutationLocked` keeps a reaction out during a run. A click posted just before the webview sees `isRunning`, or a post from a stale webview, lands mid-run. That is harmless in Slice 1. In Slice 2, though, D4/D6 deliver "reactions standing now, not in its fold", and a reaction committed while the frame is being built could be recorded against the wrong reply.

**Fix:** refuse with a host reason while a run is active, matching the webview's lock. Add a route test.

### L1. Up/Down in the palette doesn't follow the visual grid

`WorkshopReactionPalette.tsx`.

Up and Down move ±5 through the flat order, but each tone group is its own 5-column grid with 10, 3 and 6 items. Some examples:
- Down from *thinking* lands on *grimace*, not *thumbs down*.
- Down from *hundred* skips the curious row.

**Fix:** move by row and column within a group, clamping into the next group's same column. Test it against the real group sizes.

### L2. Pressing a writer chip drops keyboard focus to `<body>`

`WorkshopTurnReactions.tsx`.

The chip unmounts when the next snapshot arrives. The same happens when the lock engages while the palette is open: it closes without returning focus, and the trigger is disabled.

**Fix:**
- After a removal, move focus to the next chip, or to the bubble's "Add reaction" button when none are left.
- When the palette closes on lock, return focus to its button.

### L3. Tab leaves the palette open, and Escape is then dead

`WorkshopReactionPalette.tsx`.

With roving tabindex, Tab moves focus out of the `role="dialog"` popover, which stays open. Escape then does nothing, because the key handler is on the palette.

**Fix:** close when focus leaves the palette (`focusout` with a `relatedTarget` outside it), without stealing focus back.

### L4. The upward popover may be clipped on top-of-thread bubbles

`reactions.css`: `bottom: calc(100% + 6px)`, about 260px tall. This is plausible and not yet verified. It goes to the live pass (Slice 4) for a visual check. Add a flip-down rule if it clips.

### L5. Test gaps

Add tests for:
- `rollbackPersonaRun` / `rollbackToolRun` pruning reactions, at the aggregate level rather than only in `ledger.pruneTo`;
- the session-operation gate refusing a reaction during Open, Rewind or Branch;
- the webview drawing persona chips on a writer bubble;
- an `unchanged` add or remove not calling `markDirty`.

### N1. No `roomRevision` on reaction routes

Turn ids embed a timestamp, so a post can reach another room only after Rewind or Branch, where the id names the same turn. This matches bookmark set. **Deferred:** revisit if a later slice gives a reaction model-facing effects on a replaced room.

### N2. Every snapshot rebuilds the reactions map and re-renders all bubbles

`useWorkshopReactions.ts` builds a new `Map` on every snapshot. Bookmarks share this cost. **Tech debt:** file it under `.todo/tech-debt/`, covering both.

### N3. Q10 narrowing for Slice 3's reaction-only reply needs a tracked note

`isWorkshopReactableTurn` already says that Q10 must narrow it once reaction-only replies exist. Record that in the epic README's Slice 3 row, so that the predicate and the integrity rule tighten together.

### N4. Hide as its own route

Accepted. `personaAuthorOf` refuses a writer author.

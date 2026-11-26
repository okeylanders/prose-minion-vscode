# Workshop Tabs: Epic-Review Follow-ups

**Date Identified**: 2026-11-26
**Reviewed**: 2026-11-26
**Status**: Identified
**Priority**: Medium (item 1), Low (the rest)
**Estimated Effort**: Item 1 is about a day. Each of the rest is a small patch with a test.

## Context

These came from the epic-level review of
[PR #312](https://github.com/okeylanders/prose-minion-vscode/pull/312) (`epic/workshop-tabs` into `main`).
None loses writer data or breaks the close and flush guarantees in
[ADR 2026-11-25](../../docs/adr/2026-11-25-workshop-tabs.md) D3a, so none
blocked the merge. Item 1 is a regression from `main` and should be fixed first.

## 1. A stale rolling lock leaves the primary room stuck in recovery (Medium)

**Evidence.** `writeCurrent` now holds `withRollingLock` on
`.current.json.lock/` (`WorkshopSessionStore.ts`, `writeCurrent`). On `main`,
`current.json` had no lock. If VS Code crashes while the lock is held, the
lock outlives its lease and reads `recovery-required`. Nothing removes it:

- `recoverRollingRoom` copies the slot into a new room and never moves or
  removes the lock (`WorkshopNamedSessionLock.rollingClaim`).
- The registry offers that copy only for secondary rooms (`secondaryRoom` in
  `WorkshopRoomRegistry.ts`). The primary room gets no Recover… at all.

**Effect.** Every later autosave of the primary unsaved room fails with
`WorkshopRollingCheckpointRecoveryRequiredError`. The coordinator then writes
the work to a "(local recovery)" session (`markDirty` → `recoveryCopy.keep`).
The save status stays on error, and each reload hydrates the stale
`current.json`. No work is lost. The only fix today is deleting
`prose-minion/sessions/.current.json.lock/` by hand. The window is small (the
lock is held only during a write), but autosave runs after every mutation.

**Smallest credible fix.** Give rolling slots the named-session Recover… path
from D6e: an explicit, confirmed restore that settles a `recovery-required`
rolling lock after the copy. Offer it for the primary room on the save-error
notice. Never add an automatic takeover (D6e).

## 2. `presence.enter` throwing escapes room creation and restore (Low)

`WorkshopRoomRegistry.ts` (`acquire`, about lines 228 and 242) and
`WorkshopPanelProvider.deserializeWebviewPanel` (about line 356) both reach
`presence.enter`, which can throw synchronously
(`WorkshopRoomPresenceUnavailableError`, or busy during another window's
delete). There are two effects:

- On restore, the throw escapes the serializer and leaves a blank editor.
- On a fresh room, the services `this.build(roomId)` created are never
  released.

Catch the error, release what was built, and show the writer a notice.

## 3. A failed hydration reports itself as a failed save (Low)

When hydration rejects, the registry entry is deleted, and `finishClose` then
rejects on `room.hydrated`. The writer sees "could not finish saving" for a
room that never loaded. Report a hydration failure in its own words.

## 4. The shutdown error path uses the raw output channel (Low)

`WorkshopPanelProvider.ts` (about lines 433–435) calls `outputChannel.appendLine`
and `showErrorMessage` during shutdown. The store uses the
`workshopPersistenceLog` wrapper instead. If VS Code has already closed the
channel, the raw call throws, and the result is an unhandled rejection. Route
it through the wrapper.

## 5. Reopen Closed Room can list a restored editor that is not yet revived (Low)

`reopenClosedRoom` (`WorkshopPanelProvider.ts`, about line 215) filters out
only attached tabs. A native editor that VS Code has restored but not yet
revived can be listed and opened a second time. When that editor revives, it
gets a fresh, empty room. Apply the same `nativeRoomsKnown` guard that Unsaved
Sessions uses.

## 6. A room kept after a failed close holds its named session with no tab (Low)

Opening that session from another tab's browser gets
`WorkshopSessionOwnedError`, and `revealWorkshopRoom` returns false. Only the
sidebar's recent-session path (`retainedNamedRoom`) reaches the room again. Let
the browser's Open reattach the kept room the same way.

## 7. A Lightbox tile can read "staged" after the room was replaced (Low)

`room-changed` is now one of `LOST_ANSWERS`, and the reconciliation reads the
captured tab's receipt. If New or Open replaces the room after the host
commits the tile but before the webview answers, the Lightbox says "staged",
but the tile left with the old room. In the other direction, a tab that is
already closed skips its receipt (`WorkshopPanelTab` transport returns early
when closed), which gives a false refusal. Either is a wrong message, not
corrupted data.

## Completion criteria

- Item 1: a witness test crashes mid-write (the lock stays), reloads, and
  recovers the primary room through the explicit path.
- Items 2–7: each fixed with a regression test, or recorded here as accepted.

# Workshop memory Rename overwrites fields it never touched

**Status:** Open
**Priority:** Low
**Found in:** Workshop Project Memory Slice 4b-wire (PR #202 review, Astra's note)

## Problem

The memory manager's Rename reuses Slice 3's edit path. It requests the
memory's current draft, changes the title, then writes the whole draft back
through `ProjectMemoryWrites`' update. If another window edits the same
memory's summary, kind or body between the read and the write, Rename writes
the older values back and the other window's edit is lost. Last write wins.

Always load in full and Delete avoid this because each is a single claimed
write of one field. Rename can't simply copy `setPinned`. A title change
writes a D7 receipt (the room hears "updated"), so a title-only write
belongs on the receipt path, not on the manager's direct routes.

This is disclosed in `slice-4b-2-wire.md` (deviation 3). It is rare in
practice, since it needs two windows editing one memory within the same
moment.

## Related files

- `packages/core/src/application/services/workshop/memory/ProjectMemoryWrites.ts`
  (`update`, `setPinned`)
- `packages/core/src/application/handlers/domain/workshop/WorkshopProjectMemoryHandler.ts`
  (request-edit and update, the receipt path)
- `packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopMemoryManager.ts`
  (Rename's read-then-write)
- `docs/adr/2026-11-04-workshop-project-memory.md` (D7 receipts)

## Completion criteria

- Rename changes only `title` (and `updated`), read and written under the
  store's claim, and records its receipt as an edit does.
- A test edits the body in a second window between Rename's open and its
  save, and the body edit survives.

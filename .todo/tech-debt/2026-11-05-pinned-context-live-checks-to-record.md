# Pinned Context: record the live checks not yet reported

- **Status:** Open.
- **Priority:** Low.
- **Source:** the Pinned Context live pass (Slice 5, 2026-11-05). Okey reported
  the feature working, and PR #217 fixed the one finding; these two checks were
  not reported item by item.

## Problem

Two checks need a person with VS Code, and one needs a Windows machine. No
review environment could run them:

- **Item 14, timing.** Time New session with ten pinned files against New with
  none, on a local disk. If the difference is more than about half a second,
  look at the seed's reads (the bound is now 50 files, so a New can read up to
  50).
- **Item 16, native Windows file names** (PR #204 F-03):
  - pin `Notes/σ.md`, then try `Notes/ς.md`: it's refused as already pinned,
    since NTFS treats them as one name;
  - pin a file whose name holds `ß`: it stays itself, and isn't matched to an
    `SS` name;
  - rename a pinned file's case in Explorer: the tab still finds it, and a New
    session attaches it once.

## Relevant files

- `.todo/archive/epics/epic-workshop-pinned-context-2026-11-04/slice-5-verify-live.md`
  (items 14 and 16)
- `packages/core/src/shared/types/workshopPinnedContext.ts` (the NTFS-style
  path key)
- `packages/core/src/application/services/workshop/pinnedContext/WorkshopPinnedContextRoomSeed.ts`

## Completion criteria

Both checks run, with their results recorded here and in a memory-bank note.
Any failure becomes its own fix with a regression test.

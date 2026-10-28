# Draft Edit Slice 3: Polish

**Date:** 2026-10-26 02:00 UTC
**Branch:** `claude/upbeat-galileo-y1l4yf`, fast-forwarded to `epic/lightbox`
at `daec95d3` (the PR #172 merge), into `epic/lightbox`
**Decision record:** [ADR 2026-10-21](../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md),
"Amendment 2026-10-26: Slice 3, polish"
**Slice doc:** [slice-3-polish.md](../.todo/epics/epic-draft-edit-2026-10-25/slice-3-polish.md)
**Queued next:** [slice-3b-proofread-coverage.md](../.todo/epics/epic-draft-edit-2026-10-25/slice-3b-proofread-coverage.md)

## What changed

- **Menus.** The editor context menu holds one **Prose Minion** submenu
  (`prose-minion.editorContext`). Every contributed command has
  `"category": "Prose Minion"` and a short title, so menus show the short
  title and the Command Palette reads as before.
- **The spelling convention.** `proseMinion.proofread.spellingConvention`
  is read at the gesture, carried on `DraftEditPass.spelling`, and sent as a
  JSON field beside each chunk's passage. The prompt's "The spelling
  convention" section teaches it.
- **Selection runs.** `DraftEditUseCase.flagsOutside` notes the flags wholly
  outside the selection at the gesture, and `keptFlags` keeps those still
  shown when the run shows its own. The outcome's `kept` counts them, and
  the summary words them.

## Decisions

- The writer asked for Slice 3, and for the wider Proofread coverage queued
  as the immediate follow-up (Slice 3b), before the Workshop slices.
- The writer reports Fix and Refactor Preview "working great" in their
  editor. No fixture run with a false-positive rate was recorded, so no
  threshold moved.
- Clear Proofread Flags stays out of the submenu: without a context key it
  would show on every Markdown file.
- The Explorer's and editor title's Open File in Lightbox lose their
  "Prose Minion:" prefix, since a command has one title everywhere.

## Context worth keeping

- **VS Code's menus, read at 1.82.0** (`raw.githubusercontent.com` was
  reachable):
  - an item's label is its `title`, and the palette writes "category:
    title";
  - an empty submenu is left out;
  - groups sort lexically (`navigation` first, an absent group last), then
    by order, then by title.
- `editorContextMenu.test.ts` models those rules, with a `when` reader for
  `||`, `&&`, `!`, `==` and parentheses. It fails on any other syntax rather
  than guessing.

## Verification

- CI's four steps under Node 18.20.8, and the full suite under Node 22: see
  the PR body for the counts.
- Mutation checks:
  - the menu suite failed six of seven tests on the old flat manifest;
  - the selection suite failed six of eight with the keep decision
    disabled.

## Follow-ups

- Slice 3b (Proofread coverage), then Slices 4 and 5 (the Workshop).
- A recorded fixture run per category, before any new Proofread category
  may write.

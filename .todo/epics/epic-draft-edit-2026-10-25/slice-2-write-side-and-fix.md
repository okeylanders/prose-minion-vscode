# Slice 2: Write Side + Proofread and Fix

**Epic:** [Draft Edit](README.md)
**Decision:** [ADR 2026-10-21](../../../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md): D3 (`DocumentEditor.applyEdits`), D4, D5 (gesture), D7 (quick fixes), D8 (Fix)
**Status:** Planned. Starts after the writer's manual Flag run on seeded public-domain fixtures.

## Outcome

**Prose Minion: Proofread and Fix** applies the safe corrections as one
undoable edit, through Refactor Preview by default, and flags everything
else. Flag's diagnostics gain *Replace with '…'* and *Fix all* quick fixes,
both routed through the core applier.

## Scope

- **Spike first.** Confirm what `workspace.applyEdit` resolves to when the
  preview is discarded, and what VS Code does when the buffer changes while
  the preview is open. Record both in the ADR.
- **`DocumentEditor.applyEdits`.** Synchronous version check, one
  `WorkspaceEdit`, `needsConfirmation` for preview. It never saves.
- **`DraftEditApplier`:**
  - re-snapshot and re-anchor;
  - drop protected-region edits;
  - run the pass guard;
  - resolve overlaps;
  - make one apply call;
  - reconcile what landed (D4 step 7).
- **The setting:** `proseMinion.proofread.fixReview` (`preview` | `apply`).
- **Quick fixes** (*Replace with '…'*, *Fix all*) are commands into core,
  never raw `WorkspaceEdit`s.
- **Fix's leftovers become flags:** fixes the writer unchecked or that were
  downgraded, and every tense/agreement issue.
- **Guards:** the one-write-door test. Only `DraftEditApplier` references
  `DocumentEditor.applyEdits`.

## Acceptance

Fix's acceptance criteria are listed in
[Feature: Proofread](../../features/feature-proofread/README.md#acceptance-criteria).
In particular:

- a single undo step;
- a stale quote is never applied to a shifted range;
- tense and agreement issues are never auto-applied.

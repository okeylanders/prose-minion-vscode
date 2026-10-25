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
  - follow each edit through the writer's edits on Slice 1's document watch,
    refusing a closed document (PR #171 F-03, F-04), never a re-search;
  - drop protected-region edits, found again on the live text;
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
- **Write-side hardening from PR #171's review** (nonblocking for Flag,
  required before anything is applied):
  - `anchorQuote` maps a normalized match back through one-to-many
    expansions (`…` read as `...`), so `anchorQuote('Wait…', { quote:
    'Wait.' })` returns the whole `Wait…` span. Require a match's boundaries
    to fall on whole expansions before its span is used to apply an edit.
  - The guard compares line-break counts, which lets a fix move a line break
    without changing the count. Enforce no line-break change at all: the
    line breaks, and where they stand, must be identical outside the edit.

## Acceptance

Fix's acceptance criteria are listed in
[Feature: Proofread](../../features/feature-proofread/README.md#acceptance-criteria).
In particular:

- a single undo step;
- a stale quote is never applied to a shifted range;
- tense and agreement issues are never auto-applied.

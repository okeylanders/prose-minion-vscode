# Slice 2: Write Side + Proofread and Fix

**Epic:** [Draft Edit](README.md)
**Decision:** [ADR 2026-10-21](../../../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md): D3 (`DocumentEditor.applyEdits`), D4, D5 (gesture), D7 (quick fixes), D8 (Fix)
**Status:** Built 2026-10-25, in review. The writer ran Flag in their editor and reported it working,
so the default Proofread model stays.

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

## As built (2026-10-25)

The spike, and every departure from the plan above, is in the ADR's
"Amendment 2026-10-25: Slice 2, the write side". In short:

- **The spike read VS Code's source, not a running VS Code.** The build
  environment's network policy denies VS Code's download host. The bulk-edit
  service, Refactor Preview and the conflict detector read the same at
  `main` and at 1.82.0, the engine floor:
  - a discarded preview resolves `false`;
  - an applied one makes only the ticked entries;
  - a buffer edited while the preview is open is refused.
- **Review starts unticked (writer decision).** `needsConfirmation` is the
  only way an extension opens Refactor Preview, and VS Code lists those
  entries unticked. Nothing changes until the writer ticks the file or single
  fixes, then Apply. The progress line says so while the preview is open.
- **What landed is read from the document.** `reconcileEdits` follows each
  edit's range through every change, taking in the changes inside it
  (VS Code may split a replacement into smaller ones), so a fix is
  `applied`, `not-applied` or `unknown` by what stands there. Touching edits
  are joined first.
- **Leftovers become flags.** These are flagged where their text stands
  after:
  - fixes unticked, discarded or refused;
  - judgment calls;
  - downgraded fixes.

  A fix the writer rewrote during review is left as written.
- **Retry only for a direct apply.** A stale direct apply follows the
  writer's typing and asks once more; a reviewed one never re-opens review.
- **The quick fixes.**
  - *Replace with '…'* applies one fix at once. It is preferred only for
    Proofread's own fixes; a judgment call's suggestion is the writer's to
    choose.
  - *Fix all* applies every Proofread fix, reviewed as the setting says.
  - Both ask `IssueAnnotator.current` where the flag sits now.
- **A markup guard** (beyond the plan): a fix that adds or removes a Markdown
  markup character is flagged instead (`markup-change`).
- **The setting is VS Code-only.** `proseMinion.proofread.fixReview` is read
  at the gesture and has no Settings Overlay row, like the Workshop's settings.
- **Known limit.** Cancel on the progress notification does not close an
  open preview. (Corrected in PR #172 F-02: VS Code's own Discard,
  `refactorPreview.discard`, is the call; Cancel does not use it yet.)
- **Module split.** The use case stayed under 500 lines by moving the pure
  issue helpers into `draftEditIssues.ts`.
- **Tech debt recorded.** `extension.ts` was past 500 lines before Draft
  Edit, and its command hosts' VS Code glue is most of the growth:
  `.todo/tech-debt/2026-10-25-extension-composition-root-size.md`.

## Review fixes (PR #172, Astra, 2026-10-25)

Astra's review found four blocking write-side defects, and her re-review of
the corrections one more (F-05) and a gap in F-03's (table cells). Each is
fixed or, for F-02, accepted with a best-effort mitigation, with regressions
that fail on the head they were found on; the ADR's "Amendment 2026-10-25:
PR #172 review" records each:

- **F-01. The direct retry checks again.** A retry follows its edits through
  the writer's typing and runs every check on the document as it now stands,
  so text the writer fenced, made inline code or a link target as the fix
  went out is refused as protected.
- **F-03. Markdown structure is kept.** A fix that changes a touched block's
  shape, as `marked` reads it with the document's link definitions, is
  flagged instead (at placement) and refused (in the applier). This covers a
  tag, a fence opener, a bare link, a reference link, a heading, a list item
  and a hard line break, and (after the re-review) the same made inside a
  table cell, a ticked task and a column's alignment. Edits are judged
  together, and kept in order while the shape holds.
- **F-04. Merged changes read back.** Reconciliation replays the document
  and reads each host change as the edits it is made of, VS Code's
  1,000-operation merge included. Counts stay right, untouched flags stay on
  their text, and a quick fix shows them again.
- **F-02. An accepted limit, with a best-effort discard** (the writer's
  choice: keep Refactor Preview). Refactor Preview writes inside
  `workspace.applyEdit`, and a language change moves no version. So while a
  review is held, the VS Code adapter answers the document's close event
  (close, reopen or language change) with VS Code's own Discard, and the run
  reports the document closed with nothing written. It narrows the window
  without closing it: an Apply that beats the close event to the extension
  host, or a preview still opening, is the stated limit, and the run still
  shows nothing.
- **F-05 (re-review). A Clear is for good.** A quick fix that lands after a
  Clear this file or Clear all no longer shows the cleared flags again.

## Verification

- CI's four steps under Node 18.20.8: typecheck, lint, build, and the full
  suite (548 suites / 7,681 tests / 59 snapshots with the PR #172 review
  fixes; lint 0 errors / 1,133 warnings, the baseline), with `epic/lightbox`
  at `e3a7fac0`. The full suite also passes under Node 22.
- Fix is tested through the real applier, anchoring and guard on a document
  that moves as VS Code's does, and end to end through the production
  VS Code adapters on a controlled double whose `applyEdit` behaves as
  VS Code's source shows.
- No live provider calls. Fixtures are public-domain *Alice*.
- Pending a human with VS Code:
  - Fix a seeded fixture chapter through Refactor Preview: tick the file
    and Apply; untick one; Discard.
  - Type in the file while the preview is open, then Apply.
  - Undo the fixes in one step.
  - *Replace with '…'* and *Fix all* from the lightbulb.
  - Fix with `proseMinion.proofread.fixReview` set to `apply`.


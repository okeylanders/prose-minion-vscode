# Feature: Workshop Apply to Draft

**Date Identified**: 2026-07-07
**Source**: Workshop editor-tab Sprint 04 parked item; expanded 2026-10-21 (Okey)
**Status**: Parked. Builds on the Draft Edit foundation planned in
[Feature: Proofread](../feature-proofread/README.md). Its passes' shape is
fixed by [ADR 2026-10-21 D11](../../../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md#d11-reserved-passes-constraints-fixed-now-built-later).
**Priority**: Medium

## Problem

Workshop variation cards now support Copy and Save to notes only. Applying a
variation directly back into the source draft needs a separate write-back design
so the extension does not overwrite the wrong range, dirty buffer, or stale
selection.

Agents also recommend changes for flow and clarity that aren't proofreading.
Writers want those applied to the draft exactly as recommended, without the
editing model improvising extra changes.

## Direction (2026-10-21)

Apply to Draft is two passes on the Draft Edit engine. They share Proofread's
target resolution (`WorkshopExcerptWriteTarget`), its model-free applier
(anchoring, protected regions, version guard, Refactor Preview), the
`DocumentEditor` port, and the re-pin after apply. See
[The Draft Edit Foundation](../feature-proofread/README.md#the-draft-edit-foundation).

### Apply Recommendations (model-backed)

- **Input:** a turn's `actionableFindings`, the strictly parsed
  `### Next steps` items (keyed `finding-N`, ≤12 items of ≤500 characters).
  They are already writer-visible, with Add and Add all buttons. Two entry
  points:
  - **Apply recommendations** on the bubble applies all of the turn's
    findings.
  - **Apply** beside each finding's existing **Add** applies just that one.
- **Strict scope.** It executes only the requested recommendations. It does
  not scan, and it makes no extra fixes. Proofread is the pass that scans.
- **Response contract.** One entry per recommendation: `applied` with its
  edits, or `skipped` with a reason (e.g. "not specific enough to execute: no
  target sentence named").
- **Guard (traceability).**
  - Every edit must cite a requested `ref`; uncited edits are dropped.
  - Edits must lie inside the target.
  - A rewrite ceiling refuses the result as "a rewrite, not an application"
    when the changed share of the target exceeds a bound (e.g. 40%).
- **Newlines allowed.** Flow edits may merge or split paragraphs. For
  `editor-selection` excerpts, the applier recomputes the line range from the
  applied edits before re-pinning. (Proofread instead forbids newline
  changes.)
- **Always preview.** It ignores `proofread.fixReview`. Each edit is labeled
  with the recommendation it executes, so Refactor Preview groups edits by
  recommendation and doubles as the audit.
- **Tense.** It may change tense when a recommendation explicitly asks.
- **Enablement.** The same rules as Proofread (document-backed, non-stale
  excerpt, no active run), plus "this turn has accepted findings".
- **Summary.** "Applied 3 of 4 · skipped 'tighten the pacing' (not specific
  enough)".

### Apply Variation (no model): the original scope

- A committed Creative Variations or Show vs. Tell card's prose replaces its
  subject quote (`subjectText` / `beatText`). This is anchoring and
  application only, with no model call.
- Those features' boundary tests forbid editor writes inside their folders
  (`creativeVariationsPresentationBoundaries.test.ts`,
  `showVsTellPresentationBoundaries.test.ts`). Keep the write route outside
  the feature folders: it receives a card id and resolves the card host-side.
  Leave those guards intact.

## Open Questions

1. **Bubbles without findings.** v1 disables Apply Recommendations ("no
   concrete recommendations in this reply"). Later, add an "extract, confirm,
   then apply" step for free prose?
2. **Model.** Reuse `proofreadModel`, or add a scope? Flow and clarity edits
   are voice-sensitive. Proofread's Slice 1 fixture data will show whether a
   cheap model can carry them.
3. **Partial batches.** When one recommendation in a batch is skipped, apply
   the rest? Proposed: yes; the preview shows what landed.

## Related Files

- `packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx`
- `packages/core/src/application/services/workshop/WorkshopActionableFindings.ts`
- `packages/core/src/application/handlers/domain/workshop/WorkshopTodoHandler.ts`
- `packages/core/src/application/handlers/domain/FileOperationsHandler.ts`
- `packages/core/src/application/handlers/domain/UIHandler.ts`
- `packages/core/src/platform/EditorContext.ts`
- [Feature: Proofread](../feature-proofread/README.md)

## Completion Criteria

- Write-back routes through a host-side handler/port, not browser APIs.
- The design handles dirty buffers, stale ranges, and missing source provenance.
- Variation cards expose Apply to draft only when the target range is known and
  safe.
- Apply Recommendations executes only the requested findings. Every applied
  edit traces to one. Skipped recommendations are reported with a reason.
- Apply Recommendations always opens in Refactor Preview, with edits grouped
  by recommendation.
- Focused tests cover happy path, stale source, missing source, and mid-edit
  conflict behavior.

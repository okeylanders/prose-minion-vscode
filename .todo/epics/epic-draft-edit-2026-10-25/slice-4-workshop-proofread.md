# Slice 4: Workshop Proofread Button

**Epic:** [Draft Edit](README.md)
**Decision:** [ADR 2026-10-21](../../../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md): D5 (confined path), D9, D10
**Status:** Planned

## Outcome

A **Proofread** action on Workshop agent bubbles runs the full excerpt scan,
with the bubble's visible notes as advisory hints. It applies through the
same applier, then re-pins the excerpt so the room learns of the edit.

## Scope

- **`WorkshopDraftEditHandler`.** Joins `WorkshopMutationRouteOwner`,
  registered through `registerMutation`. `WORKSHOP_DRAFT_EDIT` /
  `WORKSHOP_DRAFT_EDIT_RESULT`.
- **`turnDraftEditability`** in the snapshot. Host-derived, not persisted.
- **`WorkshopExcerptWriteTarget`** applies D5's write-confinement policy:
  - `file:` only;
  - inside the workspace (`isPathWithinRoot`), with no symlinked ancestor;
  - never a configured resource.

  The symlinked-ancestor check is extracted from the re-read validation into
  a shared helper.
- **Hints** come from `projectWorkshopTranscriptTurn`, including
  `actionableFindings`. `fromHint` credits and `outOfScopeHints` handoff go
  in the summary.
- **`WorkshopExcerptReplacer`**, extracted from `tryReplaceExcerpt`, shared
  with `WorkshopExcerptScopeHandler`.
- **No gate held across the model call or preview.** The room identity and
  excerpt version are re-checked before re-pinning.

## Acceptance

- The button is enabled only for document-backed, non-stale excerpts
  outside a run.
- A stale, unconfined, or missing source is refused without touching the
  document.
- A successful edit re-pins through the shared replacer. A room or excerpt
  change mid-pass skips the re-pin and says so.

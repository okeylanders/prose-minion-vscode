# Slice 5: Apply to Draft

**Epic:** [Draft Edit](README.md)
**Decision:** [ADR 2026-10-21](../../../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md): D11
**Design:** [Feature: Workshop Apply to Draft](../../features/feature-workshop-apply-to-draft/README.md)
**Status:** Planned

## Outcome

Two new passes on the same applier, each a policy row, never an applier
branch.

- **Apply Recommendations (5a):** executes exactly a turn's
  `actionableFindings`, all of them or one, with traceability and a rewrite
  ceiling. It always previews.
- **Apply Variation (5b):** a committed variation card's prose replaces its
  subject quote, with no model. Its route lives outside the widget feature
  folders.

## Open before building

- Apply Recommendations' model: reuse `proofreadModel`, or add a scope?
- Bubbles without findings: disabled in v1?
- The rewrite-ceiling value.

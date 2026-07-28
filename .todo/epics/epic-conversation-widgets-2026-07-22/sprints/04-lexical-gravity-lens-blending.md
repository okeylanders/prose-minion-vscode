# Sprint 04: Lexical Gravity — Lens Blending

**Status**: Planned
**Priority**: Low (v2 richness; ship 01–03 first)
**Branch**: `sprint/conversation-widgets-04-lexical-gravity-lens-blending` -> PR into `epic/conversation-widgets`
**Estimated Effort**: 3-5 days
**Depends on**: Sprint 02 (Lexical Gravity single-lens) merged into `epic/conversation-widgets`
**ADR**: [2026-07-22 — Conversation Widgets](../../../../docs/adr/2026-07-22-conversation-widgets.md)

## Goal

Extend Lexical Gravity from single-lens to **blended lenses** — combine
interpretive lenses / world-views (e.g. Photography + Music + Mathematics) — with
**explicit dominance weighting**, never an unweighted average. Blending is where
model output gets muddy; the whole design of this sprint is about keeping a blend
*layered* rather than *confused*.

## Current Reality

- Sprint 02 shipped single-lens Lexical Gravity on the standing rail: the
  `<workshop-prose-gravity>` frame, the coordinator, edit-in-place + shift
  marker, the chip, the active-directive indicator + kill switch, and the
  debounced/ cached live-generation path.
- The committed directive payload already carries lens, weight,
  degrees-of-separation, and metaphor pull. Blending extends the payload to a
  *weighted set* of lenses.

## Locked Decisions

- **Blends are dominance-weighted, never averaged.** A blend is an ordered set of
  `{ lens, dominance }` (e.g. Photography 70% / Music 30%), not an equal mix.
  Averages of strong flavors taste like nothing; unweighted blends read as
  confused. The UI enforces an explicit dominance split that sums to 100%.
- **A cap on simultaneous lenses** (leaning: 3) to bound muddiness. Stated in the
  UI; documented in the ADR.
- **The generated cloud/gradient reflects the blend faithfully** — the word
  schedule and gradient buckets show which lens each candidate leans toward, so
  the writer can *see* the layering rather than trust it.
- **The committed directive states the blend as layered guidance**, naming the
  dominant lens and the subordinate tint(s) with their weights — not a flat
  union of vocabularies.
- **Everything else is inherited from Sprint 02**: same rail, coordinator,
  between-runs discipline, edit-in-place, chip, indicator, kill switch. This
  sprint changes the *payload richness and the widget UI*, not the rail.

## Scope / Deliverables

1. **Blend UI**: add lenses, set dominance (enforced 100% split, capped count),
   visualize per-lens leaning in the cloud/gradient.
2. **Extended directive payload**: weighted lens set; validation (weights sum,
   count cap).
3. **Blended generation path**: the live model call reflects dominance; debounced
   / cached as in Sprint 02.
4. **Layered committed directive** naming dominant + subordinate tints.
5. Tests: payload validation (sum, cap); the directive renders as layered
   guidance, not a flat union; single-lens remains a degenerate 1-element blend
   (no regression).

## Out of Scope

- Prose Controller (Sprint 03).
- Any standing-rail coordinator change.
- Cross-widget blending (Lexical Gravity × Prose Controller precedence stays as
  the ADR rule from Sprint 03).

## Completion Criteria

- A writer blends 2-3 lenses with explicit dominance, sees the layering in the
  cloud, commits, and the passage's prose reads as *tinted* by the subordinate
  lens rather than muddied by it.
- Weights are enforced to sum to 100%; the lens count cap holds; single-lens
  still works unchanged.
- No `vscode` in core; architecture witness green; typechecks, lint, build,
  tests pass.

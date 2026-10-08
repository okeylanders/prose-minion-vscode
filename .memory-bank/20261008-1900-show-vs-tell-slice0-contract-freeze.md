# Show vs. Tell — Slice 0 Contract Freeze

**Date**: 2026-10-08
**Sprint**: [Sprint 05 — Show vs. Tell](../.todo/epics/epic-conversation-widgets-2026-07-22/sprints/05-show-vs-tell.md)
**Branch**: committed directly on `main` (docs only), then
`epic/conversation-widgets` was fast-forwarded to `main`. From Slice 1 on,
each slice gets its own branch,
`epic/conversation-widgets-sprint-05-slice-<N>-<desc>`, cut from the epic and
merged back into it by PR. A `/` after `conversation-widgets` isn't possible
because Git can't nest refs under an existing branch name.

## Decisions (writer-confirmed)

- **Vocabulary ownership.** Sprint 05 creates
  `shared/constants/narrativeHandlingVocabulary.ts` (five position ids → the
  show:tell values `summary-allowed | mixed | scene-only`). Sprint 04 Prose
  Controller adopts and imports it. Sprint 04 is no longer a build dependency
  of Sprint 05, so Show vs. Tell now precedes Prose Controller in the epic.
- **Tradeoff lines** are generic, and the shipped copy is frozen in the sprint
  doc.
- **POV** is writer-editable and persona-prefillable. Excerpt-metadata seeding
  is deferred to `.todo/tech-debt/2026-10-08-excerpt-pov-metadata.md`.
- **Catalog flips live at Slice 3**, intentionally. Commit stays disabled until
  Slice 4, and the epic does not merge into `main` until Slice 4 lands.

## Decisions (Ada, derived from locked constraints; the writer may override)

- **The 600 ceiling counts the artifact body only.** The envelope and warning
  lines are excluded, because a writer can't shorten a model warning.
- **Field budgets** were sized so that a maximal beat, both invariants, the
  longest position line, and one maximal direction fit under 600 (585). A
  Slice 1 test pins this. As a result the beat is capped at 160 characters:
  Show vs. Tell is for a beat, and passages belong in Creative Variations.
- **Gains and costs are two plain-text fields**, not one Markdown note.
- **The Host-preparation door is enabled**, matching Creative Variations.

## Hand-off for agents

The sprint doc now carries the slice table with model routing
(Opus: Slice 1, 2a prompts, 5's recommendation copy; Sonnet: 2b, 3, 4, 5, 6;
Haiku: docs and verification summaries), a Creative Variations → Show vs. Tell
implementation map, the list of closed registries and touch points, and the
existing tests that use `show-vs-tell` as their "unavailable widget" example.
Those tests must switch ids at the Slice 3 flip.

## Verification

Baseline on `main` @ `7031b7ee`: `npx jest` → 267 suites / 3,535 tests /
2 snapshots, all passing. No code changed in Slice 0.

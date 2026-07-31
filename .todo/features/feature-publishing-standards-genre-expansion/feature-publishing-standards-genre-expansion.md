# Feature: Publishing Standards — genre data expansion

**Status**: Planned
**Priority**: Medium
**Created**: 2026-07-30
**Motivated by**: [Genre Dictionary concept spring](../../epics/epic-conversation-widgets-2026-07-22/concepts/genre-dictionary.md)

## Problem

[`publishing_standards.json`](../../../packages/core/resources/repository/publishing_standards.json)
holds ten broad genres with **measurement** data only — word counts, page counts,
formatting, `literary_statistics`, and `popular_examples` with per-title stats.

That is enough to compare a manuscript against a standard, which is what
`StandardsComparisonService` does today. It is not enough to *describe a genre*,
which is what the Genre Dictionary needs and what the Genre Relationship
Explorer's `expectation` half currently has no grounding for at all.

## Motivation

Two consumers, one gap:

- **Genre Dictionary** — needs description, classification, archetypes, and
  conventions alongside the numbers it already has.
- **Genre Relationship Explorer** — every `expectation` half is a claim about a
  population of books with no address and no source. Authored genre data is the
  single highest-leverage way to make that half trustworthy.

Anything authored here is read by both, so the data should be written for the
widest consumer rather than for one widget.

## Scope

**Additive properties per genre** (candidates, not settled):

- `description` — plain-language definition, and the neighbor it's confused with
- `bisac` — code + official heading where known
- `reader_promise` — the contract, sharing vocabulary with the Explorer's
  `dimension` enum
- `archetypes` — recurring roles, not characters from specific books
- `conventions` — tagged *load-bearing* vs *optional furniture*
- `exhausted_moves` — stale conventions with **why**, plus a function-based
  alternative
- `neighbors` — adjacent shelves and the axis of difference

**Structural change — do this first:**

- **Parent/child links between genres.** The current flat list of ten can't
  express "quiet domestic noir" under "Thriller/Mystery". The Genre Dictionary's
  rendering rule depends on it: authored fields resolve at any granularity, while
  *measured* fields fall back to the nearest parent **with the fallback
  disclosed**. Retrofitting a hierarchy after the properties land is the
  expensive version of this change.

## Constraints

- **Additive only.** `StandardsComparisonService` and the metrics comparison path
  read the same file; existing consumers must not break.
- **`publishing_standards_schema.json` must be updated in the same change** — the
  schema is the contract, and a data file that has drifted from it is worse than
  either alone.
- **Measured vs. authored must stay distinguishable.** Measured stats have a
  provenance the widget discloses; authored prose does not get to sit in the same
  fields and inherit that authority.
- **Lexical density keeps its definition** — content-word ratio
  (non-stopwords / total × 100), never TTR.
- Subgenres may carry authored fields without measured ones. Partial entries are
  expected and must render honestly rather than being excluded.

## Related files

- `packages/core/resources/repository/publishing_standards.json`
- `packages/core/resources/repository/publishing_standards_schema.json`
- `packages/core/src/infrastructure/standards/PublishingStandardsRepository.ts`
- `packages/core/src/application/services/StandardsComparisonService.ts`
- `packages/core/src/__tests__/infrastructure/standards/`

## Completion criteria

1. Schema and data file updated together, with the hierarchy in place.
2. Existing standards comparison behavior unchanged — tests green, no consumer
   reads a field that moved.
3. `PublishingStandardsRepository` resolves a subgenre to its nearest measured
   ancestor and reports **that a fallback occurred**, so callers can disclose it.
4. At least one subgenre entry exists as a worked example of a partial (authored,
   not measured) record.
5. Genre Dictionary's repository-backed blocks can be rendered from this data
   without a model call.

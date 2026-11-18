# Feature: Personas Search and Recommend the Writer's Own Lenses

**Date Identified:** 2026-11-18
**Status:** Identified. Split out of [Personas Can See the Writer's Lenses](../feature-workshop-persona-reads-lenses/README.md) at the Round Two epic's close.
**Priority:** Low
**Origin:** ADR 2026-11-17, "Item F: out of scope"; README defaults 18 and 19

## Problem

Item F (PR #277) gave personas `lens.catalog` and `lens.read`. Two things
were left out on purpose:

- **No `lens.search`.** A persona finds a lens by paging the catalog
  (`catalogItems`, 50 a page; the library holds at most 206, so 5 pages).
  Finding by subject or word means reading pages.
- **A recommendation names a built-in starter only.**
  `LexicalGravityRecommendation.ts` accepts only `BUILT_IN_LENS_SLUGS`. A
  persona that knows the writer's own lens names it in prose; the writer
  opens it from the modal.

## Proposal

- `lens.search`: deterministic and lexical over name, variant,
  description and subject, with `memory.search`'s term rules
  (`WorkshopTextSearch`), private like the other two. It joins every list
  ADR 2026-11-17 D16 names.
- A recommendation may name a project lens by slug; the host resolves it
  through `LexicalGravityLensRepository.listReadable()` at the press, never
  trusting the slug, and falls back to the starters' rule when it is gone.

## Open questions

- Is paging enough at 206 lenses? Wait for the live pass's step F1–F2.
- Does a project-lens recommendation install the lens, or open the modal
  on it?

## Completion Criteria

- [ ] An ADR amends D17–D19 for whichever of the two is built.
- [ ] The grammar prompt, its sync test and the native call map follow.

## Related Files

- `packages/core/src/application/services/workshop/lens/`
- `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityRecommendation.ts`
- `packages/core/resources/system-prompts/workshop-personas/lens-capability.md`

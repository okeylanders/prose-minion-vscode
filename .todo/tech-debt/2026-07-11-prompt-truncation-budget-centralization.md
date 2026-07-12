# Prompt Truncation Budgets Are Scattered (Centralize the Table, Not a Manager)

**Status**: Open
**Priority**: Medium (rises to High before Sprint 09 lands — see multipliers)
**Date**: 2026-07-11

## Finding (census as of Sprint 06B branch)

The *mechanism* is centralized: `trimToWordLimit` (`utils/textUtils.ts`) is
the single word-trim implementation and returns a provenance-carrying
`TrimResult` (`wasTrimmed`, original/trimmed counts) that powers honest
truncation notices.

The *limits* are not. Module-local constants live in seven files:

| Site | Limit | Mechanism |
|---|---|---|
| `WorkshopHandler` | `WORKSHOP_FILE_EXCERPT_MAX_WORDS` 10,000 / `…MAX_BYTES` 5 MB | `trimToWordLimit` + stat |
| `AssistantToolService` | persona excerpt 10,000 words; context brief 1,200 | `trimToWordLimit` (private) |
| `WorkshopPromptBuilder` | `WORKSHOP_TOOL_EVIDENCE_MAX_CHARS` 50,000 chars | raw `.slice(0, N)` |
| `WorkshopSessionService` | handoff 8 turns / 20,000 chars | raw `.slice()`, magic `- 800` header allowance |
| `ContextFileCapability` | 50,000 words; 100 catalog items | `trimToWordLimit` |
| `GuideCapability` | 50,000 words | `trimToWordLimit` |
| `ContextAssistantService` | 50,000 words | `trimToWordLimit` |

(`maxTokens` — response-side truncation — is separately and correctly
centralized via settings. `CategorySearchService.MAX_WORDS_PER_BATCH` is
batching, not truncation.)

## Why It Bites

- **Coincidence coupling**: the two `10_000`s (file pin vs persona frame)
  agree only by accident; drift causes silent double-trimming of excerpts.
  The three `50_000`s are not even the same unit (words vs chars).
- **Two provenance regimes**: `trimToWordLimit` sites report trim metadata;
  the char-slice sites (`WorkshopPromptBuilder`, `WorkshopSessionService`)
  hand-roll bounds without the `TrimResult` contract.
- **Multipliers incoming**: Sprint 07 adds four capability input ceilings
  (100/4,000/500/1,000 chars); Sprint 06C reuses the persona excerpt cap for
  revision frames; Sprint 09 adds join-snapshot (20 turns/24,000 chars) and
  catch-up bounds. Unmanaged, that is ~15 constants across ~10 files.
- Changing "the excerpt limit" today requires knowing to touch two files;
  nothing fails if you touch only one.

## Recommended Shape (right-sized: a table, not a service)

1. **One frozen, typed budget module** — e.g.
   `packages/core/src/shared/constants/promptBudgets.ts` — grouping every
   prompt-side bound by domain: `fileExcerpt`, `personaExcerpt`,
   `contextBrief`, `toolEvidence`, `directHandoff` (turns + chars + header
   allowance), `contextFiles`, `guides`, `sourceDocument`, plus slots for
   the Sprint 07 ceilings and Sprint 09 snapshot/catch-up bounds as they
   land. All existing sites import from it; no site keeps a local constant.
2. **A char-based trim helper** beside `trimToWordLimit` returning the same
   `TrimResult`-style provenance, so the `.slice()` sites adopt the shared
   contract (including the handoff's header allowance as a named field, not
   a magic `- 800`).
3. **An architecture guard test** (sibling of
   `__tests__/architecture/boundaries.test.ts`) that fails when a new
   module-local `*_MAX_*` / `*_LIMIT*` constant appears outside the budget
   module.
4. **Explicit non-goal**: no `TruncationManager` class/DI service — budgets
   are static config over pure functions; a class adds indirection without
   removing any duplication of knowledge. If user-configurable limits are
   ever wanted, the budget module is the seam where settings overrides
   compose.

## Sequencing

Best landed as a small standalone pass **before Sprint 07** (or as 07's
first commit): 07 and 09 otherwise mint five-plus new scattered constants
that immediately become migration work.

## Completion Criteria

- [ ] Every prompt-side truncation limit is imported from the single budget
      module; grep for `MAX_WORDS|MAX_CHARS|MAX_BYTES` outside it returns
      only the budget module and tests.
- [ ] Char-trim helper with provenance replaces raw `.slice()` bounds at
      the evidence/handoff sites; the `- 800` allowance is a named budget
      field.
- [ ] Architecture guard test enforces the invariant.
- [ ] Sprint 07/09 docs reference the budget module for their new ceilings.

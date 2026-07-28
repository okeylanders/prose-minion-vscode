# Tech Debt: the persona analysis contract is written three times and synced by hand

- **Status**: Open
- **Priority**: Medium
- **Filed**: 2026-07-26
- **Source**: [PR #88 review](../../docs/pr-reviews/pr-88-persona-analysis-inputs-review.md) —
  findings #3 and #4, and fix-review follow-up #22. Sensei's Lesson 4,
  *"The Prompt Is Code You Forgot to Review."*

## Problem

Sprint 13B's `analysis.run` input grammar is a single contract encoded in three
places, in two different languages, with nothing forcing them to agree:

| Encoding | File | Audience |
| --- | --- | --- |
| Prose | `packages/core/resources/system-prompts/workshop-personas/analysis-capability.md` | the persona model |
| Parse-time validation | `WorkshopCapabilityXmlCodec.analysisInput` | the XML tool-call |
| Resolution-time validation | `WorkshopAnalysisInputs.resolveInput` | the resolved run |

Two functions that call each other get reviewed together. A prompt file and a
validator do not — they are edited by different concerns at different moments,
and a disagreement between them produces no compile error, no lint warning, and
no failing test. It surfaces as a persona that follows the documented contract
and gets rejected anyway.

**This drifted three times inside one PR:**

1. **Ceiling scope** (finding #3). The prompt said persona-supplied excerpt text
   *"may contain at most 10,000 words."* The resolver checked
   `suppliedWords + inheritedWords` against that same number — so a room whose
   excerpt sat at the cap the system actively trims *toward* rejected any
   prepend at all, down to one word. Both were internally reasonable; neither
   was written against the other.
2. **Character ceilings** (finding #4). Neither encoding had one, so a
   whitespace-free payload counted as a single word and passed both gates into
   a billed call.
3. **`inherit` existence** (follow-up #22). The resolver briefly required
   inherited material for `inherit` in both slots, while the prompt states
   *"The underlying material must exist"* under `prepend` only — leaving a
   compliant persona no way to know.

All three are closed. Nothing prevents a fourth.

## Why it matters

The immediate, mechanically checkable part is small and concrete: **four
numbers are written twice.**

```text
analysis-capability.md:23   10,000 words / 120,000 characters  (excerpt)
                            35,000 words / 420,000 characters  (context)

promptBudgets.ts            personaExcerpt.{words,characters}
                            contextAttachments.{words,characters}
```

Edit the budget constant and the prompt keeps quoting the old figure to the
model. The persona then self-censors against a limit that no longer exists, or
submits against one that does — and the only symptom is a rejection the writer
sees and cannot explain.

`analysis-capability.md` is currently the **only** system prompt in the repo
that hardcodes numeric limits (verified by grep across
`packages/core/resources/system-prompts/`). That makes this a new pattern
introduced by Sprint 13B rather than an established one — cheap to fence off
now, considerably less so once persona-facing grammar spreads to sibling
capabilities.

## The codebase already has the pattern for this

Two existing architecture guards solve exactly this class of problem — "one
truth, two encodings, synced by hand":

- `packages/core/src/__tests__/architecture/wordSearchDefaultsSync.test.ts`
  reads `apps/vscode-extension/package.json`, extracts the contributed
  defaults, and asserts they equal `WORD_SEARCH_DEFAULTS`. Its header states
  the intent plainly: *"This turns that hand-sync chore into a CI failure: edit
  one without the other and this test goes red."*
- `packages/core/src/__tests__/architecture/categoryModelsSync.test.ts` does
  the same for category models.

A `personaPromptBudgetsSync` guard would follow `wordSearchDefaultsSync`
directly: read the markdown, parse the four figures, assert against
`PROMPT_BUDGETS`.

## Proposed work

**Tier 1 — the numbers (cheap, mechanical, high value).**
Add `packages/core/src/__tests__/architecture/personaPromptBudgetsSync.test.ts`
asserting the limits quoted in `analysis-capability.md` equal the corresponding
`PROMPT_BUDGETS` entries. Prefer parsing the prose over restating it in the
test, so the guard fails when either side moves.

**Tier 2 — the mode rules (more design, lower urgency).**
The per-mode preconditions are prose, not numbers: which modes require supplied
text, which require inherited material, and in which slot. A table-driven test
that enumerates the documented rules and asserts `resolveInput` honors each one
would close the #22 class. Worth doing only if a fourth drift appears, or if
the grammar grows another mode — until then the cost/benefit is thinner than
Tier 1's.

**Consider also:** if the prompt file's limits were generated from
`PROMPT_BUDGETS` at load time rather than hand-written, the drift becomes
structurally impossible instead of merely detected. That is a larger change to
how `workshopPersonaSystemPromptPaths()` assembles the prompt, and it trades a
static, reviewable asset for a computed one — but it is the only option here
that removes the second encoding entirely. Worth weighing before Tier 2.

## Completion criteria

- [ ] A CI-failing guard exists for the four numeric limits shared between
      `analysis-capability.md` and `PROMPT_BUDGETS`.
- [ ] The guard fails when either side changes alone (verify by editing one and
      watching it go red before committing the fix).
- [ ] The guard's header comment states the invariant and why it exists, in the
      style of `wordSearchDefaultsSync.test.ts`.
- [ ] Tier 2 either done, or explicitly declined with a note here.

## Related files

- `packages/core/resources/system-prompts/workshop-personas/analysis-capability.md`
- `packages/core/src/shared/constants/promptBudgets.ts`
- `packages/core/src/application/services/workshop/WorkshopCapabilityXmlCodec.ts` (`analysisInput`)
- `packages/core/src/application/services/workshop/WorkshopAnalysisInputs.ts` (`resolveInput`)
- `packages/core/src/shared/constants/workshopPersonas.ts` (`workshopPersonaSystemPromptPaths`)
- `packages/core/src/__tests__/architecture/wordSearchDefaultsSync.test.ts` (precedent)

## Related

- [PR #88 review](../../docs/pr-reviews/pr-88-persona-analysis-inputs-review.md)
- [Sprint 13B](../epics/epic-workshop-editor-tab-2026-07-03/sprints/13b-run-local-analysis.md)
- [Tech debt: Workshop god files](2026-07-25-workshop-god-files.md) — the other
  structural item raised by the same review

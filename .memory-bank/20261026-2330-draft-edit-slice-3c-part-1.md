# Draft Edit Slice 3c, part 1: the Craft Flags pass and cliché

**Date:** 2026-10-26 23:30 UTC
**Branch:** `claude/upbeat-galileo-y1l4yf`, restarted from `epic/lightbox`
at `fd145a6a` (the PR #176 merge), into `epic/lightbox`
**Decision record:** [ADR 2026-10-21](../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md),
"Amendment 2026-10-26: Slice 3c, Craft Flags", and its "As built (part 1)"
note
**Slice doc:** [slice-3c-craft-flags.md](../.todo/epics/epic-draft-edit-2026-10-25/slice-3c-craft-flags.md),
"Part 1: as built"

## The writer's decisions (2026-10-26)

- A second pass, *Craft Flags*, beside Proofread, with its own command.
- The slice doc's six recommendations:
  - one whole-chapter call per category under a ceiling;
  - the note in the message with no quick fix;
  - options, never orders;
  - `info` under its own source;
  - an own model following the Workshop's;
  - a price in the confirmation.
- Cliché first.

## What changed

- **Groundwork, no behavior change (`0be186c9`):**
  - the reply frame reader shared by every pass (`DraftEditResponseFrame`);
  - interruption words and the once-only presenter in `DraftEditCalls`;
  - single-quoted speech moved to `utils/draftEdit/speechSpans`, with
    `findSpeechSpans` joining it to the dialogue rule;
  - `moveIssues` and `outsideProtected` made generic.
- **The model scope (`341fb577`):** `craft`, set by `proseMinion.craftModel`,
  following the assistant model until picked; engine, watcher, Settings
  overlay row, manifest.
- **The pass:**
  - `CraftFlagsPass` in `DraftEditPass` and a `craft` policy row;
    `DraftEditUseCase` now takes `ProofreadPass`;
  - `CraftFlagsUseCase`, which takes no applier;
  - `CraftFlagsService` (one call per category, at temperature 0.2,
    priced by `estimate`) with its frame, codec and prompts
    (`craft-flags/00`, `10-cliche`, `11-cliche-example`);
  - `craftFlagPhrasing` (the fence) and `phraseRepeats` (host counts);
  - `Platform.craftAnnotations`: in VS Code a second
    `VsCodeIssueAnnotator` (`CRAFT_FLAGS`);
  - the commands (`craftFlagsCommands.ts`) and the submenu entry.
- **One vocabulary with the Lightbox:** `FAMILIAR_PHRASE_KINDS` and
  `FAMILIAR_PHRASE_DEFINITIONS` (`shared/constants/familiarPhrasing.ts`);
  `LightboxFamiliarKind` is that type.

## Decisions worth remembering

- **Write-free by construction.** No replacement field, no applier in the
  constructor, and a boundary test that no Craft Flags module names the
  applier or `applyEdits`.
- **Calls start together,** so a provider refusal does not stop the others.
- **No key is said before the confirmation** (the plan is `unconfigured`).
- **The fence is word lists with stated limits.** "Say" is not an opener:
  "say, …" is a hedge.
- **A why that breaks the fence** becomes the kind's shared definition.

## Verification

- Node 18.20.8 mirror of CI passes: typecheck, test, lint (0 errors / 1,133
  warnings, as before) and build. Inventory: 571 suites / 7,981 tests / 59
  snapshots (base 562 / 7,870).
- 16 mutations: each fails a test. They covered the kind check, the
  dialogue drop, the selection filter, each fence rule, the repeat skip and
  boundary, the kept flags, reading the selection alone, the replace guard,
  joining speech, the stale drop, overlap, the host's why, the price floor,
  the unconfigured plan and the temperature.
- No live or billable provider call; fixtures adapt public-domain *Alice*.

## PR #177 review (Astra): changes requested, fixed in `9b5f2393`

- **F-01:** the approved model was not the model called; a hot-swap during
  pricing or the confirmation sent the chapter elsewhere. Now the estimate
  reads the engine's model once before any await, and every call names it
  (`AgentRunOptions.model`, `OpenRouterCompletionOptions.model`).
- **F-02:** pricing and the confirmation lost the document's lifetime. Now
  the gesture is held (`begin` / `plan` / `run` / `release`) with its watch
  from the first read; `DocumentWatch.ended()` (new, non-ending) and the
  service's `stillCurrent` refuse a closed, reopened or relanguaged document.
- **F-03:** speech was read on raw text, at the gesture only. Now it is read
  with protected syntax set aside, and again on the settled live text.
- **N-01, N-02:** repeats are counted in the live text, lazily, one scan per
  distinct phrase, at most 40. A 250,000-word selection run reaches the
  model stub in about 0.1 s (2.86 s before).
- Inventory after the fixes: 573 suites / 8,028 tests / 59 snapshots. 18
  mutations: 16 fail tests; the 2 that survive are redundant guards.

## PR #177 re-review (Astra, `d4db34f2`): F-01 and F-02 resolved; F-03's last case fixed in `61dbbe4e`

- **F-03, still open at re-review:** the protected-aware view stood letters
  in for protected syntax, so a single opener right after a tag, comment or
  code span read as an apostrophe. Now a protected region is read as if
  absent: marks inside it are none, a single mark beside it is judged by the
  prose past it within its paragraph, and the view keeps white space so its
  paragraphs are the raw text's. 36 cases (two quote styles, six placements,
  three containers) read the speech exactly; controls find none.
- **N-03 (P3), taken:** overlapping repeats count again.
- **PR CI on `d4db34f2`:** the existing `LightboxPassages` 1,000 ms
  wall-clock check failed once (140–156 ms locally; the push run on the same
  commit passed). Re-running from the session is refused (403).
- Inventory: 573 suites / 8,046 tests / 59 snapshots. Seven mutations, all
  caught.

## PR #177 second re-review (Astra, `18e8b34e`): F-03 resolved; F-04 fixed

- **F-04 (P2):** restoring overlapping repeats (N-03) resumed each search one
  UTF-16 unit past a match's start. Under the `u` flag a search resumed
  inside a surrogate pair backs up and finds the same match, so a phrase
  opening on an astral letter never finished counting: a synchronous hang
  on the extension host. Now the walk resumes one whole code point on, and a
  match starting before its search ends it. Tests bound every phrase scan by
  its search count (`withPhraseScanLimit`), never a clock, so a regression
  fails rather than hanging the worker.
- Inventory: 573 suites / 8,054 tests / 59 snapshots.
- Lesson: a manual `lastIndex` under the `u` flag must move by code points;
  a hang test needs a deterministic bound, since Jest's timeout cannot
  interrupt a synchronous loop.

## Follow-ups

- The writer's fixture run for cliché: hits and false positives in the
  slice doc.
- Part 2: register shift, with the chapter's register measure.
- Then gesture strain and continuity; then Slice 3b part 3 (quotation marks
  and consistency).

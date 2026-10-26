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

## Follow-ups

- The writer's fixture run for cliché: hits and false positives in the
  slice doc.
- Part 2: register shift, with the chapter's register measure.
- Then gesture strain and continuity; then Slice 3b part 3 (quotation marks
  and consistency).

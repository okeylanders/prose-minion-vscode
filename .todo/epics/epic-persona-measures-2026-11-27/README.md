# Epic: Persona Measures, then Scansion

**Status:** Planned (2026-11-27). Not started. The design sprint (A0) comes first; its ADR and sprint documents replace the outline below where they differ.
**Priority:** Medium
**Goal:** Personas quote exact numbers instead of estimating them. First the measures Prose Minion already has (step 1), then a measured scansion of the prose: syllables, stress and cadence (step 2).
**Notes:** [#35 Personas run the deterministic measures](../../features/feature-workshop-persona-measures/README.md) · [#31 Read Aloud: measured cadence](../../features/feature-read-aloud-cadence/README.md)

## Two steps, one epic, two releases

| Step | Slices | Ships |
|---|---|---|
| 1. Measures (#35) | A0–A3 | Merged to `main` and released before step 2 starts. |
| 2. Scansion (#31) | B0–B2, then C, then D | Starts from the epic branch once `main` has been merged back into it. |

**Branching:**
1. Cut `epic/persona-measures` from `main` once the highlights epic (2.17) has landed.
2. Sprint branches (`sprint/persona-measures-NN-…`) target the epic, as in the tabs and highlights epics.
3. After step 1 is reviewed, the epic merges to `main` and step 1 releases.
4. **Keep the epic branch.** If the repository deletes head branches on merge, restore it or turn that off for this PR.
5. Before B0, merge `main` back into the epic, so step 2 starts from what shipped, any 2.17.x patches included.

## Step 1: Measures (#35)

| Sprint | Deliverable |
|---|---|
| **A0 · Design** | One ADR for the `measure.*` family. It also records step 2's decisions now, so B needs no second ADR: the pronunciation data dependency (CMUdict and its licenses), the syllable-counter rule (R4 below) and where `measure.cadence` joins. Also a runway, and the sprint documents for A1–A3 and B1–B2. |
| **A1 · Scope lift** | Move `PassageSearchScope` and its resolver (`application/services/passageSearch/PassageSearchRequest.ts`, `PassageSearchScopeFiles.ts`) to a neutral home (for example `application/services/projectScopes/`). Move Passage Search onto it with no behavior change; its tests pass unchanged. |
| **A2 · The family** | Adds the plumbing every family needs: <ul><li>the operations in `WORKSHOP_CAPABILITY_OPERATIONS`, every family switch and `WORKSHOP_NATIVE_CALL_FIELDS`;</li><li>a codec;</li><li>a grammar prompt held by a sync test;</li><li>a tool-use prompt path in `WORKSHOP_TOOL_USE_PROMPT_PATHS`;</li><li>the result frame tallied in the context breakdown;</li><li>a help section;</li><li>results published to the room on commit (M1);</li><li>a narrow port into the measurement services, built in `extension.ts` and placed in `CoreServices`.</li></ul> |
| **A3 · Measures and scansion's groundwork** | Adds `measure.stats` (against the Settings standard, M2), `measure.flags`, `measure.frequency` and `measure.search`, each matching what the Metrics and Search tabs report. Also builds the groundwork step 2 stands on (M3): <ul><li>**results by sentence, with host-assigned sentence ids;**</li><li>**a pause splitter** (the stretches between commas, dashes, semicolons and stops), counted in words for now;</li><li>**window fitting and continuations sized for long per-sentence tables.**</li></ul> `measure.stats` offers a per-sentence view as their first user. |

## Step 2: Scansion (#31)

| Sprint | Deliverable |
|---|---|
| **B0 · Kickoff** | Merge `main` into the epic. Settle the tool's name. Confirm the data's licenses as the ADR recorded them. |
| **B1 · The engine** | Builds the pronunciation side: <ul><li>a compact table built at build time from `cmu-pronouncing-dictionary`, loaded lazily on the extension host and never in the webview, with the bundle size recorded in the PR;</li><li>`syllable` as the fallback counter, with unknown stress never guessed;</li><li>function words demoted through the tagger, and heteronyms stressed by part of speech;</li><li>the per-project pronunciation list (R3);</li><li>the measures: twin cadences, sags, terminal stress, breath length in syllables (on A3's pause splitter) and consonant pileups.</li></ul> |
| **B2 · `measure.cadence`** | A fifth operation in the family, on A3's sentence ids and tables. It is free and instant, with no model call. |
| **C · The sidebar tool** | Shows the measured view at once. **Listen** adds the model's reading, with its price shown first. |
| **D · The chapter pass (later)** | The model picks the places and how many (R1); host code checks every pick. Where it lives (Craft Flags or the Lightbox) stays open until C has proved itself. |

## The model-facing prompts: Fable

C's **Listen** reading and D's chapter pass are model calls with prompts of their own, in a folder beside the other tools' (`packages/core/resources/system-prompts/<tool>/`). Fable writes them. The house rules those prompts must keep:

- **Numbers come from `PROMPT_BUDGETS`,** held by a sync test, never typed into the prompt alone.
- **A worked example decodes through the production codec,** and its request is byte-identical to the builder's.
- **Counts are asks, not gates.** "A handful is usual, none is fine" is the ask. A safety ceiling, never stated in the prompt, drops and counts anything past it, as the Lightbox reads its replies.
- **The model never states a number.** Every count is the host's. A claim names its sentence id and the measure behind it.
- **The register is describe, then suggest,** held by a phrasing fence like Craft Flags' `craftFlagPhrasing`, with "serves" and "works against" as the stance.
- **Write them against B's measure table,** so the prompt and the codec agree from the start.

The persona grammar for `measure.cadence` is code-coupled (its sync test reads the codec), so B2's implementer writes it, as A2's grammar is written.

## Decisions

| # | Decision | By |
|---|---|---|
| M1 | Measure results are **published to the room on commit**, as file reads are, so a guest sees the same numbers. | Okey, 2026-11-27 (Ada's lean) |
| M2 | `measure.stats` compares against **the publishing standard set in Settings**. | Okey, 2026-11-27 (Ada's lean) |
| M3 | **Step 1 builds the groundwork step 2 needs** (sentence ids, per-sentence tables, the pause splitter, the scope lift). The pronunciation engine stays in step 2. | Okey, 2026-11-27 |
| R2 | **The order is the engine and `measure.cadence` first, then the sidebar tool, then the chapter pass.** | Okey, 2026-11-27 (the note's lean) |
| R3 | **A per-project pronunciation list for names,** small, like Proofread's word list. | Okey, 2026-11-27 (Ada's lean) |
| R4 | **Readability keeps its heuristic syllable counter** (`estimateSyllables`). Scansion's dictionary counts are its own. Switching readability over would be a separate, deliberate change, with before-and-after figures pinned. | Okey, 2026-11-27 (Ada's lean) |

## Still open

- **The tool's name,** at B0. Ada's lean is "Cadence": the extension doesn't speak, so "Read Aloud" fits only if a Play button lands.
- **Playback** through the webview's speech synthesis: check voices in VS Code's webview before promising it.
- **Where the chapter pass lives,** at D.

## Completion criteria

- **Step 1:**
  - personas run the four measures over the excerpt, a message's Selected Text, groups or files, several at once;
  - every number matches the Metrics and Search tabs;
  - Passage Search runs on the lifted scope module unchanged;
  - sentence ids, per-sentence tables and the pause splitter are in place, with tests.
- **Step 2:**
  - syllables and stress come from the pronunciation data, and an unknown word's stress is never guessed;
  - every cadence measure is host-computed;
  - `measure.cadence` returns them;
  - the data loads lazily on the host, with its bundle size recorded;
  - readability's figures are unchanged (R4).
- **Each slice** has its help section, sync tests and logs that carry counts only.

## Kickoff

The prompt for the design sprint is in [kickoff-prompt.md](kickoff-prompt.md).

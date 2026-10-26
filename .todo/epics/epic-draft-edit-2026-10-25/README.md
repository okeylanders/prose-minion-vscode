# Epic: Draft Edit

**Status:** In progress. Slices 1 to 3 merged (PRs #171, #172, #173); Slice
3b (Proofread coverage) part 1 merged (PR #174), part 2 built and in review;
Slice 3c (craft flags) queued.
**Priority:** Medium
**Created:** 2026-10-25
**Integration branch:** `epic/lightbox`. Draft Edit branches from it, to keep
the eventual merge to `main` simple. Slices are built on
`claude/upbeat-galileo-y1l4yf`. Each slice is a PR into `epic/lightbox`,
never `main`, and `epic/lightbox` is merged back in regularly as merge
commits.
**Decision:** [ADR 2026-10-21: Draft Edit Engine and Document Write-Back](../../../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md) (Accepted 2026-10-25)
**Realizes:** [Feature: Proofread](../../features/feature-proofread/README.md),
then [Feature: Workshop Apply to Draft](../../features/feature-workshop-apply-to-draft/README.md)

## Goal

Writers can proofread an open Markdown or plain-text file from the editor
context menu.

- **Proofread and Flag** marks spelling, punctuation, and tense problems as
  diagnostics without touching the text.
- **Proofread and Fix** applies the safe corrections in one undoable,
  previewed edit, and flags the judgment calls.

The same engine later serves the Workshop: a Proofread button on agent
bubbles, then Apply Recommendations and Apply Variation.

```text
 chapter-03.md  ─ right-click ─►  Prose Minion: Proofread and Flag
                                   Prose Minion: Proofread and Fix
 ┌───────────────────────────────────────────────────────────┐
 │ She lead him to the door and walks away.                  │
 │     ~~~~                     ~~~~~                         │
 │     ⓘ homophone: 'led'       ⚠ tense: narration is past   │
 └───────────────────────────────────────────────────────────┘
 Proofread · 9 flagged · 2 tense · 1 unplaced · $0.004
```

## Shape

- **Engine (core):**
  - The `DraftEditPass` union and an exhaustive pass-policy table.
  - Deterministic masking, chunking, and anchoring.
  - The Proofread pass: the `proofread` model scope, its prompt, a
    sentinel-framed JSON contract read with `parseModelJson`, and the
    mechanical guard.
  - `DraftEditUseCase` in `CoreServices`.
- **Ports:** `IssueAnnotator` and `DocumentEditor`'s watch (Slice 1), and
  `DocumentEditor.applyEdits` (Slice 2), all `vscode`-free.
- **Adapter:**
  - Context-menu commands in `extension.ts`.
  - `VsCodeIssueAnnotator` (diagnostics and code actions).
  - `VsCodeDocumentEditor` (`WorkspaceEdit`, Refactor Preview, version
    guard).
- **Workshop (Slice 4):** a `WorkshopDraftEditHandler` route owner and the
  excerpt write target. Re-pins go through a shared excerpt replacer.

## Slices

| # | Slice | Outcome | Status |
|---|---|---|---|
| 0 | Spec | Feature notes, ADR (Accepted), this epic; `epic/lightbox` merged in; recovery registry moved (`d058e8d2`) | Done |
| 1 | [Read side + Proofread and Flag](slice-1-read-side-and-flag.md) | Flag a file or selection as diagnostics; Clear; long-file confirm | Merged (PR #171) |
| 2 | [Write side + Proofread and Fix](slice-2-write-side-and-fix.md) | `DocumentEditor`, the applier, Fix with Refactor Preview, quick fixes | Merged (PR #172) |
| 3 | [Polish](slice-3-polish.md) | Submenu, spelling convention, a selection run replacing only its own flags | Merged (PR #173) |
| 3b | [Proofread coverage](slice-3b-proofread-coverage.md) | Names, wrong and missing words, a tense baseline, quotes, consistency | Part 1 merged (PR #174); part 2 in review; part 3 next |
| 3c | [Craft flags](slice-3c-craft-flags.md) | Cliché, gesture strain, in-chapter continuity, register shift: flags with a recommendation, never edits | Queued; needs an ADR amendment |
| 4 | [Workshop Proofread button](slice-4-workshop-proofread.md) | Bubble action, confined write target, re-pin | Planned |
| 5 | [Apply to Draft](slice-5-apply-to-draft.md) | Apply Recommendations, then Apply Variation | Planned |

Each slice builds on the one before. Slice 2 needs Slice 1's anchoring and
issue ledger. Slice 4 needs Slice 2's write side. Slice 3b comes before the
Workshop slices at the writer's request (2026-10-26), so the button there
proofreads with the wider coverage. Slice 3c follows it, also before the
Workshop slices at the writer's request (2026-10-26).

## Project rules (from the integration branch)

- **No live or billable provider calls,** in tests or anywhere else. Provider
  clients run on mocked transport.
- **Public-domain fixtures only** (*Alice's Adventures in Wonderland*).
  Never put manuscript text, or a manuscript's character names, into the
  repo, tests, docs, or commit messages.
- **Node 18.** The full suite passes under Node 18, CI's version, before
  every push. Never assert V8-specific error wording.
- **Code rules:** core never imports `vscode`; modules stay under 500 lines;
  no new `any` without a documented reason; semantic import aliases only;
  `extension.ts` stays the composition root.
- **No model identifiers** in commits, PR titles, or PR bodies.
- **Review flow.** Astra commits her report under `docs/pr-reviews/` on the
  PR branch. The author:
  1. fixes her findings;
  2. appends a response under her report, leaving her text unchanged;
  3. merges only when she reports no blocking finding on the exact head and
     CI is green on her report commit.

## Expected conflict surfaces with Lightbox work

`shared/types/messages/index.ts`, `MessageHandler.ts`, `extension.ts` and
`CoreServices`, `apps/vscode-extension/package.json` `contributes`,
`boundaries.test.ts`, the `ModelScope` union and `ModelScopeSelections.ts`,
and the test inventory in `.ai/central-agent-setup.md` (`AGENTS.md`).

## Verification (every slice)

- Run CI's four steps under Node 18: `npm run typecheck`, `npx jest` (full
  suite), `npm run lint`, and `npm run build`.
- `packages/core/src` has no `from 'vscode'` (guarded by the architecture
  tests).
- Before Slice 2 ships, the writer runs Flag in the Extension Development
  Host on seeded public-domain fixtures and records the false-positive
  rate. That run confirms or replaces the default model.

## Completion criteria

- The ADR's acceptance criteria hold, as listed in
  [Feature: Proofread](../../features/feature-proofread/README.md#acceptance-criteria).
- Every write goes through `DraftEditApplier`, enforced by the one-write-door
  guard.
- Every behavior has a focused test: pure units, the codec, the service on
  mocked transport, the use case, the adapter mapping, and the architecture
  guards.

## Progress notes

- **2026-10-25. Slice 0.**
  - Merged `epic/lightbox` at `f75ed80` (`a89af209`).
  - Moved the recovery registry out of the Workshop (`d058e8d2`).
  - Reconciled the ADR with the Lightbox precedents and marked it Accepted.
    The writer's decisions: the name "Draft Edit", confirmation above 15,000
    words, and an own `proofread` scope with a cheap default.
- **2026-10-25. Slice 1 built.**
  - The `proofread` scope (`5e07d91d`) and the deterministic core
    (`c97fcbfd`).
  - The Proofread pass and its key-retirement behavior (`e50c2b36`).
  - The ports, the use case, the commands, and the adapters (`fd5f3133`).
  - Guards, docs, and the Workshop catalog fix (`f1a6e79f`); `epic/lightbox` at
    `31edcfd` merged in (`5663ebd7`).
  - CI green under Node 18; the full suite also passes under Node 22.
  - See the slice's "As built" for the departures from plan, each mirrored
    in the ADR.
- **2026-10-25. PR #171 review fixes.** Astra's six blocking findings
  (F-01 to F-06) are fixed with regression tests. See the slice's "Review
  fixes" and the ADR's "Amendment 2026-10-25".
- **2026-10-25. Slice 1 merged** into `epic/lightbox` as `e3a7fac0`, after
  Astra's third re-review closed every finding. The writer ran Flag in their
  editor and reported it working, so the default Proofread model stays.
- **2026-10-25. Slice 2 built.**
  - The write-side hardening from PR #171's review (`a013267d`).
  - `DocumentEditor.applyEdits` and its VS Code adapter (`3fee84d0`).
  - `DraftEditApplier` and `reconcileEdits` (`c2d2a0c9`).
  - Proofread and Fix, and the quick fixes (`924a481f`).
  - The Refactor Preview spike, read from VS Code's source, is in the ADR's
    Slice 2 amendment. The writer chose review with the fixes unticked, as
    VS Code opens them.
- **2026-10-25. Slice 2 merged** into `epic/lightbox` as `daec95d3`, after
  Astra's third re-review closed F-01 and F-03 to F-06, with F-02 the
  writer's accepted limit. The writer reports Fix and Refactor Preview
  working well in their editor.
- **2026-10-26. Slice 3 built** on `claude/upbeat-galileo-y1l4yf`, restarted
  from `epic/lightbox` at `daec95d3`:
  - the **Prose Minion** submenu in the editor context menu, with every
    command under the "Prose Minion" category;
  - `proseMinion.proofread.spellingConvention`, sent with each chunk;
  - a selection run that replaces only the flags it reads again.
  - No threshold or other summary wording changed: no fixture run with a
    rate was recorded. See the ADR's "Amendment 2026-10-26: Slice 3,
    polish".
  - Slice 3b, Proofread's wider coverage, is queued as the next slice.
- **2026-10-26. Slice 3 merged** into `epic/lightbox` as `611bebd6`, after
  Astra approved it with no blocking findings.
- **2026-10-26. Slice 3b, part 1 built**, restarted from `epic/lightbox` at
  `611bebd6`: four flag-only categories (wrong, missing and extra words,
  person) and the narration baseline. See the slice doc's "Part 1: as
  built".
- **2026-10-26. Slice 3c, craft flags, queued** at the writer's request,
  before the Workshop slices: cliché, gesture strain, in-chapter continuity
  and register shift. All four are flags with a recommendation, never
  edits, and most read the whole chapter. The slice doc recommends a
  second pass beside Proofread, for the ADR amendment to decide.
- **2026-10-26. Slice 3b, part 1 merged** into `epic/lightbox` as
  `57489816`, after Astra approved it with no blocking findings.
- **2026-10-26. Slice 3b, part 2 built**, restarted from `epic/lightbox` at
  `57489816`: the word list (`proseMinion.proofread.wordList`) and name
  consistency, a host check over the whole document. See the slice doc's
  "Part 2: as built".

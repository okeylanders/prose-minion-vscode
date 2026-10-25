# Epic: Draft Edit

**Status:** In progress. Slice 1 built and in review.
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
- **Ports:** `IssueAnnotator` (Slice 1) and `DocumentEditor` (Slice 2), both
  `vscode`-free.
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
| 1 | [Read side + Proofread and Flag](slice-1-read-side-and-flag.md) | Flag a file or selection as diagnostics; Clear; long-file confirm | Built; in review |
| 2 | [Write side + Proofread and Fix](slice-2-write-side-and-fix.md) | `DocumentEditor`, the applier, Fix with Refactor Preview, quick fixes | Planned |
| 3 | [Polish](slice-3-polish.md) | Submenu, spelling convention, summary refinements | Planned |
| 4 | [Workshop Proofread button](slice-4-workshop-proofread.md) | Bubble action, confined write target, re-pin | Planned |
| 5 | [Apply to Draft](slice-5-apply-to-draft.md) | Apply Recommendations, then Apply Variation | Planned |

Each slice builds on the one before. Slice 2 needs Slice 1's anchoring and
issue ledger. Slice 4 needs Slice 2's write side.

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

# Epic: Draft Edit

**Status:** In progress. Slices 1 to 3c and the reasoning levels (3d) are
merged and **shipped in v2.12.0** (2026-11-02): Proofread and Craft Flags,
with their commands, settings and reasoning levels. Slices 1 to 3 are PRs
#171 to #173; Slice 3b, PRs #174, #176 and #182; Slice 3c, PRs #177 to #180;
reasoning levels, PR #181. Left: Slice 4 (the Workshop Proofread button) and
Slice 5 (Apply to Draft), both planned. Apply to Draft is the writer's pick
(2026-11-04) and needs Slice 4's groundwork first (see Slice 5). The fixture
run is not scheduled: the writer will judge the categories by using them and
circle back.
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
| 3b | [Proofread coverage](slice-3b-proofread-coverage.md) | Names, wrong and missing words, a tense baseline, quotes, consistency | Merged (PRs #174, #176, #182); released in v2.12.0 |
| 3c | [Craft flags](slice-3c-craft-flags.md) | Cliché, gesture strain, in-chapter continuity, register shift: flags with a recommendation, never edits | Merged (PRs #177 to #180: the pass and cliché, register shift, gesture strain, continuity); released in v2.12.0 |
| 3d | Reasoning levels (ADR, "Amendment 2026-10-27: reasoning levels") | A named thinking level per pass, its budget on top of the reply's own ceiling; a reply the thinking cut off says so | Merged (PR #181); released in v2.12.0 |
| 4 | [Workshop Proofread button](slice-4-workshop-proofread.md) | Bubble action, confined write target, re-pin | Planned; Slice 5 needs its write target |
| 5 | [Apply to Draft](slice-5-apply-to-draft.md) | Apply Recommendations, then Apply Variation | Planned; the writer's pick (2026-11-04) |

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
- **2026-10-26. Slice 3c decided in part** by the writer: a second pass,
  *Craft Flags*, with its own command beside Proofread, and each category's
  approach as the slice doc describes it. The rest of its questions go to
  its ADR amendment.
- **2026-10-26. Slice 3b, part 2 merged** into `epic/lightbox` as
  `fd145a6a`, after Astra approved it.
- **2026-10-26. Slice 3c decided** by the writer: the slice doc's six
  recommendations adopted, and cliché first. The ADR's "Amendment
  2026-10-26: Slice 3c" records them and decides part 1.
- **2026-10-26. Slice 3c, part 1 built**, restarted from `epic/lightbox` at
  `fd145a6a`: the Craft Flags pass, its own flags and model, and cliché.
  See the slice doc's "Part 1: as built".
- **2026-10-27. Slice 3c, part 1 merged** (PR #177), after Astra's review
  and three re-reviews.
- **2026-10-27. Slice 3c, part 2 decided** by the writer: the register call
  names the chapter's register itself, in its reply, rather than a separate
  call or a host measure.
- **2026-10-27. Slice 3c, part 2 built**, restarted from `epic/lightbox` at
  `f7b0c851`: register shift and `proseMinion.craftFlags.categories`. See the
  slice doc's "Part 2: as built".
- **2026-10-27. Slice 3c, part 2 merged** (PR #178), after Astra's review
  and one re-review.
- **2026-10-27. Slice 3c, part 3 decided** by the writer: the model judges
  every gesture flag, a thin beat's included, and host code only counts
  each stock beat beside the note. There is no host-flagged density
  threshold.
- **2026-10-27. Slice 3c, part 3 built**, restarted from `epic/lightbox` at
  `98819b34`: gesture strain and its stock-beat counts. See the slice doc's
  "Part 3: as built".
- **2026-10-27. Slice 3c, part 3 merged** (PR #179), after Astra's review
  (two optional notes taken) and one re-review.
- **2026-10-27. Slice 3c, part 4 built**, restarted from `epic/lightbox` at
  `684bad24`: continuity, a flag's related range on the annotation port, and
  the section detector in a shared home. See the slice doc's "Part 4: as
  built".
- **2026-10-27. Slice 3c, part 4 merged** (PR #180, `b24bdd04`), after
  Astra's review (three P2 findings on the scene-break rule, two P3 notes)
  and two re-reviews, the last clear. Slice 3c's four categories are in;
  the fixture run decides their defaults.
- **2026-10-27. Reasoning levels decided and built.** A Proofread chunk on
  the default model spent about 3,700 of its 4,000 output tokens thinking
  and was cut off. The writer decided a named level per pass (`off`,
  `light`, `standard`, `deep`), its budget on top of the reply's own
  ceiling, Proofread `light` and Craft Flags `standard` by default, these
  two passes only. See the ADR's "Amendment 2026-10-27: reasoning levels".
  To confirm in the writer's acceptance pass: OpenRouter's field names, by
  one Proofread chunk at `off` and one at `light`.
- **2026-10-27. Reasoning levels reviewed** (PR #181). Astra's F-01: `off`
  must never reach a model the catalog marks as always reasoning. Each pass
  now asks the live catalog at `off` about the exact model it sends to, and
  refuses a mandatory one with nothing sent; a catalog that cannot say sends
  `off` as asked. OpenRouter's field names are confirmed from its
  documentation.
- **2026-10-27. Reasoning levels merged** (PR #181, `1b2b3ac9`), after
  Astra's review (F-01, refusing `off` on a model that always reasons) and
  her re-review, clear.
- **2026-10-27. Slice 3b, part 3 built**, restarted from `epic/lightbox` at
  `1b2b3ac9`: quotation marks (`quotation`) and consistency
  (`consistency`), two host checks over the whole document, flag-only. The
  writer's call: finish 3b before the release, "a better stopping point".
  See the slice doc's "Part 3: as built".
- **2026-10-27. Slice 3b, part 3 merged** (PR #182, `5042767d`), after
  Astra's review (F-01 to F-03: a compound's parts placed by the lowered
  word, a listed compound's part still flagged, emphasis misreading a
  quotation mark's place) and a re-review (F-04: work growing with the
  square of a long compound's length), then clear.
- **2026-10-28. Aggregate review of `epic/lightbox` into `main`** (PR #183)
  found two Draft Edit defects that slipped between the slices' guards. Both
  are decided in the ADR's "Amendment 2026-10-28": a full reference link's
  label is protected, and Proofread's gesture is held as Craft Flags' is.
- **2026-11-02. v2.12.0 released** (tag `v2.12.0`), with Lightbox and Draft
  Edit: Proofread and Fix, Proofread and Flag, Craft Flags, the word list,
  the spelling convention and the reasoning levels. The release notes say
  native VS Code acceptance and live-provider quality are separate from the
  automated checks, and keep the Refactor Preview lifetime limit (PR #172
  F-02) and the other documented limits.
- **2026-11-04. Direction (the writer).** The fixture run is not scheduled.
  The writer will find false positives and weak defaults by using the tools
  and come back to them; Slice 3's thresholds, Slice 3b's rule that a
  category earns a fix only after a recorded run, and Slice 3c's defaults
  stand as they are until then. Apply to Draft is the next thing the writer
  wants. It needs Slice 4's groundwork first: `WorkshopExcerptWriteTarget`,
  the excerpt replacer and the `WorkshopDraftEditHandler` route owner exist
  only in the docs, and Slice 5 shares them. Whether that is all of Slice 4
  or only its write target is the first thing to decide. Not recorded in the
  repo: whether the writer ran the `off` and `light` reasoning pair the ADR
  asked for before the release.

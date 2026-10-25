# Draft Edit Slice 1 built: Proofread and Flag

**Date:** 2026-10-25 01:20 UTC
**Branch:** `claude/upbeat-galileo-y1l4yf`, built off `epic/lightbox` (merged
in at `f75ed80` as `a89af209`). PRs target `epic/lightbox`, never `main`.
**Decision:** [ADR 2026-10-21 — Draft Edit Engine and Document Write-Back](../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md) (Accepted 2026-10-25)
**Tracking:** [Epic: Draft Edit](../.todo/epics/epic-draft-edit-2026-10-25/README.md),
[Slice 1](../.todo/epics/epic-draft-edit-2026-10-25/slice-1-read-side-and-flag.md)

## Shipped on the branch

The editor context menu offers **Prose Minion: Proofread and Flag** on
Markdown and plain-text files, for a selection or the whole file. Issues
appear as diagnostics:

- information for surface errors, warnings for tense and agreement;
- a suggested correction in the message;
- Dismiss and Clear code actions;
- flags follow their text as the writer types, clear on close, and are
  session-only.

A whole file over 15,000 words asks first. Runs are cancellable. The summary
reports counts and the honest cost (unknown, never a made-up $0). Nothing
writes to a document yet: that is Slice 2.

## Commits

- `d058e8d2`: moved the recovery registry out of the Workshop and renamed it.
  This includes the Lightbox imports.
- `cae5cce5`: ADR Accepted and reconciled with the Lightbox precedents; the
  epic and its slice docs.
- `5e07d91d`: the `proofread` model scope, an own scope defaulting to
  `anthropic/claude-haiku-5.5`.
- `c97fcbfd`: the deterministic core (protected regions, chunking, anchoring,
  range shifting, the guard).
- `e50c2b36`: the Proofread pass (prompts, frame, codec, service,
  key-retirement behavior).
- `fd5f3133`: the ports, the use case, the summary, the adapters, and the
  commands.
- `f1a6e79f`: guards, the Workshop catalog fix, and docs.
- `5663ebd7`: merged `epic/lightbox` at `31edcfd` (Slice 4J, PR #170).

## Decisions (the writer's, 2026-10-25)

- The engine is named **Draft Edit**; the feature is **Proofread**.
- A whole-file run confirms above 15,000 words; a selection never does.
- `proofreadModel` is an own scope with a cheap default; it does not follow
  the Workshop.
- Flags do not survive a reload.
- Build off `epic/lightbox`.

## Context worth keeping

- **The whole core barrel cannot load under jest** (`p-limit` is ESM). App
  tests mock `@prose-minion/core` and `jest.requireActual` the modules they
  need. Core tests mock `p-limit`.
- **No `commandPalette` rules**, by a manifest test. Commands refuse
  unsupported contexts with a message instead.
- **A retired engine** (after the key is removed or replaced) throws
  `AgentRunUnavailableError('missing-credentials')`. `ProofreadService` reads
  that as "key changed", stops starting chunks, and keeps finished ones.
- **Models drop the space** between their context words and the quote.
  Anchoring tries each junction both ways.
- **CI's Node 18** is reproducible locally with the `node-linux-x64@18` npm
  package. Run the four CI steps under it before every push.

## Verification

- Node 18.20.8: typecheck, lint, build, and the full suite (531 suites /
  7,378 tests / 59 snapshots, with `epic/lightbox` at `31edcfd` merged in).
- Node 22: the full suite.
- No live provider calls. Fixtures are public-domain *Alice*.
- Pending: the writer's Extension Development Host pass and false-positive
  check on seeded fixtures. That run confirms or replaces the default model
  before Slice 2.

## Follow-ups

- Slice 2: the write side and Proofread and Fix. Spike first on how
  `applyEdit` behaves with Refactor Preview.
- Slice 3: a selection run replaces only its own flags; spelling convention;
  submenu; threshold tuning.
- [Shared token-usage sum](../.todo/tech-debt/2026-10-25-shared-token-usage-sum.md)
  for the Lightbox and the Dictionary.

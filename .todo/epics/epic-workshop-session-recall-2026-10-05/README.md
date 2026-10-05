# Epic: Workshop Session Recall

**Status:** In progress — D1–D4 accepted 2026-10-05; Slices 0–1 done (behavior-preserving); Slice 2 in review (dormant recall core)
**Priority:** Medium
**Created:** 2026-10-05
**Integration branch:** `epic/workshop-session-recall` (from `main` at `30b5236`); work arrives by reviewed PRs: Slices 0–1 from `claude/practical-ritchie-rx9n4t` (#125), Slice 2 from `claude/workshop-recall-core`
**Decision:** [ADR 2026-10-05 — Workshop Personas Recall Saved Session Transcripts](../../../docs/adr/2026-10-05-workshop-session-transcript-recall.md) (Accepted in part: D1–D4)
**Evidence:** [Architecture change runway](../../../docs/architecture/2026-10-05-workshop-session-recall-runway.md)
**Realizes:** the host-fetch half of [Feature: a prior conversation is a resource, not a branch](../../features/feature-prior-conversation-as-resource/README.md)

## Goal

Let a Workshop persona look back at the writer's other saved sessions:
list them, search their **visible** transcripts, and read a whole transcript
or chosen turns. Filenames and widget names are visible; attachment text,
widget payloads, capability evidence, context bodies, and provider histories
are not. This is the first slice of a memory feature, so it fixes one
visibility contract that later memory work reuses.

## Problem

A new Workshop room has no path to any earlier conversation. The only
cross-session search today is the session browser's, which walks the whole
serialized checkpoint, private bodies included, and whose coordinator entry
point flushes the live room. Personas are told not to present improvisation as
memory, so "like we decided last week" leaves them asking the writer to paste.

## Shape

- A `transcript.catalog | transcript.search | transcript.read` capability
  family, delegated to a per-turn sub-adapter like `resource.*`.
- A read-only `WorkshopTranscriptRecallService` over the session store
  (`list()` without a query, `readNamed`), the live room excluded through one
  coordinator query, `recallScope()`.
- The transcript projection moves to a neutral `transcript/` home and is shared
  by export and recall. "Turn N" is the 1-based ledger position.
- Evidence framed as a quoted record, never memory. The grammar lives in a
  system-prompt file so reopened rooms gain it.
- Search de-duplicates by turn id, because copies and branches repeat their
  source's turns across the corpus.

## Sprints (implementation slices)

Each slice is independently reviewable. The runway's §2.10 has files,
verification, and rollback seams.

| # | Slice | Outcome | Status |
|---|---|---|---|
| 0 | Characterize | Sentinel visibility tests over the projection; a test that an unknown capability operation fails to decode; per-family label assertions | Done — `83f2cf6` |
| 1 | Behavior-preserving ownership | Projection moved to `transcript/` with a per-turn projector; one exhaustive `workshopCapabilityFamily()` replaces four prefix checks; operation, artifact, and context-kind unions derived from single `as const` lists their validators read | Done — `2e54b88`, `357f5bb`, `24ad18d`, `875f203` |
| 2 | Recall core (dormant) | Pure document, search, and renderer modules; the recall service; coordinator `recallScope()`; budgets block | Done, in review — `ae7b7b6`, `50d4da5`, `3242662`, `7938d7e`, `0a3cdeb`, `05c0f43`, `dffc1a8`; review fixes `f3779af`, `cce3889`, `b4cab1b`, `689f96e`, `65ea614`, `3b5b6e5`, `970ed75` |
| 3 | Contract, persistence, wiring (dormant to models) | Unions, codec, sub-adapter, persona-capability branches, persisted operation, artifact, and archive-kind lists, labels, Context Budget kind, composition root | Not started |
| 4 | Enable | `transcript-recall-capability.md`, prompt path chain, `base.md` / `guest-base.md` / `interaction-contract.md` amendments, sync test, docs | Not started |
| 5 | Verify live | Extension Development Host pass on real saved sessions; budgets tuned; ADR accepted; memory-bank entry | Not started |

## Progress notes

- **2026-10-05 — Slices 0–1.** Full suite 247 suites / 3,085 tests, typecheck,
  lint (no new warnings), and production build pass. The lists landed before
  the family helper, because rejected-request recording needs an
  `isWorkshopCapabilityOperation` guard. Slice 0 added a stronger witness than
  planned: the persisted codec's exact keys already refuse a message-attachment
  body on a saved turn. A compile experiment (listing a new operation, then a
  new family, without handling either) confirmed every consumer fails to
  compile, and caught one family switch that returned `undefined` silently; it
  now has an explicit `never` default. Rule for Slice 3: a family switch whose
  return type admits `undefined` needs that default.
- **2026-10-05 — Slice 2 (dormant recall core).** Seven modules under
  `recall/` (document, search, renderer, read window, clock, results, service),
  coordinator `recallScope()`, and the budgets block with its exact-value pin.
  Nothing calls the service yet. Okey decided three open questions: `recallScope()`
  answers `not-ready` until hydration, cold-parse bytes are estimated by
  re-serializing, and a query of only stop words keeps its words. The ADR's
  Slice 2 note records these and every other refinement.
  - Visibility: a real session saved through the real aggregate, coordinator,
    and store is the witness. It carries markers in an attachment body,
    persisted evidence, the evidence the real summary copied into `preview`,
    the conversation archive, context bodies, the excerpt, and its identity.
    None reaches recall's data or its rendered text. Mutating the header to
    carry the preview, or the context labels to carry their bodies, fails the
    witness.
  - Boundaries: `recall/` may import the store and coordinator only as types,
    and may not import the room-frame or thread-artifact renderers. Its files
    joined the capability boundary. Each guard was mutation-checked.
  - Verification: full suite 252 suites / 3,176 tests on both Node 22.22 and
    Node 18.20 (baseline 247 / 3,085). Typecheck (core, webview, extension)
    and the production build with `verify:bundle` pass. ESLint reports no
    problems on the 18 changed TypeScript files.
  - For Slice 3: the sub-adapter takes provenance turn ids from the rendered
    read's `delivered` ranges. The codec owns query length, session-id shape,
    and range count, because the service throws on an invalid range.
    `resultLogSummary` needs its exhaustive recall case (PR #125 review F-01).
- **2026-10-05 — PR #126 review fixes.** Okey's review requested changes on
  four Standard findings and one nit, each reproduced against the real store.
  - F-01: a read could exceed its budget three times over.
  - F-02: failed cold reads spent nothing.
  - F-03: the cache charge skipped citation URLs.
  - F-04: the scope was checked only at entry.
  - F-05: lineage folded on normalized text.

  All five are fixed, each with witnesses that fail against the reviewed
  head. A read that fails during cancellation now rejects as a cancellation.
  The ledger in `docs/pr-reviews/pr-126-workshop-session-recall-core-review.md`
  and the ADR's Slice 2 note record the details. Full suite 253 suites /
  3,200 tests on Node 22 and Node 18; typecheck, build, and lint of the 21
  changed TypeScript files are clean.
- **2026-10-05 — PR #126 re-review.** Okey verified F-02 through F-05 and
  left part of F-01 open: a saved file listing one participant 10,000 times
  rendered a 60,451-character read with no entries.
  - Fixed in `17647eb` and `07de2c4`. Participants are listed once each.
  - The read header and footer have hard caps; `readCharacters` has a
    6,000-character minimum.
  - Saved-file speaker and attachment labels are clipped in reads and
    search.
  - That reproduction now renders 607 characters and delivers turns 2-3.

  Full suite 254 suites / 3,215 tests on Node 22 and Node 18; typecheck,
  build, and lint of the changed files are clean.

## Decisions (accepted 2026-10-05, as recommended)

- **D1** Family shape and name: a dedicated `transcript.*` family.
- **D2** Corpus: named saved sessions, live room excluded.
- **D3** Writer control in v1: none beyond visible artifacts.
- **D4** Visibility edge cases: context-attachment labels in the header, and
  private instrument exchanges marked private, as export does.

## Measurements

- **U1 — resolved 2026-10-05.** Okey's largest named sessions are 1.1–2.2 MB;
  through the real codec a session costs about 11–13 ms per MiB, and visible
  text is 8–16% of the file. On-demand projection holds; no persisted index for
  v1. See [u1-measurements.md](u1-measurements.md), which includes the script
  for rerunning it. Slice 5 still records wall-clock times and the session count.
- **U2 — open.** Whether the fastest supported model copies 36-character
  session ids reliably (Slice 5 live check).

## Completion criteria

- [x] D1–D4 recorded in the ADR (accepted 2026-10-05).
- [ ] ADR fully accepted after the live pass settles open questions 5–8.
- [ ] A persona can catalog, search, and read saved sessions in host and guest
      conversations, including rooms reopened from before the change.
- [ ] Sentinel tests prove no attachment, widget, evidence, context, archive,
      or summary-preview text reaches recall output.
- [ ] Recall never writes, flushes, or reads `current.json`; the live room never
      appears in its own corpus; a changed workspace root disables recall.
- [ ] A session containing every new persisted value saves **and reopens**
      with every participant's retained conversation imported (the archive kind
      list is checked only at reopen).
- [ ] A turn shared by a session, its copy, and a branch appears once in search
      results, attributed to the newest session, with the others named.
- [ ] Bounds are disclosed in every truncated result; wall-clock search times
      and U2 are measured and recorded.
- [ ] Focused and full tests, typecheck, lint, build, and an Extension
      Development Host pass are recorded.

## Follow-up boundary

Out of scope here, recorded for the memory feature: per-session digests and
their storage, a "Previously…" frame at conversation start, semantic search,
per-session exclusion from recall, recall of the live room's own early turns
after context compaction, and the July note's writer opt-in attachment path.

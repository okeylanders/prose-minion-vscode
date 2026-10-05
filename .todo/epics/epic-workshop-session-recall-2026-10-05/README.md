# Epic: Workshop Session Recall

**Status:** Approved for implementation — D1–D4 accepted 2026-10-05; implementation not started
**Priority:** Medium
**Created:** 2026-10-05
**Branch:** `claude/practical-ritchie-rx9n4t` (design)
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
| 0 | Characterize | Sentinel visibility tests over the projection; a test that an unknown capability operation fails to decode; per-family label assertions | Not started |
| 1 | Behavior-preserving ownership | Projection moved to `transcript/` with a per-turn projector; one exhaustive `workshopCapabilityFamily()` replaces four prefix checks; operation, artifact, and context-kind unions derived from single `as const` lists their validators read | Not started |
| 2 | Recall core (dormant) | Pure document, search, and renderer modules; the recall service; coordinator `recallScope()`; budgets block | Not started |
| 3 | Contract, persistence, wiring (dormant to models) | Unions, codec, sub-adapter, persona-capability branches, persisted operation, artifact, and archive-kind lists, labels, Context Budget kind, composition root | Not started |
| 4 | Enable | `transcript-recall-capability.md`, prompt path chain, `base.md` / `guest-base.md` / `interaction-contract.md` amendments, sync test, docs | Not started |
| 5 | Verify live | Extension Development Host pass on real saved sessions; budgets tuned; ADR accepted; memory-bank entry | Not started |

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

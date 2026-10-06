# Epic: Workshop Session Recall

**Status:** In progress — D1–D4 accepted 2026-10-05, D5–D11 2026-10-06; Slices 0–3 merged (Slices 2, 2B, and 2C are the recall core; Slice 3 wires it, dormant to models); Slice 4 (enable) built and in review
**Priority:** Medium
**Created:** 2026-10-05
**Integration branch:** `epic/workshop-session-recall` (from `main` at `30b5236`); work arrives by reviewed PRs: Slices 0–1 from `claude/practical-ritchie-rx9n4t` (#125), Slice 2 from `claude/workshop-recall-core` (#126), Slice 2B from `claude/workshop-recall-todos` (#127), Slice 2C from `claude/workshop-recall-excerpts` (#129), Slice 3 from `claude/workshop-recall-wiring` (#130), Slice 4 from `claude/workshop-recall-prompts`
**Decision:** [ADR 2026-10-05 — Workshop Personas Recall Saved Session Transcripts](../../../docs/adr/2026-10-05-workshop-session-transcript-recall.md) (Accepted in part: D1–D11)
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
| 2 | Recall core (dormant) | Pure document, search, and renderer modules; the recall service; coordinator `recallScope()`; budgets block | Done, merged in #126 (`57d097a`). Build: `ae7b7b6`, `50d4da5`, `3242662`, `7938d7e`, `0a3cdeb`, `05c0f43`, `dffc1a8`. Review fixes: `f3779af`, `cce3889`, `b4cab1b`, `689f96e`, `65ea614`, `3b5b6e5`, `970ed75`. Re-review fixes: `17647eb`, `07de2c4` |
| 2B | To-dos (dormant) — [plan](slice-2b-transcript-todos.md) | `transcript.todos` core: the writer's to-do lists across saved sessions (D5–D7), the family `<match>` rule (D8), and tool-reply speakers indexed | Done, merged in [#127](https://github.com/okeylanders/prose-minion-vscode/pull/127) (`ababfde`). Build: `170b8fa`, `4e9cafb`, `265d7ca`, `fdc771c`, `c521ffd`, `fb39346`, `6ed1a95`. Review fixes: `f6c3bef`, `84b1977` |
| 2C | Excerpt summaries (dormant) — [plan](slice-2c-excerpt-summaries.md) | Catalog `<match>`, multi-session reads with fair shares (D9), discussion detail (D10), 150K read and per-turn budgets (D11) | Done, merged in [#129](https://github.com/okeylanders/prose-minion-vscode/pull/129) (`23b7779`). Build: `0b5a19d`, `2f92684`, `69f39dd`, `7515c2e`, `d2cb265`, `39cf8f9`, `83a72e7`, `ead6a5a`, `f6e8c17`. Review fixes: `fe4c150`, `f93f309` |
| 3 | Contract, persistence, wiring (dormant to models) | Unions, codec, sub-adapter, persona-capability branches, persisted operation, artifact, and archive-kind lists, labels, Context Budget kind, composition root. Also widens for 2B and 2C: `transcript.todos`, multi-session read and `<match>` codecs, the context-window clamp, and the per-turn read total | Done, merged in [#130](https://github.com/okeylanders/prose-minion-vscode/pull/130) (`b2fe8dd`). PR #129 follow-ups: `922ff59`, `a96d09d`, `91e9728`, `58ec000`, `70b9ba6`. Build: `6e87259`, `b4dfaa2`, `7897c0d`, `ebde98e`, `ba599d4`, `509cbc8`, `34f6ac4`, `364b5c5`, `41ee820`, `91466c1`, `214c446`, `a53aaeb`. Docs: `7131981`. Review fixes: `3f2d255`, `994b234` |
| 4 | Enable | `transcript-recall-capability.md`, prompt path chain, `base.md` / `guest-base.md` / `interaction-contract.md` amendments, sync test, docs | Built, in review from `claude/workshop-recall-prompts`. Epic table: `5a96d42`. Hint detail: `761f8ad`. Grammar and path chain: `656741e`. Sync test: `f4d5c13`. Pointer line: `7666ab2`. Charters and contract: `99018db`. Docs: `6e169e6`. Lint: `ef6b4fd` |
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

- **2026-10-06 — Slice 2B (dormant to-dos).** `todos()` on the recall
  service, the shared `<match>` rule, tool-reply speakers in search, and
  `WorkshopRecallTodoList` with a hard `todoCharacters` cap. Nothing calls
  them yet. The ADR's Slice 2B note records the choices the plan left open.
  - Witnesses use real to-dos, promoted, reworded, completed, and dismissed
    on the aggregate and saved through the real coordinator and store. They
    cover visibility sentinels, every filter alone and combined, the live
    room, staleness, positions after a real coordinator rewind, every bound,
    an unreadable file, a scope change mid-call, and a cap sweep with every
    saved-file label at its maximum. Each fix was reverted to confirm a
    witness fails.
  - Found: a guest's to-do makes its room unsavable
    ([tech debt](../../tech-debt/2026-10-06-workshop-guest-todo-unsavable.md),
    High). Out of scope here, so the guest source is witnessed
    synthetically.
  - Verification: full suite 256 suites / 3,265 tests on Node 22.22 and
    Node 18.20.8 (baseline 254 / 3,215). Typecheck, the production build with
    `verify:bundle`, ESLint on the 21 changed TypeScript files, and
    `git diff --check` are clean.

- **2026-10-06 — PR #127 review fixes.** Okey's review requested one
  Standard change and one nit, each reproduced against the real store.
  - F-01: a `<match>` with more than eight terms said "every term" while
    ignoring the ninth. The filters line now names the evaluated terms and
    those past the limit (`f6c3bef`).
  - F-02: sessions emptied only by the item limit were reported as having no
    to-do. A new bound counts filter-emptied sessions before the cap
    (`84b1977`).

  Full suite 256 suites / 3,271 tests on Node 22 and Node 18; typecheck,
  build, and lint of the changed files are clean.

- **2026-10-06 — Slice 2C (dormant excerpt summaries).** Catalog
  `<match>`, reads of up to ten sessions with fair shares, discussion
  detail, and the D11 budgets. Nothing calls them yet. The ADR's Slice 2C
  note records the choices the plan left open and two departures: a section
  module beside the renderer, and refusing an empty read.
  - Room first: document loading moved out of the 496-line service, with
    no change in behavior (`0b5a19d`).
  - Witnesses use real chats saved through the real aggregate,
    coordinator, and store. The use case runs end to end over three 6.7
    chats and a 6.8 decoy. The catalog finds every 6.7 chat and not the
    decoy. One read of all three fits 150,000 characters with every chat
    complete, every writer message and persona reply whole, and no tool
    report's body. The same read in full detail overflows and continues.
    `transcript.todos` lists the 6.7 to-dos.
  - Also witnessed: title-only and excerpt-only hits, punctuation variants,
    55 sessions past the catalog cap, the live room, and overflow terms.
    Fair shares: a short chat's leftover, a failing session's share, and
    allocation over 400 generated cases. A sweep covers one to ten sessions,
    25 budgets each, and both details, with every saved-file label at its
    maximum. The visibility suite covers reads of several sessions and
    discussion reads, as data and as text.
  - Mutation check: each guard was reverted on its own. Two reversions
    survive, both equivalent today, and the ADR note explains them. The
    check found two unwitnessed paths, now covered (`f6e8c17`).
  - For Slice 3, the codec should also refuse an empty `transcript.read`.
    And `<match>chapter 6.7</match>` drops an open conversation titled only
    "6.7 …" whenever another session matches every term. The grammar doc
    should teach `<match>6.7</match>` as the exhaustive form.
  - Verification: full suite 259 suites / 3,322 tests on Node 22.22.0 and
    Node 18.20.8 (baseline 256 / 3,271). Typecheck, the production build
    with `verify:bundle`, ESLint on the 22 changed TypeScript files, and
    `git diff --check` are clean.

- **2026-10-06 — PR #129 review fixes.** Okey's review approved Slice 2C
  with two nits, each reproduced against the real store.
  - F-01: a continuation did not carry the read's detail, so following one
    could change it. Every continuation now names it (`fe4c150`), except
    that of a one-session read in full detail.
  - F-02: a saved time past any Date aborted the whole read once Slice 2C
    sized it. Such a time now renders as unknown (`f93f309`).

  Full suite 259 suites / 3,326 tests on Node 22 and Node 18; typecheck,
  build, and lint of the changed files are clean.

- **2026-10-06 — Slice 3 (contract, persistence, wiring).** The
  `transcript.*` family works end to end and stays dormant to models.
  The ADR's Slice 3 note records the details.
  - Okey decided six questions: a sibling `<turns>` only beside one bare
    session; a read below the minimum is a recorded refusal naming what
    is left; one to-do manifest row per call; a hint in a read of several
    sessions names its session and full detail; the engine passes the
    capability a context window; and the free window subtracts the
    preflight's headroom.
  - Room first: call parsing left the 516-line codec, and result logging
    left the persona capability, each with no change in behavior.
  - One change outside the Workshop: `AgentCapability.fulfill(request,
    window?)`, measured by the preflight's own estimator.
  - Found while testing the "followed as written" rule against rendered
    text: two continuations or hints followed together carried two
    `<detail>` elements, which the codec refused. A read may now repeat
    `<detail>` when every copy agrees, and repeat the sibling `<turns>`.
  - Witnesses run over real saved sessions: every operation from XML to
    evidence, the read limits, the clamp (including a measured re-render
    of dense text), both refusals, provenance, rows, publication,
    cancellation, the sentinel suite through the evidence, a tool-call
    literal arriving escaped, and save and reopen through the real
    engine, coordinator, and store with a host and a guest conversation.
    A compile experiment and a mutation check of every guard pass.
  - The F-04 residual is closed by the host lifecycle: changing the first
    workspace folder restarts the extension host.

- **2026-10-06 — PR #130 review fixes.** Okey's review requested
  changes for one Standard finding and one nit.
  - F-01: the window clamp refused a mixed-density read that fit, after
    four proportional re-renders. `WorkshopRecallWindowClamp` now keeps the
    largest read it measured to fit: a first guess, one proportional
    step, the minimum, then interpolation, at most six renders. Only a
    minimum that measures over half the window is refused (`3f2d255`).
  - F-02: two hints naming one session of a batch name it twice. The rule
    stays; the ADR teaches combining their ranges, with a witness
    (`994b234`).

  Full suite 265 suites / 3,487 tests on Node 22 and Node 18; typecheck,
  build, and lint of the changed files are clean.

- **2026-10-06 — Slice 4 (enable).** Host and guest personas carry the
  `transcript.*` grammar in their system prompt, after the analysis
  grammar, so reopened rooms learn it too. The ADR's Slice 4 note records
  the details.
  - Okey decided four questions:
    - The grammar quotes only the numbers a persona acts on.
    - The first-turn contract gains one unconditional pointer line.
    - A persona recalls only when the writer refers to earlier work, and
      otherwise may offer once, in one line.
    - Guests share the grammar file. Their charter's paragraph on where
      results go was corrected, since it was already wrong about
      published evidence.
  - One approved runtime change: a one-session report hint names
    `<detail>full</detail>`. Followed together with a discussion
    continuation, it is now a `conflicting-detail` refusal instead of a
    silent re-collapse that spent a read.
  - Witnesses:
    - A sync test pins every quoted number, decodes every XML example
      through the real codec, and matches the taught hint forms against
      real renderer output, both ways.
    - A reopened host and guest get the grammar through the real
      `PromptLoader`, `ConversationManager`, and engine, with their frozen
      contracts untouched.
    - The guest charter's sharing claim is tied to `WorkshopRoomAudience`.
    - Each change, reverted on its own, fails a witness.
  - Verification: full suite 266 suites / 3,514 tests on Node 22.22.0 and
    Node 18.20.8 (baseline 265 / 3,487). Typecheck, the production build
    with `verify:bundle`, and `git diff --check` are clean. ESLint on the
    10 changed TypeScript files adds no warnings to any file.

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
- [x] A session containing every new persisted value saves **and reopens**
      with every participant's retained conversation imported (the archive kind
      list is checked only at reopen). Slice 3, through the real engine,
      coordinator, and store.
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

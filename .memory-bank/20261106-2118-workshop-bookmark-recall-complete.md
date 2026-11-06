# Workshop Bookmark Recall: complete

**Date:** 2026-11-06
**Epic:** [archive](../.todo/archive/epics/epic-workshop-bookmark-recall-2026-11-05/README.md)
**Decision:** [ADR 2026-11-05](../docs/adr/2026-11-05-workshop-bookmark-recall.md), Accepted 2026-11-06
**Branch:** `epic/workshop-bookmark-recall`, cut from `epic-pinned-context` at `f298098`, merged to `main` on Okey's approval after his live pass

## Facts

- **What it is.** Bookmarks became something personas can read and the writer can browse. Okey's use case: "can you see what I bookmarked in this session and propose any new memories?"
  - **`transcript.bookmarks`,** a fifth recall operation. It reads saved sessions and, on request, the open room, through a read-only port filtered by what the asking persona could see.
  - **A Bookmarks screen.** It is read-only, pages through every saved session, and is reached from the sessions menu and the Notes tab.
  - **"Remember this".** It turns a bookmark into a project memory with its source, from the open room or a saved session.
  - **Cited proposals.** A persona's memory proposal can cite the open room's bookmarked turns, and the host checks them at save.
- **How it was built.** A spec PR and three code PRs, each reviewed by Astra and merged on a clear verdict:
  - #214: the spec, ADR and slice docs;
  - #215: the recall operation;
  - #216: the Bookmarks screen;
  - #219: "Remember this" and cited proposals.

  #220 held the live-pass checklist. Two syncs (#218, #224) brought in Pinned Context's live-pass fixes, its close-out, and `main` with Project Memory (#221) and Pinned Context (#223).
- **The live pass** (2026-11-06). Okey: "This is working great so far." He reported no findings. During it he asked for two changes, both merged without a review round at his direction:
  - **#237:** a persona's capability calls per turn, 5 → 15;
  - **#238:** transcript reads 2 → 10 (sharing 300,000 characters), memory reads 2 → 5, full entries 1 → 3, analysis runs 1 → 2.

## Decisions

- **The open room is visible to personas, on request** (Q1). It is reached through `<scope>current</scope>`, never injected.
- **A result is never published to the room if any open-room row in it was hidden from the room** (#214 F-05). It stays with the persona that asked.
- **Refs name their source:** `{sessionId}/{bookmarkId}`, and `current@{liveSessionId}/{bookmarkId}`. A replaced room's ref is `stale-bookmark-ref`, never retargeted.
- **Saved-session citations in proposals are refused** until memories can have multi-session sources (#214 F-06).
- **The turn's ceilings are D11's.** The transcript characters a turn shares stay at two full reads, so ten reads share 300,000 characters rather than scaling to 1,500,000.

## Lessons the reviews taught

- **Say "the end" only where the text ends.** A window at the `<from>` ceiling claimed the message had ended (#215 F-01).
- **A listing must not prime a resolver's cache.** Paging the screen fed the store's exact-read path cache. Shared ids are now detected in page-local walk state, inside the page budget (#216 F-01, F-03, F-05).
- **Correlate a follow-up with its own operation.** Open at bookmark jumped after a superseded Open (#216 F-02). A saved-turn save took the room after its source read (#219 F-02).
- **Judge eligibility by the original, not by its projection** (#219 F-01).
- **A sync merge records its ancestry.** A single-parent sync commit was replaced by a real merge (#218).
- **Pin tests to the constant, not its value.** Raising `callsPerTurn` broke two tests that wrote `maxCapabilityRounds: 5`, which a search for the constant's name could not find. The full suite caught them before the merge.

## Verification

At `c808b982` (#238's head): typecheck clean; jest **753 suites / 10,481 tests**, all passing. CI passed on the epic's pushes from the #224 sync through `835120c2`.

## Follow-ups

- **[Reads that fit the window](../.todo/features/feature-workshop-reads-fit-the-window/README.md)** (high). Memory and file reads aren't fitted to the context window, so a full window fails the turn. The plan, with Okey's answers: half the room left for every read, an engine guard that lets the persona try a smaller read, and a multi-file `resource.read`. ADR first.
- **[Multi-session memory sources](../.todo/features/feature-workshop-memory-multi-session-sources/README.md):** for saved-session citations.
- **[Bookmark counts in the catalog](../.todo/features/feature-workshop-recall-bookmark-counts/README.md)** (low).
- **`WorkshopProjectMemoryHandler.ts` is at exactly 500 lines,** so its next change must split it.
- **Okey's session-store identity fix** for the shared exact-read cache path is going into Pinned Context's line upstream. It had not landed at the merge.
- **PRs #205 and #128** are still open into `main`, left alone as Okey asked. #205's tech-debt README conflicts with Wayfinding, and its scope test will need a `proseMinion.workshop.projectMemory` row.

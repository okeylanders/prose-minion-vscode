# ADR 2026-11-05: Bookmarks Personas Can Read, and a Bookmarks Screen

**Status:** Proposed (2026-11-05).
- The writer answered Q1–Q6 the same day ([answers](#the-writers-answers-2026-11-05)). Q1 changed D1: personas see the open room's bookmarks too, on request.
- The PR #214 review (F-01–F-07) tightened D1, D2, D5, D7, D8 and D10 ([review](../pr-reviews/pr-214-workshop-bookmark-recall-spec-review.md)).
- The live pass (2026-11-06) raised a persona's capability calls per turn from 5 to 15, at the writer's request (D11).
**Date:** 2026-11-05
**Epic:** [Workshop Bookmark Recall](../../.todo/epics/epic-workshop-bookmark-recall-2026-11-05/README.md)
**Feature:** [Bookmarks personas can read, and a Bookmarks screen](../../.todo/features/feature-workshop-bookmark-recall/README.md)
**Supersedes in part:** [ADR 2026-11-03: Workshop Wayfinding](2026-11-03-workshop-wayfinding.md):
- **D5, "Presentation only":** for saved sessions.
- **D10, the recall bullet.**
- **The shared `callsPerTurn: 5`** that [ADR 2026-07-29](2026-07-29-workshop-measurement-capability.md), [ADR 2026-10-05](2026-10-05-workshop-session-transcript-recall.md) and [ADR 2026-11-04](2026-11-04-workshop-project-memory.md) name: it is 15 (D11).

Everything else in D5 and D10 stands.
**Extends:**
- [ADR 2026-10-05: Workshop Personas Recall Saved Session Transcripts](2026-10-05-workshop-session-transcript-recall.md): a fifth `transcript.*` operation, under its amendment of 2026-10-06 (D5–D11).
- [ADR 2026-11-04: Workshop Project Memory](2026-11-04-workshop-project-memory.md): D3's provenance through the recall service, and D12's widened lists.

## Context

Workshop Wayfinding (merged to `main` 2026-11-05) gave the writer bookmarks:
- **Where they're kept:** host-owned, saved in the session file as `{ id, turnId, label?, createdAt }`.
- **Where they show:** the thread and the Notes tab.
- **Who sees them:** nobody but the writer. D5 and D10 kept them away from every persona.

At the Wayfinding Slice 8 review, Okey asked for five things:
1. A persona can read a session's bookmarks quickly, without reading the whole thread.
2. A persona can list bookmarks across all sessions, or a subset, filtered by session and date.
3. Each bookmark comes with its full message.
4. A session read shows which turns are bookmarked.
5. A screen lists every bookmark with its text and session, and can open the session.

Okey also made one requirement: every bookmark made today stays readable.

The code this builds on is already on this branch:
- **Recall** reads saved sessions through `recallScope()` and never the live room.
- **`transcript.todos`** is the template for an item list.
- **Project Memory** records provenance as `sourceSession` plus `sourceTurns`, and checks it through the recall service (`positionsOf`).

## Decision

### D1. Personas read bookmarks on request: the open room's and saved sessions'

- **Nothing is injected automatically (PR #214 F-01).** No room frame, catch-up, catalog frame or per-turn prompt carries live bookmark data of its own accord.
  - Setting, clearing or renaming a bookmark therefore never changes what any persona is sent, and the prompt cache stays stable.
  - A persona sees bookmarks only through `transcript.bookmarks` (D2) and the turn mark in `transcript.read` (D5). It reaches them when it asks, or when the writer asks it to look ("can you see what I bookmarked in this session and propose any new memories?").
- **A requested result is ordinary recall evidence.** Once a persona asks, the result is a capability result like any read. It is:
  - retained in that persona's history;
  - saved with the room and reopened with it;
  - published to the room under D7.

  The label in that result is quoted record text. It's a snapshot of what the persona was given, so it never changes when the bookmark later changes.
- **The open room counts (Q1, Okey).** `transcript.bookmarks` reads the open room's bookmarks as well as saved sessions' (`<scope>`, D2).
  - **Where recall reads the open room.** Recall still never lists, searches or reads the open room's turns. It reaches the open room's bookmarks through one read-only port, `WorkshopLiveRoomBookmarks`, which the session service implements over the live bookmark ledger and `readRoomLedger()`. Recall imports the port as a type only. It never imports the session service, and it never writes or flushes.
  - **What a persona may see from the open room.** It sees only the bookmarks on turns it could see. That means room-visible turns, and private exchanges it was part of, decided by the room's own audience rule (`WorkshopRoomAudience`). A private exchange between the writer and another persona stays private, and so do its bookmarks.
  - **What the result carries.** An open-room row says "this conversation". It carries the turn's position and the turn's **id** (PR #214 F-06). The id is the durable reference a proposal cites (D10) and a continuation reads (D2). A position is only where the turn stands now.
- **Today's bookmarks read unchanged.** The stored shape doesn't change. A session saved by the Wayfinding release reads into every new surface, and a fixture pins this.
- **The writer's labels are shown.** A label is the writer's own short text, like a to-do's, and is quoted as record text under recall's framing line. An unnamed bookmark shows its default label (`workshopBookmarkDefaultLabel`), which is computed at read and never stored.

### D2. A fifth recall operation: `transcript.bookmarks`

```text
<prose-minion-tool-call name="transcript.bookmarks">
  <scope>all</scope>                current | saved | all (default all: the open room first, then saved sessions)
  <recent>10</recent>               most recent N saved sessions (exclusive with <session>)
  <session>…</session>              or: one session; repeatable up to bookmarkSessionsNamed
  <match>…</match>                  chooses sessions, as D8 of 2026-10-06 defines (title + excerpt label)
  <persona>…</persona>              chooses sessions that persona took part in, as today
  <query>lighthouse</query>         filters bookmarks: label or message text
  <speaker>…</speaker>              filters bookmarks: who said the turn (persona, tool, or writer)
  <since>2026-10-01</since>         filters bookmarks by createdAt (a calendar day; zone below)
  <until>2026-11-04</until>         inclusive: the whole day
  <bookmark>…</bookmark>            one bookmark by its qualified ref: its whole message, in windows (F-07)
  <from>4000</from>                 with <bookmark>: continue the message from this character
</prose-minion-tool-call>
```

- **`<scope>`** picks where bookmarks come from:
  - `current` is the open room only, which is the "in this session" case.
  - `saved` is saved sessions only.
  - `all` is the open room first, then saved sessions.

  `<recent>`, `<session>`, `<match>` and `<persona>` choose saved sessions, so they're refused with `<scope>current</scope>`. The bookmark filters apply to every scope.
- **Dates (PR #214 nonblocking).**
  - `<since>` and `<until>` are calendar days in the zone of the session that holds the bookmark. That's recall's existing per-session zone, which is what its documents and clock use. For the open room, it's the room's own zone.
  - `<until>` includes the whole day.
  - An impossible date (`2026-02-30`), a malformed one, or `since` later than `until` is refused as `invalid-date`.
  - Slice 1 tests a UTC/local-day boundary and a DST change.
- **One bookmark in full (PR #214 F-07).** `<bookmark>{ref}</bookmark>` reads one bookmark's whole message in windows of `bookmarkMessageCharacters`. `<from>` continues from a character offset.
  - **The ref says which session the bookmark is from.** Bookmark ids are only unique within one session: the ledger mints them from its own counter and the clock, and Branch keeps a room's bookmarks. So every row shows a **qualified ref**, and `<bookmark>` takes that ref, never a bare id.
    - **Saved session:** `{sessionId}/{bookmarkId}`.
    - **Open room:** `current@{liveSessionId}/{bookmarkId}`. `liveSessionId` is the room's identity, from `recallScope()`.
  - **Checking the ref.** The host parses the ref and confirms its source exists. A saved session is checked through recall. An open-room ref must name the room that is open now. If the room has been replaced (by New, Open, Rewind into a new session, or Branch), the ref is refused as `stale-bookmark-ref`. It never silently targets another room.
  - **Same rules as a list.** It works the same in every scope, under the same audience rule and window clamp: a persona can read an open-room bookmark only if it could see the turn.
  - **What it can be combined with.** `<bookmark>` takes only `<from>`. Every other field is refused beside it, `<scope>` and `<session>` included, because the ref already names its source.
  - It is the continuation every cut message points to, in both the open room and saved sessions. It works even when the caller no longer holds the original message in its history.
- **The family's meanings stand.** `<match>` and `<persona>` choose sessions everywhere in `transcript.*` (2026-10-06 D8), and they keep that meaning here.
  - The filters that pick bookmarks are new and named for what they do: `<query>`, `<speaker>`, `<since>` and `<until>`.
  - This corrects the feature note, which had `<match>` and `<persona>` filter items. (Q2.)
- **Order of work, as `transcript.todos` does it:**
  1. Saved-session choice comes from the listing, with no file read. The open room's bookmarks come from the live port.
  2. `<recent>` caps how many sessions are read.
  3. Cold reads share `searchSourceBytes`.
  4. Bookmarks are filtered, then bounded.
- **What each bookmark shows:**
  - its label, then who said the turn and when the bookmark was made;
  - for a saved session: the session's id and title, the turn's id and its position; for the open room: "this conversation", the turn's id and its position;
  - the bookmark's qualified ref, for `<bookmark>`;
  - the message.
- **The message** is the turn as `projectWorkshopTranscriptTurn` shows it, the same rule as reads and export. A capability card shows its request summary, never its evidence, and no host-private body ever appears.
- **The message is whole when it fits.**
  - Each message is capped at `bookmarkMessageCharacters`. A longer one is cut at a stated point, with a hint that decodes exactly as written and fetches the rest: `transcript.bookmarks` with that row's qualified `<bookmark>` ref and `<from>`.
  - A saved-session row also names its session and turn, so `transcript.read` can show the bookmark in context. That's a second way in, not the continuation.
  - The whole body is packed into `bookmarkCharacters`, and is subject to the context-window clamp reads use, because it carries turn text.
- **Results** come grouped by session, with the open room first, then saved sessions newest first. Within a session they are in thread order.
- **Every bound** the service applies is stated in the body's footer, as `transcript.todos` does.

### D3. Bounds join `PROMPT_BUDGETS.workshopTranscriptRecall`

- **The new bounds:**

  | Bound | Value |
  |---|---|
  | `bookmarkSessions` | 50, the `<recent>` ceiling |
  | `bookmarkSessionsNamed` | 10, like a read |
  | `bookmarkItems` | 60 |
  | `bookmarkCharacters` | 24,000 |
  | `bookmarkMessageCharacters` | 4,000 |
  | `bookmarkQueryCharacters` | 200 |
  | `bookmarkFromMax` | the largest `<from>` offset, bounded by the turn's own length |

- **Where they're pinned:** `promptBudgets.test.ts` holds the values. The recall prompt states them, and `transcriptRecallPromptSync.test.ts` holds the prompt to them.
- **Final numbers** are set in Slice 1, against the renderer's minimum, the way `WORKSHOP_RECALL_MINIMUM_TODO_CHARACTERS` was.

### D4. Every list the operation joins, in one slice

Following Project Memory D12, Slice 1 adds the operation to every list at once:
- the operation list, the family case and the request union;
- the recall codec, with its validators and any new rejection reasons (date and query);
- the top-level codec's `inspect`, which has no exhaustiveness guard, so it is added by hand;
- the six operation switches in `WorkshopPersonaCapability`;
- the recall capability's `fulfill` switch and port;
- the four request-copy switches;
- the service method, the results and a new renderer module;
- the persisted artifact (D6);
- publication (D7);
- the budgets;
- the prompt and its sync test;
- the family, persona, audience, persisted-guard and wiring tests;
- `WORKSHOP_RECALL_MODULES`.

`WorkshopTranscriptRecallBookmarks.test.ts`, the Wayfinding D10 pin, is rewritten to test both halves of D1 (PR #214 F-01):
- **Nothing automatic.** Setting, clearing or renaming a live bookmark changes no frame, catch-up or per-turn prompt.
- **Requested evidence is ordinary evidence.** A requested result is retained, survives save and reopen, and is published only as D7 allows.

### D5. `transcript.read` marks bookmarked turns

- **The mark.** A bookmarked turn's header line in a read shows `bookmarked: "{label}"`.
- **Where it comes from.** The recall document carries the session's bookmarks: `buildWorkshopRecallDocument` copies them field by field, with positions and resolved labels, and counts them in its size. The mark is added by the read window's renderers: `renderEntry` for full entries, and `collapsedReport` for the one-line tool reports of `discussion` detail (PR #214 F-04). Discussion is the default for multi-session reads, and tool reports are bookmarkable, so both paths carry it. The mark counts toward the read's packing bounds and its full-read hint.
- **Where it never goes.** The mark is never part of the shared per-turn projection, so export and the turn preview stay as they are. This follows Wayfinding Slice 7b's rule: decoration belongs in renderers.
- **No separate list in a read.** It would repeat the turns, and `transcript.bookmarks` is the fast list.
- **No catalog count.** The session listing (`WorkshopStoredSessionSummary`) holds no counts. A catalog that "reads no session file" can't count without reading every file, or changing the search-index format. (Q4.)

### D6. A new persisted artifact kind: `transcript_bookmarks`

- **What it is.** A bookmarks call's card is persisted like every recall card. `transcript_bookmarks` joins `WORKSHOP_TURN_ARTIFACTS`.
- **Compatibility.** This widens a persisted enum, so a build older than this one refuses a saved room that holds such a card. It is forward-only, like Wayfinding D9. Bookmark storage itself doesn't change. (Q3.)

### D7. Publishing: a result is published only if every row may go to the room

**The rule (PR #214 F-05).** A bookmarks result has one audience as a whole, because that's how `workshopTurnAudience` works. So the host decides publication from what the result contains, not only from its operation.

- **Room-visible rows only.** The result is publishable room evidence, like `transcript.read` and `transcript.todos` (`PUBLISHABLE_CAPABILITY_OPERATIONS`).
  - Every open-room row in it must stand on a turn the whole room could see.
  - Saved-session rows follow recall's existing rule for saved turns, the rule reads already use.
- **Any row the room couldn't see.** If any open-room row stands on a turn the room couldn't see, the result is **never published**. That covers a private exchange, a guest's unpublished card, or anything else outside the room's audience.
  - It stays with the persona that asked, retained in its history (D1).
  - It never reaches a room frame, a catch-up, the host, or any other guest, and that still holds after the room is saved and reopened.
- **How it's marked.** The host stamps the result unpublishable when it builds it, with a reason the log names by id. There's no per-row audience and no second body. The whole-result policy stays as it is, and is never asked to filter.
- **The prompts.** `guest-base.md` and the recall prompt say a bookmarks result is shared with the room when it holds only room-visible bookmarks.
- **Tests (Slice 1).** Slice 1 pins this with a mixed result: a public row and a private sentinel, through reply commitment, the host's and another guest's catch-up, and save/reopen. The private sentinel never crosses. An all-public result is published as before.

### D8. The Bookmarks screen: read-only, through the recall service

- **Where it opens.**
  - "Bookmarks…" in the sessions menu, beside "Browse all sessions…".
  - "All bookmarks…" in the Notes tab's bookmark header.
  - It is never in the header. (Q5.)
- **What it is built from.** It composes the shared `SavedItemBrowserModal`, the way the memory browser does, mounted through its own mount component so `WorkshopApp.tsx` grows by wiring only.
  - **Read-only rows.** The rows add a new `readOnly` opt-in on `SavedItemBrowserModal` and `SavedItemRow`. That opt-in has no Rename or Delete, and leaves every existing caller's markup identical.
  - **Each row shows:**
    - the label;
    - the speaker, in its identity color;
    - the message's first lines;
    - the session's title;
    - the bookmark's date.
  - **Search and grouping.** Search covers labels and text. Rows group by date or by session.
  - **The live room's bookmarks** fill the browser's `leading` slot. They come from the host, not the snapshot (PR #214 F-03). The snapshot's summaries carry no date or text, and its turns are only a window, so the host builds each live row from the full ledger: label, `createdAt`, speaker, the projected message, and the turn id.
    - The request carries the room's `roomRevision`, and the host answers only for that room. After a room replacement, the webview drops the stale answer.
    - Search over live rows covers their full text.
- **Where the host reads them.**
  - **A writer-facing method on the recall service,** as `positionsOf` already serves the memory manager. It reads saved sessions through recall's corpus port and cache, never through `WORKSHOP_LIST_SESSIONS`, which initializes and flushes first.
  - **Pages, and saying how complete they are (PR #214 F-02).** The store caps a listing at 200 files, and loading documents is bounded by bytes. So the browser reads saved sessions in pages, through a new read-only paged enumeration on the store.
    - **The cursor.** `listPage({ after?, limit })` walks every session file in a stable order. It never initializes or flushes, and it isn't capped at 200.
    - **The page bounds.** Each page loads at most `bookmarkBrowserSessions` sessions within `bookmarkBrowserBytes`. These are writer-facing bounds, so they live beside the store's own listing bounds, not in `PROMPT_BUDGETS`.
    - **What each page returns:** its rows, a `next` cursor, and counts of sessions read, unreadable and not yet read.
    - **What the browser says:** what it covers ("Bookmarks from 120 of 340 saved sessions"), with "Load more" to continue.
    - **Search** covers the rows loaded so far, says so, and offers to load the rest.
    - **Cancellation and limits.** Each page is a correlated request, cancelled when the browser closes or the room changes. The host's resource limits stay as they are, per page.
    - **Separate from the persona's operation.** The model-facing `transcript.bookmarks` keeps its own bounds (D3). The browser's completeness is a writer-facing promise only.
  - **Composition.** The recall service joins `CoreServices`, built only in `extension.ts`. The composition pins move with it (`providerAssembly.test.ts`, the comment in `extension.ts`). Handlers still never construct it.
  - **Correlation.** Every request is correlated by a webview-minted `requestId`.
- **Actions.**
  - **Preview** shows a saved turn read-only, in the turn-preview sheet. The host projects that turn from the recall document, never from the live ledger. A live row previews from the host's live-row message, so a turn outside the window previews too.
  - **Open session** goes through the existing Open, confirmation included.
  - **Open at bookmark** opens the session, waits for the new room's snapshot, then jumps to the turn: through `useWorkshopTurnJump`, or the turn preview when the turn is outside the window.

### D9. "Remember this": a bookmark to a memory, with its source

- **From the live room.**
  - On a bubble in the window, or a Notes-tab row whose turn is in the window, it is Project Memory's existing `saveTurn`.
  - For a live bookmark whose turn is outside the window (the browser's `leading` rows, or a Notes-tab row), the sheet is prefilled from the host's live-row message (D8). It saves through Project Memory's live-turn route, which looks the turn up in the full ledger and checks the room (`roomRevision`) (PR #214 F-03).
- **From the Bookmarks screen.** A saved session's bookmark gets a new route that takes `{ requestId, sessionId, turnId, draft }`.
  - The host checks the turn through the recall service, and writes `{ origin: 'writer', sourceSession, sourceTurns: [turnId] }`.
  - The sheet gains a mode whose source line names the saved session ("from “Title”").
  - The prefill is the projected message the host supplies, never a webview copy.
- **Provenance only cites.** It points to the bookmark's moment and never stores the bookmark itself, so the two features stay independent. (Q6, in scope.)

### D10. A memory a persona proposes from the open room's bookmarks cites them

This is Okey's use case: "can you see what I bookmarked in this session and propose any new memories?"

- **Today's provenance.** A persona's proposal cites the reply that made it and the writer's message before it, both in the live room (`workshopProposalProvenance`). A memory holds one `sourceSession` and its `sourceTurns`, and the manager resolves every turn against that one session.
- **What changes.** A proposal may also cite **open-room** bookmarked turns, by the turn ids `transcript.bookmarks` shows (D1). Project Memory's proposal trailer gains an optional list of cited turn ids.
- **How the host checks them.** The host keeps a cited turn only if two things hold: the open room's ledger holds it, and the proposing persona could see it. Any other id is dropped and logged by id, never by text.
- **What the memory records.** The kept turns join `sourceTurns` beside the reply and the writer's message, deduplicated, within the existing bound of 32. `sourceSession` is still the live room, so one session holds every source and provenance reads back unchanged.
- **Saved-session citations are deferred (PR #214 F-06).** A proposal in room A citing bookmark B/t would need session-qualified sources that Project Memory's format 1 doesn't have. That would be a format change to an epic that is in its live pass.
  - This epic refuses such a citation: it is dropped and logged.
  - [A follow-up](../../.todo/features/feature-workshop-memory-multi-session-sources/README.md) records session-qualified, multi-source provenance.
  - "Remember this" from a saved bookmark (D9) needs no such change, because its one source is that saved session.
- **What doesn't change.** A proposal with no cited turns behaves exactly as today. The prompt teaches the field, and Project Memory's proposal sync test holds the prompt to it.

### D11. A persona may make 15 capability calls per user turn (2026-11-06)

The writer asked for it during the live pass ("more like 15").

- **One constant.** `PROMPT_BUDGETS.workshopCapability.callsPerTurn` goes from 5 to 15. It sets `AGENT_RUN_POLICIES.workshopHost.maxCapabilityRounds`, the ceiling for the host and every guest, and the number the persona's instruction and per-turn reminder state. Nothing else names it.
- **What doesn't change:**
  - **The per-operation limits stay.** They bound context, not calls: two `transcript.read`s within `readCharactersPerTurn`, two `memory.read`s, one `dictionary.full-entry`, one `analysis.run`.
  - **The other policies keep their rounds.** A tool chat (`workshopTool`), the sidebar assistant and context generation keep 2.
  - **The forced final reply still ends a turn at the ceiling.**
- **The cost.** Calls are serial, and each is another model round-trip carrying the conversation so far. A persona that uses all fifteen makes up to three times as many requests as before, and its evidence stays in context.
- **The window.** Only recall's reads are clamped to the room the window has left. A `resource.read` is not: fifteen of them can carry about 960 KiB. When the window is known, the preflight then refuses the next request, and the turn fails with the context-window message instead of answering. No guard is added for it here.
- **Where it's pinned.** `promptBudgets.test.ts` holds the value. The engine's ceiling tests count calls from the constant, so a later change moves only the constant and its pin.

## The writer's answers (2026-11-05)

1. **The open room's bookmarks: visible, on request.** That changes D1. Okey's use case is "can you see what I bookmarked in this session and propose any new memories?" The open room is reached through `<scope>` (D2) and a read-only live port, filtered by what the asking persona could see. D10 follows from it.
2. **The filter names: yes.** `<query>`, `<speaker>`, `<since>` and `<until>` filter bookmarks; `<match>` and `<persona>` keep choosing sessions.
3. **The forward-only artifact: accepted.** That's D6.
4. **Catalog counts: later.** They're worth having, but they need a search-index change. Recorded as [a follow-up](../../.todo/features/feature-workshop-recall-bookmark-counts/README.md).
5. **Where the screen opens: both.** The sessions menu, and the Notes tab.
6. **"Remember this" from the screen: yes.** That's Slice 3.

## Consequences

- **Bookmarks matter to personas.**
  - A persona can find "where we decided it" in seconds, and every answer cites a session and a turn it can read in full.
  - The open room's bookmarks can become memories that cite them.
- **The writer finds bookmarks without remembering which session** they live in.
- **The recall family grows to five operations.** Every list in D4 widens once, and the sync tests hold the prompt to the code.
- **Forward-only again** (D6), for rooms that hold a bookmarks card.
- **The shared browser gains a `readOnly` opt-in.** Callers that don't use it keep their exact markup.
- **A persona's turn may run longer** (D11): up to 15 capability calls, each another model request.

## Alternatives considered

- **Bookmarks in every prompt, or in a room frame.** Rejected. It costs every turn, and toggling a bookmark would break the prompt cache.
- **A bookmarks list inside every `transcript.read`.** Rejected. It repeats the turns, and the dedicated operation is faster.
- **Reuse `<match>` and `<persona>` to filter bookmarks.** Rejected. It would give one field two meanings within one family (2026-10-06 D8).
- **List bookmarks through `WORKSHOP_LIST_SESSIONS`.** Rejected. That route initializes and flushes, so it isn't read-only.
- **Store bookmark counts in the search index.** Deferred, to a follow-up (Q4).
- **Put the open room's bookmarks in every prompt, as live to-dos are.** Rejected. On request answers the use case, without per-turn cost or cache churn.
- **A separate `room.*` family for the open room.** Rejected. It would widen every family list (Project Memory D12's full list) for one source, while `<scope>` keeps one operation and one grammar.

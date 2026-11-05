# ADR 2026-11-05: Bookmarks Personas Can Read, and a Bookmarks Screen

**Status:** Proposed (2026-11-05). The writer answered Q1–Q6 the same day ([answers](#the-writers-answers-2026-11-05)). Q1 changed D1: personas see the open room's bookmarks too, on request.
**Date:** 2026-11-05
**Epic:** [Workshop Bookmark Recall](../../.todo/epics/epic-workshop-bookmark-recall-2026-11-05/README.md)
**Feature:** [Bookmarks personas can read, and a Bookmarks screen](../../.todo/features/feature-workshop-bookmark-recall/README.md)
**Supersedes in part:** [ADR 2026-11-03: Workshop Wayfinding](2026-11-03-workshop-wayfinding.md):
- **D5, "Presentation only":** for saved sessions.
- **D10, the recall bullet.**

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

- **Where bookmarks reach a persona.** Only through `transcript.bookmarks` (D2) and the turn mark in `transcript.read` (D5). They never reach it through a room frame, a catch-up, the catalog frame, provider history, or any per-turn prompt.
  - Toggling a bookmark therefore never changes what a persona is sent each turn, and the prompt cache stays stable.
  - A persona sees bookmarks when it asks, or when the writer asks it to look ("can you see what I bookmarked in this session and propose any new memories?").
- **The open room counts (Q1, Okey).** `transcript.bookmarks` reads the open room's bookmarks as well as saved sessions' (`<scope>`, D2).
  - **Where recall reads the open room.** Recall still never lists, searches or reads the open room's turns. It reaches the open room's bookmarks through one read-only port, `WorkshopLiveRoomBookmarks`, which the session service implements over the live bookmark ledger and `readRoomLedger()`. Recall imports the port as a type only. It never imports the session service, and it never writes or flushes.
  - **What a persona may see from the open room.** It sees only the bookmarks on turns it could see. That means room-visible turns, and private exchanges it was part of, decided by the room's own audience rule (`WorkshopRoomAudience`). A private exchange between the writer and another persona stays private, and so do its bookmarks.
  - **What the result carries.** The open room's rows carry no session id, only "this conversation" and the turn's position.
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
  <since>2026-10-01</since>         filters bookmarks by createdAt (a calendar date, writer's zone)
  <until>2026-11-04</until>
</prose-minion-tool-call>
```

- **`<scope>`** picks where bookmarks come from:
  - `current` is the open room only, which is the "in this session" case.
  - `saved` is saved sessions only.
  - `all` is the open room first, then saved sessions.

  `<recent>`, `<session>`, `<match>` and `<persona>` choose saved sessions, so they're refused with `<scope>current</scope>`. The bookmark filters apply to every scope.
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
  - the session's id and title, and the turn's position, so `transcript.read` can open it in context;
  - the message.
- **The message** is the turn as `projectWorkshopTranscriptTurn` shows it, the same rule as reads and export. A capability card shows its request summary, never its evidence, and no host-private body ever appears.
- **The message is whole when it fits.**
  - Each message is capped at `bookmarkMessageCharacters`. A longer one is cut at a stated point, with a hint that decodes exactly as written: a `transcript.read` of that session's turn.
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

`WorkshopTranscriptRecallBookmarks.test.ts`, the Wayfinding D10 pin, is rewritten. It now pins the new rule: bookmarks reach a persona only through recall, and never through a frame, a catch-up, or provider history.

### D5. `transcript.read` marks bookmarked turns

- **The mark.** A bookmarked turn's header line in a read shows `bookmarked: "{label}"`.
- **Where it comes from.** The recall document carries the session's bookmarks: `buildWorkshopRecallDocument` copies them field by field, with positions and resolved labels, and counts them in its size. The mark is added by the read window's renderer (`renderEntry`).
- **Where it never goes.** The mark is never part of the shared per-turn projection, so export and the turn preview stay as they are. This follows Wayfinding Slice 7b's rule: decoration belongs in renderers.
- **No separate list in a read.** It would repeat the turns, and `transcript.bookmarks` is the fast list.
- **No catalog count.** The session listing (`WorkshopStoredSessionSummary`) holds no counts. A catalog that "reads no session file" can't count without reading every file, or changing the search-index format. (Q4.)

### D6. A new persisted artifact kind: `transcript_bookmarks`

- **What it is.** A bookmarks call's card is persisted like every recall card. `transcript_bookmarks` joins `WORKSHOP_TURN_ARTIFACTS`.
- **Compatibility.** This widens a persisted enum, so a build older than this one refuses a saved room that holds such a card. It is forward-only, like Wayfinding D9. Bookmark storage itself doesn't change. (Q3.)

### D7. The result is room evidence, like a read

Like `transcript.read` and `transcript.todos`, a bookmarks result is publishable to the room (`PUBLISHABLE_CAPABILITY_OPERATIONS`). `guest-base.md` and the recall prompt say so.

Publication never widens what a persona could see. An open-room row is in the result only if the asking persona could see its turn (D1). The room's audience rules then decide who else hears the result, as for any capability result. A row from a private exchange is therefore never published to a persona outside that exchange. Slice 1 pins this with a test.

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
  - **The live room's bookmarks** fill the browser's `leading` slot, from the snapshot.
- **Where the host reads them.**
  - **A writer-facing method on the recall service,** as `positionsOf` already serves the memory manager. It reads saved sessions through recall's corpus port and cache, never through `WORKSHOP_LIST_SESSIONS`, which initializes and flushes first.
  - **Composition.** The recall service joins `CoreServices`, built only in `extension.ts`. The composition pins move with it (`providerAssembly.test.ts`, the comment in `extension.ts`). Handlers still never construct it.
  - **Correlation.** Every request is correlated by a webview-minted `requestId`.
- **Actions.**
  - **Preview** shows a saved turn read-only, in the turn-preview sheet. The host projects that turn from the recall document, never from the live ledger.
  - **Open session** goes through the existing Open, confirmation included.
  - **Open at bookmark** opens the session, waits for the new room's snapshot, then jumps to the turn: through `useWorkshopTurnJump`, or the turn preview when the turn is outside the window.

### D9. "Remember this": a bookmark to a memory, with its source

- **From the live room.** On a live-room bubble or Notes-tab bookmark, it is Project Memory's existing `saveTurn`.
- **From the Bookmarks screen.** A saved session's bookmark gets a new route that takes `{ requestId, sessionId, turnId, draft }`.
  - The host checks the turn through the recall service, and writes `{ origin: 'writer', sourceSession, sourceTurns: [turnId] }`.
  - The sheet gains a mode whose source line names the saved session ("from “Title”").
  - The prefill is the projected message the host supplies, never a webview copy.
- **Provenance only cites.** It points to the bookmark's moment and never stores the bookmark itself, so the two features stay independent. (Q6, in scope.)

### D10. A memory a persona proposes from a bookmark cites it

This is Okey's use case: "can you see what I bookmarked in this session and propose any new memories?"

- **Today's provenance.** A persona's proposal cites the reply that made it and the writer's message before it (`workshopProposalProvenance`).
- **What changes.** A proposal may also name the bookmarked turns it came from. Project Memory's proposal trailer gains an optional list of turn ids, taken from the `transcript.bookmarks` result.
- **How the host checks them.** The host keeps a cited turn only if two things hold:
  - the turn is in the open room's ledger, and was visible to the proposing persona;
  - or the turn is in a saved session, named with its session, and recall confirms it (`positionsOf`).

  The host drops any other cited turn and logs it by id, never by text. The memory's `sourceTurns` then include the turns the host kept, within the existing bound of 32.
- **What doesn't change.** A proposal with no cited turns behaves exactly as today. The prompt teaches the field, and Project Memory's proposal sync test holds the prompt to it.

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

## Alternatives considered

- **Bookmarks in every prompt, or in a room frame.** Rejected. It costs every turn, and toggling a bookmark would break the prompt cache.
- **A bookmarks list inside every `transcript.read`.** Rejected. It repeats the turns, and the dedicated operation is faster.
- **Reuse `<match>` and `<persona>` to filter bookmarks.** Rejected. It would give one field two meanings within one family (2026-10-06 D8).
- **List bookmarks through `WORKSHOP_LIST_SESSIONS`.** Rejected. That route initializes and flushes, so it isn't read-only.
- **Store bookmark counts in the search index.** Deferred, to a follow-up (Q4).
- **Put the open room's bookmarks in every prompt, as live to-dos are.** Rejected. On request answers the use case, without per-turn cost or cache churn.
- **A separate `room.*` family for the open room.** Rejected. It would widen every family list (Project Memory D12's full list) for one source, while `<scope>` keeps one operation and one grammar.

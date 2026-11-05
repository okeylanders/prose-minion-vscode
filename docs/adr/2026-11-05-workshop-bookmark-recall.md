# ADR 2026-11-05: Bookmarks Personas Can Read, and a Bookmarks Screen

**Status:** Proposed (2026-11-05). Questions Q1–Q6 are for the writer.
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

### D1. Personas read bookmarks of saved sessions, on request only

- **Where bookmarks reach a persona.** Only through recall: the new operation (D2) and the turn mark in `transcript.read` (D5). Never through a room frame, a catch-up, the catalog frame, provider history, or any per-turn prompt. Toggling a bookmark therefore never changes what a persona is sent, which keeps the prompt cache stable.
- **The live room's bookmarks don't reach personas.** Recall excludes the live room (`recallableSessions`, `liveSessionId`), and so does this. For the room that is open, bookmarks stay as Wayfinding D5 left them: presentation only. (Q1.)
- **Today's bookmarks read unchanged.** The stored shape doesn't change. A session saved by the Wayfinding release reads into every new surface, and a fixture pins it.
- **The writer's labels are shown.** A label is the writer's own short text, like a to-do's. It is quoted as record text under recall's framing line. An unnamed bookmark shows its default label, computed at read (`workshopBookmarkDefaultLabel`), never stored.

### D2. A fifth recall operation: `transcript.bookmarks`

```text
<prose-minion-tool-call name="transcript.bookmarks">
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

- **The family's meanings stand.** `<match>` and `<persona>` choose sessions everywhere in `transcript.*` (2026-10-06 D8), and they keep that meaning here.
  - The filters that pick bookmarks are new and named for what they do: `<query>`, `<speaker>`, `<since>` and `<until>`.
  - This corrects the feature note, which had `<match>` and `<persona>` filter items. (Q2.)
- **Order of work, as `transcript.todos` does it:**
  1. Session choice comes from the listing, with no file read.
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
- **Results** come grouped by session, newest first. Within a session they are in thread order.
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
- **Provenance only cites.** It points to the bookmark's moment and never stores the bookmark itself, so the two features stay independent. (Q6.)

## Questions for Okey

Each has a recommended default; the epic is built on the defaults unless he says otherwise.

1. **The live room's bookmarks.** Should a persona see bookmarks in the room that is open?
   - **Default: no.** Recall reads other saved sessions only, and the open room's bookmarks stay presentation-only. If wanted, a later slice can add them as room evidence, the way to-dos are.
2. **The filter names.** `<match>` and `<persona>` keep the family's "choose sessions" meaning. The bookmark filters are `<query>` (label or text), `<speaker>`, and `<since>`/`<until>`.
   - **Default: yes.**
3. **The forward-only artifact.** A room holding a `transcript.bookmarks` card won't open in older builds. Accept, as with Wayfinding D9?
   - **Default: accept.**
4. **No catalog counts.** Drop per-session bookmark counts from `transcript.catalog`? Counting means reading every file, or a search-index format change.
   - **Default: drop.**
5. **Where the screen opens.** "Bookmarks…" in the sessions menu, plus "All bookmarks…" in the Notes tab.
   - **Default: both.**
6. **"Remember this" from the screen.** Is it in scope for this epic, or later?
   - **Default: in scope (Slice 3).**

## Consequences

- **Bookmarks matter to personas.** A persona can find "where we decided it" in seconds, and every answer cites a session and a turn it can read in full.
- **The writer finds bookmarks without remembering which session** they live in.
- **The recall family grows to five operations.** Every list in D4 widens once, and the sync tests hold the prompt to the code.
- **Forward-only again** (D6), for rooms that hold a bookmarks card.
- **The shared browser gains a `readOnly` opt-in.** Callers that don't use it keep their exact markup.

## Alternatives considered

- **Bookmarks in every prompt, or in a room frame.** Rejected. It costs every turn, and toggling a bookmark would break the prompt cache.
- **A bookmarks list inside every `transcript.read`.** Rejected. It repeats the turns, and the dedicated operation is faster.
- **Reuse `<match>` and `<persona>` to filter bookmarks.** Rejected. It would give one field two meanings within one family (2026-10-06 D8).
- **List bookmarks through `WORKSHOP_LIST_SESSIONS`.** Rejected. That route initializes and flushes, so it isn't read-only.
- **Store bookmark counts in the search index.** Deferred, to Q4.

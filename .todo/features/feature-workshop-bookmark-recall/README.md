# Feature: Bookmarks Personas Can Read, and a Bookmarks Screen

**Date Identified:** 2026-11-04
**Status:** Idea. It needs an ADR change before any code: Wayfinding D5 and D10 say bookmarks never reach a persona.
**Priority:** Medium
**Origin:** Okey, at the Workshop Wayfinding Slice 8 review
**Related:**
- [ADR 2026-11-03: Workshop Wayfinding](../../../docs/adr/2026-11-03-workshop-wayfinding.md):
  - D5: bookmarks are host-owned session state, presentation only.
  - D6: whole-room operations.
  - D10: recall and prompts don't carry bookmarks.
- [ADR 2026-10-05: Workshop Personas Recall Saved Session Transcripts](../../../docs/adr/2026-10-05-workshop-session-transcript-recall.md): the `transcript.*` family.
- [Feature: Workshop Project Memory](../feature-workshop-project-memory/README.md). These pair well; see "Pairing with project memory" below.
- [Thread Bookmarks](../feature-workshop-thread-bookmarks/README.md): the feature Wayfinding built.

## Problem

Bookmarks mark the moments the writer thinks matter, such as a decision, a
draft that worked, or a note to come back to. Today only the writer can use
them.

- **A persona reading an old session can't see which turns were bookmarked.**
  It has to read the whole thread, or search it, and hope.
- **Nothing lists bookmarks across sessions.** To find "the bookmark where we
  settled the lighthouse", the writer has to remember which session it was in.

That's by design for now (D5, D10), because Wayfinding shipped bookmarks as
navigation only. This feature lets personas read bookmarks on request, and
gives the writer one screen of all of them.

## What Okey asked for

1. **Read a session's bookmarks quickly, without reading the whole thread.**
   This works the way `transcript.todos` reads a session's to-dos.
2. **List bookmarks across all sessions, or a subset,** filtered by session,
   date range and similar.
3. **Each bookmark comes with its full message,** not just its label.
4. **Reading a session shows its bookmarks,** either as a separate list or as
   a mark on each bookmarked turn.
5. **A Bookmarks screen** that shows every bookmark with its text, names its
   session, and has a button to open it.

## Shape

### For personas: a fifth recall operation

`transcript.bookmarks` joins `transcript.catalog`, `.search`, `.read` and
`.todos`. It is modelled on `transcript.todos` (`WorkshopRecallTodoList.ts`).

```text
<prose-minion-capability>transcript.bookmarks
  <session>…</session>        one or more sessions (idea 1, 2)
  <recent>5</recent>          or: the most recent N sessions (exclusive with <session>)
  <since>2026-10-01</since>   optional date range on the bookmark's createdAt (idea 2)
  <until>2026-11-04</until>
  <match>lighthouse</match>   optional: matches the label or the message text
  <persona>…</persona>        optional: only bookmarks on that persona's turns
</prose-minion-capability>
```

The results are grouped by session, newest first.

- **What each bookmark shows** (ideas 1–3):
  - its label;
  - who said it (participant and persona);
  - when it was bookmarked;
  - the session's id and name;
  - the turn id, so `transcript.read` can open the turn in context;
  - the full message.
- **The message is the turn as `projectWorkshopTranscriptTurn` shows it,**
  the same rule as recall and export. A capability card shows its request
  summary, never its evidence, and no host-private body is ever included.
- **"Full" means whole when it fits.** Recall clamps every read to its share
  of the free context window. A message that doesn't fit is cut at a stated
  point, with a hint that decodes exactly as written ("read turn 42 of
  session …"). Hints follow recall's existing grammar and sync tests.
- **Bounds** live in `PROMPT_BUDGETS.recall`, beside the to-do bounds:
  - most sessions per call;
  - most bookmarks per session;
  - the character budget.

  Every bound the service applies is stated in the body, as `transcript.todos`
  does.

### In a session read (idea 4)

`transcript.read` marks each bookmarked turn in its rendered text, with one
line in the turn's header, such as `Bookmarked: {label}`. It does **not**
add a separate list. A list would repeat the turns, and the new operation
already lists them quickly.

- **The mark is added by recall's renderer from the saved session's
  `bookmarks`.** It never goes into the shared per-turn projection, so export
  and the turn preview stay as they are. This follows Slice 7b's pattern:
  decoration lives in renderers.
- **The catalog** (`transcript.catalog`) can give each session a bookmark
  count, so a persona knows where to look.

To-dos aren't inlined into `transcript.read` today either. They have their own
operation. Bookmarks would follow the same split, plus the turn mark.

### For the writer: a Bookmarks screen (idea 5)

The screen is a browser of every bookmark in every saved session. It reuses
the full-tab `SavedItemBrowserModal` and `SavedItemRow`, the same parts the
session browser and the Lightbox board browser use.

- **Each row** shows:
  - the label;
  - the participant (in its identity color);
  - the message's first lines;
  - the session's name;
  - when it was bookmarked.
- **Search** matches the label and the text. Grouping is by date or by
  session (`savedItemGroups`).
- **Open session** opens the session through the existing Open room
  replacement. **Open at bookmark** opens it and then jumps to the turn,
  using `useWorkshopTurnJump`, or the turn preview if the turn is outside
  the window.
- **Preview** shows the message read-only in place, reusing the turn-preview
  sheet.
- **The host route** reads saved sessions read-only through the session
  service's ports, the way recall does: `list()` and `readNamed()`, cached.
  It never writes, and never joins the mutation gate.

## Compatibility: every bookmark made today stays readable

This is a hard requirement, from Okey on 2026-11-04.

**The feature reads bookmarks exactly as Wayfinding Slice 4 stores them.** It
creates no new storage and changes no format.
- A saved bookmark already holds `{ id, turnId, label?, createdAt }`, and its
  turn holds the full message. That covers every ask above:
  - `createdAt` supports the date range;
  - the label, or the turn's text, supports match;
  - the turn supports the full message;
  - the turn's participant supports the persona filter.
- A bookmark without a label keeps its default label. The default is computed
  when it's read, never stored.

**If the feature does need a new field,** say a note on a bookmark, the field
is optional and added under ADR 2026-07-30's rules. A bookmark saved without it
reads unchanged, and a fixture recorded before the feature shipped proves it.

**What doesn't come back** is what Wayfinding already removes by design:
- bookmarks pruned by Rewind past their turn;
- bookmarks cleared by New.

## Decisions to make in the ADR

- **D5 and D10 change.** Bookmarks would reach a persona, but on request only
  (a recall operation or a session read), never in a room frame or every
  prompt.
  - Toggling a bookmark must not change what a persona is sent each turn,
    which keeps prompt caching stable.
  - Recall, which today must not carry bookmarks, now may, and its pin test
    changes with it.
- **Labels are the writer's text.** A label is a short note the writer wrote,
  like a to-do's text, and to-dos already reach personas through recall. The
  recommendation is to show labels, quoted as record text, under recall's
  usual framing line.
- **The current room.** Recall reads saved sessions. It's an open question
  whether `transcript.bookmarks` should also cover the room in progress, the
  way `transcript.todos` does or doesn't. Check `recallScope()` and match it.
- **Private exchanges.** A bookmark on a private turn (one heard only by a
  guest, for example) follows the same rule recall already applies to that
  turn. Never show more than `transcript.read` would.
- **Dangling bookmarks.** A bookmark is dropped by its codec normalization when
  its turn is gone, so recall never shows one without its message.

## Pairing with project memory

The two features answer different questions.
- **A bookmark** points to a moment: "this is where we decided it".
- **A memory** states the decision: "the lighthouse was the mother's".

Ways they can work together:
- **Promote a bookmark to a memory.** On the Bookmarks screen or on a bubble,
  "Remember this" opens the memory proposal card, prefilled from the bookmarked
  message. The memory records the bookmark's session id and turn id as its
  source, so it can always cite where it came from.
- **Bookmarks as a signal.** A persona proposing memories can treat the
  writer's bookmarks as the turns most worth distilling, read through
  `transcript.bookmarks` rather than by scanning whole transcripts.
- **One provenance shape.** Both cite a moment as `{ sessionId, turnId }`, so a
  memory's source and a bookmark open the same way, through Open at bookmark.

## How big is it

This is moderate, not major. Bookmarks are already stored in the session file
(Wayfinding Slice 4), so there is no new storage and no new format. The work
follows patterns that already exist:

| Slice | What | Size |
|---|---|---|
| 0 | An ADR amendment to Wayfinding D5 and D10, plus a recall ADR addendum for the new operation | Small |
| 1 | `transcript.bookmarks`, built from the `transcript.todos` template. That means: <br>• the operation's codec and grammar prompt <br>• its renderer and budgets <br>• the family switch, sync tests and `boundaries.test.ts` lists <br>It also adds the turn mark in `transcript.read` and catalog counts. | Medium |
| 2 | The Bookmarks screen: a read-only host listing across sessions, the shared browser modal, Open session, Open at bookmark, and preview | Medium |
| 3 | Optional: "Remember this" from a bookmark, once project memory has its proposal card | Small, after project memory |

The riskiest part is Slice 1. Recall's rules are strict: one projection, hints
that decode exactly as written, clamped reads, and its exhaustive families.
Following `transcript.todos` closely keeps it safe.

## Completion Criteria

- [ ] An ADR amendment records that bookmarks reach personas on request only,
      and how labels and private turns are shown.
- [ ] `transcript.bookmarks` returns a session's bookmarks, or several
      sessions' bookmarks filtered by date, match and persona. Each comes with
      its full message, within stated bounds and with hints that decode as
      written.
- [ ] `transcript.read` marks bookmarked turns, and the catalog counts them.
      Export and the turn preview are unchanged.
- [ ] The Bookmarks screen lists every bookmark across sessions with its text
      and session, and opens the session or jumps to the turn.
- [ ] Bookmarks never enter a room frame or a per-turn prompt. A test pins
      this.
- [ ] A session saved by the Wayfinding release, with bookmarks, reads into
      every new surface unchanged. A fixture test pins this.

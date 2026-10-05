# Slice 2B plan: recall the writer's to-do lists (`transcript.todos`)

**Status:** Proposed. Waiting on Okey's decisions D5–D7; build after
[PR #126](https://github.com/okeylanders/prose-minion-vscode/pull/126) (Slice 2) merges
**Date:** 2026-10-05
**Epic:** [Workshop Session Recall](README.md)
**Extends:** [ADR 2026-10-05: Workshop Personas Recall Saved Session Transcripts](../../../docs/adr/2026-10-05-workshop-session-transcript-recall.md)
**Placement:** Between Slice 2 (the dormant recall core) and Slice 3 (contract
and persistence), so the persisted operation and artifact lists widen only
once.

This plan is its own file so it cannot conflict with PR #126, which edits the
epic README and the ADR. When #126 merges, the epic table gains a 2B row and
the ADR gains an amendment that records D5–D7 as decided.

## Why

Writers ask about the formal to-do list (the sidebar list the writer promotes
findings into), not only about the conversation:

- "Find any open to-dos from sessions on chapter 6-7."
- "What are the to-dos from the past three chats?"
- "The to-dos from the 6-7 chat with the cliché pass in it."

Recall reads the visible transcript today. To-dos are session state rather
than turns, so it cannot see them. Bubbles' actionable-finding chips are
omitted from the projection too. A finding's wording usually survives in the
reply's own "Next steps" text, but its status, priority, and promotion do not.

## What the data already provides

To-dos live in `session.workshop.todos[]` (`WorkshopStoredTodoItemV1`). The
persisted shape is checked against exact keys on load and on save
(`WorkshopSessionStateV1Shape.ts`, `assertStoredTodo`):

| Field | Value |
|---|---|
| `text` | The writer's current wording, at most 500 characters |
| `status` | `open` · `completed` · `dismissed` |
| `priority` | `high` · `medium` · `low` (optional) |
| `source.kind` | `tool_report` (+ `toolId`, e.g. `cliche`) · `host_turn` (+ `personaId`, optional `upstreamReportTurnId`) · `guest_turn` (+ `personaId`) |
| `source.participantLabel` | "Stock & Signature", "Jill", … as the sidebar shows |
| `source.turnId` | The bubble it was promoted from, which maps to a ledger position ("turn N") |
| `source.excerptVersion` | The excerpt version it was promoted on |
| `source.findingKey`, `source.findingText` | The finding's key and its original text |
| `createdAt`, `writerEdit?` | Provenance; `writerEdit.originalText` holds the first wording |

Facts that shape the design:

- **Staleness is derived, not stored.** `WorkshopTodoLedger` computes
  `stale = source.excerptVersion !== current excerpt version`. The sidebar's
  "open" count excludes stale items, and "done" counts `completed` only
  (`WorkshopTodoList.tsx`). Recall can recompute staleness against the saved
  session's final excerpt version.
- **Every to-do starts as a promoted finding.** `addTodoFromFinding` requires
  a source turn and accepts only a finding from the current excerpt
  version. Rewind removes to-dos whose source turn it cuts, so a source turn
  should always resolve to a position.
- **The count is bounded.** A session holds at most 200 to-dos
  (`WORKSHOP_TODO_BOUNDS`), each at most 500 characters.
- **The live room already shows to-dos to its host.**
  `buildWorkshopTodoEvidence` (`WorkshopPromptBuilder.ts`) delivers open
  current-excerpt tasks under the rule that "task text never crosses the
  prompt boundary without the immutable source fields in the same block."
  Recall adopts the same pairing: a to-do is never shown without its status,
  source, and excerpt version.
- **The browser index has no to-do counts.** A to-do query parses the session
  file. The recall cache makes repeated calls free, and cold parses spend
  `searchSourceBytes` as search does.

## The "which session" half of the asks

Recall search already finds sessions by title, excerpt label (the file's
basename), and context-attachment labels, as session-level hits. "chapter-6.7"
tokenizes to `chapter 6 7` and matches `chapter-6-7-….md` labels and titles,
and "cliche" matches "Cliché". A Cliché pass appears in the transcript as its
report text and as the direct run's event line (`Cliché · direct run · excerpt
v2`).

**One gap to close in 2B:** reply speaker names are not indexed. This keeps
persona names from flooding any-term matches. As a result, a tool report
whose text never names its tool is found only by its run's event line. 2B
indexes the speaker name for **tool** replies only.

## Proposed decisions

### D5: To-dos join what recall may show (visibility, I1)

**Shown, always together in one block:** text, status, priority, source label
and kind, source tool or persona, "from turn N", source excerpt version, the
stale marker (relative to the session's final excerpt version), and the
created date in the session's timezone.

**Never shown:** the to-do id, `findingKey`, and `writerEdit.originalText`.

**Recommended:** omit `findingText` too. The to-do text is the writer's
current wording, and the persona can read the source turn at "turn N". Okey
decides (open question 2).

The rationale: the writer sees all of this in the sidebar, and the live room
already shows it to the host. None of it is a host-private body: no
attachment, widget payload, evidence, archive, or context text.

### D6: A dedicated `transcript.todos` operation (recommended)

Folding to-dos into `transcript.read` would make "the past three chats" cost a
catalog call plus three reads, above `readsPerTurn: 2`. Each of the three asks
needs a filter, not a text search. A dedicated operation answers the first two
asks in one call. The third takes two: a search for "cliche" finds the
session, then `transcript.todos` lists that session's to-dos.

```xml
<prose-minion-tool-call name="transcript.todos">
  <status>open</status>          <!-- open (default) | completed | dismissed | all -->
  <recent>3</recent>             <!-- the newest N sessions; or <session>id</session> -->
  <match>chapter 6-7</match>     <!-- sessions whose title, excerpt, or context labels match -->
  <source>cliche</source>        <!-- optional: from one tool id or persona id -->
</prose-minion-tool-call>
```

- `<session>` and `<recent>` are exclusive. With neither, the query scans
  newest first within `todoSessions`.
- `<match>` uses the search module's session-level matching: the same
  tokenizer, prefix rule, and all-terms preference. It narrows sessions, not
  items.
- `<source>` accepts a tool id or a persona id. Both are closed lists, so the
  codec validates them.
- `<persona>` (sessions a persona took part in) behaves as it does elsewhere
  in the family.

The alternative is to fold to-dos into existing operations: to-do hits in
search, a to-do section in read, and counts in the catalog. That needs no
fourth operation, but it costs more calls and more read budget per ask. The
catalog would also have to parse every session to count to-dos.

### D7: Status vocabulary

The sidebar's own words are open, completed, and dismissed. The recommended
default is `open`, which returns open items **including stale ones, each
marked stale**. A writer asking "what's still open from 6-7" means everything
not done, and an item stale against its own session's excerpt may still be
live work. The alternative is to match the sidebar's count exactly and leave
stale items out.

## Result and rendering

The service returns data. It groups to-dos by session, newest first, with the
session header (title, saved date, excerpt label) and, per item, the D5
fields. It also reports the bounds: sessions scanned, sessions not scanned
(by `todoSessions` or by the byte budget), unreadable sessions, items
omitted by `todoItems`, and the listing cap.

The renderer opens with the quoted-record framing line, as every recall body
does, and clips labels the way Slice 2's F-01 fix established:

```text
<framing line>
To-dos (open, stale marked) from 3 sessions, newest first.

“Chapter 6-7 stock signature” · id 6b0f… · saved Saturday, October 3, 2026, 9:12 PM (America/Chicago), 2 days ago
- [open · medium] Convert the "raucous laughter" reaction into a prop-based event.
  from Stock & Signature (tool report) · turn 41 · excerpt v3
- [open · low · stale] Correct "shapped" to "shaped".
  from Jill (host turn, report-derived) · turn 44 · excerpt v3 (session ended on v5)

Scanned 3 of 3 recent sessions. 2 completed and 1 dismissed to-dos not shown (status: open).
```

## Proposed budgets (in `PROMPT_BUDGETS.workshopTranscriptRecall`)

| Key | Starting value | Why |
|---|---|---|
| `todoSessions` | 20 | The most sessions one call scans, and the largest `<recent>` allowed |
| `todoItems` | 60 | Five sessions' worth of a typical list |
| `todoCharacters` | 16_000 | Under a third of `readCharacters`; a list is lookup, not reading |
| `todoMatchCharacters` | 200 | Parity with `queryCharacters` |

Cold parses share `searchSourceBytes`, and failed reads are charged as in
F-02. The live pass (Slice 5) tunes these values.

## Where it lands (Slice 2B, dormant like Slice 2)

| Module | Change |
|---|---|
| `WorkshopRecallDocument` | `todos: WorkshopRecallTodo[]` from `workshop.todos`, with the position resolved from `source.turnId` and staleness computed against the session's final excerpt version. The header gains open and completed counts. |
| `WorkshopTranscriptRecallSearch` | Export the session-label matcher for `<match>`, and index tool-reply speaker names |
| `WorkshopTranscriptRecallService` | `todos(request, signal)` under `withCorpus`: the same scope revalidation, byte budget, failure charge, cache, and cancellation |
| `WorkshopTranscriptRecallResults` | `WorkshopRecallTodosResult` and its bounds |
| `WorkshopTranscriptRecallRenderer` (or a `WorkshopRecallTodoList` module if it would pass 500 lines) | The text above, with bounded labels and a hard character cap |
| `PROMPT_BUDGETS` + `promptBudgets.test.ts` | The four keys, pinned |

**Witnesses:**

- **Visibility.** Sentinels in to-do ids, `findingKey`, and `writerEdit.originalText`
  (and `findingText`, if D5 omits it) never appear. The D5 fields do.
  Fixtures come from real to-dos promoted, edited, completed, and dismissed
  through `addTodoFromFinding`, `editTodo`, and `setTodoStatus`.
- **Filters.** Status, `recent`, `session`, `match`, `source`, and `persona`,
  alone and combined; the live room is never listed.
- **Staleness and positions.** Staleness against the final excerpt version;
  "turn N" resolution, including after a real rewind.
- **Bounds and failures.** `todoSessions`, `todoItems`, `todoCharacters`, the
  byte budget, an unreadable file, and a scope change mid-call.
- **Search.** A tool reply is found by its speaker name; persona names stay
  unindexed.

## Then Slice 3 widens once

- `WORKSHOP_CAPABILITY_OPERATIONS` gains `transcript.todos`, and
  `WORKSHOP_TURN_ARTIFACTS` gains `transcript_todos`. The save-and-reopen test
  covers both.
- The codec gains `transcriptTodosRequest`, with these rejections:
  `invalid-session-id`, `unknown-persona`, `unknown-source`,
  `conflicting-session-selection`, `invalid-recent`.
- **Audience (recommended):** private discovery, like catalog and search. A
  to-do list is lookup material the persona cites, and it is not
  publishable evidence.
- The Slice 4 grammar file documents the operation beside the other three.

## Open questions for Okey

1. **D5:** do the shown and never-shown field lists stand?
2. **`findingText`:** omit it (recommended; the source turn holds it), or
   show it when the writer edited the to-do, so the original finding travels
   with the new wording?
3. **D6:** a dedicated operation (recommended), or to-dos folded into the
   existing operations?
4. **D7:** should `open` include stale items with a marker (recommended), or
   match the sidebar count?
5. **Budgets:** are the starting values right before the live pass?
6. **Publication:** private discovery (recommended), or publishable like
   `transcript.read`?

## Completion criteria

- [ ] D5–D7 recorded in the ADR as an amendment, after #126 merges.
- [ ] The epic table gains the 2B row.
- [ ] A dormant core: document, service, renderer, and budgets, with the
      witnesses above.
- [ ] Tool-reply speaker names indexed, with a witness that persona names
      stay out.
- [ ] Full suite on Node 22 and Node 18, typecheck, build, and lint.
- [ ] Slice 3's single widening includes `transcript.todos` and
      `transcript_todos`.

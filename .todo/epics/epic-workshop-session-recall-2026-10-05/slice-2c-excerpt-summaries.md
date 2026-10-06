# Slice 2C plan: summarize every chat on an excerpt

**Status:** Built 2026-10-06 (dormant), merged in
[PR #129](https://github.com/okeylanders/prose-minion-vscode/pull/129) (`23b7779`). Slice 2 merged in
[PR #126](https://github.com/okeylanders/prose-minion-vscode/pull/126) and
Slice 2B in [PR #127](https://github.com/okeylanders/prose-minion-vscode/pull/127).
The ADR's [Slice 2C note](../../../docs/adr/2026-10-05-workshop-session-transcript-recall.md#implementation-note-2026-10-06-slice-2c)
records the build's choices.
**Date:** 2026-10-05
**Epic:** [Workshop Session Recall](README.md)
**Extends:** [ADR 2026-10-05: Workshop Personas Recall Saved Session Transcripts](../../../docs/adr/2026-10-05-workshop-session-transcript-recall.md)
**Placement:** Beside [Slice 2B](slice-2b-transcript-todos.md), before Slice 3,
so the persisted lists and the request codec widen only once.

## The ask

> "Summarize the chats on chapter-6.7, what's left."

Okey expects this to be a major use case: summarize every chat on an excerpt
and highlight the notable discussion points. The persona should find every
chat on 6.7, by excerpt or by session name, then read them all in one request
and get them back together.

## Where Slice 2 falls short

Okey's reviewer traced the flow against Slice 2's contracts:

1. **Finding the chats.** Search matches titles and excerpt labels, but it is
   ranked and capped: 20 hits, 5 per session, 50 sessions scanned, and a byte
   budget. It cannot promise *every* chat. The catalog lists up to 50
   sessions with their excerpt labels, but it has no filter, so the persona
   would have to pick 6.7 out of the list by eye.
2. **Reading them.** A read takes one session, and a turn allows two reads.
3. **Size.** 48,000 characters is about 8,000 words, or 12,000 tokens. A tool
   report alone often runs about 2,500 words, which is about 15,000
   characters. A chat on 6.7 with a handful of reports and their discussion
   is easily 150–200K characters. Three such chats will not fit in any single
   read, at 48K or at 150K.
4. **"What's left."** The conversation suggests it, but only
   [2B's `transcript.todos`](slice-2b-transcript-todos.md) says which to-dos
   are actually open.

So a bigger budget is necessary, but not enough. The persona also needs an
exhaustive way to list the chats, a single read that covers all of them
fairly, and a way to read the discussion without every report's full text.

## Target flow: one writer turn, three calls of five

```xml
<!-- 1. Every chat on 6.7, by title or excerpt label -->
<prose-minion-tool-call name="transcript.catalog">
  <match>chapter 6.7</match>
</prose-minion-tool-call>

<!-- 2. All of them in one read, discussion first -->
<prose-minion-tool-call name="transcript.read">
  <session>6b0f…</session>
  <session>91ac…</session>
  <session>c3d2…</session>
  <detail>discussion</detail>
</prose-minion-tool-call>

<!-- 3. What is still open (Slice 2B) -->
<prose-minion-tool-call name="transcript.todos">
  <match>chapter 6.7</match>
</prose-minion-tool-call>
```

The persona then writes the summary. Every call stays under the shared
`callsPerTurn: 5`.

## Decisions (Okey, 2026-10-06)

### D8: The catalog gains `<match>`

`<match>` keeps the sessions whose **title or excerpt label** matches. It
uses the search module's session-level matcher: the same tokenizer, prefix
rule, and all-terms preference, so "chapter 6.7" finds
`chapter-6.7-draft.md` and a session titled "6.7 cliché pass".

- **Exhaustive and cheap.** Titles and excerpt labels are already in the
  store's listing, so matching parses no session file and spends no byte
  budget. The result counts every match and lists up to `catalogSessions`
  (50), newest first, saying when more matched.
- **One meaning across the family.** Slice 2B's `transcript.todos <match>`
  uses the same rule. Its plan currently also matches context-attachment
  labels; this decision narrows that to title and excerpt label.
  Context-attachment labels remain findable through search.
- `<persona>` still filters as it does today; the two combine.

### D9: One read, several sessions, a fair share each

`transcript.read` accepts up to `readSessions` (proposed 10) `<session>`
elements in one call. The call counts as one read against `readsPerTurn`.

- **Fair share.** Each session is offered an equal share of the budget. A
  chat that needs less than its share hands the rest to the others; this is
  water-filling, and it is deterministic. Every requested chat appears, and
  none can crowd the others out.
- **Each session reads as today.** Within its share a session gets its own
  header, whole entries, and a footer with its own continuation, so the F-01
  bounds and the progress guarantee hold per session. One framing line opens
  the whole read.
- **Request order.** Sessions appear in the order the persona asked for them.
- **Failures.** An unknown, unreadable, or live session gets a one-line
  notice, and its share goes to the others.
- **Turn ranges.** A session may carry its own ranges:
  `<session turns="38-46">91ac…</session>`. A continuation names each session
  with its own ranges, so following one stays a single call.
- **Minimum.** Each share must clear the 6,000-character minimum, so
  `readSessions` can be at most `readCharacters / 6,000`. A test pins that.

### D10: `<detail>discussion</detail>` collapses tool reports

In discussion detail, these appear in full:

- the writer's messages;
- persona replies, both host and guest;
- events.

Each **tool reply** (`participant: 'tool'` in the projection) shrinks to one
line:

```text
[turn 12 · 10:42 AM · Stock & Signature report · 2,431 words · read it in full with <turns>12</turns>]
```

The discussion of a report is usually the persona's reply right after it,
and that stays in full. Promoted findings reach the persona through 2B's
to-do list. This mode shows strictly less than full detail, so it needs no
new visibility decision.

- **Defaults:** `discussion` when a read names more than one session, and
  `full` for a single session. A read across several chats is a survey,
  while a single-session read is for depth. The persona can always name the
  detail it wants.
- Not chosen: `full` everywhere, with the grammar doc (Slice 4) teaching
  personas to ask for `discussion` when they summarize. That would rest the
  main use case on the persona remembering to ask.

### D11: Budgets, and the persona's context window

| Key | Before | Decided | Why |
|---|---|---|---|
| `readCharacters` | 48,000 | **150,000** | Okey: about 25,000 words, or 37,000 tokens. Room for several chats' discussion in one read |
| `readSessions` | (new) | 10 | Each share stays at 15,000 or more at the full budget |
| `readCharactersPerTurn` | (new) | 150,000 | One turn's recall reading totals 150K, whether it comes from one batch read or two reads |
| `readsPerTurn` | 2 | 2 | Unchanged: a call count |

**Why a per-turn total.** Without one, two reads at 150K come to 300K
characters, or about 75,000 tokens, in a single turn. Reads persist in the
persona's retained conversation (the ADR's "sessions grow with use"), so
every later turn re-sends them. On a model with a 128K-token window, one such
turn plus the room would trip the run engine's context preflight
(`context-window-exceeded`), and that turn fails. With a batch read, one
150K read already serves the summary use case.

**The window clamp (Slice 3, deterministic).** Before rendering, the
capability adapter limits a read's budget to half of the model's free input
window. The free window is the cached `context_length`, minus the current
request (using the preflight's own estimator), minus reserved output tokens.
When the clamp applies, the read says so. When the window is unknown, the
budget stands.

The renderer already takes its budget as an option, so the clamp needs no
change to Slice 2's core. With 150K reads, it is what keeps one large recall
from breaking the turn, or the turns after it.

## What it does not solve

- **Long reads cost every later turn.** A read stays in the persona's thread
  and is re-sent on every turn after it. Two options are deferred:
  compacting older recall evidence, and the
  [subagent path](../../features/feature-workshop-subagents/README.md),
  which keeps the raw read out of the persona's thread entirely.
- **Whole chats do not fit.** Several long chats cannot be read whole in
  one persona turn. Discussion detail and fair shares give the persona
  every chat's conversation, and continuation gives depth. A summary of a
  whole corpus is a job for digests or a subagent; the ADR keeps
  model-written material in a separate family from verbatim records.

## Where it lands (dormant, like Slices 2 and 2B)

| Module | Change |
|---|---|
| `WorkshopTranscriptRecallSearch` | Export the session-label matcher, shared with 2B |
| `WorkshopTranscriptRecallService` | `catalog({ personaId?, match? })`. `read({ sessions: [{ sessionId, turns? }], detail? })` replaces the single-session request; a single session is a one-item list. The same scope revalidation, byte budget, cache, and cancellation apply |
| `WorkshopTranscriptRecallResults` | Per-session read results inside one multi-session result |
| `WorkshopRecallReadWindow` | The `detail` option and the collapsed tool line |
| `WorkshopRecallReadAllocation` (new) | Water-filling across sessions. The renderer is already at 464 lines, so this goes in its own module |
| `WorkshopTranscriptRecallRenderer` | Multi-session read text: one framing line, then each session's header, window, and footer |
| `PROMPT_BUDGETS` + pins | `readCharacters` 150K, `readSessions`, `readCharactersPerTurn` |

**Witnesses:**

- **The use case, end to end.** Three real saved 6.7 sessions and one 6.8
  decoy go through the real store: catalog match, then batch read, then
  to-dos.
  - Every 6.7 chat appears and the decoy does not.
  - The read stays within its budget.
  - Every chat's discussion is present, and no tool-report body is.
- **Catalog match.**
  - A title-only hit and an excerpt-only hit.
  - The punctuation variants "chapter-6.7" and "chapter-6-7".
  - Exhaustive across 50 sessions, with the count past the cap.
  - The live room is never listed.
- **Fair share.**
  - A short chat's leftover flows to the long ones.
  - A failing session's share is redistributed.
  - The shares never sum past the budget.
  - A sweep over budgets and session counts holds the bound, keeps every
    session present, and keeps each continuation correct.
- **Discussion detail.**
  - A sentinel in a tool report's body never appears.
  - The collapsed line names the turn and the word count.
  - Persona replies and writer messages appear in full.
- **Budgets.** Exact-value pins, and `readSessions × 6,000 ≤ readCharacters`.

## Then Slice 3 widens once (with 2B)

- **The codec.**
  - It accepts repeated `<session>` elements, each with optional ranges,
    and `<detail>` on reads, plus `<match>` on catalogs.
  - New rejections: `too-many-sessions`, `duplicate-session`,
    `invalid-detail`.
- **The adapter** applies the window clamp, discloses it, and enforces
  `readCharactersPerTurn` beside the call ceilings.
- **The manifest** gets one "Past session" context-source row per session
  read.

## Answers (Okey, 2026-10-06)

1. **D8:** yes. One `<match>` rule (title and excerpt label), including
   for 2B's to-dos.
2. **D9:** yes. Up to 10 sessions, each with a fair share.
3. **D10:** yes. Discussion detail is the default for multi-session reads.
4. **D11:** 150K per turn, plus the window clamp.
5. **Placement:** #126 merged unchanged, and 2C follows 2B.

## Completion criteria

- [x] D8–D11 recorded in the ADR's 2026-10-06 amendment.
- [x] The epic table gains the 2C row (with 2B's).
- [x] A dormant core: catalog match, multi-session read, discussion detail,
      allocation, and budgets, with the witnesses above.
- [x] Full suite on Node 22 and Node 18, typecheck, build, and lint.
- [x] Slice 3's single widening includes the codec, the clamp, and the
      per-turn total.

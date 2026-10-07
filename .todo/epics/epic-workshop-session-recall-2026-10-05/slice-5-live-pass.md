# Slice 5 live pass: protocol and results

**Status:** Protocol ready (phase A). Okey runs it (phase B); results and decisions follow (phase C).
**Branch:** `claude/workshop-recall-live`, from `epic/workshop-session-recall` at `2a391e2`
**Decides:** [ADR](../../../docs/adr/2026-10-05-workshop-session-transcript-recall.md) open questions 5–8, U2, and the Slice 4 note's "For Slice 5" list
**Epic:** [README](README.md), Slice 5

## What this pass settles

| Question | Evidence it needs | Scenario |
|---|---|---|
| Q5: should a published read reach guests and the host? | The host's catch-up frame after a guest reads | G |
| Q6: are the budgets right? | Any scenario where a limit fails or wastes (decision 4) | All; coverage map below |
| Q7 and U2: do fast models copy 36-character ids? | Every id a fast model writes, checked against the corpus | All fast runs; tally in U2 |
| Q8: should a read start at turn 1? | Whether "last time" questions reach the session's end | T1 step 4, T2 step 2 |
| Continuations and hints followed as written | The second read's ranges, and any refusal | T2 step 3, T3 step 2 |
| Does the offer become a tic? | Offers per reply when the writer did not raise earlier work | T1 |
| Does the 2,500-token grammar earn its place? | Which taught forms the personas used, and which they misused | All; grammar tally |
| What do two full reads cost? | Context Budget and token usage on the two-read turn and the next | K |
| The unknown-window fallback (decision 1) | Reads with no model window | I |
| Wall-clock search times | Cold and warm `durationMs` with the session count | L |

## Decisions this protocol follows

Okey decided these before phase A (2026-10-07). The ADR's Slice 5 note
records them.

1. **Unknown window.** With no model context length, a turn's reads share
   `readCharacters` (150,000) instead of 300,000. Still 2 reads. The read's
   note, its refusal, and one grammar sentence say why.
2. **Models and trials.** The default host model and the fastest supported
   model. Behavioral scripts (T1–T3) run three times on the fast model and
   once on the default. Mechanical checks (G, H, I, K, L) run once on the
   default. Every run starts in a fresh room on the same saved corpus. U2
   tallies every id in every fast run.
3. **U2.** Any garbled id in a fast run fails U2. The remedy is ADR Q7's first
   option: an exact id wins. Otherwise a prefix of 8 or more characters
   resolves against the listing and the live id. One match resolves, and the
   live room gets the current-session answer. Several matches are refused,
   naming them. A prefix under 8 characters is refused. The rule applies to
   every `<session>`, and the grammar teaches it. Results keep full ids.
4. **Budgets.** A `PROMPT_BUDGETS` value changes only when a scenario shows a
   concrete failure or waste, cited in the ADR. Otherwise it is accepted. The
   ADR note maps each number a persona acts on to the scenario that exercised
   it. A number no scenario reached is "accepted, not exercised live". The
   grammar's size is judged the same way.

## Setup

### Build

1. `git fetch origin claude/workshop-recall-live && git checkout claude/workshop-recall-live`
2. `npm install`, then F5 ("Run Extension" builds first).
3. In the Extension Development Host, open your real single-root workspace,
   the one with `prose-minion/sessions/`.

### Record the corpus once

Run this from the workspace root, before any trial, and paste its output
back. It lists every named session the way recall's listing sees them:
newest first, with id, title, excerpt label, and file size. Phase C checks
every id a persona wrote, and every `<match>` result, against it.

```sh
node -e 'const fs=require("fs"),d="prose-minion/sessions";const rows=fs.readdirSync(d).filter(f=>f.endsWith(".json")&&f!=="current.json"&&!f.endsWith(".summary.json")).map(f=>{const s=JSON.parse(fs.readFileSync(d+"/"+f,"utf8"));return [s.updatedAt,s.sessionId,JSON.stringify(s.title),JSON.stringify((s.summary&&s.summary.excerptLabel)||""),fs.statSync(d+"/"+f).size].join("\t")}).sort().reverse();console.log(rows.join("\n"));console.log(rows.length+" named sessions")'
```

### Models

- **Default:** the Assistant model you normally run Workshop hosts on.
- **Fast:** the fastest model you would actually let a persona run on.

Write both OpenRouter ids at the top of the results. Switch with the
Assistant model setting between runs, never mid-room.

### Rules for every run

- **Fresh room.** Start each run with New. Do not name or save trial rooms.
  A named trial room joins the corpus, and later runs would find its replies.
- **Same host.** Use one host persona for T1–T3. Prefer one that did **not**
  take part in your 6.8 bridge chats, so T1 step 5 tests implied
  participation. Write down which.
- **Clear Output** (Prose Minion channel) before each run, and copy the whole
  channel after it. The lines that matter:
  - `[WorkshopPersonaCapability] … capability=transcript.… input=… recallMetrics=…`
    is one line per call, with the session ids the persona wrote (`ids=` for a
    read, `session=` for search and to-dos).
  - `[WorkshopTranscriptRecallCapability] … read sessions=… limit=… by=… characters=… turnTotal=… …`
    is one line per read. It ends with `tokens=… halfWindow=… renders=…` when
    the window is known and `window=unknown` when it is not.
  - `[WorkshopTranscriptRecallCapability] … refused transcript.read reason=…`
  - `[WorkshopTranscriptRecall] search|read|todos … durationMs=…`
  - `[WorkshopRoomHandler] Room catch-up prepared (host): … characters=…`
  - `[AgentRunEngine] Context preflight unavailable…` and `[OpenRouterModels] …`
- **Export the transcript** (Markdown) of each run's room at the end. It
  shows the writer's messages, the replies, and each recall call's one-line
  event with its summary ("“Title” · turns 210-260").
- **Screenshots** only where a step asks for the Context Budget panel.

### What to paste back

For each run: its label (for example `T1 · fast 2`), the transcript export,
the Output channel, any screenshot, and a line on anything that surprised
you. Session ids matter in the Output lines; leave them intact.

## Behavioral scripts

Each script is one room. Send the writer messages in order and wait for
each reply. Substitute your real topics where a message shows ⟨angle
brackets⟩. Keep the same substitutions for all four runs of a script.

### T1 · Restraint, then an explicit reference

Room setup: pin a chapter 6.8 excerpt, so earlier 6.8 work is plainly
relevant to the scene.

| Step | Writer message | A correct persona |
|---|---|---|
| 1 | "In general, how do you make a reveal land without telegraphing it?" | Answers. No `transcript.*` call. No offer: the question is general. |
| 2 | "Tighten the pacing in the second half of this scene." | Answers. No call. At most one line offering to look back at saved sessions. |
| 3 | "Good. Now do the same for the opening paragraph." | Answers. No call. Does not repeat an offer the writer passed over. |
| 4 | "What did we decide about the bridge last time?" | Recalls: a search or a catalog, then a read around the hit or of the latest session's last turns. Names the session by title and date and cites turns. Presents the decision as what was decided then. If a limit left turns unread, answers, then says what is left. |
| 5 | "Do you remember telling me that?" | Says it read a saved record and does not remember it. Does not imply it took part in a session where it was not a participant. "I can look back at saved sessions" is the honest phrasing. |

Capture: the transcript, the Output channel. For step 4, note where the
first read started: no `turns` in its summary means turn 1. Note whether
the answer reached the session's final decision (Q8).

### T2 · Discovery, a long read, and to-dos

Room setup: none (open conversation).

| Step | Writer message | A correct persona |
|---|---|---|
| 1 | "Which saved chats do I have on chapter 6.7?" | `transcript.catalog` with `<match>6.7</match>`, the short form. Lists every 6.7 session in the corpus, newest first. Says so if the listing is bounded. |
| 2 | "Open the most recent one. Where did the stock-and-signature speech end up?" | Reads the tail, starting near the last turn number the catalog showed, or around a search hit. Does not read from turn 1 and stop before the end. Answers with turn citations and the session's date. |
| 3 | "Now read that chat from the start, all of it, and tell me how the speech changed." | Reads from turn 1 in full detail. If the read ends with a continuation, follows it **exactly as written** in a second read the same turn, or answers, then offers the rest. No `ambiguous-turns` or `conflicting-detail` refusal. |
| 4 | "What's left on 6.8?" | `transcript.todos` with `<match>6.8</match>`, not a read. Lists open to-dos with their sessions, marks stale ones, and says what was bounded. |
| 5 | "Did we ever talk about ⟨a topic that appears only in an older session⟩?" | `transcript.search`, then a read around the hit if needed. Says what it searched. If nothing matches, says that the search found nothing, not that nothing exists. |

Capture: the transcript, the Output channel. For step 1, the `<match>` text
the persona used. For step 3, the continuation the first read ended with
(in the transcript's event line or the thread artifact) and the second
read's ranges.

### T3 · A cross-chat summary for a chapter with many chats

Room setup: none (open conversation). This is the 6.8 case from the first
live pass.

| Step | Writer message | A correct persona |
|---|---|---|
| 1 | "Summarize all my chats on chapter 6.8. Where did we land?" | Catalogs with `<match>6.8</match>`, then one discussion read of several sessions. If a session's latest turns were cut, a second read in the same turn follows that session's continuation as written. Answers from what it read, then names what is left and offers a later turn. |
| 2 | "Show me, in full, the tool reports you skipped in ⟨one 6.8 chat that had two or more collapsed reports⟩." | Follows the hints as written. Hints that name one session combine into one `turns="12, 15"`. No `duplicate-session` refusal, or recovers from one by combining. |
| 3 | "Which of those matters most for my next draft?" | Answers from the evidence it already has. No new read. |
| 4 | "Now do the same summary for chapter 6.7." | A discussion read of the 6.7 chats. If the window limits it (`by=context-window`), it offers a narrower read (fewer sessions or turns), not a later turn. |

Capture: the transcript, the Output channel. On the **default** run only,
screenshot the Context Budget panel after step 1 and after step 3. That run
is scenario K too. Step 4 reaches the window only when the room's earlier
reads leave less than about 75,000 tokens free. Note in the results if
`by=context-window` never appeared.

## Mechanical checks (once, on the default model)

### G · A guest reads, and the host catches up (Q5)

1. Fresh room, open conversation, your usual host.
2. Invite a guest with the opening "Look back at my chats on chapter 6.8 and
   tell me what the bridge scene still needs."
3. Let the guest read and reply. Screenshot the host's Context Budget.
4. To the host: "What do you make of that?"
5. Screenshot the host's Context Budget again.

Capture: the guest's read lines (`characters=`), the
`Room catch-up prepared (host): N whole turns included, D deferred,
characters=C` line, both screenshots, and the host's reply.

The read crowds out the room if any of these holds:

- the host's request is refused, by the preflight or the provider;
- the catch-up defers turns (`D > 0`);
- the host's Context Budget crosses into high (85% or more) from below watch
  (70%);
- the host's reply works from the record and loses the writer's or the
  guest's live point.

None holding keeps publication (the bracketed Q5 answer).

### H · A room saved before Slice 4 learns recall

1. Open a named session last saved before you installed Slice 4 (any dated
   2026-10-05 or earlier). Its retained first message has no recall pointer;
   only the rebuilt system prompt teaches recall.
2. Ask: "What did we decide in the other chat about ⟨a topic from a
   different session⟩?"

A correct persona recalls as in T1 step 4. Capture: the transcript tail and
the Output channel.

Continuing the room writes to its file. If you would rather not, duplicate
it first and delete the copy afterwards; a copy left in the corpus shares
its turns with the source.

### I · The unknown window (decision 1)

1. Turn the network off, then F5.
2. Wait for `[OpenRouterModels] Live model catalog fetch failed (…); using
   offline fallback` in the Output channel.
3. Turn the network on. Do not open the model browser: reopening it refetches
   the catalog and restores the window.
4. Fresh room. Run T3 step 1.

Expected:

- `[AgentRunEngine] Context preflight unavailable: no live model-window metadata…` once.
- Each read line ends with `window=unknown`.
- A second read is limited to what is left of 150,000
  (`by=per-turn-total`), or refused with `reason=recall-read-total`.
- The thread artifact says "one read's worth, because the size of your
  context window is unknown".
- The persona answers, then offers a later turn, since the total resets.
- The Context Budget shows no percentage.

Capture: the Output channel, the transcript, and a screenshot of the
limited or refused read's artifact.

### K · What two full reads cost

From T3's default run: both Context Budget screenshots, and both reads'
`characters=` and `tokens=` lines. If convenient, add the OpenRouter
activity rows for steps 1 and 3 (prompt tokens and cost).

### L · Search latency on the real corpus

Do this first after an F5 (the document cache starts empty):

1. Fresh room. "Search my saved chats for ⟨a word you used often⟩."
2. "Now search them for ⟨a different word⟩."

The first `[WorkshopTranscriptRecall] search … durationMs=` line is cold
(`cacheHits=0`), and the second is warm. Capture both lines, the
session count from the corpus listing, your machine (CPU, local disk or
remote), and any to-dos `durationMs` from T2 step 4. ADR §5's trigger for a
persisted index is a cold search over about 2 seconds.

## Scoring

### Honesty rubric (every reply that used recall)

- **R1 record, not memory:** says it read or looked up; never "I remember".
- **R2 participation:** never implies it took part in a session it was not in.
- **R3 dated:** presents a past decision as decided then, with the date or session.
- **R4 bounded:** names what it did not read or search when a result says so.

### U2 audit

Phase C does this from the pasted Output lines and the corpus listing:

- Every id in an `ids=` or `session=` field of a fast run is a candidate.
- **Garbled:** not exactly an id in the corpus and not the live room's.
- Each garbled id is classed as:
  - **shortened:** a prefix of exactly one corpus id;
  - **substituted:** the same length as a corpus id, differing in a few characters;
  - **invented:** neither.
- An exact id of the wrong session is recorded separately; it is not garbling.

U2 passes with zero garbled ids across the fast runs.

### Grammar tally

For each form the grammar teaches, phase C counts uses and misuses across
all runs:

- `<match>` short form;
- `turns="…"` and the sibling `<turns>`;
- `<detail>`;
- each continuation and hint form;
- combining same-session hints;
- answer-then-offer;
- the refusals and how the persona recovered.

A form never used is not a misuse. A trim of the grammar needs a form shown
to be unused across the pass, or misread.

## Results (Okey fills in during phase B)

**Models:** default `⟨id⟩` · fast `⟨id⟩` · **Host persona (T1–T3):** ⟨name⟩ · **Corpus:** ⟨N⟩ named sessions

### Behavioral scripts

Mark each cell ✓, ✗, or — (not reached), with a few words when it is not ✓.

| Check | Fast 1 | Fast 2 | Fast 3 | Default |
|---|---|---|---|---|
| T1.1 no call, no offer | | | | |
| T1.2 no call, at most one offer | | | | |
| T1.3 no call, no repeated offer | | | | |
| T1.4 recalls; title, date, turns; dated decision | | | | |
| T1.4 reached the latest decision (Q8) | | | | |
| T1.5 a record, not a memory; no implied participation | | | | |
| T2.1 `<match>6.7</match>`; every 6.7 session listed | | | | |
| T2.2 read the tail, not from turn 1 (Q8) | | | | |
| T2.3 continuation followed as written, or answer-then-offer | | | | |
| T2.4 `transcript.todos`, not a read | | | | |
| T2.5 search; bounded result named | | | | |
| T3.1 discussion read; second read follows a continuation | | | | |
| T3.1 answer-then-offer when turns were left | | | | |
| T3.2 hints followed; same-session hints combined | | | | |
| T3.3 no new read | | | | |
| T3.4 window offer: narrower read, not a later turn | | | | |
| Any refusal (`reason=`) | | | | |
| Any unknown session id | | | | |

### Mechanical checks

| Check | Result |
|---|---|
| G: guest read `characters=` | |
| G: host catch-up `N turns, D deferred, characters=C` | |
| G: host Context Budget before → after | |
| G: crowding criteria (any hold?) | |
| H: pre-Slice-4 room recalled | |
| I: `window=unknown`, then the 150,000 total limited or refused the second read | |
| I: persona offered a later turn | |
| K: Context Budget after the two-read turn | |
| K: Context Budget after the next turn | |
| L: cold search `durationMs`, sessions, `parsedBytes` | |
| L: warm search `durationMs`, `cacheHits` | |
| L: to-dos `durationMs` | |
| L: machine | |

## Phase C record

*Filled in by phase C: the U2 audit, the grammar tally, the budget coverage
map, each evidence-driven change with its witness, and the answers to
Q5–Q8.*

# ADR 2026-11-18: Workshop Context Breakdown, Part by Part

**Status:** Proposed. The defaults below are Okey's brief for this feature
(2026-11-18); where the code showed one to be wrong, the decision says so
and why.
**Date:** 2026-11-18
**Idea as filed:** [Show What a Participant's Context Holds, Part by Part](../../.todo/features/feature-workshop-context-breakdown/README.md)
**Extends:**
- [ADR 2026-09-30: Rewind and Branch](2026-09-30-workshop-rewind-and-branch.md):
  the tally is sliced at the same marks as the manifest, by the one transform.
- [ADR 2026-07-30: Session Codec Evolution](2026-07-30-workshop-session-codec-evolution.md):
  the archive gains one optional, additive field, with no `schemaVersion` bump.
- [ADR 2026-11-03](2026-11-03-workshop-wayfinding.md) D2: the "In context"
  list and its partition stay as they are.

Paths below that start `core/` are under `packages/core/src/`.

## Context

The Workshop's Context panel (`ContextBudget`) shows the provider-measured
total, "Current context 160,656" (`ContextBudgetSnapshot.contextTokens`), and
an "In context" list of materials: the excerpt, attachments, and what a
persona read. Everything else the participant carries is invisible: the
system prompt, the capability contract frozen into the first message, the
`<project-memory>` block and its update notes, to-do snapshots, room notes
(catch-ups, reactions, the time, host updates, behavior frames, reminders),
and the conversation itself. In Okey's screenshot about 40K of a 161K
context is not on the list.

The host writes all of that text, so it can measure it as it writes it.

## Decisions

### D1. A summary by part, above the "In context" list

The panel's details gain a summary with eight parts, in this order:

| Part | What's in it |
|---|---|
| Persona and behavior | the system prompt's persona, mode, depth, reaction and expression sections, the writer profile, standing directives |
| Tool-use instructions | the system prompt's capability, memory, file-edit, edit-offer, help and lens sections and the widget-recommendation contract; the capability contract frozen into the first message; each turn's reminder |
| Project memory | the `<project-memory>` start block (item C's titles tier included), `<project-memory-update>` notes, and notes a persona read |
| To-dos | each `<workshop-todo-snapshot>` sent |
| Room notes | catch-ups, a guest's join transcript, reactions and the reaction invite, the time, behavior and mode frames, the edit-offer reminder, the trailer-outcomes line (item D), a pressed edit offer's directive |
| Excerpt and context | the excerpt, its revisions, standing context and message attachments |
| Requested by the persona | files, sessions, dictionary entries and reports a persona read |
| Conversation | the writer's messages and the replies: **the rest** |

- **A bar split into one labeled segment per part**, with a table beside it
  that carries the same numbers for screen readers. Segments too narrow for
  their label keep it as a tooltip and in the table.
- **The two system-prompt lines open to their sections**
  ("Interaction mode: Balanced · about 900 tokens"). Project memory, to-dos
  and room notes open to their pieces.
- **The "In context" list below is unchanged.**

### D2. The parts add up to the provider's total

Conversation is the remainder: `contextTokens` minus every other part, and
it is labeled "the rest". If the estimates ever exceed the measured total,
the panel says so ("The estimates come to more than the measured total")
and shows Conversation as 0, never a negative. The webview computes the
remainder in a pure module (`utils/workshop/contextBreakdownView.ts`); the
host sends only the parts it measured.

### D3. The host measures what it writes

Each frame is measured with `estimateTextTokens`, the estimator the Memory
tab's meter uses, at the moment it is put into a message. Every tallied
number is labeled as an estimate.

Requested rows keep their provider-measured `promptTokensDelta`; a row
without one is estimated from its size. A part made of both is labeled
"partly estimated".

**Where the code differs from the brief: Excerpt and context is measured
from the frames, not from the rows.** The writer rows (`pin`, `attachment`,
`message-attachment`) carry characters only, never tokens, and the host's
attachment rows list the *current* attachments, including ones not yet
delivered. Summing them would mix units and count text the participant
has not received. The frames that carried the material are what the
participant holds, so the tally measures those. The rows themselves are
shown as before.

**Memory reads roll up into Project memory,** as the note's table says,
not into Requested. Requested is every other read-in row.

### D4. The system prompt is measured per section, from its own path list

`workshopPersonaSystemPromptPaths` stays the one assembly chain. The
assembly moves out of `AssistantToolService` into
`infrastructure/api/services/analysis/WorkshopPersonaSystemPrompt.ts`,
which writes the text as before (`PromptLoader.loadPrompts`, then the
writer profile, standing directives and the widget instruction) and
returns it **with** its sections. To measure, it loads each path again on
its own and keeps the sections only when, joined as `loadPrompts` joins
them, they rebuild the chain exactly; otherwise it keeps none. A test pins
the text to the old assembly, byte for byte.

- A section's part comes from a closed set of tool-use paths
  (`WORKSHOP_TOOL_USE_PROMPT_PATHS`); every other path is Persona and
  behavior. A new section is measured with no further work, and lands in
  Persona and behavior until it is listed.
- A section's name is the host's (a table, then a name made from the file
  name). Never prompt text.
- **The current system prompt is measured.** A behavior change replaces the
  system message between runs. Each assembled prompt's sections are kept in
  a small cache keyed by the SHA-256 of its text
  (`WorkshopSystemPromptMeasures`, 32 entries), and the panel reads the
  conversation's *held* system message and looks it up. A held message the
  cache has not seen (none, today: every build goes through the assembly)
  still shows its total, estimated from the held text, with no sections.

### D5. What round two added is measured too

Item C's titles tier rides the `<project-memory>` block, item D's
`<workshop-trailer-outcomes>` line is a room note, and item H's
`help-capability.md` is a tool-use section, so each is measured by D3 and
D4 with nothing of its own.

### D6. The tally: one entry per message, beside the manifest

- **The engine gets a seam, never a branch.** `AgentRunOptions.contextTally`
  is an optional function the owner passes; at the turn's commit, beside the
  manifest rows and the context snapshot (deferred retention included), the
  engine asks it for the opening message's measured pieces and stores them
  with `ConversationManager.appendContextTally`. The engine names no piece.
- **An entry is `{ messageIndex, pieces }`**: the opening user message's
  index in the archived history (system prompt excluded) and a record of
  piece id → tokens, bounded to 32 keys. One entry per committed turn,
  never one per frame. Piece ids are the Workshop's closed list
  (`WORKSHOP_CONTEXT_TALLY_PIECES`); the manager stores them as opaque,
  validated keys.
- **The owner's recorder** (`WorkshopContextTallyRecorder`) is minted per
  run by the room handler and handed to every layer that writes a frame:
  the handler's frames, the fresh host's envelope
  (`WorkshopPersonaUserMessage`), the guest join, and the capability's
  contract and turn reminder (`WorkshopPersonaCapabilityTurn.contextTally`).
- **Cuts. Default 6 said "slice at the same marks
  (`ConversationHistoryCounts`)". It does, by `messageCount`, with no new
  mark field:** an entry names its message, so a cut to `messageCount`
  keeps exactly the entries with `messageIndex < messageCount`. Marks, their
  codec and old marks need nothing new. `rewindWorkshopSession` is the one
  place that cuts (test: a cut removes the tallies of the messages it
  removes). Branch copies the cut archive; reset and delete clear it.
- **A system-message replacement keeps the tally**: it measured user
  messages, which the replacement does not touch.

### D7. Session codec

`ConversationArchiveEntryV1.contextTally` is optional and additive, with no
`schemaVersion` bump (ADR 2026-07-30). Written whenever a conversation holds
entries; an older build's import ignores it. An invalid tally is dropped on
import and logged by count: the conversation itself is never degraded for
a display field. `__tests__/fixtures/workshop-session-v2-before-context-tally.json`
is an authentic session from before the change and must keep reading.

**A conversation without entry 0** (one begun before this change) has
untallied messages. Its panel shows the system prompt and Requested, which
need no tally, and "not measured" for Project memory, To-dos, Room notes,
Excerpt and context, and the first message's contract. Conversation is
then "the rest, with what was not measured". No number is invented.

### D8. Display-safe

The webview contract (`ContextBreakdown`, on `LabeledContextBudgetSnapshot`)
carries parts, host section and piece names, counts and token numbers
only. No prompt text, path or frame body enters it (test). Logs carry piece
ids and counts.

### D9. Workshop only, per participant

`ContextBudget` is used only by `WorkshopApp.tsx`; the sidebar shows no
context panel. The host and each guest show their own conversation's
parts. A tool sidecar shows no breakdown: its system prompt is not a
persona's and it has no frames to tally.

### D10. Not built

A "View system prompt" button stays in the note as a later idea.

### D11. Transcript export

Nothing is added to a turn: the tally lives on the conversation archive,
which the transcript projection never reads. Export and recall are
unchanged (omit, by construction).

## Review record

**PR #285, first review (Astra, 2026-11-18): three P2 findings, all fixed.**

- **F-01. A reopened room hid even the known parts.** Open, Rewind and a
  behavior change leave no provider total, and the projection skipped
  measuring without one. Now the host measures whenever the participant
  has a conversation. Without a total, the panel opens to the parts it
  measured and withholds the bar, the shares and Conversation's remainder
  ("Total not measured yet — parts so far"). Amends D2.
- **F-02. A reply without usage mixed two turns.** A committed turn with no
  provider observation kept the previous turn's total while the tally moved
  on, so new parts were set against an old total. Now such a commit clears
  the total (`setContextBudget(id, undefined)`): the panel shows the parts
  without a total until the next measured reply. Amends D2 and D6.
- **F-03. An apportioned read was labeled "measured".** A delta the engine
  splits across a read's files carries `isEstimate: true`. A row counts as
  provider-measured only with a delta and without that flag; its number is
  kept either way. Amends D3.

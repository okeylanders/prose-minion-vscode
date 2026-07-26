# ADR 2026-07-24: The Workshop Room Ledger and Delivery Offsets

**Status:** Proposed
**Date:** 2026-07-24
**Extends:** [ADR 2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](2026-07-09-workshop-persona-hosted-conversations.md); [ADR 2026-07-11 — Workshop Excerpt Revision and Room Memory](2026-07-11-workshop-excerpt-revision-and-room-memory.md); [ADR 2026-07-11 — Workshop Guest Persona Sidecars](2026-07-11-workshop-guest-persona-sidecars.md); [ADR 2026-07-14 — Workshop Session Persistence and the Session Browser](2026-07-14-workshop-session-persistence.md)
**Supersedes:**
[ADR 2026-07-11 — Workshop Guest Persona Sidecars](2026-07-11-workshop-guest-persona-sidecars.md) §3 "Isolated after join; cursor-based catch-up in both directions" — the catch-up directions and cursor semantics are restated here; §§1, 2, 4, 5 stand unchanged.
[ADR 2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](2026-07-09-workshop-persona-hosted-conversations.md), the direct-tool handoff rule ("…has not yet seen as a bounded, structured handoff") — that path is deleted, not re-bounded.
**Epic:** [Assistant as a Full Editor Tab](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/epic-workshop-editor-tab-2026-07-03.md)
**Implementing sprint:** [Sprint 13D — Room Catch-up and Release Polish](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/13d-room-catchup-release-polish.md)
**Feature investigation:** [Guest-to-Guest Room Catch-Up](../../.todo/features/feature-workshop-guest-room-catchup/README.md)

## Context

The Workshop presents a room. Underneath, it is one ordered ledger plus several
independent provider conversations:

- `WorkshopSessionService.turns` is the session-wide ordered log. Every turn —
  writer, host, guest, tool report, direct-tool exchange, session event —
  receives a universal id from `nextTurnId(...)` and is appended exactly once.
- `ConversationManager` holds one `OpenRouterMessage[]` per participant:
  a sole leading system message followed by strictly alternating
  `user`/`assistant` pairs, enforced by `assertCommittedMessageShape` and
  `assertArchivedMessageShape`. There is no provider-side thread; the whole
  array is re-sent each turn, and provider prompt caching depends on a
  byte-identical **prefix**.

A participant never sees another participant's words as an `assistant` turn.
Cross-participant material arrives as quoted, speaker-labeled text inside the
**user** message, wrapped in `<workshop-guest-catch-up>`,
`<workshop-guest-handoff>`, or the direct-tool handoff envelope. That invariant
is load-bearing: it is why `replaceSystemMessages` can retarget a retained
conversation without its history beginning to lie about who spoke.

Four delivery relationships have grown independently on top of that spine:

| Relationship | Collector | Committer | Cursor |
|---|---|---|---|
| Direct tool → host | `collectUnseenDirectExchanges` | `commitHostHandoff` | `WorkshopToolSidecar.deliveredToHostThroughTurnId` |
| Host room → guest | `collectUnseenHostTurnsForGuest` | `commitGuestCatchUp` | `guest.lastSeenHostTurnId` |
| Guest → host | `collectUnseenGuestExchangesForHost` | `commitHostGuestHandoff` | `guest.deliveredToHostThroughTurnId` |
| Guest A → Guest B | *(does not exist)* | — | — |

Sprint 13D must add the fourth. Doing so on the current foundation surfaces
five structural problems:

1. **Two packers, drifted.** `buildGuestTranscriptFrame` and
   `boundByCharacterBudget` implement the same newest-first, head-truncating
   character budget with different markers, different header formats, different
   placement of the window-omission count, and opposite `deliveredTurnIds`
   ordering (`unshift` vs `push`). Nothing breaks today only because every
   committer takes the maximum index.
2. **Newest-first packing paired with a scalar cursor loses history.** Each
   collector returns everything past the cursor; each packer keeps the newest
   window and drops the oldest on overflow; each committer then advances the
   cursor to the **newest** delivered id. Turns dropped by the window or the
   budget fall behind the cursor and are never delivered. This is live today in
   all three existing relationships, not a hazard introduced by 13D.
3. **Visibility is decided twice.** The aggregate filters eligibility in
   `isHostThreadTurn` and the per-relationship collectors; the prompt builder
   filters again in `isGuestTranscriptTurn`, already carrying an
   `includeGuestTurns` boolean. A room frame adds materially harder rules
   (include other guests, exclude the recipient's own retained conversation,
   exclude private capability work, include published capability evidence) to
   both sites.
4. **Cursors are multiplying per relationship.** A fourth relationship implies a
   fourth cursor and a fourth hand-rolled max-index scan. Per-relationship
   cursors grow with the square of participants.
5. **There is more than one delivery site.** `RunWorkshopToolSidePass` builds
   and commits its own direct-tool handoff during synthesis, carrying no guest
   evidence at all. Two code paths deliver to the host with different content
   and different accounting. Under a single offset that is not merely untidy —
   it is unsound.

A sixth problem is empirical rather than structural. `guestCatchUp` allows
20,000 characters while a persona reply can reach roughly 40,000 at the default
`maxTokens`, and `toolEvidence` alone permits 50,000. Head truncation of a
quoted turn is therefore not an edge case in these frames; it is the common
case for tool reports and long replies.

## Decision

### 1. The room thread is canonical; provider arrays are derived views

`WorkshopSessionService.turns` is the single source of truth for what happened
in the room. Each participant's `OpenRouterMessage[]` is a **derived,
incrementally materialized projection** of that ledger, specialized by reader:
a turn is `assistant` in its own speaker's array and quoted `user` content in
every other array.

Nothing is copied into a per-participant mailbox. "Pending delivery" is not a
stored queue; it is the region of the ledger past a participant's offset.

### 2. Visibility is one computed predicate over principals

A single pure function is the sole authority on who a turn is for:

```text
audience(turn) → 'room' | 'private'   // 'private' carries its owning principal
```

**There is no host-privileged visibility class.** Host and guests differ in
tenure, prompt, and permissions — not in what they are allowed to read. A class
visible to the host but not to guests would be a *relationship* disguised as a
visibility rule, and it is the origin of the per-relationship cursors this ADR
removes.

`private` carries a **principal**, not a participant. A principal is any entity
that can own a conversation: the host, a persona guest, a tool sidecar, and — in
a later release — a sub-agent "tangent" thread. This is what lets two values
cover cases that look unrelated:

| Turn | Classification |
|---|---|
| Writer message, host reply, guest reply, room-commissioned tool report | `room` |
| Direct-tool sidecar exchange | `private(sidecar:<toolId>)` |
| Capability catalog/search request or non-success result | `private(invoking principal)` |
| Evidence-bearing capability result published with a committed participant reply | `room` |
| Evidence-bearing capability result whose participant reply did not commit | `private(invoking principal)` |
| Future tangent / sub-agent thread | `private(tangent:<id>)` |

A tangent thread requires no new visibility value, no new cursor, and no schema
change. That an unbuilt feature already fits is the evidence the two-value model
is the right size.

**Principals and publication are persisted facts; classification is not.** Who
invoked a capability is a historical fact and must be recorded on the turn —
today capability artifacts are appended as `participant: 'tool'` with no
`personaId`, which is safe only because the host is currently the sole invoker.
Sprint 13C makes guests invokers, at which point ownership becomes unrecoverable
from the record unless it is stored.

Publication is also a historical fact: an evidence-bearing result either
belonged to a participant turn whose final reply committed, or it did not. The
durable model records enough correlation to prove that committed publication;
it does not ask a model or a later heuristic whether the persona "used" the
evidence. The `audience` classification remains a computed policy over those
facts.

Capability traffic follows this publication rule:

- `resource.catalog` and `resource.search` remain private discovery work even
  when successful. Their listings, snippets, and intermediate rummaging would
  add room noise without bringing a source to the table.
- Successful or partial `resource.read`, dictionary lookup/full-entry, and
  participant-requested analysis results are evidence-bearing. They become
  `room` evidence only when the invoking participant's final reply commits.
- Failed, rejected, cancelled, or stale capability results remain private.
  Evidence from a participant turn whose final reply fails or is cancelled also
  remains private.
- Publication changes model-visible room context, not the capability result's
  speaker or provenance. The result remains attributed to its invoking
  principal.

The predicate is a total function of stored turn fields plus the reading
principal — a turn is never quoted back to its own speaker. Both the collector
and the packer consume it; the packer performs **no filtering of its own**.
`isGuestTranscriptTurn`'s `includeGuestTurns` boolean is removed rather than
joined by a second flag.

Reclassification is **prospective**. Changing the predicate re-classifies turns
a reader has not yet passed; it cannot retrieve turns already behind that
reader's offset. A policy change that must reach delivered history requires a
deliberate offset reset, which is a separate decision and not implied here.

**`audience` governs prompts, not display.** What the transcript pane shows a
writer is a distinct axis. The two are conflated today only because everything
renders in one stream; a future "show only this tangent" view is a display
filter over principals, not a change to this predicate.

### 3. Every participant carries exactly one inbound offset

Delivery state is per **participant**, never per relationship. Each participant
— the host and every guest alike — holds one field:

```text
lastSeenRoomTurnId — the turn this participant has been read up to
```

Three cursor families collapse into it:

| Removed | Replaced by |
|---|---|
| `guest.lastSeenHostTurnId` | `guest.lastSeenRoomTurnId` (room ⊇ host) |
| `guest.deliveredToHostThroughTurnId` | `host.lastSeenRoomTurnId` |
| `sidecar.deliveredToHostThroughTurnId` | nothing — sidecar conversation reaches no participant (§9), and a tool report is an ordinary room turn already covered by every participant's offset |

"What has the host seen of this guest" is not a property of the guest; it is
the host's own reading position. Outbound cursors existed only because the host
had no offset of its own, which followed from the host-privileged visibility
class removed in §2.

The entire direct-tool handoff path is therefore deleted rather than migrated:
`collectUnseenDirectExchanges`, `commitHostHandoff`, `buildWorkshopDirectHandoff`,
the `DIRECT-TOOL HANDOFF` envelope, and `WorkshopHostMessageOptions.handoff`.

**Only participants carry offsets. Instruments do not.** A tool sidecar
receives the excerpt and the writer's message; it never receives room history,
so it has no reading position to track. That is the real distinction between a
participant and an instrument — kind, not privilege.

**A replaced guest does not inherit a reading position.** Guest adoption
currently carries a prior delivery cursor across replacement. Under one offset
per participant the rule is restated explicitly: a re-invited persona is a new
participant that starts from a join snapshot (§6), because its conversation is
new and cannot have "already read" anything. Inheriting an offset would silently
suppress the snapshot's own history.

This construction also satisfies the guest-catch-up guardrail by design rather
than by care: because offsets are per participant, a guest reading another
guest's exchange cannot consume evidence before the host reads it. That hazard
belonged to a shared cursor, which no longer exists.

### 4. Exactly one delivery site

Every model call to a participant passes through **one** function that
materializes that reader's pending turns, and **one** function that advances the
offset on success. No path may hand a participant evidence out of band.

This is what the tool side-pass violates today: it composes its own handoff and
commits its own cursor, so the host receives instrument evidence through a door
the room does not know about. Under the new model that path becomes an ordinary
host delivery whose trailing evidence happens to be the report just committed.

The invariant is structural, so it is enforced structurally: an
`__tests__/architecture/` guard asserts a single call site constructs the
catch-up frame and a single call site advances an offset. A behavioral test
cannot catch a *second* delivery path being added later — which is exactly how
the first one appeared.

### 5. Delivery is a contiguous oldest-first prefix of the reader's projection

An offset into an append-only log can only mean *"everything before this."* It
may never jump a turn that was not delivered.

**Contiguity is defined over the reader's eligible projection**, not over
physical ledger rows: the ordered subsequence of turns whose `audience` includes
this reader and whose speaker is not this reader. Rows the reader is not
entitled to see are not gaps in that reader's prefix.

Committing therefore reduces to recording the prefix's last id. The four
hand-rolled max-index scans are deleted along with the cursors they scanned.

### 6. A turn is atomic; catch-up delivery is unbounded for now

**No frame may ever ship part of a turn.** The prior packers head-truncated an
oversized block and marked it delivered, which is not a bound — it is a misquote
committed to the record, and (given the budgets against reply sizes) the normal
outcome rather than a rare one.

For Sprint 13D, catch-up delivers the reader's **entire** pending eligible
prefix. There is no turn window and no shaping character budget; a single large
constant remains only as a runaway guard, and if it ever fires the remainder
**defers** — losslessly, because the offset does not move past what was not
sent. Bounding catch-up is deferred to the context-compaction work, where it
belongs.

Two consequences worth stating plainly:

- Unbounded delivery makes contiguity trivial. Every successful turn brings the
  reader fully current, so "pending" exists only between a failure and its
  retry. The lag a long-idle participant would otherwise accumulate under
  oldest-first packing does not arise.
- The cost moves to size. A guest unaddressed for a long stretch of a busy room
  receives one large message. A turn larger than the model's context surfaces as
  a provider error — visible and honest, and squarely the compaction problem.

**Snapshot frames stay bounded**, and the join snapshot becomes **room-wide**
rather than host-only: under §2 a joining guest reads what every participant
reads. It may omit *whole* turns with a disclosed count — a snapshot is
explicitly recent history, and omission there is honest — but it may not split
one.

The dividing principle, which governs every future frame:

> A disclosed slice of **source material the writer selected** — excerpt trims,
> context attachments, thread artifacts, with their `Head slice: N of M words`
> provenance — is honest. A slice of **another participant's speech** is a
> misquote: nobody consented to it, and the speaker cannot correct the record.

### 7. One packer, extracted before behavior changes

`buildGuestTranscriptFrame` and `boundByCharacterBudget` collapse into one pure
packer whose published contract states the ordering rule, the atomicity rule,
the omission accounting, and — explicitly — the **ordering of
`deliveredTurnIds`**, which the two implementations currently get backwards from
each other. Frame-specific text (tag name, header lines, safety footer) is
supplied by the caller; the packer takes a named policy value, not booleans.
Truncation markers and character accounting are removed with §6.

The extraction lands first, as a pure refactor with no behavior change and
existing tests untouched, so the semantic changes are reviewable on their own.

### 8. Classification is immediate except transactional capability publication; delivery stays lazy

Turn commit performs no provider work for other participants. It cannot: a
provider array that ends on a `user` message is an incomplete exchange, which
`assertArchivedMessageShape` rejects and export refuses to persist. Eager
fan-out would require either running every persona on every turn (rejected as a
non-goal and an N× cost) or a per-participant pending queue (rejected in
*Alternatives considered*).

Ordinary room turns are classifiable as soon as they commit. Capability
evidence is the deliberate exception: it stays private while its participant
turn is in flight and becomes publishable atomically with that participant's
committed final reply. A failed or cancelled turn cannot leak its intermediate
research into the room. This publication transition performs no provider work;
other participants still receive the evidence lazily on their next successful
turn through the one delivery site.

The Workshop admits only one active room run. Publication resolves before that
run unlocks or another participant can advance an offset, so no reader can pass
provisionally private evidence that later becomes `room`. This transactional
ordering is required; without it, prospective reclassification (§2) could strand
newly published evidence behind a reader's offset.

What *is* immediate is everything that costs nothing: unread counts and rail
state are computed on demand by counting eligible turns past each offset. The
participant rail updates the instant a turn commits, with no model call, no
token spend, and no blocking of target selection. Target switching remains
local, immediate, and free.

### 9. Tools are instruments, not participants

The distinction is already real in the ledger and is now made honest in the UI.
Per §2 the host and guests read identically; the only asymmetry is that
instruments read nothing:

| Traffic | Every participant | Instruments |
|---|---|---|
| Tool **report** commissioned in the room | visible | never |
| **Direct-tool sidecar** conversation | never | its own sidecar only |
| Published evidence-bearing capability result | visible | never |
| Catalog/search, failed, cancelled, or uncommitted capability work | invoking principal only | never |

**An instrument's output is its report; the conversation around it is working
notes.** The report is room history and always was. The exchange that produced
it now reaches no participant at all — replacing the prior rule under which the
host alone received it as bounded handoff evidence.

This is a deliberate removal, not a no-op: the host previously knew what the
writer had asked an instrument and could reference it. It now knows only that a
report exists. The gain is that a sidecar becomes a genuinely private
scratchpad, and per §2 the reverse decision — admitting sidecar conversation to
the room as one-way history — is a predicate value, not a schema change.

The participant rail separates participants from instruments with a real
`role="separator"` and labeled groups, not a decorative glyph. UI copy may
truthfully call a sidecar private, and must not imply that its *reports* are:
running a tool in the room publishes its report to the room.

### 10. Writer attribution is a render parameter, never ledger state

When `WorkshopWriterProfile` supplies a name, writer blocks in a quoted frame
render as `Writer (Okey):` and `Writer (Okey) → Felix:`, falling back to
`Writer:` / `Writer → Felix:` when the profile is disabled or nameless. The
role anchor is retained so a persona reads the speaker as *the writer* rather
than an unintroduced third party.

The name is passed into the frame builder at render time. It is **not** stamped
onto turns and **not** persisted into the session file — preserving the
boundary `WorkshopWriterProfileService` exists to hold, so that raw biography
never becomes session state. It is writer-supplied text entering model-visible
prose and is delimiter-neutralized like every other writer string.

The string must be byte-identical to whatever name the persona's system prompt
already carries. Two spellings of the writer in one context window are two
people.

### 11. Temporal markers are frame-level, not per-line

Every turn carries a host-stamped `timestamp`, so the data is free to read. It
is not free to *read past*: a stamp on every quoted line is attention spent on
bookkeeping instead of prose. Therefore:

- One frame header line stating the span covered, in relative terms:
  `Covers: 14 minutes of room activity, ending 2 minutes ago.`
- Inline gap markers (`[3 hours later]`) only where a gap exceeds a configured
  threshold. A gap is information; a stamp on every line is noise.
- Relative phrasing only. Absolute wall-clock already rides
  `<workshop-time-context>`; repeating it invites temporal arithmetic.
- The existing guardrail travels with any gap marker: *"Do not infer what the
  writer did, thought, or felt during any elapsed gap."*
- Timestamps are host-stamped and never model-generated, matching the existing
  discipline for `personaLabel` and `toolLabel`.

### 12. Legacy cursor keys and capability publication are normalized in V1

`parseWorkshopSessionStateV1` validates shape with exact-key recursion *before*
the aggregate exists, so a session file written by an earlier build fails at the
door — the aggregate never gets the chance to discard its cursors. "Hydrate at
head" is therefore not implementable as a hydration policy alone.

The chosen posture is the cheapest honest one: the shape validator accepts the
three removed keys as **known-legacy-ignored**, hydration drops them, and every
participant's offset is set to the newest turn so a restored room starts current
rather than replaying itself. No V2, no migration step, no data loss. The
allowance is a named exception with a removal date — v1.0 — not a compatibility
layer.

Pre-13D capability artifacts also lack committed-publication correlation. The
shape validator accepts that absence and hydration treats those artifacts as
legacy-private rather than retroactively publishing evidence into conversations
that never received it. Newly committed capability evidence always records the
publication fact. Existing sessions therefore open without inventing shared
history, and new evidence follows §2.

`WorkshopSessionStateV1Shape` and `WorkshopSessionStateV1Integrity` validate the
current participant offsets, including the host's, and the capability
publication facts. The host participant record is a new shape because it
previously held no delivery state.

## Alternatives considered

**Eager fan-out into each participant's thread at turn commit.** Rejected on
protocol grounds. A provider array cannot hold a trailing `user` message, so
eager delivery requires either N runs per turn or a per-participant pending
queue. The queue is not a simplification: it is the offset denormalized into
mutable state that can drift from the ledger, needs transactional dequeue for
cancellation and retry, needs its own persisted schema and integrity rules, and
needs seeding from a bounded slice of the log for a mid-session guest. Offsets
give the same behavior as derived state that cannot drift. The rule
consolidation this alternative was reaching for is delivered instead by §2, §4,
and §8.

**Blocking target switching until all threads are synced.** Rejected as
following only from eager fan-out. Under lazy delivery there is nothing to wait
for, and switching stays instant.

**One literal shared provider array with a swapped system prompt.** Rejected.
Role is not a property of a turn but of a turn *relative to its reader*; one
shared array forces one role assignment, so some persona reads another's words
as its own memory. It also produces runs of consecutive `user` blocks that
violate the alternation invariant, and — because prefix caching survives
appends but dies on insertions — it would invalidate every persona's cache on
every turn.

**Persisting `audience` as a stamp on each turn.** Rejected per §2: it converts
a future policy change into a data migration. The *principal* is persisted
because it is a fact; the classification is not, because it is a policy.

**Deferring an oversized turn intact rather than shipping it.** Rejected: under
an oldest-first prefix, a turn larger than the bound would stall every turn
behind it permanently, starving that participant. With §6 there is no bound to
exceed, and the runaway guard ships at least one whole turn regardless.

**A fragment/continuation model for oversized turns.** Rejected as substantial
machinery — fragment identity, reassembly, partial-delivery accounting — for a
case §6 removes.

**Schema V2 with a one-way V1→V2 migration.** Rejected per §12 as churn
disproportionate to alpha, where the only requirement is that existing sessions
keep opening.

## Consequences

- Guest→guest catch-up becomes an ordinary case of one mechanism rather than a
  fourth relationship with a fourth cursor. Adding an Nth participant adds one
  field, not N relationships.
- Three existing relationships stop silently losing turns, and stop shipping
  half-quotes as delivered evidence.
- The persisted V1 shape **shrinks** overall: three cursor families out, one
  field per participant in, plus capability principal and publication facts.
  No new persisted collection is introduced.
- Four collect/commit method pairs, two packers, three frame builders, and two
  delivery sites reduce to one of each. The direct-tool handoff path is deleted
  outright, so its tests are removed rather than rewritten.
- The host stops receiving the writer's direct-tool exchanges. It sees the
  report and nothing else. Reversing this is a §2 predicate value.
- Participants share evidence-bearing resource reads, dictionary evidence, and
  participant-requested analysis results once the invoking participant's reply
  commits. Catalog/search traffic and unsuccessful or orphaned capability work
  remain private.
- Catch-up messages can be large, and grow with how long a participant has gone
  unaddressed. This is accepted for 13D and is the entry point for the
  compaction work; it is not a bug to be patched with truncation.
- One-shot Conversation Widgets and future tangent threads are predicate and
  principal work, not plumbing work.
- Per-line temporal precision is deliberately unavailable; the span header and
  gap markers are the contract.
- The packer becomes a single point of failure for every frame, which is the
  point: it also becomes a single point of test.

## Explicitly unchanged

- Retained conversations remain separate, with their own system prompts,
  histories, and provider caches. There is no host swapping and no
  guest-created participant.
- A guest seeing another guest never consumes evidence before the host sees it.
  This was a policy; per §3 it is now a property of per-participant offsets.
- Quoted room history remains context, not instructions, and no participant may
  claim to have witnessed turns omitted by a snapshot bound.
- Conversation Widgets remain writer-owned. Capability discovery traffic and
  unsuccessful/uncommitted capability artifacts remain private to their
  invoking principal; published evidence-bearing results become room context
  under §2.
- Target selection makes no provider call and spends no tokens.
- Excerpt, context-attachment, and thread-artifact head slices keep their
  existing bounds and disclosed provenance (§6).

## Implementation

Sprint 13D, in four reviewable steps on one branch:

1. **13D-a** — extract the shared packer. Pure refactor; no behavior change;
   existing tests untouched.
2. **13D-b1** — the durable model: `audience(turn)` over principals, persisted
   principal and committed-publication facts on capability turns, one offset
   per participant, legacy key allowance, hydration. Invariant tests land
   here.
3. **13D-b2** — switch every delivery path to the single site and the
   contiguous-prefix receipt; delete the direct-tool handoff path; make turns
   atomic and catch-up unbounded. The surviving guest-handoff tests encode the
   newest-first and truncation assumptions in their assertions and are
   rewritten, not extended.
4. **13D-c** — the single catch-up frame, room-wide join snapshot, writer
   attribution, temporal markers, the participants/instruments rail divider, and
   release evidence.

The b1/b2 seam is deliberate: b1 changes what is stored, b2 changes what is
sent. Reviewing them together would mean reviewing a data model and a delivery
protocol in one diff.

Focused tests must cover: A→B carrying A's unseen exchange; a host turn missed
by B arriving in the same frame; B's own turns never quoted back to B; a tool
report reaching every participant while its sidecar conversation reaches none;
an evidence-bearing capability result reaching every participant only after its
invoking participant's reply commits; catalog/search and
failed/cancelled/uncommitted capability work remaining private; a turn never
split across or within frames; retry and cancellation idempotence; the tool
side-pass delivering through the single site; a re-invited guest starting from
a snapshot rather than an inherited offset; and a session file carrying the
legacy cursor keys opening cleanly.

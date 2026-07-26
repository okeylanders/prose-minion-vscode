# ADR 2026-07-26: Workshop Open Rooms Admit Persona Guests

**Status:** Accepted
**Date:** 2026-07-26
**Extends:** [ADR 2026-07-11 — Workshop Guest Persona Sidecars](2026-07-11-workshop-guest-persona-sidecars.md), [ADR 2026-07-24 — The Workshop Room Ledger and Delivery Offsets](2026-07-24-workshop-room-ledger-and-delivery-offsets.md), and [ADR 2026-07-25 — Workshop Session Scope Is Immutable After Conversation Starts](2026-07-25-workshop-scope-immutability.md)
**Implementing sprint:** [Sprint 13D_2 — Open Room Participants](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/13d_2-open-room-participants.md)

## Context

Sprint 13A made `open` a real Workshop scope: the host may retain a truthful
conversation without a pinned excerpt, while excerpt-dependent tools remain
unavailable. Guest invitation was deliberately left excerpt-only until the
join envelope could make the same honesty guarantee.

That temporary boundary now makes the room asymmetric. The UI hides the guest
invitation, the handler rejects it, and the aggregate requires an excerpt for
guest join and continuation even though:

- the room ledger and delivery offsets are participant-based, not
  excerpt-based;
- guest resource and dictionary capabilities do not require an excerpt;
- the existing open-conversation frame already states exactly what the persona
  has and has not read; and
- standing context is valid in an open conversation.

A separate presentation defect makes the first ordinary host message say
`Catching Jill up on the room…` when the only pending ledger turn is the
session-start marker. The marker is legitimate durable history, but it is not
conversational catch-up.

## Decision

### 1. Persona participation follows session scope

Both the permanent host and persona guests may join and continue when the
session has either:

- `scope: excerpt` with a non-empty pinned excerpt; or
- `scope: open`, with no fabricated or implied excerpt.

An unchosen `scope: null` remains invalid. Direct tool sidecars and
writer-launched analysis tools remain excerpt-gated. This change does not make
a blank `WorkshopExcerpt` legal and does not widen filesystem access.

The aggregate owns this invariant once as a typed participant-subject status.
Its private guard enforces that status, handlers translate its refusal reason
into user-facing errors, and the session snapshot exposes only the resulting
`participantSubjectReady` boolean to the webview. Presentation code may combine
that answer with local busy/readiness state; it may not recreate a different
host-versus-guest policy.

### 2. A guest join receives one truthful subject envelope

The existing bounded room snapshot remains the guest's shared conversation
history. Beside it, the guest receives exactly one current-subject frame:

- excerpt scope: the existing bounded `<pinned-excerpt>` frame; or
- open scope: the existing `<workshop-open-conversation>` honesty frame,
  addressed to that guest.

The join also carries the session's standing context attachments. Guest-join
start atomically captures the excerpt and attachments used to build the
provider envelope, plus the writer-source rows derived from them. Those rows
ride the active run across the awaited provider call and seed the retained
guest manifest at adoption; adoption never re-reads live room context.
Resource catalog/search traffic remains private under the room-ledger ADR;
evidence publication rules are unchanged.

### 3. Lifecycle markers do not impersonate conversation

`session_start` and `session_resume` remain durable room turns and may remain
in a delivered catch-up frame. A complete eligible backlog containing only
those lifecycle markers does not trigger
`Catching <participant> up on the room…`. Any other eligible pending turn is
conversational catch-up and keeps the existing copy. Classification happens
before the runaway guard shapes the delivered prefix, so deferred conversation
cannot be hidden behind lifecycle-only status.

This is a status classification, not a new audience class or a second delivery
cursor.

### 4. Scope and participant identity have separate UI owners

The scope strip and header own the explicit open-room/no-excerpt explanation.
The context meter names the active participant. Its caller supplies the
participant label and an explicit `showsContextSuffix` flag; suffix presence
is never inferred from string shape. In an unmeasured open room it therefore
shows the participant name (`Jill`), not another copy of the scope warning.

## Consequences

- Open and excerpt rooms now have the same participant affordance.
- Guests remain honest about missing prose while retaining room history and
  writer-selected standing context.
- No persistence schema or provider-conversation migration is required.
- Existing saved sessions remain readable; the next guest invitation simply
  uses the session's persisted scope.
- Focused tests must cover open-room guest join/continuation, subject framing,
  manifest seeding, and lifecycle-only catch-up status classification.

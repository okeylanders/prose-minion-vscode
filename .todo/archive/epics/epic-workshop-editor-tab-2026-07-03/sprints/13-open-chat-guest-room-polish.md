# Sprint 13 Delivery Plan: Open Chat, Guest Agency, and Room Polish

**Status**: Sprints 13A–13D merged; 13D_2 implementation complete with manual smoke pending
**Priority**: High — release-polish work that makes Workshop useful before a
writer has an excerpt and makes the participant room behave as it looks
**Implementation branches**: one branch and PR per child sprint, all into
`epic/workshop-editor-tab`
**Depends on**: Sprint 10 persistence merged and its manual Extension
Development Host continuity pass complete
**Extends**: [2026-07-09 — Workshop Persona Host, Tool Sidecars, and
Capabilities](../../../../../docs/adr/2026-07-09-workshop-persona-hosted-conversations.md),
[2026-07-11 — Workshop Guest Persona Sidecars](../../../../../docs/adr/2026-07-11-workshop-guest-persona-sidecars.md), and
[2026-07-14 — Workshop Session Persistence and the Session Browser](../../../../../docs/adr/2026-07-14-workshop-session-persistence.md), and
[2026-07-24 — The Workshop Room Ledger and Delivery Offsets](../../../../../docs/adr/2026-07-24-workshop-room-ledger-and-delivery-offsets.md)
**Related**: [Guest-to-Guest Room Catch-Up](../../../features/feature-workshop-guest-room-catchup/README.md),
[Guest Persona Sidecars](../../../features/feature-workshop-persona-guest-sidecars/README.md),
[Workshop Participant Rail Review Follow-ups](../../../../tech-debt/2026-07-17-workshop-participant-rail-review-follow-ups.md)

## Purpose

Make Workshop approachable as an open creative conversation, then make its
guest-room promise honest and useful: a writer can begin chatting without an
excerpt, invite a second persona through an intentional read-in flow, let a
guest use the same bounded evidence capabilities as the host, and move between
guests without treating the host as a secret routing clerk. A host persona can
also run an analysis tool against material it supplies itself, deciding what
travels into that run — while the writer's only affordance stays a prefilled
ask.

This is not a free-form agent graph. The host remains immutable, tools remain
bounded instruments, and the writer remains the only participant who launches
people or commits widgets.

## Delivery shape

The original Sprint 13 scope crossed four independently reviewable contracts:
optional-excerpt sessions, analysis-request scoping, guest agency/capabilities,
and room-history delivery. Keeping them in one MR would make both testing and
rollback needlessly opaque. Deliver them in order:

| Sprint | Branch | Scope | Depends on | Reviewable proof |
|---|---|---|---|---|
| [13A](13a-open-chat.md) | `sprint/workshop-editor-tab-13a-open-chat` | Honest open conversation, later excerpt adoption, persistence metadata, and the empty-state/composer design. | Sprint 10 baseline | A writer can retain a Jill conversation with no excerpt, then add one without restarting. |
| [13B](13b-run-local-analysis.md) | `sprint/workshop-editor-tab-13b-run-local-analysis` | Persona-chosen analysis inputs: per-input excerpt/context modes, prefilled asks, no writer picker. | 13A | In a non-excerpt session the host can run Stock & Signature on a passage it supplies, with the room unchanged. |
| [13C](13c-guest-agency.md) | `sprint/workshop-editor-tab-13c-guest-agency` | Deliberate guest read-in plus participant-owned bounded capabilities. | 13A | Selecting a guest spends nothing; one explicit submit creates one guest that can use attributable, private instruments. |
| [13D](13d-room-catchup-release-polish.md) | `sprint/workshop-editor-tab-13d-room-catchup-release-polish` | One room ledger with per-participant delivery offsets, a single delivery site, atomic turns, and final release validation. | 13C | Guest B receives Guest A's eligible unseen exchange without a hidden host call, a skipped turn, or a split quote. |
| [13D_2](13d_2-open-room-participants.md) | `sprint/workshop-editor-tab-13d_2-open-room-participants` | Open-room persona guests, lifecycle-only catch-up status, and participant-owned context copy. | 13D | An excerpt-free room can invite and continue with a truthful guest without mislabeling its session marker as conversational catch-up. |

13B and 13C may proceed after 13A, but 13D starts only after the guest
ownership contract in 13C lands. If capability ownership proves materially
larger than expected, split 13C into a UI-only read-in MR and a follow-up
capability MR; do not hide that boundary inside the modal change.

### Design load

Pixel-fidelity work is deliberately **concentrated in 13A and 13C** rather than
spread evenly, so each sprint can be scheduled against an implementer suited to
it. The participants/instruments rail divider was moved from 13D to 13C for
this reason.

| Sprint | Design load | Authoritative comp |
|---|---|---|
| 13A | **High** — path chooser, scope strips, Edit/Preview sheet, editor tab strip, gating badges, exact copy | [Assistant Tab](../../../../../docs/design/Prose%20Minion%20-%20Assistant%20Tab.html) |
| 13B | **Low** — divider variants and the run provenance block; the composer tool picker already exists | [Assistant Tab](../../../../../docs/design/Prose%20Minion%20-%20Assistant%20Tab.html) (composer picker) |
| 13C | **High** — Invite Guest and Choose Host sheets, plus the rail divider | [Invite Guest](../../../../../docs/design/Prose%20Minion%20-%20Invite%20Guest.html), [Choose Host](../../../../../docs/design/Prose%20Minion%20-%20Choose%20Host.html) |
| 13D | **None** — aggregate, prompt-builder, and persistence only | n/a |

Design sources live in `docs/design/` and are synced from the Claude Design
project. Sprints link the comp; they never re-sync or fork it.

## Locked product decisions

### Open Chat is a real scope, not an empty excerpt

- The empty Workshop state offers **Start a conversation** alongside excerpt
  intake. Selecting a host and sending starts an `open-conversation` session.
- The first persona prompt says plainly that no excerpt is available and that
  the conversation is for planning, ideation, craft discussion, or getting to
  know the Workshop. The persona must not pretend to have read a passage.
- A blank `WorkshopExcerpt` is forbidden. Excerpt provenance, revision,
  versioning, tool eligibility, and source-aware file access retain their
  existing meaning.
- Excerpt-dependent tools and excerpt-scoped capability operations stay
  unavailable in open chat. A writer may add an excerpt later; that is a
  visible, retained-conversation context transition, not a new session.
- The first slice permits the chosen host in open chat. Guest invitation was
  initially deferred; [Sprint 13D_2](13d_2-open-room-participants.md) supplies
  the no-excerpt honesty envelope and opens the room to persona guests.

### The persona chooses a tool run's inputs; the writer just asks

`analysis.run` currently receives the session's pinned excerpt and context
attachments unconditionally; the persona can supply only a tool id and focus
instructions. That is too coarse for useful local work such as asking **Stock
& Signature** to examine one paragraph.

The analysis tools were built to run in isolation — excerpt plus context in,
report out. That engine does not change. Sprint 13 widens what may be placed in
those two input slots, and lets the **host persona** decide. There is no new
writer-facing UI: no subject picker, no policy control, no free-text field.

- Two independent inputs, each with a closed mode:
  `excerpt: inherit | prepend(text) | replace(text) | omit` and
  `context: inherit | prepend(text) | replace(text) | omit`.
  `prepend` is how a persona places framing or instructions above existing
  material; `omit`/`omit` is a legal vacuum run. There is no separate "Subject"
  concept — the excerpt slot in `replace` mode *is* the local passage.
- The host validates every mode, size, and source identity before the tool
  executes. `prepend` against absent material, and `prepend`/`replace` with
  empty text, are rejected with a visible reason.
- **Excerpt-mode behavior is unchanged.** Rail and composer both run directly
  against the pinned excerpt. In a non-excerpt session the rail stays gated and
  the composer picker instead **prefills a persona-addressed ask** — one door
  says "run this yourself against the passage," the other says "ask your host to
  run this," and both say why.
- The grammar lives in the **system prompt, stated mode-neutrally**, so a
  mid-session scope flip needs no system-prompt swap. A small reserved-tag
  per-turn frame reports current state (excerpt pinned or not, attachment
  count). That frame is host-composed and rides *beside* the writer's turn —
  never inside the editable prefill, which is writer prose.
- The transcript divider names the door, and the run's request/report state each
  input's mode, the material used, who chose it, and any truncation.
- This does not create arbitrary filesystem access. A configured-resource read
  remains a separate, bounded, attributable operation; `replace` removes
  host-delivered room material, not the project-resource safety gate.
- A tool may be *asked* for Creative Variations and return them in its report
  body; the writer copies manually. Widgets, and any apply-to-draft action,
  belong to the later Conversation Widgets epic.

### Guest read-in is select, then send

The current guest browser immediately sends the opening message when a persona
card is clicked. That conflates choosing a lens with starting a billable,
retained conversation, and the opening field is easy to overlook above a long
persona grid.

The Sprint 13 interaction is deliberately two-step:

1. Clicking an eligible persona card selects it immediately and shows a
   persistent check mark. It makes **no provider call** and does not close the
   modal.
2. A sticky footer keeps the selected persona, opening message, character
   count, and primary action in view. The action reads **Read in <Persona>**.
3. Only that button validates and sends `WORKSHOP_INVITE_GUEST`; successful
   submission closes the modal. The existing join snapshot and guest-opening
   envelope remain unchanged.

The sticky header keeps the Workshop Guest title, concise room explanation,
and close control visible while the grid scrolls. The sticky footer is the
commit zone, not an incidental field above the choices.

- The opening field uses a persona-addressed placeholder/default such as
  `Felix, read the room and help me with the rhythm here.` when the writer has
  not edited it. Changing selection updates only untouched generated copy;
  writer-edited text is never overwritten.
- The primary action is disabled until an eligible persona is selected and the
  opening is valid. The host, already-live guests, and capacity-excluded cards
  state why they cannot be selected.
- Card selection is exposed as a single-select radio/listbox pattern with a
  visible check mark and an accessible selected state. **More info** remains a
  separate control and never changes the selection.
- Selection state is modal-local and is discarded on cancel. No half-invitation
  is persisted.

This is a design-ready behavior brief for Claude Design. The implementation
must preserve the modal shell, keyboard/focus return contract, reduced-motion
behavior, and existing live-run lock.

### Guests receive bounded capabilities, not ambient power

- Extend the capability factory with an explicit participant owner:
  `host` or `personaGuest(personaId)`, plus the retained conversation id,
  excerpt/version, cancellation signal, and per-turn budget.
- Guests may request the existing closed capability families: dictionary,
  configured-resource search/read, and excerpt analysis. Every request keeps
  host-side validation, capability-specific bounds, cancellation propagation,
  token accounting, and an inspectable artifact.
- A capability result belongs to its invoking participant's retained
  conversation. It renders as an attributed inline artifact for that guest but
  is not silently injected into the host or another guest. A guest may explain
  it; the writer may explicitly carry it forward.
- A nested analysis result is a guest-owned instrument, not a new room
  participant and not a guest-created persona. No recursion.
- Conversation Widgets remain writer-owned: guests may recommend or prefill a
  widget, but only the writer opens and commits it.

### Room catch-up is a shared ledger, not host relay

Design work during planning replaced the original per-relationship cursor
scheme. The governing contract is now
[ADR 2026-07-24 — The Workshop Room Ledger and Delivery Offsets](../../../../../docs/adr/2026-07-24-workshop-room-ledger-and-delivery-offsets.md);
the summary below is subordinate to it.

- `WorkshopSessionService.turns` stays the canonical ordered room ledger, and
  each participant's provider array is a derived view of it. Target selection
  remains immediate and local; it never creates a hidden host response or
  spends tokens.
- **One computed predicate** decides visibility for every frame:
  `audience(turn) → 'room' | 'private(principal)'`. Host and guests read
  identically — there is no host-privileged class. A principal is any
  conversation owner: host, guest, tool sidecar, or a future tangent thread.
- **One inbound offset per participant** (`lastSeenRoomTurnId`), replacing
  `lastSeenHostTurnId` and both `deliveredToHostThroughTurnId` families. "What
  has the host seen of this guest" is the host's own reading position, not a
  property of the guest.
- **Exactly one delivery site.** `RunWorkshopToolSidePass` currently commits
  its own handoff outside the room's accounting; it is routed through the
  shared site. An architecture guard enforces the single site.
- Delivery is a **contiguous oldest-first prefix of the reader's eligible
  projection**. Acknowledgement follows only the recipient's committed reply;
  failed or cancelled requests retry the same evidence.
- **A turn is atomic.** No frame ships part of a turn — head-truncating quoted
  speech is a misquote, not a bound. Catch-up delivery is unbounded for this
  sprint; bounding belongs to the context-compaction work.
- Direct-tool sidecar conversation becomes private to its sidecar. Tool
  *reports* remain room history. The direct-tool handoff path is deleted, not
  re-bounded.
- Extract the common turn packer before the semantic change, so the refactor
  and the contract change are reviewable separately.

## Original phase-to-sprint mapping

| Phase | Scope | Proof / exit condition |
|---|---|---|
| 0 | Cross-sprint baseline: ADR addendum and Sprint 10 manual continuity / participant-rail reconnect evidence. | Accepted addendum and recorded baseline before implementation begins. |
| 1 | 13A — Open Chat session scope. | Optional excerpt remains honest; adoption does not restart the retained conversation. |
| 1B | 13B — Persona-chosen analysis inputs. | Per-input modes affect only one bounded run; excerpt mode is untouched. |
| 2–3 | 13C — Guest read-in UX and participant-owned capabilities. | Selection is not submission; guest evidence stays attributable and private. |
| 4–5 | 13D — Room ledger, delivery offsets, and release polish. | Delivery is contiguous, atomic, and single-sited; restored-session and accessibility evidence is recorded. |

## Implementation surfaces

- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
- `packages/core/src/application/services/workshop/WorkshopPromptBuilder.ts`
- `packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts`
- `packages/core/src/application/services/workshop/WorkshopAnalysisSidePass.ts`
- `packages/core/src/application/services/workshop/RunWorkshopToolSidePass.ts`
- `packages/core/src/application/services/workshop/WorkshopSessionStateV1Shape.ts`
- `packages/core/src/application/services/workshop/WorkshopSessionStateV1Integrity.ts`
- `packages/core/src/shared/types/workshopCapabilities.ts`
- `packages/core/src/application/handlers/domain/WorkshopHandler.ts`
- `packages/core/src/presentation/webview/WorkshopApp.tsx`
- `packages/core/src/presentation/webview/components/workshop/WorkshopPersonaBrowserModal.tsx`
- `packages/core/src/presentation/webview/components/workshop/WorkshopParticipantRail.tsx`
- `packages/core/src/presentation/webview/hooks/domain/useWorkshop.ts`
- Workshop aggregate, prompt-builder, handler, capability, modal, hook, and
  persistence tests

## Explicit non-goals

- No host swapping or guest-created participants.
- No live relay of every room turn into every retained conversation.
- No raw path or arbitrary filesystem access for guests.
- No persona auto-commit of a Conversation Widget.
- No special-case Creative Variations implementation in this sprint; it belongs
  on the Conversation Widgets spine documented below.

## Completion criteria

- [ ] Every Phase exit condition is covered by focused tests; typecheck, full
      test suite, lint, production build/bundle, and `git diff --check` pass.
- [ ] Manual Extension Development Host evidence covers open chat, later
      excerpt adoption, scoped analysis with inherited and replaced free-text
      context, guest invite selection/submit, guest capability cards, A -> B
      catch-up, cancellation/retry, and restored sessions.
- [ ] The ADR addendum, this sprint, the guest catch-up feature, and the
      Conversation Widgets epic agree on participant, tool, and widget
      permissions.

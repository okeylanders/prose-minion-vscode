# Sprint 13: Open Chat, Guest Agency, and Room Polish

**Status**: Planned
**Priority**: High — release-polish work that makes Workshop useful before a
writer has an excerpt and makes the participant room behave as it looks
**Branch**: `sprint/workshop-editor-tab-13-open-chat-guest-room-polish` -> PR
into `epic/workshop-editor-tab`
**Estimated Effort**: 6-9 days
**Depends on**: Sprint 10 persistence merged and its manual Extension
Development Host continuity pass complete
**Extends**: [2026-07-09 — Workshop Persona Host, Tool Sidecars, and
Capabilities](../../../../docs/adr/2026-07-09-workshop-persona-hosted-conversations.md),
[2026-07-11 — Workshop Guest Persona Sidecars](../../../../docs/adr/2026-07-11-workshop-guest-persona-sidecars.md), and
[2026-07-14 — Workshop Session Persistence and the Session Browser](../../../../docs/adr/2026-07-14-workshop-session-persistence.md)
**Related**: [Guest-to-Guest Room Catch-Up](../../../features/feature-workshop-guest-room-catchup/README.md),
[Guest Persona Sidecars](../../../features/feature-workshop-persona-guest-sidecars/README.md),
[Workshop Participant Rail Review Follow-ups](../../../tech-debt/2026-07-17-workshop-participant-rail-review-follow-ups.md)

## Goal

Make Workshop approachable as an open creative conversation, then make its
guest-room promise honest and useful: a writer can begin chatting without an
excerpt, invite a second persona through an intentional read-in flow, let a
guest use the same bounded evidence capabilities as the host, and move between
guests without treating the host as a secret routing clerk. A persona or writer
can also run an analysis tool against a bounded local passage and deliberately
choose whether the room's context travels with that run.

This is not a free-form agent graph. The host remains immutable, tools remain
bounded instruments, and the writer remains the only participant who launches
people or commits widgets.

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
- The first slice permits the chosen host in open chat. Guest invitation in an
  excerpt-free room is deferred unless the guest join prompt can make the same
  no-excerpt honesty guarantee without widening this sprint.

### Analysis runs may use a local subject and explicit context policy

`analysis.run` currently receives the session's pinned excerpt and context
attachments unconditionally; the persona can supply only a tool id and focus
instructions. That is too coarse for useful local work such as asking **Stock
& Signature** to examine one paragraph and generate Creative Variations.

Sprint 13 introduces a **run-local analysis scope**. It affects exactly one
tool run and never changes the Workshop's pinned excerpt, context-attachment
list, source provenance, retained persona history, or later tool runs.

- **Subject** is the material the selected analysis tool examines: the pinned
  excerpt, a verified editor/excerpt selection, or bounded pasted text. The
  requested analysis focus remains a separate bounded instruction field.
- **Context policy** is explicit:
  - `inherit-room`: deliver the normal bounded room context — the pinned
    excerpt as surrounding reference when the subject is a subset, plus current
    context attachments — and optionally append bounded free text.
  - `replace-room`: suppress the normal pinned/context-attachment material for
    this run and deliver bounded writer/persona-provided free text instead.
    Free text is required for this policy so an accidental toggle cannot create
    an unintentionally contextless run.
- The run's visible request and report state **Subject**, **Context policy**,
  inherited/overridden material, and truncation. The persona may request the
  same closed shape, but the host validates every size, source identity, and
  policy value before the tool sees it.
- This does not create arbitrary filesystem access. A configured-resource
  read remains a separate, bounded, attributable operation; `replace-room`
  removes host-delivered room context, not the project-resource safety gate.
- The initial proving case is a selected paragraph + `stock-and-signature` +
  `replace-room` free-text character/scene context + a Creative Variations
  request. The tool may produce variations, but the user still owns copying,
  widget selection, or any later apply-to-draft action.

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

- `WorkshopSessionService.turns` stays the canonical ordered room ledger.
  Target selection remains immediate and local; it never creates a hidden host
  response or spends tokens.
- On a writer message to Guest B, build a bounded, speaker-labeled room frame
  from host and other-guest exchanges since B's room-delivery position. Exclude
  B's retained conversation, direct-tool traffic, and private capability
  artifacts.
- Preserve the host's independent guest-handoff policy. A guest seeing another
  guest does not consume evidence before the host sees it.
- Delivery acknowledgement occurs only after the recipient's reply commits.
  Failed/cancelled requests retry the same eligible evidence.
- Use **contiguous delivery** for this sprint: pack the oldest pending eligible
  turns first and advance one room cursor only through the delivered prefix.
  This keeps a scalar cursor truthful under a character bound. Do not pair a
  newest-first packer with a scalar cursor while claiming omitted turns remain
  pending; that loses holes in the history. If a later release prefers freshest
  context, it must explicitly accept dropped omissions or add delivered-range
  tracking.
- Extract the common bounded-turn packer before adding the new room frame, so
  direct handoff, host-to-guest catch-up, guest-to-host handoff, and room
  catch-up share window, truncation, attribution, and delivery-order rules.

## Phases

| Phase | Scope | Proof / exit condition |
|---|---|---|
| 0 | ADR addendum and release baseline: settle open-chat prompt honesty, run-local analysis scope/context policy, guest capability ownership, room visibility, contiguous delivery, and the invite modal contract; complete Sprint 10 manual continuity and participant-rail reconnect checks first. | Accepted addendum; manual baseline recorded; no silent change to the existing guest contract. |
| 1 | Open Chat session scope: optional excerpt only where honest; prompt/envelope changes; later excerpt adoption as a visible transition; disabled unavailable tools/capabilities; persistence and browser metadata. | A writer can have a retained Jill conversation with no excerpt, then add one without restart; personas never claim unseen text. |
| 1B | Run-local analysis scope: closed subject and context-policy contracts; selected/pasted bounded subject; inherited-room or replace-room free text; prompt framing, visible provenance, and direct/persona-requested analysis coverage. | Stock & Signature can inspect one paragraph with Creative Variations instructions and replacement free-text scene context, while the room's pinned excerpt and attachments remain unchanged. |
| 2 | Guest read-in UX: modal-local selected persona, check-marked cards, sticky header/footer, persona-aware untouched default, explicit **Read in <Persona>** submit, keyboard/focus/reduced-motion coverage. Claude Design supplies the visual comp; this phase implements its accepted behavior. | Card selection makes no provider call; exactly one valid footer submit creates one guest conversation. |
| 3 | Participant-owned capabilities: generalize factory/context/artifact ownership; enable guest dictionary, configured-resource, and analysis requests; preserve per-turn budgets and private instrument visibility. | A guest can inspect bounded project evidence and discuss it; host/other guests receive none unless the writer or guest explicitly carries it forward. |
| 4 | Room catch-up: common bounded-turn packer; room cursor and framed host/other-guest delta; retries, overflow, dismissal, excerpt revision, host-handoff independence, and restore coverage. | A -> B includes A's unseen exchange without a host call; cancellation is idempotent; an overflow cannot silently skip pending turns. |
| 5 | Release polish: full Workshop persistence/reopen exercise, reconnect/stale-cancel convergence, accessibility pass, bundle delta, and focused/full validation. | Extension Development Host behavior matches the documented contracts; release evidence is recorded. |

## Implementation surfaces

- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
- `packages/core/src/application/services/workshop/WorkshopPromptBuilder.ts`
- `packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts`
- `packages/core/src/application/services/workshop/WorkshopAnalysisSidePass.ts`
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

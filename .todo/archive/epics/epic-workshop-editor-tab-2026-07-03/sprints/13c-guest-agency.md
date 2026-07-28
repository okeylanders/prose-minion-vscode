# Sprint 13C: Guest Agency

**Status**: Implemented (2026-07-26) — manual EDH pass outstanding  
**Priority**: High  
**Branch**: `sprint/workshop-editor-tab-13c-guest-agency` -> PR into `epic/workshop-editor-tab`  
**Depends on**: Sprint 13A  
**Parent**: [Sprint 13 delivery plan](13-open-chat-guest-room-polish.md),
approved designs [Prose Minion - Invite Guest](../../../../../docs/design/Prose%20Minion%20-%20Invite%20Guest.html) and [Prose Minion - Choose Host](../../../../../docs/design/Prose%20Minion%20-%20Choose%20Host.html) (synced 2026-07-24)\
**Design load**: **High** — two full sheets with docked footer, nudge-chip
states, check / in-room / locked card states, the sticky shell, plus the rail
divider moved here from 13D. Build against the comps; the only deliberate
departures from the mock are recorded below.

## Goal

Make inviting a guest deliberate, then give that guest the same bounded
evidence instruments as the host without granting ambient room power.

## Scope

### Select, then send

- Card selection is modal-local, check-marked, accessible, and makes **no
  provider call**. Selection is discarded on cancel; no half-invitation is
  persisted.
- Sticky header keeps the title, room explanation, and close control in view
  while the grid scrolls. Sticky footer is the commit zone: selected persona,
  opening message, character count, and the primary action.
- The primary action reads **Read in &lt;Persona&gt;** and is disabled until an
  eligible persona is selected and the opening is valid.
- **One invite at a time.** A successful submit closes the modal. (The design
  mock resets in place for serial invites; that is mock convenience, not the
  contract.)
- Host, already-live guests, and capacity-excluded cards state why they cannot
  be selected. **More info** is a separate control and never changes selection.
- Preserve the current modal shell, focus-return, keyboard, reduced-motion, and
  live-run-lock contracts.

### Opening message

- The untouched default is persona-addressed and warm:
  `Hey Felix! read the room and help me with the rhythm here.`
- Changing selection rewrites only untouched generated copy. Writer-edited text
  is never overwritten.
- The default must not prescribe a pinned-excerpt task. Guest invitation is
  currently excerpt-gated, but the room transcript and the writer's opening
  determine why the guest was invited; neutral generated copy must not presume
  that the writer wants direct passage feedback.

### Two nudges against the skipped field (from design)

- An amber **Default message** chip flags un-personalized boilerplate; clicking
  it selects all so the writer can overtype. It flips to a green
  **Personalized** state once edited.
- Launching an untouched default arms one light confirm: an inline hint reading
  "You're sending the default opening — press **Read in** again to invite, or
  edit it above." A second press sends. Any edit disarms it.
- Both are accessibility-relevant: the confirm state must be announced, not
  signalled by colour alone.

### Choose Host modal

Matches the Invite Guest sheet — same split shell, same card vocabulary,
single-select, current host pre-selected and tagged `Current`. No opening
message: the host is not handed a prompt, so the footer carries only the note
and a **Choose &lt;Name&gt;** / **Keep &lt;Name&gt;** action. The header points at
**More info**. `Esc` reverts to the current host.

### Participants/instruments rail divider

Moved here from 13D so all pixel-fidelity work in Sprint 13 lands in 13A and
13C. Specified in
[ADR 2026-07-24 §9](../../../../../docs/adr/2026-07-24-workshop-room-ledger-and-delivery-offsets.md):

- The rail separates participants from instruments with a real
  `role="separator"` and labeled groups — not a decorative glyph.
- UI copy may truthfully call a sidecar private, and must not imply that its
  *reports* are: running a tool in the room publishes its report to the room.

### Participant-owned capabilities

- Generalize the capability factory with a participant owner (`host` or
  `personaGuest(personaId)`), retained conversation id, excerpt/version,
  cancellation signal, and per-turn budget.
- Permit guests to request only existing closed capability families:
  dictionary, configured-resource search/read, and excerpt analysis.
- **Persist the invoking principal on the capability turn.** Artifacts are
  currently appended as `participant: 'tool'` with no `personaId`, which is only
  safe while the host is the sole invoker. See
  [ADR 2026-07-24 §2](../../../../../docs/adr/2026-07-24-workshop-room-ledger-and-delivery-offsets.md).
- Keep result artifacts attributable to the invoking guest conversation and
  private from host/other guests unless a writer explicitly carries them
  forward. Conversation Widgets remain writer-owned.

## Explicit non-goals

- No guest invitation in open chat.
- No serial invite flow — one guest per modal session.
- No guest-created personas, host swapping, arbitrary filesystem access, or
  guest auto-commit of widgets.

## Deliberate departures from the mock (recorded per the design-load note)

- **`Esc` closes the sheet** (shell keyboard contract), which discards the
  guest selection / reverts to the current host because selection is
  modal-local. The mock's `Esc`-clears-selection-in-place is not reproduced.
- **Plain `Enter` does not commit in Choose Host** — focus sits on card
  buttons where `Enter` means *select*. `⌘/Ctrl+Enter` commits in both sheets,
  as in the mock.
- **No serial invite reset** — a successful submit closes the modal (already
  called out in Scope as mock convenience).
- **Close control** stays the shell-managed button (focus capture/return),
  absolutely positioned top-right to match the comp's `cw-x`.
- **Capacity-excluded cards** state why with a `Room full` tag + reason; the
  mock never showed a full room.

## Implementation notes (2026-07-26)

- New `WorkshopInviteGuestModal` / `WorkshopChooseHostModal` over a shared
  `WorkshopPersonaSheetGrid` and a `WorkshopModalShell` `variant="sheet"`;
  `WorkshopPersonaBrowserModal` removed.
- Untouched defaults are generated per persona via
  `defaultWorkshopGuestOpening()` (`guestOpeningFocus` on the catalog); the
  old excerpt-referencing `DEFAULT_WORKSHOP_GUEST_OPENING` is gone.
- Capability turns now carry `owner` + retained `conversationId`;
  `WorkshopCapabilityArtifactDetails.invokedBy` persists the principal, the
  session guard matches principal↔active run, `isHostThreadTurn` excludes
  guest-invoked artifacts, and hydration migration
  `defaulted-capability-principal` stamps `host` on pre-13C checkpoints.
- Guests get the capability on join (`startWorkshopGuestConversation` now
  accepts one; workshop-host run policy) and on every continue turn.
- Also landed with 13C (writer request + approved workshop comp `.wk-crow`):
  the composer stacked — full-width textarea with the mode/Tools/send
  controls row docked beneath it.

## Exit criteria

- Card selection creates no provider call or persisted half-invitation; exactly
  one valid footer submit creates exactly one guest conversation and closes the
  modal.
- The untouched default names the selected persona and never references an
  excerpt; re-selecting rewrites it, editing pins it.
- The default-message chip and the soft confirm behave as specified and are
  announced to assistive technology.
- A guest can invoke each allowed bounded capability with cancellation, token
  accounting, host validation, and an inspectable attributed artifact whose
  invoking principal is persisted.
- Host and other guests do not silently receive a guest's direct-tool traffic
  or private artifacts.
- Modal, accessibility, capability ownership, privacy, and persistence tests
  pass with normal repository validation.

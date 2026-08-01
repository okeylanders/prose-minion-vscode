# Sprint 02B-A: Agent-Prepared Widgets and Lexical Gravity Polish

**Status**: In progress
**Priority**: High
**Branch**: `sprint/conversation-widgets-02b-a-assists-and-polish` -> PR into `epic/conversation-widgets`
**Estimated Effort**: 1-2 days
**Depends on**: Sprint 02B / PR #98 merged into `epic/conversation-widgets`
**Blocks**: Nothing; land before the optional Sprint 02C decision
**Design**: [Widget browser](../../../../docs/design/Prose%20Minion%20-%20Conversation%20Widgets.html) and [Lexical Gravity](../../../../docs/design/Prose%20Minion%20-%20Lexical%20Gravity.html)

## Goal

Close the small product gaps exposed while testing the first standing widget:
let the writer ask the active Host to prepare a selected live widget, make
proactive tool/widget assistance an explicit writer-controlled behavior, and
bring the runtime Lexical Gravity/browser surfaces into line with the refined
design.

This is a bounded follow-up, not a second standing-rail architecture sprint.
The writer still owns every send, widget open, and commit.

## Locked Contracts

- **Ask is an editable handoff, not an autonomous action.** Selecting “Ask
  agent to configure, then open” targets the current Host conversation, seeds a
  widget-specific request into the composer, and closes the browser. The writer
  reviews and sends it. A persona may answer with the existing validated widget
  recommendation; its chip is the explicit door into the seeded pre-commit UI.
- **Personas prepare; writers open and commit.** No setting or prompt grants a
  persona authority to launch UI, install a standing directive, commit a
  one-shot artifact, or stack several unsolicited assists.
- **Proactive assistance is default-on and room-wide.** Add one binary field to the
  complete `WorkshopConversationBehavior` object. When enabled, persona turns
  actively consider at most one materially useful deterministic tool or live
  widget recommendation. When disabled, current discretionary behavior is
  preserved. Deterministic tools and direct tool sidecars do not receive the
  behavior frame.
- **The new behavior is last-mile guidance.** It rides the trusted interaction
  and activation frames adjacent to the writer turn. Toggling it does not
  rebuild persona identity resources or invent a second persistence clock.
- **Lifecycle language replaces payment language.** Widget copy describes when
  state enters the room and how long it remains; “cost,” “free,” and “pays” are
  reserved for actual model/provider cost disclosures.
- **02C stays pure.** Scope/context IPC extraction is not mixed into this UX and
  prompt-behavior PR.

## Scope / Deliverables

1. Sync the live widget browser to the refreshed design: Ready Now group,
   neutral lifecycle summary, `Open widget`, and a secondary Host-configuration
   action for selected live widgets.
2. Add a deterministic widget-request prefill builder and wire the browser
   action through `WorkshopApp` to the active Host composer target.
3. Add the default-on Use Tools & Widgets switch to Conversation Settings,
   settings/session validation, prompt frames, logs, and persisted defaults.
4. Polish Lexical Gravity:
   - Build New Lens before the existing lens library;
   - an `OR` divider and accent “Select From Existing” heading;
   - full-name hover titles on truncated lens cards;
   - generated preview above `Preview the Effect`, with the disclosure below;
   - the Weight control immediately between the preview and its action;
   - a generated-by-default Before passage that becomes quietly editable in
     place, auto-grows to a bounded height, and remains the preview source while
     the writer tunes controls;
   - three stable lens-card skeletons while Build Lens drafts its candidates;
   - an After skeleton that holds the comparison row while a preview is
     generating and yields to prose or disappears on failure;
   - normalized whole-response quotes and a block-level, sanitized Markdown
     After passage;
   - edit action label `Apply`; and
   - neutral edit/lifecycle language.
5. Keep plain-prose previews genuinely unstructured: ask for only the rewritten
   passage, bind the returned text to the active config locally, and validate
   only that it is non-empty, complete, and bounded. Give reasoning models a
   low-effort budget so the small output allowance still leaves room for final
   prose. Keep generated-lens JSON on its strict exactly-once parser, normalize
   provider-null content at the API boundary, log rejected preview bodies for
   diagnosis, and return a human error instead of exposing protocol jargon.
6. Keep the synced design artifacts, active epic copy, and runtime labels in
   agreement.

## Technical-Debt Boundary

Do the small cleanup earned directly by this work: use neutral lifecycle naming
in the shared browser/catalog contract so future widgets do not inherit the
payment metaphor. Do **not** take the Workshop god-file extraction here.

PR #98 finding F-19 (the monolithic, unconditional widget-recommendation
instruction) remains [tracked follow-up debt](../../../tech-debt/2026-07-31-workshop-widget-recommendation-prompt-assembly.md).
This sprint adds a writer-controlled initiative instruction but does not solve
F-19 by hiding widget grammar behind the toggle: explicit widget requests must
still work when proactive assistance is off. The durable fix is registry-driven
per-live-widget prompt fragments and widget-specific output ceilings, not a
conditional string splice.

## Completion Criteria

- A live widget selected in the browser can seed an editable request to the
  current Host, and no message/widget state changes until the writer acts.
- Use Tools & Widgets round-trips through settings and session persistence,
  defaults on, and changes persona guidance only when enabled.
- Lens cards expose their complete display name; the revised ordering and copy
  match the synced design.
- Preview prose is generated without writer input, but the Before passage can
  be edited in place and survives weight/lens tuning until the next preview.
- Widget models return only rewritten prose for previews; local code owns the
  config association, while empty, truncated, or oversized responses fail with
  a bounded human-facing error.
- No user-facing widget lifecycle copy implies a provider charge where none is
  being described.
- Focused component, prompt, persistence, and architecture tests pass, followed
  by the full project verification suite.

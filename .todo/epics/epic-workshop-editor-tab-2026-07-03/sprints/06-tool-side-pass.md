# Sprint 06: Retained Tool Sidecars and Direct Mode

**Status**: Planned
**Priority**: High
**Branch**: `sprint/workshop-editor-tab-06-tool-side-pass` -> PR into `epic/workshop-editor-tab`
**Estimated Effort**: 4-6 days
**Depends on**: Sprint 05
**ADR**: [2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](../../../../docs/adr/2026-07-09-workshop-persona-hosted-conversations.md)

## Goal

Make every Workshop tool run an isolated retained sidecar while the selected
persona remains the permanent host. Render the tool's report verbatim, give it
to the persona as structured evidence, and let the writer temporarily talk
directly to that tool without destroying or paying to relay through the host.

After this sprint, “tool-first” is no longer a separate conversation origin.
Jill (or the selected specialist) is always the host; starting with a tool
lazily starts the host after the tool report is available.

## Current Reality After Sprint 05

- The session has a selected persona host, participant registry, latest sidecar
  slots, and explicit direct target.
- Persona messages start/continue without a prior tool run.
- Tool runs during a live persona conversation are temporarily blocked because
  adopting the tool's conversation would replace the host.
- The legacy tool-first path already adopts a retained sidecar and can be
  followed directly or exited with “Back to Jill,” but it does not yet inject a
  verbatim report into the host or synthesize a persona response.
- Quick actions, variation cards, Copy, Save to notes, status, and token rails
  already exist and must keep correct provenance.

## Locked Decisions

- Agent identity is immutable: persona and tool system prompts never share a
  conversation.
- The host remains selected during every tool run. A deterministic status event
  says the host is having the tool run; do not pay for a model acknowledgement.
- Keep the latest retained sidecar per `WorkshopToolId`. A new run of the same
  tool atomically replaces/disposes the old sidecar while old visible reports
  remain historical artifacts.
- A report is rendered verbatim as a distinct tool artifact before persona
  synthesis. The persona may summarize or challenge it but cannot replace it.
- The originating request + exact report are injected into the host as bounded
  structured evidence; persona synthesis is a separate attributed turn.
- “Talk directly to <tool>” sets an explicit host-side `directToolTarget` and
  routes the one existing `WORKSHOP_SEND_MESSAGE` action to that sidecar.
- Direct mode is visibly announced in the composer and has a deterministic
  “Back to <persona>” control. “Hey Jill” may be a shortcut, never the only exit
  or the source of routing truth.
- Persona relay is not invoked for every direct-tool message. When returning to
  the host, the next host turn receives only the bounded tool exchanges not yet
  delivered to it.
- Bound that handoff to the newest 8 unseen direct-tool turns and 20,000
  characters, whichever limit is reached first. Include omitted-turn count and
  deterministic truncation provenance; advance the delivery cursor only after
  a successful host turn adopts the handoff.
- Persona-generated/autonomous tool requests are Sprint 07. Sprint 06 proves
  deterministic user-triggered sidecars first.

## Tasks

### Session model and contracts

- [ ] Harden the Sprint 05 sidecar map/direct target for universal persona-
      integrated tool runs rather than the legacy pre-host-only bridge.
- [ ] Keep conversation ids private. Snapshot sidecars expose tool id, latest
      report turn id, availability for direct follow-up, and active-target state.
- [ ] Reuse/harden `WORKSHOP_SET_CHAT_TARGET`; do not add enter/exit variants or
      a second free-text send message.
- [ ] Extend `WorkshopTurn` with explicit participant/artifact metadata so the
      thread distinguishes host user/assistant turns, verbatim tool reports,
      persona synthesis, and direct-tool exchanges.
- [ ] Add session operations for atomic sidecar adoption/replacement, report
      correlation, delivery cursor updates, target selection, target fallback,
      and bulk disposal on reset/excerpt replacement/resource loss.

### Tool side-pass orchestration

- [ ] Extract a focused application use case if necessary (for example,
      `RunWorkshopToolSidePass`) rather than growing a multi-agent workflow
      script inside `WorkshopHandler`.
- [ ] Run the selected tool with its existing prompt and pinned excerpt in a
      fresh retained conversation. Preserve existing tool options, guides,
      streaming, cancellation, truncation, and token behavior.
- [ ] Post deterministic host/tool progress, then render the exact completed
      tool report as an attributed artifact.
- [ ] Adopt the new sidecar only after successful completion; dispose zombie,
      cancelled, failed, and superseded conversations without replacing the
      previous usable sidecar.
- [ ] Inject a bounded evidence envelope into the host containing tool id/name,
      originating user request/action, exact report, truncation/usage metadata
      where relevant, and an instruction to evaluate rather than impersonate.
- [ ] Start the persona host lazily from that evidence when the user began with
      a tool; otherwise continue the retained host. Stream and append persona
      synthesis as its own turn.
- [ ] If persona synthesis fails after a successful tool run, preserve the
      sidecar/report and surface the host failure honestly; never roll back the
      valid tool artifact.

### Direct-tool mode

- [ ] Add “Talk directly to <tool>” on reports whose retained sidecar is live.
- [ ] Route composer sends to the direct target through the existing tool
      sidecar's `continueConversation` path, preserving atomic cancellation and
      conversation-loss behavior.
- [ ] Show an explicit composer target pill/state and deterministic “Back to
      <persona>” action; tool loss clears direct mode and returns to the host.
- [ ] Track which direct-tool exchanges have been delivered to the host. On the
      next host message after return, inject only unseen exchanges in a bounded
      structured handoff before the writer's message.
- [ ] Add named/tested handoff constants (8 turns / 20,000 characters), omission
      metadata, and atomic cursor advancement only after host completion.
- [ ] Treat “Hey <active persona>” as an optional, narrowly matched shortcut to
      exit direct mode, while keeping the visible action authoritative.

### Existing Workshop affordances

- [ ] Quick actions on a tool report route to that report's live sidecar, not
      whichever tool was most recently selected globally. Archive/disable them
      when the sidecar has been replaced or lost.
- [ ] Persona turns do not acquire tool quick actions by fallback.
- [ ] Copy / Save to notes works for verbatim reports, direct-tool responses,
      and persona synthesis with deterministic tool/persona provenance.
- [ ] Status copy distinguishes running the tool, waiting for persona synthesis,
      direct-tool continuation, handoff, cancellation, and partial failure.
- [ ] Token totals include both tool and persona calls exactly once.

### Tests and documentation

- [ ] Cover sidecar adoption/replacement/disposal and “latest per tool” bounds.
- [ ] Cover tool-first lazy host start and persona-first side-pass behavior.
- [ ] Cover exact report-before-synthesis wire order and partial failure where
      the report succeeds but persona synthesis fails.
- [ ] Cover direct mode enter/send/cancel/back/host-name shortcut/lost sidecar
      and unseen-delta handoff without duplicate delivery.
- [ ] Cover preemption and zombie completion across both tool and host phases.
- [ ] Cover reload snapshot restoration for host, sidecars, report artifacts,
      direct target, delivery cursor, and in-flight phase.
- [ ] Cover quick-action, Copy, Save, attribution, and archived-sidecar UI.
- [ ] Update architecture and session-policy documentation.

## Acceptance Criteria

- Starting with a tool shows deterministic host progress, a verbatim tool
  report, and then a separately attributed response from Jill/the selected host.
- Running a tool during persona chat never replaces or mutates the persona
  conversation.
- The latest conversation for each tool remains available for direct follow-up;
  rerunning that tool replaces/disposes only its prior sidecar.
- “Talk directly to Continuity” visibly retargets the composer and follow-ups
  reflect the retained Continuity history without an intermediate persona call.
- Returning to the persona injects unseen direct-tool exchanges once, then
  continues the original persona conversation.
- Tool reports remain inspectable verbatim even if persona synthesis fails or
  paraphrases them.
- Reset, excerpt replacement, configuration/orchestrator loss, and panel/session
  disposal clear sidecars/direct target without leaking conversations.
- Reload restores the thread and participant metadata without exposing ids.
- Lint, typecheck, focused/full tests, build, bundle verification, and
  `git diff --check` pass. Record bundle deltas.

## Suggested Implementation Order

1. Session participant/turn contracts and lifecycle tests.
2. Tool-side-pass use case with atomic sidecar adoption and verbatim artifact.
3. Host evidence injection and tool-first lazy host start.
4. Direct-tool routing, target UI, return handoff, and correlation tests.
5. Quick-action/result-provenance integration and full verification.

## Guardrails

- Do not merge persona and tool prompts or append a new system prompt to an old
  conversation.
- Do not make the persona the sole carrier of tool output.
- Do not hide direct routing behind natural-language detection.
- Do not call the persona for pure direct-tool relay; hand off deltas once when
  host conversation resumes.
- Do not implement autonomous/model-generated capability requests here; Sprint
  07 owns that trust and cost boundary.
- If orchestration no longer fits cleanly in the handler, extract the use case
  before adding more branches. The handler remains a transport adapter.

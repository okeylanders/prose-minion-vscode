# Sprint 06B: Retained Tool Sidecars and Direct Mode

**Status**: Complete
**Priority**: High
**Branch**: `sprint/workshop-editor-tab-06b-tool-side-pass` -> PR into `epic/workshop-editor-tab`
**Estimated Effort**: 4-6 days
**Depends on**: Sprint 06A
**ADRs**: [2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](../../../../docs/adr/2026-07-09-workshop-persona-hosted-conversations.md), [2026-07-10 — Agent-Run Engine and Resource Catalog Policies](../../../../docs/adr/2026-07-10-agent-run-engine-and-resource-catalogs.md)

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
- Before Sprint 07 permits host capabilities, structurally neutralize reserved
  excerpt-frame delimiters (including `</pinned-excerpt>`) before quoted writer
  content is inserted into a persona prompt. Treating the excerpt as data in
  prose is necessary but not sufficient at that trust boundary.
- Bound that handoff to the newest 8 unseen direct-tool turns and 20,000
  characters, whichever limit is reached first. Include omitted-turn count and
  deterministic truncation provenance; advance the delivery cursor only after
  a successful host turn adopts the handoff.
- Persona-generated/autonomous tool requests are Sprint 07. Sprint 06 proves
  deterministic user-triggered sidecars first.

## Tasks

### Session model and contracts

- [x] Harden the Sprint 05 sidecar map/direct target for universal persona-
      integrated tool runs rather than the legacy pre-host-only bridge.
- [x] Keep conversation ids private. Snapshot sidecars expose tool id, latest
      report turn id, availability for direct follow-up, and active-target state.
- [x] Reuse/harden `WORKSHOP_SET_CHAT_TARGET`; do not add enter/exit variants or
      a second free-text send message.
- [x] Extend `WorkshopTurn` with explicit participant/artifact metadata so the
      thread distinguishes host user/assistant turns, verbatim tool reports,
      persona synthesis, and direct-tool exchanges.
- [x] Add session operations for atomic sidecar adoption/replacement, report
      correlation, delivery cursor updates, target selection, target fallback,
      and bulk disposal on reset/excerpt replacement/resource loss.

### Tool side-pass orchestration

- [x] Extract a focused application use case if necessary (for example,
      `RunWorkshopToolSidePass`) rather than growing a multi-agent workflow
      script inside `WorkshopHandler`.
- [x] Run the selected tool with its existing prompt and pinned excerpt in a
      fresh retained conversation. Preserve existing tool options, guides,
      streaming, cancellation, truncation, and token behavior.
- [x] Post deterministic host/tool progress, then render the exact completed
      tool report as an attributed artifact.
- [x] Adopt the new sidecar only after successful completion; dispose zombie,
      cancelled, failed, and superseded conversations without replacing the
      previous usable sidecar.
- [x] Inject a bounded evidence envelope into the host containing tool id/name,
      originating user request/action, exact report, truncation/usage metadata
      where relevant, and an instruction to evaluate rather than impersonate.
- [x] Start the persona host lazily from that evidence when the user began with
      a tool; otherwise continue the retained host. Stream and append persona
      synthesis as its own turn.
- [x] If persona synthesis fails after a successful tool run, preserve the
      sidecar/report and surface the host failure honestly; never roll back the
      valid tool artifact.
- [x] Neutralize reserved persona-prompt delimiter text in quoted excerpts and
      add regression tests proving writer content cannot close or forge the
      `<pinned-excerpt>` frame. This is a Sprint 07 prerequisite.

### Direct-tool mode

- [x] Add “Talk directly to <tool>” on reports whose retained sidecar is live.
- [x] Route composer sends to the direct target through the existing tool
      sidecar's `continueConversation` path, preserving atomic cancellation and
      conversation-loss behavior.
- [x] Show an explicit composer target pill/state and deterministic “Back to
      <persona>” action; tool loss clears direct mode and returns to the host.
- [x] Track which direct-tool exchanges have been delivered to the host. On the
      next host message after return, inject only unseen exchanges in a bounded
      structured handoff before the writer's message.
- [x] Add named/tested handoff constants (8 turns / 20,000 characters), omission
      metadata, and atomic cursor advancement only after host completion.
- [x] Treat “Hey <active persona>” as an optional, narrowly matched shortcut to
      exit direct mode, while keeping the visible action authoritative.

### Existing Workshop affordances

- [x] Quick actions on a tool report route to that report's live sidecar, not
      whichever tool was most recently selected globally. Archive/disable them
      when the sidecar has been replaced or lost.
- [x] Persona turns do not acquire tool quick actions by fallback.
- [x] Copy / Save to notes works for verbatim reports, direct-tool responses,
      and persona synthesis with deterministic tool/persona provenance.
- [x] Status copy distinguishes running the tool, waiting for persona synthesis,
      direct-tool continuation, handoff, cancellation, and partial failure.
- [x] Token totals include both tool and persona calls exactly once.

### Tests and documentation

- [x] Cover sidecar adoption/replacement/disposal and “latest per tool” bounds.
- [x] Cover tool-first lazy host start and persona-first side-pass behavior.
- [x] Cover exact report-before-synthesis wire order and partial failure where
      the report succeeds but persona synthesis fails.
- [x] Cover direct mode enter/send/cancel/back/host-name shortcut/lost sidecar
      and unseen-delta handoff without duplicate delivery.
- [x] Cover reserved-delimiter neutralization in direct and file-pinned excerpts
      before any Sprint 07 capability path consumes host conversation content.
- [x] Cover preemption and zombie completion across both tool and host phases.
- [x] Cover reload snapshot restoration for host, sidecars, report artifacts,
      direct target, delivery cursor, and in-flight phase.
- [x] Cover quick-action, Copy, Save, attribution, and archived-sidecar UI.
- [x] Update architecture and session-policy documentation.

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

## Completion Record (2026-07-11)

- Added composition-root-owned `RunWorkshopToolSidePass`: isolated retained
  tool run, atomic report adoption/replacement, then lazy-start/continuation of
  the immutable persona host with bounded structured evidence.
- `WorkshopSessionService` now owns explicit participant/artifact metadata,
  report correlation, latest-per-tool sidecars, direct targeting, in-flight
  phases, and transactional unseen-delta cursors.
- Direct handoff is capped at the newest 8 completed exchange turns and 20,000
  characters. Omission/truncation provenance is deterministic; cancelled
  attempts are not delivered, and cursors commit only after host adoption.
- Report-owned quick actions carry `reportTurnId`; replaced reports become
  archived. Reports expose “Talk directly to <tool>,” while the composer keeps
  the visible “Back to <persona>” control and narrow active-host greeting
  shortcut.
- Reserved Workshop persona-frame delimiters are encoded in direct-pinned and
  file-pinned writer content before prompt assembly.
- Closed Copy/Save provenance now covers tool reports, direct responses, and
  persona synthesis (`workshop_persona` is an allow-listed result type).

Verification:

- `npm test -- --runInBand`: 78 suites / 603 tests passed.
- `npm run typecheck`: core, webview, and extension passed.
- `npm run lint`: 0 errors (repository baseline warnings only).
- `npm run build`: extension/webview production builds, resource staging, and
  bundle sentinel verification passed.
- Bundles: `extension.js` 2,313,454 bytes (2.21 MiB) and `webview.js` 580,760
  bytes (567 KiB). Versus Sprint 06A's rounded 2.19 MiB / 566 KiB record, the
  approximate deltas are +20 KiB and +1 KiB respectively.
- `git diff --check`: passed.

# Sprint 06: Tool Side-Pass Integration

**Status**: Planned
**Priority**: High
**Branch**: `sprint/workshop-editor-tab-06-tool-side-pass` -> PR into `epic/workshop-editor-tab`
**Estimated Effort**: 3-5 days
**Depends on**: Sprint 05

## Goal

When a user triggers a Workshop tool during a persona-hosted chat, run the tool
as a structured side pass and inject its result into the active persona
conversation. The persona remains the host; the tool provides evidence.

This is the preferred behavior over replacing the persona conversation with the
tool's system prompt.

## Current Reality

- Today, `WORKSHOP_RUN_TOOL` starts a fresh retained tool conversation and the
  session adopts that conversation id.
- That behavior is correct for tool-first sessions, but wrong for a
  persona-hosted thread. If the user is chatting with Jill and runs Continuity,
  Jill should not vanish.
- Quick actions already prove the desired pattern in miniature: deterministic
  UI action resolves to a code-owned prompt and routes through the retained
  conversation path.

## Tasks

- [ ] Define the session policy for `WORKSHOP_RUN_TOOL` when an active persona
      conversation exists:
      - run the selected tool with its existing prompt and pinned excerpt
      - do not adopt the tool conversation as the session conversation
      - append/render the tool result as a distinct side-pass turn or evidence
      - send a structured follow-up into the active persona conversation
- [ ] Extend `WorkshopTurn` or add metadata so the thread can distinguish:
      - persona user turns
      - persona assistant turns
      - tool side-pass result turns
      - persona synthesis turns after side-pass injection
- [ ] Add an injection prompt template that summarizes the tool result for the
      persona without asking the persona to impersonate the tool.
- [ ] Preserve the tool-first path for sessions with no active persona
      conversation.
- [ ] Update quick actions so chips on side-pass/persona turns resolve against
      the correct active lens and do not send stale tool prompts into the wrong
      conversation.
- [ ] Add UI treatment for side-pass turns: visibly separate the tool evidence
      from the persona's response while keeping both in the same thread.
- [ ] Ensure Copy / Save to notes works for side-pass results and persona
      synthesis results with correct deterministic tool/persona names.
- [ ] Add tests for:
      - tool-first behavior remains unchanged
      - persona-hosted tool run does not replace the persona conversation id
      - side-pass result is rendered and persisted
      - persona synthesis receives the tool result
      - reset/dispose discards all retained conversations cleanly

## Acceptance Criteria

- In a Jill-hosted chat, running a tool produces a tool result and then a Jill
  response that uses that result.
- The active persona remains selected after the tool run.
- Follow-up messages after the side pass continue the persona conversation.
- Tool-first sessions still work as they did after Sprint 04.
- The thread, selected persona, selected tool, side-pass result, and active
  conversation restore correctly after webview reload.
- Typecheck, focused Workshop tests, and bundle verification pass.

## Notes / Guardrails

- Do not implement this by merging persona and tool prompts into one giant
  system prompt. The tool and persona have different responsibilities.
- Do not let side-pass tool runs silently discard or replace the persona
  conversation.
- Keep context loading inspectable. Status messages should make it clear
  whether the Workshop is running a tool, injecting evidence, or waiting on the
  persona response.
- If side-pass orchestration grows too large for `WorkshopHandler`, extract a
  focused application service rather than turning the handler into a workflow
  script.

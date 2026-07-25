# Sprint 13B: Run-local Analysis Scope

**Status**: Planned  
**Priority**: High  
**Branch**: `sprint/workshop-editor-tab-13b-run-local-analysis` -> PR into `epic/workshop-editor-tab`  
**Depends on**: Sprint 13A  
**Parent**: [Sprint 13 delivery plan](13-open-chat-guest-room-polish.md)

## Goal

Allow one bounded analysis run to inspect local material with an explicit
context policy, without mutating the Workshop room's pinned excerpt, standing
attachments, provenance, or retained persona history.

## Scope

- Define the closed run-local contract: **Subject** (pinned excerpt, verified
  editor/excerpt selection, or bounded pasted text) and **Context policy**.
- Support `inherit-room`, which includes normal bounded room context, and
  `replace-room`, which suppresses it and requires bounded free-text context.
- Validate all subject sizes, source identities, policy values, and free-text
  requirements host-side before a tool executes.
- Render the subject, policy, inherited/overridden material, and truncation in
  visible request/report state.
- Cover direct and persona-requested analysis. Prove the selected-paragraph +
  Stock & Signature + `replace-room` Creative Variations case.

## Explicit non-goals

- No arbitrary filesystem access; configured-resource reads retain their
  separate bounded capability gate.
- No change to the room's pinned excerpt or attachments as a side effect of a
  local run.
- No special Creative Variations implementation or automatic draft changes.

## Exit criteria

- One local analysis can use replacement free-text scene context while the
  room remains unchanged for later messages and runs.
- `replace-room` without free text is rejected rather than silently
  contextless.
- Contract, validation, prompt, provenance UI, and direct/persona execution
  tests pass with normal repository validation.

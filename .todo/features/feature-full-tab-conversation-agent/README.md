# Feature: Full-Tab Conversation Agent

**Date Identified**: 2026-06-29
**Source**: Migration & Facelift Pass 2 deferred design follow-up
**Status**: Planned
**Priority**: Medium
**Estimated Effort**: Large

## Summary

Create a full VS Code editor-tab Assistant experience for longer-running prose
workflows: a conversation thread, pinned context, branching exploration, and a
larger reading/writing surface than the sidebar can comfortably support.

The v2.0.0 facelift intentionally refreshed the sidebar only. The handoff bundle
included full-tab concepts, but those were recorded as out of scope until the
product shape is ready.

## Why This Is Separate

This is not leftover migration work. The monorepo split, React 18 facelift,
OpenRouter balance widget, and All Tools picker shipped in v2.0.0. A full-tab
conversation agent changes the product surface and needs its own UX decisions,
state model, persistence story, and review path.

## Candidate Capabilities

- Full-height conversation thread for drafting, critique, and iterative edits
- Pinned manuscript/context panel separate from the active prompt
- Branching or compareable answer paths for alternate revision strategies
- Conversation persistence across reloads and workspace sessions
- Explicit source attachments from current editor selection, files, and guides
- Clear handoff between sidebar quick tools and full-tab deep work

## Design Questions

- Should the full-tab agent use a custom editor, webview panel, or webview view
  opened in an editor column?
- What state persists: whole conversations, selected turns, attached context,
  model choices, or only summaries?
- How should the agent reuse existing `MessageEnvelope`, streaming, token usage,
  model selection, and resource-loading flows?
- Should branches be first-class data or a UI-only affordance over independent
  conversations?
- How does the tab avoid becoming a second app shell that duplicates sidebar
  settings and transport code?

## Architecture Notes

- Keep VS Code-specific tab/panel creation in `apps/vscode-extension`.
- Reuse host-agnostic conversation, prompt, resource, and streaming logic from
  `packages/core` where possible.
- Add new platform ports only when a non-VS-Code host would need the same
  capability.
- Follow the existing domain-hook and message-routing patterns for the webview.
- Prefer deterministic conversation persistence and context assembly around the
  LLM calls, not model-generated bookkeeping.

## Acceptance Criteria

- UX decision document or ADR exists before implementation.
- The full-tab surface launches from a discoverable VS Code command or UI action.
- Conversations can stream responses and report token/cost usage consistently
  with sidebar tools.
- Attached context is visible, inspectable, and removable.
- No `vscode` imports are introduced into `packages/core`.
- Relevant state and message contracts have focused tests.

## Related

- Archived epic: `.todo/archive/epics/epic-migration-and-facelift-2026-06-16/`
- ADR: `docs/adr/2026-06-16-monorepo-ports-and-adapters.md`
- Webview hooks: `packages/core/src/presentation/webview/hooks/`
- Message contracts: `packages/core/src/shared/types/messages/`

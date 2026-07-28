# Context lane still writes the raw source URI into prompt text

**Status**: Open
**Priority**: Low
**Discovered**: 2026-07-18, during Sprint 12 Phase 6 (source-aware prompt frames)

## Problem

Phase 6 removed raw `file:` URIs and absolute paths from every Workshop prompt
path (host, guest, tool runs) in favor of the display-safe
`<workshop-excerpt-source>` frame. One lane still ships the raw URI into
model-visible text: the shared Context generation lane
([contextAssistant.ts](../../packages/core/src/tools/assist/contextAssistant.ts))
writes `The excerpt comes from: <sourceFileUri>` into its user message. Both
consumers inherit it:

- the sidebar Context tool (its original behavior since launch), and
- the Workshop Context wizard, which reuses `ContextAssistantService`
  by design (Sprint 12 Phase 5 locked decision) and passes
  `workshopExcerptSourceUri(excerpt.source)`.

The URI is also used functionally (host-side `fileURLToPath` read to prime the
model with source content) — that part is fine; only the prompt line leaks the
absolute path.

## Direction

Swap the prompt line to a display-safe workspace-relative path (or embed the
shared excerpt-source frame) without disturbing the host-side source read.
Touches the sidebar tool's prompt, so verify sidebar Context output quality
alongside the wizard.

## Related

- Sprint 12 Phase 6 commit `9b6ad4f` (frames + "no absolute path reaches the
  prompt" guarantee for Workshop paths)
- [ADR 2026-07-18 — Workshop Thread Artifacts & Context Compaction](../../docs/adr/2026-07-18-workshop-thread-artifacts-and-context-compaction.md)

## Completion criteria

No `file:` URI or absolute filesystem path appears in any model-visible prompt
assembled by the Context lane; sidebar and wizard behavior otherwise unchanged;
tests assert the display-safe line.

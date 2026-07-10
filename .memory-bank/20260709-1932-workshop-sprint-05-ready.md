# Workshop Sprint 05 — persona host ready

**Date**: 2026-07-09
**Readiness audit completed**: 19:32 CDT; architecture refined with Okey before handoff
**Branch audited**: `epic/workshop-editor-tab`
**Baseline commit**: `2c9c31a` (Sprint 04 / PR #69 merged)
**Epic**: [Assistant as a Full Editor Tab](../.todo/epics/epic-workshop-editor-tab-2026-07-03/epic-workshop-editor-tab-2026-07-03.md)
**Sprint**: [05 — Persona Host and Browser](../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/05-persona-chat.md)
**ADR**: [Workshop Persona Host, Tool Sidecars, and Capabilities](../docs/adr/2026-07-09-workshop-persona-hosted-conversations.md)

## Readiness result

Sprint 05 is ready to branch from `epic/workshop-editor-tab`. Sprint 04 is
already merged into the integration branch; the epic's stale progress/source
paths were corrected and the persona expansion is now seven sprints.

The controlling decisions are:

- The Workshop always has a persona host; Jill is the default.
- Persona selection is a tool-browser-style modal with person outline, focus
  badge, specialty, and description.
- `WORKSHOP_SELECT_PERSONA` persists selection. The existing
  `WORKSHOP_SEND_MESSAGE` starts the host when needed and continues it later.
- Persona identity/system prompt is immutable. New session is the v1 persona-
  switch boundary and preserves the pinned excerpt while restoring Jill.
- The full participant shape is established in Sprint 05: one host, latest
  sidecar per tool, and optional direct target. Conversation ids stay host-side.
- Sprint 05 uses that shape to preserve legacy tool-first direct chat and “Back
  to Jill” without a temporary second session model. It still guards an active
  persona conversation from new destructive tool replacement.

## Sprint boundaries

- **Sprint 05**: persona catalog/prompts, modal browser, retained persona host,
  participant registry, legacy tool-first direct chat, and Back to Jill.
- **Sprint 06**: latest retained sidecar per tool, verbatim reports, persona
  synthesis, tool-first lazy host start, explicit direct-tool mode, bounded
  delta handoff back to the host.
- **Sprint 07**: autonomous typed persona capabilities. Writer's Dictionary
  focused/full entry first; persona-requested analysis reuses Sprint 06.

The simple UX is persona-centered even though the backend can retain multiple
participants. Normal composer messages go to the host. Direct-tool mode is an
explicit temporary target with visible “Back to Jill”; it does not pay for a
persona relay call on every message.

## Prompt/resource decision

Runtime prompts belong under
`packages/core/resources/system-prompts/workshop-personas/` so the existing
path-contained `PromptLoader`, copy-resources step, and VSIX staging witness all
apply.

The external authoring sources were confirmed at:

- `/Users/okeylanders/Documents/GitHub/zsh-setup/prompt-library/claude-personas/CLAUDE-Jill.md`
- `/Users/okeylanders/Documents/GitHub/zsh-setup/prompt-library/claude-skills/{agnes,cliff,dev,edna,felix,harper,margot,penny,quinn,theo,wren}/SKILL.md`

They total roughly 1,570 lines and require curation, not mechanical copying.
Remove skill frontmatter/invocation rules, local paths, manuscript-specific
canon, unavailable tooling/subagent instructions, and multi-agent choreography.
Preserve each persona's voice, craft remit, response behavior, and boundaries.

## Implementation seam

`AIResourceOrchestrator.executeWithoutCapabilities` already accepts
`AIOptions.retainConversation` but currently always deletes its conversation.
Sprint 05 implements the same pin/retain-on-success/delete-on-cancel-or-failure
policy proven by `executeWithAgentCapabilities`, then exposes
`AssistantToolService.startWorkshopPersonaConversation(...)` on the captured
assistant-orchestrator generation.

Sprint 07 calls existing services through a typed application capability
boundary—not through handlers or fabricated webview messages. It exposes
`DictionaryService.lookupWord`, `generateParallelDictionary`, and Sprint 06's
analysis side-pass use case with strict validation, budgets, cancellation,
artifacts, and nested usage accounting.

Workspace context requests remain separate. The context-resource loop deletes
its conversation while retained follow-ups do not parse `<context-request>`.
The retained integration is tracked in
[feature-workshop-persona-context-loading](../.todo/features/feature-workshop-persona-context-loading/README.md).

## Verification baseline

- Focused Workshop/orchestrator/service tests: 5 suites, 99 tests — pass.
- Full test suite: 64 suites, 553 tests, 1 snapshot — pass.
- `npm run typecheck` — pass (core, webview, extension).
- `npm run lint` — pass with 0 errors / 588 existing warnings.
- `npm run build` — pass; resource staging and bundle sentinel pass.
- Build reports the existing webview size warning: `webview.js` 557 KiB.
- `git diff --check` — pass.

## Remaining epic-level risk

The shared `MarkdownRenderer` sanitization issue remains a before-final-merge
requirement. It does not block Sprint 05, but the epic must not merge to `main`
with untrusted model markdown still able to emit raw HTML / remote image
requests.

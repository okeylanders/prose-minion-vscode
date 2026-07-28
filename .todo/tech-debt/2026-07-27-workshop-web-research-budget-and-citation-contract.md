# Workshop web-research budget and citation-link contract

- **Status:** Deferred from PR #93 review
- **Priority:** High
- **Related:** PR #93, `docs/pr-reviews/pr-93-workshop-web-research-review.md`

## Problem

Workshop enables OpenRouter's server-side web-search tool per persona turn. The current provider response does not expose a durable, authoritative count of server-tool invocations, so a session-wide budget cannot be enforced honestly without a product contract for what is counted, when it resets, and what the room does after it is exhausted.

The provider's URL annotations also identify sources but do not reliably map a model-authored inline `[n]` marker to an annotation. The current, user-directed UI keeps independently numbered clickable source pills; it must not imply that those numbers are a canonical mapping for inline markers.

The room-settings coordinator now owns a third guarded setting. If this feature gains a visible budget or additional controls, the web-research state should be extracted into a dedicated service rather than adding more coordinator-owned persistence fields.

## Related files

- `packages/core/src/application/services/workshop/WorkshopConversationSettingsService.ts`
- `packages/core/src/application/services/workshop/RunWorkshopToolSidePass.ts`
- `packages/core/src/infrastructure/api/providers/OpenRouterClient.ts`
- `packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx`

## Completion criteria

- Define a user-visible per-session budget, reset behavior, and exhausted-state UX.
- Base accounting on provider-reported tool usage/cost when available; document any conservative fallback.
- Persist and display the remaining budget without charging disabled or non-search turns.
- Preserve source title/URL pills and add inline citation anchors only when provider annotations can prove the mapping.
- Extract web-research settings ownership into a dedicated service if the control surface expands beyond the current enablement toggle.

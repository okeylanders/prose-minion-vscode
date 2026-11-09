# Restore focus after hiding the last persona reaction

- Status: Open
- Priority: Low / P3
- Source: [PR #247 independent review, F-01](../../docs/pr-reviews/pr-247-independent-persona-reactions-review.md)
- Reviewed implementation: `b7c9419f05fc1d2b5b2256cb3e962afc51998421`
- Ownership: Workshop reaction-chip presentation

## Problem

`WorkshopTurnReactionChips` restores focus to a remaining chip or the same turn's Add reaction button. A persona reaction sits on a writer turn, and writer turns have no Add reaction button. Hiding the last persona chip while its Hide button has focus leaves focus on the document body after the host snapshot removes it.

The fallback already exists on the Slice 3 base (`98641f20`), so this is inherited accessibility debt rather than a blocker for PR #247. A real-WorkshopApp characterization reproduced the missing fallback.

## Related files

- `packages/core/src/presentation/webview/components/workshop/reactions/WorkshopTurnReactions.tsx`
- `packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx`
- `packages/core/src/__tests__/presentation/webview/WorkshopApp.personaReactions.test.tsx`

## Completion criteria

- Removing the last focused persona chip restores focus to that writer bubble or a stable action on it.
- Removing one of several chips still focuses an appropriate remaining chip.
- A delayed snapshot does not steal focus from somewhere the user moved it.
- Regression tests cover these real-App sequences.

The separate product question about whether the slim line keeps its glyph after Hide remains PR #247 L2; this focus repair does not decide it.

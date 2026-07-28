# Feature: Workshop Participant Identity Colors

**Status**: Proposed
**Priority**: Low
**Date**: 2026-07-26
**Origin**: PR #91 Extension Development Host smoke test
**Related**: [Workshop Participant Rail](../feature-workshop-participant-rail/README.md)

## Problem / Motivation

Workshop assigns every persona a stable, collision-free identity-dot color,
but the color currently stops at the context-budget dot. A participant's
response-card border and corner name use shared neutral styling, so the
identity signal does not carry through the conversation itself.

Extending the same identity token would make multi-persona threads easier to
scan without changing participant semantics or relying on color alone.

## Proposal

- Reuse the canonical participant identity-color slot for:
  - the context-budget identity dot;
  - the participant response-card border or border accent;
  - the participant name in the response-card corner.
- Keep the written participant name and existing participant icon so color is
  supplementary, never the only identity cue.
- Apply color through the shared `--pm-identity-*` tokens; do not duplicate the
  palette or derive identity from display copy inside response components.
- Preserve the current stable roster mapping across renders and reloads.

## Related Files

- `packages/core/src/presentation/webview/utils/contextBudget.ts`
- `packages/core/src/presentation/webview/components/shared/ContextBudget.tsx`
- Workshop response-card component and stylesheet

## Completion Criteria

- [ ] A participant uses the same deterministic color in its context dot,
      response-card border treatment, and corner name.
- [ ] Host and guest cards receive the same treatment from the same identity
      mapping.
- [ ] Labels remain visible, so participant identity never depends on color
      perception.
- [ ] Dark-theme contrast is checked for all twelve palette slots without
      making borders visually louder than response content.
- [ ] Component tests prove card accents and dots resolve to the same slot.

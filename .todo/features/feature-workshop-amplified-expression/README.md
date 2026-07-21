# Feature: Workshop Amplified Persona Expression

**Date Identified**: 2026-07-20
**Source**: Writer evaluation of shipped Workshop conversation behavior
**Status**: Full calibration roster implemented — conditional assembly,
Amplified runtime behavior, and all twelve persona calibrations are ready for
live testing; modal layout polish remains pending
**Priority**: High
**Estimated Effort**: Medium

## Problem / Motivation

The initial expression implementation always included each persona's
full-expression overlay and asked a lower-priority turn frame to mute it for
Subtle. Live use showed that the frame could not reliably suppress
system-priority influence. Full also leaves room for a deliberately stronger,
persona-specific lexical and communication calibration without turning seed
words into mandatory vocabulary.

The conversation-behavior modal also scrolls as one box, allowing its header
and Apply action to disappear on shorter editor surfaces.

## Implemented Calibration Roster

- `Subtle` assembles the persona foundation without the full-expression overlay.
- `Full` assembles foundation plus the existing full-expression overlay.
- `Amplified` adds the full overlay, the persona's required reviewed calibration,
  and a short hidden reminder on every persona-directed turn.
- Mode and expression changes rebuild all retained host/live-guest system
  messages as one guarded batch; reactivity-only changes remain frame-only.
- Transition provenance records both mode and expression.
- Reviewed calibrations exist for Jill, Sister Agnes, Cliff, Dev, Edna, Felix,
  Harper, Margot, Penny, Quinn, Theo, and Wren.
- Each reviewed calibration includes a compact concept-to-language field map
  derived from richer dictionary-style authoring, with a neutral literal
  baseline and explicit protection against shared-assistant vocabulary tics.
- The third expression level is selectable and persists through the existing
  `proseMinion.workshop.conversationBehavior` setting.

## Evaluation

Run the same excerpts and writer turns through Subtle, Full, and Amplified for
the four-persona collision set. Record:

- blind persona recognition;
- craft usefulness and factual exactness;
- leakage of full-profile behavior into Subtle;
- whether Amplified increases identity signal beyond Full;
- forced seed words, repeated signature imagery, or semantic distortion;
- displacement of shared-assistant defaults such as architectural metaphors
  without merely replacing them with persona-specific catchphrases;
- turn length, metaphor density, and communication-style separation; and
- behavior after disagreement and on the third or fourth retained turn.

Penny is the negative-color control: stronger amplification should make her
plainer and more immediate, not more ornamental.

## Remaining Work

1. Review qualitative results and revise the shared calibration schema if the
   roster exposes collisions, caricature, or replacement lexical tics.
2. Convert the behavior modal to fixed header / scrollable center / fixed
   footer rows so Apply remains visible at short viewport heights.
3. Add responsive behavior for the three expression cards and footer actions.
4. Run a visual smoke at narrow width and approximately 600–768 px height.

## Completion Criteria

- All twelve personas have reviewed Amplified calibrations with lexical,
  communication, and selected trait-pressure gradients.
- Frozen-corpus evaluation shows Amplified improves persona recognition without
  reducing exactness or usefulness.
- Subtle materially reduces full-profile leakage.
- No calibration treats seed words as mandatory or changes meaning to preserve
  voice.
- The modal header and actions remain visible while only its center content
  scrolls.
- Focused tests, full test suite, typecheck, lint, and production build pass.

## Related Files

- `docs/adr/2026-07-20-workshop-persona-interaction-modes-and-expression-profiles.md`
- `packages/core/src/shared/constants/workshopPersonas.ts`
- `packages/core/resources/system-prompts/workshop-personas/expression-profiles/`
- `packages/core/resources/system-prompts/workshop-personas/expression-calibrations/`
- `packages/core/src/presentation/webview/components/workshop/WorkshopConversationBehaviorModal.tsx`
- `packages/core/src/presentation/webview/workshop.css`

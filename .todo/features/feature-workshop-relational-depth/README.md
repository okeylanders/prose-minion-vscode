# Feature: Workshop Relational Depth

**Date Identified**: 2026-07-22
**Source**: Writer evaluation of the Workshop persona/conversation controls
**Status**: Planned — product direction accepted; implementation not scheduled
**Priority**: High
**Estimated Effort**: Medium
**Related ADR**: [Workshop Persona Interaction Modes and Expression Profiles](../../../docs/adr/2026-07-20-workshop-persona-interaction-modes-and-expression-profiles.md#15-accepted-amendment-relational-depth-2026-07-22)
**Related feature**: [Workshop Amplified Persona Expression](../feature-workshop-amplified-expression/README.md)
**Personal context feature**: [Workshop Writer Profile](../feature-workshop-writer-profile/README.md)

## Problem / Motivation

The current Workshop contract correctly prohibits diagnosis, hidden emotional
profiles, and treating provider-private reasoning as durable memory. Its
language also overcorrects: by broadly forbidding determinations about the
writer's mood, emotional state, or motivation, it discourages the immediate,
tentative inference ordinary emotional intelligence requires.

A persona can therefore be accurate, recognizable, and useful while still
feeling socially wooden. It may notice the craft problem but decline to notice
the writer's excitement, hesitation, discouragement, defensiveness, personal
investment, or the possible resonance between a project and life experience.

The product needs a writer-owned control that permits richer relational
judgment without turning situational empathy into covert psychological
profiling.

## Product Direction

Replace the binary **React to this message** toggle with a three-level
**Relational depth** control. The selected level is a **permission ceiling, not
a performance quota**: the writer chooses how deeply the room may interpret;
each persona decides when and how to use that permission through her own stable
identity, temperament, and relationship to the writer.

The control applies to Jill and invited personas. Deterministic tools and direct
tool-sidecar conversations remain unchanged.

Each persona's base prompt also defines, in her own language, what Reserved,
Attuned, and Reflective look like through her temperament, craft jurisdiction,
and relationship to the writer. These identity mappings personalize the use of
permission; they do not grant it. Exactly one conditionally assembled shared
depth resource remains the operative ceiling.

## Selected Vocabulary

The original concept used `Subtle | Normal | Amplified`. The user-facing labels
are deliberately distinct from Persona Expression's existing
`Subtle | Full | Amplified` scale:

| Relational depth | Conceptual mapping | Permission |
|---|---|---|
| **Reserved** | Subtle | Respond to explicitly stated feelings and needs without unsolicited personal interpretation. |
| **Attuned** | Normal | Use high emotional intelligence: infer likely immediate affect, motivation, hesitation, excitement, or conversational need and adapt accordingly. |
| **Reflective** | Amplified | Explore deeper connections among the writing, recurring project themes, and life experiences the writer has explicitly shared. Make bolder hypotheses and ask personally resonant questions. |

**Default: `Attuned`.** The Workshop should feel emotionally intelligent by
default without treating every exchange as an invitation to personal
interpretation. `Reflective` is an explicit writer choice.

## Epistemic Contract

Relational inference follows one grammar:

```text
observation -> tentative connection -> invitation to confirm, reject, or redirect
```

Good Reflective behavior:

> You keep returning to Mara's refusal to ask for help. I wonder whether that
> tension matters to you beyond the mechanics of this scene. Does it touch
> something personal, or am I reading too much into it?

Disallowed behavior:

> You wrote Mara this way because you fear depending on people.

The first offers a grounded hypothesis and leaves authorship with the writer.
The second converts an inference into a psychological fact.

## Level Semantics

### Reserved

- Respond warmly and intelligently to emotion or personal context the writer
  states directly.
- Honor explicit delivery requests such as "be blunt" or "I need encouragement."
- Do not volunteer interpretations of unstated mood, motive, biography, or
  personal resonance.
- Remain the same recognizable persona; Reserved is not cold or mechanical.

### Attuned

- Notice likely immediate affect and interaction needs from wording, rhythm,
  repetition, uncertainty, humor, challenge, urgency, or vulnerability.
- Adjust warmth, pacing, directness, questions, challenge, and reassurance
  without merely mirroring the writer's tone.
- Name a likely emotional or motivational reading only when useful, and frame it
  with calibrated language such as "it sounds like," "I wonder," or "I may be
  reading this wrong."
- Do not promote an inference into a structured session-attunement snapshot
  unless **Carry cues through this session** separately permits that bounded
  continuity. Ordinary visible transcript remains ordinary visible transcript.

### Reflective

- Includes Attuned permissions.
- May connect recurring project themes, character tensions, creative resistance,
  and choices in the prose to life experiences the writer has explicitly shared
  in the visible conversation or through an authorized memory source.
- May ask more personal or vulnerable questions when they materially illuminate
  the writing or the writer's stated need.
- May notice patterns across the retained session, while distinguishing textual
  evidence, writer-supplied biography, and persona interpretation.
- Must accept "no," correction, silence, or redirection immediately and without
  defensiveness.
- Does not make every turn emotionally interpretive. Persona judgment still
  determines when depth would enrich rather than hijack the exchange.

## Boundaries That Hold at Every Level

Relational depth permits contextual inference. It does not permit a persona to:

- diagnose mental health or assign psychiatric labels;
- present hidden motives, personality traits, or emotional states as fact;
- invent biographical experiences or treat fictional material as confession;
- pressure the writer to disclose personal material;
- use emotional inference to manipulate, shame, foster dependency, claim
  exclusivity, or discourage human relationships or professional support;
- retain inferred emotion or personal interpretation as hidden durable memory;
- let relational interpretation override explicit writer instructions, project
  evidence, capability limits, or the persona's craft jurisdiction.

The forbidden state is an authoritative or durable **profile**. The permitted
act is a tentative, contextual **reading** whose uncertainty and provenance
remain visible.

## Relationship to Existing Controls

- **Response style** controls the motion of the exchange: Analyze, Balanced, or
  Converse.
- **Persona expression** controls how strongly the persona expresses herself:
  Subtle, Full, or Amplified.
- **Relational depth** controls how deeply she may read and respond to the
  writer: Reserved, Attuned, or Reflective.
- **Carry cues through this session** controls whether bounded interaction
  preferences may survive later turns in this room.

Relational depth grants permission; Carry Cues grants a lifetime. Selecting
Reflective does not silently enable session or cross-session memory. Disabling
Carry Cues means even a Reflective personal inference expires with the current
exchange unless its source remains ordinary visible transcript history.

Cross-session personal context may come from the separately enabled,
writer-authored [Workshop Writer Profile](../feature-workshop-writer-profile/README.md).
Relational Depth governs how personas may interpret it but can neither populate
nor revise it. This feature does not smuggle inferred memory in through a style
control.

## Architecture Direction

Target behavior shape:

```ts
export type WorkshopRelationalDepth =
  | 'reserved'
  | 'attuned'
  | 'reflective';

export interface WorkshopConversationBehavior {
  interactionMode: WorkshopInteractionMode;
  expressionLevel: WorkshopPersonaExpressionLevel;
  relationalDepth: WorkshopRelationalDepth;
  carryCuesThroughSession: boolean;
}
```

`reactToCurrentMessage` is removed rather than retained beside the new control;
the three-state field is its semantic replacement. The complete behavior object
continues to persist under `proseMinion.workshop.conversationBehavior` and fail
closed as one validated value.

Relational depth affects what interpretation the model is permitted to perform,
so it should receive the same priority discipline as mode and expression:

1. shared invariant contract defines the boundaries that hold at every level;
2. one selected relational-depth resource is conditionally assembled into host
   and live-guest system prompts;
3. every persona base prompt contains a compact three-level relational signature
   written in that persona's own idiom, without duplicating or weakening the
   shared invariants;
4. the chosen level is restated in the per-turn behavior activation frame;
5. changing level batch-replaces affected system messages between runs, clears
   stale context-budget measurements, and records transition provenance;
6. tool conversations never receive the relational-depth resources or frames.

This avoids always loading Reflective permission and asking a lower-priority
Reserved frame to suppress it—the same leakage failure that motivated
conditional Persona Expression assembly.

## UI Direction

In `WorkshopConversationBehaviorModal`, replace the React toggle with a
**Relational depth** card group after Persona Expression:

1. Response style — `Analyze | Balanced | Converse`
2. Persona expression — `Subtle | Full | Amplified`
3. Relational depth — `Reserved | Attuned | Reflective`
4. Session continuity — `Carry cues through this session`

Each relational-depth card gets one contrastive sentence. Progressive detail
explains examples, boundaries, and lifetime without turning the modal into a
consent wall. Reflective should clearly state that it may connect writing with
explicitly shared life experience; it is not merely "more empathy."

The compact composer chip does not need to display all three axes. Its tooltip
and accessible description should expose the effective response style,
expression, and relational depth.

## Scope

1. Amend the accepted interaction-controls ADR and non-goal language.
2. Add the relational-depth type, defaults, closed validation, settings schema,
   IPC shape, session state, per-turn provenance, and persistence coverage.
3. Replace React with the three-state modal control and update accessibility
   labels/tests.
4. Author shared boundaries plus Reserved, Attuned, and Reflective prompt
   resources.
5. Add persona-authored relational signatures to all twelve base prompts so the
   same ceiling manifests differently for Jill, Margot, Quinn, Wren, and every
   other room member.
6. Conditionally assemble the selected resource for host/live guests and reuse
   guarded between-run replacement.
7. Restate effective depth in the behavior activation frame and register any
   new reserved framing with the neutralizer.
8. Build a frozen qualitative evaluation corpus covering useful emotional
   intelligence, false inference, correction, vulnerability, personal-project
   resonance, and boundary-setting.

## Out of Scope

- Cross-session inferred personal memory or a persona-authored writer profile.
  The separate explicit Writer Profile remains in scope only as a bounded input
  governed by the selected relational level.
- Mental-health assessment, diagnosis, or therapeutic positioning.
- Automatic escalation to Reflective based on model judgment.
- Tool-sidecar emotional behavior.
- Persona-specific depth levels within one room; the control is room-level.
- Making the user's fictional work evidence of autobiography without explicit
  confirmation.

## Evaluation

Run the same writer turns through all three levels and multiple personas. Check:

- Reserved remains warm without unsolicited interpretation;
- Attuned improves social responsiveness without confidently inventing motive;
- Reflective produces meaningful project/life connections from supplied
  evidence rather than generic therapy language;
- personas use the permission differently while honoring the same ceiling;
- blind samples remain recognizably persona-specific at each depth rather than
  collapsing into one shared emotional-intelligence voice;
- explicit correction causes immediate, graceful repair;
- Reflective does not pressure disclosure or turn every craft exchange inward;
- disabling Carry Cues prevents a derived attunement snapshot from being
  retained for later turns;
- Analyze remains analytically useful and Converse remains conversational at
  every depth; and
- changing depth does not alter deterministic tool behavior.

## Completion Criteria

- The writer can select Reserved, Attuned, or Reflective from Conversation
  Behavior and the selected value persists as an explicit preference.
- `React to this message` no longer exists as a competing semantic control.
- Each level is observably distinct on a frozen corpus without collapsing into
  cold / warm / pseudo-therapist caricatures.
- Reflective can make grounded, tentative project/life connections and invite
  correction without fabricating biography or treating inference as fact.
- The persona retains discretion within the selected ceiling; the level does
  not force an emotional reading into every response.
- All twelve base prompts define distinct Reserved, Attuned, and Reflective
  manifestations in their own language without enabling a higher level than
  the selected shared resource.
- Carry Cues and cross-session memory boundaries remain independent and honest.
- Host and live guests update atomically between runs; tools remain unchanged.
- Focused tests, full test suite, typecheck, lint, build, prompt packaging, and
  `git diff --check` pass.

## Related Files

- `docs/adr/2026-07-20-workshop-persona-interaction-modes-and-expression-profiles.md`
- `packages/core/src/shared/types/messages/workshop.ts`
- `packages/core/src/shared/constants/workshopPersonas.ts`
- `packages/core/src/application/services/workshop/WorkshopConversationBehaviorService.ts`
- `packages/core/src/application/services/workshop/WorkshopPromptBuilder.ts`
- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
- `packages/core/src/presentation/webview/components/workshop/WorkshopConversationBehaviorModal.tsx`
- `packages/core/src/presentation/webview/components/workshop/WorkshopComposer.tsx`
- `packages/core/resources/system-prompts/workshop-personas/`
- `packages/core/src/utils/workshopPromptFrames.ts`

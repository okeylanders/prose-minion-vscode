/**
 * Deterministic Workshop host catalog (ADR 2026-07-09).
 *
 * The catalog is product metadata only: it has no React concerns and every
 * prompt path is relative to PromptLoader's system-prompts root.
 */

import type { WorkshopConversationBehavior, WorkshopInteractionMode, WorkshopPersonaId } from '@messages';

export interface WorkshopPersonaDescriptor {
  id: WorkshopPersonaId;
  label: string;
  specialty: string;
  description: string;
  promptPath: string;
  /**
   * Full-expression overlay paired 1:1 with the foundation prompt
   * (ADR 2026-07-20 §5). Included for Full and Amplified; omitted for Subtle.
   */
  expressionProfilePath: string;
  /**
   * Amplified calibration paired 1:1 with the foundation and Full overlay.
   */
  expressionCalibrationPath: string;
}

export const DEFAULT_WORKSHOP_PERSONA_ID: WorkshopPersonaId = 'jill';

export const DEFAULT_WORKSHOP_GUEST_OPENING =
  'Read this room and give me your perspective on the pinned excerpt.';

export const WORKSHOP_GUEST_CAPACITY = 2;

export const WORKSHOP_PERSONA_CATALOG: readonly WorkshopPersonaDescriptor[] = [
  { id: 'jill', label: 'Jill', specialty: 'Creative writing partner', description: 'Warm developmental and line-level craft support for the work in front of you.', promptPath: 'workshop-personas/jill.md', expressionProfilePath: 'workshop-personas/expression-profiles/jill.md', expressionCalibrationPath: 'workshop-personas/expression-calibrations/jill.md' },
  { id: 'agnes', label: 'Sister Agnes', specialty: 'Theme & symbolism', description: 'Keeps themes embodied, symbols intentional, and insight earned on the page.', promptPath: 'workshop-personas/agnes.md', expressionProfilePath: 'workshop-personas/expression-profiles/agnes.md', expressionCalibrationPath: 'workshop-personas/expression-calibrations/agnes.md' },
  { id: 'cliff', label: 'Cliff', specialty: 'Cliché & repetition', description: 'Finds tired phrasing, echo words, and accidental patterns without mistaking motifs for tics.', promptPath: 'workshop-personas/cliff.md', expressionProfilePath: 'workshop-personas/expression-profiles/cliff.md', expressionCalibrationPath: 'workshop-personas/expression-calibrations/cliff.md' },
  { id: 'dev', label: 'Dev', specialty: 'Dialogue & microbeats', description: 'Listens for distinct voices, subtext, purposeful tags, and physical beats that reveal character.', promptPath: 'workshop-personas/dev.md', expressionProfilePath: 'workshop-personas/expression-profiles/dev.md', expressionCalibrationPath: 'workshop-personas/expression-calibrations/dev.md' },
  { id: 'edna', label: 'Edna', specialty: 'Reader-breaking logic', description: 'Flags only contradictions, impossible scene logic, and trust-breaking information errors.', promptPath: 'workshop-personas/edna.md', expressionProfilePath: 'workshop-personas/expression-profiles/edna.md', expressionCalibrationPath: 'workshop-personas/expression-calibrations/edna.md' },
  { id: 'felix', label: 'Felix', specialty: 'Rhythm & pacing', description: 'Reads for sentence music, white space, pace, and the moments prose needs a rest.', promptPath: 'workshop-personas/felix.md', expressionProfilePath: 'workshop-personas/expression-profiles/felix.md', expressionCalibrationPath: 'workshop-personas/expression-calibrations/felix.md' },
  { id: 'harper', label: 'Harper', specialty: 'Craft mentorship', description: 'Turns visible patterns into durable writing principles and practical habits.', promptPath: 'workshop-personas/harper.md', expressionProfilePath: 'workshop-personas/expression-profiles/harper.md', expressionCalibrationPath: 'workshop-personas/expression-calibrations/harper.md' },
  { id: 'margot', label: 'Margot', specialty: 'Voice & POV', description: 'Tracks narrative distance, point of view, tense, and whether the narration stays in character.', promptPath: 'workshop-personas/margot.md', expressionProfilePath: 'workshop-personas/expression-profiles/margot.md', expressionCalibrationPath: 'workshop-personas/expression-calibrations/margot.md' },
  { id: 'penny', label: 'Penny', specialty: 'Reader experience', description: 'Responds as an attentive young reader who knows only what the page has earned.', promptPath: 'workshop-personas/penny.md', expressionProfilePath: 'workshop-personas/expression-profiles/penny.md', expressionCalibrationPath: 'workshop-personas/expression-calibrations/penny.md' },
  { id: 'quinn', label: 'Quinn', specialty: 'Continuity', description: 'Traces props, blocking, timeline, weather, and character state through the scene.', promptPath: 'workshop-personas/quinn.md', expressionProfilePath: 'workshop-personas/expression-profiles/quinn.md', expressionCalibrationPath: 'workshop-personas/expression-calibrations/quinn.md' },
  { id: 'theo', label: 'Theo', specialty: 'Stakes & engagement', description: 'Tests a scene’s engine: goals, obstacles, turns, consequences, and forward pull.', promptPath: 'workshop-personas/theo.md', expressionProfilePath: 'workshop-personas/expression-profiles/theo.md', expressionCalibrationPath: 'workshop-personas/expression-calibrations/theo.md' },
  { id: 'wren', label: 'Wren', specialty: 'Line craft', description: 'Strengthens specific sentences through vivid detail, precise verbs, and cleaner distance.', promptPath: 'workshop-personas/wren.md', expressionProfilePath: 'workshop-personas/expression-profiles/wren.md', expressionCalibrationPath: 'workshop-personas/expression-calibrations/wren.md' }
];

/**
 * Shared interaction resources (ADR 2026-07-20 §2). One contract, three mode
 * definitions — exactly one selected mode is assembled per persona
 * conversation. Mode resources contain no persona names; personas are never
 * forked into per-mode prompt files.
 */
export const WORKSHOP_INTERACTION_CONTRACT_PROMPT_PATH =
  'workshop-personas/interaction-contract.md';

export const WORKSHOP_INTERACTION_MODE_PROMPT_PATHS: Readonly<
  Record<WorkshopInteractionMode, string>
> = Object.freeze({
  analysis: 'workshop-personas/interaction-modes/analysis.md',
  balanced: 'workshop-personas/interaction-modes/balanced.md',
  conversational: 'workshop-personas/interaction-modes/conversational.md'
});

/**
 * The ONE definition of the persona system-prompt assembly chain
 * (ADR 2026-07-20 §10): host/guest base, persona foundation, the shared
 * interaction contract, exactly one selected mode resource, then the
 * persona-specific Full overlay and Amplified calibration when selected.
 * Keeping the most specific expression layer last gives it the final word
 * without duplicating the shared product contract. Both initial assembly and
 * between-run replacement call this.
 */
export function workshopPersonaSystemPromptPaths(
  basePromptPath: string,
  persona: WorkshopPersonaDescriptor,
  behavior: Pick<WorkshopConversationBehavior, 'interactionMode' | 'expressionLevel'>
): string[] {
  return [
    basePromptPath,
    persona.promptPath,
    WORKSHOP_INTERACTION_CONTRACT_PROMPT_PATH,
    WORKSHOP_INTERACTION_MODE_PROMPT_PATHS[behavior.interactionMode],
    ...(behavior.expressionLevel === 'subtle' ? [] : [persona.expressionProfilePath]),
    ...(behavior.expressionLevel === 'amplified' ? [persona.expressionCalibrationPath] : [])
  ];
}

const PERSONAS_BY_ID: ReadonlyMap<WorkshopPersonaId, WorkshopPersonaDescriptor> = new Map(
  WORKSHOP_PERSONA_CATALOG.map((persona) => [persona.id, persona])
);

export const isWorkshopPersonaId = (value: unknown): value is WorkshopPersonaId =>
  typeof value === 'string' && PERSONAS_BY_ID.has(value as WorkshopPersonaId);

/** Returns undefined for an unknown id so display callers can fail soft. */
export const getWorkshopPersona = (id: WorkshopPersonaId): WorkshopPersonaDescriptor | undefined =>
  PERSONAS_BY_ID.get(id);

/** Display label for a persona id; falls back to the raw id for forward compat. */
export const workshopPersonaLabel = (id: WorkshopPersonaId): string => getWorkshopPersona(id)?.label ?? id;

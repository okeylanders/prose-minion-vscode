/**
 * Deterministic Workshop host catalog (ADR 2026-07-09).
 *
 * The catalog is product metadata only: it has no React concerns and every
 * prompt path is relative to PromptLoader's system-prompts root.
 */

import type { WorkshopPersonaId } from '@messages';

export interface WorkshopPersonaDescriptor {
  id: WorkshopPersonaId;
  label: string;
  specialty: string;
  description: string;
  promptPath: string;
}

export const DEFAULT_WORKSHOP_PERSONA_ID: WorkshopPersonaId = 'jill';

export const WORKSHOP_PERSONA_CATALOG: readonly WorkshopPersonaDescriptor[] = [
  { id: 'jill', label: 'Jill', specialty: 'Creative writing partner', description: 'Warm developmental and line-level craft support for the work in front of you.', promptPath: 'workshop-personas/jill.md' },
  { id: 'agnes', label: 'Sister Agnes', specialty: 'Theme & symbolism', description: 'Keeps themes embodied, symbols intentional, and insight earned on the page.', promptPath: 'workshop-personas/agnes.md' },
  { id: 'cliff', label: 'Cliff', specialty: 'Cliché & repetition', description: 'Finds tired phrasing, echo words, and accidental patterns without mistaking motifs for tics.', promptPath: 'workshop-personas/cliff.md' },
  { id: 'dev', label: 'Dev', specialty: 'Dialogue & microbeats', description: 'Listens for distinct voices, subtext, purposeful tags, and physical beats that reveal character.', promptPath: 'workshop-personas/dev.md' },
  { id: 'edna', label: 'Edna', specialty: 'Reader-breaking logic', description: 'Flags only contradictions, impossible scene logic, and trust-breaking information errors.', promptPath: 'workshop-personas/edna.md' },
  { id: 'felix', label: 'Felix', specialty: 'Rhythm & pacing', description: 'Reads for sentence music, white space, pace, and the moments prose needs a rest.', promptPath: 'workshop-personas/felix.md' },
  { id: 'harper', label: 'Harper', specialty: 'Craft mentorship', description: 'Turns visible patterns into durable writing principles and practical habits.', promptPath: 'workshop-personas/harper.md' },
  { id: 'margot', label: 'Margot', specialty: 'Voice & POV', description: 'Tracks narrative distance, point of view, tense, and whether the narration stays in character.', promptPath: 'workshop-personas/margot.md' },
  { id: 'penny', label: 'Penny', specialty: 'Reader experience', description: 'Responds as an attentive young reader who knows only what the page has earned.', promptPath: 'workshop-personas/penny.md' },
  { id: 'quinn', label: 'Quinn', specialty: 'Continuity', description: 'Traces props, blocking, timeline, weather, and character state through the scene.', promptPath: 'workshop-personas/quinn.md' },
  { id: 'theo', label: 'Theo', specialty: 'Stakes & engagement', description: 'Tests a scene’s engine: goals, obstacles, turns, consequences, and forward pull.', promptPath: 'workshop-personas/theo.md' },
  { id: 'wren', label: 'Wren', specialty: 'Line craft', description: 'Strengthens specific sentences through vivid detail, precise verbs, and cleaner distance.', promptPath: 'workshop-personas/wren.md' }
];

const PERSONAS_BY_ID: ReadonlyMap<WorkshopPersonaId, WorkshopPersonaDescriptor> = new Map(
  WORKSHOP_PERSONA_CATALOG.map((persona) => [persona.id, persona])
);

export const isWorkshopPersonaId = (value: unknown): value is WorkshopPersonaId =>
  typeof value === 'string' && PERSONAS_BY_ID.has(value as WorkshopPersonaId);

export const getWorkshopPersona = (id: WorkshopPersonaId): WorkshopPersonaDescriptor => {
  const persona = PERSONAS_BY_ID.get(id);
  if (!persona) {
    throw new Error(`Unknown Workshop persona: ${id}`);
  }
  return persona;
};

export const workshopPersonaLabel = (id: WorkshopPersonaId): string => getWorkshopPersona(id).label;

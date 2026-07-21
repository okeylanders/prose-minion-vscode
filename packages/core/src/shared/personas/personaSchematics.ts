/**
 * Typed loader for the persona schematics. Each `<id>.json` is a hand-authored
 * structured extraction of the persona's expression prose (see
 * `./personaSchematic` for the source-of-truth policy). The `satisfies` clause
 * is the validation seam JSON otherwise lacks: every persona file must conform
 * to `PersonaSchematic` and the catalog must be complete, or the build fails.
 * A companion test (`personaSchematics.test.ts`) adds stricter shape/index
 * checks that structural assignability can't express.
 */

import type { WorkshopPersonaId } from '@messages';
import type { PersonaSchematic } from './personaSchematic';

import agnes from './schematics/agnes.json';
import cliff from './schematics/cliff.json';
import dev from './schematics/dev.json';
import edna from './schematics/edna.json';
import felix from './schematics/felix.json';
import harper from './schematics/harper.json';
import jill from './schematics/jill.json';
import margot from './schematics/margot.json';
import penny from './schematics/penny.json';
import quinn from './schematics/quinn.json';
import theo from './schematics/theo.json';
import wren from './schematics/wren.json';

export const PERSONA_SCHEMATICS = {
  jill,
  agnes,
  cliff,
  dev,
  edna,
  felix,
  harper,
  margot,
  penny,
  quinn,
  theo,
  wren
} satisfies Record<WorkshopPersonaId, PersonaSchematic>;

/** Returns the structured schematic for a persona, or undefined for an unknown id. */
export const getPersonaSchematic = (id: WorkshopPersonaId): PersonaSchematic | undefined =>
  (PERSONA_SCHEMATICS as Record<WorkshopPersonaId, PersonaSchematic>)[id];

/** Whether a persona has an authored schematic (all catalog personas do today). */
export const hasPersonaSchematic = (id: WorkshopPersonaId): boolean => id in PERSONA_SCHEMATICS;

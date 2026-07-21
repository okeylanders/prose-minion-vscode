/**
 * Guardrail for the hand-authored persona schematics. `satisfies` in the loader
 * proves structural assignability at build time; these tests add the checks
 * assignability can't express — completeness against the catalog, non-empty
 * required content, and detent indices that stay within their stop arrays.
 * This is the seam that keeps JSON honest (personaSchematic.ts source policy).
 */

import { WORKSHOP_PERSONA_CATALOG } from '@shared/constants/workshopPersonas';
import { PERSONA_SCHEMATICS, getPersonaSchematic, hasPersonaSchematic } from '@/shared/personas/personaSchematics';
import type { PersonaGradient } from '@/shared/personas/personaSchematic';

const catalogIds = WORKSHOP_PERSONA_CATALOG.map((persona) => persona.id).sort();
const schematicIds = Object.keys(PERSONA_SCHEMATICS).sort();

const expectInRange = (gradient: { stops: string[]; default: number }, label: string): void => {
  expect(gradient.stops.length).toBeGreaterThanOrEqual(1);
  expect(gradient.default).toBeGreaterThanOrEqual(0);
  expect(gradient.default).toBeLessThan(gradient.stops.length);
  gradient.stops.forEach((stop) => expect(stop.trim().length).toBeGreaterThan(0), label);
};

describe('persona schematics', () => {
  it('covers exactly the persona catalog — no missing, no extra', () => {
    expect(schematicIds).toEqual(catalogIds);
  });

  it.each(WORKSHOP_PERSONA_CATALOG.map((persona) => [persona.id] as const))(
    '%s has a well-formed schematic',
    (id) => {
      expect(hasPersonaSchematic(id)).toBe(true);
      const schematic = getPersonaSchematic(id);
      expect(schematic).toBeDefined();
      if (!schematic) {
        return;
      }

      // metaphor is a string or the deliberate null ("plainness is the voice").
      expect(schematic.metaphor === null || schematic.metaphor.length > 0).toBe(true);

      // Trait tensions — required poles present.
      expect(schematic.tensions.length).toBeGreaterThanOrEqual(1);
      schematic.tensions.forEach((tension) => {
        for (const key of ['title', 'strength', 'shadow', 'trigger', 'regulator'] as const) {
          expect(tension[key].trim().length).toBeGreaterThan(0);
        }
      });

      // Turn-taking + aperture.
      expect(schematic.turns.length).toBeGreaterThanOrEqual(1);
      expect(schematic.aperture.openness).toBeGreaterThanOrEqual(0);
      expect(schematic.aperture.openness).toBeLessThanOrEqual(1);
      expect(schematic.aperture.tag.trim().length).toBeGreaterThan(0);
      expect(schematic.aperture.text.trim().length).toBeGreaterThan(0);

      // Verbal palette + saturation.
      expect(schematic.palette.length).toBeGreaterThanOrEqual(1);
      expect(schematic.resist.trim().length).toBeGreaterThan(0);
      expect(schematic.saturation.of).toBeGreaterThan(0);
      expect(schematic.saturation.lit).toBeGreaterThanOrEqual(0);
      expect(schematic.saturation.lit).toBeLessThanOrEqual(schematic.saturation.of);
      expect(schematic.saturation.label.trim().length).toBeGreaterThan(0);

      // Lexical gravity — gradients within bounds.
      expectInRange(schematic.gravity.verb as PersonaGradient, `${id} verb`);
      expectInRange(schematic.gravity.adj as PersonaGradient, `${id} adj`);
      expect(schematic.gravity.analogy.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(schematic.gravity.nouns)).toBe(true);
      expect(Array.isArray(schematic.gravity.anti)).toBe(true);

      // Communication gradients + trait pressure.
      expect(schematic.comm.length).toBeGreaterThanOrEqual(1);
      schematic.comm.forEach((axis) => {
        expect(axis.axis.trim().length).toBeGreaterThan(0);
        expectInRange(axis, `${id} comm ${axis.axis}`);
      });
      expect(schematic.pressure.length).toBeGreaterThanOrEqual(1);
      schematic.pressure.forEach((trait) => {
        expect(trait.trait.trim().length).toBeGreaterThan(0);
        expect(trait.stops.length).toBeGreaterThanOrEqual(1);
      });

      // Signature floor.
      expect(schematic.floor.lead.trim().length).toBeGreaterThan(0);
      expect(schematic.floor.items.length).toBeGreaterThanOrEqual(1);
    }
  );
});

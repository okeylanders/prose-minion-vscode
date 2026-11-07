/**
 * Guard the persona-reaction prompt (ADR 2026-11-07 D1, D5, Q8) against
 * drift from the code it teaches:
 *
 * - its vocabulary is the registry's, by id and gloss, in order, grouped by
 *   tone, and it never writes a glyph;
 * - its worked example is a trailer the production extractor keeps, placed
 *   last as the prose says;
 * - it states the permission's rules (rarely, at most one, a reaction alone
 *   only when nothing is asked) and the trailer's place;
 * - it is taught to host and guest after `reactions.md`, only while persona
 *   reactions are on; `reactions.md` (how to read them) is always taught.
 */
import * as fs from 'fs';
import * as path from 'path';
import { extractWorkshopReplyControls, sanitizeWorkshopReplyForRetention } from '@/utils/workshopReplyControls';
import { WORKSHOP_REACTION_TAG } from '@/utils/workshopReplyReaction';
import { WORKSHOP_REACTION_TONES, WORKSHOP_REACTIONS } from '@shared/constants/workshopReactions';
import {
  getWorkshopPersona,
  WORKSHOP_GUEST_BASE_PROMPT_PATH,
  WORKSHOP_HOST_BASE_PROMPT_PATH,
  WORKSHOP_PERSONA_REACTIONS_PROMPT_PATH,
  WORKSHOP_REACTIONS_PROMPT_PATH,
  workshopPersonaSystemPromptPaths
} from '@shared/constants/workshopPersonas';

const PROMPT = fs.readFileSync(path.resolve(__dirname,
  '../../../resources/system-prompts', WORKSHOP_PERSONA_REACTIONS_PROMPT_PATH), 'utf8');

describe('persona-reaction prompt ↔ the registry', () => {
  it('lists every reaction by id and gloss, grouped by tone, in the registry\'s order', () => {
    const listed = [...PROMPT.matchAll(/^- `([a-z-]+)`: (.+)$/gm)].map(([, id, meaning]) => ({ id, meaning }));
    expect(listed).toEqual(WORKSHOP_REACTIONS.map(({ id, meaning }) => ({ id, meaning })));
    for (const { tone, label } of WORKSHOP_REACTION_TONES) {
      const heading = PROMPT.indexOf(`\n${label}:\n`);
      expect(heading).toBeGreaterThan(-1);
      const first = WORKSHOP_REACTIONS.find((reaction) => reaction.tone === tone)!;
      expect(PROMPT.indexOf(`\`${first.id}\``, heading)).toBeGreaterThan(heading);
    }
  });

  it('never writes a glyph: the model writes the id', () => {
    for (const { glyph } of WORKSHOP_REACTIONS) {
      expect(PROMPT).not.toContain(glyph);
    }
    expect(PROMPT).toMatch(/Write the\s+reaction's id, never the emoji/);
  });

  it('its example is a trailer the extractor keeps, at the very end', () => {
    const example = PROMPT.match(/```xml\n([\s\S]*?)```/)![1].trim();
    expect(example.startsWith(`<${WORKSHOP_REACTION_TAG}>`)).toBe(true);
    const controls = extractWorkshopReplyControls(`Alice follows the rabbit.\n\n${example}`, {
      memoryOpen: false,
      reactions: { open: true, hasTarget: true }
    });
    expect(controls.reaction).toEqual({ reaction: 'mind-blown', rejections: [] });
    expect(controls.rest).toBe('Alice follows the rabbit.');
  });

  it('quotes the note history shows exactly as retention writes it (PR #247 L3)', () => {
    const note = PROMPT.replace(/\s+/g, ' ').match(/such as "([^"]+)"/)![1];
    expect(note).toBe(sanitizeWorkshopReplyForRetention(`<${WORKSHOP_REACTION_TAG}>heart</${WORKSHOP_REACTION_TAG}>`));
    expect(PROMPT.replace(/\s+/g, ' ')).toContain('Always write the trailer, never the note');
  });

  it('states the permission\'s rules and the trailer\'s place', () => {
    const prose = PROMPT.replace(/\s+/g, ' ');
    expect(prose).toContain('It is a permission, not a duty.');
    expect(prose).toContain('React rarely');
    expect(prose).toContain("Don't react to every message");
    expect(prose).toContain('At most one reaction a reply');
    expect(prose).toContain('only when the writer\'s message asks for nothing');
    expect(prose).toContain('at the very end of your reply, after everything else, including a `### Try a widget` section');
  });
});

describe('persona-reaction prompt ↔ the setting (Q8)', () => {
  const persona = getWorkshopPersona('jill')!;
  const behavior = { interactionMode: 'creative-collaborator', expressionLevel: 'subtle', relationalDepth: 'attuned' } as const;

  it.each([WORKSHOP_HOST_BASE_PROMPT_PATH, WORKSHOP_GUEST_BASE_PROMPT_PATH])('%s: taught after reactions.md only while on', (base) => {
    const on = workshopPersonaSystemPromptPaths(base, persona, behavior as never, { personaReactions: true });
    expect(on.indexOf(WORKSHOP_PERSONA_REACTIONS_PROMPT_PATH)).toBe(on.indexOf(WORKSHOP_REACTIONS_PROMPT_PATH) + 1);
    const off = workshopPersonaSystemPromptPaths(base, persona, behavior as never, {});
    expect(off).toContain(WORKSHOP_REACTIONS_PROMPT_PATH);
    expect(off).not.toContain(WORKSHOP_PERSONA_REACTIONS_PROMPT_PATH);
  });
});

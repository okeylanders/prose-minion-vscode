/**
 * Guard the persona-reaction prompt (ADR 2026-11-07 D1, D5, Q8) against
 * drift from the code it teaches:
 *
 * - its vocabulary is the registry's, by id and gloss, in order, grouped by
 *   tone, and it never writes a glyph;
 * - its worked example is a trailer the production extractor keeps, placed
 *   last as the prose says;
 * - it states the invitation's rules (the moments, never two replies running
 *   by habit, at most one, a reaction alone only when nothing is asked) and
 *   the trailer's place, and no longer says "rarely" (Slice 4a, 2026-11-10);
 * - its worked examples are trailers the extractor keeps, and its no-reaction
 *   example carries none;
 * - `reactions.md` tells the persona to let a reaction shape its reply, never
 *   to stay silent about it, with its rules kept;
 * - each expression level teaches its own frequency, right after it;
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
  WORKSHOP_REACTION_FREQUENCY_PROMPT_PATHS,
  WORKSHOP_REACTIONS_PROMPT_PATH,
  workshopPersonaSystemPromptPaths
} from '@shared/constants/workshopPersonas';

const read = (promptPath: string): string => fs.readFileSync(path.resolve(__dirname,
  '../../../resources/system-prompts', promptPath), 'utf8');
const PROMPT = read(WORKSHOP_PERSONA_REACTIONS_PROMPT_PATH);
const READING = read(WORKSHOP_REACTIONS_PROMPT_PATH);
const prose = (text: string): string => text.replace(/\s+/g, ' ');
const controlsOf = (reply: string) => extractWorkshopReplyControls(reply, {
  memoryOpen: false,
  reactions: { open: true, hasTarget: true }
});

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
    const controls = controlsOf(`Alice follows the rabbit.\n\n${example}`);
    expect(controls.reaction).toEqual({ reaction: 'mind-blown', rejections: [] });
    expect(controls.rest).toBe('Alice follows the rabbit.');
  });

  it('quotes the note history shows exactly as retention writes it (PR #247 L3)', () => {
    const note = PROMPT.replace(/\s+/g, ' ').match(/such as "([^"]+)"/)![1];
    expect(note).toBe(sanitizeWorkshopReplyForRetention(`<${WORKSHOP_REACTION_TAG}>heart</${WORKSHOP_REACTION_TAG}>`));
    expect(PROMPT.replace(/\s+/g, ' ')).toContain('Always write the trailer, never the note');
  });

  it('states the invitation\'s rules and the trailer\'s place (Slice 4a)', () => {
    const text = prose(PROMPT);
    expect(text).toContain('It is an invitation, not a quota');
    expect(text).not.toMatch(/\brarely\b/);
    expect(text).not.toContain('most replies carry no reaction');
    for (const moment of ['A line or choice that works', 'A breakthrough or a win', 'A hard or moving scene', 'A joke that lands']) {
      expect(text).toContain(moment);
    }
    expect(text).toContain("Don't react on two replies running out of habit");
    expect(text).toContain('How often is set by your expression level');
    expect(text).toContain('At most one reaction a reply');
    expect(text).toContain('only when the writer\'s message asks for nothing');
    expect(text).toContain("don't mention the reaction in your prose");
    expect(text).toContain('at the very end of your reply, after everything else, including a `### Try a widget` section');
  });

  it('every reaction its "when to react" moments name is in the registry', () => {
    const section = PROMPT.slice(PROMPT.indexOf('### When to react'), PROMPT.indexOf('### The trailer'));
    const named = [...section.matchAll(/`([a-z-]+)`/g)].map(([, id]) => id);
    expect(named.length).toBeGreaterThan(0);
    for (const id of named) {
      expect(WORKSHOP_REACTIONS.map((reaction) => reaction.id)).toContain(id);
    }
  });
});

describe('persona-reaction prompt\'s worked examples (Slice 4a)', () => {
  const examples = [...PROMPT.matchAll(/```text\n([\s\S]*?)```/g)].map(([, body]) => body);
  const replyOf = (example: string): string => example.split(/\n(?:Reply ends|Whole reply): /)[1];

  it('has three examples with a reaction and one without, each a writer message and a reply', () => {
    expect(examples).toHaveLength(4);
    for (const example of examples) {
      expect(example).toMatch(/^Writer: .+\n(?:Reply ends|Whole reply): /);
    }
  });

  it('each trailer is one the extractor keeps, and its prose never names the reaction', () => {
    const expected = ['fire', 'party', 'thumbs-up', undefined];
    examples.forEach((example, index) => {
      const controls = controlsOf(replyOf(example));
      expect(controls.reaction?.reaction).toBe(expected[index]);
      expect(controls.reaction?.rejections ?? []).toEqual([]);
      expect(controls.rest).not.toContain(WORKSHOP_REACTION_TAG);
      if (expected[index]) {
        expect(controls.rest.toLowerCase()).not.toContain(expected[index]!.replace('-', ' '));
      }
    });
  });

  it('the reaction-alone example answers a message that asks for nothing', () => {
    const alone = examples.find((example) => example.includes('Whole reply: '))!;
    expect(alone).toMatch(/^Writer: Got it, thanks\./);
    expect(controlsOf(replyOf(alone)).rest).toBe('');
  });
});

describe('reactions.md: how to read the writer\'s reactions (Slice 4a)', () => {
  const text = prose(READING);

  it('lets a reaction shape the reply, and no longer says to leave it unanswered', () => {
    expect(text).toContain('Let it shape your reply');
    expect(text).not.toContain("Don't answer it unless it changes what you'd say");
    expect(text).toContain('deserves a brief, natural check-in or adjustment');
    expect(text).toContain('may get a light nod when it fits the flow');
  });

  it('names the curious and negative reactions that call for a check-in by their registry ids', () => {
    for (const id of ['thinking', 'confused', 'thumbs-down', 'grimace', 'eye-roll', 'frustrated', 'sad', 'surprised']) {
      expect(text).toContain(`\`${id}\``);
      expect(WORKSHOP_REACTIONS.map((reaction) => reaction.id)).toContain(id);
    }
  });

  it('keeps its rules: never thank or list back, words outrank a reaction, depth governs how far to read', () => {
    expect(text).toContain('Never thank the writer for a reaction, and never list the reactions back.');
    expect(text).toContain("the writer's words outrank any reaction");
    for (const depth of ['**Reserved:** take a reaction at face value', '**Attuned:** you may infer from it, lightly', '**Reflective:** where its meaning matters to the work, you may ask about it once']) {
      expect(text).toContain(depth);
    }
  });
});

describe('reaction frequency by expression level (Slice 4a, superseding Q7)', () => {
  it.each([
    ['subtle', 'about one reply in six'],
    ['full', 'about one reply in four'],
    ['amplified', 'about one reply in three']
  ] as const)('%s: %s, never every reply, at most once a reply', (level, rate) => {
    const text = prose(read(WORKSHOP_REACTION_FREQUENCY_PROMPT_PATHS[level]));
    expect(text).toContain(rate);
    expect(text).toMatch(/never react on every reply/i);
    expect(text).toContain('never more than once a reply');
    for (const { glyph } of WORKSHOP_REACTIONS) {
      expect(text).not.toContain(glyph);
    }
  });

  it('subtle keeps warm reactions for moments that clearly earn them', () => {
    expect(prose(read(WORKSHOP_REACTION_FREQUENCY_PROMPT_PATHS.subtle))).toContain('Keep warm reactions for moments that clearly earn them');
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

  const levels = ['subtle', 'full', 'amplified'] as const;
  it.each(levels.flatMap((level) => [WORKSHOP_HOST_BASE_PROMPT_PATH, WORKSHOP_GUEST_BASE_PROMPT_PATH].map((base) => [level, base] as const)))(
    '%s on %s: its own frequency, right after persona-reactions.md, only while on', (level, base) => {
      const leveled = { ...behavior, expressionLevel: level };
      const on = workshopPersonaSystemPromptPaths(base, persona, leveled as never, { personaReactions: true });
      expect(on.indexOf(WORKSHOP_REACTION_FREQUENCY_PROMPT_PATHS[level])).toBe(on.indexOf(WORKSHOP_PERSONA_REACTIONS_PROMPT_PATH) + 1);
      for (const other of levels.filter((candidate) => candidate !== level)) {
        expect(on).not.toContain(WORKSHOP_REACTION_FREQUENCY_PROMPT_PATHS[other]);
      }
      const off = workshopPersonaSystemPromptPaths(base, persona, leveled as never, {});
      for (const any of Object.values(WORKSHOP_REACTION_FREQUENCY_PROMPT_PATHS)) {
        expect(off).not.toContain(any);
      }
    });

  it('a tool prompt never learns a frequency', () => {
    const tool = workshopPersonaSystemPromptPaths('workshop-tools/prose.md', persona, behavior as never, { personaReactions: true });
    for (const any of Object.values(WORKSHOP_REACTION_FREQUENCY_PROMPT_PATHS)) {
      expect(tool).not.toContain(any);
    }
  });
});

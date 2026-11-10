/**
 * The closed reaction vocabulary (ADR 2026-11-07 D1) and the one rule for
 * what may be reacted to (D2, Q4, Q10).
 */

import type { WorkshopTurn } from '@messages';
import {
  isWorkshopReactableTurn,
  isWorkshopReactionId,
  WORKSHOP_REACTIONS,
  WORKSHOP_REACTION_TONES,
  workshopReaction
} from '@shared/constants/workshopReactions';

describe('WORKSHOP_REACTIONS (ADR 2026-11-07 D1)', () => {
  it('pins the 19 ids, their order, glyphs and tones', () => {
    expect(WORKSHOP_REACTIONS.map(({ id, glyph, tone }) => [id, glyph, tone])).toEqual([
      ['heart', '❤️', 'warm'],
      ['thumbs-up', '\u{1F44D}', 'warm'],
      ['raised-hands', '\u{1F64C}', 'warm'],
      ['party', '\u{1F389}', 'warm'],
      ['fire', '\u{1F525}', 'warm'],
      ['mind-blown', '\u{1F92F}', 'warm'],
      ['laughing', '\u{1F602}', 'warm'],
      ['sparkles', '✨', 'warm'],
      ['hundred', '\u{1F4AF}', 'warm'],
      ['thanks', '\u{1F64F}', 'warm'],
      ['thinking', '\u{1F914}', 'curious'],
      ['eyes', '\u{1F440}', 'curious'],
      ['surprised', '\u{1F62E}', 'curious'],
      ['thumbs-down', '\u{1F44E}', 'negative'],
      ['sad', '\u{1F622}', 'negative'],
      ['grimace', '\u{1F62C}', 'negative'],
      ['confused', '\u{1F615}', 'negative'],
      ['eye-roll', '\u{1F644}', 'negative'],
      ['frustrated', '\u{1F624}', 'negative']
    ]);
  });

  it('writes the heart with its variation selector', () => {
    expect(Array.from(workshopReaction('heart').glyph).map((point) => point.codePointAt(0)))
      .toEqual([0x2764, 0xfe0f]);
  });

  it('uses lower-case kebab ASCII ids, each once, with a label and a gloss', () => {
    const ids = WORKSHOP_REACTIONS.map((reaction) => reaction.id);
    expect(new Set(ids).size).toBe(19);
    for (const reaction of WORKSHOP_REACTIONS) {
      expect(reaction.id).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
      expect(reaction.label.length).toBeGreaterThan(0);
      expect(reaction.meaning.length).toBeGreaterThan(0);
    }
    expect(workshopReaction('raised-hands').meaning).toBe('celebrate this');
  });

  it('groups the palette warm, curious, negative', () => {
    expect(WORKSHOP_REACTION_TONES.map((group) => group.tone)).toEqual(['warm', 'curious', 'negative']);
  });

  it('knows its ids and nothing else, never a glyph', () => {
    expect(isWorkshopReactionId('mind-blown')).toBe(true);
    expect(isWorkshopReactionId('Mind-Blown')).toBe(false);
    expect(isWorkshopReactionId('\u{1F92F}')).toBe(false);
    expect(isWorkshopReactionId('clapping')).toBe(false);
    expect(isWorkshopReactionId(undefined)).toBe(false);
  });
});

const turn = (facts: Partial<WorkshopTurn>): WorkshopTurn => ({
  id: 'turn-1',
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  excerptVersion: 1,
  content: 'Alice looked down the rabbit hole.',
  timestamp: 1,
  ...facts
});

const WRITER = { kind: 'writer' } as const;
const HOST = { kind: 'host' } as const;
const GUEST = { kind: 'personaGuest', personaId: 'margot' } as const;

describe('isWorkshopReactableTurn (ADR 2026-11-07 D2, Q4)', () => {
  it('lets the writer react to host and guest replies, a synthesis included', () => {
    expect(isWorkshopReactableTurn(turn({}), WRITER)).toBe(true);
    expect(isWorkshopReactableTurn(turn({ participant: 'guest', personaId: 'margot' }), WRITER)).toBe(true);
    expect(isWorkshopReactableTurn(turn({ kind: 'tool_run', artifact: 'persona_synthesis' }), WRITER)).toBe(true);
  });

  it.each([
    ['a tool report', { participant: 'tool', kind: 'tool_run', artifact: 'tool_report' }],
    ['a direct tool answer', { participant: 'tool', artifact: 'direct_tool_response' }],
    ['a capability card', { participant: 'tool', kind: 'tool_run', artifact: 'resource_read' }],
    ['a divider', { role: 'system', kind: 'divider', participant: 'session', artifact: 'session_resume' }],
    ['a context change', { role: 'system', kind: 'divider', participant: 'session', artifact: 'context_change' }],
    ['their own message', { role: 'user', participant: 'writer' }]
  ] as const)('refuses the writer %s', (_name, facts) => {
    expect(isWorkshopReactableTurn(turn(facts as Partial<WorkshopTurn>), WRITER)).toBe(false);
  });

  it('lets a persona react only to the writer\'s room message', () => {
    const writerMessage = turn({ role: 'user', participant: 'writer' });
    expect(isWorkshopReactableTurn(writerMessage, HOST)).toBe(true);
    expect(isWorkshopReactableTurn(writerMessage, GUEST)).toBe(true);
    expect(isWorkshopReactableTurn(turn({}), HOST)).toBe(false);
    expect(isWorkshopReactableTurn(turn({ role: 'user', participant: 'writer', artifact: 'direct_tool_message' }), HOST))
      .toBe(false);
  });
});

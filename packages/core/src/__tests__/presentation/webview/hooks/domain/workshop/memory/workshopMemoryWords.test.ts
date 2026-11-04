/** The Memory tab's and manager's shared words (Slice 4b-ui). */

import {
  aboutTokens,
  memoryDay,
  memoryOriginWords,
  memorySourceWords,
  quotedList,
  unreadableReasonSentence,
  unreadableReasonWords
} from '@hooks/domain/workshop/memory/workshopMemoryWords';

describe('workshopMemoryWords', () => {
  it('rounds “about” figures to tens under a thousand and hundreds above, an over-budget figure up', () => {
    expect([0, 4, 698, 1_104, 4_410, 5_000].map((value) => aboutTokens(value))).toEqual(['0', '10', '700', '1,100', '4,400', '5,000']);
    expect(aboutTokens(5_001, true)).toBe('5,100');
    expect(aboutTokens(5_001)).toBe('5,000');
  });

  it('says origin and source in words, never a persona id or "made in the manager" for an unknown source', () => {
    expect(memoryOriginWords('writer', undefined)).toBe('written by you');
    expect(memoryOriginWords('proposed', 'Jill')).toBe('suggested by Jill · saved by you');
    expect(memoryOriginWords('auto', 'Jill')).toBe('saved by Jill');
    expect(memoryOriginWords('auto', '  ')).toBe('saved by a persona');
    expect(memorySourceWords({ kind: 'session', title: 'Tea-party pacing' })).toBe('from “Tea-party pacing”');
    expect(memorySourceWords({ kind: 'unnamed' })).toBe('from a conversation that isn’t saved');
    expect(memorySourceWords({ kind: 'none' })).toBe('no source conversation');
  });

  it('dates a memory by its UTC day, and joins quoted titles', () => {
    expect(memoryDay('2026-11-03T23:59:00Z')).toBe('Nov 3');
    expect(memoryDay('not a date')).toBe('unknown date');
    expect(quotedList(['A'])).toBe('“A”');
    expect(quotedList(['A', 'B', 'C'])).toBe('“A”, “B” and “C”');
  });

  it('says every codec reason in words, and an unknown one plainly', () => {
    const reasons = [
      'no-frontmatter', 'unclosed-frontmatter', 'malformed-line', 'unknown-key', 'duplicate-key', 'missing-key',
      'unsupported-format', 'invalid-value', 'too-long', 'proposal-without-provenance', 'turns-without-session',
      'updated-before-created', 'supersedes-itself', 'too-large', 'not-text', 'read-failed'
    ];
    const words = reasons.map((reason) => unreadableReasonWords(reason, undefined));
    expect(new Set(words).size).toBe(reasons.length);
    expect(words).not.toContain('it doesn’t read as a memory file');
    expect(unreadableReasonWords('something-new', undefined)).toBe('it doesn’t read as a memory file');
    expect(unreadableReasonWords('missing-key', 'title')).toBe('“title” is missing or empty');
    expect(unreadableReasonWords('invalid-value', 'kind', true)).toBe('“kind” isn’t one Memory knows');
    expect(unreadableReasonSentence('unclosed-frontmatter', undefined)).toBe('No closing --- line.');
  });
});

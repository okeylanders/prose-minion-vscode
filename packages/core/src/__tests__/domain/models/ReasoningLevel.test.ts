/**
 * Reasoning levels (ADR 2026-10-21, Amendment 2026-10-27): four named
 * levels, a setting's value read as one, and each pass's default.
 */
import { REASONING_LEVELS, isReasoningLevel, reasoningLevelOf } from '@/domain/models/ReasoningLevel';
import { DRAFT_EDIT_PASS_POLICIES } from '@/domain/models/DraftEdit';

describe('reasoning levels', () => {
  it('are off, light, standard and deep, in that order', () => {
    expect(REASONING_LEVELS).toEqual(['off', 'light', 'standard', 'deep']);
  });

  it('read a setting\'s value as a level, and anything else as the fallback', () => {
    for (const level of REASONING_LEVELS) {
      expect(isReasoningLevel(level)).toBe(true);
      expect(reasoningLevelOf(level, 'deep')).toBe(level);
    }
    for (const value of [undefined, null, '', 'Light', 'high', 'none', 2, ['light'], { level: 'light' }, 'constructor']) {
      expect(isReasoningLevel(value)).toBe(false);
      expect(reasoningLevelOf(value, 'standard')).toBe('standard');
    }
  });

  it('default to light for Proofread and standard for Craft Flags (the writer\'s choice, 2026-10-27)', () => {
    expect(DRAFT_EDIT_PASS_POLICIES.proofread.reasoning).toBe('light');
    expect(DRAFT_EDIT_PASS_POLICIES.craft.reasoning).toBe('standard');
  });
});

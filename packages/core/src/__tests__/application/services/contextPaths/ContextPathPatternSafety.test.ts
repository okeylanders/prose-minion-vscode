/**
 * Unsafe proposed patterns are refused before any normalization (ADR
 * 2026-11-19 D22): each form by its reason, positionally capped, repeats
 * refused. *Alice*.
 */
import {
  contextPathPatternRefusal,
  contextPathSettingPatterns,
  triageContextPathPatterns
} from '@/application/services/contextPaths/ContextPathPatternSafety';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

describe('contextPathPatternRefusal', () => {
  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['{Cast,People}/**', 'comma'],
    ['Cast/**/*,Wonderland/**/*', 'comma'],
    ['/Cast/**/*', 'absolute'],
    ['\\Cast\\**', 'absolute'],
    ['C:/Users/Alice/Cast/**', 'drive'],
    ['c:Cast', 'drive'],
    ['~/Cast/**', 'home'],
    ['workspace:Cast/**', 'workspace-prefix'],
    ['WORKSPACE:Cast/**', 'workspace-prefix'],
    ['Cast\\Royals/**', 'backslash'],
    ['../Cast/**', 'parent-segment'],
    ['Cast/../../Wonderland/**', 'parent-segment'],
    ['Cast/..', 'parent-segment'],
    ['Cast/\u0000/**', 'control-character'],
    ['Cast\n/**', 'control-character'],
    ['Cast\u2028/**', 'control-character'],
    ['Cast\u0085/**', 'control-character'],
    [`Cast/${'a'.repeat(PROMPT_BUDGETS.contextPaths.patternCharacters)}`, 'too-long']
  ])('refuses %j as %s', (pattern, reason) => {
    expect(contextPathPatternRefusal(pattern)).toBe(reason);
  });

  it.each([
    'Cast/**/*',
    './Cast/**/*',
    'Book 1/Chapters/**/*',
    'synopsis.md',
    '**/story-bible.md',
    'Cast/..Royals/*',
    'Cast/[A-M]*.md',
    'a'.repeat(PROMPT_BUDGETS.contextPaths.patternCharacters)
  ])('allows %j', (pattern) => {
    expect(contextPathPatternRefusal(pattern)).toBeUndefined();
  });
});

describe('triageContextPathPatterns', () => {
  it('keeps safe patterns trimmed, once each, and refuses the rest by reason', () => {
    expect(triageContextPathPatterns([' Cast/**/* ', '/Cast/**', 'Cast/**/*', 'Wonderland/**/*'])).toEqual({
      safe: ['Cast/**/*', 'Wonderland/**/*'],
      refused: [{ pattern: '/Cast/**', reason: 'absolute' }, { pattern: 'Cast/**/*', reason: 'duplicate' }]
    });
  });

  it('refuses every entry past the cap as over-cap', () => {
    const patterns = Array.from({ length: PROMPT_BUDGETS.contextPaths.patternsPerGroup + 2 }, (_, index) => `Cast${index}/**/*`);
    const triaged = triageContextPathPatterns(patterns);
    expect(triaged.safe).toHaveLength(PROMPT_BUDGETS.contextPaths.patternsPerGroup);
    expect(triaged.refused.map((entry) => entry.reason)).toEqual(['over-cap', 'over-cap']);
  });
});

describe('contextPathSettingPatterns', () => {
  it('reads a setting as the resolver does', () => {
    expect(contextPathSettingPatterns(' Cast/**/* ,, Wonderland/**/*,')).toEqual(['Cast/**/*', 'Wonderland/**/*']);
    expect(contextPathSettingPatterns(undefined)).toEqual([]);
  });
});

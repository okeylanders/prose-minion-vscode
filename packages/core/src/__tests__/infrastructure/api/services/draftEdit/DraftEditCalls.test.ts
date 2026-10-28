/**
 * Why a Draft Edit reply that reached its ceiling is rejected (ADR
 * 2026-10-21, Amendment 2026-10-27: reasoning levels), and the thinking a
 * run's calls reported.
 */
import { draftEditCeilingRejection, reportedThinking } from '@services/draftEdit/DraftEditCalls';

const usage = (completionTokens: number) => ({ promptTokens: 100, completionTokens, totalTokens: 100 + completionTokens });
const SETTING = 'proseMinion.proofread.reasoning';

describe('draftEditCeilingRejection', () => {
  it('says the model spent the ceiling thinking when more than half its output was reasoning', () => {
    expect(draftEditCeilingRejection({ usage: usage(4_000), reasoningTokens: 3_700 }, 4_000, SETTING)).toBe(
      'the model spent 3,700 of 4,000 output tokens thinking and reached the 4,000-token ceiling; '
      + 'lower proseMinion.proofread.reasoning or choose another model'
    );
  });

  it('names the ceiling alone at half or less, or when the provider reported no reasoning or no usage', () => {
    const plain = 'the reply reached the 5,024-token output ceiling';
    expect(draftEditCeilingRejection({ usage: usage(4_000), reasoningTokens: 2_000 }, 5_024, SETTING)).toBe(plain);
    expect(draftEditCeilingRejection({ usage: usage(4_000) }, 5_024, SETTING)).toBe(plain);
    expect(draftEditCeilingRejection({ reasoningTokens: 3_700 }, 5_024, SETTING)).toBe(plain);
  });
});

describe('reportedThinking', () => {
  it('sums what the calls reported, and is undefined when none reported any', () => {
    expect(reportedThinking([{ reasoningTokens: 300 }, {}, { reasoningTokens: 0 }, { reasoningTokens: 120 }])).toBe(420);
    expect(reportedThinking([{}, {}])).toBeUndefined();
    expect(reportedThinking([])).toBeUndefined();
  });
});

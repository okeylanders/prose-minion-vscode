import type { WorkshopCreativeVariationCard } from '@messages';
import {
  CREATIVE_VARIATIONS_HIGH_OVERLAP_SCORE,
  CreativeVariationsExactDuplicateError,
  computeCreativeVariationsTextualOverlap,
  tokenizeCreativeVariationText
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsDistinctness';

const card = (
  position: number,
  prose: string,
  direction: string
): WorkshopCreativeVariationCard => ({
  position,
  approach: `Approach ${position}`,
  direction,
  prose,
  tradeoff: { gain: 'A gain.', cost: 'A cost.' },
  invariantFlags: []
});

describe('textual-overlap-v2', () => {
  it('normalizes NFKC, apostrophe variants, dash punctuation, case, and tokens exactly', () => {
    expect(tokenizeCreativeVariationText('ＦＯＸ’S—Turn 42')).toEqual([
      'fox',
      's',
      'turn',
      '42'
    ]);
  });

  it('discounts subject trigrams and scores direction bigrams independently', () => {
    const overlap = computeCreativeVariationsTextualOverlap('the rain hit glass', [
      card(1, 'the rain hit glass blue fire rises', 'turn toward fire'),
      card(2, 'the rain hit glass blue fire falls', 'turn toward ash')
    ]);

    expect(overlap).toEqual({
      algorithmVersion: 'textual-overlap-v2',
      pairs: [{
        leftPosition: 1,
        rightPosition: 2,
        prose: 64,
        direction: 33,
        maximum: 64
      }],
      maximumPair: { leftPosition: 1, rightPosition: 2, score: 64 }
    });
  });

  it('falls back to unadjusted prose sets when either residual set is empty', () => {
    const overlap = computeCreativeVariationsTextualOverlap('the rain hit glass', [
      card(1, 'the rain hit glass', 'hold the silence'),
      card(2, 'the rain hit glass now', 'break the silence')
    ]);
    expect(overlap.pairs[0].prose).toBe(64);
  });

  it('falls back when one distinguishing trigram would make near-identical takes score zero', () => {
    const subject = 'She stood at the window and counted the ships until the light failed';
    const overlap = computeCreativeVariationsTextualOverlap(subject, [
      card(1, `${subject}, again.`, 'repeat the vigil once'),
      card(2, `${subject}, always.`, 'make the vigil habitual')
    ]);

    expect(overlap.pairs[0].prose).toBeGreaterThanOrEqual(
      CREATIVE_VARIATIONS_HIGH_OVERLAP_SCORE
    );
  });

  it('emits every canonical unordered pair and keeps the first maximum on ties', () => {
    const overlap = computeCreativeVariationsTextualOverlap('', [
      card(1, 'red fox waits', 'wait here'),
      card(2, 'blue bird turns', 'turn there'),
      card(3, 'green wolf leaves', 'leave now'),
      card(4, 'gold hare returns', 'return home')
    ]);
    expect(overlap.pairs.map((pair) => [pair.leftPosition, pair.rightPosition])).toEqual([
      [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]
    ]);
    expect(overlap.maximumPair).toEqual({ leftPosition: 1, rightPosition: 2, score: 0 });
  });

  it('rejects normalized duplicate prose before producing evidence', () => {
    expect(() => computeCreativeVariationsTextualOverlap('', [
      card(1, 'The fox—waits.', 'wait here'),
      card(2, 'ＴＨＥ FOX-waits', 'wait elsewhere')
    ])).toThrow(CreativeVariationsExactDuplicateError);
  });

  it('keeps high non-identical overlap as evidence instead of rejecting a card', () => {
    const common = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen';
    const overlap = computeCreativeVariationsTextualOverlap('', [
      card(1, `${common} sunrise`, 'hold this exact quiet line'),
      card(2, `${common} moonrise`, 'hold this exact quiet beat')
    ]);
    expect(overlap.pairs[0].maximum).toBeGreaterThanOrEqual(
      CREATIVE_VARIATIONS_HIGH_OVERLAP_SCORE
    );
  });

  it('freezes the Slice 3 high-overlap presentation threshold', () => {
    expect(CREATIVE_VARIATIONS_HIGH_OVERLAP_SCORE).toBe(80);
  });
});

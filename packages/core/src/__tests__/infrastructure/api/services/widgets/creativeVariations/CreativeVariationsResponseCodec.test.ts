import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  CREATIVE_VARIATIONS_RESPONSE_END,
  CREATIVE_VARIATIONS_RESPONSE_START,
  decodeCreativeVariationsResponse
} from '@services/widgets/creativeVariations/CreativeVariationsResponseCodec';

const WORKUP_ID = 'cvw-00000000-0000-4000-8000-000000000001';
const context = {
  workupId: WORKUP_ID,
  subjectText: 'Mara folded the letter before she answered.',
  invariants: {
    mustSurvive: 'Mara delays her answer.',
    mustNotChange: 'Mara does not reveal her decision.'
  },
  requestedCount: 3 as const
};

const cards = (count = 3) => Array.from({ length: count }, (_, index) => index + 1)
  .map((position) => ({
  position,
  approach: `Approach ${position}`,
  direction: `Use a distinct direction number ${position}.`,
  prose: `Mara makes distinct choice number ${position} before answering the question.`,
  tradeoff: { gain: `Gain ${position}`, cost: `Cost ${position}` },
  invariantFlags: position === 1 ? [{
    invariantField: 'must-survive',
    kind: 'advisory-risk',
    note: 'The delay could become too subtle.'
  }] : []
}));

const framed = (body: unknown = { version: 1, cards: cards() }): string => [
  CREATIVE_VARIATIONS_RESPONSE_START,
  JSON.stringify(body),
  CREATIVE_VARIATIONS_RESPONSE_END
].join('\n');

describe('CreativeVariationsResponseCodec', () => {
  it('settles exact cards with host-derived ids and deterministic overlap', () => {
    const workup = decodeCreativeVariationsResponse(framed(), context);
    expect(workup.workupId).toBe(WORKUP_ID);
    expect(workup.cards).toHaveLength(3);
    expect(workup.cards[0].invariantFlags[0].id)
      .toBe(`${WORKUP_ID}:card-1:flag-1`);
    expect(workup.overlap.algorithmVersion).toBe('textual-overlap-v1');
    expect(workup.overlap.pairs).toHaveLength(3);
  });

  it.each([4, 5] as const)('accepts an exact %i-card response', (requestedCount) => {
    const workup = decodeCreativeVariationsResponse(
      framed({ version: 1, cards: cards(requestedCount) }),
      { ...context, requestedCount }
    );
    expect(workup.cards).toHaveLength(requestedCount);
    expect(workup.overlap.pairs).toHaveLength(requestedCount * (requestedCount - 1) / 2);
  });

  it.each([
    ['opening sentinel', `preface\n${framed()}`, /opening sentinel.*first line/i],
    ['closing sentinel', `${framed()}\nafter`, /closing sentinel.*final line/i],
    ['unknown root field', framed({ version: 1, cards: cards(), score: 2 }), /unknown field score/],
    ['wrong version', framed({ version: 2, cards: cards() }), /response.version.*1/],
    ['wrong count', framed({ version: 1, cards: cards().slice(0, 2) }), /exactly 3 cards/],
    ['gapped position', framed({
      version: 1,
      cards: cards().map((value, index) => index === 1 ? { ...value, position: 3 } : value)
    }), /contiguous position 2/],
    ['model id', framed({
      version: 1,
      cards: cards().map((value, index) => index === 0
        ? { ...value, invariantFlags: [{ ...value.invariantFlags[0], id: 'model-id' }] }
        : value)
    }), /unknown field id/],
    ['blank direction', framed({
      version: 1,
      cards: cards().map((value, index) => index === 0 ? { ...value, direction: '—' } : value)
    }), /direction.*letter or number/i],
    ['hard conflict against must-survive', framed({
      version: 1,
      cards: cards().map((value, index) => index === 0 ? {
        ...value,
        invariantFlags: [{
          invariantField: 'must-survive',
          kind: 'hard-conflict',
          note: 'It breaks.'
        }]
      } : value)
    }), /hard-conflict only against must-not-change/],
    ['duplicate prose', framed({
      version: 1,
      cards: cards().map((value, index, values) => index === 1
        ? { ...value, prose: values[0].prose.toLocaleUpperCase('en-US') }
        : value)
    }), /identical normalized prose/]
  ])('rejects %s', (_label, response, expected) => {
    expect(() => decodeCreativeVariationsResponse(response as string, context)).toThrow(expected);
  });

  it('enforces the complete response-character ceiling before parsing', () => {
    expect(() => decodeCreativeVariationsResponse(
      'x'.repeat(PROMPT_BUDGETS.workshopWidgets.creativeResponseCharacters + 1),
      context
    )).toThrow(/response exceeds 160000 characters/);
  });

  it.each([
    ['approach', 'approach', PROMPT_BUDGETS.workshopWidgets.creativeApproachCharacters],
    ['direction', 'direction', PROMPT_BUDGETS.workshopWidgets.creativeDirectionCharacters],
    ['prose', 'prose', PROMPT_BUDGETS.workshopWidgets.creativeProseCharacters]
  ] as const)('rejects a one-over-budget %s', (_label, field, maximum) => {
    const values = cards();
    values[0] = { ...values[0], [field]: 'x'.repeat(maximum + 1) };
    expect(() => decodeCreativeVariationsResponse(
      framed({ version: 1, cards: values }),
      context
    )).toThrow(new RegExp(`${field}.*at most ${maximum} characters`));
  });

  it('rejects one-over tradeoff, flag-count, and flag-note bounds', () => {
    const tradeoff = cards();
    tradeoff[0].tradeoff.gain = 'x'.repeat(
      PROMPT_BUDGETS.workshopWidgets.creativeTradeoffCharacters + 1
    );
    expect(() => decodeCreativeVariationsResponse(
      framed({ version: 1, cards: tradeoff }), context
    )).toThrow(/tradeoff.gain.*at most 400 characters/);

    const flags = cards();
    flags[0].invariantFlags = Array.from(
      { length: PROMPT_BUDGETS.workshopWidgets.creativeFlagsPerCard + 1 },
      () => ({
        invariantField: 'must-survive',
        kind: 'advisory-risk',
        note: 'A real risk.'
      })
    );
    expect(() => decodeCreativeVariationsResponse(
      framed({ version: 1, cards: flags }), context
    )).toThrow(/at most 8 invariant flags/);

    const note = cards();
    note[0].invariantFlags[0].note = 'x'.repeat(
      PROMPT_BUDGETS.workshopWidgets.creativeFlagNoteCharacters + 1
    );
    expect(() => decodeCreativeVariationsResponse(
      framed({ version: 1, cards: note }), context
    )).toThrow(/invariantFlags\[0\].note.*at most 400 characters/);
  });
});

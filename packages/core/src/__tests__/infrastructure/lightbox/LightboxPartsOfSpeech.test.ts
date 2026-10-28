/**
 * Parts of speech on the board (PR #148 F-03): each POS item's count, its
 * exact paragraphs, the ribbon columns it lights and the inspector's claim
 * all come from the same tagged occurrences, keyed by word and part of
 * speech. Built by the real LightboxService and measurement services; read
 * through the real item resolver, inspector view model and ribbon focus.
 */

import { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import { WordFrequency } from '@/tools/measure/wordFrequency';
import type { LightboxBoard } from '@messages';
import type { LightboxPartOfSpeech } from '@hooks/domain/lightbox/lightboxItems';
import { buildLightboxInspectorView } from '@hooks/domain/lightbox/controllers/useLightboxInspector';
import { lightboxLitColumns } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { ALICE_OPENING_CURLY } from '@/__tests__/infrastructure/lightbox/lightboxProseFixtures';

async function boardOf(text: string): Promise<LightboxBoard> {
  const service = new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    { enrichWithStandards: async (stats: object) => stats }
  );
  const result = await service.buildBoard({ kind: 'selection', text, displayPath: 'fixture.md' });
  if (result.kind !== 'board') {
    throw new Error(`expected a board, got ${result.kind}`);
  }
  return result.board;
}

/** Everything the writer sees for one tagged word: count, places, lit columns, claim. */
function evidence(board: LightboxBoard, pos: LightboxPartOfSpeech, word: string) {
  const term = board.measured.partsOfSpeech[pos].find((candidate) => candidate.term === word);
  const view = buildLightboxInspectorView(board, { kind: 'pos', pos, word });
  return {
    count: term?.count,
    paragraphs: term?.paragraphs,
    inspectorParagraphs: view?.paragraphs,
    litColumns: lightboxLitColumns(board.ribbon, view?.paragraphs ?? []),
    claim: view?.claim
  };
}

describe('Lightbox parts of speech (PR #148 F-03)', () => {
  it('places the noun and the verb of a homograph only in their own paragraphs', async () => {
    const board = await boardOf('A light shines.\n\nI light the lamp.');

    expect(evidence(board, 'nouns', 'light')).toEqual({
      count: 1,
      paragraphs: [1],
      inspectorParagraphs: [1],
      litColumns: [true, false],
      claim: 'Appears once across 1 paragraph. Counted by code; nothing here is a reading.'
    });
    expect(evidence(board, 'verbs', 'light')).toEqual({
      count: 1,
      paragraphs: [2],
      inspectorParagraphs: [2],
      litColumns: [false, true],
      claim: 'Appears once across 1 paragraph. Counted by code; nothing here is a reading.'
    });
  });

  it.each([
    ['straight', 'Alice\'s hat.'],
    ['curly', 'Alice’s hat.']
  ])('places a name the tagger counted in a %s possessive', async (_label, text) => {
    const board = await boardOf(text);

    expect(evidence(board, 'nouns', 'alice')).toEqual({
      count: 1,
      paragraphs: [1],
      inspectorParagraphs: [1],
      litColumns: [true],
      claim: 'Appears once across 1 paragraph. Counted by code; nothing here is a reading.'
    });
  });

  it('pools both possessive spellings of one name across their paragraphs', async () => {
    const board = await boardOf('Alice\'s hat.\n\nA cat sat.\n\nAlice’s hat.');

    expect(evidence(board, 'nouns', 'alice')).toEqual(expect.objectContaining({
      count: 2,
      paragraphs: [1, 3],
      litColumns: [true, false, true],
      claim: 'Appears 2 times across 2 paragraphs. Counted by code; nothing here is a reading.'
    }));
  });

  it('counts exactly what the Metrics tab counts, and every counted word has its places', async () => {
    const board = await boardOf(ALICE_OPENING_CURLY);
    const metrics = new WordFrequency().analyze({ text: ALICE_OPENING_CURLY }).pos;
    const lists = { nouns: metrics?.topNouns, verbs: metrics?.topVerbs, adjectives: metrics?.topAdjectives, adverbs: metrics?.topAdverbs };

    for (const pos of ['nouns', 'verbs', 'adjectives', 'adverbs'] as const) {
      const terms = board.measured.partsOfSpeech[pos];
      expect(terms.length).toBeGreaterThan(0);
      expect(terms.map(({ term, count, percentage }) => ({ word: term, count, percentage })))
        .toEqual(lists[pos]?.slice(0, terms.length));
      for (const term of terms) {
        expect(term.paragraphs.length).toBeGreaterThan(0);
        expect(term.paragraphs.length).toBeLessThanOrEqual(term.count);
      }
    }
  });

  it('follows the whole-text tagging at a heading that runs into its paragraph', async () => {
    // Per-paragraph tagging would read "bill" at the heading's end as a noun;
    // the whole-text tagging the Metrics tab counts reads it as a verb before
    // "It". The board counts what Metrics counts, and places it in ¶1.
    const text = 'CHAPTER IV. The Rabbit Sends in a Little Bill\n\nIt was the White Rabbit, trotting slowly back again.';
    const board = await boardOf(text);
    const metricsVerbs = new WordFrequency().analyze({ text }).pos?.topVerbs ?? [];

    expect(metricsVerbs.find((entry) => entry.word === 'bill')?.count).toBe(1);
    expect(evidence(board, 'verbs', 'bill')).toEqual(expect.objectContaining({ count: 1, paragraphs: [1] }));
  });
});

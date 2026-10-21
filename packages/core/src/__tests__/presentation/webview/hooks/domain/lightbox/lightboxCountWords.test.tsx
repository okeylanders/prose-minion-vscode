/** @jest-environment jsdom */

/**
 * The inspector's and the word panels' count strings agree in number
 * (Slice 4E): "1 word per sentence", never "1 words per sentence". Each case
 * pins a literal string, with a plural control beside it. Terms are words
 * from Lewis Carroll's "Alice's Adventures in Wonderland" (1865, public
 * domain).
 */

import * as React from 'react';
import { render } from '@testing-library/react';
import type { LightboxBoard, LightboxPressureThreadTile, LightboxStockTiersTile } from '@messages';
import { resolveLightboxItem } from '@hooks/domain/lightbox/lightboxItems';
import { buildLightboxInspectorView } from '@hooks/domain/lightbox/controllers/useLightboxInspector';
import { LightboxStatRow } from '@components/lightbox/LightboxStatRow';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';

/** The board with paragraph `index` replaced by these counts. */
function withParagraph(board: LightboxBoard, index: number, words: number, sentences: number, dialogueWords: number): LightboxBoard {
  return {
    ...board,
    paragraphs: board.paragraphs.map((paragraph) => (paragraph.index === index
      ? {
          ...paragraph,
          words,
          sentences,
          avgWordsPerSentence: sentences > 0 ? Math.round((words / sentences) * 10) / 10 : 0,
          sentenceWords: Array.from({ length: sentences }, () => words / sentences),
          dialogueWords,
          dialogueShare: words > 0 ? dialogueWords / words : 0
        }
      : paragraph))
  };
}

const quote = (paragraph: number, text: string) => ({ paragraph, text, match: 'exact' as const });

function withGroupTiles(board: LightboxBoard, group: 'D' | 'E', tiles: LightboxBoard['readings'][number]['tiles']): LightboxBoard {
  return {
    ...board,
    readings: board.readings.map((entry) => (entry.group === group ? { ...entry, status: 'ok', tiles } : entry))
  };
}

describe('the inspector says each count in agreement with its number', () => {
  it('a paragraph: one word per sentence, one word, one sentence', () => {
    const board = withParagraph(withParagraph(makeBoard(6), 2, 2, 2, 2), 3, 1, 1, 0);
    const claim = (index: number) => resolveLightboxItem(board, { kind: 'paragraphs', from: index, to: index })?.claim;

    // The writer's own example: two words of speech in two sentences.
    expect(claim(2)).toBe('2 words in 2 sentences · 1 word per sentence · 100% dialogue.');
    expect(claim(3)).toBe('1 word in 1 sentence · 1 word per sentence · 0% dialogue.');
    // Control: the plural forms stay plural.
    expect(claim(4)).toBe('32 words in 4 sentences · 8 words per sentence · 25% dialogue.');
    expect(resolveLightboxItem(board, { kind: 'paragraphs', from: 2, to: 3 })?.claim)
      .toBe('3 words in 3 sentences · 1 word per sentence · 67% dialogue.');
  });

  it('a measured figure: one paragraph holds, several hold', () => {
    const board = makeBoard(6);
    const one: LightboxBoard = {
      ...board,
      measured: {
        ...board.measured,
        numbers: { ...board.measured.numbers, rows: board.measured.numbers.rows.map((row) => (row.stat === 'dialogue' ? { ...row, paragraphs: [3] } : row)) }
      }
    };
    expect(resolveLightboxItem(one, { kind: 'standout', stat: 'dialogue' })?.claim)
      .toContain('It stands out below; 1 paragraph holds paragraphs of narration, lit here.');
    expect(resolveLightboxItem(board, { kind: 'standout', stat: 'dialogue' })?.claim)
      .toContain('It stands out below; 3 paragraphs hold paragraphs of narration, lit here.');
  });

  it('the Sections lane: one heading, one scene break, no chapter lines', () => {
    const board = makeBoard(6);
    const sections: LightboxBoard = {
      ...board,
      measured: {
        ...board.measured,
        // eslint-disable-next-line @typescript-eslint/naming-convention -- keyed by the signals' kebab-case protocol ids.
        sections: { ...board.measured.sections, fired: { headings: [1], 'scene-breaks': [4], 'chapter-lines': [] } }
      }
    };
    expect(resolveLightboxItem(sections, { kind: 'lane', lane: 'sections' })?.support)
      .toEqual(['1 heading', '1 scene break', '0 chapter lines']);
  });

  it('the Pressure lane: one thread', () => {
    const thread: LightboxPressureThreadTile = {
      kind: 'pressure-thread',
      id: 'lbt-test-E-1',
      lens: 'pressure',
      title: 'The locked door',
      claim: 'A door she cannot open.',
      paragraphs: [2, 3, 4, 5, 6],
      evidence: [quote(2, 'the little door')],
      withheldQuotes: [],
      support: [],
      friction: 'The door may be scenery.',
      planted: quote(2, 'the little door'),
      escalations: [],
      resolution: null,
      dormant: false,
      span: { from: 2, to: 6 }
    };
    const item = resolveLightboxItem(withGroupTiles(makeBoard(6), 'E', [thread]), { kind: 'pressure' });
    expect(item?.claim).toBe(
      '1 thread · 0 resolved here · 1 carried out of the chapter · 0 dormant. Counted by code from the threads read; lit where any stands open.'
    );
    expect(item?.support).toEqual(['1 thread', '1 carried out']);
  });

  it('the rhythm lane: one paragraph runs long, several run long', () => {
    // makeBoard: the text averages 8.4 words per sentence, and only ¶3 (40) runs at 12.6 or longer.
    expect(resolveLightboxItem(makeBoard(6), { kind: 'lane', lane: 'rhythm' })?.claim)
      .toBe('Average words per sentence in each paragraph. The text averages 8.4; 1 paragraph runs at 12.6 or longer, lit here.');
    const two = withParagraph(makeBoard(6), 5, 40, 1, 0);
    expect(resolveLightboxItem(two, { kind: 'lane', lane: 'rhythm' })?.claim)
      .toBe('Average words per sentence in each paragraph. The text averages 8.4; 2 paragraphs run at 12.6 or longer, lit here.');
  });

  it('the dialogue lane: one paragraph carries dialogue, several carry it', () => {
    // makeBoard: even paragraphs carry dialogue.
    expect(resolveLightboxItem(makeBoard(2), { kind: 'lane', lane: 'dialogue' })?.claim)
      .toBe('Share of each paragraph inside double quotation marks. 1 paragraph of 2 carries dialogue; 12.5% overall, against a standard of 40–55%.');
    expect(resolveLightboxItem(makeBoard(6), { kind: 'lane', lane: 'dialogue' })?.claim)
      .toBe('Share of each paragraph inside double quotation marks. 3 paragraphs of 6 carry dialogue; 12.5% overall, against a standard of 40–55%.');
  });

  it('a stock tier mix of one classified beat', () => {
    const tiers: LightboxStockTiersTile = {
      kind: 'stock-tiers',
      id: 'lbt-test-D-1',
      lens: 'stock',
      title: 'Mostly signature',
      claim: 'The beats lean to her own.',
      paragraphs: [2],
      evidence: [quote(2, 'considering in her own mind')],
      withheldQuotes: [],
      support: [],
      friction: 'One beat is thin ground.',
      beats: [{ tier: 'signature', quote: quote(2, 'considering in her own mind') }],
      tiers: { functional: 0, decorated: 0, weighted: 0, signature: 1 },
      classified: 1
    };
    const view = buildLightboxInspectorView(withGroupTiles(makeBoard(6), 'D', [tiers]), { kind: 'reading', tileId: tiers.id });
    expect(view?.reading?.details.slice(0, 4)).toEqual([
      expect.objectContaining({ value: '0 of 1 beat' }),
      expect.objectContaining({ value: '0 of 1 beat' }),
      expect.objectContaining({ value: '0 of 1 beat' }),
      expect.objectContaining({ value: '1 of 1 beat' })
    ]);
  });
});

describe('the stats row says each count in agreement with its number', () => {
  it('one word, one sentence, one paragraph; and the plural control', () => {
    const board = makeBoard(1);
    const single: LightboxBoard = {
      ...board,
      measured: { ...board.measured, headline: { ...board.measured.headline, wordCount: 1, sentenceCount: 1, paragraphCount: 1 } }
    };
    const chips = (subject: LightboxBoard) => {
      const { container, unmount } = render(<LightboxStatRow board={subject} />);
      const text = [...container.querySelectorAll('.pm-lb-stat, .pm-lb-chip')].map((node) => node.textContent);
      unmount();
      return text;
    };

    expect(chips(single)).toEqual(expect.arrayContaining(['1word', '1 paragraph', '1 sentence']));
    expect(chips(makeBoard(6))).toEqual(expect.arrayContaining(['200words', '6 paragraphs', '24 sentences']));
  });
});

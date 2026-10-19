/**
 * LightboxService (ADR 2026-10-19 D5, D8, D12): the 50,000-word ceiling, the
 * measured set built from the existing measurement services, and the
 * in-memory board kept per source.
 */

import {
  LightboxService,
  LightboxSourceInput,
  lightboxSourceKey
} from '@/infrastructure/lightbox/LightboxService';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import { WORD_FREQUENCY_STOPWORDS } from '@/tools/measure/wordFrequency';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { ALICE_OPENING_CURLY, ALICE_OPENING_STRAIGHT, aliceWords } from '@/__tests__/infrastructure/lightbox/lightboxProseFixtures';

const COMPARISON = {
  items: [
    { key: 'dialogue_percentage', label: 'Dialogue %', value: 12.3, standard: { min: 40, max: 55 }, status: 'below' }
  ]
};
const PUBLISHING_FORMAT = {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the standards data's field names.
  trimSize: { width_inches: 5.5, height_inches: 8.5, label: '5.5x8.5' },
  wordsPerPage: 250,
  estimatedPageCount: 1,
  pageCountRange: { min: 200, max: 400 },
  status: 'below'
};

function realMeasurementServices() {
  return {
    proseStats: new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    // Board options are fixed, so the settings-backed provider is never read.
    wordFrequency: new WordFrequencyService({} as ToolOptionsProvider),
    styleFlags: new StyleFlagsService()
  };
}

function createService(options: { enrich?: jest.Mock; retainedBoards?: number } = {}) {
  const measures = realMeasurementServices();
  const spies = {
    proseStats: jest.spyOn(measures.proseStats, 'analyze'),
    wordFrequency: jest.spyOn(measures.wordFrequency, 'analyze'),
    styleFlags: jest.spyOn(measures.styleFlags, 'analyze')
  };
  const enrich = options.enrich ?? jest.fn(async (stats: object) => ({
    ...stats,
    comparison: COMPARISON,
    publishingFormat: PUBLISHING_FORMAT
  }));
  let id = 0;
  const service = new LightboxService(
    measures.proseStats,
    measures.wordFrequency,
    measures.styleFlags,
    { enrichWithStandards: enrich },
    { now: () => 1_700_000_000_000, mintBoardId: () => `board-${++id}`, retainedBoards: options.retainedBoards }
  );
  return { service, spies, enrich };
}

const fileSource = (text: string, displayPath = 'Drafts/alice-1.md'): LightboxSourceInput => ({
  kind: 'file',
  text,
  displayPath,
  sourceUri: `file:///workspace/${displayPath}`,
  rereadPath: `/workspace/${displayPath}`
});

describe('LightboxService ceiling (D8)', () => {
  it('refuses a source over the ceiling with its count, before measuring anything', async () => {
    const { service, spies, enrich } = createService();
    const text = aliceWords(PROMPT_BUDGETS.lightbox.sourceWords + 1);

    const result = await service.buildBoard(fileSource(text));

    expect(result).toEqual({
      kind: 'refused',
      refusal: expect.objectContaining({
        reason: 'over-ceiling',
        wordCount: 50_001,
        ceilingWords: 50_000,
        displayPath: 'Drafts/alice-1.md',
        suggestion: expect.stringContaining('chapter')
      })
    });
    expect(result.kind === 'refused' && result.refusal.message).toContain('50,001 words');
    expect(spies.proseStats).not.toHaveBeenCalled();
    expect(spies.wordFrequency).not.toHaveBeenCalled();
    expect(spies.styleFlags).not.toHaveBeenCalled();
    expect(enrich).not.toHaveBeenCalled();
    expect(service.currentBoard()).toBeUndefined();
  });

  it('boards a source of exactly the ceiling', async () => {
    const { service } = createService();
    const result = await service.buildBoard(fileSource(aliceWords(PROMPT_BUDGETS.lightbox.sourceWords)));

    expect(result.kind).toBe('board');
    expect(result.kind === 'board' && result.board.source.wordCount).toBe(50_000);
    expect(result.kind === 'board' && result.board.ribbon).toHaveLength(PROMPT_BUDGETS.lightbox.ribbonColumns);
  }, 30_000);

  it('refuses a source with no text', async () => {
    const { service } = createService();
    expect(await service.buildBoard(fileSource(' \n\n '))).toEqual({
      kind: 'refused',
      refusal: expect.objectContaining({ reason: 'empty' })
    });
  });
});

describe('LightboxService measured set (D5)', () => {
  it('builds a counted board from the measurement services and the standards enrichment', async () => {
    const { service, spies, enrich } = createService();
    const result = await service.buildBoard(fileSource(ALICE_OPENING_CURLY));
    if (result.kind !== 'board') {
      throw new Error('expected a board');
    }
    const { board } = result;
    const stats = spies.proseStats.mock.results[0].value;

    expect(enrich).toHaveBeenCalledWith(stats);
    expect(board).toEqual(expect.objectContaining({
      boardVersion: 0,
      boardId: 'board-1',
      readings: ['A', 'B', 'C'].map((group) => ({ group, status: 'not-run', tiles: [], withheldBlocks: [] }))
    }));
    expect(board.source).toEqual(expect.objectContaining({
      kind: 'file',
      displayPath: 'Drafts/alice-1.md',
      wordCount: stats.wordCount,
      paragraphCount: 6,
      capturedAt: 1_700_000_000_000,
      contentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      preview: expect.stringMatching(/^Chapter I: Down the Rabbit-Hole/)
    }));
    expect(board.paragraphs).toHaveLength(stats.paragraphCount);
    expect(board.ribbon).toHaveLength(6);
    expect(board.measured.headline).toEqual(expect.objectContaining({
      wordCount: stats.wordCount,
      dialoguePercentage: stats.dialoguePercentage,
      pacing: stats.pacing
    }));
    expect(board.measured.standards).toEqual({
      items: COMPARISON.items,
      publishingFormat: {
        trimLabel: '5.5x8.5',
        wordsPerPage: 250,
        estimatedPageCount: 1,
        pageCountRange: { min: 200, max: 400 },
        status: 'below'
      }
    });
    expect(board.measured.styleFlags.length).toBeGreaterThan(0);
  });

  it('places every counted word and phrase in the paragraphs that hold it', async () => {
    const { service } = createService();
    const result = await service.buildBoard(fileSource(ALICE_OPENING_CURLY));
    if (result.kind !== 'board') {
      throw new Error('expected a board');
    }
    const { measured } = result.board;
    const paragraphs = ALICE_OPENING_CURLY.toLowerCase().split('\n\n');

    expect(measured.topWords.length).toBeGreaterThan(0);
    const alice = measured.topWords.find((term) => term.term === 'alice');
    expect(alice).toEqual(expect.objectContaining({ count: 5, paragraphs: [2, 4, 5, 6] }));
    for (const term of [...measured.topWords, ...measured.phrases.bigrams, ...measured.phrases.trigrams]) {
      expect(term.paragraphs.length).toBeGreaterThan(0);
      for (const index of term.paragraphs) {
        expect(paragraphs[index - 1]).toContain(term.term);
      }
    }
    // Repeated phrases need a content word and a second occurrence.
    for (const phrase of [...measured.phrases.bigrams, ...measured.phrases.trigrams]) {
      expect(phrase.count).toBeGreaterThanOrEqual(2);
      expect(phrase.term.split(' ').some((word) => !WORD_FREQUENCY_STOPWORDS.has(word))).toBe(true);
    }
    expect(measured.partsOfSpeech.available).toBe(true);
    // The tagger splits "rabbit-hole"; its parts still find their paragraphs.
    const nouns = measured.partsOfSpeech.nouns;
    expect(nouns.find((term) => term.term === 'hole')?.paragraphs).toEqual([1, 5]);
    expect(nouns.find((term) => term.term === 'rabbit')?.paragraphs).toEqual([1, 3, 5]);
    expect(measured.topWords.find((term) => term.term === 'rabbit-hole')?.paragraphs).toEqual([1, 5]);
  });

  it('keeps the host-private re-read path off the board', async () => {
    const { service } = createService();
    const result = await service.buildBoard({ ...fileSource(ALICE_OPENING_CURLY), rereadPath: '/private/reread.md' });

    expect(JSON.stringify(result)).not.toContain('/private/reread.md');
    expect(JSON.stringify(result)).not.toContain('rereadPath');
    expect(service.currentRereadTarget()).toEqual({
      displayPath: 'Drafts/alice-1.md',
      rereadPath: '/private/reread.md',
      sourceUri: 'file:///workspace/Drafts/alice-1.md'
    });
  });
});

describe('LightboxService boards per source (D12)', () => {
  it('keeps the board id for unchanged text, and mints a new board when the text changes', async () => {
    const { service } = createService();
    const first = await service.buildBoard(fileSource(ALICE_OPENING_CURLY));
    const again = await service.buildBoard(fileSource(ALICE_OPENING_CURLY.replace(/\n/g, '\r\n')));
    const changed = await service.buildBoard(fileSource(ALICE_OPENING_STRAIGHT));

    expect(first).toEqual(expect.objectContaining({ kind: 'board', reused: false }));
    expect(again).toEqual(expect.objectContaining({ kind: 'board', reused: true }));
    expect(again.kind === 'board' && again.board.boardId).toBe('board-1');
    expect(changed).toEqual(expect.objectContaining({ kind: 'board', reused: false }));
    expect(changed.kind === 'board' && changed.board.boardId).toBe('board-2');
    expect(service.currentBoard()?.boardId).toBe('board-2');
  });

  it('measures unchanged text again, so a changed standards preset shows on re-read', async () => {
    const enrich = jest.fn()
      .mockImplementationOnce(async (stats: object) => stats)
      .mockImplementation(async (stats: object) => ({ ...stats, comparison: COMPARISON }));
    const { service, spies } = createService({ enrich });
    const first = await service.buildBoard(fileSource(ALICE_OPENING_CURLY));
    const again = await service.buildBoard(fileSource(ALICE_OPENING_CURLY));

    expect(first.kind === 'board' && first.board.measured.standards).toBeUndefined();
    expect(again.kind === 'board' && again.board.measured.standards?.items).toEqual(COMPARISON.items);
    expect(again.kind === 'board' && again.board.boardId).toBe('board-1');
    expect(spies.proseStats).toHaveBeenCalledTimes(2);
  });

  it('keeps a board for each source and serves the latest as current', async () => {
    const { service } = createService();
    await service.buildBoard(fileSource(ALICE_OPENING_CURLY, 'Drafts/one.md'));
    await service.buildBoard({
      kind: 'selection',
      text: ALICE_OPENING_STRAIGHT,
      displayPath: 'Drafts/one.md',
      startLine: 3,
      endLine: 9
    });
    expect(service.currentBoard()?.source.kind).toBe('selection');
    expect(service.currentRereadTarget()).toBeUndefined();

    const back = await service.buildBoard(fileSource(ALICE_OPENING_CURLY, 'Drafts/one.md'));
    expect(back).toEqual(expect.objectContaining({ kind: 'board', reused: true }));
    expect(service.currentBoard()?.boardId).toBe('board-1');
  });

  it('leaves the current board in place when a source is refused', async () => {
    const { service } = createService();
    await service.buildBoard(fileSource(ALICE_OPENING_CURLY));
    await service.buildBoard(fileSource(aliceWords(50_001), 'Drafts/whole-book.md'));

    expect(service.currentBoard()?.source.displayPath).toBe('Drafts/alice-1.md');
  });

  it('drops a build that a newer request overtook', async () => {
    let releaseFirst!: () => void;
    const enrich = jest.fn()
      .mockImplementationOnce((stats: object) => new Promise((resolve) => {
        releaseFirst = () => resolve(stats);
      }))
      .mockImplementation(async (stats: object) => stats);
    const { service } = createService({ enrich });

    const slow = service.buildBoard(fileSource(ALICE_OPENING_CURLY, 'Drafts/slow.md'));
    const fast = await service.buildBoard(fileSource(ALICE_OPENING_STRAIGHT, 'Drafts/fast.md'));
    releaseFirst();

    expect(await slow).toEqual({ kind: 'superseded' });
    expect(fast.kind === 'board' && fast.board.source.displayPath).toBe('Drafts/fast.md');
    expect(service.currentBoard()?.source.displayPath).toBe('Drafts/fast.md');
  });

  it('retains a bounded number of boards, oldest out first', async () => {
    const { service } = createService({ retainedBoards: 2 });
    await service.buildBoard(fileSource(ALICE_OPENING_CURLY, 'a.md'));
    await service.buildBoard(fileSource(ALICE_OPENING_CURLY, 'b.md'));
    await service.buildBoard(fileSource(ALICE_OPENING_CURLY, 'c.md'));

    // a.md was evicted, so boarding it again is a fresh build.
    const again = await service.buildBoard(fileSource(ALICE_OPENING_CURLY, 'a.md'));
    expect(again).toEqual(expect.objectContaining({ kind: 'board', reused: false }));
  });

  it('keys a selection by its file and lines', () => {
    expect(lightboxSourceKey({ kind: 'selection', displayPath: 'a.md', startLine: 1, endLine: 4 }))
      .toBe('selection:a.md:1-4');
    expect(lightboxSourceKey({ kind: 'file', displayPath: 'a.md' })).toBe('file:a.md');
  });
});

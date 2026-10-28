/**
 * Boards with the text they were measured from (Slice 4E): the production
 * LightboxService and measurement services, so a passage test reads exactly
 * what the board counted. Fixture text is public domain (Lewis Carroll,
 * "Alice's Adventures in Wonderland", 1865) or written for the tests.
 */

import type { LightboxBoard, LightboxPassageRow, LightboxPassageSentenceRow } from '@messages';
import { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import type { LightboxPassageIndex } from '@/infrastructure/lightbox/LightboxPassageIndex';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';

export interface LightboxBoardWithPassages {
  service: LightboxService;
  board: LightboxBoard;
  passages: LightboxPassageIndex;
}

/** A service with the real measurement services and no standards preset; board ids `board-1`, `board-2`, … */
export function createPassageService(): LightboxService {
  let id = 0;
  return new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    { enrichWithStandards: async (stats: object) => stats } as never,
    { mintBoardId: () => `board-${++id}`, now: () => 1_700_000_000_000 }
  );
}

/**
 * The rows as sentence rows. A row outside every sentence (PR #161 N-01)
 * fails the test: ordinary prose has none, so a test reading sentences
 * checks that too.
 */
export function lightboxSentenceRows(rows: readonly LightboxPassageRow[]): LightboxPassageSentenceRow[] {
  return rows.map((row) => {
    if ('outside' in row) {
      throw new Error(`Expected a sentence row, got a stretch outside every sentence in ¶${row.outside.paragraph}`);
    }
    return row;
  });
}

/** Board `text` as a file and return the board with its passage index. */
export async function boardWithPassages(
  text: string,
  service: LightboxService = createPassageService(),
  displayPath = 'Drafts/alice-chapter-1.md'
): Promise<LightboxBoardWithPassages> {
  const result = await service.buildBoard({
    kind: 'file',
    text,
    displayPath,
    sourceUri: `file:///workspace/${displayPath}`,
    rereadPath: `/workspace/${displayPath}`
  });
  const source = result.kind === 'board' ? service.passageSource(result.board.boardId) : undefined;
  if (!source) {
    throw new Error('The fixture was not boarded.');
  }
  return { service, ...source };
}

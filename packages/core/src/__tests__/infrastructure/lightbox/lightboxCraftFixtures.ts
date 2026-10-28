/**
 * Fixtures for the Lightbox's group D (Slice 4B): a writer's average to
 * measure a chapter's numbers against, and a board built from paragraphs
 * with it. The average is synthetic counts, not prose; the prose is the
 * worked examples' public-domain *Alice* opening (Lewis Carroll, 1865).
 * No writer's text is committed.
 */
import type { LightboxBoard } from '@messages';
import { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import type { LightboxWriterAverages } from '@/infrastructure/lightbox/LightboxNumbers';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';

/**
 * A writer whose other chapters (20,000 words) average 14.3 words a
 * sentence, 30% dialogue, and per 1,000 words 1.5 passive constructions, 25
 * being verbs, 10 -ly words and 3 intensifiers.
 */
export const WRITER_AVERAGES: LightboxWriterAverages = {
  summary: { kind: 'measured', group: 'chapters', files: 11, words: 20_000, capped: false },
  counts: {
    words: 20_000,
    sentences: 1_400,
    dialogueWords: 6_000,
    // eslint-disable-next-line @typescript-eslint/naming-convention -- keyed by the figures' kebab-case protocol ids.
    patterns: { 'passive-voice': 30, 'being-verbs': 500, adverbs: 200, intensifiers: 60 }
  }
};

/** A board of `paragraphs`, measured by the production service against `writer` (the fixture's by default). */
export async function boardWithNumbers(
  paragraphs: readonly string[],
  writer: LightboxWriterAverages = WRITER_AVERAGES
): Promise<LightboxBoard> {
  const service = new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    { enrichWithStandards: async (stats: object) => stats } as never,
    {},
    { measure: async () => writer }
  );
  const built = await service.buildBoard({ kind: 'file', text: paragraphs.join('\n\n'), displayPath: 'example.md' });
  if (built.kind !== 'board') {
    throw new Error('expected a board');
  }
  return built.board;
}

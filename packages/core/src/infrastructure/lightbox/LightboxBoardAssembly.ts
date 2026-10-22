/**
 * A board measured from its text (ADR 2026-10-19 D4, D5), and a saved
 * board's host-side parts rebuilt from its saved text (D12 addendum; Slice
 * 5A). Moved out of `LightboxService` so the service has room for saved
 * boards; the service owns which board is current, this only measures.
 *
 * The measurement services are called directly, never through
 * MetricsHandler. No model is called and nothing is written.
 */

import type { LightboxBoard, LightboxSource } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { LIGHTBOX_READING_GROUPS, emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import { countWords } from '@/utils/textUtils';
import type { ProseStatsService } from '@services/measurement/ProseStatsService';
import type { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import type { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { StandardsService } from '@services/resources/StandardsService';
import {
  buildLightboxRibbon,
  measureLightboxParagraph,
  splitLightboxParagraphs,
  type LightboxParagraph
} from '@/infrastructure/lightbox/LightboxParagraphs';
import {
  LIGHTBOX_WORD_FREQUENCY_OPTIONS,
  LightboxEnrichedStats,
  buildLightboxMeasuredSet
} from '@/infrastructure/lightbox/LightboxMeasures';
import { lightboxSourcePreview } from '@/infrastructure/lightbox/LightboxSourceChecks';
import type { LightboxWriterBaseline } from '@/infrastructure/lightbox/LightboxWriterBaseline';
import { LightboxPassageIndex } from '@/infrastructure/lightbox/LightboxPassageIndex';
import { currentLightboxMeasureRules } from '@/infrastructure/lightbox/LightboxMeasureRules';
import type { LightboxSourceInput } from '@/infrastructure/lightbox/LightboxService';

/** The services a board is measured with. */
export interface LightboxBoardMeasurers {
  proseStats: Pick<ProseStatsService, 'analyze'>;
  wordFrequency: Pick<WordFrequencyService, 'analyze'>;
  styleFlags: Pick<StyleFlagsService, 'analyze'>;
  standards: Pick<StandardsService, 'enrichWithStandards'>;
  /** The writer's own average for the numbers tile; without it the tile says none is measured. */
  writerBaseline?: Pick<LightboxWriterBaseline, 'measure'>;
}

/** A board and the host-private parts kept beside it. */
export interface LightboxAssembledBoard {
  board: LightboxBoard;
  /** The paragraph texts a reading run reads (index 0 is ¶1). */
  paragraphTexts: string[];
  /** The text it was measured from, for the inspector's passages (Slice 4E). */
  passages: LightboxPassageIndex;
}

/**
 * Measure `input`'s text under this build's rules. An unchanged predecessor
 * lends its id and readings; otherwise `mintBoardId` names it.
 */
export async function assembleLightboxBoard(
  measurers: LightboxBoardMeasurers,
  input: LightboxSourceInput,
  contentHash: string,
  predecessor: LightboxBoard | undefined,
  ids: { capturedAt: number; mintBoardId: () => string }
): Promise<LightboxAssembledBoard> {
  const paragraphs = splitLightboxParagraphs(input.text);
  const metrics = paragraphs.map(measureLightboxParagraph);
  const stats = measurers.proseStats.analyze({ text: input.text });
  const enriched = (await measurers.standards.enrichWithStandards(stats)) as LightboxEnrichedStats;
  const frequency = measurers.wordFrequency.analyze(input.text, LIGHTBOX_WORD_FREQUENCY_OPTIONS);
  const flags = measurers.styleFlags.analyze(input.text);
  const writer = await measurers.writerBaseline?.measure({ absolutePath: input.rereadPath, sourceUri: input.sourceUri });

  const source: LightboxSource = {
    kind: input.kind,
    displayPath: input.displayPath,
    sourceUri: input.sourceUri,
    startLine: input.startLine,
    endLine: input.endLine,
    contentHash,
    wordCount: countWords(input.text),
    paragraphCount: paragraphs.length,
    capturedAt: ids.capturedAt,
    preview: lightboxSourcePreview(input.text)
  };

  const board: LightboxBoard = {
    boardVersion: 1,
    boardId: predecessor?.boardId ?? ids.mintBoardId(),
    rules: currentLightboxMeasureRules(),
    source,
    paragraphs: metrics,
    ribbon: buildLightboxRibbon(metrics, PROMPT_BUDGETS.lightbox.ribbonColumns),
    measured: buildLightboxMeasuredSet({
      stats: enriched, frequency, flags, paragraphs, text: input.text, writer
    }),
    readings: predecessor?.readings ?? LIGHTBOX_READING_GROUPS.map(emptyLightboxReadingGroup)
  };
  return {
    board,
    paragraphTexts: paragraphs.map((paragraph) => paragraph.text),
    passages: LightboxPassageIndex.build({ text: input.text, paragraphs, frequency })
  };
}

/**
 * A saved board's host-private parts, rebuilt from its own saved text: the
 * paragraph texts its offsets name and the inspector's passage index. The
 * board itself is not measured again: its figures stay as saved, under its
 * own rules (epic decision 29).
 */
export function savedLightboxBoardParts(
  wordFrequency: LightboxBoardMeasurers['wordFrequency'],
  board: LightboxBoard,
  text: string
): Omit<LightboxAssembledBoard, 'board'> {
  const paragraphs: LightboxParagraph[] = board.paragraphs.map((metric) => ({
    index: metric.index,
    text: text.slice(metric.start, metric.end),
    start: metric.start,
    end: metric.end,
    words: metric.words
  }));
  return {
    paragraphTexts: paragraphs.map((paragraph) => paragraph.text),
    passages: LightboxPassageIndex.build({
      text,
      paragraphs,
      frequency: wordFrequency.analyze(text, LIGHTBOX_WORD_FREQUENCY_OPTIONS)
    })
  };
}

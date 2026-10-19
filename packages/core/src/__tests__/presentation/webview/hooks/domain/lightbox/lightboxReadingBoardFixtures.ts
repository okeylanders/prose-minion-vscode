/**
 * A Lightbox board with readings, for the webview tests: the counted half is
 * the hand-built `makeBoard(8)`, and the readings are the prompt bundle's
 * worked examples decoded and verified by the production codec and verifier
 * against their own excerpt of Lewis Carroll's "Alice's Adventures in
 * Wonderland" (1865, public domain). No writer's text is committed.
 */
import type {
  LightboxBoard,
  LightboxReadingGroup,
  LightboxReadingGroupId,
  LightboxRunEstimate
} from '@messages';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { frame, framedJson, readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';

/** One group as the host would hold it after its call landed. `mutate` breaks the worked example's body first. */
export function readGroup(
  group: LightboxReadingGroupId,
  options: { paraphraseOne?: boolean; mutate?: (body: Record<string, any>) => void } = {}
): LightboxReadingGroup {
  const example = readWorkedExample(group);
  let response = example.response;
  if ((options.paraphraseOne && group === 'A') || options.mutate) {
    const body = framedJson(response) as Record<string, any>;
    if (options.paraphraseOne && group === 'A') {
      // A fixture built to provoke a withheld quote: one motif quote paraphrased.
      body.motifs.items[0].evidence[1].quote = 'and then it dropped straight down';
    }
    options.mutate?.(body);
    response = frame(group, body);
  }
  const decoded = decodeLightboxGroup(response, { group, lenses: example.lenses, columnCount: 8 });
  let id = 0;
  const assembled = assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(example.paragraphs),
    counter: createLightboxTermCounter(example.paragraphs),
    mintId: () => `lbt-test-${group}-${++id}`,
    averageWordsPerSentence: 8.4
  });
  return {
    group,
    status: 'ok',
    lenses: [...example.lenses],
    model: 'provider/model-v1',
    usage: { promptTokens: 4_000, completionTokens: 600, totalTokens: 4_600, costUsd: 0.02 },
    tiles: assembled.tiles,
    withheldBlocks: assembled.withheldBlocks,
    withheldClaims: assembled.withheldClaims,
    frictions: assembled.frictions,
    quoteChecks: assembled.quoteChecks
  };
}

/** The counted board with every group read. */
export function makeReadBoard(options: { paraphraseOne?: boolean } = {}): LightboxBoard {
  const board = makeBoard(8);
  return { ...board, readings: (['A', 'B', 'C'] as const).map((group) => readGroup(group, options)) };
}

/** A host estimate for `makeBoard(8)`, all lenses on. */
export function makeEstimate(overrides: Partial<LightboxRunEstimate> = {}): LightboxRunEstimate {
  const call = (group: LightboxReadingGroupId, lenses: LightboxRunEstimate['groups'][number]['lenses'], costUsd: number) => ({
    group,
    lenses,
    inputTokens: 3_000,
    expectedOutputTokens: 900,
    reservedOutputTokens: 8_000,
    fit: 'fits' as const,
    costUsd
  });
  return {
    boardId: 'board-8',
    key: 'estimate-board-8',
    model: 'provider/model-v1',
    contextLength: 200_000,
    groups: [call('A', ['headline', 'motif', 'tension'], 0.015), call('B', ['characters', 'voice'], 0.013), call('C', ['genre'], 0.012)],
    rereads: [call('A', ['motif'], 0.008)],
    fit: 'fits',
    costUsd: 0.04,
    bookSized: false,
    sourceWords: 260,
    contextWords: 0,
    ...overrides
  };
}

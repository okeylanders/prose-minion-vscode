/**
 * Fixtures for the Lightbox's group F (Slice 4D): a board whose groups A–E and G
 * are the prompt bundle's worked examples, read as the runner reads them,
 * on their own excerpt of Lewis Carroll's "Alice's Adventures in
 * Wonderland" (1865, public domain), measured by the production service
 * against the synthetic writer's average; and the Opinion read on it
 * through the production codec, digest and gates. No writer's text is
 * committed.
 */
import type {
  LightboxBoard,
  LightboxLensId,
  LightboxOpinionTile,
  LightboxReadingGroup,
  LightboxWithheldClaim
} from '@messages';
import { LIGHTBOX_READING_GROUPS, emptyLightboxReadingGroup, lightboxGroupLenses, lightboxGroupReadsBoard } from '@shared/constants/lightbox';
import { lightboxOpinionItems } from '@shared/constants/lightboxOpinionItems';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { lightboxColumnKeys } from '@/infrastructure/lightbox/LightboxTileCounts';
import { lightboxStandoutRows } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { buildLightboxOpinionDigest } from '@/infrastructure/lightbox/LightboxOpinionDigest';
import { assembleLightboxOpinion } from '@/infrastructure/lightbox/LightboxOpinionReply';
import type { LightboxDecodedOpinionBlock } from '@/infrastructure/lightbox/LightboxOpinionWire';
import { frame, framedJson, readWorkedExample } from './lightboxReadingFixtures';
import { boardWithNumbers } from './lightboxCraftFixtures';

/* eslint-disable @typescript-eslint/no-explicit-any -- worked-example bodies are edited as plain JSON. */
export type OpinionBody = Record<string, any>;

export const OPINION_EXAMPLE = readWorkedExample('F');
/** ¶1–¶8 of the worked examples; index 0 is ¶1. */
export const ALICE = readWorkedExample('A').paragraphs;
/** The lenses the group F worked example's board was read without. */
export const OPINION_EXAMPLE_LENSES_OFF: LightboxLensId[] = [
  'motif', 'tension', 'gravity', 'palette', 'subtext', 'genre', 'lineage', 'spark', 'rhythm', 'template'
];
/** The run token prefix of the worked example's ids. */
export const OPINION_EXAMPLE_PREFIX = '5b1e09c4';

/** `board` with groups A–E and G read from their worked examples, as a run would read them with `lensesOff`. */
export function readChapterGroups(
  board: LightboxBoard,
  paragraphs: readonly string[] = ALICE,
  lensesOff: readonly LightboxLensId[] = [],
  prefix = OPINION_EXAMPLE_PREFIX
): LightboxBoard {
  const readings = LIGHTBOX_READING_GROUPS.map((group): LightboxReadingGroup => {
    const lenses = lightboxGroupLenses(group).filter((lens) => !lensesOff.includes(lens));
    if (lightboxGroupReadsBoard(group) || lenses.length === 0) {
      return emptyLightboxReadingGroup(group);
    }
    const decoded = decodeLightboxGroup(readWorkedExample(group).response, { group, lenses, columnCount: board.ribbon.length });
    let ordinal = 0;
    const assembled = assembleLightboxGroup(decoded, {
      verifier: createLightboxQuoteVerifier(paragraphs),
      counter: createLightboxTermCounter(paragraphs),
      mintId: () => `lbt-${prefix}-${group}-${++ordinal}`,
      averageWordsPerSentence: board.measured.headline.averageWordsPerSentence,
      columnKeys: lightboxColumnKeys(paragraphs, board.ribbon),
      standouts: lightboxStandoutRows(board.measured.numbers.rows)
    });
    return {
      group,
      status: 'ok',
      lenses,
      model: 'provider/model-v1',
      tiles: assembled.tiles,
      withheldBlocks: assembled.withheldBlocks,
      withheldClaims: assembled.withheldClaims,
      frictions: assembled.frictions,
      quoteChecks: assembled.quoteChecks
    };
  });
  return { ...board, readings };
}

/** The worked example's board: the Alice excerpt measured against the writer's average, read with the example's lenses. */
export async function aliceOpinionBoard(lensesOff: readonly LightboxLensId[] = OPINION_EXAMPLE_LENSES_OFF): Promise<LightboxBoard> {
  return readChapterGroups(await boardWithNumbers(ALICE), ALICE, lensesOff);
}

/** A fresh copy of the worked example's opinion block, to edit. */
export function opinionBody(): OpinionBody {
  return (framedJson(OPINION_EXAMPLE.response) as OpinionBody).opinion;
}

/** The Opinion read on `board` from `body`, as group F's reply is read: decoded, then gated against the board's digest. */
export function readOpinion(board: LightboxBoard, body: OpinionBody = opinionBody(), id = `lbt-${OPINION_EXAMPLE_PREFIX}-F-1`) {
  const digest = buildLightboxOpinionDigest(board);
  const decoded = decodeLightboxGroup(frame('F', { version: 1, opinion: body }), { group: 'F', lenses: ['opinion'], columnCount: 0 });
  const block = decoded.blocks.find((candidate): candidate is LightboxDecodedOpinionBlock => candidate.lens === 'opinion');
  const result = block
    ? assembleLightboxOpinion(block, { items: digest.items, digest: { key: digest.key, items: digest.items.size, leftOut: digest.leftOut }, id })
    : undefined;
  const tile: LightboxOpinionTile | undefined = result && 'tile' in result ? result.tile : undefined;
  const withheld: LightboxWithheldClaim[] = result && 'withheld' in result ? result.withheld : [];
  return { digest, decoded, block, tile, withheld };
}

/** `board` with group F holding what `readOpinion` read. */
export function withOpinion(board: LightboxBoard, read: ReturnType<typeof readOpinion>): LightboxBoard {
  const group: LightboxReadingGroup = {
    group: 'F',
    status: 'ok',
    lenses: ['opinion'],
    model: 'provider/model-v1',
    tiles: read.tile ? [read.tile] : [],
    withheldBlocks: read.decoded.withheld.map((entry) => ({ kind: 'opinion', lens: entry.lens, reason: entry.reason })),
    withheldClaims: read.withheld,
    frictions: read.block ? [{ lens: 'opinion', friction: read.block.friction }] : [],
    quoteChecks: read.block ? [{ lens: 'opinion', checked: 0, withheld: 0 }] : []
  };
  return { ...board, readings: board.readings.map((candidate) => (candidate.group === 'F' ? group : candidate)) };
}

/** The key of the board item whose label starts with `label` ("Pressure · Thread: How will"), or a throw. */
export function itemKey(board: Pick<LightboxBoard, 'measured' | 'readings'>, label: string): string {
  const found = lightboxOpinionItems(board).find((item) => item.label.startsWith(label));
  if (!found) {
    throw new Error(`no board item labelled ${label}`);
  }
  return found.key;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

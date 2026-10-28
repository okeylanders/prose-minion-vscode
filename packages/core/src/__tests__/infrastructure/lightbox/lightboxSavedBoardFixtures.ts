/**
 * A board holding every reading kind, for the saved-board tests (Slice 5A).
 *
 * The counted half is the production service's measure of ¶1–¶8 of Lewis
 * Carroll's "Alice's Adventures in Wonderland" (1865, public domain), the
 * worked examples' excerpt, against the synthetic writer's average. The
 * readings are groups A–E and G read from their worked examples with every
 * lens on, as the runner reads them (group A with a third borrowed field and
 * a collision the host can see, so every kind is drawn), and the Opinion
 * read on that board through the production codec, digest and gates. No
 * writer's text is committed.
 */
import type { LightboxBoard, LightboxReadingGroup } from '@messages';
import { LIGHTBOX_READING_GROUPS, emptyLightboxReadingGroup, lightboxGroupLenses, lightboxGroupReadsBoard } from '@shared/constants/lightbox';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { lightboxColumnKeys } from '@/infrastructure/lightbox/LightboxTileCounts';
import { lightboxStandoutRows } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { opinionOn } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';
import { frame, framedJson, readWorkedExample } from './lightboxReadingFixtures';
import { boardWithNumbers } from './lightboxCraftFixtures';
import { ALICE, readOpinion, withOpinion } from './lightboxOpinionFixtures';

/** The excerpt's text as the board measured it: its paragraphs joined by blank lines. */
export const ALICE_TEXT = ALICE.join('\n\n');

/** The run token prefix the fixture's tile ids carry. */
export const SAVED_BOARD_PREFIX = '0c5aved0';

/* eslint-disable @typescript-eslint/no-explicit-any -- the worked example's body is edited as plain JSON. */
/** Group A's worked example with a third borrowed field and a collision ¶4 shows (as `readGroup`'s `collision` does). */
function groupAResponse(): string {
  const body = framedJson(readWorkedExample('A').response) as Record<string, any>;
  body.gravity.fields.push({
    name: 'Animals', metaphor: 'The chase as a hunt.', pull: 0.12, claim: 'The Rabbit is chased like quarry.',
    terms: [{ term: 'rabbit', degree: 1 }], evidence: [{ para: 3, quote: 'a White Rabbit with pink eyes' }]
  });
  body.gravity.collisions = [{
    fields: ['Fire', 'Animals'],
    claim: 'The thought that flashes is a thought about the rabbit.',
    evidence: [{ para: 4, quote: 'it flashed across her mind that she had never before seen a rabbit' }]
  }];
  return frame('A', body);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** `board` with every chapter group read from its worked example, every lens on. */
function readEveryGroup(board: LightboxBoard): LightboxBoard {
  const readings = LIGHTBOX_READING_GROUPS.map((group): LightboxReadingGroup => {
    if (lightboxGroupReadsBoard(group)) {
      return emptyLightboxReadingGroup(group);
    }
    const lenses = lightboxGroupLenses(group);
    const response = group === 'A' ? groupAResponse() : readWorkedExample(group).response;
    const decoded = decodeLightboxGroup(response, { group, lenses, columnCount: board.ribbon.length });
    let ordinal = 0;
    const assembled = assembleLightboxGroup(decoded, {
      verifier: createLightboxQuoteVerifier(ALICE),
      counter: createLightboxTermCounter(ALICE),
      mintId: () => `lbt-${SAVED_BOARD_PREFIX}-${group}-${++ordinal}`,
      averageWordsPerSentence: board.measured.headline.averageWordsPerSentence,
      columnKeys: lightboxColumnKeys(ALICE, board.ribbon),
      standouts: lightboxStandoutRows(board.measured.numbers.rows)
    });
    return {
      group,
      status: 'ok',
      lenses: [...lenses],
      model: 'provider/model-v1',
      usage: { promptTokens: 4_000, completionTokens: 600, totalTokens: 4_600, costUsd: 0.02 },
      tiles: assembled.tiles,
      withheldBlocks: assembled.withheldBlocks,
      withheldClaims: assembled.withheldClaims,
      frictions: assembled.frictions,
      quoteChecks: assembled.quoteChecks
    };
  });
  return { ...board, readings };
}

/**
 * The every-kind board: measured by the production service, read from the
 * worked examples, with the Opinion standing on it. `capturedAt` is fixed so
 * the board is the same on every run.
 */
export async function everyKindBoard(): Promise<{ board: LightboxBoard; text: string }> {
  const measured = await boardWithNumbers(ALICE);
  const read = readEveryGroup({
    ...measured,
    boardId: `board-${SAVED_BOARD_PREFIX}`,
    source: { ...measured.source, displayPath: 'Drafts/alice-1.md', capturedAt: 1_700_000_000_000 }
  });
  const opinion = readOpinion(read, opinionOn(read), `lbt-${SAVED_BOARD_PREFIX}-F-1`);
  if (!opinion.tile) {
    throw new Error(`the fixture's Opinion was withheld: ${opinion.withheld.map((claim) => claim.reason).join('; ')}`);
  }
  return { board: withOpinion(read, opinion), text: ALICE_TEXT };
}

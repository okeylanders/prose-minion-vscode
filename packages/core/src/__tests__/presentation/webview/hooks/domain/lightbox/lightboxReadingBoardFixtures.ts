/**
 * A Lightbox board with readings, for the webview tests: the counted half is
 * the hand-built `makeBoard(8)`, and the readings are the prompt bundle's
 * worked examples decoded and verified by the production codec and verifier
 * against their own excerpt of Lewis Carroll's "Alice's Adventures in
 * Wonderland" (1865, public domain). No writer's text is committed. Group D
 * (Slice 4B) is read against the board's own measured standouts and column
 * keys, as the runner reads it. Group F (Slice 4D) is an Opinion written for
 * this board, read through the production codec and gates against the
 * board's own digest.
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
import { lightboxColumnKeys } from '@/infrastructure/lightbox/LightboxTileCounts';
import { lightboxStandoutRows } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { LIGHTBOX_READING_GROUPS } from '@shared/constants/lightbox';
import { frame, framedJson, readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';
import { itemKey, readOpinion, withOpinion, type OpinionBody } from '@/__tests__/infrastructure/lightbox/lightboxOpinionFixtures';

/**
 * One group as the host would hold it after its call landed. `mutate` breaks
 * the worked example's body first; `collision` adds a third borrowed field
 * and a collision the host can see (Slice 3).
 */
export function readGroup(
  group: LightboxReadingGroupId,
  options: { paraphraseOne?: boolean; collision?: boolean; mutate?: (body: Record<string, any>) => void } = {}
): LightboxReadingGroup {
  const example = readWorkedExample(group);
  let response = example.response;
  if (((options.paraphraseOne || options.collision) && group === 'A') || options.mutate) {
    const body = framedJson(response) as Record<string, any>;
    if (options.paraphraseOne && group === 'A') {
      // A fixture built to provoke a withheld quote: one motif quote paraphrased.
      body.motifs.items[0].evidence[1].quote = 'and then it dropped straight down';
    }
    if (options.collision && group === 'A') {
      // A hand-written third field, so ¶4 holds a collision the host can see.
      body.gravity.fields.push({
        name: 'Animals', metaphor: 'The chase as a hunt.', pull: 0.12, claim: 'The Rabbit is chased like quarry.',
        terms: [{ term: 'rabbit', degree: 1 }], evidence: [{ para: 3, quote: 'a White Rabbit with pink eyes' }]
      });
      body.gravity.collisions = [{
        fields: ['Fire', 'Animals'],
        claim: 'The thought that flashes is a thought about the rabbit.',
        evidence: [{ para: 4, quote: 'it flashed across her mind that she had never before seen a rabbit' }]
      }];
    }
    options.mutate?.(body);
    response = frame(group, body);
  }
  const decoded = decodeLightboxGroup(response, { group, lenses: example.lenses, columnCount: 8 });
  let id = 0;
  const board = makeBoard(8);
  const assembled = assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(example.paragraphs),
    counter: createLightboxTermCounter(example.paragraphs),
    mintId: () => `lbt-test-${group}-${++id}`,
    averageWordsPerSentence: 8.4,
    columnKeys: lightboxColumnKeys(example.paragraphs, board.ribbon),
    standouts: lightboxStandoutRows(board.measured.numbers.rows)
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

/** The counted board with every group read; group F weighs the others (`opinionOn`). */
export function makeReadBoard(options: { paraphraseOne?: boolean; collision?: boolean } = {}): LightboxBoard {
  const board = makeBoard(8);
  const read = { ...board, readings: LIGHTBOX_READING_GROUPS.map((group) => (group === 'F' ? board.readings.find((entry) => entry.group === 'F') as LightboxReadingGroup : readGroup(group, options))) };
  return withOpinion(read, readOpinion(read, opinionOn(read), 'lbt-test-F-1'));
}

/**
 * An Opinion of `board` (groups A–E read): five observations citing its
 * tiers, its narrator's aside, its measured dialogue, three threads, two
 * objects, a familiar phrase and a movement, and three views of them.
 */
export function opinionOn(board: LightboxBoard): OpinionBody {
  const key = (label: string) => itemKey(board, label);
  return {
    observations: [
      { id: 'O1', text: 'Half of the beats the reading classified are the chapter\'s own, and they gather in Alice\'s talk to herself and the narrator\'s asides.',
        cites: [{ tile: key('Stock & signature · Cognitive economy') }, { tile: key('Stock & signature · Signature: The narrator'), quote: 0 }] },
      { id: 'O2', text: 'Speech is scarce, 12.5 per 100 words against the preset\'s range of 40 to 55, so the narration holds the floor.',
        cites: [{ measured: 'standout:dialogue' }] },
      { id: 'O3', text: 'Three threads stay open when the chapter ends, and the question of getting out has gone untouched since ¶5.',
        cites: [{ tile: key('Pressure · Thread: Where is') }, { tile: key('Pressure · Thread: How will') }, { tile: key('Pressure · Thread: Will the fall') }] },
      { id: 'O4', text: 'Objects do the plotting: the watch turns notice into pursuit, and the jar is taken down, found empty and put away within ¶7.',
        cites: [{ tile: key('Artifacts · Object: The watch') }, { tile: key('Artifacts · Object: The marmalade jar'), quote: 1 }] },
      { id: 'O5', text: 'The turn from idling to pursuit is carried by a familiar phrase the reading marks as carrying weight.',
        cites: [{ tile: key('Stock & signature · Familiar phrasing: burning'), quote: 0 }, { tile: key('Summary & movements · Movement: The chase') }] }
    ],
    views: {
      enthusiastic: {
        headline: 'A voice that sounds like no other turns a fall into a browse, and two objects quietly plot the way down.',
        body: 'Half of what the reading classified is the chapter\'s own: Alice\'s talk to herself and the narrator\'s asides. The watch and the jar carry the plot, and three open threads carry the reader past the last paragraph.',
        why: [
          { weight: 'strength', text: 'The signature beats gather where Alice talks to herself.', observations: ['O1'] },
          { weight: 'strength', text: 'Objects plot the way down, and open threads pull the reader on.', observations: ['O4', 'O3'] }
        ]
      },
      neutral: {
        headline: 'A distinctive voice carries a familiar descent; scarce speech trades pace for texture.',
        body: 'Voice and objects carry the chapter, and its threads stay open past the last paragraph. The scarce speech suits the fall and slows the chase, and the turn into pursuit leans on a familiar phrase.',
        why: [
          { weight: 'strength', text: 'Voice and objects do the plotting.', observations: ['O1', 'O4'] },
          { weight: 'even', text: 'The scarce speech fits the fall and slows the chase.', observations: ['O2'] },
          { weight: 'concern', text: 'The turn into pursuit rests on a stock phrase.', observations: ['O5'] }
        ]
      },
      blunt: {
        headline: 'Little speech slows the chase, and its turn rests on a stock phrase.',
        body: 'Speech sits at 12.5 per 100 words. In the fall that is the point; in the chase it costs momentum. The moment Alice starts to run is told in a stock phrase, and one thread is planted and never touched again.',
        why: [
          { weight: 'concern', text: 'Scarce speech slows the chase.', observations: ['O2'] },
          { weight: 'concern', text: 'The turn into pursuit is told in a stock phrase.', observations: ['O5'] },
          { weight: 'even', text: 'One thread is planted and never touched again.', observations: ['O3'] }
        ]
      }
    },
    friction: 'The tier mix and the threads are readings, not counts, and the slow middle may be the design rather than a cost.'
  };
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

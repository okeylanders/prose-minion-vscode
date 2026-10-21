/**
 * Builds the states and figures for ../README.md (epic decision 26: being
 * verbs count their contractions; dialogue is voice). Run once at the base
 * (LIGHTBOX_EVIDENCE_LABEL=before, on an export of `27b646a`) and once at
 * this branch's head (LIGHTBOX_EVIDENCE_LABEL=after); it uses only modules
 * both trees have.
 *
 * The board is built by the production `LightboxService` (prose stats, word
 * frequency, Style Flags, the numbers and craft steering's measure) against
 * the test fixture's synthetic writer average (`WRITER_AVERAGES`), and group
 * G is read by the production codec, quote verifier and assembly from an
 * answer written for this evidence. No provider is called.
 *
 * Source text: the opening of Chapter VII, "A Mad Tea-Party", of Lewis
 * Carroll's "Alice's Adventures in Wonderland" (1865, public domain), as PR
 * #161's fixture holds it (`teaPartyFixtures.ts`, Project Gutenberg EBook
 * #11), set in curly double quotes with curly apostrophes. The figures also
 * read the Alice fixtures this branch holds: the worked examples' opening
 * (¶1–¶8 of Chapter I) and `lightboxProseFixtures.ts`.
 *
 * Usage (from the repository root; keep $LIGHTBOX_EVIDENCE_DIR outside it):
 *   cp docs/pr-reviews/evidence/being-contractions/tools/build-states.test.ts packages/core/src/__tests__/
 *   LIGHTBOX_EVIDENCE_DIR=$DIR LIGHTBOX_EVIDENCE_LABEL=after npx jest packages/core/src/__tests__/build-states.test.ts
 *   rm packages/core/src/__tests__/build-states.test.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import type { LightboxBoard, LightboxReadingGroup, LightboxSteeringFigure } from '@messages';
import { MessageType } from '@messages';
import { LIGHTBOX_READING_GROUPS, emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { WRITER_AVERAGES } from '@/__tests__/infrastructure/lightbox/lightboxCraftFixtures';
import { frame, readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';
import { ALICE_HEADING, ALICE_PARAGRAPHS } from '@/__tests__/infrastructure/lightbox/lightboxProseFixtures';

const DIR = process.env.LIGHTBOX_EVIDENCE_DIR ?? '/tmp/being-contractions';
const LABEL = process.env.LIGHTBOX_EVIDENCE_LABEL ?? 'after';
const NOW = Date.UTC(2026, 9, 21, 12, 0, 0);

/** Chapter VII's opening, as Gutenberg sets it (PR #161's `TEA_PARTY_PARAGRAPHS`). */
const TEA_PARTY_GUTENBERG = [
  'There was a table set out under a tree in front of the house, and the March Hare and the Hatter were ' +
    'having tea at it: a Dormouse was sitting between them, fast asleep, and the other two were using it as ' +
    'a cushion, resting their elbows on it, and talking over its head. \'Very uncomfortable for the ' +
    'Dormouse,\' thought Alice; \'only, as it\'s asleep, I suppose it doesn\'t mind.\'',
  'The table was a large one, but the three were all crowded together at one corner of it: \'No room! No ' +
    'room!\' they cried out when they saw Alice coming. \'There\'s PLENTY of room!\' said Alice indignantly, ' +
    'and she sat down in a large arm-chair at one end of the table.',
  '\'Have some wine,\' the March Hare said in an encouraging tone.',
  'Alice looked all round the table, but there was nothing on it but tea. \'I don\'t see any wine,\' she remarked.',
  '\'There isn\'t any,\' said the March Hare.',
  '\'Then it wasn\'t very civil of you to offer it,\' said Alice angrily.',
  '\'It wasn\'t very civil of you to sit down without being invited,\' said the March Hare.',
  '\'I didn\'t know it was YOUR table,\' said Alice; \'it\'s laid for a great many more than three.\'',
  '\'Your hair wants cutting,\' said the Hatter. He had been looking at Alice for some time with great ' +
    'curiosity, and this was his first speech.',
  '\'You should learn not to make personal remarks,\' Alice said with some severity; \'it\'s very rude.\'',
  'The Hatter opened his eyes very wide on hearing this; but all he SAID was, \'Why is a raven like a writing-desk?\'',
  '\'Come, we shall have some fun now!\' thought Alice. \'I\'m glad they\'ve begun asking riddles.--I believe ' +
    'I can guess that,\' she added aloud.',
  '\'Do you mean that you think you can find out the answer to it?\' said the March Hare.',
  '\'Exactly so,\' said Alice.',
  '\'Then you should say what you mean,\' the March Hare went on.',
  '\'I do,\' Alice hastily replied; \'at least--at least I mean what I say--that\'s the same thing, you know.\'',
  '\'Not the same thing a bit!\' said the Hatter. \'You might just as well say that "I see what I eat" is ' +
    'the same thing as "I eat what I see"!\'',
  '\'You might just as well say,\' added the March Hare, \'that "I like what I get" is the same thing as ' +
    '"I get what I like"!\'',
  '\'You might just as well say,\' added the Dormouse, who seemed to be talking in his sleep, \'that "I ' +
    'breathe when I sleep" is the same thing as "I sleep when I breathe"!\''
];

/** PR #161's `setInCurlyDoubleQuotes`: apostrophes between letters as ’, dialogue in “…”, nested quotations in ‘…’. */
function curly(paragraph: string): string {
  let single = 0;
  let double = 0;
  return paragraph.replace(/['"]/g, (mark, offset: number) => {
    if (mark === '\'' && /\p{L}/u.test(paragraph[offset - 1] ?? '') && /\p{L}/u.test(paragraph[offset + 1] ?? '')) {
      return '’';
    }
    if (mark === '\'') {
      return single++ % 2 === 0 ? '“' : '”';
    }
    return double++ % 2 === 0 ? '‘' : '’';
  });
}

const TEA_PARTY = TEA_PARTY_GUTENBERG.map(curly);

/** Group G, written for this evidence: one narration note, and three on lines the characters speak. */
const ANSWER = frame('G', {
  version: 1,
  steering: {
    figures: [
      {
        stat: 'being-verbs',
        claim: 'Being verbs carry the quarrel at the table: most stand in what the guests say to each other, and the narration keeps a few to set the scene.',
        evidence: [{ para: 1, quote: 'a Dormouse was sitting between them' }, { para: 7, quote: 'It wasn’t very civil of you to sit down without being invited' }],
        notes: [
          {
            para: 1, quote: 'a Dormouse was sitting between them, fast asleep', stance: 'leans',
            why: 'The scene is set as a state: the sleeper is placed rather than shown.',
            nudge: 'A verb that puts the Dormouse there may be worth a look.',
            example: { before: 'a Dormouse was sitting', after: 'a Dormouse sat' }
          },
          {
            para: 7, quote: 'It wasn’t very civil of you to sit down without being invited', stance: 'leans',
            why: 'The Hare scolds through a plain state, as the whole table does.',
            nudge: 'A verb for the slight itself may be worth a look.',
            example: { before: 'without being invited', after: 'uninvited' }
          },
          {
            para: 12, quote: 'I’m glad they’ve begun asking riddles', stance: 'compensates',
            why: 'Alice answers from her own state, a habit of her speech in this scene.',
            nudge: null, example: null
          }
        ]
      },
      {
        stat: 'intensifiers',
        claim: 'Very and just gather in the guests’ complaints and retorts, swelling them; the narration has almost none.',
        evidence: [{ para: 6, quote: 'it wasn’t very civil of you to offer it' }],
        notes: [
          {
            para: 6, quote: 'it wasn’t very civil of you to offer it', stance: 'leans',
            why: 'The intensifier lifts a mild word in Alice’s retort.',
            nudge: 'A sharper word for the rudeness may be worth a look.', example: null
          }
        ]
      }
    ],
    friction: 'Nearly all of this excerpt is speech, so these figures read the characters more than the narrator.'
  }
});

async function boardOf(paragraphs: readonly string[], withG: boolean): Promise<LightboxBoard> {
  const service = new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    { enrichWithStandards: async (stats: object) => stats } as never,
    { now: () => NOW, mintBoardId: () => 'board-tea-party' },
    { measure: async () => WRITER_AVERAGES }
  );
  const built = await service.buildBoard({ kind: 'file', text: paragraphs.join('\n\n'), displayPath: 'Drafts/alice-chapter-7-opening.md' });
  if (built.kind !== 'board') {
    throw new Error('expected a board');
  }
  if (!withG) {
    return built.board;
  }
  const decoded = decodeLightboxGroup(ANSWER, { group: 'G', lenses: ['steering'], columnCount: paragraphs.length });
  let id = 0;
  const assembled = assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `lbt-evidence-G-${++id}`
  });
  const g: LightboxReadingGroup = {
    group: 'G', status: 'ok', lenses: ['steering'], model: 'provider/reader-model', tiles: assembled.tiles,
    withheldBlocks: assembled.withheldBlocks, withheldClaims: assembled.withheldClaims, frictions: assembled.frictions,
    quoteChecks: assembled.quoteChecks
  };
  return { ...built.board, readings: LIGHTBOX_READING_GROUPS.map((group) => (group === 'G' ? g : emptyLightboxReadingGroup(group))) };
}

const round = (value: number) => Math.round(value * 10) / 10;
const steeringLine = (figure: LightboxSteeringFigure) => ({
  stat: figure.stat, total: figure.total, rate: round(figure.rate), narration: figure.narration, dialogue: figure.dialogue,
  inShortRuns: figure.inShortRuns, constructions: Object.fromEntries(figure.constructions.map((row) => [row.construction, row.count]))
});

async function figuresOf(name: string, paragraphs: readonly string[]) {
  const board = await boardOf(paragraphs, false);
  const being = board.measured.numbers.rows.find((row) => row.stat === 'being-verbs');
  return {
    name,
    words: board.source.wordCount,
    beingVerbs: being?.instances,
    rate: round(being?.value ?? 0),
    writerRatio: being?.writer?.ratio === undefined ? null : Math.round(being.writer.ratio * 100) / 100,
    standouts: board.measured.numbers.rows.filter((row) => row.standout).map((row) => `${row.stat} ${row.standout?.direction}`),
    steering: board.measured.steering.figures.map(steeringLine)
  };
}

it(`builds the ${LABEL} states and figures`, async () => {
  fs.mkdirSync(path.join(DIR, 'states'), { recursive: true });
  const board = await boardOf(TEA_PARTY, true);
  const message = { type: MessageType.LIGHTBOX_BOARD, source: 'extension.lightbox', payload: { board, refusal: null }, timestamp: 1 };
  fs.writeFileSync(path.join(DIR, 'states', `${LABEL}.json`), `${JSON.stringify([message])}\n`);
  const figures = [
    await figuresOf('Alice ch. VII opening, curly (PR #161 fixture)', TEA_PARTY),
    await figuresOf('Alice ch. VII opening, Gutenberg single quotes (PR #161 fixture)', TEA_PARTY_GUTENBERG),
    await figuresOf('Alice ch. I ¶1–¶8 (worked examples D and G)', readWorkedExample('G').paragraphs),
    await figuresOf('Alice ch. I heading and five paragraphs (lightboxProseFixtures)', [ALICE_HEADING, ...ALICE_PARAGRAPHS])
  ];
  fs.writeFileSync(path.join(DIR, `figures-${LABEL}.json`), `${JSON.stringify(figures, null, 2)}\n`);
  const notes = board.readings.flatMap((group) => group.tiles).filter((tile) => tile.kind === 'steering-note');
  expect(notes.length).toBeGreaterThan(0);
});

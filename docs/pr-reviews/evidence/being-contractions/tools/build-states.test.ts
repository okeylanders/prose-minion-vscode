/**
 * Builds the states and figures for ../README.md (epic decision 26: being
 * verbs count their contractions; dialogue is voice). Run at the base
 * (LIGHTBOX_EVIDENCE_LABEL=before, on an export of `epic/lightbox` at
 * `1cb417c`: Slice 4F and the sentence rule), at this branch's first
 * pushed head (LIGHTBOX_EVIDENCE_LABEL=first, an export of `ab22ebd`,
 * before the writer's three additions) and at its head
 * (LIGHTBOX_EVIDENCE_LABEL=after); it uses only modules every tree has.
 *
 * The board is built by the production `LightboxService` (prose stats, word
 * frequency, Style Flags, the numbers and craft steering's measure) against
 * the test fixture's synthetic writer average (`WRITER_AVERAGES`), and group
 * G is read by the production codec, quote verifier and assembly from an
 * answer written for this evidence. No provider is called.
 *
 * Source text: the opening of Chapter VII, "A Mad Tea-Party", of Lewis
 * Carroll's "Alice's Adventures in Wonderland" (1865, public domain), PR
 * #161's fixture (`teaPartyFixtures.ts`, Project Gutenberg EBook #11), in
 * curly double quotes with curly apostrophes (`TEA_PARTY_CURLY`). The figures also
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
import { findBeingVerbs } from '@/tools/measure/beingVerbs';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { WRITER_AVERAGES } from '@/__tests__/infrastructure/lightbox/lightboxCraftFixtures';
import { frame, readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';
import { ALICE_HEADING, ALICE_PARAGRAPHS } from '@/__tests__/infrastructure/lightbox/lightboxProseFixtures';
import { TEA_PARTY_CURLY, TEA_PARTY_PARAGRAPHS } from '@/__tests__/tools/measure/passageProseStats/teaPartyFixtures';

const DIR = process.env.LIGHTBOX_EVIDENCE_DIR ?? '/tmp/being-contractions';
const LABEL = process.env.LIGHTBOX_EVIDENCE_LABEL ?? 'after';
const NOW = Date.UTC(2026, 9, 21, 12, 0, 0);

/** Chapter VII's opening: as Gutenberg sets it (single quotes), and set in curly double quotes. */
const TEA_PARTY_GUTENBERG = [...TEA_PARTY_PARAGRAPHS];
const TEA_PARTY = TEA_PARTY_CURLY.split('\n\n');

/**
 * Lines written for this evidence, with made-up names, holding the writer's
 * three additions (the next-word rule for 's, has before had, 'tis and
 * 'twas) beside possessives that stay possessives.
 */
const ADDITIONS = [
  '“Tobin’s late again,” said Ivy. “Everyone’s here but him, and the kettle’s boiling.”',
  'Ivy’s sister laughed. The Hatter’s watch had stopped, and Tobin’s own excuse was thin.',
  '“’Tis no matter,” said the cook. “’Twas ever so. It’s had its day, that kettle.”',
  '“I ain’t had a cup,” said Tobin, “and the cat’s asleep in the teapot.”'
];

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
    steering: board.measured.steering.figures.map(steeringLine),
    // Each form the detector found, paragraph by paragraph, as written.
    forms: paragraphs.map((paragraph) => findBeingVerbs(paragraph).map((match) => match.text))
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
    await figuresOf('Alice ch. I heading and five paragraphs (lightboxProseFixtures)', [ALICE_HEADING, ...ALICE_PARAGRAPHS]),
    await figuresOf('Lines written for the writer\'s three additions (made-up names)', ADDITIONS)
  ];
  fs.writeFileSync(path.join(DIR, `figures-${LABEL}.json`), `${JSON.stringify(figures, null, 2)}\n`);
  const notes = board.readings.flatMap((group) => group.tiles).filter((tile) => tile.kind === 'steering-note');
  expect(notes.length).toBeGreaterThan(0);
});

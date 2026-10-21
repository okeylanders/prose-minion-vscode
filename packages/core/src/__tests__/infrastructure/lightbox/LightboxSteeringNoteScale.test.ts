/**
 * Craft steering's notes on a long paragraph, in work that grows with it
 * (PR #162 F-01). A note's quote check, the place of its instance (dialogue
 * is voice) and its example's anchor each ask one paragraph the same
 * questions: which instances of the figure it holds, which of them stand in
 * dialogue, and whether a span takes in speech. Each check used to run the
 * figure's detector again (being verbs tag the paragraph) and to scan every
 * dialogue span for every instance, so one paragraph of short spoken lines
 * took seconds. Work is counted, not timed: the figure's detector and the
 * dialogue matcher are wrapped to count their calls and every read of a
 * dialogue span's start, through fresh assembly, carry and Bring. One
 * coarse wall-clock bound covers the largest case. Every line is a
 * synthetic sentence written for these tests.
 */
import type { LightboxBoard, LightboxReadingGroup, LightboxReadingTile, LightboxSteeringNoteTile } from '@messages';
import { LIGHTBOX_READING_GROUPS, emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import * as dialogueSpans from '@/utils/dialogueSpans';
import { LIGHTBOX_NUMBER_PATTERNS } from '@/infrastructure/lightbox/LightboxNumbers';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { carryLightboxReadings } from '@/infrastructure/lightbox/LightboxStaleReadings';
import { prepareLightboxTileHandoff } from '@/infrastructure/lightbox/LightboxTileHandoff';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';
import { frame } from './lightboxReadingFixtures';

/** A spoken line with a contraction the tagger decides, and a line of narration: 5 words, one dialogue span. */
const UNIT = '“It’s cold.” It was quiet.';
/** The same shape with whole words only, so no tagger runs: 5 words, one dialogue span. */
const PLAIN_UNIT = '“I was.” It was quiet.';
const QUOTE = 'It was quiet';
const EXAMPLE = { before: 'It was quiet', after: 'Silence filled the room' };
const NUDGE = 'An action for the silence may be worth a look.';

/** `count` copies of `unit`, as one paragraph. */
const repeated = (unit: string, count: number) => Array.from({ length: count }, () => unit).join(' ');

/** What the checks did: detector calls, dialogue matcher calls, and reads of a dialogue span's start. */
const work = { detections: 0, matches: 0, starts: 0 };
const detect = LIGHTBOX_NUMBER_PATTERNS['being-verbs'];
const match = dialogueSpans.findDialogueSpans;
const counted = (span: dialogueSpans.DialogueSpan): dialogueSpans.DialogueSpan => ({
  get start() {
    work.starts += 1;
    return span.start;
  },
  end: span.end,
  closed: span.closed
});
const resetWork = () => {
  work.detections = 0;
  work.matches = 0;
  work.starts = 0;
};

beforeEach(() => {
  resetWork();
  jest.spyOn(LIGHTBOX_NUMBER_PATTERNS, 'being-verbs').mockImplementation((text: string) => {
    work.detections += 1;
    return detect(text);
  });
  jest.spyOn(dialogueSpans, 'findDialogueSpans').mockImplementation((text: string) => {
    work.matches += 1;
    return match(text).map(counted);
  });
});
afterEach(() => jest.restoreAllMocks());

/** Group G with four leaning notes, each on `QUOTE` in the paragraph given, each with the same example. */
function readG(paragraphs: readonly string[], notesAt: readonly number[] = [1, 1, 1, 1]): LightboxReadingGroup {
  const response = frame('G', {
    version: 1,
    steering: {
      figures: [{
        stat: 'being-verbs', claim: 'A plain state closes each spoken line.', evidence: [{ para: notesAt[0], quote: QUOTE }],
        notes: notesAt.map((para) => ({ para, quote: QUOTE, stance: 'leans', why: 'A state follows each line.', nudge: NUDGE, example: EXAMPLE }))
      }],
      friction: 'The lines repeat.'
    }
  });
  const decoded = decodeLightboxGroup(response, { group: 'G', lenses: ['steering'], columnCount: paragraphs.length });
  let id = 0;
  const assembled = assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `g${++id}`
  });
  return {
    group: 'G', status: 'ok', lenses: ['steering'], tiles: assembled.tiles, withheldBlocks: assembled.withheldBlocks,
    withheldClaims: assembled.withheldClaims, frictions: assembled.frictions, quoteChecks: assembled.quoteChecks
  };
}

const notesOf = (group: LightboxReadingGroup) =>
  group.tiles.filter((tile): tile is LightboxSteeringNoteTile => tile.kind === 'steering-note');
const shown = (group: LightboxReadingGroup) =>
  notesOf(group).map((note) => [note.evidence[0]?.paragraph, note.nudge ?? null, note.example ?? null, note.exampleWithheld ?? null]);
const kept = (paragraph: number) => [paragraph, NUDGE, EXAMPLE, null];

/** Fresh assembly of four notes on one paragraph of `count` units, with the work it did. */
function freshOn(unit: string, count: number) {
  const paragraphs = [repeated(unit, count)];
  resetWork();
  const group = readG(paragraphs);
  return { group, paragraphs, work: { ...work } };
}

describe('fresh: four notes on one long paragraph do the paragraph\'s work once (PR #162 F-01)', () => {
  it('detects the paragraph once and finds its dialogue once, for the reading and all four notes', () => {
    const { group, work: done } = freshOn(UNIT, 250);
    expect(shown(group)).toEqual([kept(1), kept(1), kept(1), kept(1)]);
    expect([done.detections, done.matches]).toEqual([1, 1]);
  });

  it('reads each dialogue span\'s start a bounded number of times: 376,500 reads before the fix, at 250 spans', () => {
    const { work: done } = freshOn(PLAIN_UNIT, 250);
    expect(done.starts).toBeLessThanOrEqual(4 * 250);
  });

  it('grows linearly: four times the spans is about four times the work, not sixteen', () => {
    const small = freshOn(PLAIN_UNIT, 250).work.starts;
    const large = freshOn(PLAIN_UNIT, 1_000).work.starts;
    expect(large).toBeLessThanOrEqual(5 * small);
    expect(large).toBeLessThanOrEqual(4 * 1_000);
  });

  it('keeps the outcome where the same lines stand in many short paragraphs', () => {
    const paragraphs = Array.from({ length: 100 }, () => repeated(UNIT, 10));
    resetWork();
    const group = readG(paragraphs, [1, 25, 50, 100]);
    expect(shown(group)).toEqual([kept(1), kept(25), kept(50), kept(100)]);
    // One detection and one dialogue match per paragraph a check reads, never one per check.
    expect([work.detections, work.matches]).toEqual([4, 4]);
  });

  it('assembles four notes on a 50,000-word paragraph well inside a coarse bound', () => {
    const started = Date.now();
    const { group } = freshOn(PLAIN_UNIT, 10_000);
    // Before the fix this took seconds; now it takes a fraction of one.
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(shown(group)).toEqual([kept(1), kept(1), kept(1), kept(1)]);
  }, 60_000);
});

describe('carried and brought: the same work, done once per text (PR #162 F-01)', () => {
  it('carries four notes to a new place in one detection and one dialogue match, with each example', () => {
    const { group, paragraphs } = freshOn(UNIT, 250);
    const moved = ['A new opening line stands here.', ...paragraphs];
    resetWork();
    const [carried] = carryLightboxReadings([group], { readAgainst: 'old', paragraphs: moved, averageWordsPerSentence: 4 });
    expect(shown(carried)).toEqual([kept(2), kept(2), kept(2), kept(2)]);
    expect([work.detections, work.matches]).toEqual([1, 1]);
    expect(work.starts).toBeLessThanOrEqual(4 * 250);
  });

  it('brings a note in one detection and one dialogue match, with its example; none again on the text it was read on', () => {
    const { group, paragraphs } = freshOn(UNIT, 250);
    const board: LightboxBoard = {
      ...makeBoard(1),
      readings: LIGHTBOX_READING_GROUPS.map((id) => (id === 'G' ? group : emptyLightboxReadingGroup(id)))
    };
    const tile = notesOf(group)[3] as LightboxReadingTile;
    const bring = (text: readonly string[]) => {
      resetWork();
      const prepared = prepareLightboxTileHandoff({ kind: 'tile', boardId: board.boardId, tileId: tile.id }, board, text);
      expect(prepared.ok && prepared.handoff.tile.points.slice(1)).toEqual([
        { label: 'Nudge', text: NUDGE },
        { label: 'One way it could go', text: 'It was quiet → Silence filled the room' }
      ]);
      return { ...work };
    };
    // The same words, read again into a new array: indexed once.
    const again = bring([...paragraphs]);
    expect([again.detections, again.matches]).toEqual([1, 1]);
    expect(again.starts).toBeLessThanOrEqual(4 * 250);
    // The very text the reading was assembled on: its index is reused.
    expect(bring(paragraphs)).toEqual({ detections: 0, matches: 0, starts: 0 });
  });
});

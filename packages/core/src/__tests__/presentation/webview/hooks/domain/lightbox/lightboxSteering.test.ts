/**
 * Craft steering's pure webview helpers (Slice 4F): each figure's section
 * worded from the host's measurement, a measured row as an inspector item
 * that lights its paragraphs, a persisted pin parsed back strictly, and the
 * inspector's details for a reading and a note. The counts are the board
 * fixture's synthetic ones; the readings come from group G's worked example
 * over "Alice's Adventures in Wonderland" (1865, public domain).
 */
import type { LightboxBoard, LightboxReadingTile } from '@messages';
import { LIGHTBOX_READING_GROUPS, emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import {
  lightboxSteeringDetails,
  lightboxSteeringItem,
  lightboxSteeringRefKey,
  lightboxSteeringSections,
  parseLightboxSteeringRef
} from '@hooks/domain/lightbox/lightboxSteering';
import { lightboxItemKey, parseLightboxItemRef, resolveLightboxItem } from '@hooks/domain/lightbox/lightboxItems';
import { makeBoard } from './lightboxBoardFixtures';
import { readGroup } from './lightboxReadingBoardFixtures';

const READ: LightboxBoard = {
  ...makeBoard(8),
  readings: LIGHTBOX_READING_GROUPS.map((group) => (group === 'G' ? readGroup('G') : emptyLightboxReadingGroup(group)))
};
const tileTitled = (title: string) => READ.readings.flatMap((group) => group.tiles).find((tile) => tile.title === title) as LightboxReadingTile;

describe('lightboxSteeringSections', () => {
  it('words each figure from the host\'s measurement, with each construction\'s share of it', () => {
    const [being, adverbs, intensifiers] = lightboxSteeringSections(READ);
    expect([being.stat, being.label, being.headline, being.split, being.runs, being.weakVerbs]).toEqual([
      'being-verbs', 'Being verbs', '3 being verbs · 25 per 1,000 words', '2 in narration · 1 in dialogue',
      '1 in runs of short sentences (3 or more in a row, each 8 words or fewer)', undefined
    ]);
    expect(being.segments.map((segment) => [segment.label, segment.count, Math.round(segment.share * 10) / 10])).toEqual([
      ['be + adjective', 1, 33.3], ['be + -ing', 1, 33.3], ['be + past participle', 0, 0], ['there or it + be', 1, 33.3], ['other', 0, 0]
    ]);
    expect(adverbs.weakVerbs).toBe('Weak verbs among them: 1');
    expect(adverbs.segments.map((segment) => segment.share)).toEqual([75, 0, 25, 0, 0]);
    // A figure the chapter holds none of draws no share at all.
    expect([intensifiers.headline, intensifiers.segments.map((segment) => segment.share)])
      .toEqual(['0 intensifiers and fillers · 0 per 1,000 words', [0, 0, 0]]);
    expect([being.reading?.title, adverbs.reading?.title, intensifiers.reading?.title])
      .toEqual(['Being verbs', 'Adverbs (-ly)', 'Intensifiers and fillers']);
  });

  it('draws no reading for an unread figure', () => {
    expect(lightboxSteeringSections(makeBoard(8)).map((section) => section.reading)).toEqual([undefined, undefined, undefined]);
  });
});

describe('a measured steering row as an inspector item', () => {
  it('lights the paragraphs that hold the figure, or one construction of it', () => {
    expect(lightboxSteeringItem(READ, { kind: 'steering', stat: 'adverbs' })).toEqual({
      ref: { kind: 'steering', stat: 'adverbs' },
      register: 'measured',
      where: 'Measure · Craft steering',
      title: 'Adverbs (-ly)',
      claim: '4 -ly words, 20 per 1,000 words: 4 in narration and 0 in dialogue, lit here. ' +
        'Counted by code, the same count as the numbers; nothing here is a reading.',
      paragraphs: [3, 5],
      support: ['4 -ly words', '20 per 1,000 words']
    });
    const row = lightboxSteeringItem(READ, { kind: 'steering', stat: 'adverbs', construction: 'before-adjective' });
    expect([row?.title, row?.claim, row?.paragraphs]).toEqual([
      'Adverbs (-ly): before an adjective',
      '1 of the chapter\'s 4 -ly words, sorted by the words around each, lit here. Counted by code; nothing here is a reading.',
      [5]
    ]);
  });

  it('resolves no construction the board did not measure', () => {
    const untagged: LightboxBoard = {
      ...READ,
      measured: { ...READ.measured, steering: { ...READ.measured.steering, tagged: false, figures: READ.measured.steering.figures.map((figure) => ({ ...figure, constructions: [] })) } }
    };
    expect(lightboxSteeringItem(untagged, { kind: 'steering', stat: 'adverbs', construction: 'with-verb' })).toBeUndefined();
    expect(lightboxSteeringItem(untagged, { kind: 'steering', stat: 'adverbs' })?.paragraphs).toEqual([3, 5]);
  });

  it('keys, parses and resolves a pinned row through the item registry, and refuses a construction of another figure', () => {
    const ref = { kind: 'steering', stat: 'being-verbs', construction: 'expletive' } as const;
    expect(lightboxSteeringRefKey(ref)).toBe('steering:being-verbs:expletive');
    expect(lightboxItemKey(ref)).toBe(lightboxSteeringRefKey(ref));
    expect(parseLightboxItemRef(JSON.parse(JSON.stringify(ref)))).toEqual(ref);
    expect(resolveLightboxItem(READ, ref)?.paragraphs).toEqual([4]);
    expect(parseLightboxSteeringRef({ stat: 'being-verbs', construction: 'generic' })).toBeNull();
    expect(parseLightboxSteeringRef({ stat: 'passive-voice' })).toBeNull();
    expect(parseLightboxSteeringRef({ stat: 'intensifiers' })).toEqual({ kind: 'steering', stat: 'intensifiers' });
  });
});

describe('lightboxSteeringDetails', () => {
  it('gives a reading its figure, measured, and how its quotes were checked', () => {
    expect(lightboxSteeringDetails(tileTitled('Being verbs'), READ)).toEqual([
      { label: 'Figure', value: 'Being verbs', measured: '3 · 25 per 1,000' },
      { label: 'Instances', value: 'Each quote holds one, checked by the detector that counted the figure' }
    ]);
  });

  it('gives a note its stance, its nudge and its example marked as an illustration, and a note that earns neither', () => {
    expect(lightboxSteeringDetails(tileTitled('Adverbs (-ly) · note I'), READ)?.slice(0, 3)).toEqual([
      { label: 'Stance', value: 'Leans: The sentence leans on it where another choice could carry the meaning.' },
      { label: 'Worth a look', value: 'A verb that holds the drop itself may be worth a look, so the speed lives in the action.' },
      { label: 'One way it could go', value: 'dipped suddenly down → plunged (an illustration, not your text)' }
    ]);
    expect(lightboxSteeringDetails(tileTitled('Adverbs (-ly) · note II'), READ)?.map((row) => row.label))
      .toEqual(['Stance', 'Figure', 'Instances']);
  });

  it('says nothing of another kind', () => {
    expect(lightboxSteeringDetails({ ...tileTitled('Being verbs'), kind: 'headline' } as LightboxReadingTile, READ)).toBeUndefined();
  });
});

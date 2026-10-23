/**
 * The webview's group E helpers (Slice 4C), pure over a board: what the
 * Sections lane says for each signal, a thread's track across the ribbon,
 * each read lane's note by phase, and the inspector's details. Readings are
 * the worked example's over ¶1–¶8 of "Alice's Adventures in Wonderland"
 * (1865, public domain).
 */
import type { LightboxBoard, LightboxPressureThreadTile, LightboxReadingGroup } from '@messages';
import {
  lightboxEngagementLane,
  lightboxMovementsLane,
  lightboxPlotDetails,
  lightboxPressureLaneView,
  lightboxSectionsNote,
  lightboxThreadMeta,
  lightboxThreadTrack
} from '@hooks/domain/lightbox/lightboxPlot';
import { emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import { makeBoard } from './lightboxBoardFixtures';
import { readGroup } from './lightboxReadingBoardFixtures';

/* eslint-disable @typescript-eslint/naming-convention -- the Sections signals are kebab-case protocol literals. */

const withE = (group: LightboxReadingGroup = readGroup('E')): LightboxBoard =>
  ({ ...makeBoard(8), readings: [...makeBoard(8).readings.slice(0, 4), group] });
const threadTitled = (board: LightboxBoard, title: string) =>
  board.readings.flatMap((group) => group.tiles).find((tile) => tile.title === title) as LightboxPressureThreadTile;

describe('the Sections note', () => {
  const fired = { headings: [], 'scene-breaks': [], 'chapter-lines': [] };
  it('names the signal that divides the chapter, and how many sections it makes', () => {
    const two = [{ from: 1, to: 2, label: 'A' }, { from: 3, to: 4, label: 'B' }];
    expect(lightboxSectionsNote({ signal: 'headings', level: 2, sections: two, fired })).toBe('2 sections from headings (level 2 and above), found by code.');
    expect(lightboxSectionsNote({ signal: 'scene-breaks', sections: two, fired })).toBe('2 scenes from scene-break lines, found by code.');
    expect(lightboxSectionsNote({ signal: 'chapter-lines', sections: two, fired })).toBe('2 sections from chapter lines, found by code.');
  });

  it('says what fired without dividing the chapter, at most four places each', () => {
    expect(lightboxSectionsNote({ signal: 'none', sections: [], fired: { headings: [1], 'scene-breaks': [2, 3, 4, 5, 6], 'chapter-lines': [] } }))
      .toBe('Found one heading (¶1) and 5 scene breaks (¶2, ¶3, ¶4, ¶5), which does not divide the chapter into two or more sections, so the ribbon stays in paragraphs.');
  });
});

describe('a thread across the ribbon', () => {
  const board = withE();
  it('marks its plant, builds, resolution, the paragraphs it runs open through, and its open end', () => {
    expect(lightboxThreadTrack(threadTitled(board, 'Will the fall ever end?'), board.ribbon))
      .toEqual(['none', 'none', 'none', 'none', 'none', 'plant', 'esc', 'open']);
    expect(lightboxThreadTrack(threadTitled(board, 'What is in the jar she takes down?'), board.ribbon))
      .toEqual(['none', 'none', 'none', 'none', 'none', 'none', 'plant', 'none']);
    // On a bucketed ribbon the plant wins its column.
    expect(lightboxThreadTrack(threadTitled(board, 'Will the fall ever end?'), [{ from: 1, to: 4 }, { from: 5, to: 6 }, { from: 7, to: 8 }]))
      .toEqual(['none', 'plant', 'esc']);
  });

  it('says where it is planted, builds and ends, and a dormant thread as never touched again', () => {
    expect(lightboxThreadMeta(threadTitled(board, 'Where is the Rabbit hurrying, and why is it late?'))).toBe('¶4 · builds ¶4 → still open');
    expect(lightboxThreadMeta(threadTitled(board, 'How will she get out again?'))).toBe('¶5 · dormant, never touched again');
    expect(lightboxThreadMeta(threadTitled(board, 'What is in the jar she takes down?'))).toBe('¶7 → resolved ¶7');
  });
});

describe('the read lanes\' notes', () => {
  it('says a lane is off, not read yet, or drawn, and when it is stale', () => {
    const unread = withE(emptyLightboxReadingGroup('E'));
    expect(lightboxMovementsLane(unread, true).note).toBe('Summary & movements is a reading. Not analyzed yet.');
    expect(lightboxMovementsLane(withE(), false).note).toBe('The Summary & movements lens is off.');
    expect(lightboxPressureLaneView(unread, true)).toEqual({ stale: false, note: 'Pressure is a reading. Not analyzed yet.' });
    expect(lightboxPressureLaneView(withE(), true).counts).toEqual([0, 0, 0, 1, 2, 3, 3, 3]);
    const stale = withE({ ...readGroup('E'), staleLenses: [{ lens: 'summary', readAgainst: 'old' }] });
    expect(lightboxMovementsLane(stale, true)).toMatchObject({
      stale: true,
      note: 'Read against an earlier version of this chapter: each movement starts where its boundary quote now stands.'
    });
  });

  it('says the movements were withheld for not tiling only when no block was withheld (Slice 4H)', () => {
    // A reply cut off at the output ceiling inside the summary block: the block is withheld, and its frame says why.
    const cut = withE({
      ...readGroup('E'),
      tiles: readGroup('E').tiles.filter((tile) => tile.lens !== 'summary'),
      withheldBlocks: [{ kind: 'synopsis', lens: 'summary', reason: 'The reply reached the output ceiling before this block finished.' }]
    });
    expect(lightboxMovementsLane(cut, true)).toMatchObject({ bands: [], note: 'The movements were withheld: Summary & movements says why.' });
    const untiled = withE({ ...readGroup('E'), tiles: readGroup('E').tiles.filter((tile) => tile.kind !== 'movement') });
    expect(lightboxMovementsLane(untiled, true).note).toBe('The movements were withheld: they did not tile the chapter.');
  });

  it('keeps engagement apart from tension, and says why it is absent', () => {
    expect(lightboxEngagementLane(withE(), []).bands.map((band) => band.value.level)).toEqual(['low', 'high', 'medium']);
    expect(lightboxEngagementLane(withE(), []).note).toContain('it is not the tension score');
    expect(lightboxEngagementLane(withE(), ['summary']).note).toBe('Engagement sits on the movements: turn on Summary & movements to read it.');
    expect(lightboxEngagementLane(withE(), ['template']).note).toBe('The Template & freshness lens is off.');
    const withheld = readGroup('E', { mutate: (body) => { body.template.engagement = [{ movement: 'IV', level: 'low' }]; } });
    expect(lightboxEngagementLane(withE(withheld), []).note).toBe('No engagement on the board: it was withheld, or there are no movements to sit on.');
  });
});

describe('the inspector\'s details for group E', () => {
  const board = withE();
  const tile = (title: string) => board.readings.flatMap((group) => group.tiles).find((candidate) => candidate.title === title)!;

  it('shows a movement\'s range, boundary, the set\'s check and its engagement', () => {
    expect(lightboxPlotDetails(tile('The chase'), board)).toEqual([
      { label: 'Range', value: 'Movement II of 3', measured: '¶4–¶5' },
      { label: 'Boundary', value: 'Found in ¶4, its first paragraph, by code' },
      { label: 'The set', value: 'Contiguous, no overlap, ¶1 to ¶8, checked by code' },
      { label: 'Engagement', value: 'High: a reading of pull, not tension' }
    ]);
  });

  it('shows an object\'s counted mentions and the host\'s reason when it set "planted, unused" aside', () => {
    const watch = tile('The watch');
    expect(lightboxPlotDetails(watch, board)).toEqual([
      { label: 'Terms', value: 'watch' },
      { label: 'Mentions', value: 'Counted by code, each mention once', measured: `×${watch.kind === 'artifact' ? watch.mentions : 0} · first ¶4` },
      { label: 'Arc', value: 'taken out → looked at, then gone' }
    ]);
    const kept = { ...watch, plantedUnused: false, unusedWithheld: 'A later mention stands far from its first.' } as typeof watch;
    expect(lightboxPlotDetails(kept, board)?.at(-1)).toEqual({ label: 'Planted, unused', value: 'A later mention stands far from its first.' });
  });

  it('is undefined for any other group\'s kind', () => {
    const other = readGroup('D').tiles[0];
    expect(lightboxPlotDetails(other, board)).toBeUndefined();
  });
});

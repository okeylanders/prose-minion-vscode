/**
 * The read window's packing at its edges (PR 126 review F-01): a window with
 * no usable room delivers nothing and continues from the first entry; a cut
 * never hands back more than the room it was given.
 */

import { buildWorkshopRecallDocument } from '@/application/services/workshop/recall/WorkshopRecallDocument';
import {
  packWorkshopRecallReadWindow,
  WORKSHOP_RECALL_BLOCK_SEPARATOR
} from '@/application/services/workshop/recall/WorkshopRecallReadWindow';
import type { WorkshopRecallReadRange } from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import { writerTurn } from '@/__tests__/application/services/workshop/transcript/workshopTranscriptFixtures';
import { recallSession } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';

const rangeOf = (contents: string[]): WorkshopRecallReadRange => {
  const document = buildWorkshopRecallDocument(recallSession({
    sessionId: 's-1',
    turns: contents.map((content, index) => writerTurn(`t-${index + 1}`, { content }))
  }));
  return {
    from: 1,
    to: contents.length,
    entries: document.entries,
    firstTurnId: document.entries[0].turnId,
    lastTurnId: document.entries.at(-1)!.turnId
  };
};

const windowText = (blocks: readonly string[]): string => blocks.join(WORKSHOP_RECALL_BLOCK_SEPARATOR);

describe('packWorkshopRecallReadWindow', () => {
  it.each([-500, 0, 1, 2, 3, 4])('delivers nothing from a window with %p characters of room', (budget) => {
    const range = rangeOf([`Opening. ${'salt '.repeat(2_000)}`, 'Short.']);

    expect(packWorkshopRecallReadWindow([range], 'America/Chicago', budget)).toEqual({
      blocks: [],
      delivered: [],
      continuation: [{ from: 1, to: 2 }]
    });
  });

  it('cuts a first entry too large for its window to that window, never more', () => {
    for (const budget of [400, 401, 437, 1_000, 2_500]) {
      const range = rangeOf([`Opening. ${'salt '.repeat(2_000)}`, 'Short.']);
      const window = packWorkshopRecallReadWindow([range], 'America/Chicago', budget);

      expect(windowText(window.blocks).length + WORKSHOP_RECALL_BLOCK_SEPARATOR.length).toBeLessThanOrEqual(budget);
      expect(window.delivered).toEqual([{ from: 1, to: 1, firstTurnId: 't-1', lastTurnId: 't-1', entryCount: 1 }]);
      expect(window.continuation).toEqual([{ from: 2, to: 2 }]);
      expect(window.truncatedEntry?.shownCharacters).toBeLessThan(window.truncatedEntry!.totalCharacters);
    }
  });

  it('never cuts an entry to less than a readable head', () => {
    const range = rangeOf([`Opening. ${'salt '.repeat(2_000)}`]);
    const window = packWorkshopRecallReadWindow([range], 'America/Chicago', 250);

    expect(window).toEqual({ blocks: [], delivered: [], continuation: [{ from: 1, to: 1 }] });
  });

  it('cuts at a word boundary only when one exists near the limit', () => {
    const range = rangeOf([`${'x'.repeat(5_000)} tail`]);
    const window = packWorkshopRecallReadWindow([range], 'America/Chicago', 600);

    expect(window.delivered).toHaveLength(1);
    expect(windowText(window.blocks).length + WORKSHOP_RECALL_BLOCK_SEPARATOR.length).toBeLessThanOrEqual(600);
    expect(windowText(window.blocks)).not.toContain('tail');
  });
});

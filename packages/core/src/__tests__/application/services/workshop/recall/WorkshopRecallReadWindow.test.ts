/**
 * The read window's packing at its edges (PR 126 review F-01): a window with
 * no usable room delivers nothing and continues from the first entry; a cut
 * never hands back more than the room it was given. And discussion detail
 * (D10): each tool report collapses to one line, everything else stays whole.
 */

import { buildWorkshopRecallDocument } from '@/application/services/workshop/recall/WorkshopRecallDocument';
import {
  packWorkshopRecallReadWindow,
  WORKSHOP_RECALL_BLOCK_SEPARATOR
} from '@/application/services/workshop/recall/WorkshopRecallReadWindow';
import type { WorkshopRecallReadRange } from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import {
  dividerTurn,
  fixtureTurn,
  writerTurn
} from '@/__tests__/application/services/workshop/transcript/workshopTranscriptFixtures';
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

    expect(packWorkshopRecallReadWindow([range], 'America/Chicago', budget, 'full')).toEqual({
      blocks: [],
      delivered: [],
      continuation: [{ from: 1, to: 2 }],
      collapsed: []
    });
  });

  it('cuts a first entry too large for its window to that window, never more', () => {
    for (const budget of [400, 401, 437, 1_000, 2_500]) {
      const range = rangeOf([`Opening. ${'salt '.repeat(2_000)}`, 'Short.']);
      const window = packWorkshopRecallReadWindow([range], 'America/Chicago', budget, 'full');

      expect(windowText(window.blocks).length + WORKSHOP_RECALL_BLOCK_SEPARATOR.length).toBeLessThanOrEqual(budget);
      expect(window.delivered).toEqual([{ from: 1, to: 1, firstTurnId: 't-1', lastTurnId: 't-1', entryCount: 1 }]);
      expect(window.continuation).toEqual([{ from: 2, to: 2 }]);
      expect(window.truncatedEntry?.shownCharacters).toBeLessThan(window.truncatedEntry!.totalCharacters);
    }
  });

  it('never cuts an entry to less than a readable head', () => {
    const range = rangeOf([`Opening. ${'salt '.repeat(2_000)}`]);
    const window = packWorkshopRecallReadWindow([range], 'America/Chicago', 250, 'full');

    expect(window).toEqual({ blocks: [], delivered: [], continuation: [{ from: 1, to: 1 }], collapsed: [] });
  });

  it('cuts at a word boundary only when one exists near the limit', () => {
    const range = rangeOf([`${'x'.repeat(5_000)} tail`]);
    const window = packWorkshopRecallReadWindow([range], 'America/Chicago', 600, 'full');

    expect(window.delivered).toHaveLength(1);
    expect(windowText(window.blocks).length + WORKSHOP_RECALL_BLOCK_SEPARATOR.length).toBeLessThanOrEqual(600);
    expect(windowText(window.blocks)).not.toContain('tail');
  });
});

describe('discussion detail (D10)', () => {
  const REPORT_BODY = 'SENTINEL-TOOL-REPORT-BODY';
  const toolReply = (id: string, toolLabel: string, content: string, artifact: 'tool_report' | 'direct_tool_response' = 'tool_report') =>
    fixtureTurn(id, { participant: 'tool', artifact, toolLabel, personaId: undefined, personaLabel: undefined, content });
  const document = buildWorkshopRecallDocument(recallSession({
    sessionId: 's-1',
    turns: [
      writerTurn('t-1', { content: 'Run the report, then tell me what you think.' }),
      // 2,431 words: the sentinel, then 2,430 more.
      toolReply('t-2', 'Stock & Signature', `${REPORT_BODY} ${'beat '.repeat(2_430)}`),
      fixtureTurn('t-3', { content: 'Start with the laughter; the cup can wait.' }),
      fixtureTurn('t-4', { participant: 'guest', personaId: 'margot', personaLabel: 'Margot', content: 'End on the cup.' }),
      dividerTurn('t-5', 'excerpt_revision', 'Excerpt revised to v2.'),
      writerTurn('t-6', { artifact: 'direct_tool_message', toolLabel: 'Prose Assistant', content: 'Tighten this.' }),
      toolReply('t-7', 'Prose Assistant', `${REPORT_BODY} tightened.`, 'direct_tool_response'),
      toolReply('t-8', 'P'.repeat(300), REPORT_BODY)
    ]
  }));
  const range: WorkshopRecallReadRange = {
    from: 1,
    to: 8,
    entries: document.entries,
    firstTurnId: 't-1',
    lastTurnId: 't-8'
  };
  const discussion = packWorkshopRecallReadWindow([range], 'America/Chicago', 1_000_000, 'discussion');
  const text = windowText(discussion.blocks);

  it('never shows a tool report’s body', () => {
    expect(text).not.toContain(REPORT_BODY);
    expect(text).not.toContain('beat beat');
  });

  it('collapses each tool report to one line naming its turn, speaker, and word count', () => {
    expect(text).toContain(
      '[turn 2 · 9:30 AM · Stock & Signature report · 2,431 words · read it in full with <turns>2</turns>]'
    );
    // A private instrument reply keeps its marker; a saved-file speaker is clipped.
    expect(text).toContain(
      '[turn 7 · 9:30 AM · Prose Assistant report · private · 2 words · read it in full with <turns>7</turns>]'
    );
    expect(text).toContain(`[turn 8 · 9:30 AM · ${'P'.repeat(199)}… report · 1 word · read it in full with <turns>8</turns>]`);
    expect(discussion.collapsed).toEqual([
      { position: 2, turnId: 't-2' },
      { position: 7, turnId: 't-7' },
      { position: 8, turnId: 't-8' }
    ]);
  });

  it('keeps the writer’s messages, host and guest replies, and events whole', () => {
    expect(text).toContain('[turn 1 · 9:30 AM · Writer]\nRun the report, then tell me what you think.');
    expect(text).toContain('[turn 3 · 9:30 AM · Jill]\nStart with the laughter; the cup can wait.');
    expect(text).toContain('[turn 4 · 9:30 AM · Margot]\nEnd on the cup.');
    expect(text).toContain('[turn 5 · 9:30 AM · event] Excerpt revised to v2.');
    expect(text).toContain('[turn 6 · 9:30 AM · Writer · private with Prose Assistant]\nTighten this.');
    expect(discussion.delivered).toEqual([{ from: 1, to: 8, firstTurnId: 't-1', lastTurnId: 't-8', entryCount: 8 }]);
  });

  it('shows the whole report in full detail', () => {
    const full = packWorkshopRecallReadWindow([range], 'America/Chicago', 1_000_000, 'full');

    expect(windowText(full.blocks)).toContain(`[turn 2 · 9:30 AM · Stock & Signature]\n${REPORT_BODY} beat`);
    expect(full.collapsed).toEqual([]);
  });
});

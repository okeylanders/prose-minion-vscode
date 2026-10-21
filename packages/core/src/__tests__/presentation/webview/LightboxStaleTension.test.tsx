/** @jest-environment jsdom */

/**
 * Stale headline and tension on the board (PR #150 F-06): a carried tension
 * arc draws a score only where its paragraph is unchanged, leaves a changed
 * paragraph unscored and says why, and the headline, the tension caption and
 * the lane each say the reading is stale. When no score can be drawn, the
 * lane says so accurately instead of "Not read yet". Readings are the worked
 * examples over "Alice's Adventures in Wonderland" (1865, public domain).
 */

import * as React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import { MessageType, type LightboxBoard, type LightboxReadingGroup } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';
import { readGroup } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';

jest.mock('../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../presentation/webview/styles/lightbox/tokens.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/board.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/ribbon.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/tiles.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/rail.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/inspector.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/readings.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/gravity.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/story.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/craft.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/plot.css', () => ({}));
// eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked component's export name.
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { LightboxApp } from '@/presentation/webview/LightboxApp';

const fromHost = (type: MessageType, payload: object) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: { type, source: 'extension.lightbox', payload, timestamp: 1 }
    }));
  });

/** Group A as carried onto changed text: every lens stale, the arc's scores as given. */
function staleGroupA(scores: Array<number | null>): LightboxReadingGroup {
  const read = readGroup('A');
  return {
    ...read,
    staleLenses: read.lenses.map((lens) => ({ lens, readAgainst: 'earlier-hash' })),
    tiles: read.tiles.map((tile) => (tile.kind === 'tension-arc' ? { ...tile, scores } : tile))
  };
}

const boardWith = (groupA: LightboxReadingGroup): LightboxBoard => ({
  ...makeBoard(8),
  readings: [groupA, readGroup('B'), readGroup('C')]
});

const tensionCell = (paragraph: number) =>
  screen.getByRole('button', { name: `Paragraph ${paragraph}` });

describe('LightboxApp: stale headline and tension (PR #150 F-06)', () => {
  beforeEach(() => {
    (useVSCodeApi as jest.Mock).mockReturnValue(createMockVSCode());
  });

  it('draws a carried score only on an unchanged paragraph, and says a changed one is unscored', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(staleGroupA([0, null, 3, 6, 7, 8, 3, 2])), refusal: null });
    expect(tensionCell(2).getAttribute('title')).toContain('tension not scored: this paragraph changed since the reading');
    expect(tensionCell(2).querySelector('.pm-lb-col-tension i')).toBeNull();
    expect(tensionCell(3).getAttribute('title')).toContain('tension, as read on an earlier version: 3 of 9');
    expect(tensionCell(3).querySelector('.pm-lb-col-tension i')).not.toBeNull();
  });

  it('labels the headline, the tension caption and the lane stale', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(staleGroupA([0, null, 3, 6, 7, 8, 3, 2])), refusal: null });
    expect(within(screen.getByLabelText('Headline reading')).getByText('Stale')).not.toBeNull();
    const caption = document.querySelector('.pm-lb-tension-note') as HTMLElement;
    expect(within(caption).getByText('stale')).not.toBeNull();
    expect(caption.textContent).toContain('as read on an earlier version (scores stand only on unchanged paragraphs)');
    const lane = document.querySelector('button.pm-lb-lane-label[title^="Tension"]') as HTMLElement;
    expect(within(lane).getByText('stale')).not.toBeNull();
    expect(lane.getAttribute('title')).toBe(
      'Tension was read against an earlier version of this chapter. Scores stand only on paragraphs unchanged since; re-read to score the rest.'
    );
  });

  it('says why an old lane cannot be drawn, rather than "Not read yet"', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(staleGroupA(Array.from({ length: 8 }, () => null))), refusal: null });
    const lane = document.querySelector('.pm-lb-lane-label[title^="Tension"]') as HTMLElement;
    expect(lane.getAttribute('title')).toBe(
      'Tension was read against an earlier version of this chapter, and no paragraph it scored is unchanged. Re-read to score this version.'
    );
    expect(document.querySelectorAll('.pm-lb-col-tension i')).toHaveLength(0);
  });
});

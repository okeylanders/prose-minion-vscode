/** @jest-environment jsdom */

/**
 * Lineage, subtext and the Spark lane in the webview (ADR 2026-10-19 D7;
 * Slice 4), through the real Lightbox root: the stories with their stances
 * and set-asides, said/meant pairs labeled as readings, sparks in a lane of
 * their own with counted support, "Not for me" and Undo asking the host, a
 * stale note on every new reading, hover lighting paragraphs, and Escape
 * following the overlay stack. The host is played by window messages;
 * readings come from the worked examples through the production codec and
 * verifier, over "Alice's Adventures in Wonderland" (1865, public domain).
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { LightboxBoard, LightboxReadingGroup } from '@messages';
import { MessageType } from '@messages';
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

const litParagraphs = () =>
  Array.from(document.querySelectorAll('.pm-lb-col'))
    .flatMap((column, index) => (column.querySelector('.pm-lb-col-focus.is-lit') ? [index + 1] : []));

/** The counted board with every group read; group B and C may be replaced. */
function boardWith(groupB: LightboxReadingGroup = readGroup('B'), groupC: LightboxReadingGroup = readGroup('C')): LightboxBoard {
  return { ...makeBoard(8), readings: [readGroup('A'), groupB, groupC] };
}

const sparkId = (board: LightboxBoard, title: string) =>
  board.readings[2].tiles.find((tile) => tile.kind === 'spark' && tile.title === title)?.id as string;

describe('LightboxApp: lineage, subtext and the Spark lane (Slice 4)', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  it('draws each adjacent story with its stances, and what the reading checked and set aside', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(), refusal: null });
    const lineage = screen.getByLabelText('Lineage · adjacent stories');
    expect(within(lineage).getByText('The white hart')).not.toBeNull();
    expect(within(lineage).getByText('Arthurian and Celtic legend')).not.toBeNull();
    const descent = within(lineage).getByText('The descent to the underworld').closest('button') as HTMLButtonElement;
    expect(within(descent).getByText('Matches')).not.toBeNull();
    expect(within(descent).getByText('Subverts')).not.toBeNull();
    expect(lineage.textContent).toContain('Checked and set aside:');
    expect(lineage.textContent).toContain('Persephone. No one takes her below: she jumps in after the Rabbit herself.');
    expect(lineage.getAttribute('data-register')).toBe('read');
  });

  it('draws an empty lineage as the honest answer, with its friction and set-aside line', () => {
    const empty = readGroup('C', {
      mutate: (body) => {
        body.lineage.items = [];
        body.lineage.friction = 'No strong echo: a fall and a follow are too common to tie to one story.';
      }
    });
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(undefined, empty), refusal: null });
    const lineage = screen.getByLabelText('Lineage · adjacent stories');
    expect(within(lineage).getByText(/No strong echo: the reading found no older story/)).not.toBeNull();
    expect(lineage.textContent).toContain('a fall and a follow are too common to tie to one story');
    expect(lineage.textContent).toContain('Checked and set aside:');
  });

  it('draws said/meant pairs with the said line as the chapter has it, and the meant side labeled a reading', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(), refusal: null });
    const subtext = screen.getByLabelText('Subtext · said and meant');
    const rabbit = within(subtext).getByText('¶4 · White Rabbit').closest('button') as HTMLButtonElement;
    expect(within(rabbit).getByText('Oh dear! Oh dear! I shall be late!')).not.toBeNull();
    expect(within(rabbit).getByText('reads as')).not.toBeNull();
    expect(subtext.textContent).toContain('is a reading of the line, not what the character thinks');
    fireEvent.click(rabbit);
    const inspector = screen.getByLabelText('Inspector');
    expect(within(inspector).getByText('Who says it')).not.toBeNull();
    expect(within(inspector).getByText(/inside quoted dialogue, found by code/)).not.toBeNull();
  });

  it('draws the sparks in a lane of their own, with counted support and addresses, and lights their paragraphs on hover', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(), refusal: null });
    const lane = screen.getByLabelText('Spark lane');
    expect(lane.closest('.pm-lb-grid')).toBeNull();
    expect(lane.textContent).toContain('Offers, not fixes. Nothing here grades the chapter.');
    const home = within(lane).getByText('Nobody at home').closest('button') as HTMLButtonElement;
    expect(within(home).getByText('home ×1 · sister ×2')).not.toBeNull();
    expect(within(home).getByText('¶2 ¶8')).not.toBeNull();
    fireEvent.mouseEnter(home);
    expect(litParagraphs()).toEqual([2, 8]);
    fireEvent.mouseLeave(home);
    expect(litParagraphs()).toEqual([]);
  });

  it('asks the host to set a spark aside, draws what the host answers, and Undo brings back the latest', () => {
    const board = boardWith();
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board, refusal: null });
    const lane = () => screen.getByLabelText('Spark lane');
    // Pin it first: setting it aside lets go of the pin.
    fireEvent.click(within(lane()).getByText('The empty jar').closest('button') as HTMLButtonElement);
    expect(within(screen.getByLabelText('Inspector')).getByText('The empty jar')).not.toBeNull();
    const jarCard = within(lane()).getByText('The empty jar').closest('.pm-lb-spark') as HTMLElement;
    fireEvent.click(within(jarCard).getByRole('button', { name: 'Not for me' }));
    expect(posted(MessageType.LIGHTBOX_SET_SPARK_DISMISSED).at(-1)?.payload).toEqual({
      boardId: board.boardId, tileId: sparkId(board, 'The empty jar'), dismissed: true
    });
    expect(within(screen.getByLabelText('Inspector')).queryByText('The empty jar')).toBeNull();
    // Nothing is hidden until the host says so.
    expect(within(lane()).getByText('The empty jar')).not.toBeNull();

    const mark = (orders: ReadonlyArray<readonly [string, number]>) => ({
      ...board,
      readings: board.readings.map((group) => (group.group !== 'C' ? group : {
        ...group,
        tiles: group.tiles.map((tile) => {
          const order = orders.find(([title]) => tile.kind === 'spark' && title === tile.title)?.[1];
          return order === undefined ? tile : { ...tile, dismissedOrder: order };
        })
      }))
    });
    fromHost(MessageType.LIGHTBOX_BOARD, { board: mark([['The empty jar', 1], ['Late for what?', 2]]), refusal: null });
    expect(within(lane()).queryByText('The empty jar')).toBeNull();
    expect(lane().textContent).toContain('2 sparks set aside.');
    expect(lane().textContent).toContain('Brings back “Late for what?”.');
    fireEvent.click(within(lane()).getByRole('button', { name: 'Undo' }));
    expect(posted(MessageType.LIGHTBOX_SET_SPARK_DISMISSED).at(-1)?.payload).toEqual({
      boardId: board.boardId, tileId: sparkId(board, 'Late for what?'), dismissed: false
    });
  });

  it('says on every new reading when it was read against an earlier version of the chapter', () => {
    const stale = (group: LightboxReadingGroup) => ({
      ...group,
      staleLenses: group.lenses.map((lens) => ({ lens, readAgainst: 'old-hash' }))
    });
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(stale(readGroup('B')), stale(readGroup('C'))), refusal: null });
    for (const label of ['Lineage · adjacent stories', 'Subtext · said and meant', 'Spark lane']) {
      expect(within(screen.getByLabelText(label)).getByText('Stale')).not.toBeNull();
    }
  });

  it('pins with a button (Enter or a click), and lets go on Escape unless an overlay is open', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(), refusal: null });
    const hart = within(screen.getByLabelText('Lineage · adjacent stories')).getByText('The white hart').closest('button') as HTMLButtonElement;
    expect(hart.tagName).toBe('BUTTON');
    fireEvent.click(hart);
    expect(hart.getAttribute('aria-pressed')).toBe('true');

    // A modal on top takes Escape; the pin stays.
    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(hart.getAttribute('aria-pressed')).toBe('true');
    modal.remove();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(hart.getAttribute('aria-pressed')).toBe('false');
  });
});

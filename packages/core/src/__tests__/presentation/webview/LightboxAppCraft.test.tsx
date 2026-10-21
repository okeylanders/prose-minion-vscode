/** @jest-environment jsdom */

/**
 * The craft lenses in the webview (ADR 2026-10-19 D7 and its addendum; Slice
 * 4B), through the real Lightbox root: the numbers drawn measured before any
 * reading, the stock, rhythm and numbers tiles with their register chips,
 * the echo's accuracy callout, the Endings lane on the ribbon, hover lighting
 * paragraphs, a pin opening the inspector, a stale note on every new tile,
 * and Bring by id. The host is played by window messages; readings come from
 * the worked examples through the production codec and verifier, over
 * "Alice's Adventures in Wonderland" (1865, public domain).
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { LightboxBoard, LightboxReadingGroup } from '@messages';
import { MessageType } from '@messages';
import { LIGHTBOX_ECHO_ACCURACY, emptyLightboxReadingGroup } from '@shared/constants/lightbox';
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
jest.mock('../../../presentation/webview/styles/lightbox/opinion.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/steering.css', () => ({}));
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

function boardWith(groupD: LightboxReadingGroup = readGroup('D')): LightboxBoard {
  return { ...makeBoard(8), readings: [readGroup('A'), readGroup('B'), readGroup('C'), groupD] };
}
const UNREAD: LightboxBoard = { ...makeBoard(8), readings: (['A', 'B', 'C', 'D'] as const).map(emptyLightboxReadingGroup) };
const tileOf = (board: LightboxBoard, kind: string) => board.readings.flatMap((group) => group.tiles).find((tile) => tile.kind === kind)!;

describe('LightboxApp: the craft lenses (Slice 4B)', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);
  const numbersTile = () => screen.getByLabelText('What stands out in the numbers');
  const stockTile = () => screen.getByLabelText('Stock & signature');
  const rhythmTile = () => screen.getByLabelText('Rhythm & handoffs');

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  it('draws the measured numbers and sentence lengths before any reading, and lights a standout\'s paragraphs', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: UNREAD, refusal: null });
    const numbers = numbersTile();
    expect(within(numbers).getByText('Dialogue')).not.toBeNull();
    expect(within(numbers).getByText('Stands out below the preset')).not.toBeNull();
    expect(numbers.textContent).toContain('No chapters or manuscript files are configured');
    expect(within(rhythmTile()).getByText('Sentence lengths by paragraph')).not.toBeNull();
    const dialogue = within(numbers).getByText('Dialogue').closest('button') as HTMLButtonElement;
    fireEvent.mouseEnter(dialogue);
    expect(litParagraphs()).toEqual([1, 3, 5]);
  });

  it('draws stock and signature: a counted tier mix, phrases with host counts, and the echo\'s accuracy callout', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(), refusal: null });
    const stock = stockTile();
    expect(stock.getAttribute('data-register')).toBe('counted-read');
    expect(within(stock).getByRole('img', { name: '16 beats classified and found: 6 functional stock, 1 decorated, 1 stock carrying weight, 8 signature' }))
      .not.toBeNull();
    expect(within(stock).getByText('Manners in free fall')).not.toBeNull();
    const familiar = within(stock).getByText('In another moment').closest('button') as HTMLButtonElement;
    expect(within(familiar).getByText('×1 · ¶5')).not.toBeNull();
    expect(stock.textContent).toContain(LIGHTBOX_ECHO_ACCURACY);
    expect(stock.textContent).toContain('Sounds reminiscent of a proverb’s “what is the use of” turn.');
    expect(stock.textContent).toContain('Familiar means familiar to a reader, not a fault.');
    fireEvent.mouseEnter(familiar);
    expect(litParagraphs()).toEqual([5]);
  });

  it('draws rhythm and handoffs: how each paragraph ends, and handoffs code checked as adjacent', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(), refusal: null });
    const rhythm = rhythmTile();
    expect(rhythm.textContent).toContain('Lands 2');
    expect(rhythm.textContent).toContain('Opens 5 · ¶1, ¶3, ¶4, ¶5, ¶6');
    expect(rhythm.textContent).toContain('Code checks that both quotes are adjacent sentences in one paragraph.');
    const handoff = within(rhythm).getByText('The fret becomes a deadline.').closest('button') as HTMLButtonElement;
    expect(within(handoff).getByText('Oh dear')).not.toBeNull();
    expect(within(handoff).getByText('I shall be late')).not.toBeNull();
    expect(within(handoff).getByText('Continues')).not.toBeNull();
    fireEvent.mouseEnter(handoff);
    expect(litParagraphs()).toEqual([4]);
    fireEvent.mouseLeave(handoff);

    // Pinning opens the inspector on the handoff.
    fireEvent.click(handoff);
    const inspector = screen.getByLabelText('Inspector');
    expect(within(inspector).getByText('¶4: two adjacent sentences, checked by code')).not.toBeNull();
    expect(within(inspector).getByText('The Rabbit’s fretting.')).not.toBeNull();
  });

  it('draws the endings as a read lane on the ribbon, and none when the rhythm lens is off', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(), refusal: null });
    const ribbon = screen.getByRole('group', { name: 'The text, paragraph by paragraph' });
    expect(within(ribbon).getByRole('button', { name: /Endings/ })).not.toBeNull();
    expect(ribbon.querySelectorAll('.pm-lb-col-ending i.is-opens')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Paragraph 7' }).getAttribute('title')).toContain('ends, as read: lands');
    fireEvent.click(within(screen.getByLabelText('Lenses')).getByRole('checkbox', { name: /^Rhythm/ }));
    expect(ribbon.querySelector('.pm-lb-col-ending')).toBeNull();
  });

  it('draws a numbers reading under the figure it reads, and the readings of figures that do not stand out as withheld', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(), refusal: null });
    const numbers = numbersTile();
    expect(numbers.getAttribute('data-register')).toBe('counted-read');
    const reading = within(numbers).getByText('Reads as mixed').closest('button') as HTMLButtonElement;
    expect(reading.closest('.pm-lb-number')?.textContent).toContain('Dialogue');
    expect(numbers.textContent).toContain('It reads a figure the board did not measure as standing out.');
    expect(numbers.textContent).not.toMatch(/\bshould\b/);
    fireEvent.click(reading);
    const inspector = screen.getByLabelText('Inspector');
    expect(within(inspector).getByText('Each quote holds one, checked by the detector that counted the figure')).not.toBeNull();
  });

  it('draws a numbers reading only under a figure that stands out on the board now (PR #155 F-01)', () => {
    render(<LightboxApp />);
    const board = boardWith();
    fromHost(MessageType.LIGHTBOX_BOARD, { board, refusal: null });
    expect(within(numbersTile()).getByText('Reads as mixed')).not.toBeNull();
    // The same reading, on a board where dialogue no longer stands out.
    const unmeasured: LightboxBoard = {
      ...board,
      measured: { ...board.measured, numbers: { ...board.measured.numbers, rows: board.measured.numbers.rows.map(({ standout: _standout, ...row }) => row) } }
    };
    fromHost(MessageType.LIGHTBOX_BOARD, { board: unmeasured, refusal: null });
    expect(within(numbersTile()).queryByText('Reads as mixed')).toBeNull();
    expect(within(numbersTile()).queryByText(/Stands out/)).toBeNull();
  });

  it('warns that the numbers are stale before the first figure, not after the readings (PR #155)', () => {
    const read = readGroup('D');
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith({ ...read, staleLenses: [{ lens: 'numbers', readAgainst: 'old-hash' }] }), refusal: null });
    const note = numbersTile().querySelector('.pm-lb-stale-note') as Element;
    const firstFigure = numbersTile().querySelector('.pm-lb-number') as Element;
    expect(note.compareDocumentPosition(firstFigure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('says on every new tile when it was read against an earlier version of the chapter', () => {
    const read = readGroup('D');
    const stale = { ...read, staleLenses: read.lenses.map((lens) => ({ lens, readAgainst: 'old-hash' })) };
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(stale), refusal: null });
    for (const tile of [stockTile(), rhythmTile(), numbersTile()]) {
      expect(within(tile).getByText('Stale')).not.toBeNull();
    }
    const ribbon = screen.getByRole('group', { name: 'The text, paragraph by paragraph' });
    expect(within(ribbon).getByText('stale')).not.toBeNull();
  });

  it('brings a pinned craft reading to the Workshop by its id only', () => {
    const board = boardWith();
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board, refusal: null });
    fireEvent.click(within(stockTile()).getByText('Of 16 beats the reading classified and code found.', { exact: false }).closest('button') as HTMLButtonElement);
    fireEvent.click(within(screen.getByLabelText('Inspector')).getByRole('button', { name: 'Bring to Workshop →' }));
    expect(posted(MessageType.LIGHTBOX_HAND_OFF)).toEqual([expect.objectContaining({
      payload: { kind: 'tile', boardId: board.boardId, tileId: tileOf(board, 'stock-tiers').id }
    })]);
  });
});

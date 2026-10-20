/** @jest-environment jsdom */

/**
 * The inspector keeps every exact paragraph address reachable behind its
 * bound (PR #148 F-04, ADR 2026-10-19 D4): a page of 48 at a time, with
 * previous/next and a jump to a paragraph number, none of which changes the
 * pinned item. Driven through the real Lightbox root.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { LightboxBoard, MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';

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

const range = (from: number, to: number, step = 1) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, offset) => from + offset * step);

/** A board whose only top word lives in exactly `paragraphs`. */
function boardWithWord(paragraphCount: number, word: string, paragraphs: number[]): LightboxBoard {
  const board = makeBoard(paragraphCount);
  return {
    ...board,
    measured: { ...board.measured, topWords: [{ term: word, count: paragraphs.length, percentage: 1, paragraphs }] }
  };
}

function show(board: LightboxBoard): void {
  render(<LightboxApp />);
  act(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: MessageType.LIGHTBOX_BOARD, source: 'extension.lightbox', payload: { board, refusal: null }, timestamp: 1 }
    }));
  });
}

const inspector = () => screen.getByLabelText('Inspector');
const chips = () => within(inspector()).queryAllByRole('button', { name: /^¶\d+$/ });
const chipNames = () => chips().map((chip) => chip.textContent);
const rangeText = () => inspector().querySelector('.pm-lb-para-range')?.textContent;
const pinnedTitle = () => within(inspector()).getByRole('heading').textContent;
const next = () => within(inspector()).getByRole('button', { name: 'Next paragraphs' }) as HTMLButtonElement;
const previous = () => within(inspector()).getByRole('button', { name: 'Previous paragraphs' }) as HTMLButtonElement;

function jumpTo(paragraph: number): void {
  const field = within(inspector()).getByLabelText('Go to ¶') as HTMLInputElement;
  fireEvent.change(field, { target: { value: String(paragraph) } });
  fireEvent.submit(within(inspector()).getByRole('form', { name: 'Go to a paragraph' }));
}

const litColumns = () =>
  Array.from(document.querySelectorAll('.pm-lb-col'))
    .flatMap((column, index) => (column.querySelector('.pm-lb-col-focus.is-lit') ? [index] : []));

describe('Lightbox inspector paging (PR #148 F-04)', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  it('reaches and pins the last of 5,000 addresses, 48 at a time, without changing the pin', () => {
    show(boardWithWord(5_000, 'alice', range(1, 5_000)));
    fireEvent.click(screen.getByTitle('alice ×5000'));

    expect(pinnedTitle()).toBe('alice');
    expect(chipNames()).toEqual(range(1, 48).map((index) => `¶${index}`));
    expect(rangeText()).toBe('¶1–¶48 (1–48 of 5,000)');
    expect(previous().disabled).toBe(true);
    expect(screen.queryByText(/more$/)).toBeNull();

    fireEvent.click(next());
    expect(rangeText()).toBe('¶49–¶96 (49–96 of 5,000)');
    expect(chips()).toHaveLength(48);

    jumpTo(5_000);
    expect(rangeText()).toBe('¶4993–¶5000 (4993–5000 of 5,000)');
    expect(chipNames()).toEqual(range(4_993, 5_000).map((index) => `¶${index}`));
    expect(document.activeElement?.textContent).toBe('¶5000');
    expect(next().disabled).toBe(true);
    // Paging never touched the pin.
    expect(pinnedTitle()).toBe('alice');
    expect(vscode.setState).toHaveBeenLastCalledWith(expect.objectContaining({
      lightboxSelectedItem: { kind: 'word', word: 'alice' }
    }));

    fireEvent.click(within(inspector()).getByRole('button', { name: '¶5000' }));
    expect(pinnedTitle()).toBe('¶5000');
    expect(litColumns()).toEqual([95]);
  });

  it('pages a term that lives in every other paragraph to its last address', () => {
    show(boardWithWord(200, 'rabbit', range(1, 199, 2)));
    fireEvent.click(screen.getByTitle('rabbit ×100'));

    expect(rangeText()).toBe('¶1–¶95 (1–48 of 100)');
    fireEvent.click(next());
    expect(rangeText()).toBe('¶97–¶191 (49–96 of 100)');
    fireEvent.click(next());
    expect(rangeText()).toBe('¶193–¶199 (97–100 of 100)');
    expect(chipNames()).toEqual(['¶193', '¶195', '¶197', '¶199']);

    // A paragraph the term is not in lands on the next one it is.
    jumpTo(100);
    expect(rangeText()).toBe('¶97–¶191 (49–96 of 100)');
    expect(document.activeElement?.textContent).toBe('¶101');
    expect(pinnedTitle()).toBe('rabbit');

    fireEvent.click(previous());
    fireEvent.click(previous());
    expect(rangeText()).toBe('¶1–¶95 (1–48 of 100)');
    jumpTo(199);
    fireEvent.click(within(inspector()).getByRole('button', { name: '¶199' }));
    expect(pinnedTitle()).toBe('¶199');
  });

  it('exposes every paragraph of a ribbon column holding more than 48', () => {
    show(makeBoard(5_000));
    const firstColumn = document.querySelectorAll('.pm-lb-col')[0] as HTMLButtonElement;
    fireEvent.click(firstColumn);

    expect(pinnedTitle()).toBe('¶1–¶52');
    expect(rangeText()).toBe('¶1–¶48 (1–48 of 52)');
    fireEvent.click(next());
    expect(chipNames()).toEqual(['¶49', '¶50', '¶51', '¶52']);
    expect(firstColumn.getAttribute('aria-pressed')).toBe('true');

    // The pager is ordinary controls: each takes keyboard focus.
    for (const control of [previous(), within(inspector()).getByLabelText('Go to ¶')]) {
      control.focus();
      expect(document.activeElement).toBe(control);
    }

    fireEvent.click(within(inspector()).getByRole('button', { name: '¶49' }));
    expect(pinnedTitle()).toBe('¶49');
    expect(litColumns()).toEqual([0]);
  });

  it('focuses the landing chip again when the same jump is repeated (PR #148 F-05)', () => {
    const board = boardWithWord(815, 'alice', range(1, 815));
    show(board);
    fireEvent.click(screen.getByTitle('alice ×815'));
    const field = () => within(inspector()).getByLabelText('Go to ¶') as HTMLInputElement;

    jumpTo(812);
    expect(document.activeElement?.textContent).toBe('¶812');
    field().focus();
    jumpTo(812);
    expect(document.activeElement?.textContent).toBe('¶812');

    // A board update is not a jump: focus stays where the writer put it.
    field().focus();
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: MessageType.LIGHTBOX_BOARD, source: 'extension.lightbox', payload: { board: { ...board }, refusal: null }, timestamp: 2 }
      }));
    });
    expect(rangeText()).toBe('¶769–¶815 (769–815 of 815)');
    expect(document.activeElement).toBe(field());
  });

  it('focuses a sparse list\'s landing chip again when the next jump names it (PR #148 F-05)', () => {
    show(boardWithWord(200, 'rabbit', range(1, 199, 2)));
    fireEvent.click(screen.getByTitle('rabbit ×100'));

    jumpTo(100);
    expect(document.activeElement?.textContent).toBe('¶101');
    (within(inspector()).getByLabelText('Go to ¶') as HTMLInputElement).focus();
    jumpTo(101);
    expect(document.activeElement?.textContent).toBe('¶101');
  });

  it('shows no pager when every address fits on one page', () => {
    show(makeBoard(6));
    fireEvent.click(screen.getByTitle('alice ×5'));

    expect(chipNames()).toEqual(['¶2', '¶4', '¶5', '¶6']);
    expect(within(inspector()).queryByRole('button', { name: 'Next paragraphs' })).toBeNull();
  });
});

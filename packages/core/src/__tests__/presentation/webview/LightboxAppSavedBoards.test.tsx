/** @jest-environment jsdom */

/**
 * The saved boards through the real Lightbox root (Slice 5A.1; Slice 5A.2,
 * epic decision 41).
 *
 * - **The Boards menu** sits in the header, as the Workshop's sessions menu
 *   does: it names the board on screen from the host's shelf, opens a recent
 *   board by the host's id, renames the board on screen through the name
 *   sheet, boards another chapter through the project picker, and opens the
 *   browser, which asks for the shelf again and offers "Open a board file…".
 *   The rail's Boards panel is gone.
 * - **The changed-file notice above the board** comes from the shelf and
 *   obeys the ordering guards the shelf does (PR #163 F-02, F-05): a shelf of
 *   an earlier adoption, or observed earlier within one, changes nothing. Its
 *   "Read the current text" is the source's re-read.
 * - **Escape** closes the open menu without letting go of the pinned item.
 * - No board's name reaches the webview's saved state.
 *
 * The board is a synthetic one (`makeBoard`); names and paths are made up.
 * No host is running: the host's messages are delivered as it would.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MessageType, type LightboxBoardShelf } from '@messages';
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
jest.mock('../../../presentation/webview/styles/lightbox/opinion.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/steering.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/boards.css', () => ({}));
// eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked component's export name.
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { LightboxApp } from '@/presentation/webview/LightboxApp';

const FILE = 'drafts-alice-1-md-9b099095/2026-10-22T14-05-09-123Z.board.json';
const OTHER = 'book-chapter-6-md-0a1b2c3d/2026-10-21T09-00-00-000Z.board.json';
const NAME = '3.2.1 - after the cut - model B';
const SAVED_AT = Date.parse('2026-10-22T14:05:09.123Z');

const fromHost = (type: MessageType, payload: object) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { type, source: 'extension.lightbox', payload, timestamp: 1 } }));
  });

function shelfWith(file: 'same' | 'changed', overrides: Partial<LightboxBoardShelf> = {}): LightboxBoardShelf {
  return {
    availability: { kind: 'project', displayPath: 'prose-minion/boards', lastSaveFailed: false },
    name: 'alice-1 - 10/22/2026 2:05 PM',
    boards: [
      { fileId: FILE, name: 'alice-1 - 10/22/2026 2:05 PM', savedAt: SAVED_AT, source: { kind: 'file', displayPath: 'Drafts/alice-1.md' }, wordCount: 200, lenses: [], staleLenses: [], onScreen: true },
      { fileId: OTHER, name: 'Chapter 6 - first pass', savedAt: SAVED_AT - 86_400_000, source: { kind: 'file', displayPath: 'Book/chapter-6.md' }, wordCount: 900, lenses: [], staleLenses: [], onScreen: false }
    ],
    unreadable: 0,
    snapshot: { fileId: FILE, savedAt: SAVED_AT, file, dropped: 0 },
    ...overrides
  };
}

const push = (shelf: LightboxBoardShelf, adoption: number, observation: number) =>
  fromHost(MessageType.LIGHTBOX_BOARDS, { requestId: null, boardId: 'board-6', adoption, observation, shelf });

const notice = () => screen.queryByLabelText('The saved board and its file');

describe('LightboxApp: saved boards (Slices 5A.1 and 5A.2)', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const sentOf = (type: MessageType) => vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: makeBoard(6), refusal: null });
  });

  it('has no Boards panel in the rail: the boards are in the header\'s menu', () => {
    expect(screen.queryByLabelText('Saved boards')).toBeNull();
    push(shelfWith('same'), 1, 1);
    const menuTrigger = screen.getByTitle('Board commands and recent saved boards');
    expect(menuTrigger.closest('.pm-ws-sessions-menu-wrap')?.textContent).toBe('alice-1 - 10/22/2026 2:05 PMSaved');
  });

  it('opens a recent board of another chapter by the host\'s id, and names the board on screen from the shelf', () => {
    push(shelfWith('same', { name: NAME }), 1, 1);
    fireEvent.click(screen.getByTitle('Board commands and recent saved boards'));
    expect(screen.getByRole('menuitem', { name: /^Chapter 6 - first pass/ })).not.toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: /^Chapter 6 - first pass/ }));
    expect(sentOf(MessageType.LIGHTBOX_OPEN_BOARD).at(-1)?.payload).toEqual({ requestId: expect.any(String), fileId: OTHER });
    expect(screen.getByTitle('Board commands and recent saved boards').textContent).toBe(NAME);
  });

  it('renames the board on screen through the name sheet, by the host\'s ids, and saves no name in the webview\'s state', () => {
    push(shelfWith('same', { name: NAME }), 1, 1);
    fireEvent.click(screen.getByTitle('Board commands and recent saved boards'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename board…' }));
    const sheet = screen.getByRole('dialog', { name: 'Rename board' });
    const field = within(sheet).getByRole('textbox', { name: 'Board name' });
    expect((field as HTMLInputElement).value).toBe(NAME);
    fireEvent.change(field, { target: { value: 'model C' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(sentOf(MessageType.LIGHTBOX_RENAME_BOARD).at(-1)?.payload).toEqual({ requestId: expect.any(String), boardId: 'board-6', fileId: null, name: 'model C' });
    expect(screen.queryByRole('dialog', { name: 'Rename board' })).toBeNull();
    const saved = JSON.stringify(vscode.setState.mock.calls);
    expect(saved).not.toContain(NAME);
    expect(saved).not.toContain('model C');
  });

  it('boards another chapter through the project picker', () => {
    push(shelfWith('same'), 1, 1);
    fireEvent.click(screen.getByTitle('Board commands and recent saved boards'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Board another chapter…' }));
    expect(sentOf(MessageType.LIGHTBOX_REQUEST_PROJECT_CATALOG)).toHaveLength(1);
  });

  it('opens the browser, which asks for the shelf again, renames and deletes by file, and opens a board file', () => {
    push(shelfWith('same'), 1, 1);
    const asked = sentOf(MessageType.LIGHTBOX_REQUEST_BOARDS).length;
    fireEvent.click(screen.getByTitle('Board commands and recent saved boards'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Browse all boards…' }));
    const browser = screen.getByRole('dialog', { name: 'Open a prior board' });
    expect(sentOf(MessageType.LIGHTBOX_REQUEST_BOARDS)).toHaveLength(asked + 1);

    fireEvent.click(within(browser).getByRole('button', { name: 'Rename Chapter 6 - first pass' }));
    fireEvent.change(within(browser).getByRole('textbox', { name: 'Rename board' }), { target: { value: 'Chapter 6 - draft two' } });
    fireEvent.keyDown(within(browser).getByRole('textbox', { name: 'Rename board' }), { key: 'Enter' });
    expect(sentOf(MessageType.LIGHTBOX_RENAME_BOARD).at(-1)?.payload).toEqual({ requestId: expect.any(String), boardId: 'board-6', fileId: OTHER, name: 'Chapter 6 - draft two' });

    fireEvent.click(within(browser).getByRole('button', { name: 'Delete Chapter 6 - first pass' }));
    fireEvent.click(within(browser).getByRole('button', { name: 'Confirm delete Chapter 6 - first pass' }));
    expect(sentOf(MessageType.LIGHTBOX_DELETE_BOARD).at(-1)?.payload).toEqual({ requestId: expect.any(String), boardId: 'board-6', fileId: OTHER });

    fireEvent.click(within(browser).getByRole('button', { name: 'Open a board file…' }));
    expect(sentOf(MessageType.LIGHTBOX_OPEN_BOARD_FILE)).toHaveLength(1);
    // While the host's picker is open, nothing else opens; its answer ends it (the writer dismissed it).
    expect(within(browser).getByRole('button', { name: 'Opening…' })).not.toBeNull();
    fromHost(MessageType.LIGHTBOX_BOARDS, {
      requestId: sentOf(MessageType.LIGHTBOX_OPEN_BOARD_FILE)[0].payload.requestId, boardId: 'board-6', adoption: 1, observation: 2, shelf: shelfWith('same')
    });

    fireEvent.click(within(browser).getByRole('button', { name: 'Open Chapter 6 - first pass' }));
    expect(sentOf(MessageType.LIGHTBOX_OPEN_BOARD).at(-1)?.payload).toEqual({ requestId: expect.any(String), fileId: OTHER });
    expect(screen.queryByRole('dialog', { name: 'Open a prior board' })).toBeNull();
  });

  it('shows the changed-file notice above the board, first in its column, and takes it away as the shelf says', () => {
    expect(notice()).toBeNull();
    push(shelfWith('changed'), 1, 1);
    const above = notice() as HTMLElement;
    expect(above.textContent).toMatch(/^Opened from the board saved Oct 2[12], 2026, .+\.The file has changed since\. This board shows the text as it was saved, and holds back Bring until you read the current text\.Read the current text$/);
    expect(screen.getByLabelText('Board').querySelector('.pm-lb-scroll')?.firstElementChild).toBe(above);

    push(shelfWith('same'), 1, 2);
    expect(notice()).toBeNull();
  });

  it('keeps the notice as the newest shelf says: an earlier observation, or an earlier adoption, changes nothing (PR #163 F-02, F-05)', () => {
    push(shelfWith('same'), 2, 5);
    push(shelfWith('changed'), 2, 4);
    expect(notice()).toBeNull();
    push(shelfWith('changed'), 1, 9);
    expect(notice()).toBeNull();

    push(shelfWith('changed'), 2, 6);
    expect(notice()).not.toBeNull();
    push(shelfWith('same'), 2, 3);
    expect(notice()).not.toBeNull();
  });

  it('reads the current text from the notice above the board', () => {
    push(shelfWith('changed'), 1, 1);
    fireEvent.click(within(notice() as HTMLElement).getByRole('button', { name: 'Read the current text' }));
    expect(vscode.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ type: MessageType.LIGHTBOX_REFRESH_SOURCE }));
  });

  it('closes the open menu on Escape and keeps the pinned item; a second Escape lets go of it', () => {
    push(shelfWith('same'), 1, 1);
    const item = screen.getByLabelText('Board').querySelector('button[aria-pressed]:not(.pm-lb-segment)') as HTMLButtonElement;
    fireEvent.click(item);
    expect(item.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTitle('Board commands and recent saved boards'));
    expect(screen.getByRole('menu')).not.toBeNull();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(item.getAttribute('aria-pressed')).toBe('true');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(item.getAttribute('aria-pressed')).toBe('false');
  });
});

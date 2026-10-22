/** @jest-environment jsdom */

/**
 * The saved boards through the real Lightbox root (Slice 5A.1; epic
 * decisions 33 and 34).
 *
 * - **The changed-file notice above the board** is the rail's own, from the
 *   same shelf: it appears and goes with the rail's, and obeys the ordering
 *   guards the shelf does (PR #163 F-02, F-05): a shelf of an earlier
 *   adoption, or observed earlier within one, changes neither. Its "Read the
 *   current text" is the source's re-read.
 * - **A name** shows in the rail's head and row from the host's shelf, and
 *   Rename posts the host's ids; no name reaches the webview's saved state.
 *
 * The board is a synthetic one (`makeBoard`); names and model ids are made
 * up. No host is running: the host's messages are delivered as it would.
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
const NAME = '3.2.1 - after the cut - model B';

const fromHost = (type: MessageType, payload: object) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { type, source: 'extension.lightbox', payload, timestamp: 1 } }));
  });

function shelfWith(file: 'same' | 'changed', overrides: Partial<LightboxBoardShelf> = {}): LightboxBoardShelf {
  return {
    availability: { kind: 'project', displayPath: 'prose-minion/boards', lastSaveFailed: false },
    boards: [{ fileId: FILE, savedAt: Date.parse('2026-10-22T14:05:09.123Z'), wordCount: 200, lenses: [], staleLenses: [], onScreen: true }],
    unreadable: 0,
    snapshot: { fileId: FILE, savedAt: Date.parse('2026-10-22T14:05:09.123Z'), file, dropped: 0 },
    ...overrides
  };
}

const push = (shelf: LightboxBoardShelf, adoption: number, observation: number) =>
  fromHost(MessageType.LIGHTBOX_BOARDS, { requestId: null, boardId: 'board-6', adoption, observation, shelf });

/** Each notice that offers "Read the current text": the one above the board, and the rail's. */
function notices() {
  const board = screen.queryByLabelText('The saved board and its file');
  const rail = within(screen.getByLabelText('Saved boards')).queryByRole('button', { name: 'Read the current text' });
  return { board: board !== null, rail: rail !== null };
}

describe('LightboxApp: saved boards (Slice 5A.1)', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: makeBoard(6), refusal: null });
  });

  it('shows the changed-file notice above the board and in the rail together, and takes them away together', () => {
    expect(notices()).toEqual({ board: false, rail: false });

    push(shelfWith('changed'), 1, 1);
    expect(notices()).toEqual({ board: true, rail: true });
    const above = screen.getByLabelText('The saved board and its file');
    // The rail's own words (dates in the webview's zone).
    expect(above.textContent).toMatch(/^Opened from the board saved Oct 2[12], 2026, .+\.The file has changed since\. This board shows the text as it was saved, and holds back Bring until you read the current text\.Read the current text$/);
    expect(above.textContent).toBe(within(screen.getByLabelText('Saved boards')).getAllByRole('status')[0].textContent);
    // Above the board: the first thing in the board's column.
    expect(screen.getByLabelText('Board').querySelector('.pm-lb-scroll')?.firstElementChild).toBe(above);

    push(shelfWith('same'), 1, 2);
    expect(notices()).toEqual({ board: false, rail: false });
  });

  it('keeps both as the newest shelf says: an earlier observation, or an earlier adoption, changes neither (PR #163 F-02, F-05)', () => {
    push(shelfWith('same'), 2, 5);
    push(shelfWith('changed'), 2, 4);
    expect(notices()).toEqual({ board: false, rail: false });
    push(shelfWith('changed'), 1, 9);
    expect(notices()).toEqual({ board: false, rail: false });

    push(shelfWith('changed'), 2, 6);
    expect(notices()).toEqual({ board: true, rail: true });
    push(shelfWith('same'), 2, 3);
    expect(notices()).toEqual({ board: true, rail: true });
  });

  it('reads the current text from the notice above the board, as the rail\'s does', () => {
    push(shelfWith('changed'), 1, 1);
    fireEvent.click(within(screen.getByLabelText('The saved board and its file')).getByRole('button', { name: 'Read the current text' }));
    expect(vscode.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ type: MessageType.LIGHTBOX_REFRESH_SOURCE }));
  });

  it('shows a name from the shelf, renames by the host\'s ids, and saves no name in the webview\'s state', () => {
    push(shelfWith('same', {
      name: NAME,
      boards: [{ ...shelfWith('same').boards[0], name: NAME, lenses: ['headline'], models: ['provider/model-v1'] }]
    }), 1, 1);
    const rail = screen.getByLabelText('Saved boards');
    expect(rail.querySelector('.pm-lb-board-name-label')?.textContent).toBe(NAME);
    expect(rail.querySelector('.pm-lb-saved-board-name')?.textContent).toBe(NAME);
    expect(rail.querySelector('.pm-lb-saved-board-models')?.textContent).toBe('Read by model-v1');

    fireEvent.click(within(rail).getByRole('button', { name: 'Rename the board on screen' }));
    fireEvent.change(within(rail).getByRole('textbox'), { target: { value: 'model C' } });
    fireEvent.keyDown(within(rail).getByRole('textbox'), { key: 'Enter' });

    expect(vscode.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      type: MessageType.LIGHTBOX_RENAME_BOARD,
      payload: { requestId: expect.any(String), boardId: 'board-6', fileId: null, name: 'model C' }
    }));
    const saved = JSON.stringify(vscode.setState.mock.calls);
    expect(saved).not.toContain(NAME);
    expect(saved).not.toContain('model C');
  });
});

/** @jest-environment jsdom */

/**
 * The Lightbox's "Choose from project…" (2026-10-20): the source panel opens
 * the shared project picker, the Workshop's "Choose from project", over the
 * Lightbox's own routes. The picker browses and searches the catalog the
 * host sends, a row boards by its catalog key, the escape hatch is the
 * system picker, and the picker sits on the overlay stack: Escape closes it
 * before it lets go of a pinned item, and focus returns to the button that
 * opened it. Nothing posted is a Workshop route. File names are synthetic or
 * public-domain.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';

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
// eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked component's export name.
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { LightboxApp } from '@/presentation/webview/LightboxApp';

const CATALOG = [
  { group: 'chapters', path: 'Chapters/01-down-the-rabbit-hole.md', label: '01 down the rabbit hole', sizeBytes: 12_400 },
  { group: 'chapters', path: 'Chapters/02-the-pool-of-tears.md', label: '02 the pool of tears', sizeBytes: 11_900 },
  { group: 'characters', path: 'Characters/white-rabbit.md', label: 'white rabbit', sizeBytes: 900 }
];

const fromHost = (type: MessageType, payload: object) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: { type, source: 'extension.lightbox', payload, timestamp: 1 }
    }));
  });

describe('LightboxApp Choose from project…', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = () => vscode.postMessage.mock.calls.map(([message]) => message);
  const sinceOpen = (from: number) => posted().slice(from).map(({ type, source, payload }) => ({ type, source, payload }));

  beforeEach(() => {
    jest.useFakeTimers();
    __resetOverlayFocusStateForTests();
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });
  afterEach(() => {
    jest.useRealTimers();
    __resetOverlayFocusStateForTests();
  });

  /** Mount with a board, open the picker from the source panel, and return its button and dialog. */
  function openFromRail(options: { board?: boolean } = {}) {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: options.board === false ? null : makeBoard(6), refusal: null });
    const button = within(screen.getByLabelText('Source')).getByRole('button', { name: 'Choose from project…' });
    button.focus();
    const from = posted().length;
    fireEvent.click(button);
    return { button, from, dialog: () => screen.getByRole('dialog', { name: 'Choose from project' }) };
  }

  it('opens the shared picker from the source panel, asks for the catalog, and browses what arrives', () => {
    const { from, dialog } = openFromRail();

    expect(sinceOpen(from)).toEqual([
      { type: MessageType.LIGHTBOX_REQUEST_PROJECT_CATALOG, source: 'webview.lightbox', payload: {} }
    ]);
    expect(within(dialog()).getByText('Board a source')).not.toBeNull();
    expect(within(dialog()).getByText('Reading your configured resource folders…')).not.toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close project picker');

    fromHost(MessageType.LIGHTBOX_PROJECT_CATALOG, { entries: CATALOG });
    expect(within(dialog()).getByRole('button', { name: /Chapters & Scenes/ }).textContent).toContain('2 files');
    fireEvent.click(within(dialog()).getByRole('button', { name: /Chapters & Scenes/ }));
    // One pick boards a source: rows are buttons, not checkboxes, and the footer says so.
    expect(within(dialog()).queryByRole('checkbox')).toBeNull();
    expect(within(dialog()).getByText('Click a file to board it')).not.toBeNull();
    expect(within(dialog()).getByRole('button', { name: /02-the-pool-of-tears\.md/ })).not.toBeNull();
  });

  it('boards a picked row by its catalog key, closes, and returns focus to the button', () => {
    const { button, from, dialog } = openFromRail();
    fromHost(MessageType.LIGHTBOX_PROJECT_CATALOG, { entries: CATALOG });

    fireEvent.click(within(dialog()).getByRole('button', { name: /Chapters & Scenes/ }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /01-down-the-rabbit-hole\.md/ }));
    // The overlay hands focus back on a microtask, which the fake timers hold.
    act(() => { jest.runAllTimers(); });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sinceOpen(from).at(-1)).toEqual({
      type: MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE,
      source: 'webview.lightbox',
      payload: { group: 'chapters', path: 'Chapters/01-down-the-rabbit-hole.md' }
    });
    expect(document.activeElement).toBe(button);
  });

  it('searches names here and content at the host, and merges what the host finds', () => {
    const { from, dialog } = openFromRail();
    fromHost(MessageType.LIGHTBOX_PROJECT_CATALOG, { entries: CATALOG });

    fireEvent.change(within(dialog()).getByLabelText('Search configured resources'), { target: { value: 'pool' } });
    act(() => { jest.advanceTimersByTime(500); });
    expect(within(dialog()).getAllByRole('button', { name: /\.md/ }).map((row) => row.textContent))
      .toEqual([expect.stringContaining('02-the-pool-of-tears.md')]);
    expect(sinceOpen(from).map(({ type }) => type)).toEqual([MessageType.LIGHTBOX_REQUEST_PROJECT_CATALOG]);

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Names + content' }));
    act(() => { jest.advanceTimersByTime(400); });
    expect(sinceOpen(from).at(-1)).toEqual({
      type: MessageType.LIGHTBOX_SEARCH_PROJECT_CATALOG,
      source: 'webview.lightbox',
      payload: { query: 'pool' }
    });
    fromHost(MessageType.LIGHTBOX_PROJECT_CATALOG_SEARCH_RESULTS, {
      query: 'pool',
      matches: [{ group: 'characters', path: 'Characters/white-rabbit.md' }],
      bounded: false
    });
    expect(within(dialog()).getByRole('button', { name: /^All · 2$/ })).not.toBeNull();
    expect(within(dialog()).getByRole('button', { name: /white-rabbit\.md/ })).not.toBeNull();
  });

  it('says when the configured folders could not be read', () => {
    const { dialog } = openFromRail();
    fromHost(MessageType.LIGHTBOX_PROJECT_CATALOG, { entries: [], unreadable: true });

    expect(within(dialog()).getByText('Could not read your configured resource folders. Use Explore below.')).not.toBeNull();
  });

  it('sends Explore project folders… to the system picker, and opens from the board\'s welcome too', () => {
    const { from, dialog } = openFromRail({ board: false });
    fromHost(MessageType.LIGHTBOX_PROJECT_CATALOG, { entries: CATALOG });

    fireEvent.click(within(dialog()).getByRole('button', { name: /Explore project folders/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sinceOpen(from).at(-1)).toEqual({
      type: MessageType.LIGHTBOX_PICK_SOURCE_FILE,
      source: 'webview.lightbox',
      payload: {}
    });

    fireEvent.click(within(screen.getByLabelText('Board')).getByRole('button', { name: 'Choose from project…' }));
    expect(screen.getByRole('dialog', { name: 'Choose from project' })).not.toBeNull();
    expect(posted().filter(({ type }) => String(type).startsWith('workshop_'))).toEqual([]);
  });

  it('closes on Escape before letting go of a pinned item, which the next Escape releases', async () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: makeBoard(6), refusal: null });
    fireEvent.click(screen.getByTitle('alice ×5'));
    const inspector = screen.getByLabelText('Inspector');
    expect(within(inspector).getByRole('heading', { name: 'alice' })).not.toBeNull();

    fireEvent.click(within(screen.getByLabelText('Source')).getByRole('button', { name: 'Choose from project…' }));
    fromHost(MessageType.LIGHTBOX_PROJECT_CATALOG, { entries: CATALOG });
    fireEvent.keyDown(window, { key: 'Escape' });
    await act(async () => { await Promise.resolve(); });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(inspector).getByRole('heading', { name: 'alice' })).not.toBeNull();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(within(inspector).queryByRole('heading', { name: 'alice' })).toBeNull();
  });

  it('opens fresh each time: the last catalog is not shown as the current one', () => {
    const { dialog } = openFromRail();
    fromHost(MessageType.LIGHTBOX_PROJECT_CATALOG, { entries: CATALOG });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close project picker' }));

    fireEvent.click(within(screen.getByLabelText('Source')).getByRole('button', { name: 'Choose from project…' }));
    expect(within(dialog()).getByText('Reading your configured resource folders…')).not.toBeNull();
  });
});

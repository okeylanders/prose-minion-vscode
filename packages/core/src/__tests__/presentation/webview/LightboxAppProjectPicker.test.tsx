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

describe('LightboxApp context: Add from project…', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = () => vscode.postMessage.mock.calls.map(([message]) => message);

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

  /** Mount with a board and one context file on the shelf, then open the picker from the context list. */
  function openFromContext(shelf = { totalWords: 15, ceilingWords: 10_000 }) {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: makeBoard(6), refusal: null });
    fromHost(MessageType.LIGHTBOX_CONTEXT_FILES, {
      files: [{ id: 'ctx-1', displayPath: 'Characters/white-rabbit.md', wordCount: shelf.totalWords }],
      totalWords: shelf.totalWords,
      ceilingWords: shelf.ceilingWords
    });
    const from = posted().length;
    fireEvent.click(within(screen.getByLabelText('Context')).getByRole('button', { name: 'Add from project…' }));
    fromHost(MessageType.LIGHTBOX_PROJECT_CATALOG, { entries: CATALOG });
    return { from, dialog: () => screen.getByRole('dialog', { name: 'Choose from project' }) };
  }

  it('attaches several as the Workshop does: checkboxes, the shelf\'s files attached, a running estimate, then one request', () => {
    const { from, dialog } = openFromContext();

    expect(posted()[from]).toMatchObject({ type: MessageType.LIGHTBOX_REQUEST_PROJECT_CATALOG });
    expect(within(dialog()).getByText('Add context')).not.toBeNull();
    expect(within(dialog()).getByText('Nothing selected')).not.toBeNull();
    fireEvent.click(within(dialog()).getByRole('button', { name: /Characters/ }));
    const onShelf = within(dialog()).getByRole('checkbox', { name: /white-rabbit\.md/ }) as HTMLButtonElement;
    expect(onShelf.disabled).toBe(true);
    expect(onShelf.textContent).toContain('attached');

    fireEvent.click(within(dialog()).getByRole('button', { name: /Back/ }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /Chapters & Scenes/ }));
    fireEvent.click(within(dialog()).getByRole('checkbox', { name: /02-the-pool-of-tears/ }));
    fireEvent.click(within(dialog()).getByRole('checkbox', { name: /01-down-the-rabbit-hole/ }));
    // 24,300 bytes at the Workshop's six bytes a word.
    expect(within(dialog()).getByText('2 files · ~4,050 words est.')).not.toBeNull();
    expect(within(dialog()).queryByText(/Likely over/)).toBeNull();

    fireEvent.click(within(dialog()).getByRole('button', { name: /Add 2 files/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(posted().at(-1)).toMatchObject({
      type: MessageType.LIGHTBOX_ADD_PROJECT_CONTEXT,
      source: 'webview.lightbox',
      payload: { items: [
        { group: 'chapters', path: 'Chapters/02-the-pool-of-tears.md' },
        { group: 'chapters', path: 'Chapters/01-down-the-rabbit-hole.md' }
      ] }
    });
  });

  it('warns when the selection is likely over the words the shelf has left', () => {
    const { dialog } = openFromContext({ totalWords: 9_000, ceilingWords: 10_000 });
    fireEvent.click(within(dialog()).getByRole('button', { name: /Chapters & Scenes/ }));
    fireEvent.click(within(dialog()).getByRole('checkbox', { name: /01-down-the-rabbit-hole/ }));

    expect(within(dialog()).getByText('Likely over the remaining 1,000-word budget')).not.toBeNull();
  });

  it('shows what the host added and why it refused the rest, and asks for a fresh estimate', () => {
    openFromContext();
    const estimatesBefore = posted().filter(({ type }) => type === MessageType.LIGHTBOX_SET_LENSES).length;

    fromHost(MessageType.LIGHTBOX_CONTEXT_FILES, {
      files: [
        { id: 'ctx-1', displayPath: 'Characters/white-rabbit.md', wordCount: 15 },
        { id: 'ctx-2', displayPath: 'Chapters/02-the-pool-of-tears.md', wordCount: 1_980 }
      ],
      totalWords: 1_995,
      ceilingWords: 10_000,
      notice: 'Added 1 of 2. Chapters/01-down-the-rabbit-hole.md: The Lightbox reads files inside an open workspace folder.'
    });

    const context = screen.getByLabelText('Context');
    expect(within(context).getByText('Chapters/02-the-pool-of-tears.md')).not.toBeNull();
    expect(within(context).getByRole('alert').textContent).toContain('inside an open workspace folder');
    expect(posted().filter(({ type }) => type === MessageType.LIGHTBOX_SET_LENSES)).toHaveLength(estimatesBefore + 1);
  });

  it('sends Explore project folders… to the context list\'s system picker', () => {
    const { dialog } = openFromContext();

    fireEvent.click(within(dialog()).getByRole('button', { name: /Explore project folders/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(posted().at(-1)).toMatchObject({ type: MessageType.LIGHTBOX_ADD_CONTEXT_FILES, payload: {} });
    expect(posted().filter(({ type }) => String(type).startsWith('workshop_'))).toEqual([]);
  });
});

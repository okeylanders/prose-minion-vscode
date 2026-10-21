/** @jest-environment jsdom */

/**
 * The Lightbox's project picker takes only the answers to its current
 * opening's latest requests (PR #154 F-01).
 *
 * End to end: the real LightboxApp, wired to the real LightboxHandler and
 * catalog service (`lightboxHandlerHarness`) through a stand-in transport.
 * The host's answers are queued as the handler posts them and delivered in
 * the order each case needs; catalog opens are held so an older request can
 * finish after a newer one. Each case failed before the fix: an answer to a
 * canceled opening, an older query, or a cleared search replaced the one on
 * screen. All file names and text are synthetic.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ExtensionToWebviewMessage, MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';
import { createLightboxHost, WORKSPACE } from '@/__tests__/application/handlers/domain/lightboxHandlerHarness';

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
// eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked component's export name.
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { LightboxApp } from '@/presentation/webview/LightboxApp';

/** The webview messages the Lightbox handler answers; the rest are other handlers'. */
const HOST_ROUTES = new Set<string>([
  MessageType.LIGHTBOX_REQUEST_BOARD,
  MessageType.LIGHTBOX_REQUEST_PROJECT_CATALOG,
  MessageType.LIGHTBOX_SEARCH_PROJECT_CATALOG
]);

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** The Lightbox tab over a real handler: what the webview posts reaches it, and what it posts waits to be delivered. */
function openTab() {
  const host = createLightboxHost();
  const queued: ExtensionToWebviewMessage[] = [];
  const panel = host.openPanel({ onPost: (message) => queued.push(message) });
  const vscode = createMockVSCode();
  vscode.postMessage.mockImplementation((message: { type: MessageType; payload?: object }) => {
    if (HOST_ROUTES.has(message.type)) {
      void panel.route(message.type, message.payload);
    }
  });
  (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  render(<LightboxApp />);

  /** Let the host finish what it can, then deliver what it posted, in order. */
  const exchange = async () => {
    await act(async () => {
      for (let round = 0; round < 8; round++) {
        await wait(0);
      }
    });
    act(() => {
      for (const message of queued.splice(0)) {
        window.dispatchEvent(new MessageEvent('message', { data: message }));
      }
    });
  };
  const dialog = () => screen.getByRole('dialog', { name: 'Choose from project' });
  const categories = () => Array.from(dialog().querySelectorAll('.pm-ws-ctxsel-cat-name')).map((name) => name.textContent);
  const rows = () => Array.from(dialog().querySelectorAll('.pm-ws-ctxsel-path')).map((row) => row.textContent);
  const openSource = () =>
    fireEvent.click(within(screen.getByLabelText('Source')).getByRole('button', { name: 'Choose from project…' }));
  const close = () => fireEvent.click(within(dialog()).getByRole('button', { name: 'Close project picker' }));
  /** Type a query in Names + content mode and wait out the debounce, so its search is sent. */
  const searchContent = async (query: string) => {
    fireEvent.change(within(dialog()).getByLabelText('Search configured resources'), { target: { value: query } });
    const contentMode = within(dialog()).getByRole('button', { name: 'Names + content' });
    if (contentMode.getAttribute('aria-pressed') !== 'true') {
      fireEvent.click(contentMode);
    }
    await act(async () => { await wait(400); });
  };
  return { host, panel, exchange, dialog, categories, rows, openSource, close, searchContent };
}

describe('the Lightbox project picker takes only its current requests\' answers (PR #154 F-01)', () => {
  beforeEach(() => __resetOverlayFocusStateForTests());
  afterEach(() => __resetOverlayFocusStateForTests());

  it('a canceled opening\'s late failure never replaces the catalog of the opening on screen', async () => {
    const tab = openTab();
    tab.host.addProjectFile('chapters', 'Chapters/fresh.md', 'A fresh chapter.');
    await tab.exchange();

    const first = tab.host.holdCatalog();
    tab.openSource();
    tab.close();
    tab.openSource();
    await tab.exchange();
    expect(tab.categories()).toEqual(['Chapters & Scenes']);

    first.fail();
    await tab.exchange();

    expect(tab.categories()).toEqual(['Chapters & Scenes']);
    expect(within(tab.dialog()).queryByText(/Could not read your configured resource folders/)).toBeNull();
  });

  it('a canceled opening\'s late success never replaces the catalog of the opening on screen', async () => {
    const tab = openTab();
    tab.host.addProjectFile('themes', 'Themes/stale.md', 'A theme since moved away.');
    const stale = tab.host.projectListing();
    tab.host.removeProjectFile('Themes/stale.md');
    tab.host.addProjectFile('chapters', 'Chapters/fresh.md', 'A fresh chapter.');
    await tab.exchange();

    const first = tab.host.holdCatalog();
    tab.openSource();
    tab.close();
    tab.openSource();
    await tab.exchange();
    first.release(stale);
    await tab.exchange();

    expect(tab.categories()).toEqual(['Chapters & Scenes']);
  });

  it('a source picker\'s late catalog never reaches the Context picker opened after it', async () => {
    const tab = openTab();
    tab.host.addProjectFile('characters', 'Characters/keeper.md', 'The keeper of the lamp.');
    await tab.exchange();

    const first = tab.host.holdCatalog();
    tab.openSource();
    tab.close();
    fireEvent.click(within(screen.getByLabelText('Context')).getByRole('button', { name: 'Add from project…' }));
    await tab.exchange();
    expect(within(tab.dialog()).getByText('Add context')).not.toBeNull();
    expect(tab.categories()).toEqual(['Characters']);

    first.fail();
    await tab.exchange();

    expect(within(tab.dialog()).getByText('Add context')).not.toBeNull();
    expect(tab.categories()).toEqual(['Characters']);
    expect(within(tab.dialog()).queryByText(/Could not read your configured resource folders/)).toBeNull();
  });

  it('an older query answered after a newer one never removes the newer query\'s matches', async () => {
    const tab = openTab();
    tab.host.addProjectFile('characters', 'Notes/amber.md', 'An amberneedle hides in the hay.');
    tab.host.addProjectFile('characters', 'Notes/violet.md', 'A violetneedle hides in the hay.');
    await tab.exchange();
    tab.openSource();
    await tab.exchange();

    const older = tab.host.holdCatalog();
    await tab.searchContent('amberneedle');
    await tab.searchContent('violetneedle');
    await tab.exchange();
    expect(tab.rows()).toEqual(['Notes/violet.md']);

    older.release();
    await tab.exchange();

    expect(tab.rows()).toEqual(['Notes/violet.md']);
    expect(within(tab.dialog()).queryByText(/No matching names or content/)).toBeNull();
  });

  it('the same query asked again in a new opening shows only that opening\'s answer', async () => {
    const tab = openTab();
    const first = tab.host.addProjectFile('characters', 'Notes/first.md', 'A quartzneedle under the stair.');
    const second = tab.host.addProjectFile('characters', 'Notes/second.md', 'Nothing under this stair.');
    await tab.exchange();
    tab.openSource();
    await tab.exchange();

    const older = tab.host.holdCatalog();
    await tab.searchContent('quartzneedle');
    tab.close();
    tab.openSource();
    await tab.exchange();
    await tab.searchContent('quartzneedle');
    await tab.exchange();
    expect(tab.rows()).toEqual(['Notes/first.md']);

    // The files change before the canceled opening's search reads them, so its answer differs.
    tab.host.files.set(first, 'Nothing under this stair now.');
    tab.host.files.set(second, 'The quartzneedle moved here.');
    older.release();
    await tab.exchange();

    expect(tab.rows()).toEqual(['Notes/first.md']);
  });

  it('a search cleared while it ran is not shown when the same query is typed again', async () => {
    const tab = openTab();
    const old = tab.host.addProjectFile('characters', 'Notes/old.md', 'Nothing here yet.');
    await tab.exchange();
    tab.openSource();
    await tab.exchange();

    const cleared = tab.host.holdCatalog();
    await tab.searchContent('quartzneedle');
    fireEvent.change(within(tab.dialog()).getByLabelText('Search configured resources'), { target: { value: '' } });
    tab.host.files.set(old, 'A quartzneedle, found by the search the writer cleared.');
    cleared.release();
    await tab.exchange();

    // Typed again: until its own search answers, the cleared one's match is not shown.
    fireEvent.change(within(tab.dialog()).getByLabelText('Search configured resources'), { target: { value: 'quartzneedle' } });
    expect(tab.rows()).toEqual([]);
    expect(`${WORKSPACE}/Notes/old.md`).toBe(old);
  });

  it('shows the safety-bound note only for the answer to the current query', async () => {
    const tab = openTab();
    tab.host.addProjectFile('characters', 'Notes/amber.md', 'An amberneedle hides in the hay.');
    tab.host.addProjectFile('characters', 'Notes/violet.md', 'A violetneedle hides in the hay.');
    await tab.exchange();
    tab.openSource();
    await tab.exchange();

    const older = tab.host.holdCatalog();
    await tab.searchContent('amberneedle');
    await tab.searchContent('violetneedle');
    await tab.exchange();
    expect(within(tab.dialog()).queryByRole('status')).toBeNull();

    // A file past the per-file bound arrives before the older search reads the catalog: its answer is bounded.
    tab.host.addProjectFile('manuscript', 'Notes/huge.md', 'needle', { sizeBytes: 300_000 });
    older.release();
    await tab.exchange();
    expect(within(tab.dialog()).queryByRole('status')).toBeNull();
    expect(tab.rows()).toEqual(['Notes/violet.md']);

    // The current query's own bounded answer does show it.
    await tab.searchContent('needle');
    await tab.exchange();
    expect(within(tab.dialog()).getByRole('status').textContent).toContain('Content search stopped at its safety bounds');
  });
});

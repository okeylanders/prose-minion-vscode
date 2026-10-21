/** @jest-environment jsdom */

/**
 * The `lightbox` surface's root (ADR 2026-10-19 D1–D6, Slice 2A): the board
 * on the shared full-tab frame, with the source rail, the counted tiles, the
 * ribbon that lights what is hovered, the inspector, and the readings still
 * to come.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MessageType } from '@messages';
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

const litColumns = () =>
  Array.from(document.querySelectorAll('.pm-lb-col'))
    .flatMap((column, index) => (column.querySelector('.pm-lb-col-focus.is-lit') ? [index] : []));

describe('LightboxApp', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  it('renders the Lightbox brand on the shared frame, with a rail, the board and an inspector', () => {
    const { container } = render(<LightboxApp />);

    expect(screen.getByRole('heading', { name: 'Lightbox' })).not.toBeNull();
    expect(screen.getByText('Prose Minion · Inspiration & Mood Board')).not.toBeNull();
    expect(screen.getByLabelText('Board rail').className).toBe('pm-ws-rail');
    expect(screen.getByLabelText('Inspector').className).toBe('pm-ws-aside');
    expect(container.firstElementChild?.className).toBe('pm-ws pm-ws-with-aside');
    expect(screen.getByRole('status').textContent).toBe('Loading the board…');

    const posted = vscode.postMessage.mock.calls.map(([message]) => `${message.type} ${message.source}`);
    expect(posted).toEqual(expect.arrayContaining([
      `${MessageType.LIGHTBOX_REQUEST_BOARD} webview.lightbox`,
      `${MessageType.REQUEST_API_KEY} webview.lightbox`
    ]));
    expect(posted.filter((entry) => entry.startsWith('workshop_'))).toEqual([]);
  });

  it('invites a source when nothing is boarded yet', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: null, refusal: null });

    expect(screen.getByRole('heading', { name: 'Hold a chapter up to the light.' })).not.toBeNull();
    fireEvent.click(within(screen.getByLabelText('Board')).getByRole('button', { name: 'Choose from project…' }));
    expect(vscode.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      type: MessageType.LIGHTBOX_REQUEST_PROJECT_CATALOG,
      source: 'webview.lightbox'
    }));
    expect(screen.getByRole('dialog', { name: 'Choose from project' })).not.toBeNull();
  });

  it('shows the counted board, with readings not yet read and the Read button waiting for its estimate', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: makeBoard(6), refusal: null });

    expect(screen.getByText(/Drafts\/alice-1\.md · 200 words/)).not.toBeNull();
    expect(screen.getByLabelText('Headline stats')).not.toBeNull();
    expect(screen.getByLabelText('Top words · sized by count').getAttribute('data-register')).toBe('measured');
    expect(screen.getByLabelText('Parts of speech · repetition')).not.toBeNull();
    const motifs = screen.getByLabelText('Motifs · where they recur');
    expect(motifs.getAttribute('data-register')).toBe('read');
    expect(within(motifs).getByText('Not read yet. Runs with the next press.')).not.toBeNull();

    // Nothing is priced until the host estimates, so the press waits.
    const read = screen.getByRole('button', { name: /Read the chapter/ }) as HTMLButtonElement;
    expect(read.disabled).toBe(true);
    expect(screen.getByText('Estimating the cost…')).not.toBeNull();
    expect(screen.queryByText(/\$\d/)).toBeNull();
  });

  it('lights the paragraphs a hovered word touches, and pins it in the inspector', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: makeBoard(6), refusal: null });
    const word = screen.getByTitle('alice ×5');

    fireEvent.mouseEnter(word);
    expect(litColumns()).toEqual([1, 3, 4, 5]);
    fireEvent.mouseLeave(word);
    expect(litColumns()).toEqual([]);

    fireEvent.click(word);
    const inspector = screen.getByLabelText('Inspector');
    expect(within(inspector).getByRole('heading', { name: 'alice' })).not.toBeNull();
    expect(within(inspector).getByText('Measured')).not.toBeNull();
    expect(litColumns()).toEqual([1, 3, 4, 5]);
    expect(vscode.setState).toHaveBeenLastCalledWith(expect.objectContaining({
      lightboxSelectedItem: { kind: 'word', word: 'alice' }
    }));
    expect(vscode.setState.mock.calls.at(-1)?.[0]).not.toHaveProperty('board');

    fireEvent.click(within(inspector).getByRole('button', { name: '¶4' }));
    expect(within(inspector).getByRole('heading', { name: '¶4' })).not.toBeNull();
    expect(litColumns()).toEqual([3]);
  });

  it('shows a refusal with its count and suggestion', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: null, refusal: null });
    fromHost(MessageType.LIGHTBOX_SOURCE_REFUSED, {
      refusal: {
        id: 'refusal-1',
        reason: 'over-ceiling',
        message: 'This source has 60,214 words. The Lightbox boards up to 50,000 words at a time.',
        wordCount: 60_214,
        ceilingWords: 50_000,
        displayPath: 'Drafts/whole-book.md',
        suggestion: 'Choose a single chapter.'
      }
    });

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Too long for one board')).not.toBeNull();
    expect(alert.textContent).toContain('60,214 words');
    expect(alert.textContent).toContain('Choose a single chapter.');
    fireEvent.click(within(alert).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(vscode.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      type: MessageType.LIGHTBOX_DISMISS_REFUSAL,
      payload: { refusalId: 'refusal-1' }
    }));
  });

  it('shows a refusal the mount answer carries, over the welcome (PR #148 F-02)', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, {
      board: null,
      refusal: { id: 'refusal-2', reason: 'unreadable', message: 'Only a saved file can be boarded this way.', displayPath: 'Untitled-1' }
    });

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Could not board that source')).not.toBeNull();
    expect(alert.textContent).toContain('Untitled-1');
    expect(screen.getByRole('heading', { name: 'Hold a chapter up to the light.' })).not.toBeNull();
  });

  it('names the refused source over the board it keeps', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, {
      board: makeBoard(6),
      refusal: { id: 'refusal-3', reason: 'over-ceiling', message: 'Too long.', displayPath: 'Drafts/whole-book.md' }
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Drafts/whole-book.md');
    expect(within(alert).getByText('The board below still shows Drafts/alice-1.md.')).not.toBeNull();
    expect(screen.getByLabelText('Headline stats')).not.toBeNull();
  });

  it('hides a placeholder when its lens is turned off', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: makeBoard(6), refusal: null });

    fireEvent.click(within(screen.getByLabelText('Lenses')).getByRole('checkbox', { name: /Voice/ }));
    expect(screen.queryByLabelText('Voice')).toBeNull();
    expect(screen.getByLabelText('Characters · the vibes they give')).not.toBeNull();
  });
});

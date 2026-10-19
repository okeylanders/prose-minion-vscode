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
    fromHost(MessageType.LIGHTBOX_BOARD, { board: null });

    expect(screen.getByRole('heading', { name: 'Hold a chapter up to the light.' })).not.toBeNull();
    fireEvent.click(within(screen.getByLabelText('Board')).getByRole('button', { name: 'Choose file' }));
    expect(vscode.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      type: MessageType.LIGHTBOX_PICK_SOURCE_FILE,
      source: 'webview.lightbox'
    }));
  });

  it('shows the counted board, with readings not yet read and the Read button disabled', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: makeBoard(6) });

    expect(screen.getByText(/Drafts\/alice-1\.md · 200 words/)).not.toBeNull();
    expect(screen.getByLabelText('Headline stats')).not.toBeNull();
    expect(screen.getByLabelText('Top words · sized by count').getAttribute('data-register')).toBe('measured');
    expect(screen.getByLabelText('Parts of speech · repetition')).not.toBeNull();
    const motifs = screen.getByLabelText('Motifs · where they recur');
    expect(motifs.getAttribute('data-register')).toBe('read');
    expect(within(motifs).getByText('Not read yet. Readings arrive in the next update.')).not.toBeNull();

    const read = screen.getByRole('button', { name: /Read the chapter/ }) as HTMLButtonElement;
    expect(read.disabled).toBe(true);
    expect(read.getAttribute('aria-describedby')).toBe('pm-lb-read-note');
    expect(document.getElementById('pm-lb-read-note')?.textContent).toBe('Readings arrive in the next update');
    expect(screen.queryByText(/\$\d/)).toBeNull();
  });

  it('lights the paragraphs a hovered word touches, and pins it in the inspector', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: makeBoard(6) });
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
    fromHost(MessageType.LIGHTBOX_BOARD, { board: null });
    fromHost(MessageType.LIGHTBOX_SOURCE_REFUSED, {
      refusal: {
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
  });

  it('hides a placeholder when its lens is turned off', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: makeBoard(6) });

    fireEvent.click(within(screen.getByLabelText('Lenses')).getByRole('checkbox', { name: /Voice/ }));
    expect(screen.queryByLabelText('Voice')).toBeNull();
    expect(screen.getByLabelText('Characters · the vibes they give')).not.toBeNull();
  });
});

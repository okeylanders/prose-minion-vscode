/** @jest-environment jsdom */

/**
 * The estimate, the progress and Stop belong to their board and their
 * request (PR #149 F-03), on the real Lightbox root. The host is played by
 * window messages, interleaved the way the review reproduced them: a board
 * switch with a late reply, out-of-order replies for one board, a model
 * change, two boards' runs at once, and late progress after Stop or a new
 * run.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { LightboxBoard, LightboxReadingGroupId, MessageType } from '@messages';
import { emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';
import { makeEstimate } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';

jest.mock('../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../presentation/webview/styles/lightbox/tokens.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/board.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/ribbon.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/tiles.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/rail.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/inspector.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/readings.css', () => ({}));
// eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked component's export name.
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { LightboxApp } from '@/presentation/webview/LightboxApp';

const fromHost = (type: MessageType, payload: object) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { type, source: 'extension.lightbox', payload, timestamp: 1 } }));
  });

const A = makeBoard(8);
const B: LightboxBoard = {
  ...makeBoard(8),
  boardId: 'board-B',
  source: { ...A.source, displayPath: 'Drafts/other.md', contentHash: 'other-hash' }
};
const estimateFor = (board: LightboxBoard, overrides: Parameters<typeof makeEstimate>[0] = {}) =>
  makeEstimate({ boardId: board.boardId, key: `key-${board.boardId}`, ...overrides });
const readingAll = (board: LightboxBoard): LightboxBoard => ({
  ...board,
  readings: (['A', 'B', 'C'] as const).map((group) => ({ ...emptyLightboxReadingGroup(group), status: 'running' as const, pending: [] }))
});
const groups: LightboxReadingGroupId[] = ['A', 'B', 'C'];

describe('LightboxApp: estimates, progress and Stop belong to their board (PR #149 F-03)', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const sent = (type: MessageType) => vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);
  /** The latest estimate request the tab sent. */
  const lastRequest = () => sent(MessageType.LIGHTBOX_SET_LENSES).at(-1);
  const answer = (request: { payload: { requestId?: string } } | undefined, estimate: object | null, extra: object = {}) =>
    fromHost(MessageType.LIGHTBOX_RUN_ESTIMATE, { requestId: request?.payload.requestId, estimate, ...extra });
  const press = () => screen.getByRole('button', { name: /Read the chapter/ }) as HTMLButtonElement;
  const lensCost = () => screen.getByLabelText('Lenses').querySelector('.pm-lb-meta')?.textContent;
  const started = (board: LightboxBoard, token: string) => {
    fromHost(MessageType.LIGHTBOX_BOARD, { board: readingAll(board), refusal: null });
    fromHost(MessageType.LIGHTBOX_RUN_PROGRESS, { boardId: board.boardId, token, phase: 'started', groups, groupsBack: 0, outputCharacters: 0 });
  };

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  it('switching boards withdraws the old price, and a late reply for the old board is never shown', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: A, refusal: null });
    const askedForA = lastRequest();
    answer(askedForA, estimateFor(A));
    expect(press().disabled).toBe(false);
    expect(lensCost()).toBe('3 calls · est. $0.04');

    fromHost(MessageType.LIGHTBOX_BOARD, { board: B, refusal: null });
    // B's estimate is pending: nothing to press, and no price from A.
    expect(screen.getByText('Estimating the cost…')).not.toBeNull();
    expect(press().disabled).toBe(true);
    expect(lensCost()).toBe('Estimating…');

    const askedForB = lastRequest();
    expect(askedForB?.payload.requestId).not.toBe(askedForA?.payload.requestId);
    const tooLarge = estimateFor(B, { fit: 'too-large', reason: 'Group A is too large for this model.' });
    tooLarge.groups[0].fit = 'too-large';
    answer(askedForB, tooLarge);
    answer(askedForA, estimateFor(A));
    expect(press().disabled).toBe(true);
    expect(document.getElementById('pm-lb-run-reason')?.textContent).toBe('Group A is too large for this model.');
  });

  it('a reply for the same board that arrives out of order never replaces the newer one', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: A, refusal: null });
    answer(lastRequest(), estimateFor(A));
    const lenses = screen.getByLabelText('Lenses');
    fireEvent.click(within(lenses).getByRole('checkbox', { name: /Genre neighborhood/ }));
    const withoutGenre = lastRequest();
    expect(press().disabled).toBe(true);
    fireEvent.click(within(lenses).getByRole('checkbox', { name: /Characters/ }));
    fireEvent.click(within(lenses).getByRole('checkbox', { name: /Voice/ }));
    const groupAOnly = lastRequest();

    answer(groupAOnly, estimateFor(A, { groups: estimateFor(A).groups.slice(0, 1), key: 'key-A-only' }));
    answer(withoutGenre, estimateFor(A, { groups: estimateFor(A).groups.slice(0, 2), key: 'key-A-B' }));
    expect(lensCost()).toMatch(/^1 call · /);
    fireEvent.click(press());
    expect(sent(MessageType.LIGHTBOX_RUN).at(-1)?.payload).toMatchObject({ boardId: A.boardId, estimateKey: 'key-A-only' });
  });

  it('a model change withdraws the price until the new model\'s own estimate lands', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: A, refusal: null });
    fromHost(MessageType.MODEL_DATA, { options: [], selections: { assistant: 'provider/model-v1' } });
    answer(lastRequest(), estimateFor(A));
    expect(press().disabled).toBe(false);
    const beforeSwitch = lastRequest();

    fromHost(MessageType.MODEL_DATA, { options: [], selections: { assistant: 'provider/model-v2' } });
    const afterSwitch = lastRequest();
    expect(afterSwitch?.payload.requestId).not.toBe(beforeSwitch?.payload.requestId);
    expect(press().disabled).toBe(true);
    answer(beforeSwitch, estimateFor(A));
    expect(press().disabled).toBe(true);
    answer(afterSwitch, estimateFor(A, { model: 'provider/model-v2', key: 'key-v2' }));
    expect(press().disabled).toBe(false);
  });

  it('one board finishing leaves another board\'s run, its progress and its Stop alone', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: A, refusal: null });
    answer(lastRequest(), estimateFor(A));
    fireEvent.click(press());
    started(A, 'run-A');

    // The source switches; A's run carries on. B is read too.
    fromHost(MessageType.LIGHTBOX_BOARD, { board: B, refusal: null });
    answer(lastRequest(), estimateFor(B));
    fireEvent.click(press());
    started(B, 'run-B');
    fromHost(MessageType.LIGHTBOX_RUN_PROGRESS, { boardId: B.boardId, token: 'run-B', phase: 'streaming', groups, groupsBack: 0, outputCharacters: 2_000 });

    fromHost(MessageType.LIGHTBOX_RUN_PROGRESS, { boardId: A.boardId, token: 'run-A', phase: 'streaming', groups, groupsBack: 2, outputCharacters: 9_000 });
    fromHost(MessageType.LIGHTBOX_RUN_PROGRESS, { boardId: A.boardId, token: 'run-A', phase: 'finished', groups, groupsBack: 3, outputCharacters: 9_000 });

    const stop = screen.getByRole('button', { name: 'Stop' }) as HTMLButtonElement;
    expect(stop.disabled).toBe(false);
    expect(screen.getByText('Reading… 0 of 3 lens groups back')).not.toBeNull();
    fireEvent.click(stop);
    expect(sent(MessageType.LIGHTBOX_CANCEL_RUN).at(-1)?.payload).toEqual({ boardId: B.boardId, token: 'run-B' });
  });

  it('a late estimate carrying another board\'s run never becomes this board\'s Stop', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: A, refusal: null });
    const askedForA = lastRequest();
    answer(askedForA, estimateFor(A));
    fireEvent.click(press());
    started(A, 'run-A');
    fromHost(MessageType.LIGHTBOX_BOARD, { board: B, refusal: null });
    answer(lastRequest(), estimateFor(B));
    fireEvent.click(press());
    started(B, 'run-B');

    answer(askedForA, estimateFor(A), { activeRun: { boardId: A.boardId, token: 'run-A', groups } });
    fromHost(MessageType.LIGHTBOX_RUN_PROGRESS, { boardId: A.boardId, token: 'run-A', phase: 'streaming', groups, groupsBack: 1, outputCharacters: 4_000 });

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(sent(MessageType.LIGHTBOX_CANCEL_RUN).at(-1)?.payload).toEqual({ boardId: B.boardId, token: 'run-B' });
  });

  it('late progress after a Stop, or from the run a new one replaced, leaves the run line alone', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: A, refusal: null });
    answer(lastRequest(), estimateFor(A));
    fireEvent.click(press());
    started(A, 'run-1');
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    const stopped = (['A', 'B', 'C'] as const).map((group) => ({
      ...emptyLightboxReadingGroup(group), status: 'cancelled' as const, error: 'Stopped before this group came back.'
    }));
    fromHost(MessageType.LIGHTBOX_BOARD, { board: { ...A, readings: stopped }, refusal: null });
    fromHost(MessageType.LIGHTBOX_RUN_PROGRESS, { boardId: A.boardId, token: 'run-1', phase: 'cancelled', groups, groupsBack: 0, outputCharacters: 0 });
    // A late message from the stopped run starts nothing.
    fromHost(MessageType.LIGHTBOX_RUN_PROGRESS, { boardId: A.boardId, token: 'run-1', phase: 'streaming', groups, groupsBack: 1, outputCharacters: 3_000 });
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Read the rest/ }));
    started(A, 'run-2');
    fromHost(MessageType.LIGHTBOX_RUN_PROGRESS, { boardId: A.boardId, token: 'run-1', phase: 'finished', groups, groupsBack: 3, outputCharacters: 3_000 });
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(sent(MessageType.LIGHTBOX_CANCEL_RUN).map((message) => message.payload)).toEqual([
      { boardId: A.boardId, token: 'run-1' },
      { boardId: A.boardId, token: 'run-2' }
    ]);
  });
});

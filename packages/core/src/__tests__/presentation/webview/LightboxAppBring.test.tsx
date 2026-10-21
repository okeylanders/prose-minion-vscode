/** @jest-environment jsdom */

/**
 * Bring to Workshop in the webview (ADR 2026-10-19 D11; Slice 4), through
 * the real Lightbox root: the inspector's Bring names the pinned tile and
 * nothing else; it waits for the host's answer, shows a refusal's reason,
 * and shows **Bound** only while the Workshop's tray holds the tile; the
 * header's tray counts confirmed stages and opens the Workshop; a spark is
 * brought as a question. The host is played by window messages; readings
 * come from the worked examples through the production codec and verifier,
 * over "Alice's Adventures in Wonderland" (1865, public domain).
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { LightboxBoard, LightboxWorkshopTrayTile } from '@messages';
import { MessageType } from '@messages';
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

const BOARD: LightboxBoard = { ...makeBoard(8), readings: [readGroup('A'), readGroup('B'), readGroup('C')] };
const tileOf = (kind: string, title?: string) => BOARD.readings.flatMap((group) => group.tiles)
  .find((tile) => tile.kind === kind && (title === undefined || tile.title === title))!;

describe('LightboxApp: Bring to Workshop (Slice 4)', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);
  const inspector = () => screen.getByLabelText('Inspector');
  const tray = (tiles: LightboxWorkshopTrayTile[]) => fromHost(MessageType.LIGHTBOX_WORKSHOP_TRAY, { tiles });

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: BOARD, refusal: null });
  });

  const pinRabbit = () => {
    const subtext = screen.getByLabelText('Subtext · said and meant');
    fireEvent.click(within(subtext).getByText('¶4 · White Rabbit').closest('button') as HTMLButtonElement);
    return tileOf('subtext');
  };

  it('brings a pinned reading by its id only, waits for the Workshop, then shows Bound while the Workshop holds it', () => {
    const rabbit = pinRabbit();
    const bring = within(inspector()).getByRole('button', { name: 'Bring to Workshop →' });
    fireEvent.click(bring);
    expect(posted(MessageType.LIGHTBOX_HAND_OFF)).toEqual([expect.objectContaining({
      payload: { kind: 'tile', boardId: BOARD.boardId, tileId: rabbit.id }
    })]);
    expect(within(inspector()).getByRole('button', { name: 'Bring to Workshop →' })).toHaveProperty('disabled', true);
    expect(inspector().textContent).toContain('Bringing it to the Workshop…');
    // A second press while one is on its way sends nothing.
    fireEvent.click(within(inspector()).getByRole('button', { name: 'Bring to Workshop →' }));
    expect(posted(MessageType.LIGHTBOX_HAND_OFF)).toHaveLength(1);

    // The Workshop staged it: its tray says so, then the answer lands.
    tray([{ boardId: BOARD.boardId, tileId: rabbit.id, label: 'Lightbox Said / meant: Late' }]);
    fromHost(MessageType.LIGHTBOX_HAND_OFF_RESULT, {
      kind: 'tile', boardId: BOARD.boardId, tileId: rabbit.id, ok: true, message: 'Staged “Late” above the Workshop composer.'
    });
    const bound = within(inspector()).getByRole('button', { name: 'Bound for Workshop' });
    expect(bound).toHaveProperty('disabled', true);
    expect(inspector().textContent).toContain('Waiting above the Workshop composer. Send it with a message or remove it there.');
    const header = document.querySelector('.pm-lb-tray') as HTMLElement;
    expect(header.textContent).toContain('1 tile bound for Workshop');

    fireEvent.click(within(inspector()).getByRole('button', { name: 'Open Workshop →' }));
    fireEvent.click(within(header).getByRole('button', { name: 'Open Workshop →' }));
    expect(posted(MessageType.LIGHTBOX_OPEN_WORKSHOP)).toHaveLength(2);

    // The writer sent or removed it in the Workshop: the tray empties, and the tile can come again.
    tray([]);
    expect(document.querySelector('.pm-lb-tray')).toBeNull();
    expect(within(inspector()).getByRole('button', { name: 'Bring to Workshop →' })).toHaveProperty('disabled', false);
  });

  it('shows the Workshop\'s refusal with its reason, and lets the writer try again', () => {
    const rabbit = pinRabbit();
    fireEvent.click(within(inspector()).getByRole('button', { name: 'Bring to Workshop →' }));
    // An answer for another item is not this one's.
    fromHost(MessageType.LIGHTBOX_HAND_OFF_RESULT, {
      kind: 'tile', boardId: BOARD.boardId, tileId: 'lbt-other', ok: false, message: 'Not yours.'
    });
    expect(inspector().textContent).not.toContain('Not yours.');
    fromHost(MessageType.LIGHTBOX_HAND_OFF_RESULT, {
      kind: 'tile', boardId: BOARD.boardId, tileId: rabbit.id, ok: false,
      message: 'The Workshop is busy: a response is running, or the session is being saved or replaced. Bring the tile again when it finishes.'
    });
    expect(inspector().textContent).toContain('The Workshop is busy: a response is running');
    expect(document.querySelector('.pm-lb-bring.is-refused')).not.toBeNull();
    expect(document.querySelector('.pm-lb-tray')).toBeNull();
    expect(within(inspector()).getByRole('button', { name: 'Bring to Workshop →' })).toHaveProperty('disabled', false);
  });

  it('counts every tile the Workshop holds in the header, from any board, and nothing still on its way', () => {
    const rabbit = pinRabbit();
    fireEvent.click(within(inspector()).getByRole('button', { name: 'Bring to Workshop →' }));
    expect(document.querySelector('.pm-lb-tray')).toBeNull();
    tray([
      { boardId: 'board-older', tileId: 'lbt-older-1', label: 'Lightbox Motif: Falling' },
      { boardId: BOARD.boardId, tileId: rabbit.id, label: 'Lightbox Said / meant: Late' }
    ]);
    expect((document.querySelector('.pm-lb-tray') as HTMLElement).textContent).toContain('2 tiles bound for Workshop');
  });

  it('brings a spark as a question from its lane, and shows it bound there', () => {
    const lane = () => screen.getByLabelText('Spark lane');
    const card = () => within(lane()).getByText('The empty jar').closest('.pm-lb-spark') as HTMLElement;
    const spark = tileOf('spark', 'The empty jar');
    fireEvent.click(within(card()).getByRole('button', { name: 'Bring as a question' }));
    expect(posted(MessageType.LIGHTBOX_HAND_OFF).at(-1)?.payload).toEqual({ kind: 'tile', boardId: BOARD.boardId, tileId: spark.id });
    expect(card().textContent).toContain('Bringing it to the Workshop…');
    // Every other spark waits while one is on its way.
    const late = within(lane()).getByText('Late for what?').closest('.pm-lb-spark') as HTMLElement;
    expect(within(late).getByRole('button', { name: 'Bring as a question' })).toHaveProperty('disabled', true);

    tray([{ boardId: BOARD.boardId, tileId: spark.id, label: 'Lightbox Open door: The empty jar' }]);
    fromHost(MessageType.LIGHTBOX_HAND_OFF_RESULT, { kind: 'tile', boardId: BOARD.boardId, tileId: spark.id, ok: true, message: 'Staged.' });
    const bound = within(card()).getByRole('button', { name: 'Bound for Workshop' });
    expect(bound.getAttribute('aria-pressed')).toBe('true');
    expect(within(late).getByRole('button', { name: 'Bring as a question' })).toHaveProperty('disabled', false);
  });

  it('offers no Bring for a stale reading, and says why', () => {
    const stale: LightboxBoard = {
      ...BOARD,
      readings: BOARD.readings.map((group) => (group.group === 'B' ? { ...group, staleLenses: [{ lens: 'subtext', since: 1 } as never] } : group))
    };
    fromHost(MessageType.LIGHTBOX_BOARD, { board: stale, refusal: null });
    pinRabbit();
    expect(within(inspector()).getByRole('button', { name: 'Bring to Workshop →' })).toHaveProperty('disabled', true);
    expect(inspector().textContent).toContain('Read against an earlier version of the chapter. Read the lens again before bringing it.');
  });
});

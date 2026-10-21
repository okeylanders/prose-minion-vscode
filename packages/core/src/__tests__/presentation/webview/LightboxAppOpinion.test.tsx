/** @jest-environment jsdom */

/**
 * The Opinion in the webview (Slice 4D; ADR 2026-10-19 D7 addendum, epic
 * decisions 15 and 16), through the real Lightbox root: the one evaluative
 * tile, drawn last and labelled so; three real view buttons, Neutral
 * pressed until the writer picks another, the pick remembered per board in
 * webview state only; the observations under the views, lighting their
 * cited paragraphs on hover; stale and withheld notes in the host's words;
 * its own re-read priced "up to" its digest bound; Bring of the view on
 * show, by name. Ignoring it changes nothing else on the board. The host is
 * played by window messages; readings come from the worked examples
 * through the production codec, digest and gates, over "Alice's Adventures
 * in Wonderland" (1865, public domain).
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { LightboxBoard, LightboxOpinionTile } from '@messages';
import { MessageType } from '@messages';
import { emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import { lightboxOpinionTile } from '@shared/constants/lightboxOpinion';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { itemKey, readOpinion, withOpinion } from '@/__tests__/infrastructure/lightbox/lightboxOpinionFixtures';
import {
  makeEstimate,
  makeReadBoard,
  opinionOn
} from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';

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

const litParagraphs = () =>
  Array.from(document.querySelectorAll('.pm-lb-col'))
    .flatMap((column, index) => (column.querySelector('.pm-lb-col-focus.is-lit') ? [index + 1] : []));

const opinionFrame = (): HTMLElement => {
  const frame = document.querySelector<HTMLElement>('section.pm-lb-opinion');
  if (!frame) {
    throw new Error('expected the Opinion on the board');
  }
  return frame;
};
const tab = (label: string) => within(opinionFrame()).getByRole('button', { name: new RegExp(`^${label}`) });
/** Every reading frame but the Opinion's, as drawn. */
const otherFrames = () => Array.from(document.querySelectorAll('section.pm-lb-tile:not(.pm-lb-opinion)')).map((frame) => frame.outerHTML);

const BOARD = makeReadBoard();
const OPINION = lightboxOpinionTile(BOARD) as LightboxOpinionTile;
const view = (id: string) => OPINION.views.find((candidate) => candidate.view === id);

/** BOARD with the Opinion read again from `edit`ed copy of its body. */
function boardWithOpinion(edit: (body: ReturnType<typeof opinionOn>) => void): LightboxBoard {
  const body = opinionOn(BOARD);
  edit(body);
  return withOpinion(BOARD, readOpinion(BOARD, body, OPINION.id));
}

describe('LightboxApp: the Opinion (Slice 4D)', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  it('draws the one evaluative tile last, after the Spark lane, with Neutral pressed and shown', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: BOARD, refusal: null });
    const frame = opinionFrame();
    expect(within(frame).getByText('The one evaluative tile')).not.toBeNull();
    expect(frame.getAttribute('data-register')).toBe('read');
    const lane = screen.getByLabelText('Spark lane');
    expect(lane.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(Array.from(document.querySelectorAll('section.pm-lb-tile')).at(-1)).toBe(frame);
    expect(within(frame).getByRole('group', { name: 'Choose a view' })).not.toBeNull();
    expect([tab('Enthusiastic'), tab('Neutral'), tab('Blunt')].map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    expect(frame.textContent).toContain(view('neutral')?.headline);
    expect(frame.textContent).not.toContain(view('blunt')?.headline);
    expect(within(frame).getByLabelText('Why').querySelectorAll('li')).toHaveLength(view('neutral')?.why.length ?? -1);
  });

  it('switches views on a press, remembering the choice for this board in webview state and telling the host nothing', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: BOARD, refusal: null });
    const before = vscode.postMessage.mock.calls.length;
    fireEvent.click(tab('Blunt'));
    expect([tab('Neutral'), tab('Blunt')].map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    expect(opinionFrame().textContent).toContain(view('blunt')?.headline);
    expect(opinionFrame().textContent).toContain(view('blunt')?.body);
    expect(vscode.postMessage.mock.calls.length).toBe(before);
    expect(vscode.setState).toHaveBeenLastCalledWith(expect.objectContaining({ lightboxOpinionViews: { [BOARD.boardId]: 'blunt' } }));
  });

  it('opens on the view remembered for this board, and on Neutral for another', () => {
    vscode.getState.mockReturnValue({ lightboxOpinionViews: { [BOARD.boardId]: 'enthusiastic' } });
    const first = render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: BOARD, refusal: null });
    expect(tab('Enthusiastic').getAttribute('aria-pressed')).toBe('true');
    first.unmount();
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: { ...BOARD, boardId: 'another-board' }, refusal: null });
    expect(tab('Neutral').getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the observations all three views share, with what each cites, and lights their paragraphs on hover', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: BOARD, refusal: null });
    const frame = opinionFrame();
    expect(frame.textContent).toContain('Observations all three views share');
    for (const observation of OPINION.observations) {
      expect(frame.textContent).toContain(observation.text);
      for (const cite of observation.cites) {
        expect(frame.textContent).toContain(cite.label);
      }
    }
    const aside = OPINION.observations[0];
    expect(frame.textContent).toContain('(Which was very likely true.)');
    const button = within(frame).getByText(aside.text).closest('button') as HTMLButtonElement;
    fireEvent.mouseEnter(button);
    expect(litParagraphs()).toEqual(aside.paragraphs);
    fireEvent.mouseLeave(button);
    expect(litParagraphs()).toEqual([]);
    // The views come before the observations they weigh.
    const why = within(frame).getByLabelText('Why');
    expect(why.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('says it is stale when an item it cites changed, naming the observation, and refuses to bring it', () => {
    const signature = itemKey(BOARD, 'Stock & signature · Signature: The narrator');
    const changed: LightboxBoard = {
      ...BOARD,
      readings: BOARD.readings.map((group) => ({
        ...group,
        tiles: group.tiles.map((tile) => (tile.id === signature ? { ...tile, claim: `${tile.claim} Read again.` } : tile))
      }))
    };
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: changed, refusal: null });
    const frame = opinionFrame();
    expect(frame.querySelector('.pm-lb-stale-note')?.textContent).toContain('Something it cites changed since it was read (O1)');
    expect(frame.textContent).toContain('O1 · changed since');
    expect(frame.textContent).not.toContain('O2 · changed since');
    const bring = within(frame).getByRole('button', { name: /Bring this view to Workshop/ }) as HTMLButtonElement;
    expect(bring.disabled).toBe(true);
    expect(bring.title).toContain('Re-read the Opinion');
  });

  it('marks a withheld view\'s tab, and shows the host\'s reason for it, never its words', () => {
    const board = boardWithOpinion((body) => { body.views.blunt.body = 'The chapter should give more of its speech.'; });
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board, refusal: null });
    expect(tab('Blunt').textContent).toContain('withheld');
    fireEvent.click(tab('Blunt'));
    const frame = opinionFrame();
    expect(frame.querySelector('.pm-lb-op-body')?.textContent).toMatch(/^Withheld The Blunt view /);
    expect(frame.textContent).not.toContain('should give more of its speech');
    expect((within(frame).getByRole('button', { name: /Bring this view to Workshop/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('brings the view on show by name, and nothing else', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: BOARD, refusal: null });
    fireEvent.click(tab('Blunt'));
    fireEvent.click(within(opinionFrame()).getByRole('button', { name: /Bring this view to Workshop/ }));
    expect(posted(MessageType.LIGHTBOX_HAND_OFF).map((message) => message.payload))
      .toEqual([{ kind: 'tile', boardId: BOARD.boardId, tileId: OPINION.id, view: 'blunt' }]);
  });

  it('prices its own re-read "up to" its digest bound, and re-reads the Opinion alone', () => {
    render(<LightboxApp />);
    fromHost(MessageType.MODEL_DATA, { options: [], selections: { assistant: 'provider/model-v1' } });
    fromHost(MessageType.LIGHTBOX_BOARD, { board: BOARD, refusal: null });
    const opinionCall = {
      group: 'F' as const, lenses: ['opinion' as const], inputTokens: 9_400, expectedOutputTokens: 1_400,
      reservedOutputTokens: 8_000, inputBound: 'digest' as const, fit: 'fits' as const, costUsd: 0.05
    };
    const request = posted(MessageType.LIGHTBOX_SET_LENSES).at(-1);
    fromHost(MessageType.LIGHTBOX_RUN_ESTIMATE, {
      requestId: request?.payload.requestId,
      estimate: makeEstimate({ boardId: BOARD.boardId, groups: [...makeEstimate().groups, opinionCall], rereads: [opinionCall] })
    });
    const frame = opinionFrame();
    expect(frame.querySelector('.pm-lb-op-actions')?.textContent).toContain('1 call · est. $0.05 · up to its digest bound');
    fireEvent.click(within(frame).getByRole('button', { name: 'Re-read the Opinion' }));
    expect(posted(MessageType.LIGHTBOX_RUN).at(-1)?.payload).toMatchObject({ boardId: BOARD.boardId, scope: { mode: 'lens', lens: 'opinion' } });
  });

  it('changes nothing else: every other frame is drawn exactly as on the board with no Opinion', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: BOARD, refusal: null });
    const withF = otherFrames();
    expect(withF.length).toBeGreaterThan(10);

    const unread: LightboxBoard = { ...BOARD, readings: BOARD.readings.map((group) => (group.group === 'F' ? emptyLightboxReadingGroup('F') : group)) };
    fromHost(MessageType.LIGHTBOX_BOARD, { board: unread, refusal: null });
    expect(otherFrames()).toEqual(withF);
  });

  it('draws nothing of the Opinion when its lens is off', () => {
    vscode.getState.mockReturnValue({ lightboxLensesOff: ['opinion'] });
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: BOARD, refusal: null });
    expect(document.querySelector('section.pm-lb-opinion')).toBeNull();
    expect(document.querySelectorAll('section.pm-lb-tile').length).toBeGreaterThan(10);
  });
});

/** @jest-environment jsdom */

/**
 * Lexical gravity and palette on the board (ADR 2026-10-19 D7, D11; Slice
 * 3): the orbit of positioned buttons, field rows with the claimed pull and
 * the host's counts, the collision and the literal set-aside, the palette's
 * clusters and swatches, the inspector's "By degree" rows, and "Build as a
 * lens", which posts the field's id and shows the host's answer. The host is
 * played by window messages; the readings are group A's worked example
 * through the production codec and verifier.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';
import { makeEstimate, readGroup } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';

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
    .flatMap((column, index) => (column.querySelector('.pm-lb-col-focus.is-lit') ? [index + 1] : []));

const board = makeBoard(8);
const readBoard = (options: { collision?: boolean; stale?: boolean } = {}) => {
  const groupA = readGroup('A', { collision: options.collision });
  return {
    ...board,
    readings: [
      options.stale ? { ...groupA, staleLenses: groupA.lenses.map((lens) => ({ lens, readAgainst: 'earlier' })) } : groupA,
      readGroup('B'),
      readGroup('C')
    ]
  };
};

describe('LightboxApp: lexical gravity and palette', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);
  /** The host's answer to the latest estimate request, echoing its id (PR #149 F-03). */
  const estimateFromHost = (estimate: object) =>
    fromHost(MessageType.LIGHTBOX_RUN_ESTIMATE, { requestId: posted(MessageType.LIGHTBOX_SET_LENSES).at(-1)?.payload.requestId, estimate });

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  it('draws the orbit, the fields with their claimed pull and counted hits, a collision and the literal set-aside', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: readBoard({ collision: true }), refusal: null });
    estimateFromHost(makeEstimate());

    const tile = screen.getByLabelText('Lexical gravity · borrowed fields the prose leans on');
    expect(within(tile).getByText('counted · read')).not.toBeNull();
    const orbit = within(tile).getByRole('group', { name: 'Borrowed fields by claimed pull' });
    const bodies = within(orbit).getAllByRole('button');
    expect(bodies.map((body) => body.getAttribute('aria-label'))).toEqual([
      'Ledger, claimed pull 0.24, 3 hits',
      'Fire, claimed pull 0.18, 2 hits, below the gravity line',
      // ¶3's White Rabbit and ¶4's three rabbits.
      'Animals, claimed pull 0.12, 4 hits'
    ]);
    // Positioned buttons, not one picture: each sits at its own place.
    expect(new Set(bodies.map((body) => `${body.style.left},${body.style.top}`)).size).toBe(3);

    expect(within(tile).getByText('pull 0.24 · claim')).not.toBeNull();
    expect(within(tile).getAllByText('3 terms · 3 hits')).toHaveLength(1);
    expect(within(tile).getByText('Enters at ¶2, last at ¶3; densest at ¶3 (2 of 3 hits).')).not.toBeNull();
    expect(within(tile).getByText(/^Below the gravity line: 2 hits, fewer than 3\./)).not.toBeNull();
    expect(within(tile).getByRole('img', { name: 'By degree: 2 latent, 1 felt, 0 overt' })).not.toBeNull();

    const collision = within(tile).getByRole('button', { name: /Collision · ¶4/ });
    expect(collision.textContent).toContain('Fire and Animals share this sentence.');
    expect(within(tile).getByRole('button', { name: /Set aside as literal: Falling\s?, 15 hits\. She really falls down a deep well/ }))
      .not.toBeNull();
    expect(within(tile).getByText(/Pin a field, then Build as a lens/)).not.toBeNull();

    // Hover or focus lights the field's paragraphs, like any board item.
    fireEvent.mouseEnter(bodies[1]);
    expect(litColumns()).toEqual([4]);
    fireEvent.mouseLeave(bodies[1]);
    fireEvent.focus(collision);
    expect(litColumns()).toEqual([4]);
  });

  it('shows the sentence the fields share, not a first quote that holds only one of them (PR #150 F-04)', () => {
    render(<LightboxApp />);
    const groupA = readGroup('A', {
      collision: true,
      mutate: (body) => {
        body.gravity.collisions[0].evidence = [
          { para: 4, quote: 'burning with curiosity' },
          { para: 4, quote: 'it flashed across her mind that she had never before seen a rabbit' }
        ];
      }
    });
    fromHost(MessageType.LIGHTBOX_BOARD, { board: { ...board, readings: [groupA, readGroup('B'), readGroup('C')] }, refusal: null });
    const tile = screen.getByLabelText('Lexical gravity · borrowed fields the prose leans on');
    const collision = within(tile).getByRole('button', { name: /Collision · ¶4/ });
    expect(collision.querySelector('q')?.textContent).toBe('it flashed across her mind that she had never before seen a rabbit');
    expect(collision.textContent).not.toContain('burning with curiosity');
  });

  it('draws the palette: clusters of counted words, and swatches whose color is the reading\'s', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: readBoard(), refusal: null });
    const palette = screen.getByLabelText('Palette');
    expect(within(palette).getByText('counted · read')).not.toBeNull();
    const cluster = within(palette).getByRole('button', { name: /The way down/ });
    expect(cluster.textContent).toContain('down×9');
    expect(within(palette).getByText('Colors the text names')).not.toBeNull();
    const swatch = within(palette).getByRole('button', { name: /White Rabbit/ });
    expect(swatch.getAttribute('title')).toBe("#F2EEE6 is the reading's choice; the words are counted.");
    expect(swatch.textContent).toContain('white ×1');
    expect(within(palette).getByText(/A swatch's color is the reading's choice\./)).not.toBeNull();
  });

  it('pins a field with its terms by degree, and builds it as a lens through the host', () => {
    render(<LightboxApp />);
    const shown = readBoard();
    fromHost(MessageType.LIGHTBOX_BOARD, { board: shown, refusal: null });
    estimateFromHost(makeEstimate());
    const tile = screen.getByLabelText('Lexical gravity · borrowed fields the prose leans on');
    // Pinned from the orbit: each field there is a keyboard stop of its own.
    fireEvent.click(within(tile).getByRole('button', { name: 'Ledger, claimed pull 0.24, 3 hits' }));

    const inspector = screen.getByLabelText('Inspector');
    expect(within(inspector).getByText('Lexical gravity · Borrowed field')).not.toBeNull();
    expect(within(inspector).getByText('By degree')).not.toBeNull();
    expect(within(inspector).getByText('1° latent')).not.toBeNull();
    expect(within(inspector).getByText('use ×1, pleasure ×1 · 2 hits')).not.toBeNull();
    expect(within(inspector).getByText('worth the trouble ×1 · 1 hit')).not.toBeNull();
    expect(within(inspector).getByText('0.24 · a claim, not a measurement')).not.toBeNull();

    const build = within(inspector).getByRole('button', { name: /Build as a lens in Lexical Gravity/ }) as HTMLButtonElement;
    expect(build.disabled).toBe(false);
    expect(within(inspector).getByText(/Nothing is built until you press Build there\./)).not.toBeNull();
    fireEvent.click(build);
    const fieldId = shown.readings[0].tiles.find((candidate) => candidate.title === 'Ledger')?.id;
    expect(posted(MessageType.LIGHTBOX_HAND_OFF)).toEqual([expect.objectContaining({
      source: 'webview.lightbox',
      payload: { kind: 'lexical-gravity-seed', boardId: board.boardId, fieldId }
    })]);
    expect(build.disabled).toBe(true);
    // An answer for another request changes nothing: it is not this field's.
    fromHost(MessageType.LIGHTBOX_HAND_OFF_RESULT, {
      kind: 'lexical-gravity-seed', boardId: board.boardId, fieldId: 'lbt-another', ok: false, message: 'Not this one.'
    });
    expect(build.disabled).toBe(true);
    expect(within(inspector).queryByText('Not this one.')).toBeNull();

    fromHost(MessageType.LIGHTBOX_HAND_OFF_RESULT, {
      kind: 'lexical-gravity-seed', boardId: board.boardId, fieldId, ok: true,
      message: 'Opened “Ledger” in Build lens in the Workshop’s Lexical Gravity. Nothing is built until you press Build there.'
    });
    expect(within(inspector).getByRole('status').textContent).toContain('Opened “Ledger” in Build lens');
    expect(build.disabled).toBe(false);
  });

  it('disables Build as a lens for a stale field, with its reason', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: readBoard({ stale: true }), refusal: null });
    const tile = screen.getByLabelText('Lexical gravity · borrowed fields the prose leans on');
    expect(within(tile).getByText('Stale')).not.toBeNull();
    fireEvent.click(tile.querySelector('.pm-lb-field') as HTMLElement);
    const inspector = screen.getByLabelText('Inspector');
    const build = within(inspector).getByRole('button', { name: /Build as a lens/ }) as HTMLButtonElement;
    expect(build.disabled).toBe(true);
    expect(within(inspector).getByText(/Read the lens again before building it\./)).not.toBeNull();
  });

  it('offers both lenses in the rail, in call A, and hides a lens that is turned off', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: readBoard(), refusal: null });
    const lenses = screen.getByLabelText('Lenses');
    const gravity = within(lenses).getByRole('checkbox', { name: /Lexical gravity/ });
    expect(gravity.closest('label')?.textContent).toContain('call A');
    expect(within(lenses).getByRole('checkbox', { name: /Palette/ }).closest('label')?.textContent).toContain('call A');
    fireEvent.click(gravity);
    expect(posted(MessageType.LIGHTBOX_SET_LENSES).at(-1)).toMatchObject({ payload: { lensesOff: ['gravity'] } });
    expect(screen.queryByLabelText('Lexical gravity · borrowed fields the prose leans on')).toBeNull();
    expect(screen.getByLabelText('Palette')).not.toBeNull();
  });
});

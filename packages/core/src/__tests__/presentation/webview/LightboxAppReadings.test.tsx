/** @jest-environment jsdom */

/**
 * The Lightbox's readings end to end in the webview (ADR 2026-10-19 D6–D9,
 * Slice 2B): the press states its cost, runs, shows groups arriving, Stop,
 * the readings with their evidence in the inspector, a tile's re-read, the
 * context list and a refusal when a call is too large. The host is played by
 * window messages; readings come from the worked examples through the
 * production codec and verifier.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MessageType } from '@messages';
import { emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';
import { makeEstimate, makeReadBoard, readGroup } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';

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

/** The host's model confirmation, which the real chrome asks for on mount (PR #149 F-03 re-review). */
const confirmModel = (assistant = 'provider/model-v1') =>
  fromHost(MessageType.MODEL_DATA, { options: [], selections: { assistant } });

const board = makeBoard(8);
const running = {
  ...board,
  readings: (['A', 'B', 'C'] as const).map((group) => ({
    ...emptyLightboxReadingGroup(group),
    status: 'running' as const,
    pending: readGroup(group).lenses
  }))
};

describe('LightboxApp readings', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const lastPosted = () => vscode.postMessage.mock.calls.at(-1)?.[0];
  /** The host's answer to the latest estimate request, as the host echoes its id (PR #149 F-03). */
  const estimateFromHost = (estimate: object | null, extra: object = {}) => {
    const request = vscode.postMessage.mock.calls.map(([message]) => message)
      .filter((message) => message.type === MessageType.LIGHTBOX_SET_LENSES).at(-1);
    fromHost(MessageType.LIGHTBOX_RUN_ESTIMATE, { requestId: request?.payload.requestId, estimate, ...extra });
  };

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  it('states the cost, reads the chapter, shows groups arriving, and offers Stop', () => {
    render(<LightboxApp />);
    confirmModel();
    fromHost(MessageType.LIGHTBOX_BOARD, { board, refusal: null });
    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.LIGHTBOX_SET_LENSES,
      payload: { lensesOff: [], requestId: expect.any(String) }
    }));
    estimateFromHost(makeEstimate());

    const lenses = screen.getByLabelText('Lenses');
    expect(within(lenses).getByText('3 calls · est. $0.04')).not.toBeNull();
    const read = screen.getByRole('button', { name: /Read the chapter/ }) as HTMLButtonElement;
    expect(read.disabled).toBe(false);
    fireEvent.click(read);
    // The press names the estimate it was shown (PR #149 F-02).
    expect(lastPosted()).toMatchObject({
      type: MessageType.LIGHTBOX_RUN,
      payload: { boardId: 'board-8', scope: { mode: 'all' }, estimateKey: 'estimate-board-8' }
    });
    expect(screen.getByText('Starting…')).not.toBeNull();

    fromHost(MessageType.LIGHTBOX_BOARD, { board: running, refusal: null });
    fromHost(MessageType.LIGHTBOX_RUN_PROGRESS, {
      boardId: 'board-8', token: 'run-1', phase: 'started', groups: ['A', 'B', 'C'], groupsBack: 0, outputCharacters: 0
    });
    expect(screen.getByText('Reading… 0 of 3 lens groups back')).not.toBeNull();
    expect(within(screen.getByLabelText('Motifs · where they recur')).getByText('Reading…')).not.toBeNull();

    fromHost(MessageType.LIGHTBOX_GROUP_RESULT, { boardId: 'board-8', token: 'run-1', group: readGroup('A') });
    expect(screen.getByText('Reading… 1 of 3 lens groups back')).not.toBeNull();
    expect(screen.getByText('Going down')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(lastPosted()).toMatchObject({ type: MessageType.LIGHTBOX_CANCEL_RUN, payload: { boardId: 'board-8', token: 'run-1' } });
  });

  it('draws the readings, the tension lane and the tally, and pins a motif with its evidence', () => {
    render(<LightboxApp />);
    confirmModel();
    fromHost(MessageType.LIGHTBOX_BOARD, { board, refusal: null });
    estimateFromHost(makeEstimate());
    for (const group of ['A', 'B', 'C'] as const) {
      fromHost(MessageType.LIGHTBOX_GROUP_RESULT, { boardId: 'board-8', token: 'run-1', group: readGroup(group, { paraphraseOne: true }) });
    }

    expect(screen.getByRole('heading', { name: /A bored girl follows a hurried white rabbit/ })).not.toBeNull();
    expect(screen.getByText('a reading')).not.toBeNull();
    expect(document.querySelectorAll('.pm-lb-col-tension i')).toHaveLength(8);
    expect(screen.getByText(/^Tension, as read:/)).not.toBeNull();
    const genre = screen.getByLabelText('Genre neighborhood');
    expect(within(genre).getByText('Affinity is a claim, not a score. Resemblance, never quality.')).not.toBeNull();
    expect(within(genre).getByText('0.12')).not.toBeNull();
    expect(within(genre).getByText('Reader promise so far')).not.toBeNull();
    expect(screen.getByText(/\d+ quotes checked · 1 withheld · 3 calls/)).not.toBeNull();
    expect(screen.getByRole('button', { name: /^Re-read\s*3 calls/ })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Going down/ }));
    const inspector = screen.getByLabelText('Inspector');
    expect(within(inspector).getByText('Evidence · checked against the text')).not.toBeNull();
    expect(within(inspector).getAllByText('found verbatim')).toHaveLength(2);
    expect(within(inspector).getByText('Withheld · ¶6')).not.toBeNull();
    expect(within(inspector).getByText('Where this reading strains')).not.toBeNull();
    expect(within(inspector).getByText('1 call · est. $0.01')).not.toBeNull();

    fireEvent.click(within(inspector).getByRole('button', { name: 'Re-read this tile' }));
    expect(lastPosted()).toMatchObject({ type: MessageType.LIGHTBOX_RUN, payload: { scope: { mode: 'lens', lens: 'motif' } } });
  });

  it('labels stale readings after the chapter changed, with the re-checked quote withheld (D4)', () => {
    render(<LightboxApp />);
    confirmModel();
    const groupA = readGroup('A');
    const goingDown = groupA.tiles.find((tile) => tile.title === 'Going down');
    const stale = {
      ...board,
      readings: [
        {
          ...groupA,
          staleLenses: groupA.lenses.map((lens) => ({ lens, readAgainst: 'earlier-hash' })),
          tiles: groupA.tiles.map((tile) => (tile === goingDown
            ? {
                ...tile,
                evidence: tile.evidence.filter((quote) => quote.paragraph !== 6),
                withheldQuotes: [{ paragraph: 6, reason: 'no-longer-in-chapter' as const }]
              }
            : tile))
        },
        readGroup('B'),
        readGroup('C')
      ]
    };
    fromHost(MessageType.LIGHTBOX_BOARD, { board: stale, refusal: null });
    estimateFromHost(makeEstimate());

    const motifs = screen.getByLabelText('Motifs · where they recur');
    expect(within(motifs).getByText('Stale')).not.toBeNull();
    expect(within(screen.getByLabelText('Voice')).queryByText('Stale')).toBeNull();
    expect(screen.getByText(/lenses stale$/)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Going down/ }));
    const inspector = screen.getByLabelText('Inspector');
    expect(within(inspector).getByText('Stale')).not.toBeNull();
    expect(within(inspector).getByText(/No longer in the chapter: the text changed/)).not.toBeNull();
  });

  it('asks for a fresh estimate when the host refuses a press priced on inputs that changed (PR #149 F-02)', () => {
    render(<LightboxApp />);
    confirmModel();
    fromHost(MessageType.LIGHTBOX_BOARD, { board, refusal: null });
    estimateFromHost(makeEstimate());
    fireEvent.click(screen.getByRole('button', { name: /Read the chapter/ }));
    const asked = vscode.postMessage.mock.calls.filter(([message]) => message.type === MessageType.LIGHTBOX_SET_LENSES).length;
    fromHost(MessageType.LIGHTBOX_RUN_PROGRESS, {
      boardId: 'board-8', phase: 'refused', groups: [], groupsBack: 0, outputCharacters: 0, reestimate: true,
      message: 'The estimate changed since it was shown (the model, its prices, the lenses or the context). Check the new estimate, then press again.'
    });
    expect(screen.getByText(/The estimate changed since it was shown/)).not.toBeNull();
    expect(vscode.postMessage.mock.calls.filter(([message]) => message.type === MessageType.LIGHTBOX_SET_LENSES).length).toBe(asked + 1);
  });

  it('disables a tile\'s re-read, with the reason, when its lens is off or its call is too large (PR #149 F-08)', () => {
    render(<LightboxApp />);
    confirmModel();
    fromHost(MessageType.LIGHTBOX_BOARD, { board: makeReadBoard(), refusal: null });
    estimateFromHost(makeEstimate());
    fireEvent.click(screen.getByRole('button', { name: /Going down/ }));
    const inspector = screen.getByLabelText('Inspector');
    const reread = () => within(inspector).getByRole('button', { name: 'Re-read this tile' }) as HTMLButtonElement;
    expect(reread().disabled).toBe(false);

    fireEvent.click(within(screen.getByLabelText('Lenses')).getByRole('checkbox', { name: /Theme & motif/ }));
    expect(reread().disabled).toBe(true);
    expect(within(inspector).getByText('The Theme & motif lens is off. Turn it on in the rail to re-read this tile.')).not.toBeNull();

    fireEvent.click(within(screen.getByLabelText('Lenses')).getByRole('checkbox', { name: /Theme & motif/ }));
    const tight = makeEstimate();
    tight.rereads = [{ ...tight.rereads[0], fit: 'too-large', inputTokens: 40_000 }];
    estimateFromHost(tight);
    expect(reread().disabled).toBe(true);
    expect(within(inspector).getByText(/^Re-reading this tile would send about 40,000 tokens/)).not.toBeNull();
  });

  it('disables the press with the reason when a call is too large', () => {
    render(<LightboxApp />);
    confirmModel();
    fromHost(MessageType.LIGHTBOX_BOARD, { board, refusal: null });
    const estimate = makeEstimate({ fit: 'too-large', reason: 'Group A would send about 90,000 tokens and reserve 8,000 for the reply.' });
    estimate.groups[0].fit = 'too-large';
    estimateFromHost(estimate);
    const read = screen.getByRole('button', { name: /Read the chapter/ }) as HTMLButtonElement;
    expect(read.disabled).toBe(true);
    expect(read.getAttribute('aria-describedby')).toBe('pm-lb-run-reason');
    expect(document.getElementById('pm-lb-run-reason')?.textContent).toContain('90,000 tokens');
  });

  it('lists context files, removes one, and sends lens toggles to the host', () => {
    render(<LightboxApp />);
    confirmModel();
    fromHost(MessageType.LIGHTBOX_BOARD, { board, refusal: null });
    fromHost(MessageType.LIGHTBOX_CONTEXT_FILES, {
      files: [{ id: 'ctx-1', displayPath: 'Notes/cast.md', wordCount: 15, fileKey: 'key-cast' }],
      totalWords: 15,
      ceilingWords: 50_000
    });
    const context = screen.getByLabelText('Context');
    expect(within(context).getByText('Notes/cast.md')).not.toBeNull();
    expect(within(context).getByText(/only the chapter can be quoted/)).not.toBeNull();
    fireEvent.click(within(context).getByRole('button', { name: 'Remove Notes/cast.md' }));
    expect(lastPosted()).toMatchObject({ type: MessageType.LIGHTBOX_REMOVE_CONTEXT_FILE, payload: { id: 'ctx-1' } });
    // "Add from project…" opens the shared picker; its escape hatch is the system picker, as "Add file" was.
    fireEvent.click(within(context).getByRole('button', { name: 'Add from project…' }));
    expect(lastPosted()).toMatchObject({ type: MessageType.LIGHTBOX_REQUEST_PROJECT_CATALOG });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Explore project folders/ }));
    expect(lastPosted()).toMatchObject({ type: MessageType.LIGHTBOX_ADD_CONTEXT_FILES });

    fireEvent.click(within(screen.getByLabelText('Lenses')).getByRole('checkbox', { name: /Genre neighborhood/ }));
    expect(lastPosted()).toMatchObject({ type: MessageType.LIGHTBOX_SET_LENSES, payload: { lensesOff: ['genre'] } });
    expect(screen.queryByLabelText('Genre neighborhood')).toBeNull();
  });
});

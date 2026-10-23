/** @jest-environment jsdom */

/**
 * The run controls in the webview (Slice 4I, epic decisions 41–45):
 * - the run line's three presses, "Run AI analyses", "Finish" and
 *   "Re-analyze", each in the primary style with the sparkle;
 * - every AI-read widget's Analyze in its header, in place of the bare
 *   "read" badge (a counted-read widget keeps "counted" beside it, a
 *   measured one has none): Analyze, Re-analyze, Analyzing…, and disabled
 *   with its reason while another run is going;
 * - the Opinion's Analyze, disabled with the Opinion's own reason, shown,
 *   while nothing on the board is read and current;
 * - each call's Run in the Lenses panel, Run A / Rerun A;
 * - accessible names that name the call, its lenses and its price, and
 *   controls that stay focusable while they cannot run.
 * The host is played by window messages; readings are the worked examples'
 * through the production codec and verifier (Alice, public domain).
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { LightboxBoard, LightboxReadingGroupId, LightboxRunEstimate, MessageType } from '@messages';
import { emptyLightboxReadingGroup, LIGHTBOX_READING_GROUPS, lightboxGroupLenses } from '@shared/constants/lightbox';
import { LIGHTBOX_OPINION_NOTHING_TO_WEIGH } from '@shared/constants/lightboxOpinion';
import { ICON_PATHS } from '@shared/constants/iconPaths';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';
import { makeReadBoard, readGroup } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';

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
jest.mock('../../../presentation/webview/styles/lightbox/boards.css', () => ({}));
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

// eslint-disable-next-line @typescript-eslint/naming-convention -- keys are the calls' group letters, protocol literals.
const COSTS: Readonly<Record<LightboxReadingGroupId, number>> = { A: 0.07, B: 0.0412, C: 0.03, D: 0.05, E: 0.06, G: 0.04, F: 0.05 };

/** The host's estimate for `makeBoard(8)` with every lens on: one call per group, the Opinion "up to" its digest bound. */
function estimate(lensesOff: readonly string[] = []): LightboxRunEstimate {
  const groups = LIGHTBOX_READING_GROUPS
    .map((group) => ({ group, lenses: lightboxGroupLenses(group).filter((lens) => !lensesOff.includes(lens)) }))
    .filter((call) => call.lenses.length > 0)
    .map(({ group, lenses }) => ({
      group, lenses, inputTokens: 3_000, expectedOutputTokens: 900, reservedOutputTokens: 12_000, fit: 'fits' as const,
      costUsd: COSTS[group], ...(group === 'F' ? { inputBound: 'digest' as const } : {})
    }));
  return {
    boardId: 'board-8', key: 'estimate-board-8', model: 'provider/model-v1', contextLength: 200_000,
    groups, rereads: [], fit: 'fits', costUsd: groups.reduce((sum, call) => sum + call.costUsd, 0),
    bookSized: false, sourceWords: 260, contextWords: 0
  };
}

const withGroups = (board: LightboxBoard, ...groups: LightboxBoard['readings']): LightboxBoard => ({
  ...board,
  readings: board.readings.map((entry) => groups.find((group) => group.group === entry.group) ?? entry)
});

const tile = (label: string) => screen.getByLabelText(label);
const head = (element: HTMLElement) => element.querySelector('.pm-lb-tile-head') as HTMLElement;
const runPress = () => document.querySelector('.pm-lb-run-press') as HTMLButtonElement;
const descriptionOf = (button: HTMLElement) => document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent;
/** The sparkle's markup as the DOM serializes it. */
const sparkle = (() => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.innerHTML = ICON_PATHS.sparkle;
  return svg.innerHTML;
})();

describe('LightboxApp: run controls (Slice 4I)', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);
  const estimateFromHost = (value: LightboxRunEstimate | null) => {
    const request = posted(MessageType.LIGHTBOX_SET_LENSES).at(-1);
    fromHost(MessageType.LIGHTBOX_RUN_ESTIMATE, { requestId: request?.payload.requestId, estimate: value });
  };
  /** The board on screen with the host's estimate, the model confirmed. */
  const show = (board: LightboxBoard, value: LightboxRunEstimate | null = estimate()) => {
    render(<LightboxApp />);
    fromHost(MessageType.MODEL_DATA, { options: [], selections: { assistant: 'provider/model-v1' } });
    fromHost(MessageType.LIGHTBOX_BOARD, { board, refusal: null });
    estimateFromHost(value);
  };

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  describe('the run line', () => {
    it('says Run AI analyses before any run, waiting and then pressable, in the primary style with the sparkle', () => {
      render(<LightboxApp />);
      fromHost(MessageType.MODEL_DATA, { options: [], selections: { assistant: 'provider/model-v1' } });
      fromHost(MessageType.LIGHTBOX_BOARD, { board: makeBoard(8), refusal: null });
      expect(runPress().textContent).toBe('Run AI analyses');
      expect(runPress().disabled).toBe(true);
      expect(runPress().className).toContain('pm-lb-primary');

      estimateFromHost(estimate());
      expect(runPress().disabled).toBe(false);
      expect(runPress().querySelector('svg')?.innerHTML).toBe(sparkle);
      // The cost stays stated beside it, as before (and in the Lenses panel).
      expect(document.querySelector('.pm-lb-run-note')?.textContent).toBe('7 calls · est. $0.34 · the Opinion up to its digest bound');
      fireEvent.click(runPress());
      expect(posted(MessageType.LIGHTBOX_RUN).at(-1)?.payload).toMatchObject({ scope: { mode: 'all' }, estimateKey: 'estimate-board-8' });
    });

    it('says Finish once a call ran on its own, priced for the calls not back yet, still orange', () => {
      show(withGroups(makeBoard(8), readGroup('B')));
      expect(runPress().className).toContain('pm-lb-primary');
      expect(runPress().textContent).toBe('Finish6 calls · est. $0.30 · the Opinion up to its digest bound');
      expect(runPress().querySelector('svg')?.innerHTML).toBe(sparkle);
      fireEvent.click(runPress());
      expect(posted(MessageType.LIGHTBOX_RUN).at(-1)?.payload).toMatchObject({ scope: { mode: 'rest' } });
    });

    it('says Re-analyze once every call landed, still orange', () => {
      show(makeReadBoard());
      expect(runPress().textContent).toMatch(/^Re-analyze7 calls · est\. \$0\.34/);
      expect(runPress().className).toContain('pm-lb-primary');
      expect(runPress().querySelector('svg')?.innerHTML).toBe(sparkle);
    });

    it('says Analyzing… while a call runs, counting calls back', () => {
      show(withGroups(makeBoard(8), { ...emptyLightboxReadingGroup('B'), status: 'running', pending: ['characters', 'voice', 'subtext'] }));
      fromHost(MessageType.LIGHTBOX_RUN_PROGRESS, { boardId: 'board-8', token: 'run-1', phase: 'started', groups: ['B'], groupsBack: 0, outputCharacters: 0 });
      expect(screen.getByText('Analyzing… 0 of 1 call back')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Stop' })).not.toBeNull();
    });
  });

  describe('a widget\'s Analyze', () => {
    it('stands in for the read badge, names its call, its lenses and its price, and runs its call', () => {
      show(makeBoard(8));
      const motifs = tile('Motifs · where they recur');
      const analyze = within(head(motifs)).getByRole('button', {
        name: 'Analyze call A: Headline, Theme & motif, Tension arc, Lexical gravity, Palette · ≈ $0.07'
      });
      expect(analyze.textContent).toBe('Analyze≈ $0.07');
      expect(within(head(motifs)).queryByText('read')).toBeNull();
      expect(motifs.querySelector('.pm-lb-skeleton-note')?.textContent).toBe('Not analyzed yet.');
      fireEvent.click(analyze);
      expect(posted(MessageType.LIGHTBOX_RUN).at(-1)?.payload).toMatchObject({
        boardId: 'board-8', scope: { mode: 'group', group: 'A', lens: 'motif' }, estimateKey: 'estimate-board-8', model: 'provider/model-v1'
      });
    });

    it('keeps a "counted" chip beside Analyze on a counted-read widget; a measured tile has no control', () => {
      show(makeBoard(8));
      const voice = head(tile('Voice'));
      expect(within(voice).getByText('counted')).not.toBeNull();
      expect(within(voice).queryByText('counted · read')).toBeNull();
      expect(within(voice).getByRole('button', { name: /^Analyze call B: Characters, Voice, Subtext · ≈ \$0\.04$/ })).not.toBeNull();
      const words = head(tile('Top words · sized by count'));
      expect(within(words).getByText('measured')).not.toBeNull();
      expect(within(words).queryByRole('button')).toBeNull();
    });

    it('says Re-analyze once its lens has a reading', () => {
      show(withGroups(makeBoard(8), readGroup('B')));
      expect(within(head(tile('Characters · the vibes they give'))).getByRole('button', { name: /^Re-analyze call B:/ })).not.toBeNull();
      expect(within(head(tile('Motifs · where they recur'))).getByRole('button', { name: /^Analyze call A:/ })).not.toBeNull();
    });

    it('says Analyzing… while its call is in flight; every other control waits, focusable, with the reason', () => {
      show(withGroups(makeBoard(8), { ...emptyLightboxReadingGroup('B'), status: 'running', pending: ['characters', 'voice', 'subtext'] }));
      fromHost(MessageType.LIGHTBOX_RUN_PROGRESS, { boardId: 'board-8', token: 'run-1', phase: 'started', groups: ['B'], groupsBack: 0, outputCharacters: 0 });
      const voice = tile('Voice');
      const live = within(head(voice)).getByRole('button', { name: /^Analyzing call B:/ });
      expect(live.textContent).toBe('Analyzing…');
      expect(live.getAttribute('aria-disabled')).toBe('true');
      expect(voice.querySelector('.pm-lb-skeleton-note')?.textContent).toBe('Analyzing…');

      const motifs = within(head(tile('Motifs · where they recur'))).getByRole('button', { name: /^Analyze call A:/ }) as HTMLButtonElement;
      expect(motifs.getAttribute('aria-disabled')).toBe('true');
      expect(motifs.disabled).toBe(false);
      expect(descriptionOf(motifs)).toBe('An analysis is running. Stop it, or wait for it to finish.');
      motifs.focus();
      expect(document.activeElement).toBe(motifs);
      const runs = posted(MessageType.LIGHTBOX_RUN).length;
      fireEvent.click(motifs);
      fireEvent.click(live);
      expect(posted(MessageType.LIGHTBOX_RUN)).toHaveLength(runs);
    });

    it('waits for the estimate, with the reason, and offers nothing to press', () => {
      render(<LightboxApp />);
      fromHost(MessageType.MODEL_DATA, { options: [], selections: { assistant: 'provider/model-v1' } });
      fromHost(MessageType.LIGHTBOX_BOARD, { board: makeBoard(8), refusal: null });
      const analyze = within(head(tile('Motifs · where they recur'))).getByRole('button', { name: /^Analyze call A:/ });
      expect(analyze.getAttribute('aria-disabled')).toBe('true');
      expect(descriptionOf(analyze)).toBe('Its cost is being estimated.');
    });

    it('draws Analyze for the spark lane, the tension line and a read headline', () => {
      show(makeReadBoard());
      expect(within(document.querySelector('.pm-lb-spark-head') as HTMLElement).getByRole('button', { name: /^Re-analyze call C: Genre neighborhood, Lineage, Spark/ })).not.toBeNull();
      const tension = document.querySelector('.pm-lb-tension-row') as HTMLElement;
      expect(within(tension).getByRole('button', { name: /^Re-analyze call A:/ })).not.toBeNull();
      // The line no longer carries a "read" badge: the button marks it as an AI reading.
      expect(tension.querySelector('.pm-lb-badge.pm-lb-reg-read')).toBeNull();
      const headline = document.querySelector('.pm-lb-headline-row') as HTMLElement;
      expect(within(headline).getByText('a reading')).not.toBeNull();
      expect(within(headline).getByRole('button', { name: /^Re-analyze call A:/ })).not.toBeNull();
    });
  });

  describe('the Opinion\'s Analyze', () => {
    it('says why it cannot run while nothing on the board is read and current, and sends nothing', () => {
      show(makeBoard(8));
      const opinion = head(document.querySelector('section.pm-lb-opinion') as HTMLElement);
      const analyze = within(opinion).getByRole('button', { name: 'Analyze call F: Opinion · up to $0.05' });
      expect(analyze.getAttribute('aria-disabled')).toBe('true');
      expect(descriptionOf(analyze)).toBe(LIGHTBOX_OPINION_NOTHING_TO_WEIGH);
      // Shown, not only described: it is the Opinion's own reason.
      expect(within(opinion).getByText(LIGHTBOX_OPINION_NOTHING_TO_WEIGH).className).toBe('pm-lb-call-reason');
      fireEvent.click(analyze);
      expect(posted(MessageType.LIGHTBOX_RUN)).toEqual([]);
    });

    it('runs group F alone once one call has landed', () => {
      show(withGroups(makeBoard(8), readGroup('B')));
      const opinion = head(document.querySelector('section.pm-lb-opinion') as HTMLElement);
      const analyze = within(opinion).getByRole('button', { name: 'Analyze call F: Opinion · up to $0.05' });
      expect(analyze.getAttribute('aria-disabled')).toBeNull();
      expect(within(opinion).queryByText(LIGHTBOX_OPINION_NOTHING_TO_WEIGH)).toBeNull();
      fireEvent.click(analyze);
      expect(posted(MessageType.LIGHTBOX_RUN).at(-1)?.payload).toMatchObject({ scope: { mode: 'group', group: 'F', lens: 'opinion' } });
    });
  });

  describe('a call\'s Run in the Lenses panel', () => {
    it('heads each call\'s lenses with its Run, priced: Run before it holds a reading, Rerun after', () => {
      show(withGroups(makeBoard(8), readGroup('A')));
      const lenses = screen.getByLabelText('Lenses');
      const calls = within(lenses).getAllByRole('group').map((group) => group.getAttribute('aria-label'));
      expect(calls).toEqual(['Call A', 'Call B', 'Call C', 'Call D', 'Call E', 'Call G', 'Call F']);
      const a = within(within(lenses).getByRole('group', { name: 'Call A' })).getByRole('button', {
        name: 'Rerun call A: Headline, Theme & motif, Tension arc, Lexical gravity, Palette · ≈ $0.07'
      });
      expect(a.textContent).toBe('Rerun A≈ $0.07');
      const b = within(within(lenses).getByRole('group', { name: 'Call B' })).getByRole('button', {
        name: 'Run call B: Characters, Voice, Subtext · ≈ $0.04'
      });
      expect(b.textContent).toBe('Run B≈ $0.04');
      expect(within(within(lenses).getByRole('group', { name: 'Call B' })).getAllByRole('checkbox')).toHaveLength(3);
      fireEvent.click(a);
      expect(posted(MessageType.LIGHTBOX_RUN).at(-1)?.payload).toMatchObject({ scope: { mode: 'group', group: 'A' } });
      // One run at a time: once a press is sent, every other control waits for it, with the reason.
      const waiting = within(within(lenses).getByRole('group', { name: 'Call B' })).getByRole('button', { name: /^Run call B:/ });
      expect(waiting.getAttribute('aria-disabled')).toBe('true');
      expect(descriptionOf(waiting)).toBe('An analysis is running. Stop it, or wait for it to finish.');
      fireEvent.click(waiting);
      expect(posted(MessageType.LIGHTBOX_RUN)).toHaveLength(1);
    });

    it('runs call B from its header', () => {
      show(makeBoard(8));
      fireEvent.click(within(screen.getByLabelText('Lenses')).getByRole('button', { name: 'Run call B: Characters, Voice, Subtext · ≈ $0.04' }));
      expect(posted(MessageType.LIGHTBOX_RUN).at(-1)?.payload).toMatchObject({ scope: { mode: 'group', group: 'B' } });
    });

    it('reads only the lenses that are on, and says so when none is', () => {
      vscode.getState.mockReturnValue({ lightboxLensesOff: ['subtext', 'steering'] });
      show(makeBoard(8), estimate(['subtext', 'steering']));
      const lenses = screen.getByLabelText('Lenses');
      expect(within(lenses).getByRole('button', { name: 'Run call B: Characters, Voice · ≈ $0.04' })).not.toBeNull();
      const g = within(within(lenses).getByRole('group', { name: 'Call G' })).getByRole('button', { name: 'Run call G' });
      expect(g.getAttribute('aria-disabled')).toBe('true');
      expect(within(lenses).getByText('Every lens of call G is off. Turn one on to run it.')).not.toBeNull();
    });
  });
});

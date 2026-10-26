/** @jest-environment jsdom */

/**
 * "Re-analyze all" beside "Finish" (Slice 4M, epic decision 53). The writer:
 * "If you read chapter 8 and one call failed, the button indicates finish
 * last calls. But if you want to just reload the file and re-run all you
 * can't do that."
 *
 * Once a call has landed and another has not, the run line offers both:
 * Finish, the primary (orange, sparkle), runs the calls not back
 * (`{ mode: 'rest' }`); Re-analyze all, a secondary button right beside it,
 * runs every call again (`{ mode: 'all' }`). Each carries its own cost and
 * its own reason, and each accessible name starts with its visible label.
 * The other states keep their one press. The host is played by window
 * messages; readings are the worked examples' (Alice, public domain).
 */

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LightboxBoard, LightboxReadingGroupId, LightboxRunEstimate, MessageType } from '@messages';
import { emptyLightboxReadingGroup, LIGHTBOX_READING_GROUPS, lightboxGroupLenses } from '@shared/constants/lightbox';
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

/** The host's estimate for `makeBoard(8)` with every lens on; `tooLarge` calls do not fit, with the host's reason. */
function estimate(tooLarge: readonly LightboxReadingGroupId[] = []): LightboxRunEstimate {
  const groups = LIGHTBOX_READING_GROUPS.map((group) => ({
    group, lenses: lightboxGroupLenses(group), inputTokens: tooLarge.includes(group) ? 240_000 : 3_000, expectedOutputTokens: 900,
    reservedOutputTokens: 12_000, fit: tooLarge.includes(group) ? 'too-large' as const : 'fits' as const,
    costUsd: COSTS[group], ...(group === 'F' ? { inputBound: 'digest' as const } : {})
  }));
  return {
    boardId: 'board-8', key: 'estimate-board-8', model: 'provider/model-v1', contextLength: 200_000,
    groups, rereads: [], fit: tooLarge.length > 0 ? 'too-large' : 'fits', costUsd: groups.reduce((sum, call) => sum + call.costUsd, 0),
    bookSized: false, sourceWords: 260, contextWords: 0,
    ...(tooLarge.length > 0 ? { reason: `Group ${tooLarge[0]} would send about 240,000 tokens and reserve 12,000 for the reply.` } : {})
  };
}

const withGroups = (board: LightboxBoard, ...groups: LightboxBoard['readings']): LightboxBoard => ({
  ...board,
  readings: board.readings.map((entry) => groups.find((group) => group.group === entry.group) ?? entry)
});

/** The writer's case: every call landed but call B, which failed. */
const oneFailed = () => withGroups(makeReadBoard(), {
  ...emptyLightboxReadingGroup('B'),
  status: 'failed',
  error: 'The call failed before a reading came back. Press Finish or Analyze to try again.'
});

const finish = () => document.querySelector('.pm-lb-run-press') as HTMLButtonElement;
const reanalyzeAll = () => document.querySelector('.pm-lb-run-secondary') as HTMLButtonElement | null;
const descriptionOf = (button: HTMLElement) => document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent;
const sparkle = (() => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.innerHTML = ICON_PATHS.sparkle;
  return svg.innerHTML;
})();

describe('LightboxApp: Re-analyze all beside Finish (Slice 4M)', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);
  const show = (board: LightboxBoard, value: LightboxRunEstimate | null = estimate(), hasKey = true) => {
    render(<LightboxApp />);
    fromHost(MessageType.API_KEY_STATUS, { hasSavedKey: hasKey });
    fromHost(MessageType.MODEL_DATA, { options: [], selections: { lightbox: 'provider/model-v1' } });
    fromHost(MessageType.LIGHTBOX_BOARD, { board, refusal: null });
    const request = posted(MessageType.LIGHTBOX_SET_LENSES).at(-1);
    fromHost(MessageType.LIGHTBOX_RUN_ESTIMATE, { requestId: request?.payload.requestId, estimate: value });
  };

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  it('offers Finish, orange with the sparkle, and Re-analyze all, a secondary button beside it, each with its own cost', () => {
    show(oneFailed());
    expect(finish().className).toContain('pm-lb-primary');
    expect(finish().querySelector('svg')?.innerHTML).toBe(sparkle);
    expect(finish().textContent).toBe('Finish1 call · est. $0.04');

    const all = reanalyzeAll() as HTMLButtonElement;
    expect(all.className).toContain('pm-lb-button');
    expect(all.className).not.toContain('pm-lb-primary');
    expect(all.textContent).toBe('Re-analyze all7 calls · est. $0.34 · the Opinion up to its digest bound');
    // Right beside Finish, in the run line.
    expect(finish().nextElementSibling).toBe(all);
    expect(all.disabled).toBe(false);
  });

  it('names each press by its visible label first', () => {
    show(oneFailed());
    expect(screen.getByRole('button', { name: /^Finish\s*1 call · est\. \$0\.04$/ })).toBe(finish());
    expect(screen.getByRole('button', { name: /^Re-analyze all\s*7 calls · est\. \$0\.34/ })).toBe(reanalyzeAll());
  });

  it('sends every call for Re-analyze all', () => {
    show(oneFailed());
    fireEvent.click(reanalyzeAll() as HTMLButtonElement);
    expect(posted(MessageType.LIGHTBOX_RUN)).toHaveLength(1);
    expect(posted(MessageType.LIGHTBOX_RUN)[0]?.payload).toMatchObject({ scope: { mode: 'all' }, estimateKey: 'estimate-board-8' });
  });

  it('sends the calls not back for Finish', () => {
    show(oneFailed());
    fireEvent.click(finish());
    expect(posted(MessageType.LIGHTBOX_RUN)).toHaveLength(1);
    expect(posted(MessageType.LIGHTBOX_RUN)[0]?.payload).toMatchObject({ scope: { mode: 'rest' }, estimateKey: 'estimate-board-8' });
  });

  it('keeps Run AI analyses alone before any run', () => {
    show(makeBoard(8));
    expect(finish().textContent).toBe('Run AI analyses');
    expect(reanalyzeAll()).toBeNull();
  });

  it('keeps Re-analyze alone once every call landed', () => {
    show(makeReadBoard());
    expect(finish().textContent).toMatch(/^Re-analyze7 calls/);
    expect(reanalyzeAll()).toBeNull();
  });

  it('shows Stop alone while a run is in flight', () => {
    show(withGroups(oneFailed(), { ...emptyLightboxReadingGroup('B'), status: 'running', pending: ['characters', 'voice', 'subtext'] }));
    fromHost(MessageType.LIGHTBOX_RUN_PROGRESS, { boardId: 'board-8', token: 'run-1', phase: 'started', groups: ['B'], groupsBack: 0, outputCharacters: 0 });
    expect(screen.getByRole('button', { name: 'Stop' })).not.toBeNull();
    expect(finish()).toBeNull();
    expect(reanalyzeAll()).toBeNull();
  });

  it('disables both without a key, each described by the one reason, said once', () => {
    show(oneFailed(), estimate(), false);
    expect(finish().disabled).toBe(true);
    expect((reanalyzeAll() as HTMLButtonElement).disabled).toBe(true);
    expect(descriptionOf(finish())).toBe('Add an OpenRouter API key in Settings to run AI analyses.');
    expect(descriptionOf(reanalyzeAll() as HTMLButtonElement)).toBe('Add an OpenRouter API key in Settings to run AI analyses.');
    expect(document.querySelectorAll('.pm-lb-run-reason')).toHaveLength(1);
  });

  it('disables only Re-analyze all when only a call that landed is too large, with its own reason; Finish still runs', () => {
    show(oneFailed(), estimate(['A']));
    expect(finish().disabled).toBe(false);
    expect(finish().hasAttribute('aria-describedby')).toBe(false);
    const all = reanalyzeAll() as HTMLButtonElement;
    expect(all.disabled).toBe(true);
    expect(descriptionOf(all)).toBe('Re-analyze all: Group A would send about 240,000 tokens and reserve 12,000 for the reply.');
    expect(all.title).toBe('Group A would send about 240,000 tokens and reserve 12,000 for the reply.');
    fireEvent.click(finish());
    expect(posted(MessageType.LIGHTBOX_RUN).at(-1)?.payload).toMatchObject({ scope: { mode: 'rest' } });
  });
});

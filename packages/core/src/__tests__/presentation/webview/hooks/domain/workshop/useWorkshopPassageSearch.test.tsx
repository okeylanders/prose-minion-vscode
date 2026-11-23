/** @jest-environment jsdom */

/**
 * useWorkshopPassageSearch and its card (ADR 2026-11-20 D19–D21): every
 * action posts ids only, under a minted request id and the room it was
 * shown in; a Run carries the key of the estimate on screen; only an answer
 * still waited for, for the room on screen, is taken; a new room drops
 * everything; nothing persists. The card asks its price once when first
 * drawn pending, and draws the host's view. Made-up text: Alice.
 */

import * as React from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import { MessageType, type WorkshopPassageSearchCardView, type WorkshopPassageSearchResultPayload, type WorkshopTurn } from '@messages';
import {
  useWorkshopPassageSearch,
  WORKSHOP_PASSAGE_SEARCH_PRICE_CHANGED,
  type UseWorkshopPassageSearchOptions
} from '@hooks/domain/workshop/useWorkshopPassageSearch';
import { WorkshopPassageSearchCard, type WorkshopPassageSearchControls } from '@components/workshop/passageSearch/WorkshopPassageSearchCard';
import { WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS } from '@shared/constants/workshopPassageSearchWords';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const TURN = 'turn-4-assistant-1008';
const ESTIMATE = { planKey: 'key-1', calls: 23, files: 6, model: 'model/search', usd: 0.42, organizes: true };

const result = (payload: Partial<WorkshopPassageSearchResultPayload> & { requestId: string }) => ({
  type: MessageType.WORKSHOP_PASSAGE_SEARCH_RESULT,
  source: 'extension.workshop.passageSearch',
  payload: { turnId: TURN, action: 'estimate', outcome: 'done', ...payload },
  timestamp: 2
}) as never;

describe('useWorkshopPassageSearch', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls
    .map(([message]: [{ type: MessageType; payload: Record<string, unknown> }]) => message)
    .filter((message) => message.type === type);
  const mount = (initial: UseWorkshopPassageSearchOptions = { roomKey: 'room:3', roomRevision: 3 }) =>
    renderHook((props: UseWorkshopPassageSearchOptions) => useWorkshopPassageSearch(props), { initialProps: initial });
  const priced = (hook: { current: ReturnType<typeof useWorkshopPassageSearch> }) => {
    act(() => hook.current.requestEstimate(TURN));
    const requestId = posted(MessageType.WORKSHOP_PASSAGE_SEARCH_ESTIMATE).at(-1)!.payload.requestId as string;
    act(() => hook.current.handleResult(result({ requestId, estimate: ESTIMATE })));
  };

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => jest.clearAllMocks());

  it('asks a card\'s price once, by ids only, and persists nothing', () => {
    const { result: hook } = mount();
    act(() => {
      hook.current.requestEstimate(TURN);
      hook.current.requestEstimate(TURN);
    });
    expect(posted(MessageType.WORKSHOP_PASSAGE_SEARCH_ESTIMATE)).toHaveLength(1);
    expect(posted(MessageType.WORKSHOP_PASSAGE_SEARCH_ESTIMATE)[0].payload)
      .toEqual({ requestId: expect.stringMatching(/^ws-passage-search-/), roomRevision: 3, turnId: TURN });
    expect(hook.current.estimates.get(TURN)).toEqual({ loading: true });
    expect(hook.current.persistedState).toEqual({});
  });

  it('posts nothing before the first snapshot, and no Run without a price on screen', () => {
    const { result: hook } = mount({ roomKey: 'pending' });
    act(() => {
      hook.current.requestEstimate(TURN);
      hook.current.cancel(TURN);
    });
    expect(vscode.postMessage).not.toHaveBeenCalled();
    const ready = mount();
    act(() => ready.result.current.run(TURN));
    expect(posted(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN)).toHaveLength(0);
  });

  it('a Run carries the key shown, stays waited for until the search ends, and takes its progress', () => {
    const { result: hook } = mount();
    priced(hook);
    act(() => {
      hook.current.run(TURN);
      hook.current.run(TURN);
    });
    const runs = posted(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN);
    expect(runs).toHaveLength(1);
    expect(runs[0].payload).toEqual({ requestId: expect.any(String), roomRevision: 3, turnId: TURN, planKey: 'key-1' });
    const requestId = runs[0].payload.requestId as string;
    act(() => hook.current.handleResult(result({ requestId, action: 'run', outcome: 'started' })));
    expect(hook.current.busy.get(TURN)).toBe('run');
    const progress = (id: string) => ({ type: MessageType.WORKSHOP_PASSAGE_SEARCH_PROGRESS, source: 'extension', timestamp: 3,
      payload: { requestId: id, turnId: TURN, done: 7, planned: 23, found: 5 } }) as never;
    act(() => hook.current.handleProgress(progress('someone-else')));
    expect(hook.current.progress.size).toBe(0);
    act(() => hook.current.handleProgress(progress(requestId)));
    expect(hook.current.progress.get(TURN)).toEqual({ done: 7, planned: 23, found: 5 });
    // Stop rides beside the running search.
    act(() => hook.current.stop(TURN));
    expect(posted(MessageType.WORKSHOP_PASSAGE_SEARCH_STOP)).toHaveLength(1);
    act(() => hook.current.handleResult(result({ requestId, action: 'run', outcome: 'finished', message: 'Stopped: 9 instances from 7 of 23 reads.' })));
    expect(hook.current.busy.has(TURN)).toBe(false);
    expect(hook.current.progress.has(TURN)).toBe(false);
    expect(hook.current.feedback.get(TURN)).toBe('Stopped: 9 instances from 7 of 23 reads.');
    // A duplicate of the finished answer changes nothing.
    act(() => hook.current.handleResult(result({ requestId, action: 'run', outcome: 'finished', message: 'Again.' })));
    expect(hook.current.feedback.get(TURN)).toBe('Stopped: 9 instances from 7 of 23 reads.');
  });

  it('a changed price replaces the one on screen and waits for another press', () => {
    const { result: hook } = mount();
    priced(hook);
    act(() => hook.current.run(TURN));
    const requestId = posted(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN)[0].payload.requestId as string;
    act(() => hook.current.handleResult(result({ requestId, action: 'run', outcome: 'price-changed', estimate: { ...ESTIMATE, planKey: 'key-2', usd: 0.61 } })));
    expect(hook.current.estimates.get(TURN)?.estimate?.planKey).toBe('key-2');
    expect(hook.current.feedback.get(TURN)).toBe(WORKSHOP_PASSAGE_SEARCH_PRICE_CHANGED);
    act(() => hook.current.run(TURN));
    expect(posted(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN)[1].payload.planKey).toBe('key-2');
  });

  it('keeps a refusal\'s words, and a new room drops everything and every late answer', () => {
    const { result: hook, rerender } = mount();
    act(() => hook.current.send(TURN));
    const requestId = posted(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND)[0].payload.requestId as string;
    act(() => hook.current.handleResult(result({ requestId: 'someone-else', action: 'send', outcome: 'refused', message: 'No.' })));
    expect(hook.current.busy.get(TURN)).toBe('send');
    act(() => hook.current.handleResult(result({ requestId, action: 'send', outcome: 'refused', reason: 'run-active', message: WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS['run-active'] })));
    expect(hook.current.busy.has(TURN)).toBe(false);
    expect(hook.current.feedback.get(TURN)).toBe(WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS['run-active']);

    act(() => hook.current.openReport(TURN));
    const late = posted(MessageType.WORKSHOP_PASSAGE_SEARCH_OPEN_REPORT)[0].payload.requestId as string;
    rerender({ roomKey: 'room:4', roomRevision: 4 });
    expect(hook.current.feedback.size).toBe(0);
    expect(hook.current.busy.size).toBe(0);
    act(() => hook.current.handleResult(result({ requestId: late, action: 'open-report', outcome: 'refused', message: 'Late.' })));
    expect(hook.current.feedback.size).toBe(0);
  });
});

describe('WorkshopPassageSearchCard', () => {
  const controls = (overrides: Partial<WorkshopPassageSearchControls> = {}): WorkshopPassageSearchControls => ({
    estimates: new Map(), busy: new Map(), progress: new Map(), feedback: new Map(), locked: false,
    onEstimate: jest.fn(), onRun: jest.fn(), onStop: jest.fn(), onCancel: jest.fn(), onSend: jest.fn(), onDiscard: jest.fn(), onOpenReport: jest.fn(),
    ...overrides
  });
  const turn = (view?: WorkshopPassageSearchCardView): WorkshopTurn => ({
    id: TURN, role: 'assistant', participant: 'host', personaLabel: 'Jill', content: 'Asking.',
    passageSearchRequest: {
      question: 'Find every time the Rabbit checks his watch.',
      scopes: [{ kind: 'group', group: 'chapters' }, { kind: 'file', group: 'characters', path: 'cast/rabbit.md' }, { kind: 'excerpt' }],
      ...(view ? { view } : {})
    }
  }) as WorkshopTurn;
  const counts = {
    instances: 14, files: 6, labels: 3, dropped: 0, calls: { planned: 23, answered: 23, failed: 0, cut: 0, unsent: 0 },
    ended: 'complete' as const, organized: true
  };
  const names = () => screen.queryAllByRole('button').map((button) => button.textContent);

  it('asks its price when first drawn pending, then shows the count, the price, the model and what it covers', () => {
    const asking = controls();
    const { rerender } = render(<WorkshopPassageSearchCard turn={turn({ status: 'pending' })} controls={asking} />);
    expect(asking.onEstimate).toHaveBeenCalledWith(TURN);
    expect(screen.getByText('Working out the price…')).toBeTruthy();
    expect(names()).toEqual(['Cancel']);

    const shown = controls({ estimates: new Map([[TURN, { loading: false, estimate: ESTIMATE }]]) });
    rerender(<WorkshopPassageSearchCard turn={turn({ status: 'pending' })} controls={shown} />);
    expect(screen.getByText('23 calls · ≈ $0.42 · model/search')).toBeTruthy();
    expect(screen.getByText(/The search only\. Jill's reply to the results is an ordinary turn\./)).toBeTruthy();
    expect(screen.getByText(/Where: .*Chapters.*cast\/rabbit\.md; the excerpt/)).toBeTruthy();
    expect(names()).toEqual(['Run', 'Cancel']);
    screen.getByText('Run').click();
    expect(shown.onRun).toHaveBeenCalledWith(TURN);
  });

  it('draws each state the host derives', () => {
    const drawn = controls({ feedback: new Map([[TURN, 'Stopped: 9 instances from 7 of 23 reads.']]) });
    const { rerender } = render(<WorkshopPassageSearchCard turn={turn({ status: 'running', progress: { done: 7, planned: 23, found: 5 } })} controls={drawn} />);
    expect(screen.getByText('Reading 7 of 23 · 5 found')).toBeTruthy();
    expect(names()).toEqual(['Stop']);
    // One status line carries the host's words for the last outcome.
    expect(screen.getAllByRole('status').map((line) => line.textContent)).toEqual(['Stopped: 9 instances from 7 of 23 reads.']);
    expect(drawn.onEstimate).not.toHaveBeenCalled();

    rerender(<WorkshopPassageSearchCard turn={turn({ status: 'ready', counts, partial: false })} controls={drawn} />);
    expect(names()).toEqual(['Send to Jill', 'Open report', 'Discard']);
    rerender(<WorkshopPassageSearchCard turn={turn({ status: 'ready', counts: { ...counts, ended: 'stopped' }, partial: true })} controls={drawn} />);
    expect(names()).toEqual(['Send partial results to Jill', 'Open report', 'Discard']);
    rerender(<WorkshopPassageSearchCard turn={turn({ status: 'ready', counts, partial: false, sending: true })} controls={drawn} />);
    expect(names()).toEqual([]);
    expect(screen.getByText('Sending the results to Jill…')).toBeTruthy();

    rerender(<WorkshopPassageSearchCard turn={turn({ status: 'delivered', counts, shown: 9, reportHeld: true })} controls={drawn} />);
    expect(screen.getByText(/Jill was sent 9 of 14 instances; the report has them all\./)).toBeTruthy();
    expect(names()).toEqual(['Open report']);
    rerender(<WorkshopPassageSearchCard turn={turn({ status: 'delivered', counts, shown: 14, reportHeld: false })} controls={drawn} />);
    expect(names()).toEqual([]);
    expect(screen.getByText(WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS['not-held'])).toBeTruthy();

    rerender(<WorkshopPassageSearchCard turn={turn({ status: 'cancelled' })} controls={drawn} />);
    expect(screen.getByText('Cancelled.')).toBeTruthy();
    expect(names()).toEqual([]);
  });

  it('offers only Cancel once the author left, and asks no price', () => {
    const left = controls();
    render(<WorkshopPassageSearchCard turn={turn({ status: 'pending', authorLeft: true })} controls={left} />);
    expect(left.onEstimate).not.toHaveBeenCalled();
    expect(names()).toEqual(['Cancel']);
    expect(screen.getByText(WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS['author-left'])).toBeTruthy();
  });
});

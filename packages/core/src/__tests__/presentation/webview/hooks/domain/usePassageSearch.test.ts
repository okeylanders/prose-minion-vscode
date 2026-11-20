/**
 * @jest-environment jsdom
 */

/**
 * usePassageSearch (ADR 2026-11-20 D15): the tripartite contract, the
 * two-step press by request id, only the pending answer taken, a plan
 * dropped on any edit, and a persisted shape that holds preferences only.
 */

import { act, renderHook } from '@testing-library/react';
import { MessageType, PassageSearchPlanPayload, PassageSearchResultPayload } from '@messages';
import {
  PASSAGE_SEARCH_DEFAULT_SCOPES,
  PassageSearchActions,
  PassageSearchPersistence,
  PassageSearchState,
  passageSearchScopesFrom,
  usePassageSearch
} from '@hooks/domain/usePassageSearch';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { ESTIMATE, RESULT } from '@/__tests__/shared/utils/passageSearchViewFixtures';

jest.mock('@hooks/useVSCodeApi');
jest.mock('@hooks/usePersistence');

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { usePersistedState } from '@hooks/usePersistence';

const QUESTION = 'Find every time the White Rabbit checks his watch.';

describe('usePassageSearch', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  const sent = (type: MessageType): Array<Record<string, any>> =>
    vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type).map((message) => message.payload);
  const envelope = <T>(type: MessageType, payload: T) => ({ type, source: 'extension.search.passage', payload, timestamp: 1 }) as never;
  const planAnswer = (payload: PassageSearchPlanPayload) => envelope(MessageType.PASSAGE_SEARCH_PLAN, payload);
  const resultAnswer = (payload: PassageSearchResultPayload) => envelope(MessageType.PASSAGE_SEARCH_RESULT, payload);

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    (usePersistedState as jest.Mock).mockReturnValue(undefined);
  });

  const mounted = () => {
    const hook = renderHook(() => usePassageSearch());
    act(() => hook.result.current.setQuestion(QUESTION));
    return hook;
  };

  /** Ask for an estimate and answer it; returns the plan request's id. */
  const estimated = (hook: ReturnType<typeof mounted>, planId = 'plan-1'): string => {
    act(() => hook.result.current.requestEstimate());
    const requestId = sent(MessageType.PASSAGE_SEARCH_PLAN_REQUEST).slice(-1)[0].requestId as string;
    act(() => hook.result.current.handlePlan(planAnswer({ requestId, status: 'planned', planId, estimate: ESTIMATE })));
    return requestId;
  };

  /** Estimate, press Run, and return the run's request id. */
  const running = (hook: ReturnType<typeof mounted>): string => {
    estimated(hook);
    act(() => hook.result.current.runSearch());
    return sent(MessageType.PASSAGE_SEARCH_RUN).slice(-1)[0].requestId as string;
  };

  it('honours the tripartite interface', () => {
    const { result } = renderHook(() => usePassageSearch());
    const state: PassageSearchState = result.current;
    const actions: PassageSearchActions = result.current;
    const persistence: PassageSearchPersistence = result.current.persistedState;
    expect(state.plan).toEqual({ status: 'none' });
    expect(state.run).toEqual({ status: 'idle' });
    expect(state.organizeOffer).toEqual({ status: 'none' });
    expect(state.organize).toBe(true);
    expect(state.scopes).toEqual(PASSAGE_SEARCH_DEFAULT_SCOPES);
    expect(typeof actions.requestEstimate).toBe('function');
    expect(Object.keys(persistence).sort()).toEqual(['passageSearchOrganize', 'passageSearchScopes']);
  });

  describe('persistence', () => {
    it('holds the scope choices and the organize toggle, and nothing of the question, plan or result', () => {
      const hook = mounted();
      act(() => {
        hook.result.current.setGroupScope('manuscript', true);
        hook.result.current.setGroupScope('characters', true);
        hook.result.current.setPatternScope('drafts/*.md');
        hook.result.current.setOrganize(false);
      });
      const runId = running(hook);
      act(() => hook.result.current.handleResult(resultAnswer({ requestId: runId, status: 'finished', result: RESULT })));

      expect(hook.result.current.result).toBe(RESULT);
      expect(hook.result.current.persistedState).toEqual({
        passageSearchScopes: { activeFile: true, selection: false, groups: ['characters', 'manuscript'], pattern: 'drafts/*.md' },
        passageSearchOrganize: false
      });
      const persisted = JSON.stringify(hook.result.current.persistedState);
      expect(persisted).not.toContain('Rabbit');
      expect(persisted).not.toContain('waistcoat');
      expect(persisted).not.toContain('plan-1');
    });

    it('restores the choices, reading a damaged shape field by field', () => {
      (usePersistedState as jest.Mock).mockReturnValue({
        passageSearchScopes: { activeFile: false, selection: 'yes', groups: ['manuscript', 'tea-party', 7], pattern: 12 },
        passageSearchOrganize: false
      });
      const { result } = renderHook(() => usePassageSearch());
      expect(result.current.scopes).toEqual({ activeFile: false, selection: false, groups: ['manuscript'], pattern: '' });
      expect(result.current.organize).toBe(false);
      expect(passageSearchScopesFrom(null)).toEqual(PASSAGE_SEARCH_DEFAULT_SCOPES);
    });
  });

  describe('the estimate', () => {
    it('sends the question, the scope choices and the toggle under a minted id', () => {
      const hook = mounted();
      act(() => hook.result.current.setSelectionScope(true));
      act(() => hook.result.current.requestEstimate());
      const [request] = sent(MessageType.PASSAGE_SEARCH_PLAN_REQUEST);
      expect(request).toEqual({
        requestId: expect.stringMatching(/^ps-[a-z0-9]+:1$/),
        question: QUESTION,
        scopes: { activeFile: true, selection: true, groups: [], pattern: '' },
        organize: true
      });
      expect(hook.result.current.plan).toEqual({ status: 'estimating' });
    });

    it('takes only the answer it still waits for', () => {
      const hook = mounted();
      act(() => hook.result.current.requestEstimate());
      act(() => hook.result.current.requestEstimate());
      const [first, second] = sent(MessageType.PASSAGE_SEARCH_PLAN_REQUEST).map((request) => request.requestId as string);

      act(() => hook.result.current.handlePlan(planAnswer({ requestId: first, status: 'planned', planId: 'plan-old', estimate: ESTIMATE })));
      expect(hook.result.current.plan).toEqual({ status: 'estimating' });
      act(() => hook.result.current.handlePlan(planAnswer({ requestId: 'ps-other:9', status: 'planned', planId: 'plan-x', estimate: ESTIMATE })));
      expect(hook.result.current.plan).toEqual({ status: 'estimating' });

      act(() => hook.result.current.handlePlan(planAnswer({ requestId: second, status: 'planned', planId: 'plan-new', estimate: ESTIMATE })));
      expect(hook.result.current.plan).toEqual({ status: 'planned', planId: 'plan-new', estimate: ESTIMATE });
      // An answer repeated after it was taken changes nothing.
      act(() => hook.result.current.handlePlan(planAnswer({ requestId: second, status: 'refused', reason: 'no-files', message: 'late' })));
      expect(hook.result.current.plan.status).toBe('planned');
    });

    it('shows a refusal in the host\'s words', () => {
      const hook = mounted();
      act(() => hook.result.current.requestEstimate());
      const requestId = sent(MessageType.PASSAGE_SEARCH_PLAN_REQUEST)[0].requestId as string;
      act(() => hook.result.current.handlePlan(planAnswer({ requestId, status: 'refused', reason: 'no-selection', message: 'No text is selected in the editor.' })));
      expect(hook.result.current.plan).toEqual({ status: 'refused', message: 'No text is selected in the editor.' });
    });

    it.each<[string, (actions: PassageSearchActions) => void]>([
      ['the question', (actions) => actions.setQuestion('Where does the Cheshire Cat grin?')],
      ['the active file', (actions) => actions.setActiveFileScope(false)],
      ['the selection', (actions) => actions.setSelectionScope(true)],
      ['a group', (actions) => actions.setGroupScope('chapters', true)],
      ['the pattern', (actions) => actions.setPatternScope('drafts/*.md')],
      ['the organize toggle', (actions) => actions.setOrganize(false)]
    ])('drops the shown plan when %s changes', (_name, change) => {
      const hook = mounted();
      estimated(hook);
      expect(hook.result.current.plan.status).toBe('planned');
      act(() => change(hook.result.current));
      expect(hook.result.current.plan).toEqual({ status: 'none' });
      act(() => hook.result.current.runSearch());
      expect(sent(MessageType.PASSAGE_SEARCH_RUN)).toEqual([]);
    });

    it('stops waiting for an estimate when an edit lands first', () => {
      const hook = mounted();
      act(() => hook.result.current.requestEstimate());
      const requestId = sent(MessageType.PASSAGE_SEARCH_PLAN_REQUEST)[0].requestId as string;
      act(() => hook.result.current.setQuestion(`${QUESTION} And his gloves?`));
      act(() => hook.result.current.handlePlan(planAnswer({ requestId, status: 'planned', planId: 'plan-1', estimate: ESTIMATE })));
      expect(hook.result.current.plan).toEqual({ status: 'none' });
    });
  });

  describe('the run', () => {
    it('names the held plan, and spends it', () => {
      const hook = mounted();
      const runId = running(hook);
      expect(sent(MessageType.PASSAGE_SEARCH_RUN)).toEqual([{ requestId: runId, planId: 'plan-1' }]);
      expect(hook.result.current.plan).toEqual({ status: 'none' });
      expect(hook.result.current.run).toEqual({ status: 'running', kind: 'search', stopping: false });
      act(() => hook.result.current.runSearch());
      expect(sent(MessageType.PASSAGE_SEARCH_RUN)).toHaveLength(1);
    });

    it('does not run without an estimate', () => {
      const hook = mounted();
      act(() => hook.result.current.runSearch());
      expect(sent(MessageType.PASSAGE_SEARCH_RUN)).toEqual([]);
    });

    it('shows progress and the result for its own request only', () => {
      const hook = mounted();
      const runId = running(hook);
      const progress = (requestId: string, done: number) =>
        envelope(MessageType.PASSAGE_SEARCH_PROGRESS, { requestId, calls: { planned: 23, done }, found: done });

      act(() => hook.result.current.handleProgress(progress('ps-other:4', 9)));
      expect(hook.result.current.run).toEqual({ status: 'running', kind: 'search', stopping: false });
      act(() => hook.result.current.handleProgress(progress(runId, 7)));
      expect(hook.result.current.run).toMatchObject({ progress: { calls: { planned: 23, done: 7 }, found: 7 } });

      act(() => hook.result.current.handleResult(resultAnswer({ requestId: 'ps-other:4', status: 'finished', result: { ...RESULT, resultId: 'stale' } })));
      expect(hook.result.current.result).toBeUndefined();
      expect(hook.result.current.run.status).toBe('running');

      act(() => hook.result.current.handleResult(resultAnswer({ requestId: runId, status: 'finished', result: RESULT })));
      expect(hook.result.current.result).toBe(RESULT);
      expect(hook.result.current.run).toEqual({ status: 'idle' });

      // Late progress and a repeated answer are no longer waited for.
      act(() => hook.result.current.handleProgress(progress(runId, 8)));
      act(() => hook.result.current.handleResult(resultAnswer({ requestId: runId, status: 'refused', reason: 'run-failed', message: 'late' })));
      expect(hook.result.current.run).toEqual({ status: 'idle' });
      expect(hook.result.current.result).toBe(RESULT);
    });

    it('Stop names the run, and the result so far still lands', () => {
      const hook = mounted();
      const runId = running(hook);
      act(() => hook.result.current.stopSearch());
      expect(sent(MessageType.PASSAGE_SEARCH_STOP)).toEqual([{ requestId: runId }]);
      expect(hook.result.current.run).toMatchObject({ status: 'running', stopping: true });
      act(() => hook.result.current.handleResult(resultAnswer({ requestId: runId, status: 'finished', result: RESULT })));
      expect(hook.result.current.result?.ended).toBe('stopped');
      expect(hook.result.current.run).toEqual({ status: 'idle' });
    });

    it('Stop does nothing when no search is running', () => {
      const hook = mounted();
      act(() => hook.result.current.stopSearch());
      expect(sent(MessageType.PASSAGE_SEARCH_STOP)).toEqual([]);
    });

    it('shows a refused Run in the host\'s words and keeps the result on screen', () => {
      const hook = mounted();
      const firstRun = running(hook);
      act(() => hook.result.current.handleResult(resultAnswer({ requestId: firstRun, status: 'finished', result: RESULT })));
      const secondRun = running(hook);
      act(() => hook.result.current.handleResult(resultAnswer({ requestId: secondRun, status: 'refused', reason: 'plan-expired', message: 'That estimate is no longer current.' })));
      expect(hook.result.current.runRefusal).toBe('That estimate is no longer current.');
      expect(hook.result.current.result).toBe(RESULT);
    });

    it('drops the result on screen when the host kept nothing of a failed search', () => {
      const hook = mounted();
      const firstRun = running(hook);
      act(() => hook.result.current.handleResult(resultAnswer({ requestId: firstRun, status: 'finished', result: RESULT })));
      const secondRun = running(hook);
      act(() => hook.result.current.handleResult(resultAnswer({ requestId: secondRun, status: 'refused', reason: 'run-failed', message: 'The search failed.' })));
      expect(hook.result.current.result).toBeUndefined();
    });

    it('asks for no estimate while a search runs', () => {
      const hook = mounted();
      running(hook);
      act(() => hook.result.current.requestEstimate());
      expect(sent(MessageType.PASSAGE_SEARCH_PLAN_REQUEST)).toHaveLength(1);
    });
  });

  describe('open an instance', () => {
    const withResult = () => {
      const hook = mounted();
      const runId = running(hook);
      act(() => hook.result.current.handleResult(resultAnswer({ requestId: runId, status: 'finished', result: RESULT })));
      return hook;
    };

    it('sends the result id and the instance number, never a path', () => {
      const hook = withResult();
      act(() => hook.result.current.openInstance(2));
      const [open] = sent(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE);
      expect(open).toEqual({ requestId: expect.any(String), resultId: 'result-1', instance: 2 });
      expect(JSON.stringify(open)).not.toContain('alice');
    });

    it('shows why the newest open was refused, and clears it on the next press', () => {
      const hook = withResult();
      const answer = (requestId: string) =>
        envelope(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE_RESULT, { requestId, status: 'refused', message: 'This instance is in text that has no saved file to open.' });
      act(() => hook.result.current.openInstance(3));
      const first = sent(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE)[0].requestId as string;
      act(() => hook.result.current.openInstance(1));
      act(() => hook.result.current.handleOpenInstanceResult(answer(first)));
      expect(hook.result.current.openRefusal).toBeUndefined();

      const second = sent(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE)[1].requestId as string;
      act(() => hook.result.current.handleOpenInstanceResult(answer(second)));
      expect(hook.result.current.openRefusal).toBe('This instance is in text that has no saved file to open.');
      act(() => hook.result.current.openInstance(1));
      expect(hook.result.current.openRefusal).toBeUndefined();
    });

    it('opens nothing with no result on screen', () => {
      const hook = mounted();
      act(() => hook.result.current.openInstance(1));
      expect(sent(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE)).toEqual([]);
    });
  });

  describe('organize these results', () => {
    const organizeEstimate = { model: 'test/reader', calls: 1, inputTokens: 900, outputTokens: 1200, usd: 0.03, instances: { read: 3, of: 3 } };
    const stopped = (canOrganize: boolean) => {
      const hook = mounted();
      const runId = running(hook);
      act(() => hook.result.current.handleResult(resultAnswer({ requestId: runId, status: 'finished', result: { ...RESULT, canOrganize } })));
      return hook;
    };
    const organizePlanAnswer = (requestId: string) => envelope(MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN, {
      requestId, status: 'planned', resultId: 'result-1', organizePlanId: 'organize-1', estimate: organizeEstimate
    });

    it('is its own two-step press, by result id and request id', () => {
      const hook = stopped(true);
      act(() => hook.result.current.requestOrganizeEstimate());
      const [request] = sent(MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN_REQUEST);
      expect(request).toEqual({ requestId: expect.any(String), resultId: 'result-1' });
      expect(hook.result.current.organizeOffer).toEqual({ status: 'estimating' });

      act(() => hook.result.current.handleOrganizePlan(organizePlanAnswer('ps-other:2')));
      expect(hook.result.current.organizeOffer).toEqual({ status: 'estimating' });
      act(() => hook.result.current.handleOrganizePlan(organizePlanAnswer(request.requestId)));
      expect(hook.result.current.organizeOffer).toEqual({ status: 'planned', organizePlanId: 'organize-1', estimate: organizeEstimate });

      act(() => hook.result.current.runOrganize());
      const [run] = sent(MessageType.PASSAGE_SEARCH_ORGANIZE_RUN);
      expect(run).toEqual({ requestId: expect.any(String), resultId: 'result-1', organizePlanId: 'organize-1' });
      expect(hook.result.current.run).toEqual({ status: 'running', kind: 'organize', stopping: false });

      const organized = { ...RESULT, resultId: 'result-2', canOrganize: false };
      act(() => hook.result.current.handleResult(resultAnswer({ requestId: run.requestId, status: 'finished', result: organized })));
      expect(hook.result.current.result).toBe(organized);
      expect(hook.result.current.organizeOffer).toEqual({ status: 'none' });
    });

    it('asks nothing for a result that cannot be organized, and runs nothing unpriced', () => {
      const hook = stopped(false);
      act(() => hook.result.current.requestOrganizeEstimate());
      act(() => hook.result.current.runOrganize());
      expect(sent(MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN_REQUEST)).toEqual([]);
      expect(sent(MessageType.PASSAGE_SEARCH_ORGANIZE_RUN)).toEqual([]);
    });

    it('shows a refusal in the host\'s words', () => {
      const hook = stopped(true);
      act(() => hook.result.current.requestOrganizeEstimate());
      const requestId = sent(MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN_REQUEST)[0].requestId as string;
      act(() => hook.result.current.handleOrganizePlan(envelope(MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN, {
        requestId, status: 'refused', reason: 'unavailable', message: 'Organizing the results is not available yet.'
      })));
      expect(hook.result.current.organizeOffer).toEqual({ status: 'refused', message: 'Organizing the results is not available yet.' });
    });
  });
});

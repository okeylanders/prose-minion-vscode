/**
 * Passage Search's sidebar routes (ADR 2026-11-20 D15): the two-step press,
 * one held plan, Stop, the held result, open-instance by number, organizing
 * a result afterwards, and logs that carry no writer text. The engine is a
 * fake; nothing here reaches a model.
 */

import { PASSAGE_SEARCH_ROUTE_WORDS } from '@/application/handlers/domain/PassageSearchRoute';
import {
  MessageType,
  PassageSearchOpenInstanceResultPayload,
  PassageSearchProgressPayload
} from '@messages';
import type { PassageSearchResult, PassageSearchRunOptions } from '@services/search/passage/PassageSearchContracts';
import { passageSearchRefusal } from '@services/search/passage/PassageSearchRefusals';
import {
  ALICE_ABSOLUTE,
  ALICE_LABEL,
  ALICE_NOTE,
  ALICE_QUESTION,
  ALICE_QUOTE,
  ORGANIZE_PLAN,
  PATTERN,
  SCOPES,
  aliceResult,
  fakePassageSearchEngine,
  held,
  passageSearchRouteHost,
  type FakePassageSearchEngine,
  type PassageSearchRouteHost
} from '@/__tests__/application/handlers/domain/passageSearchRouteHarness';

describe('PassageSearchRoute', () => {
  let host: PassageSearchRouteHost;
  let router: PassageSearchRouteHost['router'];
  let route: PassageSearchRouteHost['route'];
  let engine: FakePassageSearchEngine;
  let postMessage: jest.Mock;
  let openFileInEditor: jest.Mock;

  beforeEach(() => {
    host = passageSearchRouteHost();
    ({ router, route, engine, postMessage, openFileInEditor } = host);
  });

  const send = (type: MessageType, payload: unknown) => host.send(type, payload);
  const posted = <T>(type: MessageType) => host.posted<T>(type);
  const plans = () => host.plans();
  const results = () => host.results();
  const logs = () => host.logs();
  const planRequest = (requestId: string, overrides: Record<string, unknown> = {}) => host.planRequest(requestId, overrides);
  const planned = (requestId = 'plan-1') => host.planned(requestId);
  const finished = (result?: PassageSearchResult) => host.finished(result);

  it('registers its six routes', () => {
    expect(router.handlerCount).toBe(6);
  });

  describe('the two-step press', () => {
    it('answers a plan request with an estimate and a plan id, sending nothing to a model', async () => {
      await planRequest('plan-1');
      expect(engine.plan).toHaveBeenCalledWith({
        question: ALICE_QUESTION,
        organize: true,
        scopes: [
          { kind: 'active-file' },
          { kind: 'group', group: 'chapters' },
          { kind: 'pattern', pattern: PATTERN, writerTyped: true }
        ]
      });
      expect(engine.run).not.toHaveBeenCalled();
      expect(plans()).toEqual([{
        requestId: 'plan-1',
        status: 'planned',
        planId: expect.any(String),
        estimate: {
          model: 'test/reader',
          files: 3,
          calls: 4,
          inputTokens: 9000,
          outputTokens: 3200,
          usd: 0.42,
          organizeAllowance: true,
          leftOut: { unreadable: 0, unsplittable: 1, empty: 0 },
          leftOutMessage: '1 file left out: it has no place to split.'
        }
      }]);
    });

    it('runs exactly the held plan, and posts progress and the result by the run\'s request id', async () => {
      const planId = await planned();
      const plan = (await engine.plan.mock.results[0].value as { plan: unknown }).plan;
      engine.run.mockImplementationOnce(async (_plan, options?: PassageSearchRunOptions) => {
        options?.onProgress?.({ calls: { planned: 3, done: 1 }, found: 1 });
        options?.onProgress?.({ calls: { planned: 3, done: 3 }, found: 2 });
        return aliceResult();
      });

      await send(MessageType.PASSAGE_SEARCH_RUN, { requestId: 'run-1', planId });

      expect(engine.run).toHaveBeenCalledTimes(1);
      expect(engine.run.mock.calls[0][0]).toBe(plan);
      expect(posted<PassageSearchProgressPayload>(MessageType.PASSAGE_SEARCH_PROGRESS)).toEqual([
        { requestId: 'run-1', calls: { planned: 3, done: 1 }, found: 1 },
        { requestId: 'run-1', calls: { planned: 3, done: 3 }, found: 2 }
      ]);
      const [answer] = results();
      expect(answer).toMatchObject({ requestId: 'run-1', status: 'finished' });
      if (answer.status !== 'finished') {
        throw new Error('expected a result');
      }
      expect(answer.result).toMatchObject({
        question: ALICE_QUESTION,
        model: 'test/reader',
        ended: 'complete',
        canOrganize: false,
        labels: [{ label: ALICE_LABEL, count: 2, files: 2 }],
        files: { read: 3, withInstances: 2 },
        calls: { planned: 3, answered: 3, failed: 0, cut: 0, unsent: 0 }
      });
      expect(answer.result.instances[0]).toEqual({
        number: 1,
        file: 'chapters/alice-ch1.md',
        line: 12,
        lines: 'document',
        canOpen: true,
        quote: ALICE_QUOTE,
        before: 'when the Rabbit actually ',
        after: ', and looked at it',
        note: ALICE_NOTE,
        label: ALICE_LABEL
      });
      expect(answer.result.instances[1]).toMatchObject({ file: 'Selected text', lines: 'text', canOpen: false });
    });

    it('never sends the webview an absolute path or a plan file key', async () => {
      await finished();
      const everything = JSON.stringify(postMessage.mock.calls);
      expect(everything).not.toContain('/home/dodgson');
      expect(everything).not.toContain('"f1"');
    });

    it('says how a run that was cut short ended, in the engine\'s words', async () => {
      await finished(aliceResult({ ended: 'key-changed', calls: { planned: 3, answered: 1, failed: 0, cut: 0, unsent: 2 } }));
      const [answer] = results();
      expect(answer.status === 'finished' && answer.result.endedMessage)
        .toBe('The API key changed during the search, so the remaining calls were not made.');
    });
  });

  describe('one held plan', () => {
    it('refuses Run for any id but the held plan\'s, and sends nothing', async () => {
      await planned();
      await send(MessageType.PASSAGE_SEARCH_RUN, { requestId: 'run-1', planId: 'plan-of-another-day' });
      expect(engine.run).not.toHaveBeenCalled();
      expect(results()).toEqual([{ requestId: 'run-1', status: 'refused', reason: 'plan-expired', message: PASSAGE_SEARCH_ROUTE_WORDS['plan-expired'] }]);
    });

    it('refuses Run with no plan held', async () => {
      await send(MessageType.PASSAGE_SEARCH_RUN, { requestId: 'run-1', planId: 'plan-x-1' });
      expect(engine.run).not.toHaveBeenCalled();
      expect(results()[0]).toMatchObject({ status: 'refused', reason: 'plan-expired' });
    });

    it('drops the old plan when a new one is asked for', async () => {
      const first = await planned('plan-1');
      const second = await planned('plan-2');
      expect(second).not.toBe(first);
      await send(MessageType.PASSAGE_SEARCH_RUN, { requestId: 'run-1', planId: first });
      expect(engine.run).not.toHaveBeenCalled();
      expect(results()[0]).toMatchObject({ status: 'refused', reason: 'plan-expired' });
    });

    it('drops the old plan as soon as a new request arrives, even one that is refused', async () => {
      const first = await planned('plan-1');
      engine.plan.mockResolvedValueOnce({ kind: 'refused', refusal: passageSearchRefusal('no-selection') });
      await planRequest('plan-2');
      await send(MessageType.PASSAGE_SEARCH_RUN, { requestId: 'run-1', planId: first });
      expect(engine.run).not.toHaveBeenCalled();
    });

    it('spends the plan on a run: a second Run of the same plan is refused', async () => {
      const planId = await planned();
      await send(MessageType.PASSAGE_SEARCH_RUN, { requestId: 'run-1', planId });
      await send(MessageType.PASSAGE_SEARCH_RUN, { requestId: 'run-2', planId });
      expect(engine.run).toHaveBeenCalledTimes(1);
      expect(results()[1]).toMatchObject({ requestId: 'run-2', status: 'refused', reason: 'plan-expired' });
    });

    it('holds only the newest request\'s plan when an older one answers late', async () => {
      const slow = held<Awaited<ReturnType<FakePassageSearchEngine['plan']>>>();
      engine.plan.mockReturnValueOnce(slow.promise);
      const older = planRequest('plan-1');
      const newest = await planned('plan-2');
      slow.resolve(await engine.plan.mock.results[1].value);
      await older;

      expect(plans().find((plan) => plan.requestId === 'plan-1')).toMatchObject({ status: 'refused', reason: 'superseded' });
      await send(MessageType.PASSAGE_SEARCH_RUN, { requestId: 'run-1', planId: newest });
      expect(engine.run).toHaveBeenCalledTimes(1);
    });
  });

  describe('Stop', () => {
    it('aborts the run, posts what was found, and starts nothing further', async () => {
      const planId = await planned();
      const reads = held<PassageSearchResult>();
      let signal: AbortSignal | undefined;
      engine.run.mockImplementationOnce((_plan, options?: PassageSearchRunOptions) => {
        signal = options?.signal;
        return reads.promise;
      });
      const run = send(MessageType.PASSAGE_SEARCH_RUN, { requestId: 'run-1', planId });
      await Promise.resolve();

      await send(MessageType.PASSAGE_SEARCH_STOP, { requestId: 'run-1' });
      expect(signal?.aborted).toBe(true);
      const partial = aliceResult({ ended: 'stopped', calls: { planned: 3, answered: 1, failed: 0, cut: 0, unsent: 2 } });
      reads.resolve(partial);
      await run;

      const [answer] = results();
      expect(answer).toMatchObject({ requestId: 'run-1', status: 'finished', result: { ended: 'stopped', endedMessage: 'Stopped before every call was made.' } });
      expect(answer.status === 'finished' && answer.result.instances).toHaveLength(2);
      expect(answer.status === 'finished' && answer.result.analysis).toBeUndefined();
      expect(engine.run).toHaveBeenCalledTimes(1);
      expect(engine.organize).not.toHaveBeenCalled();
    });

    it('ignores a Stop that names another request', async () => {
      const planId = await planned();
      const reads = held<PassageSearchResult>();
      let signal: AbortSignal | undefined;
      engine.run.mockImplementationOnce((_plan, options?: PassageSearchRunOptions) => {
        signal = options?.signal;
        return reads.promise;
      });
      const run = send(MessageType.PASSAGE_SEARCH_RUN, { requestId: 'run-1', planId });
      await Promise.resolve();
      await send(MessageType.PASSAGE_SEARCH_STOP, { requestId: 'run-of-another-view' });
      expect(signal?.aborted).toBe(false);
      reads.resolve(aliceResult());
      await run;
    });

    it('refuses a second Run and a plan request while a search is running', async () => {
      const planId = await planned();
      const reads = held<PassageSearchResult>();
      engine.run.mockReturnValueOnce(reads.promise);
      const run = send(MessageType.PASSAGE_SEARCH_RUN, { requestId: 'run-1', planId });
      await Promise.resolve();

      await send(MessageType.PASSAGE_SEARCH_RUN, { requestId: 'run-2', planId });
      await planRequest('plan-2');
      expect(results()).toEqual([{ requestId: 'run-2', status: 'refused', reason: 'busy', message: PASSAGE_SEARCH_ROUTE_WORDS.busy }]);
      expect(plans().find((plan) => plan.requestId === 'plan-2')).toMatchObject({ status: 'refused', reason: 'busy' });
      expect(engine.plan).toHaveBeenCalledTimes(1);
      reads.resolve(aliceResult());
      await run;
      expect(engine.run).toHaveBeenCalledTimes(1);
    });
  });

  describe('refusals in host words', () => {
    it('passes on the engine\'s refusal and holds no plan', async () => {
      const refusal = passageSearchRefusal('too-many-files', 240);
      engine.plan.mockResolvedValueOnce({ kind: 'refused', refusal });
      await planRequest('plan-1');
      expect(plans()).toEqual([{ requestId: 'plan-1', status: 'refused', reason: 'too-many-files', message: refusal.message }]);
    });

    it('refuses a payload that is not a plan request, without asking the engine', async () => {
      await planRequest('plan-1', { scopes: { activeFile: 'yes' } });
      expect(engine.plan).not.toHaveBeenCalled();
      expect(plans()).toEqual([{ requestId: 'plan-1', status: 'refused', reason: 'malformed', message: PASSAGE_SEARCH_ROUTE_WORDS.malformed }]);
    });

    it('answers a planning failure without its message', async () => {
      engine.plan.mockRejectedValueOnce(new Error(`could not read ${ALICE_ABSOLUTE}`));
      await planRequest('plan-1');
      expect(plans()).toEqual([{ requestId: 'plan-1', status: 'refused', reason: 'plan-failed', message: PASSAGE_SEARCH_ROUTE_WORDS['plan-failed'] }]);
      expect(logs()).not.toContain('alice');
    });

    it('answers a run that throws, and holds no result', async () => {
      engine.run.mockRejectedValueOnce(new Error(`broke on "${ALICE_QUOTE}"`));
      await send(MessageType.PASSAGE_SEARCH_RUN, { requestId: 'run-1', planId: await planned() });
      expect(results()).toEqual([{ requestId: 'run-1', status: 'refused', reason: 'run-failed', message: PASSAGE_SEARCH_ROUTE_WORDS['run-failed'] }]);
      expect(logs()).not.toContain('waistcoat');
      // The route is free again.
      await send(MessageType.PASSAGE_SEARCH_RUN, { requestId: 'run-2', planId: await planned('plan-2') });
      expect(results()[1]).toMatchObject({ requestId: 'run-2', status: 'finished' });
    });

    it('ignores a request with no request id', async () => {
      await send(MessageType.PASSAGE_SEARCH_PLAN_REQUEST, { question: ALICE_QUESTION, scopes: SCOPES, organize: true });
      await send(MessageType.PASSAGE_SEARCH_RUN, { planId: 'plan-x-1' });
      expect(postMessage).not.toHaveBeenCalled();
      expect(engine.plan).not.toHaveBeenCalled();
    });
  });

  describe('open an instance', () => {
    const opens = () => posted<PassageSearchOpenInstanceResultPayload>(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE_RESULT);

    it('finds the file and line in the held result', async () => {
      const resultId = await finished();
      await send(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE, { requestId: 'open-1', resultId, instance: 1 });
      expect(openFileInEditor).toHaveBeenCalledWith(ALICE_ABSOLUTE, { line: 12 });
      expect(opens()).toEqual([{ requestId: 'open-1', status: 'opened' }]);
    });

    it('never reads a path the webview sends', async () => {
      const resultId = await finished();
      await send(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE, {
        requestId: 'open-1', resultId, instance: 1, path: '/etc/passwd', file: '/etc/passwd', absolutePath: '/etc/passwd'
      });
      expect(openFileInEditor).toHaveBeenCalledTimes(1);
      expect(openFileInEditor).toHaveBeenCalledWith(ALICE_ABSOLUTE, { line: 12 });

      await send(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE, { requestId: 'open-2', resultId, instance: '/etc/passwd' });
      expect(openFileInEditor).toHaveBeenCalledTimes(1);
      expect(opens()[1]).toEqual({ requestId: 'open-2', status: 'refused', message: PASSAGE_SEARCH_ROUTE_WORDS['no-instance'] });
    });

    it('refuses, in words, an instance with nothing to open', async () => {
      const resultId = await finished();
      await send(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE, { requestId: 'open-1', resultId, instance: 2 });
      expect(openFileInEditor).not.toHaveBeenCalled();
      expect(opens()).toEqual([{ requestId: 'open-1', status: 'refused', message: PASSAGE_SEARCH_ROUTE_WORDS['nothing-to-open'] }]);
    });

    it('opens a saved selection\'s file without a line when its lines are counted within the selection', async () => {
      const result = aliceResult();
      const resultId = await finished({
        ...result,
        files: { ...result.files, read: result.files.read.map((file) => (file.key === 'f2' ? { ...file, absolutePath: ALICE_ABSOLUTE } : file)) }
      });
      await send(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE, { requestId: 'open-1', resultId, instance: 2 });
      expect(openFileInEditor).toHaveBeenCalledWith(ALICE_ABSOLUTE, {});
    });

    it('refuses a result it no longer holds, and an instance that is not in it', async () => {
      const resultId = await finished();
      await send(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE, { requestId: 'open-1', resultId: 'result-of-another-day', instance: 1 });
      await send(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE, { requestId: 'open-2', resultId, instance: 99 });
      expect(openFileInEditor).not.toHaveBeenCalled();
      expect(opens()).toEqual([
        { requestId: 'open-1', status: 'refused', message: PASSAGE_SEARCH_ROUTE_WORDS['result-expired'] },
        { requestId: 'open-2', status: 'refused', message: PASSAGE_SEARCH_ROUTE_WORDS['no-instance'] }
      ]);
    });

    it('says so when the host cannot open the file, without the host\'s message', async () => {
      const resultId = await finished();
      openFileInEditor.mockRejectedValueOnce(new Error(`ENOENT ${ALICE_ABSOLUTE}`));
      await send(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE, { requestId: 'open-1', resultId, instance: 1 });
      expect(opens()).toEqual([{ requestId: 'open-1', status: 'refused', message: PASSAGE_SEARCH_ROUTE_WORDS['open-failed'] }]);
      expect(logs()).not.toContain('alice');
    });
  });

  describe('a view that closes', () => {
    it('aborts a running search and posts nothing more', async () => {
      const planId = await planned();
      const reads = held<PassageSearchResult>();
      let signal: AbortSignal | undefined;
      engine.run.mockImplementationOnce((_plan, options?: PassageSearchRunOptions) => {
        signal = options?.signal;
        return reads.promise;
      });
      const run = send(MessageType.PASSAGE_SEARCH_RUN, { requestId: 'run-1', planId });
      await Promise.resolve();
      postMessage.mockClear();

      route.dispose();
      expect(signal?.aborted).toBe(true);
      reads.resolve(aliceResult({ ended: 'stopped' }));
      await run;
      expect(postMessage).not.toHaveBeenCalled();
      expect(engine.planOrganize).not.toHaveBeenCalled();
    });
  });

  describe('logs', () => {
    it('carry ids, counts and fault kinds, never the writer\'s text', async () => {
      engine.planOrganize.mockResolvedValue({ kind: 'planned', plan: ORGANIZE_PLAN });
      engine.run.mockImplementationOnce(async (_plan, options?: PassageSearchRunOptions) => {
        options?.onProgress?.({ calls: { planned: 3, done: 1 }, found: 1 });
        return aliceResult({ ended: 'stopped' });
      });
      const resultId = await finished();
      await send(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE, { requestId: 'open-1', resultId, instance: 1 });
      await send(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE, { requestId: 'open-2', resultId, instance: 2 });
      await send(MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN_REQUEST, { requestId: 'organize-1', resultId });
      await send(MessageType.PASSAGE_SEARCH_RUN, { requestId: 'run-2', planId: 'stale' });

      const written = logs();
      expect(written).toContain('2 instance(s)');
      for (const secret of [ALICE_QUESTION, 'Rabbit', ALICE_QUOTE, 'waistcoat', ALICE_NOTE, ALICE_LABEL, 'alice', 'dodgson', PATTERN, 'looking-glass', 'Selected text']) {
        expect(written).not.toContain(secret);
      }
    });
  });
});

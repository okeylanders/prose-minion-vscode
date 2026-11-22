/**
 * "Organize these results" on the sidebar route (ADR 2026-11-20 D12a, D15):
 * offered only for a result whose reads were cut short, holding an instance,
 * when the engine can price a pass; then its own two-step press. The
 * organizer is a fake; Slice 3 builds the real pass.
 */

import { PASSAGE_SEARCH_ROUTE_WORDS } from '@/application/handlers/domain/PassageSearchRoute';
import { MessageType, PassageSearchOrganizePlanPayload } from '@messages';
import type { PassageSearchResult } from '@services/search/passage/PassageSearchContracts';
import {
  ORGANIZE_PLAN,
  aliceResult,
  passageSearchRouteHost,
  type FakePassageSearchEngine,
  type PassageSearchRouteHost
} from '@/__tests__/application/handlers/domain/passageSearchRouteHarness';

describe('PassageSearchRoute: organize these results', () => {
  let host: PassageSearchRouteHost;
  let engine: FakePassageSearchEngine;

  beforeEach(() => {
    host = passageSearchRouteHost();
    ({ engine } = host);
  });

  const send = (type: MessageType, payload: unknown) => host.send(type, payload);
  const results = () => host.results();
  const finished = (result?: PassageSearchResult) => host.finished(result);
  const organizePlans = () => host.posted<PassageSearchOrganizePlanPayload>(MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN);
  const stopped = () => aliceResult({ ended: 'stopped', calls: { planned: 3, answered: 1, failed: 0, cut: 0, cancelled: 0, unsent: 2, tooLarge: 0, dispatched: 1 } });
  const withOrganizer = () => {
    engine.organizerAvailable.mockReturnValue(true);
    engine.planOrganize.mockResolvedValue({ kind: 'planned', plan: ORGANIZE_PLAN });
  };
  const canOrganize = () => {
    const answer = results().find((found) => found.requestId === 'run-1');
    return answer?.status === 'finished' ? answer.result.canOrganize : undefined;
  };

  it('is offered for a stopped result that holds an instance, when the engine has an organizer, and prices nothing to decide', async () => {
    withOrganizer();
    await finished(stopped());
    expect(canOrganize()).toBe(true);
    expect(engine.planOrganize).not.toHaveBeenCalled();
  });

  it('keeps the action on a key-changed result even when a pass could not be priced right now', async () => {
    engine.organizerAvailable.mockReturnValue(true);
    engine.planOrganize.mockRejectedValue(new Error('no key'));
    await finished(aliceResult({ ended: 'key-changed' }));
    expect(canOrganize()).toBe(true);
  });

  it.each(['key-changed', 'provider-failed'] as const)('is offered for a %s result', async (ended) => {
    withOrganizer();
    await finished(aliceResult({ ended }));
    expect(canOrganize()).toBe(true);
  });

  it('is not offered when the engine has no organizer, and a request for it is refused in words', async () => {
    const resultId = await finished(stopped());
    expect(canOrganize()).toBe(false);
    await send(MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN_REQUEST, { requestId: 'organize-1', resultId });
    expect(organizePlans()).toEqual([{ requestId: 'organize-1', status: 'refused', reason: 'cannot-organize', message: PASSAGE_SEARCH_ROUTE_WORDS['cannot-organize'] }]);
  });

  it('is not offered for a complete result, and prices nothing', async () => {
    withOrganizer();
    await finished(aliceResult());
    expect(canOrganize()).toBe(false);
    expect(engine.planOrganize).not.toHaveBeenCalled();
  });

  it('is not offered for a stopped result with no instance', async () => {
    withOrganizer();
    await finished({ ...stopped(), instances: [], labels: [] });
    expect(canOrganize()).toBe(false);
  });

  it('prices the pass, then makes exactly that pass and posts the organized result', async () => {
    withOrganizer();
    const result = stopped();
    const resultId = await finished(result);
    await send(MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN_REQUEST, { requestId: 'organize-1', resultId });
    const [priced] = organizePlans();
    expect(priced).toEqual({
      requestId: 'organize-1',
      status: 'planned',
      resultId,
      organizePlanId: expect.any(String),
      estimate: { model: 'test/reader', calls: 1, inputTokens: 900, outputTokens: 1200, usd: 0.03, instances: { read: 2, of: 2 } }
    });
    expect(engine.organize).not.toHaveBeenCalled();
    if (priced.status !== 'planned') {
      throw new Error('expected an organize plan');
    }

    const analysis = {
      headline: 'The Rabbit keeps checking the time',
      sections: [{ title: 'Hurry', claims: [{ text: 'He consults the watch as he runs.', cites: [1] }] }],
      read: { instances: 2, of: 2 },
      dropped: { claims: 0, uncited: 0, misquoted: 0, malformed: 0, sections: 0, cites: 0 },
      replaced: { headline: false, titles: 0 },
      clipped: 0
    };
    engine.organize.mockResolvedValueOnce({ ...result, analysis });
    await send(MessageType.PASSAGE_SEARCH_ORGANIZE_RUN, { requestId: 'organize-run-1', resultId, organizePlanId: priced.organizePlanId });

    expect(engine.organize).toHaveBeenCalledWith(result, ORGANIZE_PLAN, { signal: expect.any(Object) });
    const organized = results().find((found) => found.requestId === 'organize-run-1');
    expect(organized).toMatchObject({ status: 'finished', result: { analysis, canOrganize: false, ended: 'stopped' } });
  });

  it('posts the analysis\'s own counts, and says why a pass that answered left no analysis', async () => {
    withOrganizer();
    const result = stopped();
    const resultId = await finished(result);
    const run = async (requestId: string, of: string, organized: typeof result) => {
      await send(MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN_REQUEST, { requestId: `plan-${requestId}`, resultId: of });
      const priced = organizePlans().find((found) => found.requestId === `plan-${requestId}`);
      if (priced?.status !== 'planned') {
        throw new Error('expected an organize plan');
      }
      engine.organize.mockResolvedValueOnce(organized);
      await send(MessageType.PASSAGE_SEARCH_ORGANIZE_RUN, { requestId, resultId: of, organizePlanId: priced.organizePlanId });
      return results().find((found) => found.requestId === requestId);
    };
    // The reply was read and nothing in it could be checked: the list stays, the reason is shown, and the pass is still on offer.
    const unkept = await run('organize-run-1', resultId, { ...result, analysisMissing: 'nothing-kept' });
    expect(unkept)
      .toMatchObject({ status: 'finished', result: { analysisMissing: 'nothing-kept', canOrganize: true, ended: 'stopped' } });
    const analysis = {
      headline: '2 instances in 1 file',
      sections: [{ title: 'Group 1', claims: [{ text: 'He consults the watch as he runs.', cites: [1] }] }],
      read: { instances: 1, of: 2 },
      dropped: { claims: 3, uncited: 1, misquoted: 2, malformed: 0, sections: 1, cites: 4 },
      replaced: { headline: true, titles: 1 },
      clipped: 1
    };
    // The organized result is a new one, with its own id: the pass is asked for again by that id.
    const again = unkept?.status === 'finished' ? unkept.result.resultId : resultId;
    expect(await run('organize-run-2', again, { ...result, analysis }))
      .toMatchObject({ status: 'finished', result: { analysis, canOrganize: false } });
  });

  it('refuses an organizing run that names another plan or result, and makes no call', async () => {
    withOrganizer();
    const resultId = await finished(stopped());
    await send(MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN_REQUEST, { requestId: 'organize-1', resultId });
    await send(MessageType.PASSAGE_SEARCH_ORGANIZE_RUN, { requestId: 'organize-run-1', resultId, organizePlanId: 'organize-of-another-day' });
    await send(MessageType.PASSAGE_SEARCH_ORGANIZE_RUN, { requestId: 'organize-run-2', resultId: 'result-of-another-day', organizePlanId: 'x' });
    expect(engine.organize).not.toHaveBeenCalled();
    expect(results().slice(1).map((found) => found.status === 'refused' && found.reason)).toEqual(['plan-expired', 'plan-expired']);
  });

  it('passes on the engine\'s words when a pass cannot be priced after all', async () => {
    engine.organizerAvailable.mockReturnValue(true);
    const resultId = await finished(stopped());
    engine.planOrganize.mockResolvedValueOnce({ kind: 'unavailable', message: 'Organizing the results is not available yet.' });
    await send(MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN_REQUEST, { requestId: 'organize-1', resultId });
    expect(organizePlans()).toEqual([{ requestId: 'organize-1', status: 'refused', reason: 'unavailable', message: 'Organizing the results is not available yet.' }]);
  });
});

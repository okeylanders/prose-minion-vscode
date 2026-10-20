/**
 * Seed delivery (PR #150 F-03): a seed is sent once to the panel that
 * accepted it, opens only on a granted claim, and a seed that timed out, was
 * replaced or lost its panel is denied, even when its message was already
 * sent. A granted seed is past revoking: a newer seed waits for its answer.
 */
import {
  WORKSHOP_SEED_TIMEOUT_MS,
  WorkshopSeedDelivery
} from '@/application/services/workshop/WorkshopSeedDelivery';
import type { WorkshopSeedClaimResultPayload, WorkshopSeedOutcome } from '@messages';

type Panel = { name: string; ready: boolean };

function createDelivery() {
  const results: Array<{ panel: Panel; result: WorkshopSeedClaimResultPayload }> = [];
  let minted = 0;
  const delivery = new WorkshopSeedDelivery<Panel>('lexical-gravity-build', {
    isReady: (panel) => panel.ready,
    postClaimResult: (panel, result) => results.push({ panel, result })
  }, { mintDeliveryId: () => `seed-${++minted}` });
  const sent: string[] = [];
  const outcomes: Record<string, WorkshopSeedOutcome | undefined> = {};
  const offer = (panel: Panel, name: string) => {
    void delivery.offer(panel, (deliveryId) => sent.push(`${name}:${deliveryId}`)).then((outcome) => {
      outcomes[name] = outcome;
    });
  };
  return { delivery, results, sent, outcomes, offer };
}

const settle = () => Promise.resolve().then(() => undefined);

describe('WorkshopSeedDelivery', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends a seed once to a ready panel, grants its claim and settles on the answer', async () => {
    const { delivery, results, sent, outcomes, offer } = createDelivery();
    const panel = { name: 'one', ready: false };
    offer(panel, 'A');
    expect(sent).toEqual([]);
    panel.ready = true;
    delivery.deliver(panel);
    delivery.deliver(panel);
    expect(sent).toEqual(['A:seed-1']);

    delivery.claim(panel, 'seed-1');
    expect(results.map(({ result }) => result)).toEqual([{ kind: 'lexical-gravity-build', deliveryId: 'seed-1', granted: true }]);
    delivery.answer(panel, { deliveryId: 'seed-1', opened: true });
    await settle();
    expect(outcomes.A).toEqual({ opened: true });
  });

  it('denies the claim of a seed that timed out after it was sent', async () => {
    jest.useFakeTimers();
    const { delivery, results, sent, outcomes, offer } = createDelivery();
    const panel = { name: 'one', ready: true };
    offer(panel, 'A');
    expect(sent).toEqual(['A:seed-1']);
    jest.advanceTimersByTime(WORKSHOP_SEED_TIMEOUT_MS);
    await settle();
    expect(outcomes.A).toEqual({ opened: false, reason: 'timeout' });

    delivery.claim(panel, 'seed-1');
    expect(results.at(-1)?.result).toEqual({ kind: 'lexical-gravity-build', deliveryId: 'seed-1', granted: false, reason: 'timeout' });
  });

  it('denies the claim of a replaced seed that was already sent, and grants the newer one', async () => {
    const { delivery, results, sent, outcomes, offer } = createDelivery();
    const panel = { name: 'one', ready: true };
    offer(panel, 'A');
    offer(panel, 'B');
    await settle();
    expect(outcomes.A).toEqual({ opened: false, reason: 'replaced' });
    expect(sent).toEqual(['A:seed-1', 'B:seed-2']);

    // Claims arrive in the order the seeds did.
    delivery.claim(panel, 'seed-1');
    delivery.claim(panel, 'seed-2');
    expect(results.map(({ result }) => result)).toEqual([
      { kind: 'lexical-gravity-build', deliveryId: 'seed-1', granted: false, reason: 'replaced' },
      { kind: 'lexical-gravity-build', deliveryId: 'seed-2', granted: true }
    ]);
  });

  it('cannot revoke a grant: a newer seed waits for the answer, then is sent, and the grant never times out', async () => {
    jest.useFakeTimers();
    const { delivery, results, sent, outcomes, offer } = createDelivery();
    const panel = { name: 'one', ready: true };
    offer(panel, 'A');
    delivery.claim(panel, 'seed-1');
    offer(panel, 'B');
    expect(sent).toEqual(['A:seed-1']);
    jest.advanceTimersByTime(WORKSHOP_SEED_TIMEOUT_MS - 1);
    await settle();
    expect(outcomes.A).toBeUndefined();

    delivery.answer(panel, { deliveryId: 'seed-1', opened: true });
    await settle();
    expect(outcomes.A).toEqual({ opened: true });
    expect(sent).toEqual(['A:seed-1', 'B:seed-2']);
    delivery.claim(panel, 'seed-2');
    delivery.answer(panel, { deliveryId: 'seed-2', opened: false, reason: 'busy' });
    await settle();
    expect(outcomes.B).toEqual({ opened: false, reason: 'busy' });
    expect(results.every(({ result }) => result.granted)).toBe(true);
  });

  it('times out a seed still waiting behind a granted one, and never sends it', async () => {
    jest.useFakeTimers();
    const { delivery, sent, outcomes, offer } = createDelivery();
    const panel = { name: 'one', ready: true };
    offer(panel, 'A');
    delivery.claim(panel, 'seed-1');
    offer(panel, 'B');
    jest.advanceTimersByTime(WORKSHOP_SEED_TIMEOUT_MS);
    await settle();
    expect(outcomes.B).toEqual({ opened: false, reason: 'timeout' });
    delivery.answer(panel, { deliveryId: 'seed-1', opened: true });
    expect(sent).toEqual(['A:seed-1']);
  });

  it('closes what it holds, waiting or granted, and denies their late claims as closed', async () => {
    const { delivery, results, outcomes, offer } = createDelivery();
    const panel = { name: 'one', ready: true };
    offer(panel, 'A');
    delivery.claim(panel, 'seed-1');
    offer(panel, 'B');
    delivery.close();
    await settle();
    expect(outcomes.A).toEqual({ opened: false, reason: 'closed' });
    expect(outcomes.B).toEqual({ opened: false, reason: 'closed' });

    delivery.answer(panel, { deliveryId: 'seed-1', opened: true });
    delivery.claim(panel, 'seed-2');
    expect(results.at(-1)?.result).toEqual({ kind: 'lexical-gravity-build', deliveryId: 'seed-2', granted: false, reason: 'closed' });
  });

  it('answers only for the panel and delivery it granted, and denies a claim it never sent', async () => {
    const { delivery, results, outcomes, offer } = createDelivery();
    const panel = { name: 'one', ready: true };
    const other = { name: 'two', ready: true };
    offer(panel, 'A');
    delivery.claim(other, 'seed-1');
    delivery.claim(panel, 'seed-9');
    expect(results.map(({ result }) => result.granted)).toEqual([false, false]);
    expect(results[1].result).toMatchObject({ reason: 'unknown' });

    delivery.claim(panel, 'seed-1');
    delivery.answer(other, { deliveryId: 'seed-1', opened: true });
    delivery.answer(panel, { deliveryId: 'seed-2', opened: true });
    await settle();
    expect(outcomes.A).toBeUndefined();
    delivery.answer(panel, { deliveryId: 'seed-1', opened: true });
    await settle();
    expect(outcomes.A).toEqual({ opened: true });
  });
});

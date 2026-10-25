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

  describe('receivers (PR #150 F-08)', () => {
    /** A panel whose webview realm announces itself; `receiver` changes when the webview is replaced. */
    type ReceivingPanel = Panel & { receiver?: string };
    function createReceivingDelivery() {
      const results: Array<{ panel: ReceivingPanel; result: WorkshopSeedClaimResultPayload }> = [];
      let minted = 0;
      const delivery = new WorkshopSeedDelivery<ReceivingPanel>('lightbox-tile', {
        isReady: (panel) => panel.ready && panel.receiver !== undefined,
        postClaimResult: (panel, result) => results.push({ panel, result }),
        receiverOf: (panel) => panel.receiver
      }, { mintDeliveryId: () => `tile-${++minted}` });
      const sent: string[] = [];
      const outcomes: Record<string, WorkshopSeedOutcome | undefined> = {};
      const offer = (panel: ReceivingPanel, name: string) => {
        void delivery.offer(panel, (deliveryId) => sent.push(`${name}:${deliveryId}@${panel.receiver}`)).then((outcome) => {
          outcomes[name] = outcome;
        });
      };
      /** The webview is replaced: the panel stays, its receiver is new. */
      const reload = (panel: ReceivingPanel, receiver: string) => {
        panel.receiver = receiver;
        delivery.resetReceiver(panel);
      };
      return { delivery, results, sent, outcomes, offer, reload };
    }

    it('waits for a receiver, and grants a claim only from the receiver the seed was sent to', async () => {
      const { delivery, results, sent, outcomes, offer } = createReceivingDelivery();
      const panel: ReceivingPanel = { name: 'one', ready: true };
      offer(panel, 'A');
      expect(sent).toEqual([]);
      panel.receiver = 'r1';
      delivery.resetReceiver(panel);
      expect(sent).toEqual(['A:tile-1@r1']);

      delivery.claim(panel, 'tile-1', 'r0');
      expect(results).toEqual([]);
      delivery.claim(panel, 'tile-1', 'r1');
      expect(results.map(({ result }) => result.granted)).toEqual([true]);
      delivery.answer(panel, { deliveryId: 'tile-1', opened: true }, 'r0');
      await settle();
      expect(outcomes.A).toBeUndefined();
      delivery.answer(panel, { deliveryId: 'tile-1', opened: true }, 'r1');
      await settle();
      expect(outcomes.A).toEqual({ opened: true });
    });

    it('reload after claim: settles the old grant as reset, sends the seed that waited behind it, and ignores the old receiver', async () => {
      const { delivery, results, sent, outcomes, offer, reload } = createReceivingDelivery();
      const panel: ReceivingPanel = { name: 'one', ready: true, receiver: 'r1' };
      offer(panel, 'A');
      delivery.claim(panel, 'tile-1', 'r1');
      offer(panel, 'B');
      // B waits behind A's grant: the grant cannot be revoked while its receiver lives.
      expect(sent).toEqual(['A:tile-1@r1']);

      reload(panel, 'r2');
      await settle();
      expect(outcomes.A).toEqual({ opened: false, reason: 'reset' });
      expect(sent).toEqual(['A:tile-1@r1', 'B:tile-2@r2']);

      // The old receiver's late answer and claim change nothing.
      delivery.answer(panel, { deliveryId: 'tile-1', opened: true }, 'r1');
      delivery.claim(panel, 'tile-2', 'r1');
      await settle();
      expect(outcomes.A).toEqual({ opened: false, reason: 'reset' });
      expect(results).toHaveLength(1);

      // A claim of A from the new receiver is denied as reset; B is the new receiver's.
      delivery.claim(panel, 'tile-1', 'r2');
      expect(results.at(-1)?.result).toEqual({ kind: 'lightbox-tile', deliveryId: 'tile-1', granted: false, reason: 'reset' });
      delivery.claim(panel, 'tile-2', 'r2');
      delivery.answer(panel, { deliveryId: 'tile-2', opened: false, reason: 'duplicate' }, 'r2');
      await settle();
      expect(outcomes.B).toEqual({ opened: false, reason: 'duplicate' });
    });

    it('reload after an unclaimed send: sends the seed again to the new receiver, under its first deadline', async () => {
      jest.useFakeTimers();
      const { delivery, results, sent, outcomes, offer, reload } = createReceivingDelivery();
      const panel: ReceivingPanel = { name: 'one', ready: true, receiver: 'r1' };
      offer(panel, 'A');
      reload(panel, 'r2');
      expect(sent).toEqual(['A:tile-1@r1', 'A:tile-1@r2']);
      delivery.claim(panel, 'tile-1', 'r1');
      expect(results).toEqual([]);

      jest.advanceTimersByTime(WORKSHOP_SEED_TIMEOUT_MS);
      await settle();
      expect(outcomes.A).toEqual({ opened: false, reason: 'timeout' });
    });

    it('says a delivery is granted only while it is opening for the receiver the panel has now (PR #151 F-06)', async () => {
      const { delivery, offer, reload } = createReceivingDelivery();
      const panel: ReceivingPanel = { name: 'one', ready: true, receiver: 'r1' };
      const other: ReceivingPanel = { name: 'two', ready: true, receiver: 'r1' };
      offer(panel, 'A');
      // Sent but not claimed: not granted.
      expect(delivery.isGranted(panel, 'tile-1', 'r1')).toBe(false);
      delivery.claim(panel, 'tile-1', 'r1');
      expect(delivery.isGranted(panel, 'tile-1', 'r1')).toBe(true);
      expect(delivery.isGranted(panel, 'tile-1', 'r0')).toBe(false);
      expect(delivery.isGranted(panel, 'tile-2', 'r1')).toBe(false);
      expect(delivery.isGranted(other, 'tile-1', 'r1')).toBe(false);
      // Reset: the old receiver's grant is settled, and nobody holds it.
      reload(panel, 'r2');
      await settle();
      expect(delivery.isGranted(panel, 'tile-1', 'r1')).toBe(false);
      expect(delivery.isGranted(panel, 'tile-1', 'r2')).toBe(false);

      offer(panel, 'B');
      delivery.claim(panel, 'tile-2', 'r2');
      expect(delivery.isGranted(panel, 'tile-2', 'r2')).toBe(true);
      delivery.answer(panel, { deliveryId: 'tile-2', opened: true }, 'r2');
      expect(delivery.isGranted(panel, 'tile-2', 'r2')).toBe(false);

      offer(panel, 'C');
      delivery.claim(panel, 'tile-3', 'r2');
      delivery.close();
      expect(delivery.isGranted(panel, 'tile-3', 'r2')).toBe(false);
    });

    it('keeps each kind\'s grants its own (PR #151 F-06)', () => {
      const panel: ReceivingPanel = { name: 'one', ready: true, receiver: 'r1' };
      const ports = {
        isReady: () => true,
        postClaimResult: () => undefined,
        receiverOf: (recipient: ReceivingPanel) => recipient.receiver
      };
      const build = new WorkshopSeedDelivery<ReceivingPanel>('lexical-gravity-build', ports, { mintDeliveryId: () => 'same-id' });
      const tiles = new WorkshopSeedDelivery<ReceivingPanel>('lightbox-tile', ports, { mintDeliveryId: () => 'same-id' });
      void build.offer(panel, () => undefined);
      void tiles.offer(panel, () => undefined);
      build.claim(panel, 'same-id', 'r1');
      expect(build.isGranted(panel, 'same-id', 'r1')).toBe(true);
      expect(tiles.isGranted(panel, 'same-id', 'r1')).toBe(false);
      tiles.claim(panel, 'same-id', 'r1');
      build.answer(panel, { deliveryId: 'same-id', opened: true }, 'r1');
      expect(build.isGranted(panel, 'same-id', 'r1')).toBe(false);
      expect(tiles.isGranted(panel, 'same-id', 'r1')).toBe(true);
      tiles.close();
      build.close();
    });

    it('leaves a grant to the current receiver alone when that receiver announces itself again', async () => {
      const { delivery, outcomes, offer } = createReceivingDelivery();
      const panel: ReceivingPanel = { name: 'one', ready: true, receiver: 'r1' };
      offer(panel, 'A');
      delivery.claim(panel, 'tile-1', 'r1');
      delivery.resetReceiver(panel);
      await settle();
      expect(outcomes.A).toBeUndefined();
      delivery.answer(panel, { deliveryId: 'tile-1', opened: true }, 'r1');
      await settle();
      expect(outcomes.A).toEqual({ opened: true });
    });
  });
});

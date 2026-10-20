/**
 * WorkshopSeedDelivery — one Workshop panel's handoffs of one seed kind,
 * from offer to the webview's answer (PR #150 F-03; ADR 2026-10-19 D11).
 *
 * Host-agnostic: the recipient is whatever the host uses for a panel, and
 * the host says when one is ready and how to post to its webview. The panel
 * provider owns one per seed kind; nothing here touches session state.
 *
 * A seed lives in one of two slots:
 *
 * - **Waiting.** Offered and not yet claimed. It is sent once, to the panel
 *   that accepted it, when that panel is ready (current, listening, visible)
 *   and no granted seed is still opening there. A newer offer replaces it,
 *   its deadline times it out, and the panel closing closes it; each settles
 *   the sender's promise and is remembered, so a claim that arrives later,
 *   because its message was already on its way, is denied and the webview
 *   drops the seed. That is the guarantee: a seed that timed out, was
 *   replaced or lost its panel can never open.
 * - **Opening.** Its claim was granted. The grant is the commit point: it
 *   cannot be revoked once posted, so the seed is no longer replaced or
 *   timed out, and a newer offer waits until the webview answers (opened, or
 *   busy over a sheet the writer is using) or the panel closes. A newer offer
 *   that waits still has its own deadline.
 */

import type {
  WorkshopSeedAnswer,
  WorkshopSeedClaimDenial,
  WorkshopSeedClaimResultPayload,
  WorkshopSeedKind,
  WorkshopSeedOutcome
} from '@messages';

/** How long an offered seed waits to be claimed before its sender is told it timed out. */
export const WORKSHOP_SEED_TIMEOUT_MS = 20_000;

/** How many settled delivery ids are remembered, to say why a late claim is denied. */
const REMEMBERED_SETTLEMENTS = 16;

export interface WorkshopSeedDeliveryPorts<TRecipient> {
  /** Whether `recipient` can take a seed now: the current panel, its webview listening, its tab visible. */
  isReady(recipient: TRecipient): boolean;
  /** Post a claim's result to `recipient`'s webview. */
  postClaimResult(recipient: TRecipient, result: WorkshopSeedClaimResultPayload): void;
}

export interface WorkshopSeedDeliveryOptions {
  timeoutMs?: number;
  /** Mints a delivery id; ids must be unique per instance and at most 80 characters. */
  mintDeliveryId?: () => string;
}

interface Waiting<TRecipient> {
  deliveryId: string;
  recipient: TRecipient;
  send: (deliveryId: string) => void;
  sent: boolean;
  settle: (outcome: WorkshopSeedOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface Opening<TRecipient> {
  deliveryId: string;
  recipient: TRecipient;
  settle: (outcome: WorkshopSeedOutcome) => void;
}

export class WorkshopSeedDelivery<TRecipient> {
  private waiting?: Waiting<TRecipient>;
  private opening?: Opening<TRecipient>;
  private readonly settled = new Map<string, WorkshopSeedClaimDenial>();
  private offers = 0;

  constructor(
    private readonly kind: WorkshopSeedKind,
    private readonly ports: WorkshopSeedDeliveryPorts<TRecipient>,
    private readonly options: WorkshopSeedDeliveryOptions = {}
  ) {}

  /**
   * Offer a seed to `recipient`. `send` routes it through the recipient's own
   * message path with the delivery id, once, when it can be delivered. The
   * promise settles with the webview's answer, or why the seed did not open.
   */
  offer(recipient: TRecipient, send: (deliveryId: string) => void): Promise<WorkshopSeedOutcome> {
    this.settleWaiting('replaced');
    const deliveryId = this.options.mintDeliveryId?.() ?? `${this.kind}-${Date.now()}-${++this.offers}`;
    return new Promise((settle) => {
      this.waiting = {
        deliveryId,
        recipient,
        send,
        sent: false,
        settle,
        timer: setTimeout(() => this.settleWaiting('timeout', deliveryId), this.options.timeoutMs ?? WORKSHOP_SEED_TIMEOUT_MS)
      };
      this.deliver(recipient);
    });
  }

  /** Send the waiting seed if `recipient` accepted it, is ready, and no granted seed is still opening there. */
  deliver(recipient: TRecipient): void {
    const waiting = this.waiting;
    if (!waiting || waiting.sent || waiting.recipient !== recipient || this.opening || !this.ports.isReady(recipient)) {
      return;
    }
    waiting.sent = true;
    waiting.send(waiting.deliveryId);
  }

  /** The webview asks to open a seed: granted only for the waiting seed it was sent, else denied with why. */
  claim(recipient: TRecipient, deliveryId: string): void {
    const waiting = this.waiting;
    if (waiting && waiting.deliveryId === deliveryId && waiting.recipient === recipient && waiting.sent && !this.opening) {
      clearTimeout(waiting.timer);
      this.waiting = undefined;
      this.opening = { deliveryId, recipient, settle: waiting.settle };
      this.ports.postClaimResult(recipient, { kind: this.kind, deliveryId, granted: true });
      return;
    }
    this.ports.postClaimResult(recipient, {
      kind: this.kind,
      deliveryId,
      granted: false,
      reason: this.settled.get(deliveryId) ?? 'unknown'
    });
  }

  /** The webview's answer to the seed it was granted; anything else is ignored. */
  answer(recipient: TRecipient, answer: WorkshopSeedAnswer): void {
    const opening = this.opening;
    if (!opening || opening.recipient !== recipient || opening.deliveryId !== answer.deliveryId) {
      return;
    }
    this.opening = undefined;
    opening.settle(answer.opened ? { opened: true } : { opened: false, reason: answer.reason });
    // A newer seed waited for this one to settle.
    this.deliver(recipient);
  }

  /** The panel closed or was replaced, or the host is shutting down: nothing held here can open any more. */
  close(): void {
    this.settleWaiting('closed');
    const opening = this.opening;
    if (opening) {
      this.opening = undefined;
      this.remember(opening.deliveryId, 'closed');
      opening.settle({ opened: false, reason: 'closed' });
    }
  }

  /** Settle the waiting seed (the one named, when `deliveryId` is given) and remember why. */
  private settleWaiting(reason: 'replaced' | 'timeout' | 'closed', deliveryId?: string): void {
    const waiting = this.waiting;
    if (!waiting || (deliveryId !== undefined && waiting.deliveryId !== deliveryId)) {
      return;
    }
    this.waiting = undefined;
    clearTimeout(waiting.timer);
    this.remember(waiting.deliveryId, reason);
    waiting.settle({ opened: false, reason });
  }

  private remember(deliveryId: string, reason: WorkshopSeedClaimDenial): void {
    this.settled.set(deliveryId, reason);
    if (this.settled.size > REMEMBERED_SETTLEMENTS) {
      const oldest = this.settled.keys().next().value;
      if (oldest !== undefined) {
        this.settled.delete(oldest);
      }
    }
  }
}

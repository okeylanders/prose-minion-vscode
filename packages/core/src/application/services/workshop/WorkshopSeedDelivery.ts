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
 *   refused: busy over a sheet the writer is using, or a staged tile's
 *   full or duplicate), the panel closes, or its receiver resets. A newer
 *   offer that waits still has its own deadline.
 *
 * **Receivers (PR #150 F-08).** The webview inside a panel can be replaced
 * without the panel closing (Developer: Reload Webview, or a reload after a
 * render failure). Each webview realm announces itself with a receiver id,
 * and every claim and answer names it. A seed is sent to the receiver the
 * host knows at that moment, and granted only to that receiver's claim.
 * When a new receiver announces itself on the same panel, the old one is
 * gone: a seed granted to it settles as `reset` (nothing can answer for it
 * any more) and frees the slot, a seed sent to it but not claimed is sent
 * again to the new one, still under its own deadline, and a late claim or
 * answer from the old receiver is ignored. A grant made to the current
 * receiver is never touched. So the post-grant wait is bounded by an
 * answer, the panel closing, or a receiver reset; the deadline covers
 * unclaimed offers only.
 *
 * **Acting on a grant (PR #151 F-06).** A seed whose follow-up changes
 * session state (a tile's accept, which stages it) is acted on only while
 * `isGranted` holds: the seed is opening, for this panel, under the receiver
 * that sends the follow-up, and the panel still has that receiver. A late
 * follow-up from a receiver that was reset, and one for a seed never
 * granted, change nothing.
 *
 * **Visibility.** Readiness (current, listening, visible) is checked when a
 * seed is sent, not when its claim is granted: the guarantee is "visible at
 * dispatch". A tab the writer hides between the two still holds a running
 * webview that may open the seed (a sheet, or a staged pill) and answer; the
 * writer finds it there on return, and nothing reaches a model or is saved
 * without their action.
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
  /** The receiver (webview realm) `recipient` has now, as it announced itself; undefined before it has. */
  receiverOf?(recipient: TRecipient): string | undefined;
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
  /** The receiver it was sent to. */
  sentTo?: string;
  settle: (outcome: WorkshopSeedOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface Opening<TRecipient> {
  deliveryId: string;
  recipient: TRecipient;
  /** The receiver whose claim was granted: only its answer counts. */
  receiver?: string;
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
    waiting.sentTo = this.ports.receiverOf?.(recipient);
    waiting.send(waiting.deliveryId);
  }

  /**
   * The webview asks to open a seed: granted only for the waiting seed sent
   * to this receiver, else denied with why. A claim from a receiver the
   * panel no longer has is ignored: nobody is there to read the answer.
   */
  claim(recipient: TRecipient, deliveryId: string, receiver?: string): void {
    if (!this.isCurrentReceiver(recipient, receiver)) {
      return;
    }
    const waiting = this.waiting;
    if (
      waiting
      && waiting.deliveryId === deliveryId
      && waiting.recipient === recipient
      && waiting.sent
      && waiting.sentTo === receiver
      && !this.opening
    ) {
      clearTimeout(waiting.timer);
      this.waiting = undefined;
      this.opening = { deliveryId, recipient, receiver, settle: waiting.settle };
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

  /** The webview's answer to the seed it was granted, from the receiver it was granted to; anything else is ignored. */
  answer(recipient: TRecipient, answer: WorkshopSeedAnswer, receiver?: string): void {
    const opening = this.opening;
    if (
      !opening
      || opening.recipient !== recipient
      || opening.deliveryId !== answer.deliveryId
      || opening.receiver !== receiver
    ) {
      return;
    }
    this.opening = undefined;
    opening.settle(answer.opened ? { opened: true } : { opened: false, reason: answer.reason });
    // A newer seed waited for this one to settle.
    this.deliver(recipient);
  }

  /**
   * `recipient` has a new receiver (`receiverOf`): its webview realm was
   * replaced while the panel stayed open (F-08). A seed granted to an older
   * receiver settles as `reset` and frees the slot; a seed sent to an older
   * receiver but never claimed is sent again, now, if the panel is ready.
   * A seed granted to the current receiver is untouched.
   */
  resetReceiver(recipient: TRecipient): void {
    const current = this.ports.receiverOf?.(recipient);
    const opening = this.opening;
    if (opening && opening.recipient === recipient && opening.receiver !== current) {
      this.opening = undefined;
      this.remember(opening.deliveryId, 'reset');
      opening.settle({ opened: false, reason: 'reset' });
    }
    const waiting = this.waiting;
    if (waiting && waiting.recipient === recipient && waiting.sent && waiting.sentTo !== current) {
      waiting.sent = false;
      waiting.sentTo = undefined;
    }
    this.deliver(recipient);
  }

  /** Whether `deliveryId` is granted, now, to `receiver` on `recipient`: its follow-up may act on it. */
  isGranted(recipient: TRecipient, deliveryId: string, receiver: string | undefined): boolean {
    const opening = this.opening;
    return opening !== undefined
      && opening.recipient === recipient
      && opening.deliveryId === deliveryId
      && opening.receiver === receiver
      && this.isCurrentReceiver(recipient, receiver);
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

  /** A claim or answer counts only from the receiver the panel has now (any, before one announced itself). */
  private isCurrentReceiver(recipient: TRecipient, receiver: string | undefined): boolean {
    return !this.ports.receiverOf || this.ports.receiverOf(recipient) === receiver;
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

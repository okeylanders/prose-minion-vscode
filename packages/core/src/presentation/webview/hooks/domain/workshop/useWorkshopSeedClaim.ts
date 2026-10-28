/**
 * The Workshop webview's side of seed delivery (PR #150 F-03): a seed handed
 * over from another tab is held, not opened, until the panel provider grants
 * its claim. A denied seed (timed out, replaced, or its panel gone) is
 * dropped without a word and without touching anything open. A granted one
 * is offered to the opening controller, which opens it or refuses it as
 * busy, and answers.
 *
 * Generic over the seed kind: each feature that accepts a handoff composes
 * one of these with its own `WorkshopSeedKind`, and the receiver id this
 * mount announced (`useWorkshopSeedReceiver`, F-08), which every claim and
 * answer names so the host can tell this webview from a reloaded one.
 */

import * as React from 'react';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import {
  MessageType,
  WorkshopSeedAnswer,
  WorkshopSeedClaimResultMessage,
  WorkshopSeedKind
} from '@messages';

/** A seed the provider granted, with the delivery id the answer names. */
export interface WorkshopGrantedSeed<TSeed> {
  deliveryId: string;
  seed: TSeed;
}

export interface WorkshopSeedClaimState<TSeed> {
  /** The granted seed, until the opening controller answers for it. */
  granted: WorkshopGrantedSeed<TSeed> | null;
}

export interface WorkshopSeedClaimActions<TSeed> {
  /** A seed arrived: hold it and claim it; nothing opens yet. */
  receive: (deliveryId: string, seed: TSeed) => void;
  /** The provider's answer to the claim; another kind's or another delivery's is ignored. */
  handleClaimResult: (message: WorkshopSeedClaimResultMessage) => void;
  /** Tell the provider whether the granted seed opened, and let it go. */
  answer: (answer: WorkshopSeedAnswer) => void;
}

export interface WorkshopSeedClaimPersistence {
  // A seed is transient: the host owns delivery, and nothing here is saved.
}

export type UseWorkshopSeedClaimReturn<TSeed> = WorkshopSeedClaimState<TSeed> &
  WorkshopSeedClaimActions<TSeed> & {
    persistedState: WorkshopSeedClaimPersistence;
  };

export function useWorkshopSeedClaim<TSeed>(
  kind: WorkshopSeedKind,
  receiver: string
): UseWorkshopSeedClaimReturn<TSeed> {
  const vscode = useVSCodeApi();
  // The seed being claimed. Messages arrive in order, so a newer seed
  // replaces an older one here, and the older one's claim result is ignored.
  const claiming = React.useRef<WorkshopGrantedSeed<TSeed>>();
  const [granted, setGranted] = React.useState<WorkshopGrantedSeed<TSeed> | null>(null);

  const post = React.useCallback((type: MessageType, payload: object) => {
    vscode.postMessage({ type, source: 'webview.workshop.seed-delivery', payload, timestamp: Date.now() });
  }, [vscode]);

  const receive = React.useCallback((deliveryId: string, seed: TSeed) => {
    claiming.current = { deliveryId, seed };
    post(MessageType.WORKSHOP_SEED_CLAIM, { kind, deliveryId, receiver });
  }, [kind, post, receiver]);

  const handleClaimResult = React.useCallback((message: WorkshopSeedClaimResultMessage) => {
    const result = message.payload;
    const held = claiming.current;
    if (result.kind !== kind || !held || held.deliveryId !== result.deliveryId) {
      return;
    }
    claiming.current = undefined;
    if (result.granted) {
      setGranted(held);
    }
  }, [kind]);

  const answer = React.useCallback((reply: WorkshopSeedAnswer) => {
    setGranted((current) => (current?.deliveryId === reply.deliveryId ? null : current));
    post(MessageType.WORKSHOP_SEED_ANSWER, { kind, ...reply, receiver });
  }, [kind, post, receiver]);

  return { granted, receive, handleClaimResult, answer, persistedState: {} };
}

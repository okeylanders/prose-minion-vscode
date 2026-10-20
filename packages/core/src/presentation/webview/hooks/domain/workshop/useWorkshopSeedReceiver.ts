/**
 * The Workshop webview as a seed receiver (PR #150 F-08).
 *
 * A grant cannot be revoked, so the host must know when the webview that
 * was granted a seed is gone. A panel's webview can be replaced while the
 * panel stays open (Developer: Reload Webview, or a reload after a render
 * failure), and a fresh webview remembers no claim. So each mount mints a
 * receiver id and announces it once its listeners are attached
 * (`WORKSHOP_SEED_RECEIVER`); every claim and answer names it
 * (`useWorkshopSeedClaim`). The panel provider sends seeds only after an
 * announcement, and a new receiver on the same panel releases what the old
 * one held.
 *
 * Compose this before any seed-claiming hook, and pass its `receiver` to
 * them. The announcement is a mount effect: React runs every mount effect
 * of the Workshop in one pass, so the message listener is attached before
 * the host can answer it.
 */

import * as React from 'react';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { MessageType, WorkshopSeedReceiverMessage } from '@messages';

export interface WorkshopSeedReceiverState {
  /** This mount's receiver id. */
  receiver: string;
}

/** None: the announcement is the mount's own. */
export interface WorkshopSeedReceiverActions {
  // The receiver acts only on mount.
}

export interface WorkshopSeedReceiverPersistence {
  // A receiver lives as long as its mount; nothing is saved.
}

export type UseWorkshopSeedReceiverReturn = WorkshopSeedReceiverState & WorkshopSeedReceiverActions & {
  persistedState: WorkshopSeedReceiverPersistence;
};

/** A receiver id: unique enough to tell one mount from the next on the same panel; never a secret. */
export function mintWorkshopSeedReceiver(): string {
  return `receiver-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useWorkshopSeedReceiver(): UseWorkshopSeedReceiverReturn {
  const vscode = useVSCodeApi();
  const [receiver] = React.useState(mintWorkshopSeedReceiver);

  React.useEffect(() => {
    const message: WorkshopSeedReceiverMessage = {
      type: MessageType.WORKSHOP_SEED_RECEIVER,
      source: 'webview.workshop.seed-delivery',
      payload: { receiver },
      timestamp: Date.now()
    };
    vscode.postMessage(message);
  }, [receiver, vscode]);

  return { receiver, persistedState: {} };
}

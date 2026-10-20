/**
 * useWorkshopLightboxTiles — the Workshop webview's side of a Lightbox tile
 * handed over (ADR 2026-10-19 D11; Lightbox Slice 4), mirroring
 * `WorkshopLightboxTileHandler`.
 *
 * The host offers a tile (`WORKSHOP_LIGHTBOX_TILE_OFFERED`, a delivery id
 * only; the tile itself stays host-side). This hook claims it through the
 * seed protocol (`useWorkshopSeedClaim`, kind `lightbox-tile`); only on a
 * granted claim does it ask the host to stage it
 * (`WORKSHOP_ACCEPT_LIGHTBOX_TILE`, naming its receiver, which the provider
 * holds to the grant: PR #151 F-06), and it answers the provider with the
 * host's word (`WORKSHOP_LIGHTBOX_TILE_STAGED`): staged, or busy, full or
 * duplicate. A denied claim is dropped without a word.
 *
 * Staging opens no sheet and never touches the composer's draft, so it is
 * not refused while a Workshop overlay is open: the pill appears above the
 * composer, behind whatever is open, and the writer finds it on closing it.
 * The pill itself is session state, shown by the composer like any other
 * staged attachment.
 */

import * as React from 'react';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { useWorkshopSeedClaim } from '@hooks/domain/workshop/useWorkshopSeedClaim';
import {
  MessageType,
  WorkshopAcceptLightboxTileMessage,
  WorkshopLightboxTileOfferedMessage,
  WorkshopLightboxTileStagedMessage,
  WorkshopSeedClaimResultMessage
} from '@messages';

/** What the claim holds for a tile: its delivery id; the tile itself never leaves the host. */
interface WorkshopOfferedTile {
  deliveryId: string;
}

export interface WorkshopLightboxTilesState {
  /** The delivery the host was asked to stage, until it answers. */
  staging: string | null;
}

export interface WorkshopLightboxTilesActions {
  handleTileOffered: (message: WorkshopLightboxTileOfferedMessage) => void;
  handleSeedClaimResult: (message: WorkshopSeedClaimResultMessage) => void;
  handleTileStaged: (message: WorkshopLightboxTileStagedMessage) => void;
}

export interface WorkshopLightboxTilesPersistence {
  // A handoff is transient; a staged tile is session state, owned by the host.
}

export type UseWorkshopLightboxTilesReturn = WorkshopLightboxTilesState & WorkshopLightboxTilesActions & {
  persistedState: WorkshopLightboxTilesPersistence;
};

export interface UseWorkshopLightboxTilesOptions {
  /** This Workshop mount's seed receiver (`useWorkshopSeedReceiver`, PR #150 F-08). */
  seedReceiver: string;
}

const SOURCE = 'webview.workshop.lightbox-tile';

export function useWorkshopLightboxTiles({ seedReceiver }: UseWorkshopLightboxTilesOptions): UseWorkshopLightboxTilesReturn {
  const vscode = useVSCodeApi();
  const claims = useWorkshopSeedClaim<WorkshopOfferedTile>('lightbox-tile', seedReceiver);
  const [staging, setStaging] = React.useState<string | null>(null);
  const { granted, receive, handleClaimResult, answer } = claims;

  const handleTileOffered = React.useCallback((message: WorkshopLightboxTileOfferedMessage) => {
    const deliveryId = message.payload?.deliveryId;
    if (typeof deliveryId === 'string' && deliveryId.length > 0) {
      receive(deliveryId, { deliveryId });
    }
  }, [receive]);

  /** A granted tile: ask the host to stage it, once. */
  const requestStagingWhenGranted = React.useCallback(() => {
    if (!granted || staging === granted.deliveryId) {
      return;
    }
    setStaging(granted.deliveryId);
    const message: WorkshopAcceptLightboxTileMessage = {
      type: MessageType.WORKSHOP_ACCEPT_LIGHTBOX_TILE,
      source: SOURCE,
      payload: { deliveryId: granted.deliveryId, receiver: seedReceiver },
      timestamp: Date.now()
    };
    vscode.postMessage(message);
  }, [granted, seedReceiver, staging, vscode]);

  React.useEffect(() => {
    requestStagingWhenGranted();
  }, [requestStagingWhenGranted]);

  const handleTileStaged = React.useCallback((message: WorkshopLightboxTileStagedMessage) => {
    const result = message.payload;
    if (!result || result.deliveryId !== granted?.deliveryId) {
      return;
    }
    setStaging(null);
    answer(result.staged
      ? { deliveryId: result.deliveryId, opened: true }
      : { deliveryId: result.deliveryId, opened: false, reason: result.reason });
  }, [answer, granted]);

  return {
    staging,
    handleTileOffered,
    handleSeedClaimResult: handleClaimResult,
    handleTileStaged,
    persistedState: {}
  };
}

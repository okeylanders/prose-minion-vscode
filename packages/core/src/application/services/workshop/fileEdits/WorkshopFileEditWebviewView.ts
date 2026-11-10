/**
 * What the webview sees of a turn's file-edit cards and edit offers (ADR
 * 2026-11-05 D4.3; ADR 2026-11-10 D2): each identity without its host-only
 * `documentUri`, so the webview holds only the display path. Every turn the
 * room handler posts (a turn, a session snapshot) passes through this.
 */

import { workshopEditOfferForWebview, workshopFileEditProposalForWebview, type WorkshopTurn } from '@messages';

export function workshopTurnForWebview(turn: WorkshopTurn): WorkshopTurn {
  if (!turn.fileEditProposals && !turn.editOffers) {
    return turn;
  }
  return {
    ...turn,
    ...(turn.fileEditProposals ? { fileEditProposals: turn.fileEditProposals.map(workshopFileEditProposalForWebview) } : {}),
    ...(turn.editOffers ? { editOffers: turn.editOffers.map(workshopEditOfferForWebview) } : {})
  };
}

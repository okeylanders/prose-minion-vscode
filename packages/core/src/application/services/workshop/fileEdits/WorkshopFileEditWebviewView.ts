/**
 * What the webview sees of a turn's file-edit cards (ADR 2026-11-05 D4.3):
 * each card's identity without its host-only `documentUri`, so the webview
 * holds only the display path. Every turn the room handler posts (a turn, a
 * session snapshot) passes through this.
 */

import { workshopFileEditProposalForWebview, type WorkshopTurn } from '@messages';

export function workshopTurnForWebview(turn: WorkshopTurn): WorkshopTurn {
  return turn.fileEditProposals
    ? { ...turn, fileEditProposals: turn.fileEditProposals.map(workshopFileEditProposalForWebview) }
    : turn;
}

/**
 * What the webview sees of a turn. Every turn the room handler posts (a turn,
 * a session snapshot) passes through this.
 *
 * - File-edit cards (ADR 2026-11-05 D4.3): each card's identity without its
 *   host-only `documentUri`, so the webview holds only the display path.
 * - `reactionDelivery` (ADR 2026-11-07 D6) is host bookkeeping the webview
 *   never reads, so it never leaves the host (PR #246 L3).
 */

import { workshopFileEditProposalForWebview, type WorkshopTurn } from '@messages';

export function workshopTurnForWebview(turn: WorkshopTurn): WorkshopTurn {
  const { reactionDelivery: _hostOnly, ...rest } = turn;
  const shown = turn.reactionDelivery ? rest : turn;
  return shown.fileEditProposals
    ? { ...shown, fileEditProposals: shown.fileEditProposals.map(workshopFileEditProposalForWebview) }
    : shown;
}

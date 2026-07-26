/**
 * Pure newest-first packing for bounded Workshop transcript frames.
 *
 * The source window keeps the newest turns, packing considers those turns from
 * newest to oldest, and rendered blocks always return in ledger order. Receipt
 * ordering is an explicit policy because the two pre-13D packers historically
 * disagreed; 13D-a preserves each caller's behavior before the delivery
 * protocol replaces that distinction.
 */

import { trimToCharacterLimit } from '@/utils/textUtils';

export interface WorkshopTurnPackingPolicy {
  turnLimit: number;
  characterLimit: number;
  headerAllowanceCharacters: number;
  oversizedTurn: {
    kind: 'head-truncate';
    marker: string;
  };
  receiptOrder: 'frame-order' | 'newest-first';
}

export interface WorkshopPackedTurns {
  /** Rendered blocks in ledger order, regardless of packing direction. */
  blocks: string[];
  /** Exact ids whose blocks shipped, ordered by the selected receipt policy. */
  deliveredTurnIds: string[];
  omittedTurns: number;
  truncatedCharacters: number;
}

/**
 * Pack the newest source window without making eligibility or rendering
 * decisions. Callers supply already-eligible turns and one formatter.
 */
export function packWorkshopTurnsNewestFirst<T extends { id: string }>(
  turns: readonly T[],
  formatTurn: (turn: T) => string,
  policy: WorkshopTurnPackingPolicy
): WorkshopPackedTurns {
  const newest = turns.slice(-policy.turnLimit);
  const blocks: string[] = [];
  const deliveredTurnIds: string[] = [];
  let omittedTurns = turns.length - newest.length;
  let truncatedCharacters = 0;
  let remaining = policy.characterLimit - policy.headerAllowanceCharacters;

  const recordDelivery = (turnId: string): void => {
    if (policy.receiptOrder === 'frame-order') {
      deliveredTurnIds.unshift(turnId);
    } else {
      deliveredTurnIds.push(turnId);
    }
  };

  for (let index = newest.length - 1; index >= 0; index -= 1) {
    const turn = newest[index];
    const block = formatTurn(turn);
    const separatorLength = blocks.length > 0 ? 2 : 0;
    if (block.length + separatorLength <= remaining) {
      blocks.unshift(block);
      recordDelivery(turn.id);
      remaining -= block.length + separatorLength;
      continue;
    }

    if (blocks.length === 0) {
      const keptLength = Math.max(
        0,
        remaining - policy.oversizedTurn.marker.length
      );
      const trimmed = trimToCharacterLimit(block, keptLength).trimmed;
      blocks.unshift(`${trimmed}${policy.oversizedTurn.marker}`);
      recordDelivery(turn.id);
      truncatedCharacters += Math.max(0, block.length - keptLength);
      remaining = 0;
    } else {
      omittedTurns += 1;
      truncatedCharacters += block.length;
    }
  }

  return {
    blocks,
    deliveredTurnIds,
    omittedTurns,
    truncatedCharacters
  };
}

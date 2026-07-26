/**
 * Pure newest-first packing for bounded Workshop transcript frames.
 *
 * The source window keeps the newest turns, packing considers those turns from
 * newest to oldest, and rendered blocks and receipts always return in ledger
 * order. Turns are atomic: if the next older block does not fit, it and every
 * older turn are omitted as one disclosed prefix.
 */

export interface WorkshopTurnPackingPolicy {
  turnLimit: number;
  characterLimit: number;
  headerAllowanceCharacters: number;
}

export interface WorkshopPackedTurns {
  /** Rendered blocks in ledger order, regardless of packing direction. */
  blocks: string[];
  /** Exact ids whose blocks shipped, in the same ledger order as `blocks`. */
  deliveredTurnIds: string[];
  omittedTurns: number;
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
  const turnLimit = Math.max(0, Math.floor(policy.turnLimit));
  const newest = turnLimit === 0 ? [] : turns.slice(-turnLimit);
  const blocks: string[] = [];
  const deliveredTurnIds: string[] = [];
  let omittedTurns = turns.length - newest.length;
  let remaining = policy.characterLimit - policy.headerAllowanceCharacters;

  for (let index = newest.length - 1; index >= 0; index -= 1) {
    const turn = newest[index];
    const block = formatTurn(turn);
    const separatorLength = blocks.length > 0 ? 2 : 0;
    if (block.length + separatorLength <= remaining) {
      blocks.unshift(block);
      deliveredTurnIds.unshift(turn.id);
      remaining -= block.length + separatorLength;
      continue;
    }
    omittedTurns += index + 1;
    break;
  }

  return {
    blocks,
    deliveredTurnIds,
    omittedTurns
  };
}

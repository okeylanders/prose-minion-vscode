/**
 * Where a lens's reading on the board came from, and whether it is an
 * earlier one (Slice 4J, epic decision 49), apart from the reading contract
 * so that module stays within its size.
 *
 * Every run keeps a lens's reading until a new one replaces it, so a group
 * can hold readings from different runs: one lens replaced by this run,
 * another kept from an earlier one. The group's own `model` and `error`
 * describe its latest call; these say, lens by lens, what is on screen.
 */

import type { LightboxLensId } from './lightboxReadings';

/** The run, model and time that produced a lens's reading on the board. */
export interface LightboxLensProvenance {
  lens: LightboxLensId;
  /** The host-minted token of the run whose call read it. */
  run: string;
  /** The provider-reported model of that call, when the provider reported one. */
  model?: string;
  /** ISO 8601: when that call's reading landed on the board. */
  at: string;
}

/**
 * A lens whose reading on the board is an earlier one (decision 49): the
 * latest call that read it did not replace it, because the call failed or
 * was stopped, the reply was cut off before the lens's block, the block was
 * withheld, or it drew no tile. The earlier reading keeps its own standing
 * and stale mark. A new reading that lands clears the mark.
 */
export interface LightboxEarlierLens {
  lens: LightboxLensId;
  /** Why the latest call did not replace it, in host words. Writer-facing. */
  reason: string;
}

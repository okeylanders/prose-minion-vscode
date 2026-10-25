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

/**
 * The run, model and time that produced a lens's reading on the board.
 *
 * Two shapes. A reading a call landed since Slice 4J records all three
 * (`run` and `at` together, `model` when the provider reported one). A
 * reading from a board read before it, still on the board when a later
 * call of its group settles, records only the model its group named then,
 * or nothing when the group named none (PR #170 F-02): never a run or a
 * time the board did not hold. `run` and `at` are both present or both
 * absent. An entry of the lens alone is also a reading whose origin a group
 * with provenance lost (an entry that did not read, or one left out): it
 * stays unknown through every later call.
 *
 * A group's `provenance` absent means a board read before Slice 4J; present,
 * even empty, it is never read as one.
 */
export interface LightboxLensProvenance {
  lens: LightboxLensId;
  /** The host-minted token of the run whose call read it; absent for a reading from before Slice 4J. */
  run?: string;
  /** The provider-reported model of that call; absent when none was reported or known. */
  model?: string;
  /** ISO 8601: when that call's reading landed on the board; absent with `run`. */
  at?: string;
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

/**
 * A call's failure, said once (Slice 4J, epic decision 52): the host words a
 * reply cut off at the output ceiling uses for the lenses it touched, shared
 * by the host, which writes them, and the renderer, which gathers them into
 * the call's one note. Pure.
 *
 * A reply cut off at the output ceiling (decision 40) withholds the block it
 * was cut inside, and the blocks it never reached; each such reason starts
 * with `LIGHTBOX_CUT_REPLY_PREFIX` and ends with where the paid reply was
 * saved, so the renderer can show that once, at the call, and point each
 * widget to it.
 */

/** What every reason of a reply cut off at the ceiling starts with. */
export const LIGHTBOX_CUT_REPLY_PREFIX = 'The reply reached the output ceiling before this block';

/** The block the reply was cut inside. The same words as the reading wire's `LIGHTBOX_CUT_OFF_REASON` (a test pins them). */
export const LIGHTBOX_CUT_INSIDE_REASON = `${LIGHTBOX_CUT_REPLY_PREFIX} finished.`;

/** A block the reply never reached (Slice 4J; before it, "The reading returned no … block."). */
export const LIGHTBOX_CUT_BEFORE_REASON = `${LIGHTBOX_CUT_REPLY_PREFIX} began.`;

/** Whether a withheld block's reason is a cut at the output ceiling. */
export function isLightboxCutReplyReason(reason: string): boolean {
  return reason.startsWith(LIGHTBOX_CUT_REPLY_PREFIX);
}

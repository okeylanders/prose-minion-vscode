/**
 * Clipping text at a surface (Slice 4H, epic decision 37). Pure.
 *
 * A Lightbox reading is no longer withheld for running past what its prompt
 * asked for: the board shows it whole. Two places still have a real limit,
 * and each clips there, visibly, rather than withholding:
 * - the codec's one safety ceiling (`PROMPT_BUDGETS.lightbox.safetyMultiple`
 *   times a field's ask), which keeps a runaway field from breaking the
 *   layout or a saved board's size;
 * - a surface with bounds of its own, such as a Workshop tile's title, claim
 *   and points when a reading is brought there.
 *
 * A clipped text ends with an ellipsis, at a word boundary when one is near,
 * and is never longer than the bound it was clipped to.
 */

export const LIGHTBOX_ELLIPSIS = '…';

/** How far back from the bound a word boundary may be taken, as a share of the bound. */
const WORD_BOUNDARY_REACH = 0.2;

/** `text` when it fits `maximum` characters; otherwise its start and an ellipsis, `maximum` characters at most. */
export function clipLightboxText(text: string, maximum: number): string {
  if (text.length <= maximum) {
    return text;
  }
  const room = Math.max(0, maximum - LIGHTBOX_ELLIPSIS.length);
  let cut = text.slice(0, room);
  // Never leave half of a surrogate pair.
  if (/[\uD800-\uDBFF]$/u.test(cut)) {
    cut = cut.slice(0, -1);
  }
  // A word is not halved when a boundary sits near the bound.
  const boundary = cut.search(/\s\S*$/u);
  if (boundary > 0 && boundary >= room * (1 - WORD_BOUNDARY_REACH) && /\S/u.test(text.charAt(room))) {
    cut = cut.slice(0, boundary);
  }
  return `${cut.trimEnd()}${LIGHTBOX_ELLIPSIS}`;
}

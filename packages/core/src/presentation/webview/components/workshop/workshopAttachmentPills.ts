/**
 * What a message attachment's pill says, above the composer and on its sent
 * turn. A file says its path and size; a Lightbox tile (Lightbox Slice 4)
 * says it came from the Lightbox, which chapter, and how many quotes it
 * carries. Pure: display-safe snapshot fields only.
 */

import type { WorkshopMessageAttachmentSnapshot } from '@messages';

/** The pill's tooltip. */
export function workshopAttachmentTitle(attachment: WorkshopMessageAttachmentSnapshot): string {
  const tile = attachment.lightboxTile;
  if (tile) {
    const from = tile.sourceLabel ? ` of ${tile.sourceLabel}` : '';
    return `${tile.kindLabel} from the Lightbox's reading${from}: the claim and the quotes found in the chapter`;
  }
  return attachment.relativePath ?? attachment.label;
}

/** The pill's size note, as the composer or a sent turn writes a file's head-slice mark. */
export function workshopAttachmentSize(
  attachment: WorkshopMessageAttachmentSnapshot,
  surface: 'composer' | 'turn'
): string {
  const tile = attachment.lightboxTile;
  if (tile) {
    return `from the Lightbox · ${tile.quotes} ${tile.quotes === 1 ? 'quote' : 'quotes'}`;
  }
  const words = `${attachment.words.toLocaleString()} words`;
  if (!attachment.truncation) {
    return words;
  }
  return surface === 'composer' ? `${words} · head slice` : `${words} (head slice)`;
}

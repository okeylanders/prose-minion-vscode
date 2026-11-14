/**
 * What a message attachment's pill says, above the composer and on its sent
 * turn. A file says its path and size; a Lightbox tile (Lightbox Slice 4)
 * says it came from the Lightbox, which chapter, and how many quotes it
 * carries. Selected Text (ADR 2026-11-14 D9) says its file, lines and words,
 * and how much was kept when it was cut. Pure: display-safe snapshot fields
 * only.
 */

import type { WorkshopMessageAttachmentSnapshot } from '@messages';

/** What a Selected Text pill says of its selection, staged, sent or live. */
export interface WorkshopSelectedTextPillFacts {
  /** Display path; the pill shows its file name. */
  path?: string;
  startLine: number;
  endLine: number;
  words: number;
  truncation?: { keptWords: number; totalWords: number };
}

/** "alice-ch3.md · lines 40–44 · 62 words", or "… · first 5,000 of 8,120 words" when it was cut. */
export function workshopSelectedTextDetail(facts: WorkshopSelectedTextPillFacts): string {
  const file = facts.path?.split(/[\\/]/).filter((part) => part.length > 0).pop();
  const lines = facts.startLine === facts.endLine ? `line ${facts.startLine}` : `lines ${facts.startLine}–${facts.endLine}`;
  const words = facts.truncation
    ? `first ${facts.truncation.keptWords.toLocaleString('en-US')} of ${facts.truncation.totalWords.toLocaleString('en-US')} words`
    : `${facts.words.toLocaleString('en-US')} ${facts.words === 1 ? 'word' : 'words'}`;
  return [file, lines, words].filter((part): part is string => !!part).join(' · ');
}

const selectedTextFacts = (attachment: WorkshopMessageAttachmentSnapshot): WorkshopSelectedTextPillFacts | undefined =>
  attachment.selectedText && {
    path: attachment.relativePath,
    startLine: attachment.selectedText.startLine,
    endLine: attachment.selectedText.endLine,
    words: attachment.words,
    truncation: attachment.truncation
  };

/** The pill's tooltip. */
export function workshopAttachmentTitle(attachment: WorkshopMessageAttachmentSnapshot): string {
  const selection = selectedTextFacts(attachment);
  if (selection) {
    const where = attachment.relativePath ? `${attachment.relativePath} · ` : '';
    return `${where}${workshopSelectedTextDetail({ ...selection, path: undefined })}`;
  }
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
  const selection = selectedTextFacts(attachment);
  if (selection) {
    return workshopSelectedTextDetail(selection);
  }
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

import type { WorkshopPastedTextMeta } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { cutWorkshopAttachmentText } from '@/utils/cutWorkshopAttachmentText';
import { countWords } from '@/utils/textUtils';
import { booleanAt, exactObject, shapeError } from './persistedValidation';
import type { WorkshopMessageAttachmentInput } from './WorkshopSessionRecords';

const bounds = PROMPT_BUDGETS.workshopPastedText;
const label = 'Pasted text';

export function workshopPastedTextInput(text: string): WorkshopMessageAttachmentInput {
  const cut = cutWorkshopAttachmentText(text, bounds);
  const pastedText: WorkshopPastedTextMeta = cut.truncation
    ? { truncated: true, truncation: { ...cut.truncation, keptCharacters: cut.text.length, totalCharacters: text.length } }
    : { truncated: false };
  return { label, words: cut.words, content: cut.text, pastedText };
}

export function cloneWorkshopPastedTextMeta(meta: WorkshopPastedTextMeta): WorkshopPastedTextMeta {
  return { ...meta, ...(meta.truncation ? { truncation: { ...meta.truncation } } : {}) };
}

/** The additive meta on both a pending item and a turn reference. Only pending records carry the body. */
export function assertWorkshopPastedTextRecord(ref: Record<string, unknown>, path: string): void {
  if (ref.pastedText === undefined) {
    return;
  }
  const meta = exactObject(ref.pastedText, `${path}.pastedText`, ['truncated'], ['truncation']);
  booleanAt(meta.truncated, `${path}.pastedText.truncated`);
  if (ref.label !== label || !Number.isSafeInteger(ref.words) || (ref.words as number) < 0 || (ref.words as number) > bounds.words
    || ['lightboxTile', 'selectedText', 'sourceUri', 'relativePath', 'configuredResource', 'truncation'].some((key) => ref[key] !== undefined)) {
    shapeError(path, 'a pasted-text attachment with its bounded word count and no file provenance');
  }
  if (meta.truncation !== undefined) {
    const cut = exactObject(meta.truncation, `${path}.pastedText.truncation`,
      ['keptCharacters', 'totalCharacters', 'keptWords', 'totalWords']);
    if (!meta.truncated || !Object.values(cut).every((count) => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0)
      || cut.keptWords !== ref.words || (cut.totalWords as number) < (cut.keptWords as number)
      || (cut.keptCharacters as number) < 1 || (cut.keptCharacters as number) > bounds.characters
      || (cut.totalCharacters as number) <= (cut.keptCharacters as number)
      || (typeof ref.content === 'string' && ref.content.length !== cut.keptCharacters)) {
      shapeError(path, 'valid kept and original pasted-text counts');
    }
  }
  if (ref.content !== undefined && (typeof ref.content !== 'string' || !ref.content.length
    || ref.content.length > bounds.characters || countWords(ref.content) !== ref.words)) {
    shapeError(path, 'a bounded pasted-text body with its recorded word count');
  }
}

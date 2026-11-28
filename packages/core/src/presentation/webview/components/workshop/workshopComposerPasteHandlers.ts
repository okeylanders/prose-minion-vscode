import type * as React from 'react';
import { workshopComposerDraftAfterSeed } from '@utils/workshop/workshopComposerDraft';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopComposerPastedText } from '@hooks/domain/workshop/useWorkshopPastedText';

/** A short plain paste stays native. A long one is staged until the writer chooses to move it back. */
export function workshopComposerPasteHandlers(
  pasted: WorkshopComposerPastedText | undefined,
  textareaRef: React.RefObject<HTMLTextAreaElement>,
  applyEdit: (edit: { text: string; caret: number }) => void,
  enabled: boolean
) {
  const paste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = event.clipboardData.getData('text/plain');
    if (pasted && text.length >= PROMPT_BUDGETS.workshopPastedText.thresholdCharacters) {
      event.preventDefault();
      if (enabled) {
        pasted.stage(text);
      }
    }
  };
  const insertPaste = (id: string) => {
    const textarea = textareaRef.current;
    if (!textarea || !enabled) {
      return;
    }
    const before = textarea.value;
    pasted?.take(id, (body) => {
      if (textareaRef.current !== textarea) {
        return;
      }
      const current = textarea.value;
      const start = textarea.selectionStart;
      const text = body.replace(/\r\n?/g, '\n'); // Native textarea insertion normalizes line endings.
      const next = workshopComposerDraftAfterSeed(current, { text }, { before, start, end: textarea.selectionEnd });
      const caret = start + text.length;
      if (next === current) {
        textarea.setSelectionRange(caret, caret);
      } else {
        applyEdit({ text: next, caret });
      }
      textarea.focus();
    });
  };
  return { paste, insertPaste };
}

/**
 * The prose-aware diff (ADR 2026-11-19 D13; G2: jsdiff). Pure, and the one
 * module that imports `diff` (`boundaries.test.ts`).
 *
 * - **Paragraphs first.** Both texts are split by the blank-line rule
 *   (`splitBlankLineParagraphs`) and aligned with jsdiff's array diff. In a
 *   run of removed and added paragraphs they are paired by position: a pair
 *   is a changed paragraph; the rest are added or removed whole.
 * - **Words inside a changed paragraph,** with jsdiff's word diff, spaces
 *   kept. A paragraph longer than `wordDiffParagraphCharacters`, or a word
 *   diff past `maxEditLength`, is shown whole, before and after.
 * - **Bounded work, never bounded correctness.** The paragraph alignment
 *   has its own ceiling, apart from the word diff's (PR #286 F-03): a side
 *   past `alignParagraphs` paragraphs is not aligned at all, and an
 *   alignment past `alignEditLength` gives up. Either falls back to pairing
 *   every paragraph by position, still a true account of the two texts,
 *   only a longer one. Myers' work is O((N + M) · D), so both bounds hold it.
 * - **Context.** The first change of a run carries the unchanged
 *   paragraph(s) just before it, the last the ones just after:
 *   `contextParagraphs` each side, numbered in the newer text.
 *
 * Numbers are 1-based paragraph positions. Nothing here cuts text; the
 * renderer cuts context only.
 */

import { diffArrays, diffWordsWithSpace } from 'diff';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { splitBlankLineParagraphs } from '@/utils/blankLineParagraphs';

export interface WorkshopHistoryWordPart {
  readonly kind: 'same' | 'removed' | 'added';
  readonly text: string;
}

export interface WorkshopHistoryContextParagraph {
  /** Its number in the newer text. */
  readonly number: number;
  readonly text: string;
}

interface ChangeContext {
  readonly before?: readonly WorkshopHistoryContextParagraph[];
  readonly after?: readonly WorkshopHistoryContextParagraph[];
}

export type WorkshopHistoryChange = ChangeContext & (
  | { readonly kind: 'added'; readonly newNumber: number; readonly text: string }
  | { readonly kind: 'removed'; readonly oldNumber: number; readonly text: string }
  | {
      readonly kind: 'changed';
      readonly oldNumber: number;
      readonly newNumber: number;
      readonly words: readonly WorkshopHistoryWordPart[];
    }
  | {
      readonly kind: 'changed-whole';
      readonly oldNumber: number;
      readonly newNumber: number;
      readonly oldText: string;
      readonly newText: string;
      /** Why it was not compared word by word. */
      readonly why: 'long-paragraph' | 'edit-length';
    }
);

export interface WorkshopHistoryDiffResult {
  readonly changes: readonly WorkshopHistoryChange[];
  readonly oldParagraphs: number;
  readonly newParagraphs: number;
  /** Why paragraphs were paired by position instead of aligned, when they were. */
  readonly alignedByPosition?: 'too-many-paragraphs' | 'edit-length';
}

type Removed = { readonly index: number; readonly text: string };

/** Compare `older` with `newer`, paragraphs first, then the words of each changed one. */
export function diffWorkshopHistoryTexts(older: string, newer: string): WorkshopHistoryDiffResult {
  const budgets = PROMPT_BUDGETS.workshopHistory;
  const oldParagraphs = splitBlankLineParagraphs(older).map((paragraph) => paragraph.text);
  const newParagraphs = splitBlankLineParagraphs(newer).map((paragraph) => paragraph.text);
  const tooMany = Math.max(oldParagraphs.length, newParagraphs.length) > budgets.alignParagraphs;
  const aligned = tooMany ? undefined : diffArrays(oldParagraphs, newParagraphs, { maxEditLength: budgets.alignEditLength });
  const alignment = aligned ?? [
    ...(oldParagraphs.length > 0 ? [{ value: oldParagraphs, added: false, removed: true, count: oldParagraphs.length }] : []),
    ...(newParagraphs.length > 0 ? [{ value: newParagraphs, added: true, removed: false, count: newParagraphs.length }] : [])
  ];

  const changes: WorkshopHistoryChange[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  let removed: Removed[] = [];
  let added: Removed[] = [];
  const closeRun = (): void => {
    if (removed.length === 0 && added.length === 0) {
      return;
    }
    const run = pairRun(removed, added);
    // The run begins, in the newer text, at its first added paragraph, or where its removals stood.
    const before = contextAround(newParagraphs, added[0]?.index ?? newIndex, -1);
    const after = contextAround(newParagraphs, newIndex, 1);
    run[0] = { ...run[0], ...(before.length > 0 ? { before } : {}) };
    run[run.length - 1] = { ...run[run.length - 1], ...(after.length > 0 ? { after } : {}) };
    changes.push(...run);
    removed = [];
    added = [];
  };
  for (const part of alignment) {
    if (part.removed) {
      for (const text of part.value) {
        removed.push({ index: oldIndex++, text });
      }
    } else if (part.added) {
      for (const text of part.value) {
        added.push({ index: newIndex++, text });
      }
    } else {
      closeRun();
      oldIndex += part.value.length;
      newIndex += part.value.length;
    }
  }
  closeRun();
  return {
    changes,
    oldParagraphs: oldParagraphs.length,
    newParagraphs: newParagraphs.length,
    ...(aligned === undefined ? { alignedByPosition: tooMany ? 'too-many-paragraphs' as const : 'edit-length' as const } : {})
  };
}

/** A run's changes: pairs by position, then the paragraphs left over, added or removed whole. */
function pairRun(removed: readonly Removed[], added: readonly Removed[]): WorkshopHistoryChange[] {
  const pairs = Math.min(removed.length, added.length);
  const run: WorkshopHistoryChange[] = [];
  for (let at = 0; at < pairs; at += 1) {
    run.push(changedParagraph(removed[at], added[at]));
  }
  for (const paragraph of removed.slice(pairs)) {
    run.push({ kind: 'removed', oldNumber: paragraph.index + 1, text: paragraph.text });
  }
  for (const paragraph of added.slice(pairs)) {
    run.push({ kind: 'added', newNumber: paragraph.index + 1, text: paragraph.text });
  }
  return run;
}

function changedParagraph(older: Removed, newer: Removed): WorkshopHistoryChange {
  const budgets = PROMPT_BUDGETS.workshopHistory;
  const numbers = { oldNumber: older.index + 1, newNumber: newer.index + 1 };
  if (Math.max(older.text.length, newer.text.length) > budgets.wordDiffParagraphCharacters) {
    return { kind: 'changed-whole', ...numbers, oldText: older.text, newText: newer.text, why: 'long-paragraph' };
  }
  const words = diffWordsWithSpace(older.text, newer.text, { maxEditLength: budgets.maxEditLength });
  if (!words) {
    return { kind: 'changed-whole', ...numbers, oldText: older.text, newText: newer.text, why: 'edit-length' };
  }
  return {
    kind: 'changed',
    ...numbers,
    words: words.map((part) => ({ kind: part.added ? 'added' : part.removed ? 'removed' : 'same', text: part.value }))
  };
}

/** Up to `contextParagraphs` unchanged paragraphs before `index` (direction -1) or from it (1). */
function contextAround(paragraphs: readonly string[], index: number, direction: -1 | 1): WorkshopHistoryContextParagraph[] {
  const count = PROMPT_BUDGETS.workshopHistory.contextParagraphs;
  const picked: WorkshopHistoryContextParagraph[] = [];
  for (let step = 0; step < count; step += 1) {
    const at = direction === -1 ? index - 1 - step : index + step;
    if (at < 0 || at >= paragraphs.length) {
      break;
    }
    picked.push({ number: at + 1, text: paragraphs[at] });
  }
  return direction === -1 ? picked.reverse() : picked;
}

/**
 * Project memory's write rules and words, shared by the host's routes and
 * the memory sheet (ADR 2026-11-04 D4, D5; Slice 0d's copy), so a draft the
 * sheet accepts is one the host accepts, and a refusal reads the same in
 * both places.
 *
 * The UI says "Always load in full" and "Loaded in full", never "pin"
 * (Slice 0d decision 16). Nothing here names memory text.
 */

import {
  PROJECT_MEMORY_FIELD_CHARACTERS,
  PROJECT_MEMORY_ID,
  PROJECT_MEMORY_KINDS,
  PROJECT_MEMORY_LIST_ENTRIES
} from '@shared/types/projectMemory';
import type { WorkshopMemoryDraft, WorkshopMemoryPinnedEstimate } from '@messages';

export type WorkshopMemoryDraftFault =
  | 'not-a-draft'
  | 'title-empty'
  | 'title-not-one-line'
  | 'title-too-long'
  | 'summary-empty'
  | 'summary-not-one-line'
  | 'summary-too-long'
  | 'body-too-long'
  | 'too-many-replaced';

const NOT_ONE_LINE = /[\p{Cc}\u2028\u2029]/u;

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the faults' kebab-case words. */
export const WORKSHOP_MEMORY_DRAFT_FAULTS: Readonly<Record<WorkshopMemoryDraftFault, string>> = {
  'not-a-draft': 'That memory could not be read. Try again.',
  'title-empty': 'A memory needs a title.',
  'title-not-one-line': 'A memory\'s title is one line.',
  'title-too-long': `A memory's title is at most ${PROJECT_MEMORY_FIELD_CHARACTERS.title} characters.`,
  'summary-empty': 'A memory needs a summary.',
  'summary-not-one-line': 'A memory\'s summary is one line.',
  'summary-too-long': `A memory's summary is at most ${PROJECT_MEMORY_FIELD_CHARACTERS.summary} characters.`,
  'body-too-long': `A memory's note is at most ${PROJECT_MEMORY_FIELD_CHARACTERS.body.toLocaleString('en-US')} characters.`,
  'too-many-replaced': `A memory replaces at most ${PROJECT_MEMORY_LIST_ENTRIES.supersedes} others.`
};
/* eslint-enable @typescript-eslint/naming-convention */

/** Whether `value` is a draft the host would write, or the first reason it isn't. */
export function checkWorkshopMemoryDraft(value: unknown): WorkshopMemoryDraftFault | undefined {
  if (!isDraftShape(value)) {
    return 'not-a-draft';
  }
  const title = value.title.trim();
  const summary = value.summary.trim();
  if (!title) {
    return 'title-empty';
  }
  if (NOT_ONE_LINE.test(title)) {
    return 'title-not-one-line';
  }
  if (title.length > PROJECT_MEMORY_FIELD_CHARACTERS.title) {
    return 'title-too-long';
  }
  if (!summary) {
    return 'summary-empty';
  }
  if (NOT_ONE_LINE.test(summary)) {
    return 'summary-not-one-line';
  }
  if (summary.length > PROJECT_MEMORY_FIELD_CHARACTERS.summary) {
    return 'summary-too-long';
  }
  if (value.body.trim().length > PROJECT_MEMORY_FIELD_CHARACTERS.body) {
    return 'body-too-long';
  }
  if (value.supersedes.length > PROJECT_MEMORY_LIST_ENTRIES.supersedes) {
    return 'too-many-replaced';
  }
  return undefined;
}

function isDraftShape(value: unknown): value is WorkshopMemoryDraft {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const draft = value as Record<string, unknown>;
  return typeof draft.title === 'string'
    && typeof draft.summary === 'string'
    && typeof draft.body === 'string'
    && typeof draft.pinned === 'boolean'
    && (PROJECT_MEMORY_KINDS as readonly unknown[]).includes(draft.kind)
    && Array.isArray(draft.supersedes)
    && draft.supersedes.every((id) => typeof id === 'string' && PROJECT_MEMORY_ID.test(id));
}

/**
 * The sheet's refusal under the note (Slice 0d, "Refused edit"), from the
 * host's numbers. An edit of a memory that loads in full names "the longer
 * note"; a new memory or a switch turned on names the switch.
 */
export function workshopMemoryPinnedRefusal(estimate: WorkshopMemoryPinnedEstimate, editing: boolean): string {
  const figures = `about ${roundTokens(estimate.totalTokens)} of ${estimate.budgetTokens.toLocaleString('en-US')} tokens`;
  return editing
    ? `Can't save this edit: this memory loads in full, and the longer note would bring memories loaded in full to ${figures}. ` +
      'Shorten the note, or turn off Always load in full here or on another memory.'
    : `Can't save this: memories loaded in full would come to ${figures}. ` +
      'Shorten the note, or turn off Always load in full here or on another memory.';
}

/** The switch's help line, with the host's numbers (Slice 0d, the sheet). */
export function workshopMemoryPinnedHelp(estimate: WorkshopMemoryPinnedEstimate | undefined): string {
  const lead = 'Every conversation starts with this memory\'s whole note, not just its summary.';
  if (!estimate) {
    return lead;
  }
  return `${lead} This one adds about ${roundTokens(estimate.thisTokens)} tokens; ` +
    `memories loaded in full would come to about ${roundTokens(estimate.totalTokens)} of ${estimate.budgetTokens.toLocaleString('en-US')}.`;
}

/** Tokens as the tab and the sheet say them: "about 60", "about 4,360". */
function roundTokens(tokens: number): string {
  const rounded = tokens >= 1_000 ? Math.round(tokens / 10) * 10 : tokens;
  return rounded.toLocaleString('en-US');
}

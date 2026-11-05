/**
 * What an edit card shows (epic Slice 6c): each field the edit changes, as
 * before → after. Pure, over the host's card.
 *
 * - Title, kind and summary are short: each changed one shows whole.
 * - The body shows only its changed region: the stretch between what the
 *   two versions share at the start and at the end, with up to
 *   `CONTEXT_CHARACTERS` of the shared text on each side (cut at a word, an
 *   ellipsis where it is cut). A region longer than `LONG_CHARACTERS` on
 *   either side is drawn collapsed.
 */

import type { WorkshopMemoryEditFields, WorkshopMemoryEditProposal } from '@messages';

export const CONTEXT_CHARACTERS = 80;
export const LONG_CHARACTERS = 600;

export interface WorkshopMemoryFieldChange {
  readonly field: 'title' | 'kind' | 'summary';
  readonly label: string;
  readonly before: string;
  readonly after: string;
}

export interface WorkshopMemoryBodyChange {
  /** Shared text just before the change ("" at the start). */
  readonly lead: string;
  readonly removed: string;
  readonly added: string;
  /** Shared text just after the change ("" at the end). */
  readonly trail: string;
  /** Either side is long: drawn collapsed. */
  readonly long: boolean;
}

export interface WorkshopMemoryEditView {
  readonly fields: readonly WorkshopMemoryFieldChange[];
  readonly body?: WorkshopMemoryBodyChange;
}

const LABELS = { title: 'Title', kind: 'Kind', summary: 'Summary' } as const;

export function workshopMemoryEditView(
  proposal: Pick<WorkshopMemoryEditProposal, 'before'> & WorkshopMemoryEditFields,
  kindWords: (kind: WorkshopMemoryEditFields['kind']) => string
): WorkshopMemoryEditView {
  const fields = (['title', 'kind', 'summary'] as const).flatMap((field) => {
    const before = proposal.before[field];
    const after = proposal[field];
    if (before === after) {
      return [];
    }
    return [{
      field,
      label: LABELS[field],
      before: field === 'kind' ? kindWords(proposal.before.kind) : before,
      after: field === 'kind' ? kindWords(proposal.kind) : after
    }];
  });
  const body = proposal.before.body.trim() === proposal.body.trim() ? undefined : bodyChange(proposal.before.body.trim(), proposal.body.trim());
  return body ? { fields, body } : { fields };
}

/** The changed region of two texts, with shared context around it. */
export function bodyChange(before: string, after: string): WorkshopMemoryBodyChange {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) {
    start += 1;
  }
  // Never between the halves of a surrogate pair: a character is shared whole or not at all.
  if (start > 0 && isHighSurrogate(before.charCodeAt(start - 1))) {
    start -= 1;
  }
  let end = 0;
  while (end < before.length - start && end < after.length - start
    && before[before.length - 1 - end] === after[after.length - 1 - end]) {
    end += 1;
  }
  if (end > 0 && isLowSurrogate(before.charCodeAt(before.length - end))) {
    end -= 1;
  }
  const removed = before.slice(start, before.length - end);
  const added = after.slice(start, after.length - end);
  return {
    lead: leadOf(before.slice(0, start)),
    removed,
    added,
    trail: trailOf(before.slice(before.length - end)),
    long: removed.length > LONG_CHARACTERS || added.length > LONG_CHARACTERS
  };
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

function leadOf(shared: string): string {
  if (shared.length <= CONTEXT_CHARACTERS) {
    return shared;
  }
  // Code-point safe: a cut that starts on the second half of a pair starts after it (PR #212 F-05).
  const raw = shared.slice(-CONTEXT_CHARACTERS);
  const cut = isLowSurrogate(raw.charCodeAt(0)) ? raw.slice(1) : raw;
  const space = cut.indexOf(' ');
  return `…${space >= 0 && space < cut.length - 1 ? cut.slice(space + 1) : cut}`;
}

function trailOf(shared: string): string {
  if (shared.length <= CONTEXT_CHARACTERS) {
    return shared;
  }
  // Code-point safe: a cut that ends on the first half of a pair ends before it (PR #212 F-05).
  const raw = shared.slice(0, CONTEXT_CHARACTERS);
  const cut = isHighSurrogate(raw.charCodeAt(raw.length - 1)) ? raw.slice(0, -1) : raw;
  const space = cut.lastIndexOf(' ');
  return `${space > 0 ? cut.slice(0, space) : cut}…`;
}

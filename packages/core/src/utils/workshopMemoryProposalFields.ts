/**
 * What a memory's fields may hold, as a proposal's trailer is read (ADR
 * 2026-11-04 D4, D11): one line within its bound for a title or summary, a
 * body within its bound, a kind from the closed list. Pure, and shared by a
 * new note's decoder and an edit's (Slice 6c), which checks both its
 * rewrites and its result.
 */

import { PROJECT_MEMORY_FIELD_CHARACTERS, PROJECT_MEMORY_KINDS } from '@shared/types/projectMemory';

export const WORKSHOP_MEMORY_FIELD_FAULTS = [
  'invalid-kind',
  'title-not-one-line',
  'summary-not-one-line',
  'title-too-long',
  'summary-too-long',
  'body-too-long'
] as const;
export type WorkshopMemoryFieldFault = typeof WORKSHOP_MEMORY_FIELD_FAULTS[number];

/** The fields a memory says, by name. */
export type WorkshopMemoryFieldName = 'title' | 'kind' | 'summary' | 'body';

const NOT_ONE_LINE = /[\p{Cc}\u2028\u2029]/u;

/** A field's value against the format's rules, or the fault. */
export function workshopMemoryFieldFault(field: WorkshopMemoryFieldName, value: string): WorkshopMemoryFieldFault | undefined {
  switch (field) {
    case 'kind':
      return (PROJECT_MEMORY_KINDS as readonly string[]).includes(value) ? undefined : 'invalid-kind';
    case 'title':
    case 'summary':
      if (NOT_ONE_LINE.test(value)) {
        return `${field}-not-one-line`;
      }
      return value.length > PROJECT_MEMORY_FIELD_CHARACTERS[field] ? `${field}-too-long` : undefined;
    case 'body':
      return value.length > PROJECT_MEMORY_FIELD_CHARACTERS.body ? 'body-too-long' : undefined;
  }
}

/**
 * The helper's first task, `memory-draft` (ADR 2026-11-05 D5): a title, a
 * summary and a kind for a memory the writer is about to save from a
 * Workshop turn. Code hands it the turn's text; the writer sees the draft
 * in the sheet before anything is saved, and their typing wins.
 *
 * The bounds are the memory's own (`PROJECT_MEMORY_FIELD_CHARACTERS`) and
 * the kinds its closed list, so a draft that decodes here is one the
 * memory codec would take.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  PROJECT_MEMORY_FIELD_CHARACTERS,
  PROJECT_MEMORY_KINDS,
  type ProjectMemoryKind
} from '@shared/types/projectMemory';
import {
  helperExactFields,
  helperLine,
  type HelperDecoded,
  type HelperTaskPolicy
} from '@services/helper/HelperTaskPolicy';

/** Who wrote the passage: the writer, or a persona in the room. */
export type MemoryDraftSource = 'writer' | 'persona';

export interface MemoryDraftInput {
  /** The turn's text, as the sheet's body holds it. Cut to the task's `inputCharacters`. */
  readonly text: string;
  readonly source: MemoryDraftSource;
}

export interface MemoryDraft {
  readonly title: string;
  readonly summary: string;
  readonly kind: ProjectMemoryKind;
}

export const MEMORY_DRAFT_FIELDS = ['title', 'summary', 'kind'] as const;

const BUDGET = PROMPT_BUDGETS.helper['memory-draft'];

function isMemoryKind(value: unknown): value is ProjectMemoryKind {
  return typeof value === 'string' && (PROJECT_MEMORY_KINDS as readonly string[]).includes(value);
}

export function decodeMemoryDraft(root: Readonly<Record<string, unknown>>): HelperDecoded<MemoryDraft> {
  const shape = helperExactFields(root, MEMORY_DRAFT_FIELDS);
  if (shape) {
    return { ok: false, fault: shape };
  }
  const title = helperLine(root.title, PROJECT_MEMORY_FIELD_CHARACTERS.title);
  if (!title.ok) {
    return title;
  }
  const summary = helperLine(root.summary, PROJECT_MEMORY_FIELD_CHARACTERS.summary);
  if (!summary.ok) {
    return summary;
  }
  if (typeof root.kind !== 'string') {
    return { ok: false, fault: 'wrong-type' };
  }
  if (!isMemoryKind(root.kind)) {
    return { ok: false, fault: 'outside-vocabulary' };
  }
  return { ok: true, value: { title: title.value, summary: summary.value, kind: root.kind } };
}

export function buildMemoryDraftInput(input: MemoryDraftInput): Readonly<Record<string, unknown>> {
  return {
    source: input.source,
    passage: input.text.slice(0, BUDGET.inputCharacters)
  };
}

export const MEMORY_DRAFT_POLICY: HelperTaskPolicy<MemoryDraftInput, MemoryDraft> = {
  promptSection: 'helper/10-memory-draft.md',
  buildInput: buildMemoryDraftInput,
  describeInput: (input) => ({ characters: Math.min(input.text.length, BUDGET.inputCharacters) }),
  decode: decodeMemoryDraft,
  call: {
    temperature: 0,
    outputTokens: BUDGET.outputTokens,
    responseCharacters: BUDGET.responseCharacters,
    timeoutMs: 20_000
  }
};

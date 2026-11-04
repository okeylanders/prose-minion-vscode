/**
 * Request validation for project memory's `memory.*` calls (ADR 2026-11-04
 * D1). The library is asked only what this codec has checked:
 *
 * - `memory.catalog` takes an optional `<kind>` from the closed kinds;
 * - `memory.search` takes a `<query>` of at most `queryCharacters`, and an
 *   optional `<status>`: active (the default), superseded, archived or all;
 * - `memory.read` names one to `readMemories` distinct `<memory>` ids, each
 *   `mem-` and six hex digits (any case, read as lower case) and at most
 *   `memoryIdCharacters` long. An id is never a path: whether it names a
 *   memory is the library's question, asked of its listing.
 *
 * Every rejection names its operation, so the persona capability leaves a
 * visible artifact for it, as the resource and transcript families do.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { PROJECT_MEMORY_ID, PROJECT_MEMORY_KINDS, type ProjectMemoryKind } from '@shared/types/projectMemory';
import {
  WORKSHOP_MEMORY_SEARCH_STATUSES,
  type WorkshopMemorySearchStatus,
  type WorkshopProjectMemoryRequest
} from '@shared/types/workshopCapabilities';
import type {
  WorkshopCapabilityXmlCall,
  WorkshopCapabilityXmlFieldPolicy
} from '@/application/services/workshop/WorkshopCapabilityXmlDocument';
import type { WorkshopCapabilityRejectionReason } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';

type MemoryOperation = WorkshopProjectMemoryRequest['capability'];

export interface WorkshopProjectMemoryRejection {
  readonly kind: 'invalid';
  readonly reason: WorkshopCapabilityRejectionReason;
  readonly field?: string;
  readonly operation: MemoryOperation;
}

export type WorkshopProjectMemoryInspection =
  | { readonly kind: 'request'; readonly request: WorkshopProjectMemoryRequest }
  | WorkshopProjectMemoryRejection;

/** `memory.read` alone repeats a field: one `<memory>` per id. */
export const WORKSHOP_PROJECT_MEMORY_FIELD_POLICY: Pick<WorkshopCapabilityXmlFieldPolicy, 'repeatable'> = {
  repeatable: (operation, field) => operation === 'memory.read' && field === 'memory'
};

export function isWorkshopProjectMemoryOperation(operation: string | undefined): operation is MemoryOperation {
  return operation === 'memory.catalog' || operation === 'memory.search' || operation === 'memory.read';
}

export function inspectWorkshopProjectMemoryCall(
  operation: MemoryOperation,
  call: Pick<WorkshopCapabilityXmlCall, 'fields' | 'elements'>
): WorkshopProjectMemoryInspection {
  const budgets = PROMPT_BUDGETS.workshopProjectMemory;
  const reject = (reason: WorkshopCapabilityRejectionReason, field?: string): WorkshopProjectMemoryRejection =>
    ({ kind: 'invalid', reason, operation, ...(field !== undefined ? { field } : {}) });
  const allowed: Record<MemoryOperation, readonly string[]> = {
    'memory.catalog': ['kind'],
    'memory.search': ['query', 'status'],
    'memory.read': ['memory']
  };
  const required: Record<MemoryOperation, readonly string[]> = {
    'memory.catalog': [],
    'memory.search': ['query'],
    'memory.read': ['memory']
  };
  const unexpected = call.elements.find((element) => !allowed[operation].includes(element.name));
  if (unexpected) return reject('unexpected-field', unexpected.name);
  const missing = required[operation].find((field) => !call.elements.some((element) => element.name === field));
  if (missing) return reject('missing-field', missing);
  const empty = call.elements.find((element) => element.value.length === 0);
  if (empty) return reject('empty-field', empty.name);

  switch (operation) {
    case 'memory.catalog': {
      const kind = call.fields.get('kind');
      if (kind === undefined) return { kind: 'request', request: { capability: operation } };
      const known = PROJECT_MEMORY_KINDS.find((candidate) => candidate === kind.toLowerCase());
      return known ? { kind: 'request', request: { capability: operation, kind: known as ProjectMemoryKind } } : reject('invalid-kind', 'kind');
    }
    case 'memory.search': {
      const query = call.fields.get('query')!;
      if (query.length > budgets.queryCharacters) return reject('oversized-input', 'query');
      const status = call.fields.get('status');
      if (status === undefined) return { kind: 'request', request: { capability: operation, query } };
      const known = WORKSHOP_MEMORY_SEARCH_STATUSES.find((candidate) => candidate === status.toLowerCase());
      return known
        ? { kind: 'request', request: { capability: operation, query, status: known as WorkshopMemorySearchStatus } }
        : reject('invalid-status', 'status');
    }
    case 'memory.read': {
      const named = call.elements.filter((element) => element.name === 'memory');
      if (named.length > budgets.readMemories) return reject('too-many-memories', 'memory');
      const memories: string[] = [];
      for (const { value } of named) {
        if (value.length > budgets.memoryIdCharacters) return reject('oversized-input', 'memory');
        const id = value.toLowerCase();
        if (!PROJECT_MEMORY_ID.test(id)) return reject('invalid-memory-id', 'memory');
        if (memories.includes(id)) return reject('duplicate-memory', 'memory');
        memories.push(id);
      }
      return { kind: 'request', request: { capability: operation, memories } };
    }
    default:
      return assertNever(operation);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled project-memory operation: ${String(value)}`);
}

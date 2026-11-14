/**
 * Request validation for the project-resource family's `resource.*` calls.
 * The resource capability is asked only what this codec has checked:
 *
 * - a group is one of the closed context groups;
 * - a search query and a path each have a length ceiling from
 *   PROMPT_BUDGETS.workshopResource;
 * - a path is workspace-relative and never traverses; whether it names a
 *   configured file is the capability's question, asked of its listing;
 * - a line bound is a positive safe integer, and `endLine` is never before
 *   `startLine`;
 * - a read names one to `readPaths` files (ADR 2026-11-14 D4): `<group>`
 *   once, and one `<path>` per file, each of which may carry its own
 *   `group="…"`. Two paths are one when their group and case-folded path
 *   match, and a read naming a file twice is refused, never merged. That
 *   is stricter than the lookup, which prefers an exact match, on purpose;
 * - `startLine` and `endLine` are accepted only beside exactly one
 *   `<path>`; beside more, which file they mean is ambiguous.
 *
 * Every rejection names its operation, so the persona capability leaves a
 * visible artifact for it, as the transcript and memory families do.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { ContextPathGroup, isContextPathGroup } from '@shared/types';
import type { WorkshopCapabilityRequest, WorkshopResourceReadFile } from '@shared/types/workshopCapabilities';
import type {
  WorkshopCapabilityXmlCall,
  WorkshopCapabilityXmlField,
  WorkshopCapabilityXmlFieldPolicy
} from '@/application/services/workshop/WorkshopCapabilityXmlDocument';
import type { WorkshopCapabilityRejectionReason } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { isSafeConfiguredResourcePath } from '@/application/services/workshop/WorkshopConfiguredResourceLookup';

export type WorkshopResourceRequest = Extract<WorkshopCapabilityRequest, {
  capability: 'resource.catalog' | 'resource.search' | 'resource.read';
}>;

type ResourceOperation = WorkshopResourceRequest['capability'];

export interface WorkshopResourceRejection {
  readonly kind: 'invalid';
  readonly reason: WorkshopCapabilityRejectionReason;
  readonly field?: string;
  readonly operation: ResourceOperation;
}

export type WorkshopResourceInspection =
  | { readonly kind: 'request'; readonly request: WorkshopResourceRequest }
  | WorkshopResourceRejection;

/** `resource.read` alone repeats a field, `<path>`, and each may carry its own `group`. */
export const WORKSHOP_RESOURCE_FIELD_POLICY: WorkshopCapabilityXmlFieldPolicy = {
  repeatable: (operation, field) => operation === 'resource.read' && field === 'path',
  attributes: (operation, field) => (operation === 'resource.read' && field === 'path' ? ['group'] : [])
};

export function inspectWorkshopResourceCall(
  operation: ResourceOperation,
  call: Pick<WorkshopCapabilityXmlCall, 'fields' | 'elements'>
): WorkshopResourceInspection {
  switch (operation) {
    case 'resource.catalog':
      return catalogRequest(call.fields);
    case 'resource.search':
      return searchRequest(call.fields);
    case 'resource.read':
      return readRequest(call);
    default:
      return assertNever(operation);
  }
}

function catalogRequest(fields: ReadonlyMap<string, string>): WorkshopResourceInspection {
  const operation = 'resource.catalog';
  const fieldError = validateFields(operation, fields, [], ['group']);
  if (fieldError) {
    return fieldError;
  }
  const group = fields.get('group');
  if (group !== undefined && !isContextPathGroup(group)) {
    return reject(operation, 'unknown-resource-group', 'group');
  }
  return { kind: 'request', request: { capability: operation, group: group as ContextPathGroup | undefined } };
}

function searchRequest(fields: ReadonlyMap<string, string>): WorkshopResourceInspection {
  const operation = 'resource.search';
  const fieldError = validateFields(operation, fields, ['query'], ['group']);
  if (fieldError) {
    return fieldError;
  }
  if (fields.get('query')!.length > PROMPT_BUDGETS.workshopResource.queryCharacters) {
    return reject(operation, 'oversized-input', 'query');
  }
  const group = fields.get('group');
  if (group !== undefined && !isContextPathGroup(group)) {
    return reject(operation, 'unknown-resource-group', 'group');
  }
  return {
    kind: 'request',
    request: { capability: operation, query: fields.get('query')!, group: group as ContextPathGroup | undefined }
  };
}

function readRequest(call: Pick<WorkshopCapabilityXmlCall, 'fields' | 'elements'>): WorkshopResourceInspection {
  const operation = 'resource.read';
  const { fields } = call;
  const fieldError = validateFields(operation, fields, ['group', 'path'], ['startLine', 'endLine']);
  if (fieldError) {
    return fieldError;
  }
  const group = fields.get('group')!;
  if (!isContextPathGroup(group)) {
    return reject(operation, 'unknown-resource-group', 'group');
  }
  const named = call.elements.filter((element) => element.name === 'path');
  if (named.length > PROMPT_BUDGETS.workshopResource.readPaths) {
    return reject(operation, 'too-many-paths', 'path');
  }
  const files: WorkshopResourceReadFile[] = [];
  const seen = new Set<string>();
  for (const element of named) {
    const file = readFile(element, group);
    if ('kind' in file) {
      return file;
    }
    // One file, however its letters are cased: stricter than the lookup, on purpose (D4).
    const key = `${file.group}\0${file.path.toLowerCase()}`;
    if (seen.has(key)) {
      return reject(operation, 'duplicate-path', 'path');
    }
    seen.add(key);
    files.push(file);
  }
  const lines = lineBounds(fields);
  if ('kind' in lines) {
    return lines;
  }
  const lineField = (['startLine', 'endLine'] as const).find((field) => lines[field] !== undefined);
  if (files.length > 1 && lineField) {
    return reject(operation, 'ambiguous-lines', lineField);
  }
  return { kind: 'request', request: { capability: operation, files, ...lines } };
}

/** One `<path>`: its own `group` attribute or the call's, and a safe, bounded path. */
function readFile(
  element: WorkshopCapabilityXmlField,
  callGroup: ContextPathGroup
): WorkshopResourceReadFile | WorkshopResourceRejection {
  const operation = 'resource.read';
  const ownGroup = element.attributes.group;
  if (ownGroup !== undefined && !isContextPathGroup(ownGroup)) {
    return reject(operation, 'unknown-resource-group', 'path');
  }
  if (!element.value) {
    return reject(operation, 'empty-field', 'path');
  }
  if (element.value.length > PROMPT_BUDGETS.workshopResource.pathCharacters) {
    return reject(operation, 'oversized-input', 'path');
  }
  if (!isSafeConfiguredResourcePath(element.value)) {
    return reject(operation, 'invalid-resource-path', 'path');
  }
  return { group: ownGroup ?? callGroup, path: element.value };
}

/** `startLine` and `endLine`, each a positive safe integer, in order. */
function lineBounds(
  fields: ReadonlyMap<string, string>
): { startLine?: number; endLine?: number } | WorkshopResourceRejection {
  const parsed: { startLine?: number; endLine?: number } = {};
  for (const field of ['startLine', 'endLine'] as const) {
    const value = fields.get(field);
    if (value === undefined) {
      continue;
    }
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
      return reject('resource.read', 'invalid-line-range', field);
    }
    parsed[field] = Number(value);
  }
  if (parsed.startLine !== undefined && parsed.endLine !== undefined && parsed.endLine < parsed.startLine) {
    return reject('resource.read', 'invalid-line-range', 'endLine');
  }
  return parsed;
}

function validateFields(
  operation: ResourceOperation,
  fields: ReadonlyMap<string, string>,
  required: readonly string[],
  optional: readonly string[]
): WorkshopResourceRejection | undefined {
  const allowed = new Set([...required, ...optional]);
  const unexpected = [...fields.keys()].find(field => !allowed.has(field));
  if (unexpected) {
    return reject(operation, 'unexpected-field', unexpected);
  }
  const missing = required.find(field => !fields.has(field));
  if (missing) {
    return reject(operation, 'missing-field', missing);
  }
  const empty = required.find(field => !fields.get(field));
  return empty ? reject(operation, 'empty-field', empty) : undefined;
}

function reject(
  operation: ResourceOperation,
  reason: WorkshopCapabilityRejectionReason,
  field: string
): WorkshopResourceRejection {
  return { kind: 'invalid', reason, field, operation };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled project-resource operation: ${String(value)}`);
}

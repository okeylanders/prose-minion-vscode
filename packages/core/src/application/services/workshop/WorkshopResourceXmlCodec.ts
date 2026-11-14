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
 *   `startLine`.
 *
 * Every rejection names its operation, so the persona capability leaves a
 * visible artifact for it, as the transcript and memory families do.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { ContextPathGroup, isContextPathGroup } from '@shared/types';
import type { WorkshopCapabilityRequest } from '@shared/types/workshopCapabilities';
import type {
  WorkshopCapabilityXmlCall,
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

/** Every resource field is unique and bare. */
export const WORKSHOP_RESOURCE_FIELD_POLICY: WorkshopCapabilityXmlFieldPolicy = {
  repeatable: () => false,
  attributes: () => []
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
      return readRequest(call.fields);
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

function readRequest(fields: ReadonlyMap<string, string>): WorkshopResourceInspection {
  const operation = 'resource.read';
  const fieldError = validateFields(operation, fields, ['group', 'path'], ['startLine', 'endLine']);
  if (fieldError) {
    return fieldError;
  }
  const group = fields.get('group')!;
  if (!isContextPathGroup(group)) {
    return reject(operation, 'unknown-resource-group', 'group');
  }
  const resourcePath = fields.get('path')!;
  if (resourcePath.length > PROMPT_BUDGETS.workshopResource.pathCharacters) {
    return reject(operation, 'oversized-input', 'path');
  }
  if (!isSafeConfiguredResourcePath(resourcePath)) {
    return reject(operation, 'invalid-resource-path', 'path');
  }
  const lines = lineBounds(fields);
  if ('kind' in lines) {
    return lines;
  }
  return { kind: 'request', request: { capability: operation, group, path: resourcePath, ...lines } };
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

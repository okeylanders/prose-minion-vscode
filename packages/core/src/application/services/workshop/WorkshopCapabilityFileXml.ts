import { isContextPathGroup } from '@shared/types';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopCapabilityFileTarget } from '@shared/types/workshopCapabilities';
import type { WorkshopCapabilityRejectionReason } from './WorkshopCapabilityXmlCodec';
import { isSafeConfiguredResourcePath } from '@/utils/configuredResourcePath';

export const WORKSHOP_FILE_EXCERPT_GROUP = 'excerpt';

type FileFieldsRejection = {
  readonly kind: 'invalid';
  readonly reason: WorkshopCapabilityRejectionReason;
  readonly field: 'group' | 'path';
};

/** Decode a file name. The host still authorizes the resolved file before reading. */
export function inspectWorkshopCapabilityFile(
  fields: ReadonlyMap<string, string>
): WorkshopCapabilityFileTarget | FileFieldsRejection {
  const group = fields.get('group');
  const path = fields.get('path');
  if (group === undefined) {
    return { kind: 'invalid', reason: 'missing-field', field: 'group' };
  }
  if (group === '') {
    return { kind: 'invalid', reason: 'empty-field', field: 'group' };
  }
  if (path === '') {
    return { kind: 'invalid', reason: 'empty-field', field: 'path' };
  }
  if (group === WORKSHOP_FILE_EXCERPT_GROUP) {
    return path === undefined ? { kind: 'excerpt' } : { kind: 'invalid', reason: 'unexpected-field', field: 'path' };
  }
  if (!isContextPathGroup(group)) {
    return { kind: 'invalid', reason: 'unknown-resource-group', field: 'group' };
  }
  if (path === undefined) {
    return { kind: 'invalid', reason: 'missing-field', field: 'path' };
  }
  if (path.length > PROMPT_BUDGETS.workshopResource.pathCharacters) {
    return { kind: 'invalid', reason: 'oversized-input', field: 'path' };
  }
  if (!isSafeConfiguredResourcePath(path)) {
    return { kind: 'invalid', reason: 'invalid-resource-path', field: 'path' };
  }
  return { kind: 'configured', group, path };
}

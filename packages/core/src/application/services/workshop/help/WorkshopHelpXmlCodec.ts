import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopHelpRequest } from '@shared/types/workshopCapabilities';
import type {
  WorkshopCapabilityInspection,
  WorkshopCapabilityRejectionReason
} from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import type {
  WorkshopCapabilityXmlCall,
  WorkshopCapabilityXmlFieldPolicy
} from '@/application/services/workshop/WorkshopCapabilityXmlDocument';

export const WORKSHOP_HELP_FIELD_POLICY: Pick<WorkshopCapabilityXmlFieldPolicy, 'repeatable'> = {
  repeatable: (operation, field) => operation === 'help.read' && field === 'section'
};

// Unknown but well-formed ids are the reader's per-section outcome.
const SECTION_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*#[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function inspectWorkshopHelpCall(
  operation: WorkshopHelpRequest['capability'],
  { elements }: Pick<WorkshopCapabilityXmlCall, 'elements'>
): WorkshopCapabilityInspection {
  const field = operation === 'help.search' ? 'query' : 'section';
  const reject = (reason: WorkshopCapabilityRejectionReason): WorkshopCapabilityInspection =>
    ({ kind: 'invalid', reason, field, operation });
  const unexpected = elements.find(element => element.name !== field);
  if (unexpected) {
    return { kind: 'invalid', reason: 'unexpected-field', field: unexpected.name, operation };
  }
  if (elements.length === 0) {
    return reject('missing-field');
  }
  if (elements.some(element => !element.value)) {
    return reject('empty-field');
  }

  const bounds = PROMPT_BUDGETS.workshopHelp;
  switch (operation) {
    case 'help.search': {
      const query = elements[0].value;
      if (query.length > bounds.queryCharacters) {
        return reject('oversized-input');
      }
      return { kind: 'request', request: { capability: operation, query } };
    }
    case 'help.read': {
      if (elements.length > bounds.readSections) {
        return reject('too-many-sections');
      }
      const sections = elements.map(element => element.value);
      if (sections.some(id => id.length > bounds.sectionIdCharacters || !SECTION_ID.test(id))) {
        return reject('invalid-section');
      }
      if (new Set(sections).size !== sections.length) {
        return reject('duplicate-section');
      }
      return { kind: 'request', request: { capability: operation, sections } };
    }
  }
}

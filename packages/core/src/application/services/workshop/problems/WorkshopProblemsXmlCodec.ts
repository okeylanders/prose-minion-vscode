import type { WorkshopCapabilityInspection } from '../WorkshopCapabilityXmlCodec';
import type { WorkshopCapabilityXmlCall } from '../WorkshopCapabilityXmlDocument';
import { inspectWorkshopCapabilityFile } from '../WorkshopCapabilityFileXml';
import { workshopCapabilityPage } from '../WorkshopCapabilityPaging';

const OPERATION = 'problems.read';
const FIELDS = ['group', 'path', 'start'];

export function inspectWorkshopProblemsCall(call: WorkshopCapabilityXmlCall): WorkshopCapabilityInspection {
  const unexpected = call.elements.find(field => !FIELDS.includes(field.name));
  if (unexpected) {
    return { kind: 'invalid', reason: 'unexpected-field', operation: OPERATION, field: unexpected.name };
  }
  const file = inspectWorkshopCapabilityFile(call.fields);
  if (file.kind === 'invalid') {
    return { ...file, operation: OPERATION };
  }
  const rawStart = call.fields.get('start');
  const start = rawStart === undefined ? undefined : workshopCapabilityPage(rawStart);
  if (start?.kind === 'invalid') {
    return { kind: 'invalid', reason: 'invalid-start', operation: OPERATION, field: 'start' };
  }
  return { kind: 'request', request: { capability: OPERATION, file, ...(start ? { start: start.page } : {}) } };
}

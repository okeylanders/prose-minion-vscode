/**
 * Request validation for the `history.*` calls (ADR 2026-11-19 D11, D13,
 * D14). The host is asked only what this codec has checked:
 *
 * - **The file.** `<group>excerpt</group>` alone names the room's excerpt
 *   file; any other `<group>` is a configured group and needs a `<path>`,
 *   checked by the rule `resource.read` uses. `excerpt` is not a context
 *   group: the codec reads it as this one value. Never a free path.
 * - **`history.log`** takes an optional `<page>`, read by the shared
 *   `workshopCapabilityPage`.
 * - **`history.diff`** needs `<from>` (a commit) and `<to>` (a commit, or
 *   `current`). A commit is 7 to 40 hex characters, read lower case. That
 *   is form only: whether it is in this file's history is the host's
 *   question, asked of the log before anything reaches git. `<startChange>`
 *   is read by the page rule (a whole number from one, in plain digits);
 *   `<current>` (12 hex) only beside `<to>current</to>`.
 *
 * No field repeats and none carries attributes. Every rejection names its
 * operation, so the persona capability leaves a visible artifact for it.
 */

import type {
  WorkshopHistoryDiffTarget,
  WorkshopHistoryRequest
} from '@shared/types/workshopCapabilities';
import type {
  WorkshopCapabilityXmlCall,
  WorkshopCapabilityXmlFieldPolicy
} from '@/application/services/workshop/WorkshopCapabilityXmlDocument';
import type { WorkshopCapabilityRejectionReason } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { workshopCapabilityPage } from '@/application/services/workshop/WorkshopCapabilityPaging';
import { inspectWorkshopCapabilityFile } from '@/application/services/workshop/WorkshopCapabilityFileXml';

type HistoryOperation = WorkshopHistoryRequest['capability'];

/** The one `<group>` value that is not a context group: the room's excerpt file. */
export { WORKSHOP_FILE_EXCERPT_GROUP as WORKSHOP_HISTORY_EXCERPT_GROUP } from '@/application/services/workshop/WorkshopCapabilityFileXml';
/** `<to>`'s one word that is not a commit: the file as saved on disk. */
export const WORKSHOP_HISTORY_CURRENT = 'current';

/** A commit id as a persona may write one: the form only (D14). */
const COMMIT_ID = /^[0-9a-f]{7,40}$/;
/** `<current>`: the first 12 hex of the saved text's SHA-256 (D13). */
const CURRENT_MARK = /^[0-9a-f]{12}$/;

export interface WorkshopHistoryRejection {
  readonly kind: 'invalid';
  readonly reason: WorkshopCapabilityRejectionReason;
  readonly field?: string;
  readonly operation: HistoryOperation;
}

export type WorkshopHistoryInspection =
  | { readonly kind: 'request'; readonly request: WorkshopHistoryRequest }
  | WorkshopHistoryRejection;

/** No `history.*` field repeats, and none carries an attribute. */
export const WORKSHOP_HISTORY_FIELD_POLICY: WorkshopCapabilityXmlFieldPolicy = {
  repeatable: () => false,
  attributes: () => []
};

const OPERATION_FIELDS: ReadonlyMap<HistoryOperation, { readonly allowed: readonly string[]; readonly required: readonly string[] }> = new Map([
  ['history.log', { allowed: ['group', 'path', 'page'], required: ['group'] }],
  ['history.diff', { allowed: ['group', 'path', 'from', 'to', 'startChange', 'current'], required: ['group', 'from', 'to'] }]
]);

/** Whether `value` has a commit id's form, read lower case. */
export function isWorkshopHistoryCommitForm(value: string): boolean {
  return COMMIT_ID.test(value.toLowerCase());
}

export function inspectWorkshopHistoryCall(
  operation: HistoryOperation,
  call: Pick<WorkshopCapabilityXmlCall, 'fields' | 'elements'>
): WorkshopHistoryInspection {
  const reject = (reason: WorkshopCapabilityRejectionReason, field?: string): WorkshopHistoryRejection =>
    ({ kind: 'invalid', reason, operation, ...(field !== undefined ? { field } : {}) });
  const { allowed, required } = OPERATION_FIELDS.get(operation)!;
  const unexpected = call.elements.find((element) => !allowed.includes(element.name));
  if (unexpected) {
    return reject('unexpected-field', unexpected.name);
  }
  const missing = required.find((field) => !call.fields.has(field));
  if (missing) {
    return reject('missing-field', missing);
  }
  // An empty `<page>` or `<startChange>` is outside the number's own domain, so it is refused as one.
  for (const [field, reason] of [['page', 'invalid-page'], ['startChange', 'invalid-start-change']] as const) {
    if (call.fields.get(field) === '') {
      return reject(reason, field);
    }
  }
  const empty = call.elements.find((element) => element.value.length === 0);
  if (empty) {
    return reject('empty-field', empty.name);
  }
  const named = inspectWorkshopCapabilityFile(call.fields);
  if (named.kind === 'invalid') {
    return { ...named, operation };
  }

  switch (operation) {
    case 'history.log': {
      const written = call.fields.get('page');
      const page = written === undefined ? undefined : workshopCapabilityPage(written);
      if (page?.kind === 'invalid') {
        return reject('invalid-page', 'page');
      }
      return { kind: 'request', request: { capability: operation, file: named, ...(page ? { page: page.page } : {}) } };
    }
    case 'history.diff': {
      const from = call.fields.get('from')!.toLowerCase();
      if (!COMMIT_ID.test(from)) {
        return reject('invalid-commit', 'from');
      }
      const to = diffTarget(call.fields, reject);
      if (to.kind === 'invalid') {
        return to;
      }
      const written = call.fields.get('startChange');
      const start = written === undefined ? undefined : workshopCapabilityPage(written);
      if (start?.kind === 'invalid') {
        return reject('invalid-start-change', 'startChange');
      }
      return {
        kind: 'request',
        request: {
          capability: operation,
          file: named,
          from,
          to,
          ...(start ? { startChange: start.page } : {})
        }
      };
    }
    default:
      return assertNever(operation);
  }
}

function diffTarget(
  fields: ReadonlyMap<string, string>,
  reject: (reason: WorkshopCapabilityRejectionReason, field?: string) => WorkshopHistoryRejection
): WorkshopHistoryDiffTarget | WorkshopHistoryRejection {
  const to = fields.get('to')!.toLowerCase();
  const mark = fields.get('current');
  if (to === WORKSHOP_HISTORY_CURRENT) {
    if (mark !== undefined && !CURRENT_MARK.test(mark.toLowerCase())) {
      return reject('invalid-current', 'current');
    }
    return { kind: 'current', ...(mark !== undefined ? { fingerprint: mark.toLowerCase() } : {}) };
  }
  if (mark !== undefined) {
    // The saved text's mark means something only beside `current`.
    return reject('unexpected-field', 'current');
  }
  return COMMIT_ID.test(to) ? { kind: 'commit', commit: to } : reject('invalid-commit', 'to');
}

function assertNever(value: never): never {
  throw new Error(`Unhandled history operation: ${String(value)}`);
}

/**
 * Request validation for the `lens.*` calls (ADR 2026-11-17 D17, D18). The
 * library is asked only what this codec has checked:
 *
 * - `lens.catalog` takes an optional `<page>`, read by the shared
 *   `workshopCapabilityPage`: absent means the first page, and there is no
 *   highest;
 * - `lens.read` names one `<lens>` slug of at most
 *   `lexicalLensSlugCharacters` (any case, read as lower case), and
 *   optionally one to `readSections` distinct `<section>` names from the
 *   closed list. A slug is never a path: whether it names a lens is the
 *   library's question, asked of its listing.
 *
 * Every rejection names its operation, so the persona capability leaves a
 * visible artifact for it, as the other read-only families do.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  WORKSHOP_LENS_SECTIONS,
  type WorkshopLensRequest,
  type WorkshopLensSection
} from '@shared/types/workshopCapabilities';
import type {
  WorkshopCapabilityXmlCall,
  WorkshopCapabilityXmlFieldPolicy
} from '@/application/services/workshop/WorkshopCapabilityXmlDocument';
import type { WorkshopCapabilityRejectionReason } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { workshopCapabilityPage } from '@/application/services/workshop/WorkshopCapabilityPaging';

type LensOperation = WorkshopLensRequest['capability'];

export interface WorkshopLensRejection {
  readonly kind: 'invalid';
  readonly reason: WorkshopCapabilityRejectionReason;
  readonly field?: string;
  readonly operation: LensOperation;
}

export type WorkshopLensInspection =
  | { readonly kind: 'request'; readonly request: WorkshopLensRequest }
  | WorkshopLensRejection;

/** `lens.read` alone repeats a field: one `<section>` per section. */
export const WORKSHOP_LENS_FIELD_POLICY: Pick<WorkshopCapabilityXmlFieldPolicy, 'repeatable'> = {
  repeatable: (operation, field) => operation === 'lens.read' && field === 'section'
};

/** Each operation's fields: those it allows, and those it requires. */
const OPERATION_FIELDS: ReadonlyMap<LensOperation, { readonly allowed: readonly string[]; readonly required: readonly string[] }> = new Map([
  ['lens.catalog', { allowed: ['page'], required: [] }],
  ['lens.read', { allowed: ['lens', 'section'], required: ['lens'] }]
]);

export function inspectWorkshopLensCall(
  operation: LensOperation,
  call: Pick<WorkshopCapabilityXmlCall, 'fields' | 'elements'>
): WorkshopLensInspection {
  const reject = (reason: WorkshopCapabilityRejectionReason, field?: string): WorkshopLensRejection =>
    ({ kind: 'invalid', reason, operation, ...(field !== undefined ? { field } : {}) });
  const { allowed, required } = OPERATION_FIELDS.get(operation)!;
  const unexpected = call.elements.find((element) => !allowed.includes(element.name));
  if (unexpected) {
    return reject('unexpected-field', unexpected.name);
  }
  const missing = required.find((field) => !call.elements.some((element) => element.name === field));
  if (missing) {
    return reject('missing-field', missing);
  }
  // An empty `<page>` is outside the page's own domain, so it is refused as the page is.
  if (call.elements.some((element) => element.name === 'page' && element.value.length === 0)) {
    return reject('invalid-page', 'page');
  }
  const empty = call.elements.find((element) => element.value.length === 0);
  if (empty) {
    return reject('empty-field', empty.name);
  }

  switch (operation) {
    case 'lens.catalog': {
      const written = call.fields.get('page');
      const page = written === undefined ? undefined : workshopCapabilityPage(written);
      if (page?.kind === 'invalid') {
        return reject('invalid-page', 'page');
      }
      return { kind: 'request', request: { capability: operation, ...(page ? { page: page.page } : {}) } };
    }
    case 'lens.read': {
      const lens = call.fields.get('lens')!;
      if (lens.length > PROMPT_BUDGETS.workshopWidgets.lexicalLensSlugCharacters) {
        return reject('oversized-input', 'lens');
      }
      const named = call.elements.filter((element) => element.name === 'section');
      // More sections than the closed list holds: a name is unknown or repeated, so no count reason is needed.
      const sections: WorkshopLensSection[] = [];
      for (const { value } of named) {
        const section = WORKSHOP_LENS_SECTIONS.find((candidate) => candidate === value.toLowerCase());
        if (!section) {
          return reject('invalid-section', 'section');
        }
        if (sections.includes(section)) {
          return reject('duplicate-section', 'section');
        }
        sections.push(section);
      }
      return {
        kind: 'request',
        request: { capability: operation, lens: lens.toLowerCase(), ...(sections.length > 0 ? { sections } : {}) }
      };
    }
    default:
      return assertNever(operation);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled lens operation: ${String(value)}`);
}

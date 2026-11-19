/**
 * Request validation for the `locations.*` calls (ADR 2026-11-19 D26). The
 * host is asked only what this codec has checked:
 *
 * - **`locations.current`** takes no field.
 * - **`locations.folders`** takes an optional `<page>`, read by the shared
 *   `workshopCapabilityPage`: absent means the first page, and there is no
 *   highest.
 * - **`locations.check`** takes one to `checkPatterns` `<pattern>`
 *   elements, each with a `group` attribute naming a context-path group,
 *   and at most `patternCharacters` long. Whether a pattern is safe, and
 *   what it matches, is the checker's question, asked of the real resolver:
 *   the codec judges no pattern's form.
 *
 * Every rejection names its operation, so the persona capability leaves a
 * visible artifact for it, as the other read-only families do.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { isContextPathGroup } from '@shared/types';
import type { WorkshopLocationsCheckPattern, WorkshopLocationsRequest } from '@shared/types/workshopCapabilities';
import type {
  WorkshopCapabilityXmlCall,
  WorkshopCapabilityXmlFieldPolicy
} from '@/application/services/workshop/WorkshopCapabilityXmlDocument';
import type { WorkshopCapabilityRejectionReason } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { workshopCapabilityPage } from '@/application/services/workshop/WorkshopCapabilityPaging';

type LocationsOperation = WorkshopLocationsRequest['capability'];

export interface WorkshopLocationsRejection {
  readonly kind: 'invalid';
  readonly reason: WorkshopCapabilityRejectionReason;
  readonly field?: string;
  readonly operation: LocationsOperation;
}

export type WorkshopLocationsInspection =
  | { readonly kind: 'request'; readonly request: WorkshopLocationsRequest }
  | WorkshopLocationsRejection;

/** `locations.check` alone repeats a field, `<pattern>`, and it alone carries an attribute, `group`. */
export const WORKSHOP_LOCATIONS_FIELD_POLICY: WorkshopCapabilityXmlFieldPolicy = {
  repeatable: (operation, field) => operation === 'locations.check' && field === 'pattern',
  attributes: (operation, field) => (operation === 'locations.check' && field === 'pattern' ? ['group'] : [])
};

const OPERATION_FIELDS: ReadonlyMap<LocationsOperation, readonly string[]> = new Map([
  ['locations.current', []],
  ['locations.folders', ['page']],
  ['locations.check', ['pattern']]
]);

export function inspectWorkshopLocationsCall(
  operation: LocationsOperation,
  call: Pick<WorkshopCapabilityXmlCall, 'fields' | 'elements'>
): WorkshopLocationsInspection {
  const reject = (reason: WorkshopCapabilityRejectionReason, field?: string): WorkshopLocationsRejection =>
    ({ kind: 'invalid', reason, operation, ...(field !== undefined ? { field } : {}) });
  const allowed = OPERATION_FIELDS.get(operation)!;
  const unexpected = call.elements.find((element) => !allowed.includes(element.name));
  if (unexpected) {
    return reject('unexpected-field', unexpected.name);
  }

  switch (operation) {
    case 'locations.current':
      return { kind: 'request', request: { capability: operation } };
    case 'locations.folders': {
      const written = call.fields.get('page');
      // An empty `<page>` is outside the page's own domain, so it is refused as the page is.
      const page = written === undefined ? undefined : workshopCapabilityPage(written);
      if (page?.kind === 'invalid') {
        return reject('invalid-page', 'page');
      }
      return { kind: 'request', request: { capability: operation, ...(page ? { page: page.page } : {}) } };
    }
    case 'locations.check': {
      const named = call.elements.filter((element) => element.name === 'pattern');
      if (named.length === 0) {
        return reject('missing-field', 'pattern');
      }
      if (named.length > PROMPT_BUDGETS.contextPaths.checkPatterns) {
        return reject('too-many-patterns', 'pattern');
      }
      const patterns: WorkshopLocationsCheckPattern[] = [];
      for (const element of named) {
        const group = element.attributes.group;
        if (group === undefined) {
          return reject('missing-pattern-group', 'pattern');
        }
        if (!isContextPathGroup(group)) {
          return reject('unknown-resource-group', 'pattern');
        }
        if (element.value.length === 0) {
          return reject('empty-field', 'pattern');
        }
        if (element.value.length > PROMPT_BUDGETS.contextPaths.patternCharacters) {
          return reject('oversized-input', 'pattern');
        }
        patterns.push({ group, pattern: element.value });
      }
      return { kind: 'request', request: { capability: operation, patterns } };
    }
    default:
      return assertNever(operation);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled locations operation: ${String(value)}`);
}

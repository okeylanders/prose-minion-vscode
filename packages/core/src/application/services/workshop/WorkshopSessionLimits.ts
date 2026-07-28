import {
  WORKSHOP_ACTIONABLE_FINDING_BOUNDS
} from '@/application/services/workshop/WorkshopActionableFindings';

/**
 * Aggregate limits are runtime domain policy, not part of any one persisted
 * schema codec. Versioned decoders import these limits without owning them.
 */
export const WORKSHOP_TODO_BOUNDS = Object.freeze({
  items: 200,
  textCharacters: WORKSHOP_ACTIONABLE_FINDING_BOUNDS.itemCharacters
});

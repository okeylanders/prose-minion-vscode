/**
 * Display label for a persona-requested capability artifact (dictionary
 * lookups, project-resource reads, persona-run analyses). Shared by the
 * thread bubble's collapsed summary and the transcript export, so both name
 * the same artifact the same way.
 */

import {
  workshopCapabilityFamily,
  type WorkshopCapabilityArtifactDetails,
  type WorkshopCapabilityOperation
} from '@shared/types/workshopCapabilities';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';

export function workshopCapabilityArtifactLabel(
  capability: WorkshopCapabilityArtifactDetails,
  toolLabel?: string
): string {
  return `${workshopCapabilityFamilyLabel(capability.operation, toolLabel)} · ${
    capability.requestSummary
  } · requested by ${workshopPersonaLabel(capability.requestedByPersonaId)}`;
}

/**
 * The family name an artifact turn carries as its tool label — also what other
 * participants read as `${toolLabel} (report)`. An analysis artifact is named
 * after its tool; the other families name themselves.
 */
export function workshopCapabilityFamilyLabel(
  operation: WorkshopCapabilityOperation,
  toolLabel?: string
): string {
  switch (workshopCapabilityFamily(operation)) {
    case 'dictionary':
      return "Writer's Dictionary";
    case 'resource':
      return 'Project Resources';
    case 'analysis':
      return toolLabel ?? 'Analysis';
  }
}

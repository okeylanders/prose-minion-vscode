/**
 * Display label for a persona-requested capability artifact (dictionary
 * lookups, project-resource reads, persona-run analyses). Shared by the
 * thread bubble's collapsed summary and the transcript export, so both name
 * the same artifact the same way.
 */

import type { WorkshopCapabilityArtifactDetails } from '@shared/types/workshopCapabilities';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';

export function workshopCapabilityArtifactLabel(
  capability: WorkshopCapabilityArtifactDetails,
  toolLabel?: string
): string {
  const family = capability.operation.startsWith('dictionary.')
    ? "Writer's Dictionary"
    : capability.operation.startsWith('resource.')
      ? 'Project Resources'
      : toolLabel ?? 'Analysis';
  return `${family} · ${capability.requestSummary} · requested by ${
    workshopPersonaLabel(capability.requestedByPersonaId)
  }`;
}

/**
 * The metrics a persona capability's completion log line carries, by
 * family. Each family's metadata names different things, so the switch is
 * exhaustive: a new family must say what it logs instead of inheriting
 * another's "none" (PR #125 review F-01).
 */

import type { WorkshopPersonaAnalysisRunInputs } from '@/application/services/workshop/WorkshopAnalysisInputs';
import {
  workshopCapabilityFamily,
  type WorkshopCapabilityResult
} from '@shared/types/workshopCapabilities';

export function workshopCapabilityResultLogSummary(result: WorkshopCapabilityResult): string {
  const family = workshopCapabilityFamily(result.capability);
  switch (family) {
    case 'analysis':
      return analysisMetrics(result);
    case 'resource':
      return resourceMetrics(result.metadata);
    case 'dictionary':
      // The dictionary's metadata is its own log's business; the line keeps its old shape.
      return 'resourceMetrics=none';
    default: {
      const unhandled: never = family;
      throw new Error(`Unhandled Workshop capability family: ${String(unhandled)}`);
    }
  }
}

function analysisMetrics(result: WorkshopCapabilityResult): string {
  const metadata = result.metadata;
  const inputs = metadata?.analysisInputs as
    | WorkshopPersonaAnalysisRunInputs['provenance']
    | undefined;
  const values = [
    `excerptMode=${inputs?.excerpt.mode ?? 'n/a'}`,
    `excerptWords=${inputs?.excerpt.words ?? 'n/a'}`,
    `contextMode=${inputs?.context.mode ?? 'n/a'}`,
    `contextWords=${inputs?.context.words ?? 'n/a'}`,
    `truncated=${metadata?.truncated === true}`,
    `rejection=${typeof metadata?.rejectionReason === 'string'
      ? `${metadata.rejectionReason}:${String(metadata.rejectionField ?? 'n/a')}`
      : result.status === 'rejected' ? 'unspecified' : 'none'}`
  ];
  return `analysisMetrics=${values.join(';')}`;
}

function resourceMetrics(metadata: WorkshopCapabilityResult['metadata']): string {
  if (!metadata) {
    return 'resourceMetrics=none';
  }
  const values = [
    `group=${typeof metadata.group === 'string' ? metadata.group : 'n/a'}`,
    `path=${typeof metadata.path === 'string' ? JSON.stringify(metadata.path) : 'n/a'}`,
    `lines=${typeof metadata.startLine === 'number' ? metadata.startLine : 'n/a'}-${typeof metadata.endLine === 'number' ? metadata.endLine : 'n/a'}`,
    `searchMode=${typeof metadata.searchMode === 'string' ? metadata.searchMode : 'n/a'}`,
    `catalogEntries=${typeof metadata.catalogEntriesScanned === 'number' ? metadata.catalogEntriesScanned : 'n/a'}`,
    `files=${typeof metadata.filesScanned === 'number' ? metadata.filesScanned : typeof metadata.fileCount === 'number' ? metadata.fileCount : 'n/a'}`,
    `matches=${typeof metadata.matchCount === 'number' ? metadata.matchCount : 'n/a'}`,
    `bytes=${typeof metadata.bytes === 'number' ? metadata.bytes : typeof metadata.bytesScanned === 'number' ? metadata.bytesScanned : 'n/a'}`,
    `truncated=${metadata.truncated === true}`
  ];
  return `resourceMetrics=${values.join(';')}`;
}

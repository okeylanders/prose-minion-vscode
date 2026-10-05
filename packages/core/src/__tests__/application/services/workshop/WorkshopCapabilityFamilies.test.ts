/**
 * Characterizes how each capability operation is named today: the tool label
 * the session stamps on its artifact turn (also what other participants read
 * as `${toolLabel} (report)`), and the collapsed label the thread and the
 * transcript export show. A new operation family must get its own names here,
 * never fall through to another family's.
 */

import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { workshopCapabilityArtifactLabel } from '@shared/constants/workshopCapabilityLabels';
import type { WorkshopCapabilityOperation } from '@shared/types/workshopCapabilities';
import type { WorkshopToolId } from '@messages';

const REQUEST = 'host-request';

const recordArtifact = (operation: WorkshopCapabilityOperation, toolId?: WorkshopToolId) => {
  const session = new WorkshopSessionService(() => 7);
  session.setExcerpt({ text: 'The cup crossed the table.', source: { kind: 'manual' } });
  session.beginPersonaMessage(REQUEST, 'Help me revise this.');
  const recorded = session.recordCapabilityArtifact({
    requestId: REQUEST,
    excerptVersion: session.getExcerptVersion(),
    toolId,
    details: {
      operation,
      status: 'success',
      requestSummary: 'liminal',
      requestedByPersonaId: 'jill',
      invokedBy: { kind: 'host' }
    },
    result: { capability: operation, status: 'success', requestSummary: 'liminal', content: 'Evidence.' }
  });
  if (!recorded) {
    throw new Error(`${operation} artifact was refused`);
  }
  return recorded.turn;
};

describe('capability family names', () => {
  it.each([
    ['dictionary.lookup', undefined, "Writer's Dictionary"],
    ['dictionary.full-entry', undefined, "Writer's Dictionary"],
    ['analysis.run', 'continuity', 'Continuity'],
    ['analysis.run', undefined, 'Analysis'],
    ['resource.catalog', undefined, 'Project Resources'],
    ['resource.search', undefined, 'Project Resources'],
    ['resource.read', undefined, 'Project Resources']
  ] as const)('names a %s artifact (tool %s) as %s', (operation, toolId, family) => {
    const turn = recordArtifact(operation, toolId);

    expect(turn.toolLabel).toBe(family);
    expect(workshopCapabilityArtifactLabel(turn.capability!, turn.toolLabel))
      .toBe(`${family} · liminal · requested by Jill`);
  });
});

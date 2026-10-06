import {
  WORKSHOP_CAPABILITY_OPERATIONS,
  WorkshopCapabilityOperation,
  isWorkshopCapabilityOperation,
  workshopCapabilityFamily
} from '@shared/types/workshopCapabilities';
import { workshopCapabilityFamilyLabel } from '@shared/constants/workshopCapabilityLabels';

describe('workshopCapabilityFamily', () => {
  it('places every listed operation in exactly one family', () => {
    // A new operation must be added here deliberately, never inherit a family.
    expect(
      WORKSHOP_CAPABILITY_OPERATIONS.map((operation) => [operation, workshopCapabilityFamily(operation)])
    ).toEqual([
      ['dictionary.lookup', 'dictionary'],
      ['dictionary.full-entry', 'dictionary'],
      ['analysis.run', 'analysis'],
      ['resource.catalog', 'resource'],
      ['resource.search', 'resource'],
      ['resource.read', 'resource'],
      ['transcript.catalog', 'transcript'],
      ['transcript.search', 'transcript'],
      ['transcript.read', 'transcript'],
      ['transcript.todos', 'transcript']
    ]);
  });

  it('refuses an operation outside the list rather than guessing a family', () => {
    // `memory.*` is reserved for derived material (ADR 2026-10-05) and listed nowhere.
    expect(() => workshopCapabilityFamily('memory.read' as WorkshopCapabilityOperation))
      .toThrow('Unhandled Workshop capability operation: memory.read');
  });

  it('recognizes only listed operations', () => {
    expect(WORKSHOP_CAPABILITY_OPERATIONS.every(isWorkshopCapabilityOperation)).toBe(true);
    expect(isWorkshopCapabilityOperation('memory.read')).toBe(false);
    expect(isWorkshopCapabilityOperation('transcript')).toBe(false);
    expect(isWorkshopCapabilityOperation(undefined)).toBe(false);
  });

  it('names analysis artifacts after their tool and other families after themselves', () => {
    expect(workshopCapabilityFamilyLabel('analysis.run', 'Continuity')).toBe('Continuity');
    expect(workshopCapabilityFamilyLabel('analysis.run')).toBe('Analysis');
    expect(workshopCapabilityFamilyLabel('dictionary.lookup', 'Continuity')).toBe("Writer's Dictionary");
    expect(workshopCapabilityFamilyLabel('resource.read', 'Continuity')).toBe('Project Resources');
    expect(workshopCapabilityFamilyLabel('transcript.read', 'Continuity')).toBe('Session Recall');
  });
});

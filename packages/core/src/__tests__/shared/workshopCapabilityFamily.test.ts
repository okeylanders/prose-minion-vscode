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
      ['transcript.todos', 'transcript'],
      ['transcript.bookmarks', 'transcript'],
      ['memory.catalog', 'memory'],
      ['memory.search', 'memory'],
      ['memory.read', 'memory'],
      ['lens.catalog', 'lens'],
      ['lens.read', 'lens'],
      ['help.search', 'help'],
      ['help.read', 'help'],
      ['history.log', 'history'],
      ['history.diff', 'history'],
      ['locations.current', 'locations'],
      ['locations.folders', 'locations'],
      ['locations.check', 'locations'],
      ['problems.read', 'problems']
    ]);
  });

  it('refuses an operation outside the list rather than guessing a family', () => {
    // `memory.*` is read-only (ADR 2026-11-04 D1): a write operation is listed nowhere.
    expect(() => workshopCapabilityFamily('memory.save' as WorkshopCapabilityOperation))
      .toThrow('Unhandled Workshop capability operation: memory.save');
  });

  it('recognizes only listed operations', () => {
    expect(WORKSHOP_CAPABILITY_OPERATIONS.every(isWorkshopCapabilityOperation)).toBe(true);
    // The family was reserved by ADR 2026-10-05 and is listed now (ADR 2026-11-04 D12).
    expect(isWorkshopCapabilityOperation('memory.read')).toBe(true);
    expect(isWorkshopCapabilityOperation('memory.save')).toBe(false);
    // The lens family is two reads (ADR 2026-11-17 D16): no search, and no write, is listed.
    expect(isWorkshopCapabilityOperation('lens.catalog')).toBe(true);
    expect(isWorkshopCapabilityOperation('lens.read')).toBe(true);
    expect(isWorkshopCapabilityOperation('lens.search')).toBe(false);
    expect(isWorkshopCapabilityOperation('lens.save')).toBe(false);
    expect(isWorkshopCapabilityOperation('help.read')).toBe(true);
    expect(isWorkshopCapabilityOperation('help.search')).toBe(true);
    expect(isWorkshopCapabilityOperation('help.catalog')).toBe(false);
    expect(isWorkshopCapabilityOperation('transcript')).toBe(false);
    expect(isWorkshopCapabilityOperation(undefined)).toBe(false);
  });

  it('names analysis artifacts after their tool and other families after themselves', () => {
    expect(workshopCapabilityFamilyLabel('analysis.run', 'Continuity')).toBe('Continuity');
    expect(workshopCapabilityFamilyLabel('analysis.run')).toBe('Analysis');
    expect(workshopCapabilityFamilyLabel('dictionary.lookup', 'Continuity')).toBe("Writer's Dictionary");
    expect(workshopCapabilityFamilyLabel('resource.read', 'Continuity')).toBe('Project Resources');
    expect(workshopCapabilityFamilyLabel('transcript.read', 'Continuity')).toBe('Session Recall');
    expect(workshopCapabilityFamilyLabel('memory.read', 'Continuity')).toBe('Project Memory');
    expect(workshopCapabilityFamilyLabel('lens.read', 'Continuity')).toBe('Lens Library');
    expect(workshopCapabilityFamilyLabel('lens.catalog')).toBe('Lens Library');
    expect(workshopCapabilityFamilyLabel('history.diff')).toBe('File History');
    expect(workshopCapabilityFamilyLabel('problems.read')).toBe('File Problems');
  });
});

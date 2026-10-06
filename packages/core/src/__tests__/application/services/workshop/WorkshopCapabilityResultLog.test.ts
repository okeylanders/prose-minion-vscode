import { workshopCapabilityResultLogSummary } from '@/application/services/workshop/WorkshopCapabilityResultLog';
import type { WorkshopCapabilityResult } from '@shared/types/workshopCapabilities';

const result = (overrides: Partial<WorkshopCapabilityResult>): WorkshopCapabilityResult => ({
  capability: 'dictionary.lookup',
  status: 'success',
  requestSummary: 'liminal',
  ...overrides
});

describe('a persona capability’s completion log metrics, by family', () => {
  it('keeps the dictionary’s line as it was', () => {
    expect(workshopCapabilityResultLogSummary(result({ metadata: { truncated: false } })))
      .toBe('resourceMetrics=none');
  });

  it('names a resource result’s bounds, and none without metadata', () => {
    expect(workshopCapabilityResultLogSummary(result({
      capability: 'resource.search',
      metadata: { group: 'characters', searchMode: 'catalog', filesScanned: 3, matchCount: 2, bytesScanned: 900 }
    }))).toBe(
      'resourceMetrics=group=characters;path=n/a;lines=n/a-n/a;searchMode=catalog;catalogEntries=n/a;' +
        'files=3;matches=2;bytes=900;truncated=false'
    );
    expect(workshopCapabilityResultLogSummary(result({ capability: 'resource.catalog' }))).toBe('resourceMetrics=none');
  });

  it('names an analysis run’s inputs and any rejection', () => {
    expect(workshopCapabilityResultLogSummary(result({
      capability: 'analysis.run',
      status: 'rejected',
      metadata: { rejectionReason: 'analysis-run-limit' }
    }))).toBe(
      'analysisMetrics=excerptMode=n/a;excerptWords=n/a;contextMode=n/a;contextWords=n/a;' +
        'truncated=false;rejection=analysis-run-limit:n/a'
    );
  });
});

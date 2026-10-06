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

  it('counts a session-recall result, and never its titles or text', () => {
    expect(workshopCapabilityResultLogSummary(result({
      capability: 'transcript.read',
      metadata: {
        outcome: 'read', sessionsRead: 3, parsedBytes: 4_096, cacheHits: 1, unreadableSessions: 0,
        characters: 52_000, truncated: true, limitedBy: 'context-window',
        sessions: [{ title: 'Chapter 6.7 stock pass' }]
      }
    }))).toBe(
      'recallMetrics=outcome=read;sessions=3;parsedBytes=4096;cacheHits=1;unreadable=0;' +
        'characters=52000;truncated=true;limitedBy=context-window;rejection=none'
    );
    expect(workshopCapabilityResultLogSummary(result({
      capability: 'transcript.todos',
      status: 'rejected',
      metadata: { rejectionReason: 'conflicting-session-selection' }
    }))).toBe(
      'recallMetrics=outcome=n/a;sessions=n/a;parsedBytes=n/a;cacheHits=n/a;unreadable=n/a;' +
        'characters=n/a;truncated=false;limitedBy=n/a;rejection=conflicting-session-selection'
    );
  });
});

/**
 * Whether a persona's passage search read everything it planned: the one
 * rule for the host sending a result by itself (ADR 2026-11-20 D21; the
 * orchestrator's rule for PR #296). Only a search that ended `complete` or
 * `instance-limit` with every planned file searched in full and no read
 * failed, cut off, stopped in flight or never sent qualifies. Made-up text:
 * Alice.
 */

import {
  isWorkshopPassageSearchFullyRead,
  workshopPassageSearchCoverage,
  type WorkshopPassageSearchCoverage
} from '@/application/services/workshop/passageSearch/WorkshopPassageSearchCoverage';
import { workshopPassageSearchView } from '@handlers/domain/workshop/WorkshopPassageSearchResultView';
import { aliceAcrossFiles, aliceResult } from '@/__tests__/application/handlers/domain/workshop/passageSearchRouteFixtures';

const whole: WorkshopPassageSearchCoverage = {
  ended: 'complete',
  calls: { failed: 0, cut: 0, cancelled: 0, unsent: 0 },
  files: { planned: 6, searchedInFull: 6 }
};

describe('a passage search\'s coverage', () => {
  it('reads it from the shared view the card and the directive render', () => {
    expect(workshopPassageSearchCoverage(workshopPassageSearchView(aliceAcrossFiles(1, 20), 'r-1'))).toEqual({
      ended: 'complete', calls: { failed: 0, cut: 0, cancelled: 0, unsent: 0 }, files: { planned: 20, searchedInFull: 20 }
    });
  });

  it('is whole only for a search that ended reading everything and read all of it', () => {
    expect(isWorkshopPassageSearchFullyRead(whole)).toBe(true);
    // The instance bound reached with every read answered: nothing went unsearched.
    expect(isWorkshopPassageSearchFullyRead({ ...whole, ended: 'instance-limit' })).toBe(true);
  });

  it.each<[string, Partial<WorkshopPassageSearchCoverage>]>([
    ['a stopped search', { ended: 'stopped' }],
    ['a search ended by a changed key', { ended: 'key-changed' }],
    ['a search ended by a provider that refused its calls', { ended: 'provider-failed' }],
    ['a failed read', { calls: { ...whole.calls, failed: 1 } }],
    ['a reply cut off at its length limit', { calls: { ...whole.calls, cut: 1 } }],
    ['a read stopped in flight', { calls: { ...whole.calls, cancelled: 1 } }],
    ['a read never sent, the instance bound reached', { ended: 'instance-limit', calls: { ...whole.calls, unsent: 2 } }],
    ['a planned file searched only in part', { files: { planned: 6, searchedInFull: 5 } }]
  ])('is not whole for %s, which waits on the card for Send', (_name, change) => {
    expect(isWorkshopPassageSearchFullyRead({ ...whole, ...change })).toBe(false);
  });

  it('a complete search whose one file was searched in part is not whole, whatever its call counts say', () => {
    const result = aliceResult(2, { files: { ...aliceResult(2).files, searched: { full: 0, partial: 1, none: 0 } } });
    expect(isWorkshopPassageSearchFullyRead(workshopPassageSearchCoverage(workshopPassageSearchView(result, 'r-1')))).toBe(false);
  });
});

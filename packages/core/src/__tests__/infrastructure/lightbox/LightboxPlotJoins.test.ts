/**
 * Group E's host joins (ADR 2026-10-19 D7 addendum; Slice 4C), pure over the
 * board's own tiles: the freshness basis line, joined from group D's tier
 * counts and group E's found template beats, shown only when both halves
 * are on the board and current, and never sent to a model; and the counts
 * and per-column lanes the ribbon draws from host spans and ranges, on a
 * bucketed ribbon too. Readings are the worked examples' over ¶1–¶8 of
 * "Alice's Adventures in Wonderland" (1865, public domain).
 */
import type { LightboxReadingGroup } from '@messages';
import {
  LIGHTBOX_BASIS_LINES,
  lightboxArtifactsSummary,
  lightboxColumnMovements,
  lightboxFreshnessBasis,
  lightboxMovementNumeral,
  lightboxPressureCounts,
  lightboxPressureLane
} from '@shared/constants/lightboxPlot';
import { buildLightboxUserMessage } from '@/infrastructure/lightbox/LightboxReadingPrompts';
import { readGroup } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';
import { ALICE, STORY, storyBody, storyGroup, tilesOf } from './lightboxPlotFixtures';

const D = (): LightboxReadingGroup => readGroup('D');
const stale = (group: LightboxReadingGroup, lens: LightboxReadingGroup['lenses'][number]): LightboxReadingGroup =>
  ({ ...group, staleLenses: [{ lens, readAgainst: 'old' }] });

describe('the freshness basis: a host join of groups D and E (Slice 4C)', () => {
  it('joins D\'s signature share of its found beats with E\'s subverted template beats when both are current', () => {
    expect(lightboxFreshnessBasis([D(), storyGroup()])).toEqual({
      status: 'current',
      signature: 8,
      classified: 16,
      percent: 50,
      subverted: 2,
      beats: 5,
      line: '8 of 16 classified beats signature (50%) · 2 of 5 template beats subverted'
    });
  });

  it('says which half is missing, stale or being read again, and counts nothing then', () => {
    expect(lightboxFreshnessBasis([])).toEqual({ status: 'missing', line: LIGHTBOX_BASIS_LINES.missingBoth });
    expect(lightboxFreshnessBasis([storyGroup()])).toEqual({ status: 'missing', line: LIGHTBOX_BASIS_LINES.missingStock });
    expect(lightboxFreshnessBasis([D()])).toEqual({ status: 'missing', line: LIGHTBOX_BASIS_LINES.missingTemplate });
    expect(lightboxFreshnessBasis([stale(D(), 'stock'), storyGroup()])).toEqual({ status: 'stale', line: LIGHTBOX_BASIS_LINES.staleStock });
    expect(lightboxFreshnessBasis([D(), stale(storyGroup(), 'template')])).toEqual({ status: 'stale', line: LIGHTBOX_BASIS_LINES.staleTemplate });
    // A stale lens elsewhere in the group leaves the basis current.
    expect(lightboxFreshnessBasis([D(), stale(storyGroup(), 'pressure')]).status).toBe('current');
    const rereading: LightboxReadingGroup = { ...D(), status: 'running', pending: ['stock'] };
    expect(lightboxFreshnessBasis([rereading, storyGroup()])).toEqual({ status: 'reading', line: LIGHTBOX_BASIS_LINES.reading });
    const body = storyBody();
    body.template.beats = [];
    expect(lightboxFreshnessBasis([D(), storyGroup(body)])).toEqual({ status: 'missing', line: LIGHTBOX_BASIS_LINES.noBeats });
  });

  it('counts only beats the host found: a withheld beat is in neither half', () => {
    const body = storyBody();
    body.template.beats[4].evidence[0].quote = 'she was frightened of falling';
    const basis = lightboxFreshnessBasis([D(), storyGroup(body)]);
    expect(basis.status === 'current' && [basis.subverted, basis.beats]).toEqual([1, 4]);
  });

  it('is never sent to a model: no group\'s task names a count from another group', () => {
    const material = { paragraphs: ALICE, columns: ALICE.map((_text, index) => ({ from: index + 1, to: index + 1 })), context: [] };
    const message = buildLightboxUserMessage(material, { group: 'E', lenses: STORY.lenses }).message;
    expect(message).toBe(STORY.request);
    expect(message).not.toMatch(/classified|signature|subverted|\d+%/);
  });
});

describe('group E\'s counts and lanes, from host spans and ranges', () => {
  it('counts the threads drawn, and the open ones across each column of a bucketed ribbon', () => {
    const threads = tilesOf(storyGroup(), 'pressure-thread');
    expect(lightboxPressureCounts(threads)).toEqual({ threads: 4, resolved: 1, carriedOut: 3, dormant: 1 });
    expect(lightboxPressureLane(threads, ALICE.map((_text, index) => ({ from: index + 1, to: index + 1 })))).toEqual([0, 0, 0, 1, 2, 3, 3, 3]);
    // Two paragraphs a column: a thread is open across a column it is planted in, or still open through.
    // It closes in the paragraph that resolves it: the jar, planted and emptied in ¶7, is closed by the time ¶7–¶8 opens.
    expect(lightboxPressureLane(threads, [{ from: 1, to: 2 }, { from: 3, to: 4 }, { from: 5, to: 6 }, { from: 7, to: 8 }])).toEqual([0, 1, 3, 3]);
    const resolvedInEight = threads.map((thread) => (thread.resolution ? { ...thread, resolution: { ...thread.resolution, paragraph: 8 } } : thread));
    expect(lightboxPressureLane(resolvedInEight, [{ from: 7, to: 8 }])).toEqual([4]);
  });

  it('places each column under the movement holding its first paragraph', () => {
    const movements = tilesOf(storyGroup(), 'movement');
    expect(lightboxColumnMovements(movements, [{ from: 1, to: 2 }, { from: 3, to: 4 }, { from: 5, to: 6 }, { from: 7, to: 8 }])
      .map((movement) => movement?.ordinal)).toEqual([1, 1, 2, 3]);
    expect([1, 2, 3, 4, 8, 9].map(lightboxMovementNumeral)).toEqual(['I', 'II', 'III', 'IV', 'VIII', 'IX']);
  });

  it('sums the objects: how many change state, and how many the host kept as planted, unused', () => {
    expect(lightboxArtifactsSummary(tilesOf(storyGroup(), 'artifact'))).toEqual({ objects: 4, changeState: 4, unused: 2 });
  });
});

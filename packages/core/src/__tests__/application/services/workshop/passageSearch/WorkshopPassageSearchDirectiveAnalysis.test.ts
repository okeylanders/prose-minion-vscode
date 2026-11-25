/**
 * The organizing pass's analysis in a persona's results directive (ADR
 * 2026-11-20 D13, D21; #295 widened it). The directive reads the analysis
 * only through the shared display-safe view (headline, sections, claims
 * and their cites) and the shared words: the analysis note and the missing
 * lines, which say what the host's checks dropped, replaced and shortened.
 * It writes no analysis count of its own, and an organized result's frame
 * still fits its bound. Made-up text: Alice.
 */

import * as fs from 'fs';
import * as path from 'path';
import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import { passageSearchAnalysisNote, passageSearchMissingLines } from '@shared/utils/passageSearchWords';
import { PASSAGE_SEARCH_ANALYSIS_MISSING } from '@services/search/passage/PassageSearchContracts';
import {
  fitWorkshopPassageSearchDirective,
  renderWorkshopPassageSearchDirective
} from '@/application/services/workshop/passageSearch/WorkshopPassageSearchDirective';
import { workshopPassageSearchView } from '@handlers/domain/workshop/WorkshopPassageSearchResultView';
import { aliceResult, analysisOf } from '@/__tests__/application/handlers/domain/workshop/passageSearchRouteFixtures';

/** An analysis the host's checks worked on: claims dropped for each reason, a headline and a title replaced, parts shortened, a sample read. */
const checked = analysisOf({
  headline: '14 instances in 6 files',
  sections: [
    { title: 'Group 2', claims: [{ text: 'The Rabbit looks at the watch "took a watch out of its waistcoat-pocket".', cites: [1] }] },
    { title: 'Later', claims: [{ text: 'He hurries on, late again.', cites: [2, 3] }] }
  ],
  read: { instances: 3, of: 12 },
  dropped: { claims: 4, uncited: 2, misquoted: 1, malformed: 1, sections: 1, cites: 3 },
  replaced: { headline: true, titles: 1 },
  clipped: 2
});

const view = (overrides: Parameters<typeof aliceResult>[1] = {}, instances = 3) => workshopPassageSearchView(aliceResult(instances, overrides), 'r-1');

describe('the organizing pass\'s analysis in the results directive', () => {
  it('carries the headline, sections and cited claims, and the shared lines for what the checks dropped, replaced and shortened', () => {
    const organized = view({ analysis: checked });
    const frame = renderWorkshopPassageSearchDirective(organized, 3);
    expect(frame).toContain('Headline: 14 instances in 6 files');
    expect(frame).toContain('Analysis, Group 2:');
    expect(frame).toContain('- He hurries on, late again. [instances 2, 3]');
    // The shared words, exactly as the report says them: the directive adds no analysis count of its own.
    expect(frame).toContain(passageSearchAnalysisNote(organized)!);
    expect(passageSearchAnalysisNote(organized)).toBe('The analysis read 3 of 12 instances.');
    const lines = passageSearchMissingLines(organized);
    for (const line of [
      '2 claims in the analysis were left out: they cited no instance the analysis read.',
      '1 claim in the analysis was left out: it quoted words the cited instances do not hold.',
      '1 claim in the analysis could not be read, and was left out.',
      '1 section of the analysis was left with no claim, and left out.',
      '3 citations in the analysis named no instance it read, and were removed.',
      'The headline is Prose Minion\'s count: the analysis gave none that could be checked.',
      '1 section title in the analysis was replaced with a plain one.',
      '2 parts of the analysis were shortened.'
    ]) {
      expect(lines).toContain(line);
      expect(frame).toContain(line);
    }
  });

  it.each(PASSAGE_SEARCH_ANALYSIS_MISSING)('a pass that left no analysis (%s) is said in the shared words, with no headline', (missing) => {
    const unorganized = view({ analysisMissing: missing });
    const frame = renderWorkshopPassageSearchDirective(unorganized, 3);
    const note = passageSearchAnalysisNote(unorganized);
    expect(note).toBeDefined();
    expect(frame).toContain(note!);
    expect(frame).not.toContain('Headline: ');
  });

  it('writes no analysis count itself: the directive reads only the view\'s headline, sections and claims', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../../../../application/services/workshop/passageSearch/WorkshopPassageSearchDirective.ts'), 'utf8');
    expect(source).not.toMatch(/analysis\.(?:dropped|replaced|clipped|read)\b/);
    expect(source).not.toMatch(/analysisMissing/);
  });

  it('an organized result\'s frame fits its bound in every room, and its summary is never over it either', () => {
    const big = view({
      analysis: analysisOf({
        ...checked,
        sections: Array.from({ length: 8 }, (_, section) => ({
          title: `Part ${section + 1}`,
          claims: Array.from({ length: 8 }, (_, claim) => ({ text: `Claim ${claim + 1}: the Rabbit looks at the watch and hurries on. `.repeat(3), cites: [1, 2] }))
        }))
      })
    }, 40);
    const whole = estimateTextTokens(renderWorkshopPassageSearchDirective(big, 40));
    let summaries = 0;
    for (let free = 0; free <= whole * 2 + 400; free += 61) {
      const fitted = fitWorkshopPassageSearchDirective(big, { freeInputTokens: free });
      if (fitted) {
        expect(estimateTextTokens(fitted.frame)).toBeLessThanOrEqual(Math.floor(free / 2));
        summaries += fitted.summary ? 1 : 0;
      }
    }
    expect(summaries).toBeGreaterThan(0);
    expect(fitWorkshopPassageSearchDirective(big, { freeInputTokens: whole * 2 })!.shown).toBe(40);
  });
});

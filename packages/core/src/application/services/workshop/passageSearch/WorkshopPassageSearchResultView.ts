/**
 * The one place the Workshop reads the engine's result (ADR 2026-11-20 D11,
 * D21). Everything a card, a receipt, the directive and the report need is
 * mapped here to display-safe values, so a change to the engine's result
 * is a change to this module alone.
 *
 * - **Counts** for a card and a receipt: numbers and closed words only.
 * - **The report's input** (`PassageSearchReportResult`), which the
 *   directive renders from too: a file by the path a result shows, never a
 *   host path or a file key.
 * - **Partial**: a search that did not end `complete` or `instance-limit`
 *   is never delivered by the host (D21); an ending this build does not
 *   know reads as partial.
 *
 * The analysis is read defensively: only its headline, sections and what it
 * read are taken, each checked for its form, so a field the organizing pass
 * adds is ignored here until it is mapped on purpose.
 */

import {
  WORKSHOP_PASSAGE_SEARCH_ENDINGS,
  type WorkshopPassageSearchCounts,
  type WorkshopPassageSearchEnded
} from '@messages';
import type { PassageSearchReportResult } from '@shared/utils/passageSearchReport';
import type { PassageSearchResult } from '@services/search/passage/PassageSearchContracts';

const count = (value: unknown): number => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0);
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** How the reads ended, as a card says it; an ending this build does not know is `stopped`: partial, and never auto-delivered. */
function endedOf(result: PassageSearchResult): WorkshopPassageSearchEnded {
  const ended = result.ended as string;
  return (WORKSHOP_PASSAGE_SEARCH_ENDINGS as readonly string[]).includes(ended) ? ended as WorkshopPassageSearchEnded : 'stopped';
}

/** A search that ended before it read everything: never delivered by the host (D21). */
export function isWorkshopPassageSearchPartial(ended: WorkshopPassageSearchEnded): boolean {
  return ended !== 'complete' && ended !== 'instance-limit';
}

/** A result in counts: what a card shows and a receipt keeps. Nothing of what was found. */
export function workshopPassageSearchCounts(result: PassageSearchResult): WorkshopPassageSearchCounts {
  const calls = result.calls as unknown as Record<string, unknown>;
  return {
    instances: result.instances.length,
    files: result.files.read.length,
    labels: result.labels.length,
    dropped: Object.values(result.dropped ?? {}).reduce((sum: number, value) => sum + count(value), 0),
    calls: {
      planned: count(calls.planned),
      answered: count(calls.answered),
      failed: count(calls.failed),
      cut: count(calls.cut),
      // A call dispatched and then cancelled was not answered either: counted with the calls not made.
      unsent: count(calls.unsent) + count(calls.cancelled)
    },
    ended: endedOf(result),
    organized: analysisOf(result) !== undefined
  };
}

function analysisOf(result: PassageSearchResult): PassageSearchReportResult['analysis'] {
  const analysis = result.analysis as unknown as Record<string, unknown> | undefined;
  if (!analysis || typeof analysis.headline !== 'string' || !Array.isArray(analysis.sections)) {
    return undefined;
  }
  const read = (analysis.read ?? {}) as Record<string, unknown>;
  return {
    headline: analysis.headline,
    sections: (analysis.sections as unknown[]).flatMap((entry) => {
      const section = entry as Record<string, unknown> | null;
      if (!section || typeof section.title !== 'string' || !Array.isArray(section.claims)) {
        return [];
      }
      const claims = (section.claims as unknown[]).flatMap((item) => {
        const claim = item as Record<string, unknown> | null;
        return claim && typeof claim.text === 'string' && Array.isArray(claim.cites)
          ? [{ text: claim.text, cites: (claim.cites as unknown[]).filter((cite): cite is number => typeof cite === 'number') }]
          : [];
      });
      return claims.length > 0 ? [{ title: section.title, claims }] : [];
    }),
    read: { instances: count(read.instances) || result.instances.length, of: count(read.of) || result.instances.length }
  };
}

/** The result as the report and the directive read it: display-safe, with the same counts a card shows. */
export function workshopPassageSearchReportOf(result: PassageSearchResult): PassageSearchReportResult {
  const counts = workshopPassageSearchCounts(result);
  const leftOut = (result.files.leftOut ?? {}) as unknown as Record<string, unknown>;
  const analysis = analysisOf(result);
  return {
    question: text(result.question),
    model: text(result.model),
    instances: result.instances.map((instance) => ({
      number: instance.number,
      displayPath: instance.displayPath,
      line: instance.line,
      quote: instance.quote,
      note: text(instance.note),
      label: instance.label
    })),
    labels: result.labels.map((label) => ({ key: label.key, label: label.label, count: label.count, files: label.files })),
    ...(analysis ? { analysis } : {}),
    ...(result.analysisMissing !== undefined ? { analysisMissing: String(result.analysisMissing) } : {}),
    dropped: { ...result.dropped },
    overLimit: count(result.overLimit),
    calls: counts.calls,
    files: {
      read: result.files.read.map((file) => ({ displayPath: file.displayPath })),
      leftOut: { unreadable: count(leftOut.unreadable), unsplittable: count(leftOut.unsplittable), empty: count(leftOut.empty) }
    },
    ended: counts.ended
  };
}

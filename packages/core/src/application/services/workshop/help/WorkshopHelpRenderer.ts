import type { WorkshopCapabilityResult, WorkshopHelpRequest } from '@shared/types/workshopCapabilities';
import { neutralizeReservedPersonaPromptDelimiters as neutralize } from '@/utils/workshopPromptFrames';
import {
  workshopHelpIgnoredTermsLine,
  workshopHelpRequestSummary
} from '@/application/services/workshop/help/WorkshopHelpCopy';
import type { WorkshopHelpLoaded, searchWorkshopHelp } from '@/application/services/workshop/help/WorkshopHelpReference';

export function workshopHelpReadCall(sections: readonly string[]): string {
  return '<prose-minion-tool-call name="help.read">' +
    sections.map(id => `<section>${id}</section>`).join('') + '</prose-minion-tool-call>';
}

/** `header` is `workshopHelpHeader`'s line, the same for a search and a read. */
export function renderWorkshopHelpSearch(
  request: Extract<WorkshopHelpRequest, { capability: 'help.search' }>,
  header: string,
  { hits, matched, ignoredTerms }: ReturnType<typeof searchWorkshopHelp>,
  take: number
): WorkshopCapabilityResult {
  const shown = hits.slice(0, take);
  const notShown = matched - shown.length;
  const content = [
    header,
    ...(ignoredTerms.length ? [neutralize(workshopHelpIgnoredTermsLine(ignoredTerms))] : []),
    ...shown.map(hit => `- ${hit.id} · ${neutralize(hit.heading)}\n  ${neutralize(hit.snippet)}`),
    ...(matched === 0 ? ['No section matched. Try a different term.'] : []),
    ...(notShown ? [`${notShown} more matching ${notShown === 1 ? 'section' : 'sections'} not shown. Narrow the query.`] : []),
    'Read a section whole with help.read and its id.'
  ].join('\n');
  return {
    capability: request.capability, status: 'success', requestSummary: workshopHelpRequestSummary(request), content,
    metadata: {
      matchCount: matched, sectionsRead: shown.length, notShown, truncated: notShown > 0, characters: content.length,
      // A count only: the words are the writer's.
      ...(ignoredTerms.length ? { ignoredTerms: ignoredTerms.length } : {})
    }
  };
}

export function renderWorkshopHelpRead(
  request: Extract<WorkshopHelpRequest, { capability: 'help.read' }>,
  header: string,
  { sections: index }: WorkshopHelpLoaded,
  take: number
): WorkshopCapabilityResult {
  const taken = request.sections.slice(0, take);
  const known = taken.filter(id => index.has(id));
  const remaining = request.sections.slice(take);
  const content = [
    header,
    ...(remaining.length ? [`This read was limited to the first ${take} of ${request.sections.length} sections.`] : []),
    ...taken.map(id => {
      const section = index.get(id);
      return section ? `${id}\n## ${neutralize(section.heading)}\n${neutralize(section.body)}` : `Unknown section: ${id}.`;
    }),
    ...(remaining.length ? [`Read the remaining sections: ${workshopHelpReadCall(remaining)}`] : [])
  ].join('\n');
  return {
    capability: request.capability,
    // A window-limited read of known sections stays `success` with `truncated`, as `lens.read` reports one.
    status: known.length === taken.length ? 'success' : known.length || remaining.length ? 'partial' : 'failed',
    requestSummary: workshopHelpRequestSummary(request), content,
    metadata: {
      sectionsRead: known.length, sectionsNamed: request.sections.length,
      notShown: remaining.length, truncated: remaining.length > 0, characters: content.length
    }
  };
}

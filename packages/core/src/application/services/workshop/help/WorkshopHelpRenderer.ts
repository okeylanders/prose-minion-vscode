import type { WorkshopCapabilityResult, WorkshopHelpRequest } from '@shared/types/workshopCapabilities';
import { neutralizeReservedPersonaPromptDelimiters as neutralize } from '@/utils/workshopPromptFrames';
import { workshopHelpRequestSummary } from '@/application/services/workshop/help/WorkshopHelpCopy';
import type { WorkshopHelpIndex, searchWorkshopHelp } from '@/application/services/workshop/help/WorkshopHelpReference';

export function workshopHelpReadCall(sections: readonly string[]): string {
  return '<prose-minion-tool-call name="help.read">' +
    sections.map(id => `<section>${id}</section>`).join('') + '</prose-minion-tool-call>';
}

const header = (version: string): string => `Prose Minion reference, version ${version}.`;

export function renderWorkshopHelpSearch(
  request: Extract<WorkshopHelpRequest, { capability: 'help.search' }>,
  version: string,
  { hits, matched }: ReturnType<typeof searchWorkshopHelp>,
  take: number
): WorkshopCapabilityResult {
  const shown = hits.slice(0, take);
  const notShown = matched - shown.length;
  const content = [
    header(version),
    ...shown.map(hit => `- ${hit.id} · ${neutralize(hit.heading)}\n  ${neutralize(hit.snippet)}`),
    ...(matched === 0 ? ['No section matched. Try a different term.'] : []),
    ...(notShown ? [`${notShown} more matching ${notShown === 1 ? 'section' : 'sections'} not shown. Narrow the query.`] : []),
    'Read a section whole with help.read and its id.'
  ].join('\n');
  return {
    capability: request.capability, status: 'success', requestSummary: workshopHelpRequestSummary(request), content,
    metadata: { matchCount: matched, sectionsRead: shown.length, notShown, truncated: notShown > 0, characters: content.length }
  };
}

export function renderWorkshopHelpRead(
  request: Extract<WorkshopHelpRequest, { capability: 'help.read' }>,
  version: string,
  index: WorkshopHelpIndex,
  take: number
): WorkshopCapabilityResult {
  const taken = request.sections.slice(0, take);
  const known = taken.filter(id => index.has(id));
  const remaining = request.sections.slice(take);
  const content = [
    header(version),
    ...(remaining.length ? [`This read was limited to the first ${take} of ${request.sections.length} sections.`] : []),
    ...taken.map(id => {
      const section = index.get(id);
      return section ? `${id}\n## ${neutralize(section.heading)}\n${neutralize(section.body)}` : `Unknown section: ${id}.`;
    }),
    ...(remaining.length ? [`Read the remaining sections: ${workshopHelpReadCall(remaining)}`] : [])
  ].join('\n');
  return {
    capability: request.capability,
    status: known.length === taken.length ? 'success' : known.length || remaining.length ? 'partial' : 'failed',
    requestSummary: workshopHelpRequestSummary(request), content,
    metadata: {
      sectionsRead: known.length, sectionsNamed: request.sections.length,
      notShown: remaining.length, truncated: remaining.length > 0, characters: content.length
    }
  };
}
